import React from 'react';
import {
  Sliders,
  Shield,
  User,
  Crown,
  Plus,
  Compass,
  Handshake,
} from 'lucide-react';
import { NotificationItem, UserProfile } from '../types';
import { NotificationBell } from './NotificationBell';

interface HeaderProps {
  user: UserProfile;
  notifications: NotificationItem[];
  onMarkNotificationRead: (
    id: string,
    url?: string,
    sourceTable?: NotificationItem['sourceTable']
  ) => void;
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
            width={48}
            height={24}
            decoding="async"
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
          <p className="text-[10px] uppercase font-semibold tracking-wider text-gray-300 -mt-0.5 sm:-mt-1 hidden sm:block">
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
          className="group flex items-center justify-center gap-1.5 h-10 px-2 sm:px-2.5 text-xs sm:text-sm font-medium text-[#E5E2E1] hover:text-white transition-colors rounded-xl hover:bg-white/5 cursor-pointer flex-shrink-0 min-w-[40px]"
          title="Partenariat & Espace Promoteur / Artiste"
        >
          <Handshake className="w-4 h-4 text-gray-300 group-hover:text-white transition-colors flex-shrink-0" />
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
              : 'bg-[#1C1B1B] border-white/5 text-gray-300 hover:text-white'
          }`}
        >
          <Sliders className="w-4 h-4" />
        </button>

        {/* Notifications Multi-Canal & Web Push : Cloche + badge rouge + Opt-in */}
        <NotificationBell
          userId={user.id}
          notifications={notifications}
          onMarkNotificationRead={onMarkNotificationRead}
          onClearNotifications={onClearNotifications}
          isAuthenticated={isAuthenticated}
        />

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
