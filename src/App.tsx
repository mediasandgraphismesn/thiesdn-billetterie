import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { ShaderBackground } from './components/ShaderBackground';
import { EventDetailModal } from './components/EventDetailModal';
import { TicketPassModal } from './components/TicketPassModal';
import { Footer } from './components/Footer';
import { ShieldAlert, Eye, ArrowRight } from 'lucide-react';

import { HomeView } from './views/HomeView';
import { ExploreView } from './views/ExploreView';
import { CreateEventView } from './views/CreateEventView';
import { EventsManagementView } from './views/EventsManagementView';
import { ModerationView } from './views/ModerationView';
import { ProfileView } from './views/ProfileView';
import { AuthView } from './views/AuthView';
import { CheckInScannerView } from './views/CheckInScannerView';
import { TicketsWalletView } from './views/TicketsWalletView';
import { FinancesView } from './views/FinancesView';
import { AdminDashboard } from './views/AdminDashboard';
import { AdminSidebar } from './components/admin/AdminSidebar';
import { UsersManagementView } from './views/UsersManagementView';
import { PlatformSettingsView } from './views/PlatformSettingsView';
import { SalesAgentDashboardView } from './views/SalesAgentDashboardView';
import { ArtistDashboardView } from './views/ArtistDashboardView';
import { AccreditationsView } from './views/AccreditationsView';
import { ScanStationsView } from './views/ScanStationsView';
import { PublicScannerStationView } from './views/PublicScannerStationView';
import { ClaimTicketView } from './views/ClaimTicketView';
import { CGVView } from './views/CGVView';

import {
  INITIAL_USER,
  INITIAL_TICKETS,
  INITIAL_NOTIFICATIONS,
} from './data/mockEvents';
import { EventItem, UserProfile, UserTicket, NotificationItem } from './types';
import { useAuth } from './contexts/AuthContext';
import {
  getSupabaseClient,
  fetchUserProfile,
  signOutWithSupabase,
  fetchEventsFromSupabase,
  updateEventStatusInSupabase,
  fetchUserTicketsFromSupabase,
  fetchOrdersFromSupabase,
} from './services/supabase';

const getInitialScanCode = (): string | null => {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname;
  const hash = window.location.hash;
  const search = new URLSearchParams(window.location.search);

  const queryCode = search.get('scan') || search.get('station');
  if (queryCode) return queryCode.trim();

  const pathMatch = path.match(/\/scan\/([A-Za-z0-9_-]+)/i);
  if (pathMatch && pathMatch[1]) return pathMatch[1].trim();

  const hashMatch = hash.match(/#\/?scan\/([A-Za-z0-9_-]+)/i);
  if (hashMatch && hashMatch[1]) return hashMatch[1].trim();

  return null;
};

const getInitialClaimToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname;
  const hash = window.location.hash;
  const search = new URLSearchParams(window.location.search);

  const queryCode = search.get('claim') || search.get('token');
  if (queryCode) return queryCode.trim();

  const pathMatch = path.match(/\/claim-ticket\/([A-Za-z0-9_-]+)/i);
  if (pathMatch && pathMatch[1]) return pathMatch[1].trim();

  const hashMatch = hash.match(/#\/?claim-ticket\/([A-Za-z0-9_-]+)/i);
  if (hashMatch && hashMatch[1]) return hashMatch[1].trim();

  return null;
};

export default function App() {
  const {
    isAuthenticated: authIsAuthenticated,
    user: contextUser,
    userRole,
    effectiveRole: contextEffectiveRole,
    isAdminPreview,
    setIsAdminPreview,
    signOut: contextSignOut,
    isLoading: isAuthLoading,
  } = useAuth();

  const [scanStationCode, setScanStationCode] = useState<string | null>(getInitialScanCode());
  const [claimToken, setClaimToken] = useState<string | null>(getInitialClaimToken());
  const [isAuthenticated, setIsAuthenticated] = useState(authIsAuthenticated);
  const [user, setUser] = useState<UserProfile>(contextUser || INITIAL_USER);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<UserTicket[]>(INITIAL_TICKETS);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);

  const [activeTab, setActiveTab] = useState<string>('home');
  // Rôle de session réel provenant de Supabase Auth (synchronisé en temps réel avec le contexte)
  const [currentRole, setCurrentRole] = useState<'user' | 'promoter' | 'admin' | 'sales_agent' | 'artist'>(userRole);
  const [ambientShader, setAmbientShader] = useState<boolean>(true);
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);

  const [selectedEventForDetail, setSelectedEventForDetail] = useState<EventItem | null>(null);
  const [selectedTicketForPass, setSelectedTicketForPass] = useState<UserTicket | null>(null);

  // Rôle effectif dans l'interface (si l'admin active l'aperçu visiteur, il expérimente le site comme un client)
  const effectiveRole: 'user' | 'promoter' | 'admin' | 'sales_agent' | 'artist' = contextEffectiveRole || ((isAdminPreview && currentRole === 'admin') ? 'user' : currentRole);

  // Synchronisation continue de l'état local depuis le contexte Auth en temps réel
  useEffect(() => {
    setIsAuthenticated(authIsAuthenticated);
    if (contextUser) {
      setUser(contextUser);
    }
    setCurrentRole(userRole);
  }, [authIsAuthenticated, contextUser, userRole]);

  // Détection des routes URL (/admin, redirection de l'ancien /baobab, ou ?preview=client)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search;
      const path = window.location.pathname;
      const hash = window.location.hash;

      // 1. Redirection de l'ancien lien statique baobab vers la vraie plateforme
      if (path.includes('/baobab')) {
        if (path.includes('admin')) {
          window.history.replaceState(null, '', '/admin');
          setActiveTab('dashboard');
        } else {
          window.history.replaceState(null, '', '/');
          setActiveTab('home');
        }
        return;
      }

      // 2. Mode Aperçu Client
      if (search.includes('preview=client')) {
        setIsAdminPreview(true);
      }

      // 3. Route d'administration sécurisée /admin
      if (path === '/admin' || hash.includes('/admin')) {
        setActiveTab('dashboard');
      }

      // 4. Route publique de création d'événement /create-event (séparée de /admin)
      if (path === '/create-event' || hash.includes('/create-event') || search.includes('tab=create')) {
        setActiveTab('create');
      }

      // 5. Route CGV publique /cgv
      if (path === '/cgv' || hash.includes('/cgv') || search.includes('tab=cgv')) {
        setActiveTab('cgv');
      }

      // Écouter la navigation arrière/avant du navigateur
      const handlePopState = () => {
        const scanCode = getInitialScanCode();
        if (scanCode) {
          setScanStationCode(scanCode);
          return;
        } else {
          setScanStationCode(null);
        }

        if (window.location.pathname === '/admin') {
          setActiveTab('dashboard');
        } else if (window.location.pathname === '/create-event') {
          setActiveTab('create');
        } else if (window.location.pathname === '/cgv') {
          setActiveTab('cgv');
        } else if (window.location.pathname === '/') {
          setActiveTab('home');
        }
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, []);

  // Contrôle d'accès strict par rôle aux onglets (Route Guards)
  const isTabAllowedForRole = (tab: string, role: 'user' | 'promoter' | 'admin' | 'sales_agent' | 'artist', isAuth: boolean): boolean => {
    // Les Conditions Générales de Vente sont d'ordre public et consultables par tous
    if (tab === 'cgv') {
      return true;
    }

    // Si la route est de type admin et que le rôle effectif n'est pas admin : REFUS STRICT
    const adminOnlyTabs = ['dashboard', 'events_mgmt', 'moderation', 'orders', 'payments', 'users', 'checkin', 'settings', 'admin'];
    if (adminOnlyTabs.includes(tab) && role !== 'admin') {
      return false;
    }

    if (!isAuth) {
      return ['home', 'explore', 'cgv'].includes(tab);
    }
    if (role === 'admin') {
      return true; // Accès complet
    }
    if (role === 'promoter') {
      return ['home', 'explore', 'create', 'finances', 'artist', 'profile', 'accreditations', 'stations', 'cgv'].includes(tab);
    }
    if (role === 'artist') {
      return ['home', 'explore', 'create', 'artist', 'profile', 'accreditations', 'cgv'].includes(tab);
    }
    if (role === 'sales_agent') {
      return ['sales_agent', 'profile', 'cgv'].includes(tab);
    }
    if (role === 'user') {
      return ['home', 'explore', 'tickets', 'profile', 'cgv'].includes(tab);
    }
    return false;
  };

  const handleTabChange = (targetTab: string) => {
    // Si un admin sans aperçu visiteur clique sur home, le rediriger vers son dashboard back-office
    if (targetTab === 'home' && effectiveRole === 'admin') {
      setActiveTab('dashboard');
      if (typeof window !== 'undefined' && window.location.pathname !== '/admin') {
        window.history.pushState(null, '', '/admin');
      }
      return;
    }
    setActiveTab(targetTab);
    if (typeof window !== 'undefined') {
      if (targetTab === 'dashboard' && window.location.pathname !== '/admin') {
        window.history.pushState(null, '', '/admin');
      } else if (targetTab === 'create' && window.location.pathname !== '/create-event') {
        window.history.pushState(null, '', '/create-event');
      } else if (targetTab === 'cgv' && window.location.pathname !== '/cgv') {
        window.history.pushState(null, '', '/cgv');
      } else if (targetTab === 'home' && window.location.pathname !== '/') {
        window.history.pushState(null, '', '/');
      }
    }
  };

  // Chargement des événements réels depuis Supabase (Source Unique de Vérité)
  const refreshEvents = async () => {
    setIsLoadingEvents(true);
    setEventsError(null);
    const { events: dbEvents, error } = await fetchEventsFromSupabase();
    if (error) {
      setEventsError(error);
      setEvents([]);
    } else {
      setEvents(dbEvents);
    }
    setIsLoadingEvents(false);
  };

  useEffect(() => {
    refreshEvents();
    fetchOrdersFromSupabase().then(({ orders }) => {
      if (orders) {
        setPendingOrdersCount(
          orders.filter((o) => o.status === 'pending' || o.status === 'payment_signaled').length
        );
      }
    });
  }, []);

  // Détection et ouverture automatique d'un événement partagé par lien WhatsApp (?event=ID, ?id=ID ou /event/ID)
  useEffect(() => {
    if (typeof window === 'undefined' || events.length === 0) return;
    const searchParams = new URLSearchParams(window.location.search);
    let targetId = searchParams.get('event') || searchParams.get('id');

    if (!targetId) {
      const pathMatch = window.location.pathname.match(/\/event\/([a-zA-Z0-9_-]+)/i);
      if (pathMatch && pathMatch[1]) {
        targetId = pathMatch[1];
      }
    }

    if (targetId) {
      const matched = events.find((e) => e.id === targetId);
      if (matched) {
        setSelectedEventForDetail(matched);
      }
    }
  }, [events]);

  // Synchronisation avec la session Supabase Auth réelle
  useEffect(() => {
    const client = getSupabaseClient();
    if (client) {
      // 1. Récupérer la session active
      client.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          setIsAuthenticated(true);
          const isConfirmed = Boolean(session.user.email_confirmed_at || (session.user as any).confirmed_at);
          fetchUserProfile(session.user.id, session.user).then((profile) => {
            if (profile) {
              setUser({ ...profile, isEmailConfirmed: isConfirmed });
              setCurrentRole(profile.role);
              if (profile.role === 'admin' && !isAdminPreview) {
                setActiveTab('dashboard');
              } else if (profile.role === 'sales_agent') {
                setActiveTab('sales_agent');
              } else if (profile.role === 'artist') {
                setActiveTab('artist');
              }
            } else {
              const role = (session.user.user_metadata?.role as any) || 'user';
              setUser((prev) => ({
                ...prev,
                id: session.user.id,
                email: session.user.email || prev.email,
                name: session.user.user_metadata?.name || prev.name,
                role,
                isEmailConfirmed: isConfirmed,
              }));
              setCurrentRole(role);
              if (role === 'admin' && !isAdminPreview) {
                setActiveTab('dashboard');
              } else if (role === 'sales_agent') {
                setActiveTab('sales_agent');
              } else if (role === 'artist') {
                setActiveTab('artist');
              }
            }
          });
          // Charger les billets réels de l'utilisateur
          fetchUserTicketsFromSupabase(session.user.id).then(({ tickets: dbTickets }) => {
            setTickets(dbTickets);
          });
        }
      });

      // 2. Écouter les changements d'état d'authentification
      const { data: authListener } = client.auth.onAuthStateChange(
        async (event, session) => {
          if (session?.user) {
            setIsAuthenticated(true);
            const isConfirmed = Boolean(session.user.email_confirmed_at || (session.user as any).confirmed_at);
            const profile = await fetchUserProfile(session.user.id, session.user);
            if (profile) {
              setUser({ ...profile, isEmailConfirmed: isConfirmed });
              setCurrentRole(profile.role);
              if (profile.role === 'admin' && !isAdminPreview) {
                setActiveTab('dashboard');
              } else if (profile.role === 'sales_agent') {
                setActiveTab('sales_agent');
              } else if (profile.role === 'artist') {
                setActiveTab('artist');
              }
            } else {
              const role = (session.user.user_metadata?.role as any) || 'user';
              setUser((prev) => ({
                ...prev,
                id: session.user.id,
                email: session.user.email || prev.email,
                name: session.user.user_metadata?.name || prev.name,
                role,
                isEmailConfirmed: isConfirmed,
              }));
              setCurrentRole(role);
              if (role === 'admin' && !isAdminPreview) {
                setActiveTab('dashboard');
              } else if (role === 'sales_agent') {
                setActiveTab('sales_agent');
              } else if (role === 'artist') {
                setActiveTab('artist');
              }
            }
            fetchUserTicketsFromSupabase(session.user.id).then(({ tickets: dbTickets }) => {
              setTickets(dbTickets);
            });
          } else if (event === 'SIGNED_OUT') {
            setIsAuthenticated(false);
            setUser({ ...INITIAL_USER, role: 'user', isEmailConfirmed: false });
            setCurrentRole('user');
            setIsAdminPreview(false);
            setTickets([]);
            setActiveTab('home');
          }
        }
      );

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
  }, []);

  // Compteur des événements en attente de modération (uniquement pour l'admin)
  const pendingModerationCount = events.filter((e) => e.status === 'pending').length;

  const handleLoginSuccess = (role: 'user' | 'promoter' | 'admin' | 'sales_agent' | 'artist' = 'user') => {
    setIsAuthenticated(true);
    setCurrentRole(role);
    setUser((prev) => ({
      ...prev,
      role,
    }));
    if (role === 'admin') {
      setActiveTab('dashboard');
    } else if (role === 'sales_agent') {
      setActiveTab('sales_agent');
    } else if (role === 'artist') {
      setActiveTab('artist');
    } else {
      setActiveTab('home');
    }
  };

  const handleSignOut = async () => {
    await signOutWithSupabase();
    setIsAuthenticated(false);
    setUser({ ...INITIAL_USER, role: 'user' });
    setCurrentRole('user');
    setIsAdminPreview(false);
    setTickets([]);
  };

  const handleCreateEvent = (newEvent: EventItem) => {
    setEvents((prev) => [newEvent, ...prev]);

    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      title: 'Événement Soumis',
      message: `Votre événement "${newEvent.title}" (${newEvent.city}) est dans la file de modération.`,
      timestamp: 'À l’instant',
      read: false,
      type: 'moderation',
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const handleApproveEvent = async (eventId: string) => {
    setEvents((prev) =>
      prev.map((evt) =>
        evt.id === eventId ? { ...evt, status: 'approved' as const } : evt
      )
    );
    await updateEventStatusInSupabase(eventId, 'approved');

    const targetEvent = events.find((e) => e.id === eventId);
    if (targetEvent) {
      const newNotif: NotificationItem = {
        id: `notif-${Date.now()}`,
        title: 'Événement Approuvé',
        message: `L'événement "${targetEvent.title}" est maintenant en vente avec Wave & OM.`,
        timestamp: 'À l’instant',
        read: false,
        type: 'event',
      };
      setNotifications((prev) => [newNotif, ...prev]);
    }
  };

  const handleRejectEvent = async (eventId: string, reason?: string) => {
    setEvents((prev) =>
      prev.map((evt) =>
        evt.id === eventId ? { ...evt, status: 'rejected' as const } : evt
      )
    );
    await updateEventStatusInSupabase(eventId, 'rejected', reason);

    const targetEvent = events.find((e) => e.id === eventId);
    if (targetEvent) {
      const newNotif: NotificationItem = {
        id: `notif-${Date.now()}`,
        title: 'Événement Rejeté',
        message: `L'événement "${targetEvent.title}" a été refusé : ${reason || 'Non-conformité'}.`,
        timestamp: 'À l’instant',
        read: false,
        type: 'moderation',
      };
      setNotifications((prev) => [newNotif, ...prev]);
    }
  };

  const handlePurchaseSuccess = (ticket: UserTicket) => {
    setTickets((prev) => [ticket, ...prev]);
    setSelectedTicketForPass(ticket);

    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}`,
      title: 'Pass Mobile Money Confirmé',
      message: `Votre pass pour "${ticket.eventTitle}" (${ticket.tierName}) a été validé.`,
      timestamp: 'À l’instant',
      read: false,
      type: 'ticket',
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const handleValidateTicket = (ticketId: string) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status: 'used' as const } : t))
    );
  };

  const handleUpdateProfile = (updated: Partial<UserProfile>) => {
    setUser((prev) => ({ ...prev, ...updated }));
  };

  const handleMarkNotificationRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const handleClearNotifications = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const requiresAuth = [
    'dashboard',
    'events_mgmt',
    'moderation',
    'orders',
    'payments',
    'users',
    'checkin',
    'settings',
    'create',
    'finances',
    'sales_agent',
    'artist',
    'accreditations',
    'stations',
    'tickets',
    'profile',
  ].includes(activeTab);
  const isTabPermitted = isTabAllowedForRole(activeTab, effectiveRole, isAuthenticated);

  // Sécurité hermétique : si un code de poste de scan est présent dans l'URL (/scan/:code),
  // on affiche immédiatement l'interface de scan mobile autonome (sans header, sans sidebar ni accès admin)
  if (scanStationCode) {
    return <PublicScannerStationView accessCode={scanStationCode} />;
  }

  // Écran autonome de réclamation de billet offert (/claim-ticket/:token)
  if (claimToken) {
    return (
      <ClaimTicketView
        claimToken={claimToken}
        currentUser={isAuthenticated ? user : null}
        onClaimSuccess={(claimedTicket) => {
          setTickets((prev) => [claimedTicket, ...prev.filter((t) => t.id !== claimedTicket.id)]);
          setClaimToken(null);
          setActiveTab('tickets');
          if (typeof window !== 'undefined') {
            window.history.pushState({}, '', '/');
          }
        }}
        onNavigateHome={() => {
          setClaimToken(null);
          setActiveTab('home');
          if (typeof window !== 'undefined') {
            window.history.pushState({}, '', '/');
          }
        }}
      />
    );
  }

  // TÂCHE 2 : État de chargement auth avant d'appliquer les redirections ou blocages (évite de vider ou rediriger /create-event)
  if (isAuthLoading && (activeTab === 'create' || activeTab === 'dashboard' || (typeof window !== 'undefined' && window.location.pathname === '/create-event'))) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[#8A2BE2]/20 border border-[#8A2BE2]/40 flex items-center justify-center animate-pulse">
          <span className="w-6 h-6 border-2 border-[#E9C349] border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="font-heading text-sm font-bold text-white tracking-wide">
          Chargement de votre session...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-[#E5E2E1] flex flex-col relative font-sans">
      {/* African pattern overlay */}
      <div className="bg-pattern" />

      {/* WebGL Ambient Neon Fluid Background Shader */}
      {ambientShader && <ShaderBackground intensity={0.55} />}

      {/* Main App Layout */}
      <div className="flex-1 flex flex-col relative z-10">
        {/* Top Header Bar */}
        <Header
          user={{ ...user, role: effectiveRole }}
          notifications={notifications}
          onMarkNotificationRead={handleMarkNotificationRead}
          onClearNotifications={handleClearNotifications}
          currentRole={effectiveRole}
          isAuthenticated={isAuthenticated}
          onOpenAuth={() => setActiveTab('profile')}
          ambientShader={ambientShader}
          onToggleShader={() => setAmbientShader(!ambientShader)}
          onOpenCreateModal={() => handleTabChange('create')}
          pendingModerationCount={pendingModerationCount}
          onNavigate={(tab) => handleTabChange(tab)}
          isAdminPreview={isAdminPreview}
        />

        {/* Bannière Mode Aperçu Visiteur pour l'Administrateur */}
        {isAdminPreview && (
          <div className="bg-[#E9C349] text-[#241A00] px-4 py-2 text-xs font-bold flex items-center justify-between sticky top-16 z-40 shadow-lg">
            <span className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              <span>Mode Aperçu Visiteur Actif — Vous expérimentez l'interface comme un client standard (Thiès & Petite Côte)</span>
            </span>
            <button
              onClick={() => setIsAdminPreview(false)}
              className="bg-[#241A00] text-[#E9C349] hover:bg-black px-3 py-1 rounded-lg text-[11px] font-extrabold transition-colors shadow-sm"
            >
              Quitter l'Aperçu
            </button>
          </div>
        )}

        {/* Sidebar on Desktop / Tablet : VISIBLE UNIQUEMENT POUR UTILISATEURS CONNECTÉS */}
        {isAuthenticated && (
          effectiveRole === 'admin' ? (
            <AdminSidebar
              user={{ ...user, role: 'admin' }}
              activeTab={activeTab}
              onTabChange={handleTabChange}
              pendingModerationCount={pendingModerationCount}
              pendingOrdersCount={pendingOrdersCount}
              totalEventsCount={events.length}
              onToggleAdminPreview={currentRole === 'admin' ? () => setIsAdminPreview(!isAdminPreview) : undefined}
              isAdminPreview={isAdminPreview}
            />
          ) : (
            <Sidebar
              user={{ ...user, role: effectiveRole }}
              activeTab={activeTab}
              onTabChange={handleTabChange}
              onOpenCreateModal={() => handleTabChange('create')}
              pendingModerationCount={pendingModerationCount}
              pendingOrdersCount={pendingOrdersCount}
              totalEventsCount={events.filter((e) => e.status === 'approved').length}
              onToggleAdminPreview={currentRole === 'admin' ? () => setIsAdminPreview(!isAdminPreview) : undefined}
              isAdminPreview={isAdminPreview}
            />
          )
        )}

        {/* Dynamic Main View Canvas : Marges adaptées (Plein écran pour visiteurs, décalé pour clients connectés) */}
        <main className={`flex-grow flex flex-col pt-24 pb-6 w-full mx-auto relative z-10 transition-all ${
          isAuthenticated 
            ? 'px-4 sm:px-6 lg:pl-80 lg:pr-10 max-w-7xl' 
            : 'px-4 sm:px-8 lg:px-12 max-w-6xl'
        }`}>
          {eventsError && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-950/80 border border-rose-500/40 text-rose-200 flex items-center justify-between">
              <span className="text-xs">⚠️ Erreur de connexion Supabase : {eventsError}</span>
              <button
                onClick={refreshEvents}
                className="text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 px-3 py-1 rounded-lg border border-rose-500/30 text-white"
              >
                Réessayer
              </button>
            </div>
          )}

          {/* Condition 1 : Requiert une connexion et visiteur non connecté */}
          {requiresAuth && !isAuthenticated ? (
            <div className="max-w-md mx-auto py-8">
              <div className="text-center mb-6">
                <span className="text-xs text-[#E9C349] font-bold uppercase tracking-wider">
                  {['dashboard', 'moderation', 'orders', 'users', 'settings'].includes(activeTab)
                    ? 'Console Super Admin'
                    : 'Accès Sécurisé'}
                </span>
                <h2 className="text-xl font-bold text-white mt-1">
                  {['dashboard', 'moderation', 'orders', 'users', 'settings'].includes(activeTab)
                    ? 'Connexion Super Admin Requise'
                    : 'Connexion Requise'}
                </h2>
                <p className="text-xs text-gray-400 mt-1">
                  {['dashboard', 'moderation', 'orders', 'users', 'settings'].includes(activeTab)
                    ? 'Veuillez vous authentifier avec votre compte administrateur Supabase pour ouvrir la console.'
                    : 'Veuillez vous authentifier pour accéder à cet espace.'}
                </p>
              </div>
              <AuthView onLoginSuccess={handleLoginSuccess} />
            </div>
          ) : /* Condition 2 : Authentifié mais rôle insuffisant (Route Guard Bloquant) */
          isAuthenticated && !isTabPermitted ? (
            <div className="max-w-md mx-auto py-16 text-center space-y-4 glass-panel p-8 rounded-3xl border border-rose-500/30 animate-in fade-in">
              <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/40">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-heading text-lg font-bold text-white">
                  {activeTab === 'create'
                    ? 'Accès Réservé aux Promoteurs & Artistes'
                    : 'Accès Restreint — Espace Administration'}
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  {activeTab === 'create'
                    ? 'La création d’événements est réservée aux comptes Promoteur et Artiste certifiés. Votre compte est actuellement configuré comme compte client.'
                    : 'Cette section est strictement réservée aux Super Administrateurs de Thièsdn Billetterie. Votre compte est actuellement configuré comme compte client.'}
                </p>
              </div>
              <button
                onClick={() => {
                  window.history.replaceState(null, '', '/');
                  setActiveTab('home');
                }}
                className="btn-primary-glow py-2.5 px-6 rounded-xl text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2"
              >
                <span>Retour à la Billetterie Publique</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* Condition 3 : Vue autorisée pour le rôle actuel */
            <>
              {/* TABLEAU DE BORD SUPER ADMIN DÉDIÉ (Par défaut à la connexion admin) */}
              {(activeTab === 'dashboard' || (activeTab === 'home' && effectiveRole === 'admin')) && effectiveRole === 'admin' && (
                <AdminDashboard
                  events={events}
                  tickets={tickets}
                  onNavigateTab={handleTabChange}
                  onApproveEvent={handleApproveEvent}
                  onRejectEvent={handleRejectEvent}
                  onPreviewEvent={(evt) => setSelectedEventForDetail(evt)}
                  onTicketsCreated={(newTickets) => {
                    setTickets((prev) => [...newTickets, ...prev]);
                    const notif: NotificationItem = {
                      id: `notif-${Date.now()}`,
                      title: 'Billets Émis (Paiement Confirmé)',
                      message: `${newTickets.length} billet(s) avec QR Code ont été émis et ajoutés au portefeuille.`,
                      timestamp: 'À l’instant',
                      read: false,
                      type: 'ticket',
                    };
                    setNotifications((prev) => [notif, ...prev]);
                  }}
                  onOpenVisitorPreview={() => {
                    setIsAdminPreview(true);
                    if (typeof window !== 'undefined') {
                      window.open('/?preview=client', '_blank');
                    }
                  }}
                />
              )}

              {/* VUE ACCUEIL CLIENT / PROMOTEUR (Strictement pour les non-admins ou en mode aperçu) */}
              {activeTab === 'home' && effectiveRole !== 'admin' && (
                <HomeView
                  events={events}
                  onSelectEvent={(evt) => setSelectedEventForDetail(evt)}
                  onNavigateToExplore={() => handleTabChange('explore')}
                  onNavigateToCreate={() => handleTabChange('create')}
                />
              )}

              {/* VUE EXPLORER LA CARTE (Uniquement pour Clients et Promoteurs) */}
              {activeTab === 'explore' && effectiveRole !== 'admin' && (
                <ExploreView
                  events={events}
                  onSelectEvent={(evt) => setSelectedEventForDetail(evt)}
                />
              )}

              {activeTab === 'create' && (effectiveRole === 'promoter' || effectiveRole === 'artist' || effectiveRole === 'admin') && (
                <CreateEventView
                  onEventCreated={handleCreateEvent}
                  onBack={() => handleTabChange(effectiveRole === 'admin' ? 'dashboard' : 'home')}
                  promoterName={user.name}
                  promoterAvatar={user.avatar}
                  isEmailConfirmed={Boolean(user.isEmailConfirmed)}
                  currentUser={user}
                  onAcceptTerms={(updatedUser) => setUser(updatedUser)}
                />
              )}

              {/* GESTION COMPLÈTE DES ÉVÉNEMENTS (ADMIN) */}
              {activeTab === 'events_mgmt' && effectiveRole === 'admin' && (
                <EventsManagementView
                  events={events}
                  onRefreshEvents={refreshEvents}
                  onNavigateCreate={() => handleTabChange('create')}
                  onPreviewEvent={(evt) => setSelectedEventForDetail(evt)}
                />
              )}

              {/* MODÉRATION DES ÉVÉNEMENTS */}
              {activeTab === 'moderation' && effectiveRole === 'admin' && (
                <ModerationView
                  events={events}
                  onApproveEvent={handleApproveEvent}
                  onRejectEvent={handleRejectEvent}
                  onPreviewEvent={(evt) => setSelectedEventForDetail(evt)}
                  initialTab="events"
                  onNavigateTab={handleTabChange}
                  onTicketsCreated={(newTickets) => {
                    setTickets((prev) => [...newTickets, ...prev]);
                    const notif: NotificationItem = {
                      id: `notif-${Date.now()}`,
                      title: 'Billets Émis (Paiement Confirmé)',
                      message: `${newTickets.length} billet(s) avec QR Code ont été émis et ajoutés au portefeuille.`,
                      timestamp: 'À l’instant',
                      read: false,
                      type: 'ticket',
                    };
                    setNotifications((prev) => [notif, ...prev]);
                  }}
                />
              )}

              {/* VALIDATION DES PAIEMENTS WAVE / ORANGE MONEY */}
              {(activeTab === 'orders' || activeTab === 'payments') && effectiveRole === 'admin' && (
                <ModerationView
                  events={events}
                  onApproveEvent={handleApproveEvent}
                  onRejectEvent={handleRejectEvent}
                  onPreviewEvent={(evt) => setSelectedEventForDetail(evt)}
                  initialTab="orders"
                  onTicketsCreated={(newTickets) => {
                    setTickets((prev) => [...newTickets, ...prev]);
                    const notif: NotificationItem = {
                      id: `notif-${Date.now()}`,
                      title: 'Billets Émis (Paiement Confirmé)',
                      message: `${newTickets.length} billet(s) avec QR Code ont été émis et ajoutés au portefeuille.`,
                      timestamp: 'À l’instant',
                      read: false,
                      type: 'ticket',
                    };
                    setNotifications((prev) => [notif, ...prev]);
                  }}
                />
              )}

              {/* GESTION DES UTILISATEURS */}
              {activeTab === 'users' && effectiveRole === 'admin' && (
                <UsersManagementView
                  onBackToDashboard={() => handleTabChange('dashboard')}
                />
              )}

              {/* PARAMÈTRES DE LA PLATEFORME */}
              {activeTab === 'settings' && effectiveRole === 'admin' && (
                <PlatformSettingsView
                  onBackToDashboard={() => handleTabChange('dashboard')}
                />
              )}

              {activeTab === 'checkin' && effectiveRole === 'admin' && (
                <CheckInScannerView
                  tickets={tickets}
                  onValidateTicket={handleValidateTicket}
                />
              )}

              {activeTab === 'finances' && (effectiveRole === 'promoter' || effectiveRole === 'admin') && (
                <FinancesView
                  currentRole={effectiveRole}
                  events={events}
                  promoterName={user.name}
                />
              )}

              {/* ESPACE COLLABORATEUR / POINT DE VENTE MOBILE */}
              {(activeTab === 'sales_agent' || (effectiveRole === 'sales_agent' && activeTab === 'home')) && (
                <SalesAgentDashboardView
                  user={user}
                  onNavigateBack={() => handleTabChange('profile')}
                />
              )}

              {/* ESPACE CO-PRODUCTION & DROITS ARTISTE / STAFF */}
              {(activeTab === 'artist' || (effectiveRole === 'artist' && activeTab === 'home')) && (
                <ArtistDashboardView
                  user={user}
                  events={events}
                  onNavigateBack={() => handleTabChange('profile')}
                />
              )}

              {/* MODULE D'ACCRÉDITATIONS (STAFF, INVITÉS & PRESSE) */}
              {activeTab === 'accreditations' && (effectiveRole === 'promoter' || effectiveRole === 'admin' || effectiveRole === 'artist') && (
                <AccreditationsView
                  currentRole={effectiveRole}
                  userProfile={user}
                  events={events}
                  onBack={() => handleTabChange('home')}
                />
              )}

              {/* MULTI-POSTES DE CONTRÔLE (SCANNERS SÉCURISÉS SANS LOGIN) */}
              {activeTab === 'stations' && (effectiveRole === 'promoter' || effectiveRole === 'admin') && (
                <ScanStationsView
                  events={events}
                  promoterId={user.id}
                  promoterName={user.name}
                />
              )}

              {activeTab === 'tickets' && (
                <TicketsWalletView
                  tickets={tickets}
                  userName={user.name}
                  onOpenPass={(tkt) => setSelectedTicketForPass(tkt)}
                  onExploreEvents={() => handleTabChange('home')}
                  onTicketUpdated={(tkt) => {
                    setTickets((prev) => prev.map((t) => (t.id === tkt.id ? tkt : t)));
                  }}
                />
              )}

              {activeTab === 'profile' && (
                <ProfileView
                  user={{ ...user, role: effectiveRole }}
                  tickets={tickets}
                  onUpdateProfile={handleUpdateProfile}
                  onOpenTicketPass={(tkt) => setSelectedTicketForPass(tkt)}
                  onSignOut={handleSignOut}
                />
              )}

              {/* CONTRAT OFFICIEL CGV - DROIT SÉNÉGALAIS */}
              {activeTab === 'cgv' && (
                <CGVView
                  user={isAuthenticated ? user : undefined}
                  onAcceptSuccess={(updatedUser) => setUser(updatedUser)}
                  onBack={() => handleTabChange(effectiveRole === 'admin' ? 'dashboard' : 'home')}
                />
              )}
            </>
          )}

          {/* Pied de page Officiel (Footer) complet et responsive */}
          <Footer
            onNavigateAdmin={() => handleTabChange('dashboard')}
            onNavigateCGV={() => handleTabChange('cgv')}
          />
        </main>
      </div>

      {/* Floating Bottom Nav for Mobile Screens */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        pendingCount={pendingModerationCount}
        ticketsCount={tickets.length}
        userRole={effectiveRole}
        isAuthenticated={isAuthenticated}
        isAdminPreview={isAdminPreview}
      />

      {/* Event Details & VIP Booking Modal */}
      <EventDetailModal
        event={selectedEventForDetail}
        isOpen={selectedEventForDetail !== null}
        onClose={() => setSelectedEventForDetail(null)}
        onOrderCreated={(order) => {
          const newNotif: NotificationItem = {
            id: `notif-${Date.now()}`,
            title: 'Commande Créée (Wave/OM)',
            message: `Votre commande ${order.reference} (${order.totalAmount.toLocaleString('fr-FR')} FCFA) a été enregistrée. Effectuez le transfert pour recevoir vos billets.`,
            timestamp: 'À l’instant',
            read: false,
            type: 'ticket',
          };
          setNotifications((prev) => [newNotif, ...prev]);
        }}
        onPurchaseSuccess={handlePurchaseSuccess}
        userName={user.name}
        isEmailConfirmed={Boolean(user.isEmailConfirmed)}
        isAuthenticated={isAuthenticated}
        onRequireAuth={() => {
          setSelectedEventForDetail(null);
          setActiveTab('profile');
        }}
      />

      {/* Digital Ticket Pass Modal */}
      <TicketPassModal
        ticket={selectedTicketForPass}
        isOpen={selectedTicketForPass !== null}
        onClose={() => setSelectedTicketForPass(null)}
      />
    </div>
  );
}
