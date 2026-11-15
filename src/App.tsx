import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import { ShaderBackground } from './components/ShaderBackground';
import { EventDetailModal } from './components/EventDetailModal';
import { TicketDetailModal } from './components/TicketDetailModal';
import { Footer } from './components/Footer';
import { PWAInstallPrompt } from './components/PWAInstallPrompt';
import { ShieldAlert, Eye, ArrowRight, X } from 'lucide-react';

import { HomeView } from './views/HomeView';
import { AdminSidebar } from './components/admin/AdminSidebar';
import { AdminNotificationCenter } from './components/admin/AdminNotificationCenter';
import {
  fetchUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  playNotificationChime,
} from './services/userNotificationService';
import LoadingIntro from './components/LoadingIntro';

// Optimisation React 19 : Code Splitting intégral pour affichage instantané mobile
const ExploreView = React.lazy(() => import('./views/ExploreView').then((m) => ({ default: m.ExploreView })));
const CreateEventView = React.lazy(() => import('./views/CreateEventView').then((m) => ({ default: m.CreateEventView })));
const ProfileView = React.lazy(() => import('./views/ProfileView').then((m) => ({ default: m.ProfileView })));
const AuthView = React.lazy(() => import('./views/AuthView').then((m) => ({ default: m.AuthView })));
const TicketsWalletView = React.lazy(() => import('./views/TicketsWalletView').then((m) => ({ default: m.TicketsWalletView })));
const SalesAgentDashboardView = React.lazy(() => import('./views/SalesAgentDashboardView').then((m) => ({ default: m.SalesAgentDashboardView })));
const PosAuthView = React.lazy(() => import('./views/PosAuthView').then((m) => ({ default: m.PosAuthView })));
const ArtistDashboardView = React.lazy(() => import('./views/ArtistDashboardView').then((m) => ({ default: m.ArtistDashboardView })));
const PublicScannerStationView = React.lazy(() => import('./views/PublicScannerStationView').then((m) => ({ default: m.PublicScannerStationView })));
const ClaimTicketView = React.lazy(() => import('./views/ClaimTicketView').then((m) => ({ default: m.ClaimTicketView })));
const CGVView = React.lazy(() => import('./views/CGVView').then((m) => ({ default: m.CGVView })));
const LoginHistoryView = React.lazy(() => import('./views/LoginHistoryView').then((m) => ({ default: m.LoginHistoryView })));
const VigileSessionsView = React.lazy(() => import('./views/VigileSessionsView').then((m) => ({ default: m.VigileSessionsView })));
const FinancesView = React.lazy(() => import('./views/FinancesView').then((m) => ({ default: m.FinancesView })));
const EventsManagementView = React.lazy(() => import('./views/EventsManagementView').then((m) => ({ default: m.EventsManagementView })));
const ModerationView = React.lazy(() => import('./views/ModerationView').then((m) => ({ default: m.ModerationView })));
const AdminDashboard = React.lazy(() => import('./views/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const AccreditationsView = React.lazy(() => import('./views/AccreditationsView').then((m) => ({ default: m.AccreditationsView })));
const ScanStationsView = React.lazy(() => import('./views/ScanStationsView').then((m) => ({ default: m.ScanStationsView })));
const CheckInScannerView = React.lazy(() => import('./views/CheckInScannerView').then((m) => ({ default: m.CheckInScannerView })));
const UsersManagementView = React.lazy(() => import('./views/UsersManagementView').then((m) => ({ default: m.UsersManagementView })));
const PlatformSettingsView = React.lazy(() => import('./views/PlatformSettingsView').then((m) => ({ default: m.PlatformSettingsView })));

const ViewSkeletonLoader: React.FC = () => (
  <div className="w-full max-w-6xl mx-auto py-8 px-4 space-y-6 animate-pulse">
    <div className="h-8 w-48 bg-white/5 rounded-2xl border border-white/5" />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-28 bg-white/5 rounded-2xl border border-white/5" />
      ))}
    </div>
    <div className="h-64 bg-white/5 rounded-3xl border border-white/5" />
  </div>
);
const LandingShowcaseView = React.lazy(() => import('./views/LandingShowcaseView'));

import {
  INITIAL_USER,
  INITIAL_TICKETS,
  INITIAL_NOTIFICATIONS,
} from './data/mockEvents';
import { EventItem, UserProfile, UserTicket, NotificationItem } from './types';
import {
  useAuth,
  isPosAccountIdentity,
  resolveEffectiveUserRole,
  type UserRole,
} from './contexts/AuthContext';
import {
  getSupabaseClient,
  fetchUserProfile,
  fetchLinkedSalesAgentForUser,
  fetchEventsFromSupabase,
  updateEventStatusInSupabase,
  fetchUserTicketsFromSupabase,
  fetchOrdersFromSupabase,
  fetchOrderTicketsByToken,
  fetchTicketByPublicId,
} from './services/supabase';
import { loadPosAgentSnapshot } from './services/posOfflineCache';

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

const getInitialIsPosRoute = (): boolean => {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  const search = new URLSearchParams(window.location.search);

  return (
    path === '/pos' ||
    path === '/vendeur' ||
    path.startsWith('/pos/') ||
    path.startsWith('/vendeur/') ||
    hash === '#pos' ||
    hash === '#vendeur' ||
    hash.startsWith('#/pos') ||
    hash.startsWith('#/vendeur') ||
    search.get('tab') === 'pos' ||
    search.get('tab') === 'vendeur' ||
    search.get('pos') === 'true'
  );
};

const isStrictPosUrl = (): boolean => {
  if (typeof window === 'undefined') return false;
  return (
    window.location.pathname === '/pos' &&
    !window.location.search &&
    !window.location.hash
  );
};

const getInitialTicketId = (): string | null => {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname;
  const hash = window.location.hash;
  const search = new URLSearchParams(window.location.search);

  const queryCode = search.get('ticket') || search.get('t');
  if (queryCode) return queryCode.trim();

  const pathMatch = path.match(/\/ticket\/([A-Za-z0-9_-]+)/i) || path.match(/\/t\/([A-Za-z0-9_-]+)/i);
  if (pathMatch && pathMatch[1]) return pathMatch[1].trim();

  const hashMatch = hash.match(/#\/?ticket\/([A-Za-z0-9_-]+)/i) || hash.match(/#\/?t\/([A-Za-z0-9_-]+)/i);
  if (hashMatch && hashMatch[1]) return hashMatch[1].trim();

  return null;
};

const getInitialClaimToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname;
  const hash = window.location.hash;
  const search = new URLSearchParams(window.location.search);

  const queryCode = search.get('claim') || (!search.get('order') ? search.get('token') : null);
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
    isPosAccount: contextIsPosAccount,
    isAdminPreview,
    setIsAdminPreview,
    signOut: contextSignOut,
    isLoading: isAuthLoading,
  } = useAuth();

  const [scanStationCode, setScanStationCode] = useState<string | null>(getInitialScanCode());
  const [claimToken, setClaimToken] = useState<string | null>(getInitialClaimToken());
  const [directTicketId, setDirectTicketId] = useState<string | null>(getInitialTicketId());
  const [isPosRoute, setIsPosRoute] = useState<boolean>(getInitialIsPosRoute());
  const [posLinkedAgentId, setPosLinkedAgentId] = useState<string | null>(null);
  const [isCheckingPosAccess, setIsCheckingPosAccess] = useState<boolean>(() => getInitialIsPosRoute());
  const [isAuthenticated, setIsAuthenticated] = useState(authIsAuthenticated);
  const [user, setUser] = useState<UserProfile>(contextUser || INITIAL_USER);
  const [events, setEvents] = useState<EventItem[]>([]);

  // Liste sécurisée garantie non-nulle
  const safeEvents = useMemo(() => (Array.isArray(events) ? events.filter(Boolean) : []), [events]);

  // Catalogue public sécurisé : Condition stricte (status = 'approved' AND deleted_at IS NULL AND is_deleted = false)
  // Les événements archivés disparaissent ainsi immédiatement de l'accueil et du tunnel d'achat
  const publicEvents = useMemo(() => {
    return safeEvents.filter((e) => {
      if (!e || typeof e !== 'object') return false;
      const status = String(e.status || '').toLowerCase();
      const isArchived = status === 'archived' || Boolean(e.isDeleted) || Boolean(e.deletedAt);
      return status === 'approved' && !isArchived;
    });
  }, [safeEvents]);

  // Événements organisés exclusivement par le promoteur / artiste connecté
  const myEvents = useMemo(() => {
    if (!user?.id && !user?.name) return [];
    return safeEvents.filter((e) => {
      if (e.isDeleted) return false;
      const matchId = user.id && e.promoter?.id && String(e.promoter.id).toLowerCase() === String(user.id).toLowerCase();
      const matchName = user.name && e.promoter?.name && e.promoter.name.trim().toLowerCase() === user.name.trim().toLowerCase();
      const matchEmail = user.email && e.promoter?.name && e.promoter.name.trim().toLowerCase() === user.email.trim().toLowerCase();
      return Boolean(matchId || matchName || matchEmail);
    });
  }, [safeEvents, user?.id, user?.name, user?.email]);

  const myEventsCount = myEvents.length;
  const [isLoadingEvents, setIsLoadingEvents] = useState<boolean>(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [paymentBannerMessage, setPaymentBannerMessage] = useState<string | null>(null);
  const [tickets, setTickets] = useState<UserTicket[]>(INITIAL_TICKETS);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [userAlertToast, setUserAlertToast] = useState<{ id: string; title: string; body: string; url?: string } | null>(null);

  const [activeTab, setActiveTab] = useState<string>('home');
  const [orderFilter, setOrderFilter] = useState<string | null>(null);
  const [hasGuestOrderToken, setHasGuestOrderToken] = useState<boolean>(false);
  // Rôle de session réel provenant de Supabase Auth (synchronisé en temps réel avec le contexte)
  const [currentRole, setCurrentRole] = useState<'user' | 'promoter' | 'admin' | 'sales_agent' | 'artist'>(userRole);
  const [ambientShader, setAmbientShader] = useState<boolean>(true);
  const [pendingOrdersCount, setPendingOrdersCount] = useState<number>(0);
  const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState<boolean>(false);

  const [selectedEventForDetail, setSelectedEventForDetail] = useState<EventItem | null>(null);
  const [selectedTicketForPass, setSelectedTicketForPass] = useState<UserTicket | null>(null);

  // Rôle effectif dans l'interface (verrouillage POS prioritaire, puis aperçu visiteur admin)
  const baseRole: UserRole =
    isAdminPreview && (userRole === 'admin' || currentRole === 'admin')
      ? 'user'
      : currentRole !== 'user'
        ? currentRole
        : contextEffectiveRole;
  const effectiveRole: UserRole = isPosAccountIdentity(
    contextUser?.email || user?.email,
    baseRole
  )
    ? 'sales_agent'
    : baseRole;

  const isPosAccount = useMemo(
    () =>
      isAuthenticated &&
      (contextIsPosAccount ||
        isPosAccountIdentity(contextUser?.email || user?.email, effectiveRole || userRole || currentRole)),
    [isAuthenticated, contextIsPosAccount, contextUser?.email, user?.email, effectiveRole, userRole, currentRole]
  );

  const isPosAccountRef = useRef<boolean>(isPosAccount);
  useEffect(() => {
    isPosAccountRef.current = isPosAccount;
  }, [isPosAccount]);

  // Synchronisation continue de l'état local depuis le contexte Auth en temps réel
  useEffect(() => {
    setIsAuthenticated(authIsAuthenticated);
    if (contextUser) {
      setUser(contextUser);
    }
    const nextRole = resolveEffectiveUserRole(userRole, contextUser?.email);
    setCurrentRole(nextRole);
  }, [authIsAuthenticated, contextUser, userRole]);

  // GUARD GLOBAL POS : Tout compte vendeur (sales_agent ou *@pos.thiesdn.site)
  // est strictement confiné à /pos (redirection forcée sans historique arrière)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isAuthenticated && isPosAccount && !isStrictPosUrl()) {
      window.location.replace('/pos');
    }
  }, [isAuthLoading, isAuthenticated, isPosAccount]);

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

      // 2.5 Route dédiée Point de Vente /pos ou /vendeur
      if (getInitialIsPosRoute()) {
        setIsPosRoute(true);
        if (effectiveRole === 'sales_agent' || effectiveRole === 'admin') {
          setActiveTab('sales_agent');
        }
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

      // 6. Routes Publiques Showcase Motion Design (/showcase, /presentation)
      if (path === '/showcase' || path === '/presentation' || hash.includes('/showcase') || hash.includes('/presentation') || search.includes('tab=showcase')) {
        setActiveTab('showcase');
      }

      // 7. Routes Authentification, Inscription & Profil
      if (
        path === '/inscription' ||
        path === '/auth' ||
        path === '/login' ||
        path === '/register' ||
        path === '/profil' ||
        path === '/profile' ||
        hash.includes('/auth') ||
        hash.includes('/login') ||
        search.includes('tab=auth')
      ) {
        setActiveTab('profile');
      }

      // 8. Retour de paiement Wave ?payment=success ou ?payment=error
      const urlParams = new URLSearchParams(search);
      const orderRef = urlParams.get('order') || urlParams.get('ref');
      const orderToken = urlParams.get('token');
      if (orderRef) {
        setActiveTab('tickets');
        setOrderFilter(orderRef.trim());
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        if (orderToken) {
          setHasGuestOrderToken(true);
          fetchOrderTicketsByToken(orderRef.trim(), orderToken.trim()).then((res) => {
            if (res.success && res.tickets.length > 0) {
              setTickets(res.tickets);
              setSelectedTicketForPass(res.tickets[0]);
            }
          });
        }
      }
      if (urlParams.get('payment') === 'success') {
        setPaymentBannerMessage('Paiement Wave initié ! Votre pass est en cours de validation.');
        setActiveTab('tickets');
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        urlParams.delete('payment');
        const newSearch = urlParams.toString() ? `?${urlParams.toString()}` : '';
        window.history.replaceState(null, '', `${window.location.pathname}${newSearch}`);
      } else if (urlParams.get('payment') === 'error') {
        setPaymentBannerMessage('Le paiement Wave a été interrompu ou n’a pas abouti.');
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        urlParams.delete('payment');
        const newSearch = urlParams.toString() ? `?${urlParams.toString()}` : '';
        window.history.replaceState(null, '', `${window.location.pathname}${newSearch}`);
      }

      // Écouter la navigation arrière/avant du navigateur
      const handlePopState = () => {
        if (isPosAccountRef.current && !isStrictPosUrl()) {
          window.location.replace('/pos');
          return;
        }

        const scanCode = getInitialScanCode();
        if (scanCode) {
          setScanStationCode(scanCode);
          return;
        } else {
          setScanStationCode(null);
        }

        if (getInitialIsPosRoute()) {
          setIsPosRoute(true);
          return;
        }
        setIsPosRoute(false);
        setPosLinkedAgentId(null);

        const currentPath = window.location.pathname;
        if (currentPath === '/admin') {
          setActiveTab('dashboard');
        } else if (currentPath === '/create-event') {
          setActiveTab('create');
        } else if (currentPath === '/cgv') {
          setActiveTab('cgv');
        } else if (currentPath === '/showcase' || currentPath === '/presentation') {
          setActiveTab('showcase');
        } else if (
          currentPath === '/inscription' ||
          currentPath === '/auth' ||
          currentPath === '/login' ||
          currentPath === '/register' ||
          currentPath === '/profil' ||
          currentPath === '/profile'
        ) {
          setActiveTab('profile');
        } else if (currentPath === '/') {
          setActiveTab('home');
        }
      };
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, []);

  // Gestion des liens profonds ?tab=... (Push / E-mail notifications pour tous les rôles)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');

    if (tabParam) {
      if (!isAuthLoading) {
        if (isAuthenticated && isTabAllowedForRole(tabParam, effectiveRole, isAuthenticated)) {
          setActiveTab(tabParam);
          // Retirer le paramètre de l'URL une fois connecté et routé
          urlParams.delete('tab');
          const newSearch = urlParams.toString() ? '?' + urlParams.toString() : '';
          window.history.replaceState(null, '', window.location.pathname + newSearch + window.location.hash);
        } else if (!isAuthenticated) {
          // Utilisateur non encore connecté : on conserve ?tab=... dans l'URL et on ouvre la connexion
          setActiveTab('profile');
        }
      }
    }
  }, [isAuthenticated, isAuthLoading, effectiveRole]);

  // PRIORITÉ 2 : Guard contextuel /pos — Priorité absolue si auth.uid() existe dans sales_agents
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isPos = getInitialIsPosRoute() || isPosRoute;
    if (!isPos) {
      setPosLinkedAgentId(null);
      setIsCheckingPosAccess(false);
      return;
    }

    if (isAuthLoading) return;

    if (!isAuthenticated || !user?.id) {
      setPosLinkedAgentId(null);
      setIsCheckingPosAccess(false);
      setIsPosRoute(true);
      return;
    }

    let cancelled = false;
    const resolvePosContextAccess = async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        const snap = loadPosAgentSnapshot(user.assignedAgentId);
        const cachedAgent =
          snap.agents.find((a) => a.userId === user.id) || snap.activeAgent;
        if (cachedAgent) {
          setPosLinkedAgentId(cachedAgent.id);
          setIsPosRoute(true);
          setActiveTab('sales_agent');
          setIsCheckingPosAccess(false);
          return;
        }
      }

      setIsCheckingPosAccess(true);
      const linkedRes = await fetchLinkedSalesAgentForUser(user.id);
      if (cancelled) return;

      if (linkedRes.agent) {
        // Point de vente lié trouvé : afficher la caisse même si le profil est promoter
        setPosLinkedAgentId(linkedRes.agent.id);
        setIsPosRoute(true);
        setActiveTab('sales_agent');
        setIsCheckingPosAccess(false);
        return;
      }

      if (linkedRes.error) {
        const snap = loadPosAgentSnapshot(user.assignedAgentId);
        const cachedAgent = snap.agents.find((a) => a.userId === user.id);
        if (cachedAgent) {
          setPosLinkedAgentId(cachedAgent.id);
          setIsPosRoute(true);
          setActiveTab('sales_agent');
          setIsCheckingPosAccess(false);
          return;
        }
      }

      // Aucun point de vente lié : appliquer la redirection habituelle selon le rôle
      // Un compte POS (sales_agent ou *@pos.thiesdn.site) ne quitte jamais /pos
      setPosLinkedAgentId(null);
      setIsCheckingPosAccess(false);

      if (isPosAccountIdentity(user.email, effectiveRole)) {
        setIsPosRoute(true);
        setActiveTab('sales_agent');
      } else if (effectiveRole === 'promoter') {
        setIsPosRoute(false);
        if (window.location.pathname !== '/') {
          window.history.replaceState(null, '', '/');
        }
        setActiveTab('finances');
      } else if (effectiveRole === 'admin') {
        setIsPosRoute(false);
        if (window.location.pathname !== '/admin') {
          window.history.replaceState(null, '', '/admin');
        }
        setActiveTab('dashboard');
      } else {
        setIsPosRoute(false);
        if (window.location.pathname !== '/') {
          window.history.replaceState(null, '', '/');
        }
        setActiveTab('home');
      }
    };

    void resolvePosContextAccess();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isAuthLoading, effectiveRole, user?.id, user?.email, isPosRoute]);

  // Chargement et écoute Realtime des notifications multi-canal (public.notifications + legacy user_notifications)
  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setNotifications([]);
      return;
    }

    // Chargement initial depuis la base
    fetchUserNotifications(user.id).then((notifs) => {
      setNotifications(notifs);
    });

    const client = getSupabaseClient();
    if (!client) return;

    const handleRealtimeInsert = (
      payload: { new?: Record<string, unknown> },
      sourceTable: 'notifications' | 'user_notifications'
    ) => {
      const row = payload.new;
      if (!row || typeof row.id !== 'string') return;

      const title = typeof row.title === 'string' ? row.title : 'Nouvelle alerte';
      const body = typeof row.body === 'string' ? row.body : '';
      const rawUrl =
        sourceTable === 'notifications'
          ? (typeof row.action_url === 'string' ? row.action_url : undefined)
          : (typeof row.url === 'string' ? row.url : undefined);
      const rawType =
        sourceTable === 'notifications'
          ? (typeof row.type === 'string' ? row.type : 'info')
          : (typeof row.kind === 'string' ? row.kind : 'info');
      const timestamp =
        typeof row.created_at === 'string' ? row.created_at : new Date().toISOString();
      const isRead = sourceTable === 'notifications' ? Boolean(row.read) : Boolean(row.read_at);

      playNotificationChime();
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([300, 150, 300, 150, 600]);
      }

      const newItem: NotificationItem = {
        id: row.id,
        title,
        message: body,
        timestamp,
        read: isRead,
        type: rawType,
        url: rawUrl,
        actionUrl: rawUrl,
        sourceTable,
      };

      setNotifications((prev) => {
        if (prev.some((n) => n.id === newItem.id)) return prev;
        return [newItem, ...prev];
      });

      setUserAlertToast({
        id: row.id,
        title,
        body,
        url: rawUrl,
      });
    };

    const channel = client
      .channel(`user-notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => handleRealtimeInsert(payload as { new?: Record<string, unknown> }, 'notifications')
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = (payload as { new?: Record<string, unknown> }).new;
          if (!row || typeof row.id !== 'string') return;
          setNotifications((prev) =>
            prev.map((n) => (n.id === row.id ? { ...n, read: Boolean(row.read) } : n))
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => handleRealtimeInsert(payload as { new?: Record<string, unknown> }, 'user_notifications')
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [isAuthenticated, user?.id]);

  // Contrôle d'accès strict par rôle aux onglets (Route Guards)
  const isTabAllowedForRole = (tab: string, role: 'user' | 'promoter' | 'admin' | 'sales_agent' | 'artist', isAuth: boolean): boolean => {
    // Verrouillage hermétique des comptes POS : aucun onglet client/profil/admin/CGV autorisé
    if (isAuth && (role === 'sales_agent' || isPosAccount)) {
      return tab === 'sales_agent';
    }

    // Les Conditions Générales de Vente et la Vitrine Showcase sont d'ordre public et consultables par tous
    if (tab === 'cgv' || tab === 'showcase' || tab === 'presentation') {
      return true;
    }

    // Si la route est de type admin et que le rôle effectif n'est pas admin : REFUS STRICT
    const adminOnlyTabs = ['dashboard', 'events_mgmt', 'moderation', 'orders', 'payments', 'users', 'checkin', 'settings', 'admin'];
    if (adminOnlyTabs.includes(tab) && role !== 'admin') {
      return false;
    }

    if (posLinkedAgentId && tab === 'sales_agent') {
      return true;
    }

    if (!isAuth) {
      return ['home', 'explore', 'cgv', 'showcase', 'presentation', ...(hasGuestOrderToken ? ['tickets'] : [])].includes(tab);
    }
    if (role === 'admin') {
      return true; // Accès complet
    }
    if (role === 'promoter') {
      const allowed = ['home', 'explore', 'create', 'profile', 'cgv'];
      if (myEventsCount > 0) {
        allowed.push('finances', 'points_de_vente', 'artist', 'accreditations', 'stations');
      }
      return allowed.includes(tab);
    }
    if (role === 'artist') {
      return ['home', 'explore', 'create', 'artist', 'profile', 'accreditations', 'cgv'].includes(tab);
    }
    if (isPosRoute) {
      return tab === 'sales_agent';
    }
    if (role === 'user') {
      return ['home', 'explore', 'tickets', 'profile', 'cgv'].includes(tab);
    }
    return false;
  };

  const handleTabChange = (targetTab: string) => {
    if (isPosAccount) {
      setIsPosRoute(true);
      setActiveTab('sales_agent');
      if (typeof window !== 'undefined' && !isStrictPosUrl()) {
        window.location.replace('/pos');
      }
      return;
    }
    setIsPosRoute(false);
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
      } else if ((targetTab === 'showcase' || targetTab === 'presentation') && window.location.pathname !== '/showcase') {
        window.history.pushState(null, '', '/showcase');
      } else if (targetTab === 'home' && window.location.pathname !== '/') {
        window.history.pushState(null, '', '/');
      }
    }
  };

  // Chargement des événements réels depuis Supabase (Source Unique de Vérité avec Résilience Totale)
  const refreshEvents = async () => {
    try {
      setIsLoadingEvents(true);
      setEventsError(null);
      const { events: dbEvents, error } = await fetchEventsFromSupabase({ includeDeleted: true });
      if (error) {
        console.warn('Erreur Supabase events (mode repli résilient):', error);
        setEvents([]);
      } else {
        setEvents(Array.isArray(dbEvents) ? dbEvents.filter(Boolean) : []);
      }
    } catch (err: any) {
      console.error('Exception lors du chargement des événements:', err);
      setEvents([]);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  useEffect(() => {
    refreshEvents();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || effectiveRole !== 'admin') {
      setPendingOrdersCount(0);
      return;
    }
    fetchOrdersFromSupabase({ statuses: ['pending', 'payment_signaled'] }).then(({ orders }) => {
      if (orders) {
        setPendingOrdersCount(orders.length);
      }
    });
  }, [isAuthenticated, effectiveRole]);

  // Détection et ouverture automatique d'un billet digital via lien direct (/ticket/:id ou ?ticket=ID)
  useEffect(() => {
    const ticketId = directTicketId || getInitialTicketId();
    if (!ticketId) return;

    fetchTicketByPublicId(ticketId).then((res) => {
      if (res.success && res.ticket) {
        setSelectedTicketForPass(res.ticket);
        setTickets((prev) => {
          const exists = prev.some((t) => t.id === res.ticket!.id);
          return exists ? prev : [res.ticket!, ...prev];
        });
        if (effectiveRole !== 'admin') {
          setActiveTab('tickets');
        }
      }
    });
  }, [directTicketId, effectiveRole]);

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
      const matched = safeEvents.find((e) => e && e.id === targetId);
      if (matched) {
        const status = String(matched.status || '').toLowerCase();
        const isArchived = status === 'archived' || Boolean(matched.isDeleted) || Boolean(matched.deletedAt);
        if (isArchived && effectiveRole !== 'admin') {
          return;
        }
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
          const isConfirmed = Boolean(session.user.email_confirmed_at || (session.user as { confirmed_at?: string }).confirmed_at);
          fetchUserProfile(session.user.id, session.user).then((profile) => {
            const onPosUrl = getInitialIsPosRoute();
            if (profile) {
              const resolvedRole = resolveEffectiveUserRole(profile.role, profile.email || session.user.email);
              setUser({ ...profile, role: resolvedRole, isEmailConfirmed: isConfirmed });
              setCurrentRole(resolvedRole);
              if (!onPosUrl) {
                if (resolvedRole === 'admin' && !isAdminPreview) {
                  setActiveTab('dashboard');
                } else if (resolvedRole === 'sales_agent') {
                  setIsPosRoute(true);
                  setActiveTab('sales_agent');
                } else if (resolvedRole === 'artist') {
                  setActiveTab('artist');
                }
              }
            } else {
              const metaRole = typeof session.user.user_metadata?.role === 'string' ? session.user.user_metadata.role : undefined;
              const role = resolveEffectiveUserRole(metaRole, session.user.email);
              setUser((prev) => ({
                ...prev,
                id: session.user.id,
                email: session.user.email || prev.email,
                name: (typeof session.user.user_metadata?.name === 'string' ? session.user.user_metadata.name : undefined) || prev.name,
                role,
                isEmailConfirmed: isConfirmed,
              }));
              setCurrentRole(role);
              if (!onPosUrl) {
                if (role === 'admin' && !isAdminPreview) {
                  setActiveTab('dashboard');
                } else if (role === 'sales_agent') {
                  setIsPosRoute(true);
                  setActiveTab('sales_agent');
                } else if (role === 'artist') {
                  setActiveTab('artist');
                }
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
            const isConfirmed = Boolean(session.user.email_confirmed_at || (session.user as { confirmed_at?: string }).confirmed_at);
            const profile = await fetchUserProfile(session.user.id, session.user);
            const onPosUrl = getInitialIsPosRoute();
            if (profile) {
              const resolvedRole = resolveEffectiveUserRole(profile.role, profile.email || session.user.email);
              setUser({ ...profile, role: resolvedRole, isEmailConfirmed: isConfirmed });
              setCurrentRole(resolvedRole);
              if (!onPosUrl) {
                if (resolvedRole === 'admin' && !isAdminPreview) {
                  setActiveTab('dashboard');
                } else if (resolvedRole === 'sales_agent') {
                  setIsPosRoute(true);
                  setActiveTab('sales_agent');
                } else if (resolvedRole === 'artist') {
                  setActiveTab('artist');
                }
              }
            } else {
              const metaRole = typeof session.user.user_metadata?.role === 'string' ? session.user.user_metadata.role : undefined;
              const role = resolveEffectiveUserRole(metaRole, session.user.email);
              setUser((prev) => ({
                ...prev,
                id: session.user.id,
                email: session.user.email || prev.email,
                name: (typeof session.user.user_metadata?.name === 'string' ? session.user.user_metadata.name : undefined) || prev.name,
                role,
                isEmailConfirmed: isConfirmed,
              }));
              setCurrentRole(role);
              if (!onPosUrl) {
                if (role === 'admin' && !isAdminPreview) {
                  setActiveTab('dashboard');
                } else if (role === 'sales_agent') {
                  setIsPosRoute(true);
                  setActiveTab('sales_agent');
                } else if (role === 'artist') {
                  setActiveTab('artist');
                }
              }
            }
            fetchUserTicketsFromSupabase(session.user.id).then(({ tickets: dbTickets }) => {
              setTickets(dbTickets);
            });
          } else if (event === 'SIGNED_OUT') {
            const stayingOnPos = getInitialIsPosRoute();
            setIsAuthenticated(false);
            setPosLinkedAgentId(null);
            setUser({ ...INITIAL_USER, role: 'user', isEmailConfirmed: false });
            setCurrentRole('user');
            setIsAdminPreview(false);
            setTickets([]);
            if (stayingOnPos) {
              setIsPosRoute(true);
              setActiveTab('sales_agent');
            } else {
              setActiveTab('home');
            }
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
    const resolvedRole = resolveEffectiveUserRole(role, contextUser?.email || user?.email);
    setIsAuthenticated(true);
    setCurrentRole(resolvedRole);
    setUser((prev) => ({
      ...prev,
      role: resolvedRole,
    }));
    if (resolvedRole === 'sales_agent') {
      setIsPosRoute(true);
      setActiveTab('sales_agent');
      if (typeof window !== 'undefined' && !isStrictPosUrl()) {
        window.location.replace('/pos');
      }
      return;
    }
    if (resolvedRole === 'admin') {
      setActiveTab('dashboard');
    } else if (resolvedRole === 'artist') {
      setActiveTab('artist');
    } else {
      setActiveTab('home');
    }
  };

  const handleSignOut = async () => {
    await contextSignOut();
    setIsAuthenticated(false);
    setPosLinkedAgentId(null);
    setUser({ ...INITIAL_USER, role: 'user' });
    setCurrentRole('user');
    setIsAdminPreview(false);
    setTickets([]);
  };

  const handlePosSignOut = async () => {
    await contextSignOut();
    setIsAuthenticated(false);
    setPosLinkedAgentId(null);
    setUser({ ...INITIAL_USER, role: 'user', isEmailConfirmed: false });
    setCurrentRole('user');
    setIsAdminPreview(false);
    setTickets([]);
    setIsPosRoute(true);
    setActiveTab('sales_agent');
    if (typeof window !== 'undefined') {
      window.location.replace('/pos');
    }
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

  const handleMarkNotificationRead = (
    id: string,
    url?: string,
    sourceTable?: NotificationItem['sourceTable']
  ) => {
    void markNotificationAsRead(id, sourceTable);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    if (url) {
      const match = url.match(/[?&]tab=([a-zA-Z0-9_-]+)/);
      if (match && match[1] && isTabAllowedForRole(match[1], effectiveRole, isAuthenticated)) {
        handleTabChange(match[1]);
      }
    }
  };

  const handleClearNotifications = () => {
    if (user?.id) {
      markAllNotificationsAsRead(user.id);
    }
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
  ].includes(activeTab) && !(hasGuestOrderToken && activeTab === 'tickets');
  const isTabPermitted = isTabAllowedForRole(activeTab, effectiveRole, isAuthenticated);

  // GARDE HERMÉTIQUE POS : Tout compte vendeur (sales_agent ou *@pos.thiesdn.site)
  // est strictement confiné à /pos et ne doit jamais voir aucune vue client, profil ou admin.
  if (isAuthenticated && isPosAccount && !isStrictPosUrl()) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0a0a0a] flex flex-col items-center justify-center p-6 text-center space-y-4 font-sans text-[#E5E2E1]">
        <div className="bg-pattern" />
        <div className="w-12 h-12 rounded-2xl bg-[#8A2BE2]/20 border border-[#8A2BE2]/40 flex items-center justify-center animate-pulse relative z-10">
          <span className="w-6 h-6 border-2 border-[#E9C349] border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="font-heading text-sm font-bold text-white tracking-wide relative z-10">
          Accès restreint — Redirection vers votre guichet POS...
        </p>
      </div>
    );
  }

  // Sécurité hermétique : si un code de poste de scan est présent dans l'URL (/scan/:code),
  // on affiche immédiatement l'interface de scan mobile autonome (sans header, sans sidebar ni accès admin)
  if (scanStationCode) {
    return (
      <React.Suspense fallback={<ViewSkeletonLoader />}>
        <PublicScannerStationView accessCode={scanStationCode} />
      </React.Suspense>
    );
  }

  // Écran autonome de réclamation de billet offert (/claim-ticket/:token)
  if (claimToken) {
    return (
      <React.Suspense fallback={<ViewSkeletonLoader />}>
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
      </React.Suspense>
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

  // PRIORITÉ 2 : Isolation hermétique plein écran pour la route POS /pos ou tout compte POS
  if (isPosRoute || (isAuthenticated && isPosAccount)) {
    const showPosVerificationSpinner =
      isAuthLoading ||
      (isAuthenticated &&
        isCheckingPosAccess &&
        !isPosAccount &&
        effectiveRole !== 'sales_agent' &&
        !posLinkedAgentId);

    return (
      <div className="fixed inset-0 z-50 bg-[#0a0a0a] overflow-y-auto font-sans text-[#E5E2E1]">
        <div className="bg-pattern" />
        {showPosVerificationSpinner ? (
          <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#8A2BE2]/20 border border-[#8A2BE2]/40 flex items-center justify-center animate-pulse">
              <span className="w-6 h-6 border-2 border-[#E9C349] border-t-transparent rounded-full animate-spin" />
            </div>
            <p className="font-heading text-sm font-bold text-white tracking-wide">
              Vérification de votre guichet POS...
            </p>
            <p className="text-xs text-gray-400">
              Synchronisation avec votre point de vente Supabase.
            </p>
          </div>
        ) : isAuthenticated && (isPosAccount || effectiveRole === 'sales_agent' || Boolean(posLinkedAgentId)) ? (
          <div className="p-3 sm:p-6">
            <React.Suspense fallback={<ViewSkeletonLoader />}>
              <SalesAgentDashboardView
                user={user}
                events={events}
                currentAgentId={posLinkedAgentId ?? undefined}
                onSignOut={handlePosSignOut}
                onNavigateBack={
                  isPosAccount
                    ? undefined
                    : () => {
                        setIsPosRoute(false);
                        setPosLinkedAgentId(null);
                        if (typeof window !== 'undefined') {
                          window.history.pushState(null, '', '/');
                        }
                        if (effectiveRole === 'promoter') {
                          setActiveTab('finances');
                        } else if (effectiveRole === 'admin') {
                          setActiveTab('dashboard');
                        } else {
                          setActiveTab('home');
                        }
                      }
                }
              />
            </React.Suspense>
          </div>
        ) : (
          <React.Suspense fallback={<ViewSkeletonLoader />}>
            <PosAuthView
              isAuthenticated={isAuthenticated}
              currentUserId={user?.id}
              currentRole={effectiveRole}
              onLoginSuccess={(role, options) => {
                const linkedAgentId = options?.linkedAgentId ?? null;
                const resolvedPosRole = resolveEffectiveUserRole(role, contextUser?.email || user?.email);
                if (linkedAgentId) {
                  setIsAuthenticated(true);
                  setCurrentRole(resolvedPosRole);
                  setUser((prev) => ({
                    ...prev,
                    role: resolvedPosRole,
                    assignedAgentId: linkedAgentId,
                  }));
                  setPosLinkedAgentId(linkedAgentId);
                  setIsCheckingPosAccess(false);
                  setIsPosRoute(true);
                  setActiveTab('sales_agent');
                  return;
                }

                setPosLinkedAgentId(null);
                handleLoginSuccess(resolvedPosRole);
                if (resolvedPosRole === 'sales_agent') {
                  setIsPosRoute(true);
                  setActiveTab('sales_agent');
                } else {
                  setIsPosRoute(false);
                  if (typeof window !== 'undefined') {
                    window.history.pushState(null, '', resolvedPosRole === 'admin' ? '/admin' : '/');
                  }
                  if (resolvedPosRole === 'admin') setActiveTab('dashboard');
                  else if (resolvedPosRole === 'promoter') setActiveTab('finances');
                  else setActiveTab('home');
                }
              }}
              onNavigateHome={() => {
                if (isPosAccount) {
                  setIsPosRoute(true);
                  if (typeof window !== 'undefined' && !isStrictPosUrl()) {
                    window.location.replace('/pos');
                  }
                  return;
                }
                setIsPosRoute(false);
                setPosLinkedAgentId(null);
                if (typeof window !== 'undefined') {
                  window.history.pushState(null, '', '/');
                }
                setActiveTab(effectiveRole === 'promoter' ? 'finances' : 'home');
              }}
            />
          </React.Suspense>
        )}
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
        {/* Top Header Bar (Jamais affiché pour un compte POS) */}
        {!isPosAccount && (
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
        )}

        {/* Bannière Mode Aperçu Visiteur pour l'Administrateur */}
        {isAdminPreview && !isPosAccount && (
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

        {/* Sidebar on Desktop / Tablet : VISIBLE UNIQUEMENT POUR UTILISATEURS CONNECTÉS NON-POS */}
        {isAuthenticated && !isPosAccount && (
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
              onOpenNotificationsModal={() => setIsNotificationsModalOpen(true)}
            />
          ) : (
            <Sidebar
              user={{ ...user, role: effectiveRole }}
              activeTab={activeTab}
              onTabChange={handleTabChange}
              onOpenCreateModal={() => handleTabChange('create')}
              pendingModerationCount={pendingModerationCount}
              pendingOrdersCount={pendingOrdersCount}
              totalEventsCount={effectiveRole === 'promoter' ? myEventsCount : events.filter((e) => e.status === 'approved').length}
              myEventsCount={myEventsCount}
              onToggleAdminPreview={currentRole === 'admin' ? () => setIsAdminPreview(!isAdminPreview) : undefined}
              isAdminPreview={isAdminPreview}
            />
          )
        )}

        {/* Toast In-App Temps Réel pour Promoteurs, Artistes & Clients */}
        {userAlertToast && (
          <div className="fixed top-6 right-6 z-[9999] max-w-sm w-full animate-in slide-in-from-top-4 duration-300 pointer-events-auto">
            <div className="glass-panel p-4 rounded-2xl border-2 border-[#8A2BE2] bg-[#0E0E14]/95 shadow-2xl shadow-[#8A2BE2]/25 flex flex-col gap-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-heading font-extrabold text-xs text-[#DCB8FF]">
                    {userAlertToast.title}
                  </h4>
                  <p className="text-[11px] text-gray-300 font-medium mt-0.5">
                    {userAlertToast.body}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setUserAlertToast(null)}
                  className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {userAlertToast.url && (
                <div className="flex justify-end pt-1 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      if (userAlertToast.url) {
                        const match = userAlertToast.url.match(/[?&]tab=([a-zA-Z0-9_-]+)/);
                        if (match && match[1] && isTabAllowedForRole(match[1], effectiveRole, isAuthenticated)) {
                          handleTabChange(match[1]);
                        }
                      }
                      setUserAlertToast(null);
                    }}
                    className="btn-primary-glow py-1 px-3 rounded-xl font-heading font-bold text-[10px] uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                  >
                    <span>Consulter</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Coquille Admin : Centre de Notifications Realtime & Push (Monté UNE fois pour l'admin) */}
        {isAuthenticated && effectiveRole === 'admin' && (
          <AdminNotificationCenter
            user={{ ...user, role: 'admin' }}
            onNavigateToOrders={() => handleTabChange('orders')}
            onNewSignaledOrder={() => {
              fetchOrdersFromSupabase({ statuses: ['pending', 'payment_signaled'] }).then(({ orders }) => {
                if (orders) {
                  setPendingOrdersCount(orders.length);
                }
              });
            }}
            isOpenModal={isNotificationsModalOpen}
            onCloseModal={() => setIsNotificationsModalOpen(false)}
          />
        )}

        {/* Dynamic Main View Canvas : Marges adaptées (Plein écran pour visiteurs, décalé pour clients connectés) */}
        <main className={`flex-grow flex flex-col w-full mx-auto relative z-10 transition-all ${
          activeTab === 'showcase' || activeTab === 'presentation'
            ? 'p-0 m-0 max-w-none pt-0 pb-0'
            : isAuthenticated 
            ? 'pt-4 sm:pt-6 pb-[100px] md:pb-12 px-3 sm:px-6 md:pl-72 md:pr-8 w-full max-w-7xl' 
            : 'pt-4 sm:pt-6 pb-[100px] md:pb-12 px-3 sm:px-8 w-full max-w-6xl'
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

          {paymentBannerMessage && (
            <div className="mb-6 p-4 rounded-2xl bg-[#1C1B1B] border-2 border-[#1DC3F4] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xl animate-in slide-in-from-top-4 duration-300">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1DC3F4]/20 text-[#1DC3F4] flex items-center justify-center font-black flex-shrink-0">
                  Wave
                </div>
                <div>
                  <h4 className="font-heading font-extrabold text-xs sm:text-sm text-white">
                    Paiement Wave initié avec succès !
                  </h4>
                  <p className="text-xs text-gray-300">
                    {paymentBannerMessage}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={() => {
                    setActiveTab('tickets');
                    setPaymentBannerMessage(null);
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-[#1DC3F4] hover:bg-[#1bb3e0] text-[#07131D] font-heading font-extrabold text-xs uppercase tracking-wider transition-all"
                >
                  Voir mon billet
                </button>
                <button
                  onClick={() => setPaymentBannerMessage(null)}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
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
              <React.Suspense fallback={<ViewSkeletonLoader />}>
                <AuthView onLoginSuccess={handleLoginSuccess} />
              </React.Suspense>
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
            <React.Suspense fallback={<ViewSkeletonLoader />}>
              {/* TABLEAU DE BORD SUPER ADMIN DÉDIÉ (Par défaut à la connexion admin) */}
              {(activeTab === 'dashboard' || (activeTab === 'home' && effectiveRole === 'admin')) && effectiveRole === 'admin' && (
                <AdminDashboard
                  events={safeEvents}
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
                  events={effectiveRole === 'promoter' ? myEvents : events}
                  isLoading={isLoadingEvents}
                  isPromoterView={effectiveRole === 'promoter'}
                  currentUserId={user.id}
                  currentRole={effectiveRole}
                  onSelectEvent={(evt) => setSelectedEventForDetail(evt)}
                  onManageEvent={() => handleTabChange('finances')}
                  onNavigateToExplore={() => handleTabChange('explore')}
                  onNavigateToCreate={() => handleTabChange('create')}
                />
              )}

              {/* VUE EXPLORER LA CARTE (Uniquement pour Clients et Promoteurs) */}
              {activeTab === 'explore' && effectiveRole !== 'admin' && (
                <ExploreView
                  events={events}
                  isLoading={isLoadingEvents}
                  currentUserId={user.id}
                  currentRole={effectiveRole}
                  onSelectEvent={(evt) => setSelectedEventForDetail(evt)}
                  onManageEvent={() => handleTabChange('finances')}
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
                  events={safeEvents}
                  onRefreshEvents={refreshEvents}
                  onNavigateCreate={() => handleTabChange('create')}
                  onPreviewEvent={(evt) => setSelectedEventForDetail(evt)}
                />
              )}

              {/* MODÉRATION DES ÉVÉNEMENTS */}
              {activeTab === 'moderation' && effectiveRole === 'admin' && (
                <ModerationView
                  events={safeEvents}
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
                  events={safeEvents}
                  onValidateTicket={handleValidateTicket}
                />
              )}

              {(activeTab === 'finances' || activeTab === 'cockpit') && (effectiveRole === 'promoter' || effectiveRole === 'admin') && (
                <FinancesView
                  currentRole={effectiveRole}
                  events={safeEvents}
                  promoterName={user.name}
                  initialTab="stats"
                />
              )}

              {/* BILLETS PHYSIQUES & RÉSEAU PROMOTEUR (ACCÈS DIRECT DEPUIS BOTTOMNAV) */}
              {(activeTab === 'points_de_vente' || activeTab === 'physical_tickets' || activeTab === 'network') && (effectiveRole === 'promoter' || effectiveRole === 'admin') && (
                <FinancesView
                  currentRole={effectiveRole}
                  events={safeEvents}
                  promoterName={user.name}
                  initialTab="network"
                />
              )}

              {/* ESPACE COLLABORATEUR / POINT DE VENTE MOBILE */}
              {(activeTab === 'sales_agent' || (effectiveRole === 'sales_agent' && activeTab === 'home')) && (
                <SalesAgentDashboardView
                  user={user}
                  onSignOut={handlePosSignOut}
                  onNavigateBack={isPosAccount ? undefined : () => handleTabChange('home')}
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

              {/* SESSIONS DE SCAN VIGILES (ANTI-PARTAGE & SUPERVISION EN DIRECT) */}
              {activeTab === 'vigile_sessions' && effectiveRole === 'admin' && (
                <VigileSessionsView />
              )}

              {/* JOURNAL DES CONNEXIONS & TRAÇABILITÉ DES ACCÈS */}
              {activeTab === 'login_history' && effectiveRole === 'admin' && (
                <LoginHistoryView />
              )}

              {activeTab === 'tickets' && (
                <TicketsWalletView
                  tickets={tickets}
                  userId={isAuthenticated ? user.id : undefined}
                  userName={user.name}
                  orderFilter={orderFilter}
                  onClearOrderFilter={() => setOrderFilter(null)}
                  onOpenPass={(tkt) => setSelectedTicketForPass(tkt)}
                  onExploreEvents={() => handleTabChange('home')}
                  onTicketUpdated={(tkt) => {
                    setTickets((prev) => prev.map((t) => (t.id === tkt.id ? tkt : t)));
                  }}
                />
              )}

              {activeTab === 'profile' && !isPosAccount && (
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

              {/* VITRINE MOTION DESIGN SHOWCASE & PRÉSENTATION PARTENARIAT */}
              {(activeTab === 'showcase' || activeTab === 'presentation') && (
                <React.Suspense fallback={<LoadingIntro />}>
                  <LandingShowcaseView onNavigate={handleTabChange} />
                </React.Suspense>
              )}
            </React.Suspense>
          )}

          {/* Pied de page Officiel (Footer) complet et responsive */}
          {activeTab !== 'showcase' && activeTab !== 'presentation' && !isPosAccount && (
            <Footer
              onNavigateCGV={() => handleTabChange('cgv')}
            />
          )}
        </main>
      </div>

      {/* Floating Bottom Nav for Mobile Screens (Jamais affiché pour un compte POS) */}
      {!isPosAccount && (
        <BottomNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
          pendingCount={pendingModerationCount}
          ticketsCount={tickets.length}
          userRole={effectiveRole}
          isAuthenticated={isAuthenticated}
          isAdminPreview={isAdminPreview}
        />
      )}

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
        onNavigateToTickets={() => {
          setSelectedEventForDetail(null);
          setActiveTab('tickets');
        }}
        userName={user.name}
        userEmail={user.email}
        isEmailConfirmed={Boolean(user.isEmailConfirmed)}
        isAuthenticated={isAuthenticated}
        onRequireAuth={() => {
          setSelectedEventForDetail(null);
          setActiveTab('profile');
        }}
        currentUserId={user.id}
        currentRole={effectiveRole}
        onManageEvent={() => {
          setSelectedEventForDetail(null);
          handleTabChange('finances');
        }}
      />

      {/* Digital Ticket Pass Modal */}
      <TicketDetailModal
        ticket={selectedTicketForPass}
        isOpen={selectedTicketForPass !== null}
        onClose={() => setSelectedTicketForPass(null)}
        mode="client"
      />

      {/* Bannière PWA d'installation (mobile exclusif) */}
      <PWAInstallPrompt />
    </div>
  );
}
