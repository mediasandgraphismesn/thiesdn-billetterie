import React, { useState } from 'react';
import {
  Bell,
  Sliders,
  Shield,
  User,
  Crown,
  Plus,
  Compass,
  Handshake,
} from 'lucide-react';
import { NotificationItem, UserProfile } from '../types';

interface HeaderProps {
  user: UserProfile;
  notifications: NotificationItem[];
  onMarkNotificationRead: (id: string) => void;
  onClearNotifications: () => void;
  currentRole: 'user' | 'promoter' | 'admin' | 'sales_agent' | 'artist';
  isAuthenticated?: boolean;
  onOpenAuth?: () => void;
  ambientShader: boolean;
  onToggleShader: () => void;
  onOpenCreateModal: () => void;
  pendingModerationCount: number;
  onNavigate: (tab: string) => void;
  isAdminPreview?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  notifications,
  onMarkNotificationRead,
  onClearNotifications,
  currentRole,
  isAuthenticated = false,
  onOpenAuth,
  ambientShader,
  onToggleShader,
  onOpenCreateModal,
  pendingModerationCount,
  onNavigate,
  isAdminPreview = false,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="bg-[#131313]/95 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50 px-3 sm:px-6 h-[60px] w-full flex items-center justify-between transition-all pt-[env(safe-area-inset-top)]">
      {/* Brand & Logo Officiel */}
      <div 
        onClick={() => onNavigate(currentRole === 'admin' && !isAdminPreview ? 'dashboard' : 'home')}
        className="flex items-center gap-2 sm:gap-3 cursor-pointer group min-w-0 flex-1 sm:flex-initial mr-2 sm:mr-0"
      >
        <div className="w-9 h-9 sm:w-10 sm:h-10 px-1 sm:px-2 py-1 rounded-xl bg-white/5 border border-white/10 hover:border-[#E9C349]/40 flex items-center justify-center shadow-lg shadow-[#8A2BE2]/10 group-hover:scale-105 transition-all flex-shrink-0">
          <img
            src="/logo-tight.png"
            alt="Thièsdn Logo"
            className="h-5 sm:h-6 w-auto object-contain"
          />
        </div>
        <div className="min-w-0 flex-1 sm:flex-initial">
          <h1 className="font-heading text-base sm:text-xl font-bold tracking-tight text-white flex items-center gap-1.5 truncate">
            <span>Thiès</span>
            <span className="text-[#E9C349] font-normal text-xs sm:text-base opacity-90 truncate hidden min-[380px]:inline">
              Days and Nights
            </span>
          </h1>
          <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-400 -mt-0.5 sm:-mt-1 hidden sm:block">
            {currentRole === 'admin' && !isAdminPreview ? 'Console Back-Office' : 'Plateforme Officielle'}
          </p>
        </div>
      </div>

      {/* Navigation Centrale Public : Uniquement pour Clients & Visiteurs (Strictement masqué pour Super Admin) */}
      <div className="hidden md:flex items-center gap-3">
        {!(currentRole === 'admin' && !isAdminPreview) && (
          <button
            onClick={() => onNavigate('explore')}
            className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 hover:text-white transition-colors px-3 py-1.5 rounded-full hover:bg-white/5"
          >
            <Compass className="w-4 h-4 text-[#E9C349]" />
            <span>Explorer les Événements</span>
          </button>
        )}
      </div>

      {/* Contrôles Droite */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
        {/* Bouton Discret Partenariat (Accès Showcase Motion Design) */}
        <button
          onClick={() => onNavigate('showcase')}
          className="group flex items-center justify-center gap-1.5 h-10 px-2 sm:px-2.5 text-xs sm:text-sm font-medium text-gray-400 hover:text-white transition-colors rounded-xl hover:bg-white/5 cursor-pointer flex-shrink-0 min-w-[40px]"
          title="Partenariat & Espace Promoteur / Artiste"
        >
          <Handshake className="w-4 h-4 text-gray-400 group-hover:text-white transition-colors flex-shrink-0" />
          <span className="hidden sm:inline">Partenariat</span>
        </button>

        {/* Bouton Connexion Visiteur (Uniquement si NON connecté) */}
        {!isAuthenticated && (
          <button
            onClick={onOpenAuth}
            className="flex items-center justify-center gap-1.5 bg-[#8A2BE2] hover:bg-[#7b23cf] text-white px-3 sm:px-4 h-10 rounded-xl text-xs font-bold transition-all shadow-md shadow-[#8A2BE2]/20 flex-shrink-0 min-w-[40px]"
          >
            <User className="w-3.5 h-3.5" />
            <span className="hidden min-[340px]:inline">Connexion</span>
          </button>
        )}

        {/* Bouton "Créer un Événement" : Visible pour les rôles promoter et artist */}
        {isAuthenticated && (currentRole === 'promoter' || currentRole === 'artist') && (
          <button
            onClick={onOpenCreateModal}
            className="flex items-center justify-center gap-1.5 bg-[#8A2BE2]/20 hover:bg-[#8A2BE2] text-[#DCB8FF] hover:text-white px-2.5 sm:px-3.5 h-10 rounded-xl border border-[#8A2BE2]/40 text-xs font-bold tracking-wide transition-all shadow-sm min-w-[40px]"
            title="Créer un Événement"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Créer</span>
          </button>
        )}

        {/* Contrôle Shader d'Ambiance : Masqué sous sm selon directive 5 */}
        <button
          onClick={onToggleShader}
          title={ambientShader ? 'Désactiver effets d’ambiance' : 'Activer effets d’ambiance néon'}
          className={`hidden sm:flex w-10 h-10 min-w-[40px] min-h-[40px] items-center justify-center rounded-xl border transition-all ${
            ambientShader
              ? 'bg-[#8A2BE2]/20 border-[#8A2BE2]/50 text-[#DCB8FF]'
              : 'bg-[#1C1B1B] border-white/5 text-gray-400 hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4" />
        </button>

        {/* Notifications Popover : Uniquement pour les utilisateurs connectés */}
        {isAuthenticated && (
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-[#1C1B1B] hover:bg-[#2A2A2A] border border-white/10 text-[#DCB8FF] transition-all relative"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#E9C349] text-[#241A00] rounded-full text-[10px] font-extrabold flex items-center justify-center shadow-md">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-3 sm:w-96 glass-panel rounded-2xl p-4 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-200 border border-white/10">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-bold text-sm text-white">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="bg-[#8A2BE2]/30 text-[#DCB8FF] text-[11px] font-semibold px-2 py-0.5 rounded-full">
                        {unreadCount} nouvelles
                      </span>
                    )}
                  </div>
                  {notifications.length > 0 && (
                    <button
                      onClick={onClearNotifications}
                      className="text-[11px] text-[#DCB8FF] hover:underline"
                    >
                      Tout marquer comme lu
                    </button>
                  )}
                </div>

                <div className="divide-y divide-white/5 max-h-80 overflow-y-auto mt-2">
                  {notifications.length === 0 ? (
                    <div className="py-6 text-center text-xs text-gray-400">
                      Aucune notification pour le moment.
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => onMarkNotificationRead(notif.id)}
                        className={`p-3 rounded-xl transition-all cursor-pointer ${
                          notif.read ? 'opacity-60' : 'bg-white/5'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-bold text-white">{notif.title}</h4>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">
                            {notif.timestamp}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-300 mt-0.5">{notif.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* User Avatar & Accès Profil */}
        {isAuthenticated && (
          <div
            onClick={() => onNavigate('profile')}
            className="flex items-center gap-2 pl-1 cursor-pointer group"
            title="Mon Profil"
          >
            <div className="relative">
              <img
                src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop'}
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover border border-[#8A2BE2]/80 group-hover:border-[#E9C349] transition-colors"
              />
              {currentRole === 'admin' ? (
                <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-[#8A2BE2] rounded-full border border-black flex items-center justify-center">
                  <Shield className="w-2 h-2 text-white" />
                </span>
              ) : currentRole === 'promoter' ? (
                <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-[#E9C349] rounded-full border border-black flex items-center justify-center">
                  <Crown className="w-2 h-2 text-black" />
                </span>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
