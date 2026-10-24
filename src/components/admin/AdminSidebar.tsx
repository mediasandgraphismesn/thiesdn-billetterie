import React from 'react';
import {
  LayoutDashboard,
  ShieldCheck,
  CreditCard,
  Users,
  Wallet,
  QrCode,
  Settings,
  CheckCircle2,
  Smartphone,
  PlusCircle,
} from 'lucide-react';
import { UserProfile } from '../../types';

interface AdminSidebarProps {
  user: UserProfile;
  activeTab: string;
  onTabChange: (tab: string) => void;
  pendingModerationCount: number;
  pendingOrdersCount: number;
  onToggleAdminPreview?: () => void;
  isAdminPreview?: boolean;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  user,
  activeTab,
  onTabChange,
  pendingModerationCount,
  pendingOrdersCount,
  onToggleAdminPreview,
  isAdminPreview = false,
}) => {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Tableau de bord',
      icon: LayoutDashboard,
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
    {
      id: 'users',
      label: 'Gestion des Utilisateurs',
      icon: Users,
    },
    {
      id: 'finances',
      label: 'Finances & Transactions',
      icon: Wallet,
    },
    {
      id: 'checkin',
      label: "Contrôle d'Accès (Scanner)",
      icon: QrCode,
    },
    {
      id: 'accreditations',
      label: 'Accréditations & Badges',
      icon: ShieldCheck,
      badge: 'Badges',
      badgeStyle: 'bg-[#8A2BE2]/20 text-[#DCB8FF]',
    },
    {
      id: 'stations',
      label: 'Postes de Contrôle (Scanners)',
      icon: Smartphone,
      badge: 'Multi-Entrées',
      badgeStyle: 'bg-emerald-500/20 text-emerald-400',
    },
    {
      id: 'settings',
      label: 'Paramètres de la Plateforme',
      icon: Settings,
    },
  ];

  return (
    <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 w-72 bg-[#141414]/95 backdrop-blur-2xl border-r border-white/10 p-5 pt-20 shadow-2xl">
      {/* Profil Super Admin */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-[#1C1B1B] to-[#121212] border border-[#8A2BE2]/30 mb-6 relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 w-24 h-24 bg-[#8A2BE2]/15 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center gap-3 relative z-10">
          <div className="relative">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#E9C349] shadow-md">
              <img
                src={user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop'}
                alt={user.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-[#8A2BE2] p-1 rounded-full text-white">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="font-heading text-sm font-bold text-white truncate">
              {user.name}
            </h2>
            <p className="text-xs text-[#E9C349] font-medium flex items-center gap-1 mt-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#E9C349]" />
              <span>Superviseur Admin</span>
            </p>
          </div>
        </div>

        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] text-gray-400">
          <span className="flex items-center gap-1 text-[#DCB8FF]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Console Globale
          </span>
          <span className="bg-[#8A2BE2]/20 text-[#DCB8FF] px-2 py-0.5 rounded-full font-bold uppercase text-[9px] border border-[#8A2BE2]/30">
            Super Admin
          </span>
        </div>
      </div>

      {/* Bouton d'action directe : Créer un Événement (visible uniquement pour admin et promoter) */}
      {(user.role === 'admin' || user.role === 'promoter') && (
        <button
          onClick={() => onTabChange('create')}
          className={`w-full mb-4 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-heading font-bold text-xs tracking-wider uppercase transition-all shadow-md ${
            activeTab === 'create'
              ? 'bg-[#8A2BE2] text-white shadow-[#8A2BE2]/50 border border-white/20 ring-2 ring-[#DCB8FF]/40'
              : 'bg-gradient-to-r from-[#8A2BE2] to-[#6A0DAD] hover:from-[#9B42F5] hover:to-[#7B1FA2] text-white shadow-[#8A2BE2]/30 hover:scale-[1.01]'
          }`}
        >
          <PlusCircle className="w-4 h-4 text-[#E9C349]" />
          <span>Créer un Événement</span>
        </button>
      )}

      {/* Menu d'Administration Strict */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto">
        <p className="text-[11px] uppercase tracking-wider text-gray-400 font-extrabold px-3 mb-2 font-heading">
          Menu Back-Office
        </p>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-heading font-bold transition-all text-left ${
                isActive
                  ? 'bg-gradient-to-r from-[#8A2BE2]/30 to-[#8A2BE2]/10 text-white border border-[#8A2BE2]/40 shadow-inner'
                  : 'text-[#CFC2D7] hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#E9C349]' : 'text-gray-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${item.badgeStyle}`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
};
