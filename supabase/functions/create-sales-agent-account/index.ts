// ============================================================================
// Edge Function : create-sales-agent-account
// Provisionne et lie de façon sécurisée un compte Supabase Auth + Profil
// (role = 'sales_agent') pour un point de vente (table public.sales_agents).
// Zéro secret côté client : SUPABASE_SERVICE_ROLE_KEY reste strictement serveur.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProvisionPayload {
  agentId?: string;
  action?: 'provision' | 'reset_password';
  email?: string;
  pointDeVente?: string;
  gerantName?: string;
  telephone?: string;
  eventId?: string;
  regeneratePassword?: boolean;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function buildFallbackPosEmail(phone?: string, fallbackSeed?: string): string {
  let digits = (phone || '').replace(/[^0-9]/g, '');
  if (digits.startsWith('00221')) {
    digits = digits.slice(2);
  }
  if (
    digits.length === 9 &&
    (digits.startsWith('70') ||
      digits.startsWith('75') ||
      digits.startsWith('76') ||
      digits.startsWith('77') ||
      digits.startsWith('78'))
  ) {
    digits = `221${digits}`;
  }
  if (digits.length >= 7) {
    return `${digits}@pos.thiesdn.site`;
  }
  const safeSeed = (fallbackSeed || 'vendeur').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'vendeur';
  return `${safeSeed}@pos.thiesdn.site`;
}

function pickRandomChars(charset: string, count: number): string[] {
  const bytes = new Uint8Array(count);
  crypto.getRandomValues(bytes);
  const chars: string[] = [];
  for (let i = 0; i < count; i++) {
    chars.push(charset[bytes[i] % charset.length]);
  }
  return chars;
}

/**
 * Mot de passe temporaire de 8 caractères lisibles sans caractères ambigus (0/O, 1/I/l),
 * compatible avec les politiques Auth (majuscule, minuscule, chiffre, caractère spécial '!').
 */
function generateTempPassword(): string {
  const chars = [
    ...pickRandomChars('ABCDEFGHJKLMNPQRSTUVWXYZ', 2),
    ...pickRandomChars('abcdefghjkmnpqrstuvwxyz', 3),
    ...pickRandomChars('23456789', 2),
    '!',
  ];
  const shuffleBytes = new Uint8Array(chars.length);
  crypto.getRandomValues(shuffleBytes);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = shuffleBytes[i] % (i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  return chars.join('');
}

async function upsertSalesAgentProfile(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  name: string,
  email: string,
  phone: string
): Promise<string | null> {
  // Uniquement les colonnes garanties sur public.profiles (jamais is_email_confirmed / updated_at)
  const { error: fullErr } = await supabaseAdmin
    .from('profiles')
    .upsert(
      {
        id: userId,
        name,
        email,
        phone: phone || null,
        role: 'sales_agent',
      },
      { onConflict: 'id' }
    );

  if (!fullErr) return null;

  const { error: minimalErr } = await supabaseAdmin
    .from('profiles')
    .upsert(
      {
        id: userId,
        name,
        role: 'sales_agent',
      },
      { onConflict: 'id' }
    );

  return minimalErr ? minimalErr.message : null;
}

async function linkSalesAgentRow(
  supabaseAdmin: ReturnType<typeof createClient>,
  agentId: string,
  userId: string,
  email: string
): Promise<string | null> {
  const { error } = await supabaseAdmin
    .from('sales_agents')
    .update({
      user_id: userId,
      email,
    })
    .eq('id', agentId);

  return error ? error.message : null;
}

async function findExistingAuthUserByEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  targetEmail: string
): Promise<{ id: string; email: string; role: string } | null> {
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, role, email')
    .ilike('email', targetEmail)
    .maybeSingle();

  if (existingProfile?.id) {
    return {
      id: String(existingProfile.id),
      email: String(existingProfile.email || targetEmail),
      role: String(existingProfile.role || '').toLowerCase(),
    };
  }

  // Repli si un compte auth.users existe déjà sans ligne dans public.profiles
  const { data: listData } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const matched = listData?.users?.find(
    (u) => (u.email || '').trim().toLowerCase() === targetEmail
  );
  if (!matched?.id) return null;

  const { data: profileById } = await supabaseAdmin
    .from('profiles')
    .select('id, role, email')
    .eq('id', matched.id)
    .maybeSingle();

  return {
    id: String(matched.id),
    email: String(matched.email || profileById?.email || targetEmail),
    role: String(
      profileById?.role ||
        (typeof matched.user_metadata?.role === 'string' ? matched.user_metadata.role : '')
    ).toLowerCase(),
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Méthode non autorisée.' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        { success: false, error: 'Configuration serveur Supabase incomplète.' },
        500
      );
    }

    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return jsonResponse(
        { success: false, error: 'Authentification requise (JWT manquant).' },
        401
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Vérifier la session de l'appelant auprès de Supabase Auth
    const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token);
    if (callerError || !callerData?.user) {
      return jsonResponse(
        { success: false, error: 'Session invalide ou expirée.' },
        401
      );
    }
    const caller = callerData.user;

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', caller.id)
      .maybeSingle();

    const callerRole = String(callerProfile?.role || '').toLowerCase();
    if (callerRole !== 'admin' && callerRole !== 'promoter') {
      return jsonResponse(
        { success: false, error: 'Accès refusé : rôle Administrateur ou Promoteur requis.' },
        403
      );
    }

    const payload = (await req.json().catch(() => ({}))) as ProvisionPayload;
    const agentId = payload.agentId?.trim();

    if (!agentId || !UUID_REGEX.test(agentId)) {
      return jsonResponse(
        { success: false, error: 'Identifiant du point de vente (agentId UUID) manquant ou invalide.' },
        400
      );
    }

    // 2. Charger la fiche point de vente existante
    const { data: agentRow, error: agentFetchError } = await supabaseAdmin
      .from('sales_agents')
      .select('*')
      .eq('id', agentId)
      .maybeSingle();

    if (agentFetchError || !agentRow) {
      return jsonResponse(
        { success: false, error: 'Point de vente introuvable en base de données.' },
        404
      );
    }

    // 3. Vérifier que le promoteur est bien propriétaire du point de vente ou de l'événement
    if (callerRole !== 'admin') {
      const ownsAgent = String(agentRow.promoter_id || '').toLowerCase() === caller.id.toLowerCase();
      let ownsEvent = false;
      const checkEventId = agentRow.event_id || payload.eventId;
      if (checkEventId && UUID_REGEX.test(String(checkEventId))) {
        const { data: eventRow } = await supabaseAdmin
          .from('events')
          .select('promoter_id')
          .eq('id', checkEventId)
          .maybeSingle();
        ownsEvent = Boolean(
          eventRow?.promoter_id &&
            String(eventRow.promoter_id).toLowerCase() === caller.id.toLowerCase()
        );
      }

      if (!ownsAgent && !ownsEvent) {
        return jsonResponse(
          { success: false, error: 'Vous ne pouvez gérer que les points de vente de vos propres événements.' },
          403
        );
      }
    }

    const rawEmail = (payload.email || agentRow.email || '').trim().toLowerCase();
    const targetPhone = (payload.telephone || agentRow.telephone || '').trim();
    const targetName = (payload.gerantName || agentRow.gerant_name || agentRow.point_de_vente || 'Vendeur').trim();
    const targetEmail =
      rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)
        ? rawEmail
        : buildFallbackPosEmail(targetPhone, agentRow.id);

    const isResetRoute = new URL(req.url).pathname.replace(/\/+$/, '').endsWith('/reset-password');
    const shouldRegenerate =
      isResetRoute || payload.action === 'reset_password' || Boolean(payload.regeneratePassword);

    // 4. Cas A : Le point de vente possède déjà un user_id lié
    if (agentRow.user_id && UUID_REGEX.test(String(agentRow.user_id))) {
      const existingUserId = String(agentRow.user_id);
      const { data: existingProfile } = await supabaseAdmin
        .from('profiles')
        .select('id, role, email')
        .eq('id', existingUserId)
        .maybeSingle();

      const existingRole = String(existingProfile?.role || '').toLowerCase();
      if (existingRole === 'admin' || existingRole === 'promoter') {
        return jsonResponse(
          {
            success: false,
            error: `Ce point de vente est lié à un compte ${existingRole} qui ne peut pas être rétrogradé.`,
          },
          409
        );
      }

      const { data: authUserRes } = await supabaseAdmin.auth.admin.getUserById(existingUserId);
      const authEmail = authUserRes?.user?.email || existingProfile?.email || targetEmail;
      let tempPassword: string | undefined;

      if (shouldRegenerate) {
        tempPassword = generateTempPassword();
        const { error: updAuthErr } = await supabaseAdmin.auth.admin.updateUserById(existingUserId, {
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            name: targetName,
            full_name: targetName,
            phone: targetPhone,
            role: 'sales_agent',
          },
        });
        if (updAuthErr) {
          return jsonResponse(
            { success: false, error: `Impossible de réinitialiser le mot de passe Auth : ${updAuthErr.message}` },
            500
          );
        }
      }

      const profileErr = await upsertSalesAgentProfile(
        supabaseAdmin,
        existingUserId,
        targetName,
        authEmail,
        targetPhone
      );
      if (profileErr) {
        return jsonResponse(
          { success: false, error: `Erreur mise à jour profil vendeur : ${profileErr}` },
          500
        );
      }

      if (!agentRow.email && authEmail) {
        const linkErr = await linkSalesAgentRow(supabaseAdmin, agentRow.id, existingUserId, authEmail);
        if (linkErr) {
          return jsonResponse(
            { success: false, error: `Erreur liaison sales_agents : ${linkErr}` },
            500
          );
        }
      }

      return jsonResponse({
        success: true,
        userId: existingUserId,
        email: authEmail,
        tempPassword,
        password: tempPassword,
        created: false,
        passwordReset: shouldRegenerate,
      });
    }

    // 5. Cas B : user_id manquant — création (ou rattachement sécurisé si email déjà enregistré)
    const tempPassword = generateTempPassword();
    let provisionedUserId: string | null = null;
    let provisionedEmail = targetEmail;
    let wasCreated = false;

    const { data: createdData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: targetEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        name: targetName,
        full_name: targetName,
        phone: targetPhone,
        role: 'sales_agent',
      },
    });

    if (!createError && createdData?.user?.id) {
      provisionedUserId = createdData.user.id;
      provisionedEmail = createdData.user.email || targetEmail;
      wasCreated = true;
    } else {
      // Vérifier si un profil ou compte auth.users orphelin existe déjà avec cet email
      const existingByEmail = await findExistingAuthUserByEmail(supabaseAdmin, targetEmail);

      if (!existingByEmail?.id) {
        return jsonResponse(
          {
            success: false,
            error: createError?.message || 'Impossible de créer le compte vendeur Auth.',
          },
          400
        );
      }

      const existingRole = String(existingByEmail.role || '').toLowerCase();
      if (existingRole === 'admin' || existingRole === 'promoter') {
        return jsonResponse(
          {
            success: false,
            error: `L'adresse ${targetEmail} est déjà utilisée par un compte ${existingRole}. Utilisez un autre e-mail pour le point de vente.`,
          },
          409
        );
      }

      // Vérifier si ce compte n'est pas déjà lié à un autre sales_agent actif
      const { data: otherAgent } = await supabaseAdmin
        .from('sales_agents')
        .select('id, point_de_vente')
        .eq('user_id', existingByEmail.id)
        .neq('id', agentRow.id)
        .maybeSingle();

      if (otherAgent?.id) {
        return jsonResponse(
          {
            success: false,
            error: `L'adresse ${targetEmail} est déjà rattachée au point de vente "${otherAgent.point_de_vente}".`,
          },
          409
        );
      }

      const { error: resetExistingErr } = await supabaseAdmin.auth.admin.updateUserById(
        existingByEmail.id,
        {
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            name: targetName,
            full_name: targetName,
            phone: targetPhone,
            role: 'sales_agent',
          },
        }
      );

      if (resetExistingErr) {
        return jsonResponse(
          {
            success: false,
            error: `Impossible de rattacher le compte existant : ${resetExistingErr.message}`,
          },
          500
        );
      }

      provisionedUserId = existingByEmail.id;
      provisionedEmail = existingByEmail.email || targetEmail;
    }

    if (!provisionedUserId) {
      return jsonResponse({ success: false, error: 'Échec inattendu du provisioning Auth.' }, 500);
    }

    // 6. Garantir le rôle sales_agent dans public.profiles & lier public.sales_agents.user_id
    const profileUpsertErr = await upsertSalesAgentProfile(
      supabaseAdmin,
      provisionedUserId,
      targetName,
      provisionedEmail,
      targetPhone
    );

    if (profileUpsertErr) {
      return jsonResponse(
        { success: false, error: `Erreur mise à jour profil vendeur : ${profileUpsertErr}` },
        500
      );
    }

    const linkErr = await linkSalesAgentRow(
      supabaseAdmin,
      agentRow.id,
      provisionedUserId,
      provisionedEmail
    );

    if (linkErr) {
      return jsonResponse(
        { success: false, error: `Compte créé mais erreur liaison sales_agents : ${linkErr}` },
        500
      );
    }

    return jsonResponse({
      success: true,
      userId: provisionedUserId,
      email: provisionedEmail,
      tempPassword,
      password: tempPassword,
      created: wasCreated,
      passwordReset: true,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur interne Edge Function.';
    return jsonResponse({ success: false, error: message }, 500);
  }
});
