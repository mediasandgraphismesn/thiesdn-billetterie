import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push';

const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:contact@thiesdn.site';
const ADMIN_NOTIFY_EMAIL = Deno.env.get('ADMIN_NOTIFY_EMAIL') || 'contact@thiesdn.site';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

// Échappement HTML sécurisé contre les failles XSS dans les e-mails
export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Comparaison d'octets en temps constant (SHA-256 produit toujours 32 octets)
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (typeof crypto !== 'undefined' && 'timingSafeEqual' in crypto && typeof (crypto as any).timingSafeEqual === 'function') {
    return (crypto as any).timingSafeEqual(a, b);
  }
  if (a.byteLength !== b.byteLength) return false;
  let mismatch = 0;
  for (let i = 0; i < a.byteLength; i++) {
    mismatch |= a[i] ^ b[i];
  }
  return mismatch === 0;
}

// Vérification du secret webhook par hachage SHA-256 en temps constant
export async function verifyWebhookSecret(
  providedSecret: string | null,
  expectedSecret: string | undefined
): Promise<boolean> {
  if (!providedSecret || !expectedSecret) return false;
  const enc = new TextEncoder();
  const [hashProvided, hashExpected] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(providedSecret)),
    crypto.subtle.digest('SHA-256', enc.encode(expectedSecret)),
  ]);
  return timingSafeEqual(new Uint8Array(hashProvided), new Uint8Array(hashExpected));
}

// Nettoyage strict des numéros de téléphone pour les liens tel: (+ et chiffres uniquement)
export function sanitizeTel(phone: string | null | undefined): string {
  if (!phone) return '';
  return phone.replace(/[^0-9+]/g, '');
}

export async function handleWebhookRequest(
  req: Request,
  injectedSupabase?: any,
  injectedWebpush?: any
) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 1. Authentification en temps constant du Webhook Secret
  const providedSecret = req.headers.get('x-webhook-secret');
  const isValidSecret = await verifyWebhookSecret(providedSecret, WEBHOOK_SECRET);
  if (!isValidSecret) {
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid x-webhook-secret' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch (_e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { type, record, old_record } = payload || {};
  const newStatus = record?.status;
  const oldStatus = old_record?.status;

  // 2. Détection de transition vers 'payment_signaled' (Supporte INSERT et UPDATE)
  const isTransitionToSignaled =
    newStatus === 'payment_signaled' &&
    (type === 'INSERT' || !old_record || oldStatus !== 'payment_signaled');

  if (!isTransitionToSignaled) {
    return new Response(
      JSON.stringify({
        skipped: true,
        reason: 'status_not_transitioned_to_payment_signaled',
        status: newStatus,
        previousStatus: oldStatus,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const orderId = record?.id;
  if (!orderId) {
    return new Response(JSON.stringify({ error: 'Missing record.id' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 3. Initialisation du client Supabase (service_role)
  const supabase =
    injectedSupabase ||
    createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });

  // 4. Réservation atomique en base : ne notifie qu'une seule fois
  const { data: updatedOrders, error: updateError } = await supabase
    .from('orders')
    .update({ admin_notified_at: new Date().toISOString() })
    .eq('id', orderId)
    .is('admin_notified_at', null)
    .select('*, events(title, venue, date, time)');

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const order = updatedOrders && updatedOrders[0];
  if (!order) {
    // 0 ligne modifiée = déjà notifié ou verrouillé par une requête concurrente
    return new Response(
      JSON.stringify({ skipped: true, reason: 'already_notified_or_not_found', orderId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // 5. Récupérer le nombre total de paiements actuellement en attente
  const { count: pendingCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'payment_signaled');

  const pendingLabel = pendingCount && pendingCount > 1 ? `${pendingCount} en attente` : '1 en attente';

  const customerName = order.customer_name || 'Client';
  const totalAmount = Number(order.total_amount || 0).toLocaleString('fr-FR');
  const eventTitle = order.event_title || order.events?.title || 'Événement Thièsdn';
  const tierName = order.tier_name || 'Pass Standard';
  const quantity = order.quantity || 1;
  const reference = order.reference || order.id.slice(0, 8);
  const paymentMethod = (order.payment_method || 'wave').toUpperCase();

  // Corps de notification avec décompte des paiements en attente
  const notificationBody = `${customerName} — ${totalAmount} FCFA — ${eventTitle} (${tierName} ×${quantity}) — ${reference} (${pendingLabel})`;

  // 6. Canal PUSH (Web Push VAPID)
  const pushService = injectedWebpush || webpush;
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    try {
      pushService.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    } catch (e: any) {
      console.warn('Configuration VAPID error:', e.message);
    }
  }

  const sendPushNotifications = async (): Promise<{ successCount: number; failedCount: number }> => {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.warn('VAPID keys not configured, skipping Web Push.');
      return { successCount: 0, failedCount: 0 };
    }

    // Récupérer les profils admin
    const { data: adminProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin');

    if (profilesError || !adminProfiles || adminProfiles.length === 0) {
      return { successCount: 0, failedCount: 0 };
    }

    const adminIds = adminProfiles.map((p: any) => p.id);
    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', adminIds);

    if (subsError || !subscriptions || subscriptions.length === 0) {
      return { successCount: 0, failedCount: 0 };
    }

    const pushPayload = JSON.stringify({
      title: '💰 Paiement à valider',
      body: notificationBody,
      tag: `order-${order.id}`,
      url: '/?tab=orders',
    });

    let successCount = 0;
    let failedCount = 0;

    const pushPromises = subscriptions.map(async (sub: any) => {
      try {
        await pushService.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          pushPayload,
          {
            urgency: 'high',
            TTL: 3600,
          }
        );
        successCount++;
        // Mettre à jour last_seen_at
        await supabase
          .from('push_subscriptions')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', sub.id);
      } catch (err: any) {
        failedCount++;
        const statusCode = err?.statusCode || err?.status;
        // Si l'abonnement est expiré ou révoqué (404 Not Found ou 410 Gone), le supprimer de la base
        if (statusCode === 404 || statusCode === 410) {
          console.info(`Suppression subscription expirée (${statusCode}) : ${sub.id}`);
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        } else {
          console.warn(`Erreur envoi push sub ${sub.id}:`, err.message);
        }
      }
    });

    await Promise.allSettled(pushPromises);
    return { successCount, failedCount };
  };

  // 7. Canal E-MAIL (Resend)
  const sendAdminEmail = async (): Promise<{ success: boolean; error?: string }> => {
    if (!RESEND_API_KEY) {
      const msg = 'RESEND_API_KEY non configuré';
      await supabase.from('email_logs').insert({
        order_id: order.id,
        recipient: ADMIN_NOTIFY_EMAIL,
        status: 'failed',
        error_message: msg,
      });
      return { success: false, error: msg };
    }

    const telClean = sanitizeTel(order.customer_phone);
    const emailSubject = `💰 Paiement à valider — ${reference} — ${totalAmount} FCFA`;
    const emailHtml = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style="margin: 0; padding: 12px; background-color: #050505; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background: #0A0A0A; color: #F5F5F5; padding: 24px; border-radius: 16px; border: 1px solid #262626;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 16px;">
            <span style="font-size: 24px;">💰</span>
            <h1 style="color: #E9C349; font-size: 20px; margin: 0; font-weight: 800; letter-spacing: 0.5px;">
              Paiement Signalé à Valider
            </h1>
          </div>
          <p style="font-size: 14px; line-height: 1.5; color: #D1D5DB; margin: 0 0 16px 0;">
            Un client vient de déclarer son règlement. Veuillez vérifier la transaction sur votre compte marchand puis valider la commande pour émettre le billet officiel.
          </p>
          <div style="background: #141414; border: 1px solid #262626; border-radius: 12px; padding: 16px; margin-bottom: 24px; font-size: 14px; line-height: 1.8;">
            <p style="margin: 0;"><strong>Client :</strong> ${escapeHtml(customerName)}</p>
            <p style="margin: 0;"><strong>Téléphone :</strong> <a href="tel:${escapeHtml(telClean)}" style="color: #E9C349; text-decoration: none; font-weight: bold;">${escapeHtml(order.customer_phone || 'Non renseigné')}</a></p>
            <p style="margin: 0;"><strong>Événement :</strong> ${escapeHtml(eventTitle)}</p>
            <p style="margin: 0;"><strong>Formule :</strong> ${escapeHtml(tierName)} (×${quantity} place${quantity > 1 ? 's' : ''})</p>
            <p style="margin: 0;"><strong>Montant :</strong> <span style="color: #E9C349; font-weight: 800; font-size: 16px;">${escapeHtml(totalAmount)} FCFA</span></p>
            <p style="margin: 0;"><strong>Mode de Paiement :</strong> ${escapeHtml(paymentMethod)}</p>
            <p style="margin: 0;"><strong>Référence de Commande :</strong> <span style="font-family: monospace; color: #DCB8FF; font-weight: bold;">${escapeHtml(reference)}</span></p>
            ${order.payment_reference ? `<p style="margin: 0;"><strong>Réf Transaction Client :</strong> <span style="font-family: monospace; color: #34D399;">${escapeHtml(order.payment_reference)}</span></p>` : ''}
          </div>
          <div style="text-align: center; margin: 28px 0;">
            <a href="https://billetterie.thiesdn.site/?tab=orders" style="display: inline-block; min-height: 48px; background: #8A2BE2; color: #FFFFFF; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 15px; box-shadow: 0 4px 14px rgba(138,43,226,0.4);">
              ⚡ Valider le Paiement dans la Console
            </a>
          </div>
          <p style="font-size: 11px; color: #71717A; text-align: center; margin: 20px 0 0 0;">
            Notification automatique réservée aux administrateurs — Thiès Days and Nights Billetterie
          </p>
        </div>
      </body>
      </html>
    `;

    try {
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Thièsdn Billetterie <noreply@notifications.thiesdn.site>',
          to: ADMIN_NOTIFY_EMAIL,
          subject: emailSubject,
          html: emailHtml,
        }),
      });

      const resData = await emailResponse.json();
      if (!emailResponse.ok) {
        const errorMsg = resData?.message || resData?.error?.message || `Resend HTTP ${emailResponse.status}`;
        await supabase.from('email_logs').insert({
          order_id: order.id,
          recipient: ADMIN_NOTIFY_EMAIL,
          status: 'failed',
          error_message: errorMsg,
        });
        return { success: false, error: errorMsg };
      }

      await supabase.from('email_logs').insert({
        order_id: order.id,
        recipient: ADMIN_NOTIFY_EMAIL,
        status: 'sent',
        error_message: null,
      });

      return { success: true };
    } catch (err: any) {
      await supabase.from('email_logs').insert({
        order_id: order.id,
        recipient: ADMIN_NOTIFY_EMAIL,
        status: 'failed',
        error_message: err.message,
      });
      return { success: false, error: err.message };
    }
  };

  // 8. Exécution conjointe et indépendante des canaux (Promise.allSettled)
  const [pushResult, emailResult] = await Promise.allSettled([
    sendPushNotifications(),
    sendAdminEmail(),
  ]);

  const pushVal = pushResult.status === 'fulfilled' ? pushResult.value : { successCount: 0, failedCount: 0 };
  const emailVal = emailResult.status === 'fulfilled' ? emailResult.value : { success: false, error: 'Rejected' };

  // 9. CORRECTION 3 : Si PUSH ET E-MAIL échouent tous les deux, restaurer admin_notified_at à NULL
  const bothFailed = pushVal.successCount === 0 && !emailVal.success;
  if (bothFailed) {
    console.error(`Tous les canaux ont échoué pour la commande ${order.id}. Restauration admin_notified_at à NULL.`);
    await supabase
      .from('orders')
      .update({ admin_notified_at: null })
      .eq('id', order.id);

    return new Response(
      JSON.stringify({
        error: 'Échec de tous les canaux de notification',
        rolledBack: true,
        push: pushVal,
        email: emailVal,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      orderId: order.id,
      reference,
      push: pushVal,
      email: emailVal,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Démarrage du serveur HTTP Deno si exécuté comme point d'entrée principal
if (import.meta.main) {
  serve((req) => handleWebhookRequest(req));
}
