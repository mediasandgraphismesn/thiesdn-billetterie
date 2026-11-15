import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BellOff,
  BellRing,
  Check,
  CheckCheck,
  Info,
  AlertTriangle,
  Smartphone,
  Ticket,
  Sparkles,
} from 'lucide-react';
import { NotificationItem } from '../types';
import { usePushNotifications } from '../hooks/usePushNotifications';

interface NotificationBellProps {
  userId?: string | null;
  notifications: NotificationItem[];
  onMarkNotificationRead: (
    id: string,
    url?: string,
    sourceTable?: NotificationItem['sourceTable']
  ) => void;
  onClearNotifications: () => void;
  isAuthenticated: boolean;
}

function formatNotificationTime(raw: string): string {
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw;
  }
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Il y a ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Il y a ${diffDays} j`;
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function renderTypeBadge(type: NotificationItem['type']): React.ReactNode {
  if (type === 'purchase' || type === 'sales' || type === 'ticket') {
    return (
      <span className="w-7 h-7 rounded-lg bg-[#E9C349]/15 border border-[#E9C349]/35 flex items-center justify-center shrink-0">
        <Ticket className="w-3.5 h-3.5 text-[#E9C349]" />
      </span>
    );
  }
  if (type === 'warning' || type === 'stock' || type === 'moderation') {
    return (
      <span className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/35 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
      </span>
    );
  }
  return (
    <span className="w-7 h-7 rounded-lg bg-[#8A2BE2]/20 border border-[#8A2BE2]/40 flex items-center justify-center shrink-0">
      <Info className="w-3.5 h-3.5 text-[#DCB8FF]" />
    </span>
  );
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  userId,
  notifications,
  onMarkNotificationRead,
  onClearNotifications,
  isAuthenticated,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    isIosNeedsInstall,
    subscribe,
  } = usePushNotifications(isAuthenticated ? userId : null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!isAuthenticated) {
    return null;
  }

  const handleEnablePush = async () => {
    setFeedback(null);
    const result = await subscribe();
    setFeedback({ ok: result.success, text: result.message });
  };

  return (
    <div ref={containerRef} className="relative flex items-center gap-2">
      {/* Bouton rapide "Activer les alertes" visible sur desktop si non abonné */}
      {isSupported && !isSubscribed && !isIosNeedsInstall && permission !== 'denied' && (
        <button
          type="button"
          onClick={() => {
            void handleEnablePush();
          }}
          disabled={isLoading}
          className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#8A2BE2]/15 hover:bg-[#8A2BE2]/25 border border-[#8A2BE2]/40 text-[#DCB8FF] text-[11px] font-heading font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
          title="Recevoir les alertes d'achat et billets en temps réel même onglet fermé"
        >
          <BellRing className={`w-3.5 h-3.5 text-[#E9C349] ${isLoading ? 'animate-pulse' : ''}`} />
          <span>{isLoading ? 'Activation...' : 'Activer les alertes'}</span>
        </button>
      )}

      {/* Cloche avec Badge Rouge unreadCount */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-[#1C1B1B] hover:bg-[#2A2A2A] border border-white/10 text-[#DCB8FF] transition-all relative cursor-pointer"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ''}`}
        aria-expanded={isOpen}
      >
        {isSubscribed ? (
          <BellRing className="w-4 h-4 sm:w-5 sm:h-5 text-[#E9C349]" />
        ) : (
          <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
        )}
        {unreadCount > 0 && (
          <span
            data-testid="notification-badge"
            className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-red-600 text-white rounded-full text-[10px] font-extrabold flex items-center justify-center shadow-lg shadow-red-600/40 ring-2 ring-[#0a0a0a]"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Notifications Nocturnal Elegance */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Centre de notifications"
          className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-[400px] glass-panel bg-[#121215]/95 backdrop-blur-xl rounded-2xl p-4 shadow-2xl z-50 border border-white/10"
        >
          {/* En-tête du dropdown */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-bold text-sm text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-red-600/20 border border-red-500/40 text-red-300 text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} non {unreadCount > 1 ? 'lues' : 'lue'}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onClearNotifications}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#DCB8FF] hover:text-[#E9C349] transition-colors cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Tout marquer comme lu</span>
              </button>
            )}
          </div>

          {/* Bannière Opt-In Web Push */}
          <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-[#8A2BE2]/15 via-[#1C1B1B] to-[#E9C349]/10 border border-white/10 space-y-2">
            {isIosNeedsInstall ? (
              <div className="flex items-start gap-2.5 text-[11px] text-amber-200">
                <Smartphone className="w-4 h-4 text-[#E9C349] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white">Alertes sur iPhone / iPad</p>
                  <p className="text-gray-300 mt-0.5">
                    Appuyez sur Partager puis &laquo; Sur l&rsquo;écran d&rsquo;accueil &raquo; pour activer les notifications Push.
                  </p>
                </div>
              </div>
            ) : permission === 'denied' ? (
              <div className="flex items-start gap-2.5 text-[11px] text-rose-200">
                <BellOff className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white">Notifications bloquées par le navigateur</p>
                  <p className="text-gray-300 mt-0.5">
                    Autorisez les notifications dans les réglages du site (icône cadenas) pour recevoir les alertes temps réel.
                  </p>
                </div>
              </div>
            ) : !isSupported ? (
              <div className="flex items-center gap-2 text-[11px] text-gray-300">
                <Sparkles className="w-4 h-4 text-[#DCB8FF] shrink-0" />
                <span>Les alertes s&rsquo;affichent en direct ici pendant votre session.</span>
              </div>
            ) : isSubscribed ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[11px] text-emerald-300">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="font-semibold">Alertes actives sur cet appareil (même écran éteint)</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white">Alertes temps réel (jour &amp; nuit)</p>
                  <p className="text-[11px] text-gray-300">
                    Recevez un push instantané sur ce téléphone même onglet fermé.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void handleEnablePush();
                  }}
                  disabled={isLoading}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#8A2BE2] hover:bg-[#9D4EFF] text-white text-[11px] font-heading font-bold uppercase tracking-wider shadow-lg shadow-[#8A2BE2]/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  <BellRing className="w-3.5 h-3.5 text-[#E9C349]" />
                  <span>{isLoading ? '...' : 'Activer les alertes'}</span>
                </button>
              </div>
            )}

            {feedback && (
              <p
                className={`text-[11px] font-medium ${
                  feedback.ok ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                {feedback.text}
              </p>
            )}
          </div>

          {/* Liste des notifications */}
          <div className="divide-y divide-white/5 max-h-80 overflow-y-auto mt-3 pr-0.5 space-y-1">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                Aucune notification pour le moment.
              </div>
            ) : (
              notifications.map((notif) => {
                const targetUrl = notif.actionUrl || notif.url;
                return (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => {
                      onMarkNotificationRead(notif.id, targetUrl, notif.sourceTable);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left p-3 rounded-xl transition-all cursor-pointer flex items-start gap-2.5 ${
                      notif.read
                        ? 'opacity-60 hover:opacity-90 hover:bg-white/5'
                        : 'bg-white/[0.06] hover:bg-white/[0.1] border border-[#8A2BE2]/25'
                    }`}
                  >
                    {renderTypeBadge(notif.type)}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-bold text-white leading-snug">
                          {notif.title}
                        </h4>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {!notif.read && (
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                          )}
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">
                            {formatNotificationTime(notif.timestamp)}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-300 mt-0.5 line-clamp-3">
                        {notif.message}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
