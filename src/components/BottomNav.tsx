import React from 'react';
import {
  Home,
  Compass,
  Ticket,
  ShieldCheck,
  User,
  Wallet,
  PlusCircle,
  BarChart3,
  Store,
  Award,
  Users,
  LayoutDashboard,
} from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  pendingCount?: number;
  ticketsCount?: number;
  userRole: 'user' | 'promoter' | 'admin' | 'sales_agent' | 'artist';
  isAuthenticated?: boolean;
  isAdminPreview?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  pendingCount = 0,
  ticketsCount = 0,
  userRole,
  isAuthenticated = false,
  isAdminPreview = false,
}) => {
  const getTabs = () => {
    // 1. Visiteur non connecté
    if (!isAuthenticated) {
      return [
        { id: 'home', label: 'Accueil', icon: Home },
        { id: 'explore', label: 'Explorer', icon: Compass },
        { id: 'profile', label: 'Connexion', icon: User },
      ];
    }

    // 2. Administrateur (sans mode aperçu) : Back-Office Pur
    if (userRole === 'admin' && !isAdminPreview) {
      return [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'events_mgmt', label: 'Événements', icon: Ticket },
        {
          id: 'moderation',
          label: 'Modération',
          icon: ShieldCheck,
          badge: pendingCount > 0 ? pendingCount : undefined,
          badgeColor: 'bg-rose-500 text-white font-bold',
        },
        { id: 'orders', label: 'Paiements', icon: Wallet },
        { id: 'settings', label: 'Paramètres', icon: User },
      ];
    }

    // 3. Promoteur (Exactement 4 onglets : Cockpit, Billets, Réseau, Profil)
    if (userRole === 'promoter') {
      return [
        { id: 'finances', label: 'Cockpit', icon: LayoutDashboard },
        { id: 'points_de_vente', label: 'Billets', icon: Ticket },
        { id: 'network', label: 'Réseau', icon: Users },
        { id: 'profile', label: 'Profil', icon: User },
      ];
    }

    // 4. Espace Artiste / Staff Co-Production
    if (userRole === 'artist') {
      return [
        { id: 'home', label: 'Accueil', icon: Home },
        { id: 'create', label: 'Créer', icon: PlusCircle },
        { id: 'artist', label: 'Stats Artiste', icon: Award },
        { id: 'profile', label: 'Mon Profil', icon: User },
      ];
    }

    // 5. Point de Vente / Collaborateur Réseau
    if (userRole === 'sales_agent') {
      return [
        { id: 'sales_agent', label: 'Mon Guichet', icon: Store },
        { id: 'profile', label: 'Mon Profil', icon: User },
      ];
    }

    // 6. Client / Membre (ou Admin en mode aperçu visiteur)
    return [
      { id: 'home', label: 'Accueil', icon: Home },
      { id: 'explore', label: 'Explorer', icon: Compass },
      {
        id: 'tickets',
        label: 'Mes Billets',
        icon: Ticket,
        badge: ticketsCount > 0 ? ticketsCount : undefined,
      },
      { id: 'profile', label: 'Mon Profil', icon: User },
    ];
  };

  const tabs = getTabs();

  return (
    <nav
      aria-label="Navigation mobile principale"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0A0A0A]/85 backdrop-blur-xl border-t border-white/10 shadow-2xl pb-[env(safe-area-inset-bottom)] transition-all"
    >
      <div className="w-full max-w-lg mx-auto h-[64px] flex items-center justify-around px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            activeTab === tab.id ||
            (tab.id === 'points_de_vente' && activeTab === 'physical_tickets') ||
            (tab.id === 'finances' && activeTab === 'cockpit');

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              aria-label={tab.label}
              className={`relative flex flex-col items-center justify-center py-1 px-2 min-w-0 flex-1 h-full transition-all cursor-pointer group ${
                isActive ? 'text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {/* Indicateur de sélection supérieur */}
              {isActive && (
                <span className="absolute top-0 w-8 h-1 rounded-full bg-gradient-to-r from-[#8A2BE2] to-[#E9C349] shadow-sm shadow-[#8A2BE2]/60 animate-in fade-in duration-200" />
              )}

              <div className="relative mt-1">
                <div
                  className={`p-1.5 rounded-xl transition-all ${
                    isActive
                      ? 'bg-gradient-to-br from-[#8A2BE2]/30 to-[#E9C349]/20 text-[#E9C349]'
                      : 'group-hover:bg-white/5 text-gray-400'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4]' : 'stroke-[1.8]'}`} />
                </div>

                {tab.badge !== undefined && (
                  <span
                    className={`absolute -top-1 -right-1 text-[9px] font-extrabold px-1 py-0.2 rounded-full min-w-[14px] text-center shadow-md ${
                      tab.badgeColor || 'bg-[#8A2BE2] text-white'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </div>

              <span
                className={`text-[10px] font-heading tracking-tight truncate max-w-full text-center mt-0.5 ${
                  isActive ? 'text-[#E9C349] font-bold' : 'text-gray-400 font-medium'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
