import { getSupabaseClient } from './supabase';
import { NotificationItem } from '../types';

export interface NotificationPrefs {
  event_status: { push: boolean; email: boolean };
  sales: { push: boolean; email: boolean };
  stock: { push: boolean; email: boolean };
  payout: { push: boolean; email: boolean };
  decompte: { push: boolean; email: boolean };
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  event_status: { push: true, email: true },
  sales: { push: true, email: false },
  stock: { push: true, email: false },
  payout: { push: true, email: true },
  decompte: { push: true, email: true },
};

interface MultiChannelNotificationRow {
  id: string;
  type: 'purchase' | 'info' | 'warning';
  title: string;
  body: string;
  action_url: string | null;
  read: boolean;
  created_at: string;
}

interface LegacyUserNotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string;
  url: string | null;
  read_at: string | null;
  created_at: string;
}

// Convertisseur Base64 URL vers Uint8Array pour PushManager.subscribe
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Synthèse pure Web Audio API : carillon multi-tonal harmonique doré (sans aucun fichier MP3)
export const playNotificationChime = () => {
  try {
    const winAudio = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioCtx = window.AudioContext || winAudio.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const now = ctx.currentTime;
    const notes = [
      { freq: 587.33, start: 0, duration: 0.16 },
      { freq: 880.0, start: 0.12, duration: 0.2 },
      { freq: 1174.66, start: 0.24, duration: 0.38 },
    ];
    notes.forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.28, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + duration);
    });
  } catch (e) {
    console.warn('Web Audio error:', e);
  }
};

// Persistence partagée des abonnements Web Push (RPC SECURITY DEFINER + repli upsert)
export async function persistPushSubscription(
  userId: string,
  sub: PushSubscription
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Client Supabase indisponible.');
  }

  const subJson = sub.toJSON();
  const endpoint = sub.endpoint;
  const p256dh = subJson.keys?.p256dh || '';
  const auth = subJson.keys?.auth || '';
  const userAgent =
    typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 255) : '';

  if (!endpoint || !p256dh || !auth) {
    throw new Error('Abonnement Push invalide (clés de chiffrement manquantes).');
  }

  const { data: rpcData, error: rpcError } = await client.rpc('register_push_subscription', {
    p_endpoint: endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
    p_user_agent: userAgent,
  });

  if (!rpcError) {
    const resObj = rpcData as { success?: boolean; message?: string } | null;
    if (resObj && resObj.success === false) {
      throw new Error(resObj.message || 'Impossible d’enregistrer l’abonnement Push.');
    }
    return;
  }

  const { error: upsertErr } = await client.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      user_agent: userAgent,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  );

  if (upsertErr) {
    throw upsertErr;
  }
}

// 1. Récupérer les notifications de l'utilisateur connecté (public.notifications + legacy user_notifications)
export async function fetchUserNotifications(userId: string): Promise<NotificationItem[]> {
  const client = getSupabaseClient();
  if (!client || !userId) return [];

  try {
    const [primaryRes, legacyRes] = await Promise.allSettled([
      client
        .from('notifications')
        .select('id, type, title, body, action_url, read, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(40),
      client
        .from('user_notifications')
        .select('id, kind, title, body, url, read_at, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const items: NotificationItem[] = [];
    const seenIds = new Set<string>();

    if (
      primaryRes.status === 'fulfilled' &&
      !primaryRes.value.error &&
      Array.isArray(primaryRes.value.data)
    ) {
      for (const row of primaryRes.value.data as MultiChannelNotificationRow[]) {
        seenIds.add(row.id);
        items.push({
          id: row.id,
          title: row.title,
          message: row.body,
          timestamp: row.created_at,
          read: Boolean(row.read),
          type: row.type,
          url: row.action_url || undefined,
          actionUrl: row.action_url || undefined,
          sourceTable: 'notifications',
        });
      }
    }

    if (
      legacyRes.status === 'fulfilled' &&
      !legacyRes.value.error &&
      Array.isArray(legacyRes.value.data)
    ) {
      for (const row of legacyRes.value.data as LegacyUserNotificationRow[]) {
        if (seenIds.has(row.id)) continue;
        seenIds.add(row.id);
        items.push({
          id: row.id,
          title: row.title,
          message: row.body,
          timestamp: row.created_at,
          read: Boolean(row.read_at),
          type: row.kind,
          url: row.url || undefined,
          actionUrl: row.url || undefined,
          sourceTable: 'user_notifications',
        });
      }
    }

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return items.slice(0, 50);
  } catch (err) {
    console.warn('fetchUserNotifications catch:', err instanceof Error ? err.message : err);
    return [];
  }
}

// 2. Marquer une notification comme lue
export async function markNotificationAsRead(
  notificationId: string,
  sourceTable?: NotificationItem['sourceTable']
): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || sourceTable === 'local') return false;

  try {
    if (sourceTable === 'notifications') {
      const { error } = await client
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);
      return !error;
    }

    if (sourceTable === 'user_notifications') {
      const { error } = await client
        .from('user_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);
      return !error;
    }

    const [primary, legacy] = await Promise.allSettled([
      client.from('notifications').update({ read: true }).eq('id', notificationId),
      client
        .from('user_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId),
    ]);

    return (
      (primary.status === 'fulfilled' && !primary.value.error) ||
      (legacy.status === 'fulfilled' && !legacy.value.error)
    );
  } catch {
    return false;
  }
}

// 3. Tout marquer comme lu pour un utilisateur
export async function markAllNotificationsAsRead(userId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !userId) return false;

  try {
    const nowIso = new Date().toISOString();
    const [primary, legacy] = await Promise.allSettled([
      client
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false),
      client
        .from('user_notifications')
        .update({ read_at: nowIso })
        .eq('user_id', userId)
        .is('read_at', null),
    ]);

    return (
      (primary.status === 'fulfilled' && !primary.value.error) ||
      (legacy.status === 'fulfilled' && !legacy.value.error)
    );
  } catch {
    return false;
  }
}

// 4. Charger les préférences de notifications
export async function fetchNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  const client = getSupabaseClient();
  if (!client || !userId) return DEFAULT_NOTIFICATION_PREFS;

  try {
    const { data, error } = await client
      .from('profiles')
      .select('notification_prefs')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data || !data.notification_prefs) {
      return DEFAULT_NOTIFICATION_PREFS;
    }

    return {
      ...DEFAULT_NOTIFICATION_PREFS,
      ...(data.notification_prefs as Partial<NotificationPrefs>),
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

// 5. Enregistrer les préférences de notifications
export async function saveNotificationPrefs(
  userId: string,
  prefs: NotificationPrefs
): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient();
  if (!client || !userId) {
    return { success: false, message: 'Client Supabase indisponible.' };
  }

  try {
    const { error } = await client
      .from('profiles')
      .update({ notification_prefs: prefs })
      .eq('id', userId);

    if (error) throw error;
    return { success: true, message: 'Vos préférences ont été enregistrées avec succès.' };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.',
    };
  }
}

// 6. Activer le Web Push sur l'appareil actuel (admin, promoteur, artiste, vendeur POS, client opt-in)
export async function subscribeDeviceToPush(
  userId: string
): Promise<{ success: boolean; message: string }> {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { success: false, message: 'Les notifications Push ne sont pas supportées par votre navigateur.' };
  }

  const winWithStream = window as Window & { MSStream?: unknown };
  const navStandalone = navigator as Navigator & { standalone?: boolean };
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !winWithStream.MSStream;
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches || navStandalone.standalone === true;
  if (isIos && !isStandalone) {
    return {
      success: false,
      message:
        "Sur iPhone, installez d'abord l'application sur l'écran d'accueil pour recevoir les notifications Push.",
    };
  }

  try {
    playNotificationChime();
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, message: 'Autorisation de notification refusée dans le navigateur.' };
    }

    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      return { success: false, message: 'Clé VAPID publique (VITE_VAPID_PUBLIC_KEY) non configurée.' };
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      const appServerKey = urlBase64ToUint8Array(vapidKey) as unknown as BufferSource;
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey,
      });
    }

    await persistPushSubscription(userId, subscription);

    return {
      success: true,
      message: 'Notifications push activées sur cet appareil !',
    };
  } catch (err) {
    return {
      success: false,
      message: `Erreur d'activation : ${err instanceof Error ? err.message : 'Échec'}`,
    };
  }
}

// 7. Vérifier si l'appareil actuel est déjà abonné
export async function checkDevicePushSubscription(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('Notification' in window) || !('PushManager' in window)) {
    return false;
  }
  try {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    return Boolean(sub);
  } catch {
    return false;
  }
}
