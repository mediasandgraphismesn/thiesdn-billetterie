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

// Synthèse pure Web Audio API : carillon multi-tonal harmonique doré
export const playNotificationChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;
    const notes = [
      { freq: 587.33, start: 0, duration: 0.16 },
      { freq: 880.00, start: 0.12, duration: 0.20 },
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

// 1. Récupérer les notifications de l'utilisateur connecté
export async function fetchUserNotifications(userId: string): Promise<NotificationItem[]> {
  const client = getSupabaseClient();
  if (!client || !userId) return [];

  try {
    const { data, error } = await client
      .from('user_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.warn('fetchUserNotifications error:', error.message);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      message: row.body,
      timestamp: row.created_at,
      read: Boolean(row.read_at),
      type: row.kind,
      url: row.url || undefined,
    }));
  } catch (err: any) {
    console.warn('fetchUserNotifications catch:', err.message);
    return [];
  }
}

// 2. Marquer une notification comme lue
export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client) return false;

  try {
    const { error } = await client
      .from('user_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId);

    return !error;
  } catch (e) {
    return false;
  }
}

// 3. Tout marquer comme lu pour un utilisateur
export async function markAllNotificationsAsRead(userId: string): Promise<boolean> {
  const client = getSupabaseClient();
  if (!client || !userId) return false;

  try {
    const { error } = await client
      .from('user_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null);

    return !error;
  } catch (e) {
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
      ...data.notification_prefs,
    };
  } catch (e) {
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
  } catch (err: any) {
    return { success: false, message: err.message || 'Erreur lors de la sauvegarde.' };
  }
}

// 6. Activer le Web Push sur l'appareil actuel (promoteur, artiste, admin)
export async function subscribeDeviceToPush(
  userId: string
): Promise<{ success: boolean; message: string }> {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    return { success: false, message: 'Les notifications Push ne sont pas supportées par votre navigateur.' };
  }

  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  if (isIos && !isStandalone) {
    return {
      success: false,
      message: "Sur iPhone, installez d'abord l'application sur l'écran d'accueil pour recevoir les notifications Push.",
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
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }

    const subJson = subscription.toJSON();
    const client = getSupabaseClient();
    if (!client) throw new Error('Client Supabase indisponible.');

    const { error: upsertErr } = await client.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subJson.keys?.p256dh || '',
        auth: subJson.keys?.auth || '',
        user_agent: navigator.userAgent.slice(0, 255),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    );

    if (upsertErr) throw upsertErr;

    return {
      success: true,
      message: '✅ Notifications push activées sur cet appareil !',
    };
  } catch (err: any) {
    return { success: false, message: `Erreur d'activation : ${err.message || 'Échec'}` };
  }
}

// 7. Vérifier si l'appareil actuel est déjà abonné
export async function checkDevicePushSubscription(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    return Boolean(sub);
  } catch {
    return false;
  }
}
