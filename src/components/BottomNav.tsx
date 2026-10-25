import React from 'react';
import { Home, Compass, Ticket, ShieldCheck, User, Wallet, PlusCircle, QrCode, BarChart3, Store, Award } from 'lucide-react';

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
        { id: 'dashboard', label: 'Dashboard', icon: Home },
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

    // 3. Promoteur
    if (userRole === 'promoter') {
      return [
        { id: 'home', label: 'Événements', icon: Home },
        { id: 'explore', label: 'Explorer', icon: Compass },
        { id: 'create', label: 'Créer', icon: PlusCircle },
        { id: 'finances', label: 'Cockpit', icon: BarChart3 },
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
    <nav className="lg:hidden fixed bottom-3 left-3 right-3 h-16 max-w-lg mx-auto z-50 flex items-center justify-around px-2 bg-[#1C1B1B]/95 backdrop-blur-2xl rounded-full border border-white/10 shadow-2xl shadow-[#8A2BE2]/20">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            aria-label={tab.label}
            className={`relative flex flex-col items-center justify-center transition-all min-h-[44px] min-w-[44px] py-1 px-3 rounded-full ${
              isActive
                ? 'bg-[#8A2BE2] text-white shadow-lg shadow-[#8A2BE2]/40 scale-105'
                : 'text-[#CFC2D7] hover:text-white opacity-80'
            }`}
          >
            <div className="relative">
              <Icon className={`w-4 h-4 ${isActive ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
              {tab.badge !== undefined && (
                <span
                  className={`absolute -top-1.5 -right-2 text-[9px] font-extrabold px-1 py-0.1 rounded-full min-w-[14px] text-center ${
                    tab.badgeColor || 'bg-[#8A2BE2] text-white'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </div>
            <span
              className={`text-[9px] font-semibold mt-0.5 tracking-tight ${
                isActive ? 'text-white' : 'text-[#CFC2D7]'
              }`}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
