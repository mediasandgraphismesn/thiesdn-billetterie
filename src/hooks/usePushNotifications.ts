import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '../services/supabase';
import {
  persistPushSubscription,
  playNotificationChime,
  urlBase64ToUint8Array,
} from '../services/userNotificationService';

export type PushPermissionState = NotificationPermission | 'unsupported';

export interface UsePushNotificationsResult {
  isSupported: boolean;
  permission: PushPermissionState;
  isSubscribed: boolean;
  isLoading: boolean;
  isIosNeedsInstall: boolean;
  error: string | null;
  statusMessage: string | null;
  subscribe: () => Promise<{ success: boolean; message: string }>;
  unsubscribe: () => Promise<{ success: boolean; message: string }>;
  refreshStatus: () => Promise<void>;
}

const getIsIosNeedsInstall = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const winWithStream = window as Window & { MSStream?: unknown };
  const navStandalone = navigator as Navigator & { standalone?: boolean };
  const isIos = /iPad|iPhone|iPod/.test(ua) && !winWithStream.MSStream;
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches || navStandalone.standalone === true;
  return isIos && !isStandalone;
};

const getIsPushApiSupported = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
};

const ensureServiceWorkerRegistration = async (): Promise<ServiceWorkerRegistration> => {
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (!existing) {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Peut être déjà géré par vite-plugin-pwa /registerSW.js
    });
  }
  return navigator.serviceWorker.ready;
};

export function usePushNotifications(userId?: string | null): UsePushNotificationsResult {
  const isSupported = getIsPushApiSupported();
  const isIosNeedsInstall = getIsIosNeedsInstall();

  const [permission, setPermission] = useState<PushPermissionState>(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!isSupported) {
      setPermission('unsupported');
      setIsSubscribed(false);
      return;
    }

    setPermission(Notification.permission);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      if (!reg) {
        setIsSubscribed(false);
        return;
      }
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(Boolean(sub));

      // Resynchroniser silencieusement l'abonnement actif avec le compte connecté
      if (sub && userId && Notification.permission === 'granted') {
        await persistPushSubscription(userId, sub).catch(() => {});
      }
    } catch {
      setIsSubscribed(false);
    }
  }, [isSupported, userId]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  // Écouter les renouvellements push envoyés par public/sw.js (pushsubscriptionchange)
  useEffect(() => {
    if (!isSupported || !userId) return;
    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED') {
        void refreshStatus();
      }
    };
    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    };
  }, [isSupported, userId, refreshStatus]);

  const subscribe = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    setError(null);
    setStatusMessage(null);

    if (!userId) {
      const msg = 'Connectez-vous pour activer les alertes push.';
      setError(msg);
      return { success: false, message: msg };
    }

    if (!isSupported) {
      const msg = 'Les notifications Push ne sont pas supportées sur ce navigateur.';
      setError(msg);
      return { success: false, message: msg };
    }

    if (isIosNeedsInstall) {
      const msg =
        "Sur iPhone / iPad, ajoutez d'abord Thièsdn sur l'écran d'accueil (Partager > Sur l'écran d'accueil) puis activez les alertes.";
      setError(msg);
      return { success: false, message: msg };
    }

    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      const msg = 'Clé VAPID publique (VITE_VAPID_PUBLIC_KEY) manquante.';
      setError(msg);
      return { success: false, message: msg };
    }

    setIsLoading(true);
    try {
      playNotificationChime();

      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== 'granted') {
        const msg = 'Permission de notification refusée par le navigateur.';
        setError(msg);
        return { success: false, message: msg };
      }

      const registration = await ensureServiceWorkerRegistration();
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const appServerKey = urlBase64ToUint8Array(vapidKey) as unknown as BufferSource;
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey,
        });
      }

      await persistPushSubscription(userId, subscription);
      setIsSubscribed(true);
      const okMsg = 'Alertes Push activées sur cet appareil !';
      setStatusMessage(okMsg);
      return { success: true, message: okMsg };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erreur lors de l’activation des notifications.';
      setError(message);
      return { success: false, message };
    } finally {
      setIsLoading(false);
    }
  }, [userId, isSupported, isIosNeedsInstall]);

  const unsubscribe = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    setError(null);
    setStatusMessage(null);

    if (!isSupported) {
      return { success: false, message: 'Web Push non supporté.' };
    }

    setIsLoading(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      const sub = reg ? await reg.pushManager.getSubscription() : null;

      if (sub) {
        const client = getSupabaseClient();
        if (client && userId) {
          await client
            .from('push_subscriptions')
            .delete()
            .eq('user_id', userId)
            .eq('endpoint', sub.endpoint);
        }
        await sub.unsubscribe();
      }

      setIsSubscribed(false);
      const okMsg = 'Alertes Push désactivées sur cet appareil.';
      setStatusMessage(okMsg);
      return { success: true, message: okMsg };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la désactivation.';
      setError(message);
      return { success: false, message };
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, userId]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    isIosNeedsInstall,
    error,
    statusMessage,
    subscribe,
    unsubscribe,
    refreshStatus,
  };
}
