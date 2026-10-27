import React from 'react';
import {
  LayoutDashboard,
  Compass,
  Ticket,
  ShieldCheck,
  QrCode,
  Settings,
  PlusCircle,
  Crown,
  CheckCircle2,
  Wallet,
  Eye,
  EyeOff,
  User,
  CreditCard,
  Users,
  BarChart3,
  Store,
  Award,
  Smartphone,
} from 'lucide-react';
import { UserProfile } from '../types';

interface SidebarProps {
  user: UserProfile;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOpenCreateModal: () => void;
  pendingModerationCount: number;
  pendingOrdersCount?: number;
  totalEventsCount: number;
  onToggleAdminPreview?: () => void;
  isAdminPreview?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeTab,
  onTabChange,
  onOpenCreateModal,
  pendingModerationCount,
  pendingOrdersCount = 0,
  totalEventsCount,
  onToggleAdminPreview,
  isAdminPreview = false,
}) => {
  // Navigation strictement cloisonnée selon le rôle
  const getNavItems = () => {
    if (user.role === 'admin' && !isAdminPreview) {
      return [
        { id: 'dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
        {
          id: 'events_mgmt',
          label: 'Gestion des Événements',
          icon: Ticket,
          badge: totalEventsCount > 0 ? `${totalEventsCount}` : undefined,
          badgeStyle: 'bg-[#8A2BE2]/20 text-[#DCB8FF] font-bold border border-[#8A2BE2]/30',
        },
        {
          id: 'moderation',
          label: 'Modération des Événements',
          icon: ShieldCheck,
          badge: pendingModerationCount > 0 ? `${pendingModerationCount}` : undefined,
          badgeStyle: 'bg-rose-500 text-white font-extrabold shadow-sm',
        },
        {
          id: 'orders',
          label: 'Validation des Paiements',
          icon: CreditCard,
          badge: pendingOrdersCount > 0 ? `${pendingOrdersCount}` : undefined,
          badgeStyle: 'bg-rose-500 text-white font-extrabold shadow-sm',
        },
        { id: 'users', label: 'Gestion des Utilisateurs', icon: Users },
        { id: 'finances', label: 'Finances & Transactions', icon: Wallet },
        { id: 'checkin', label: "Contrôle d'Accès (Scanner)", icon: QrCode },
        { id: 'accreditations', label: 'Accréditations & Badges', icon: ShieldCheck, badge: 'Badges', badgeStyle: 'bg-[#8A2BE2]/20 text-[#DCB8FF]' },
        { id: 'stations', label: 'Postes de Contrôle (Scanners)', icon: Smartphone },
        { id: 'settings', label: 'Paramètres de la Plateforme', icon: Settings },
      ];
    }

    if (user.role === 'promoter') {
      return [
        { id: 'home', label: 'Mes Événements', icon: LayoutDashboard, badge: totalEventsCount > 0 ? `${totalEventsCount}` : undefined },
        { id: 'explore', label: 'Explorer la Carte', icon: Compass },
        { id: 'create', label: 'Créer un Événement', icon: PlusCircle },
        { id: 'points_de_vente', label: 'Points de Vente', icon: Store, badge: 'Physique', badgeStyle: 'bg-[#E9C349]/20 text-[#E9C349]' },
        { id: 'finances', label: 'Cockpit & Réseau Vente', icon: BarChart3, badge: 'Direct', badgeStyle: 'bg-[#E9C349]/20 text-[#E9C349]' },
        { id: 'accreditations', label: 'Accréditations Staff/Presse', icon: ShieldCheck, badge: 'Badges', badgeStyle: 'bg-[#8A2BE2]/20 text-[#DCB8FF]' },
        { id: 'stations', label: 'Postes de Contrôle (Scanners)', icon: Smartphone, badge: 'Multi-Entrées', badgeStyle: 'bg-emerald-500/20 text-emerald-400' },
        { id: 'artist', label: 'Vue Artiste & Co-Prod', icon: Award },
        { id: 'profile', label: 'Mon Profil Organisateur', icon: Settings },
      ];
    }

    if (user.role === 'artist') {
      return [
        { id: 'home', label: 'Accueil / Événements', icon: LayoutDashboard, badge: totalEventsCount > 0 ? `${totalEventsCount}` : undefined },
        { id: 'create', label: 'Créer un Événement', icon: PlusCircle },
        { id: 'artist', label: 'Mes Statistiques Artiste', icon: Award, badge: 'Co-Prod', badgeStyle: 'bg-[#E9C349]/20 text-[#E9C349]' },
        { id: 'accreditations', label: 'Mes Accréditations & Invités', icon: ShieldCheck, badge: 'VIP', badgeStyle: 'bg-[#8A2BE2]/20 text-[#DCB8FF]' },
        { id: 'profile', label: 'Mon Profil', icon: Settings },
      ];
    }

    if (user.role === 'sales_agent') {
      return [
        { id: 'sales_agent', label: 'Mon Guichet Vendeur', icon: Store, badge: 'Point de Vente', badgeStyle: 'bg-emerald-500/20 text-emerald-400' },
        { id: 'profile', label: 'Mon Profil', icon: Settings },
      ];
    }

    // Rôle : Client / Utilisateur Standard (ou Admin en mode aperçu visiteur)
    return [
      { id: 'home', label: 'Accueil / Événements', icon: LayoutDashboard, badge: totalEventsCount > 0 ? `${totalEventsCount}` : undefined },
      { id: 'explore', label: 'Explorer la Carte', icon: Compass },
      { id: 'tickets', label: 'Mes Billets & Pass VIP', icon: Ticket },
      { id: 'profile', label: 'Mon Profil', icon: Settings },
    ];
  };

  const navItems = getNavItems();

  return (
    <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 w-72 bg-[#1C1B1B]/95 backdrop-blur-2xl border-r border-white/10 p-5 pt-20 shadow-2xl">
      {/* User Status Badge */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-[#201F1F] to-[#141414] border border-white/10 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-[#8A2BE2]/10 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center gap-3 relative z-10">
          <div className="relative">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#E9C349] shadow-md">
              <img
                src={user.avatar}
                alt={user.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-[#8A2BE2] p-1 rounded-full text-white">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="font-heading text-sm font-bold text-white truncate">
                {user.name}
              </h2>
            </div>
            <p className="text-xs text-[#E9C349] font-medium flex items-center gap-1">
              {user.role === 'admin' ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{isAdminPreview ? 'Aperçu Visiteur' : 'Superviseur Admin'}</span>
                </>
              ) : user.role === 'promoter' ? (
                <>
                  <Crown className="w-3.5 h-3.5" />
                  <span>Promoteur Certifié</span>
                </>
              ) : user.role === 'artist' ? (
                <>
                  <Crown className="w-3.5 h-3.5 text-[#E9C349]" />
                  <span className="text-[#E9C349] font-bold">Artiste Co-Producteur</span>
                </>
              ) : user.role === 'sales_agent' ? (
                <>
                  <Store className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Point de Vente Agréé</span>
                </>
              ) : (
                <>
                  <User className="w-3.5 h-3.5" />
                  <span>Espace Client</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] text-gray-400">
          <span className="flex items-center gap-1 text-[#DCB8FF]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Compte Vérifié
          </span>
          <span className="bg-[#8A2BE2]/20 text-[#DCB8FF] px-2 py-0.5 rounded-full font-bold uppercase text-[9px]">
            {isAdminPreview ? 'mode client' : user.role}
          </span>
        </div>
      </div>

      {/* Primary Action Button - For Promoters & Artists (Strictement interdit pour l'admin) */}
      {(user.role === 'promoter' || user.role === 'artist') && (
        <button
          onClick={onOpenCreateModal}
          className="w-full mb-6 btn-primary-glow py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-heading font-bold text-xs tracking-wider uppercase transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Créer un Événement</span>
        </button>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto">
        <p className="text-[11px] uppercase tracking-wider text-gray-400 font-bold px-3 mb-2">
          {user.role === 'admin' && !isAdminPreview
            ? 'Administration'
            : user.role === 'promoter'
            ? 'Gestion Promoteur'
            : 'Espace Billetterie'}
        </p>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all text-left ${
                isActive
                  ? 'bg-gradient-to-r from-[#8A2BE2]/30 to-[#8A2BE2]/10 text-white border border-[#8A2BE2]/40 font-semibold shadow-inner'
                  : 'text-[#CFC2D7] hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#DCB8FF]' : 'text-gray-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    item.badgeStyle || 'bg-white/10 text-gray-300'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Admin Test Feature: Bouton Mode Visiteur (Ouvre l'interface publique) */}
      {user.role === 'admin' && (
        <div className="pt-3 pb-2 border-t border-white/10 space-y-2">
          <button
            onClick={() => {
              if (onToggleAdminPreview) onToggleAdminPreview();
              if (typeof window !== 'undefined' && !isAdminPreview) {
                window.open('/?preview=client', '_blank');
              }
            }}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all border ${
              isAdminPreview
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:text-white'
            }`}
          >
            {isAdminPreview ? (
              <>
                <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                <span>Quitter le Mode Visiteur</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-[#DCB8FF]" />
                <span>Mode Visiteur (Ouvrir Interface Publique)</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Footer System Status */}
      <div className="pt-3 border-t border-white/10">
        <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-gray-300 font-medium">Billetterie Live SN</span>
          </div>
          <span className="text-[10px] text-gray-400">Thiès • Saly • Mbour</span>
        </div>
      </div>
    </aside>
  );
};
