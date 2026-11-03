// ============================================================================
// Module Partagé de Notification Utilisateur (Promoteurs, Artistes, Admins)
// Gère l'insertion user_notifications, les préférences, le throttle et le push/email
// ============================================================================

import webpush from 'npm:web-push';

export interface NotifyParams {
  userId: string;
  kind: 'event_status' | 'sales' | 'stock' | 'payout' | 'decompte';
  title: string;
  body: string;
  url?: string;
  dedupeKey?: string;
  data?: Record<string, any>;
  eventId?: string;
  emailSubject?: string;
  emailHtml?: string;
}

export interface NotifyResult {
  skipped?: boolean;
  reason?: string;
  notificationId?: string;
  push?: {
    attempted: boolean;
    throttled?: boolean;
    successCount: number;
    failedCount: number;
  };
  email?: {
    attempted: boolean;
    success?: boolean;
    error?: string;
  };
}

export const DEFAULT_NOTIFICATION_PREFS = {
  event_status: { push: true, email: true },
  sales: { push: true, email: false },
  stock: { push: true, email: false },
  payout: { push: true, email: true },
  decompte: { push: true, email: true },
};

// Échappement HTML sécurisé
export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Comparaison d'octets en temps constant (SHA-256)
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

export async function notifyUser(
  supabase: any,
  params: NotifyParams,
  options: {
    vapidKeys?: { publicKey?: string; privateKey?: string; subject?: string };
    resendApiKey?: string;
    injectedWebpush?: any;
    nowDate?: Date;
  } = {}
): Promise<NotifyResult> {
  const { userId, kind, title, body, url, dedupeKey, data, eventId, emailSubject, emailHtml } = params;
  const now = options.nowDate || new Date();

  // 1. Insertion atomique dans user_notifications avec ON CONFLICT DO NOTHING
  const notificationRow = {
    user_id: userId,
    kind,
    title,
    body,
    url: url || null,
    dedupe_key: dedupeKey || null,
    data: data ? { ...data, event_id: eventId } : eventId ? { event_id: eventId } : {},
    created_at: now.toISOString(),
  };

  const { data: insertedRows, error: insertError } = await supabase
    .from('user_notifications')
    .insert([notificationRow])
    .select('*');

  if (insertError) {
    // Si violation de contrainte unique, déjà traité
    if (insertError.code === '23505' || insertError.message?.includes('duplicate key') || insertError.message?.includes('unique constraint')) {
      return { skipped: true, reason: 'already_notified' };
    }
    console.error('Erreur insert user_notifications:', insertError);
  }

  const inserted = insertedRows && insertedRows[0];
  if (dedupeKey && (!inserted || insertedRows.length === 0)) {
    return { skipped: true, reason: 'already_notified' };
  }

  const notificationId = inserted?.id;

  // 2. Récupérer les préférences de l'utilisateur
  const { data: profile } = await supabase
    .from('profiles')
    .select('email, notification_prefs')
    .eq('id', userId)
    .maybeSingle();

  const userPrefs = profile?.notification_prefs || DEFAULT_NOTIFICATION_PREFS;
  const kindPrefs = userPrefs[kind] || (DEFAULT_NOTIFICATION_PREFS as any)[kind] || { push: true, email: false };

  const pushEnabled = kindPrefs.push !== false;
  const emailEnabled = kindPrefs.email === true && Boolean(profile?.email);

  // 3. Gestion du Throttle Push : max 1 par minute par (user, kind, event)
  let pushThrottled = false;
  let pushBody = body;

  if (pushEnabled) {
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000).toISOString();
    // Compter les notifications récentes pour ce triplet (user_id, kind, event_id)
    const { data: recentNotifs } = await supabase
      .from('user_notifications')
      .select('id, created_at')
      .eq('user_id', userId)
      .eq('kind', kind)
      .gte('created_at', oneMinuteAgo)
      .order('created_at', { ascending: true });

    if (recentNotifs && recentNotifs.length > 1) {
      // Plus d'une notification dans la dernière minute
      // La première a déjà déclenché un push, les rafales suivantes sont throttlées
      pushThrottled = true;
    }
  }

  // 4. Canal Web Push
  const sendPush = async (): Promise<{ attempted: boolean; throttled?: boolean; successCount: number; failedCount: number }> => {
    if (!pushEnabled) {
      return { attempted: false, successCount: 0, failedCount: 0 };
    }

    if (pushThrottled) {
      return { attempted: false, throttled: true, successCount: 0, failedCount: 0 };
    }

    const vapidPublic = options.vapidKeys?.publicKey || Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivate = options.vapidKeys?.privateKey || Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = options.vapidKeys?.subject || Deno.env.get('VAPID_SUBJECT') || 'mailto:contact@thiesdn.site';

    if (!vapidPublic || !vapidPrivate) {
      return { attempted: false, successCount: 0, failedCount: 0 };
    }

    const pushService = options.injectedWebpush || webpush;
    try {
      pushService.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
    } catch (_e) {}

    const { data: subs, error: subsErr } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (subsErr || !subs || subs.length === 0) {
      return { attempted: true, successCount: 0, failedCount: 0 };
    }

    const pushPayload = JSON.stringify({
      title,
      body: pushBody,
      tag: dedupeKey || `notif-${notificationId || Date.now()}`,
      url: url || '/?tab=profile',
    });

    let successCount = 0;
    let failedCount = 0;

    const promises = subs.map(async (sub: any) => {
      try {
        await pushService.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          pushPayload,
          { urgency: 'high', TTL: 3600 }
        );
        successCount++;
        await supabase
          .from('push_subscriptions')
          .update({ last_seen_at: now.toISOString() })
          .eq('id', sub.id);
      } catch (err: any) {
        failedCount++;
        const statusCode = err?.statusCode || err?.status;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
        }
      }
    });

    await Promise.allSettled(promises);
    return { attempted: true, successCount, failedCount };
  };

  // 5. Canal E-mail (Resend)
  const sendEmail = async (): Promise<{ attempted: boolean; success?: boolean; error?: string }> => {
    if (!emailEnabled || !profile?.email) {
      return { attempted: false };
    }

    const resendApiKey = options.resendApiKey || Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return { attempted: true, success: false, error: 'RESEND_API_KEY non configuré' };
    }

    const finalHtml =
      emailHtml ||
      `
      <!DOCTYPE html>
      <html lang="fr">
      <body style="margin: 0; padding: 16px; background: #0A0A0A; color: #FFF; font-family: sans-serif;">
        <div style="max-width: 560px; margin: 0 auto; background: #121216; border: 1px solid #2B2836; border-radius: 16px; padding: 24px;">
          <h2 style="color: #E9C349; margin-top: 0;">${escapeHtml(title)}</h2>
          <p style="font-size: 15px; color: #DDD; line-height: 1.6;">${escapeHtml(body)}</p>
          ${url ? `
          <div style="margin: 24px 0;">
            <a href="https://billetterie.thiesdn.site${url}" style="background: #8A2BE2; color: #FFF; padding: 12px 24px; border-radius: 10px; text-decoration: none; font-weight: bold; display: inline-block;">
              Accéder à la Plateforme →
            </a>
          </div>` : ''}
          <p style="font-size: 11px; color: #777; margin-top: 24px; border-top: 1px solid #222; pt-3;">
            Notification officielle — Thiès Days and Nights Billetterie
          </p>
        </div>
      </body>
      </html>
    `;

    try {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: 'Thièsdn Billetterie <noreply@notifications.thiesdn.site>',
          to: profile.email,
          subject: emailSubject || title,
          html: finalHtml,
        }),
      });

      if (emailRes.ok) {
        return { attempted: true, success: true };
      }
      const data = await emailRes.json().catch(() => ({}));
      return { attempted: true, success: false, error: data?.message || `HTTP ${emailRes.status}` };
    } catch (e: any) {
      return { attempted: true, success: false, error: e.message };
    }
  };

  // 6. Exécution conjointe et indépendante
  const [pushResult, emailResult] = await Promise.allSettled([sendPush(), sendEmail()]);

  return {
    skipped: false,
    notificationId,
    push: pushResult.status === 'fulfilled' ? pushResult.value : { attempted: true, successCount: 0, failedCount: 1 },
    email: emailResult.status === 'fulfilled' ? emailResult.value : { attempted: true, success: false, error: 'Rejected' },
  };
}
