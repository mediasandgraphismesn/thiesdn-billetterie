// ============================================================================
// Edge Function : send-push-notification
// Envoi Web Push VAPID haute priorité (onglet fermé / nuit / arrière-plan)
// Déclenchée par trigger PostgreSQL (pg_net + x-webhook-secret) ou test JWT.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push';

const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:contact@thiesdn.site';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let mismatch = 0;
  for (let i = 0; i < a.byteLength; i++) {
    mismatch |= a[i] ^ b[i];
  }
  return mismatch === 0;
}

async function verifySecretConstantTime(
  provided: string | null,
  expected: string | undefined
): Promise<boolean> {
  if (!provided || !expected) return false;
  const enc = new TextEncoder();
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(provided)),
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
  ]);
  return timingSafeEqual(new Uint8Array(hashA), new Uint8Array(hashB));
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: 'Configuration Supabase manquante sur Edge Function' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  let bodyPayload: Record<string, unknown> = {};
  try {
    bodyPayload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Payload JSON invalide' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 1. Authentification :
  //    a) Inter-serveur via x-webhook-secret ou service_role key
  //    b) Sinon utilisateur authentifié (auto-test sur son propre user_id uniquement)
  const providedWebhookSecret = req.headers.get('x-webhook-secret');
  const providedApiKey = req.headers.get('apikey');
  const authHeader = req.headers.get('Authorization') || '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  const isWebhookAuthorized = await verifySecretConstantTime(providedWebhookSecret, WEBHOOK_SECRET);
  const isServiceRoleAuthorized =
    (await verifySecretConstantTime(providedApiKey, SUPABASE_SERVICE_ROLE_KEY)) ||
    (await verifySecretConstantTime(bearerToken, SUPABASE_SERVICE_ROLE_KEY));

  let isServerTrigger = isWebhookAuthorized || isServiceRoleAuthorized;
  let authenticatedUserId: string | null = null;

  if (!isServerTrigger && authHeader && SUPABASE_ANON_KEY) {
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData } = await supabaseAuth.auth.getUser();
    if (userData?.user?.id) {
      authenticatedUserId = userData.user.id;
    }
  }

  if (!isServerTrigger && !authenticatedUserId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return new Response(
      JSON.stringify({ error: 'VAPID_PUBLIC_KEY ou VAPID_PRIVATE_KEY non configurée' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 2. Déterminer les destinataires autorisés
  let targetUserIds: string[] = [];
  if (isServerTrigger) {
    if (Array.isArray(bodyPayload.user_ids)) {
      targetUserIds = bodyPayload.user_ids.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
    } else if (typeof bodyPayload.user_id === 'string' && bodyPayload.user_id.trim().length > 0) {
      targetUserIds = [bodyPayload.user_id.trim()];
    }
  } else if (authenticatedUserId) {
    // Un utilisateur connecté ne peut tester l'envoi push que sur ses propres appareils
    targetUserIds = [authenticatedUserId];
  }

  targetUserIds = Array.from(new Set(targetUserIds));
  if (targetUserIds.length === 0) {
    return new Response(
      JSON.stringify({ success: true, sent: 0, failed: 0, reason: 'no_target_users' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 3. Charger les abonnements Web Push actifs depuis Supabase
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: subscriptions, error: subsError } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', targetUserIds);

  if (subsError) {
    return new Response(JSON.stringify({ error: subsError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!subscriptions || subscriptions.length === 0) {
    return new Response(
      JSON.stringify({ success: true, sent: 0, failed: 0, reason: 'no_push_subscriptions' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 4. Configuration VAPID & Envoi Web Push (urgency high + TTL 24h pour mobile en veille)
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const actionUrl = typeof bodyPayload.action_url === 'string'
    ? bodyPayload.action_url
    : typeof bodyPayload.url === 'string'
    ? bodyPayload.url
    : '/';

  const pushMessage = JSON.stringify({
    title: typeof bodyPayload.title === 'string' && bodyPayload.title.trim()
      ? bodyPayload.title.trim()
      : '🎟️ Notification Thièsdn',
    body: typeof bodyPayload.body === 'string' && bodyPayload.body.trim()
      ? bodyPayload.body.trim()
      : 'Nouvelle activité sur votre espace Thièsdn Billetterie.',
    type: bodyPayload.type || 'purchase',
    action_url: actionUrl,
    url: actionUrl,
    tag: bodyPayload.tag || `thiesdn-push-${Date.now()}`,
  });

  let sent = 0;
  let failed = 0;
  let expiredCleaned = 0;

  interface PushSubscriptionRow {
    id: string;
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }

  await Promise.allSettled(
    (subscriptions as PushSubscriptionRow[]).map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          pushMessage,
          {
            urgency: 'high',
            TTL: 86400, // 24 heures de rétention si téléphone hors-ligne la nuit
          }
        );
        sent++;
        await supabaseAdmin
          .from('push_subscriptions')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', sub.id);
      } catch (err: unknown) {
        failed++;
        const errObj = err as { statusCode?: number; status?: number; message?: string } | null;
        const statusCode = errObj?.statusCode || errObj?.status;
        if (statusCode === 404 || statusCode === 410) {
          expiredCleaned++;
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
        } else {
          console.warn(`Échec push sub ${sub.id} (${statusCode || 'err'}):`, errObj?.message || err);
        }
      }
    })
  );

  return new Response(
    JSON.stringify({
      success: true,
      targetUsers: targetUserIds.length,
      subscriptionsFound: subscriptions.length,
      sent,
      failed,
      expiredCleaned,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
