import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  BellOff,
  Volume2,
  VolumeX,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  X,
  Trash2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { getSupabaseClient } from '../../services/supabase';
import { UserProfile } from '../../types';

interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  user_agent?: string;
  created_at: string;
  last_seen_at: string;
}

interface AdminNotificationCenterProps {
  user: UserProfile;
  onNavigateToOrders: () => void;
  onNewSignaledOrder?: () => void;
  isOpenModal: boolean;
  onCloseModal: () => void;
}

// Convertisseur Base64 URL vers Uint8Array requis par PushManager.subscribe
function urlBase64ToUint8Array(base64String: string): Uint8Array {
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
export const playAdminPaymentChime = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;
    // Accord d'alerte prestige : Ré5 (587.33 Hz), La5 (880.00 Hz), Ré6 (1174.66 Hz)
    const notes = [
      { freq: 587.33, start: 0, duration: 0.16 },
      { freq: 880.00, start: 0.12, duration: 0.20 },
      { freq: 1174.66, start: 0.24, duration: 0.40 },
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

export const AdminNotificationCenter: React.FC<AdminNotificationCenterProps> = ({
  user,
  onNavigateToOrders,
  onNewSignaledOrder,
  isOpenModal,
  onCloseModal,
}) => {
  // Préférence audio locale
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('thiesdn_admin_sound_alert') !== 'false';
  });

  // État des abonnements Web Push
  const [subscriptions, setSubscriptions] = useState<PushSubscriptionRow[]>([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Alerte interactive toast native
  const [incomingAlert, setIncomingAlert] = useState<{
    orderId: string;
    customerName: string;
    amount: string;
    reference: string;
  } | null>(null);

  // Set pour dédoublonner les commandes en mémoire
  const signaledOrderIdsRef = useRef<Set<string>>(new Set());
  const soundEnabledRef = useRef<boolean>(soundEnabled);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    localStorage.setItem('thiesdn_admin_sound_alert', soundEnabled ? 'true' : 'false');
  }, [soundEnabled]);

  // Détection environnement iOS hors PWA autonome
  const isIos =
    typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as any).MSStream;
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true);
  const isIosNeedsInstall = isIos && !isStandalone;

  // 1. Abonnement Supabase Realtime postgres_changes sur 'orders'
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;

    const channel = client
      .channel('admin-orders-payment-alerts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          const newRecord = payload.new as any;
          const oldRecord = payload.old as any;
          if (!newRecord) return;

          // Détecter la transition vers 'payment_signaled'
          const isTransitionToSignaled =
            newRecord.status === 'payment_signaled' &&
            (!oldRecord || oldRecord.status !== 'payment_signaled');

          if (isTransitionToSignaled && !signaledOrderIdsRef.current.has(newRecord.id)) {
            signaledOrderIdsRef.current.add(newRecord.id);

            // Carillon audio Web Audio si activé
            if (soundEnabledRef.current) {
              playAdminPaymentChime();
            }

            // Vibration haptique
            if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
              navigator.vibrate([300, 150, 300, 150, 600]);
            }

            // Déclencher le toast interactif
            const custName = newRecord.customer_name || 'Client';
            const amt = Number(newRecord.total_amount || 0).toLocaleString('fr-FR');
            setIncomingAlert({
              orderId: newRecord.id,
              customerName: custName,
              amount: amt,
              reference: newRecord.reference || newRecord.id.slice(0, 8),
            });

            // Mettre à jour le badge de la barre latérale
            onNewSignaledOrder?.();
          }
        }
      )
      .subscribe();

    return () => {
      // Fermeture propre du canal au démontage (conforme StrictMode)
      client.removeChannel(channel);
    };
  }, [onNewSignaledOrder]);

  // 2. Charger les abonnements de l'admin connecté
  const fetchSubscriptions = async () => {
    const client = getSupabaseClient();
    if (!client) return;
    setLoadingSubscriptions(true);
    try {
      const { data, error } = await client
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setSubscriptions(data as PushSubscriptionRow[]);
      }
    } catch (e: any) {
      console.warn('Erreur lecture push_subscriptions:', e.message);
    } finally {
      setLoadingSubscriptions(false);
    }
  };

  useEffect(() => {
    if (isOpenModal && user.role === 'admin') {
      fetchSubscriptions();
    }
  }, [isOpenModal, user.id, user.role]);

  // 3. Activer les notifications sur cet appareil
  const handleEnablePush = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setStatusFeedback({
        type: 'error',
        text: 'Les notifications Push ne sont pas supportées par votre navigateur.',
      });
      return;
    }

    if (isIosNeedsInstall) {
      setStatusFeedback({
        type: 'error',
        text: "Sur iPhone, installez d'abord l'application sur l'écran d'accueil pour recevoir les notifications système.",
      });
      return;
    }

    setSubscribing(true);
    setStatusFeedback(null);

    try {
      // Déverrouillage audio interactif (Safari/Chrome require user gesture)
      playAdminPaymentChime();

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatusFeedback({
          type: 'error',
          text: 'Autorisation refusée par le navigateur. Veuillez autoriser les notifications dans vos paramètres.',
        });
        setSubscribing(false);
        return;
      }

      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        setStatusFeedback({
          type: 'error',
          text: 'VITE_VAPID_PUBLIC_KEY manquante dans les variables d’environnement.',
        });
        setSubscribing(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      const subJson = subscription.toJSON();
      const client = getSupabaseClient();
      if (!client) throw new Error('Client Supabase non initialisé');

      const { error: upsertErr } = await client.from('push_subscriptions').upsert(
        {
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: subJson.keys?.p256dh || '',
          auth: subJson.keys?.auth || '',
          user_agent: navigator.userAgent.slice(0, 255),
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' }
      );

      if (upsertErr) throw upsertErr;

      setStatusFeedback({
        type: 'success',
        text: '✅ Appareil enregistré ! Vous recevrez des alertes push lors des déclarations de paiement.',
      });
      fetchSubscriptions();
    } catch (err: any) {
      console.error('Erreur activation push:', err);
      setStatusFeedback({
        type: 'error',
        text: `Erreur d'activation : ${err.message || 'Échec de souscription'}`,
      });
    } finally {
      setSubscribing(false);
    }
  };

  // 4. Désactiver un appareil
  const handleRemoveSubscription = async (sub: PushSubscriptionRow) => {
    const client = getSupabaseClient();
    if (!client) return;

    try {
      await client.from('push_subscriptions').delete().eq('id', sub.id);

      // Si c'est l'appareil courant, se désinscrire également auprès du pushManager
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const currentSub = await registration.pushManager.getSubscription();
        if (currentSub && currentSub.endpoint === sub.endpoint) {
          await currentSub.unsubscribe();
        }
      }

      setSubscriptions((prev) => prev.filter((s) => s.id !== sub.id));
      setStatusFeedback({
        type: 'success',
        text: 'Appareil retiré de la liste des alertes.',
      });
    } catch (err: any) {
      setStatusFeedback({
        type: 'error',
        text: `Erreur lors du retrait : ${err.message}`,
      });
    }
  };

  // 5. Test immédiat de l'alerte
  const handleTestAlert = () => {
    // 1. Son
    playAdminPaymentChime();
    // 2. Vibreur
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([300, 150, 300, 150, 600]);
    }
    // 3. Toast
    setIncomingAlert({
      orderId: 'test-order-sample',
      customerName: 'Cheikh Fall (Test)',
      amount: '5 000',
      reference: 'CMD-TEST-777',
    });
  };

  return (
    <>
      {/* ============================================================== */}
      {/* TOAST INTERACTIF NATIF (NOCTURNAL ELEGANCE)                    */}
      {/* ============================================================== */}
      {incomingAlert && (
        <div className="fixed top-6 right-6 z-[9999] max-w-sm w-full animate-in slide-in-from-top-4 duration-300 pointer-events-auto">
          <div className="glass-panel p-4 rounded-2xl border-2 border-[#E9C349] bg-[#0E0E14]/95 shadow-2xl shadow-[#E9C349]/25 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-[#E9C349]/20 text-[#E9C349] flex items-center justify-center text-lg border border-[#E9C349]/40 shadow-inner">
                  💰
                </span>
                <div>
                  <h4 className="font-heading font-extrabold text-sm text-[#E9C349]">
                    Paiement Signalé !
                  </h4>
                  <p className="text-xs text-gray-300 font-semibold truncate max-w-[200px]">
                    {incomingAlert.customerName} — {incomingAlert.amount} FCFA
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIncomingAlert(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                aria-label="Fermer l'alerte"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
              <span className="font-mono text-[10px] text-gray-400">
                Réf: <strong className="text-white">{incomingAlert.reference}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  onNavigateToOrders();
                  setIncomingAlert(null);
                }}
                className="btn-gold-glow py-1.5 px-3.5 rounded-xl font-heading font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <span>Valider</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODALE DE GESTION DES NOTIFICATIONS & APPAREILS ADMIN           */}
      {/* ============================================================== */}
      {isOpenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-[#0E0E14] border border-[#8A2BE2]/40 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#8A2BE2]/20 border border-[#8A2BE2]/40 text-[#DCB8FF] flex items-center justify-center">
                  <Bell className="w-5 h-5 text-[#E9C349]" />
                </div>
                <div>
                  <h3 className="font-heading font-extrabold text-base text-white">
                    Centre d'Alertes Paiements
                  </h3>
                  <p className="text-xs text-gray-400">
                    Notifications temps réel des déclarations clients
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onCloseModal}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Alerte Détection iOS */}
            {isIosNeedsInstall && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-bold">Sur iPhone / iPad :</strong>
                  Installez d'abord l'application sur l'écran d'accueil (Partager &gt; Sur l'écran d'accueil) pour recevoir les alertes système Push.
                </div>
              </div>
            )}

            {/* Feedback Status */}
            {statusFeedback && (
              <div
                className={`p-3 rounded-2xl text-xs flex items-center gap-2 border ${
                  statusFeedback.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                {statusFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                )}
                <span>{statusFeedback.text}</span>
              </div>
            )}

            {/* Contrôles Audio In-App */}
            <div className="glass-panel p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {soundEnabled ? (
                    <Volume2 className="w-5 h-5 text-emerald-400" />
                  ) : (
                    <VolumeX className="w-5 h-5 text-gray-500" />
                  )}
                  <div>
                    <h4 className="font-heading font-bold text-xs text-white">
                      Alertes Sonores de la Console
                    </h4>
                    <p className="text-[11px] text-gray-400">
                      Carillon Web Audio à chaque paiement signalé
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const next = !soundEnabled;
                    setSoundEnabled(next);
                    if (next) playAdminPaymentChime();
                  }}
                  className={`px-3 py-1.5 rounded-xl font-heading font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                    soundEnabled
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-white/5 text-gray-400 border border-white/10'
                  }`}
                >
                  {soundEnabled ? 'Son ON' : 'Son OFF'}
                </button>
              </div>

              <div className="pt-2 border-t border-white/5 flex justify-end">
                <button
                  type="button"
                  onClick={handleTestAlert}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#E9C349]" />
                  <span>Tester l'alerte (Son + Vibreur + Toast)</span>
                </button>
              </div>
            </div>

            {/* Activation Push sur cet Appareil */}
            <div className="glass-panel p-4 rounded-2xl space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Smartphone className="w-5 h-5 text-[#8A2BE2]" />
                  <div>
                    <h4 className="font-heading font-bold text-xs text-white">
                      Notifications Push Système
                    </h4>
                    <p className="text-[11px] text-gray-400">
                      Recevez des alertes même lorsque l'application est fermée
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleEnablePush}
                  disabled={subscribing}
                  className="btn-primary-glow px-4 py-2 rounded-xl font-heading font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {subscribing ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Bell className="w-3.5 h-3.5" />
                  )}
                  <span>{subscribing ? 'Activation...' : 'Activer cet appareil'}</span>
                </button>
              </div>
            </div>

            {/* Liste des Appareils Enregistrés */}
            <div className="space-y-2">
              <h4 className="font-heading font-bold text-xs uppercase tracking-wider text-gray-400 px-1">
                Appareils autorisés ({subscriptions.length})
              </h4>

              {loadingSubscriptions ? (
                <div className="py-6 text-center text-xs text-gray-500">
                  <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1" />
                  Chargement des appareils...
                </div>
              ) : subscriptions.length === 0 ? (
                <div className="p-4 rounded-2xl bg-white/5 border border-white/5 text-center text-xs text-gray-400">
                  Aucun appareil enregistré pour votre compte. Cliquez sur « Activer cet appareil » ci-dessus.
                </div>
              ) : (
                <div className="space-y-2">
                  {subscriptions.map((sub) => (
                    <div
                      key={sub.id}
                      className="p-3 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-gray-200 truncate">
                          {sub.user_agent?.includes('iPhone')
                            ? '📱 iPhone'
                            : sub.user_agent?.includes('Android')
                            ? '📱 Smartphone Android'
                            : sub.user_agent?.includes('Mac')
                            ? '💻 Mac OS'
                            : sub.user_agent?.includes('Windows')
                            ? '💻 Windows PC'
                            : '📱 Appareil'}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          Ajouté le {new Date(sub.created_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveSubscription(sub)}
                        className="p-2 rounded-xl hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Désactiver cet appareil"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={onCloseModal}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-xs transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
