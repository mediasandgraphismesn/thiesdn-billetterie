import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ShieldCheck,
  Calendar,
  Ticket,
  DollarSign,
  Clock,
  RefreshCw,
  ExternalLink,
  Eye,
  CheckCircle2,
  AlertCircle,
  MapPin,
  LayoutGrid,
  ArrowRight,
  CreditCard,
  Users,
  Wallet,
  QrCode,
  Settings,
  GripVertical,
  Contrast,
  RotateCcw,
  History,
  ShieldAlert,
} from 'lucide-react';
import {
  ConnectionLogRecord,
  EventAnalyticsRecord,
  EventItem,
  OrderRecord,
  SalesAgent,
  ScanStation,
  UserProfile,
  UserTicket,
} from '../types';
import {
  fetchOrdersFromSupabase,
  getStoredOrders,
  confirmManualOrderAtomic,
  rejectManualOrderAtomic,
  fetchEventsFromSupabase,
  fetchAllProfilesFromSupabase,
  getSupabaseClient,
  fetchFailedEmailsCountLast7Days,
  fetchAllSoldTicketsFromSupabase,
  fetchSalesAgentsFromSupabase,
  fetchScanStationsFromSupabase,
  fetchConnectionLogs,
  fetchEventAnalytics,
} from '../services/supabase';
import { StatsCard } from '../components/admin/StatsCard';
import { OrdersTable } from '../components/admin/OrdersTable';
import { SoldTicketsSection } from '../components/admin/SoldTicketsSection';
import { TicketDetailModal } from '../components/TicketDetailModal';
import { SenegalMap } from '../components/SenegalMap';
import { AudienceAnalyticsCard } from '../components/analytics/AudienceAnalyticsCard';
import { ContextualTooltip } from '../components/ui/ContextualTooltip';
import {
  AdminDensity,
  AdminDashboardSectionId,
  useAdminPreferences,
} from '../hooks/useAdminPreferences';

interface AdminDashboardProps {
  events: EventItem[];
  tickets: UserTicket[];
  onNavigateTab: (tab: string) => void;
  onApproveEvent: (eventId: string) => void;
  onRejectEvent: (eventId: string, reason?: string) => void;
  onPreviewEvent: (event: EventItem) => void;
  onTicketsCreated?: (newTickets: UserTicket[]) => void;
  onOpenVisitorPreview: () => void;
}

const SECTION_LABELS: Record<AdminDashboardSectionId, string> = {
  kpis: 'KPIs Globaux',
  senegal_map: 'Carte Interactive du Sénégal',
  audience_analytics: "Analyse de l'Audience",
  audit_logs: "Journal d'Audit & Connexions",
  quick_modules: 'Accès Direct Modules',
  orders_table: 'Commandes Supabase',
  sold_tickets: 'Billets Vendus & QR',
  pending_moderation: 'Modération en Attente',
};

interface SortableSectionProps {
  id: AdminDashboardSectionId;
  children: React.ReactNode;
}

const SortableDashboardSection: React.FC<SortableSectionProps> = ({ id, children }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 40 : undefined,
    opacity: isDragging ? 0.85 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group/dnd">
      <button
        type="button"
        {...attributes}
        {...listeners}
        title={`Réorganiser : ${SECTION_LABELS[id]}`}
        aria-label={`Déplacer la section ${SECTION_LABELS[id]}`}
        className="absolute top-3 right-3 z-20 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#181720]/90 hover:bg-[#8A2BE2] border border-white/15 text-gray-300 hover:text-white text-[10px] font-bold opacity-80 sm:opacity-60 group-hover/dnd:opacity-100 transition-all cursor-grab active:cursor-grabbing shadow-md"
      >
        <GripVertical className="w-3.5 h-3.5" />
        <span className="hidden md:inline">Déplacer</span>
      </button>
      {children}
    </div>
  );
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  events: propEvents,
  tickets,
  onNavigateTab,
  onApproveEvent,
  onRejectEvent,
  onPreviewEvent,
  onTicketsCreated,
  onOpenVisitorPreview,
}) => {
  const {
    cardOrder,
    setCardOrder,
    resetCardOrder,
    density,
    setDensity,
    densityClasses,
    highContrast,
    setHighContrast,
  } = useAdminPreferences(true);

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [events, setEvents] = useState<EventItem[]>(propEvents);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [salesAgents, setSalesAgents] = useState<SalesAgent[]>([]);
  const [scanStations, setScanStations] = useState<ScanStation[]>([]);
  const [connectionLogs, setConnectionLogs] = useState<ConnectionLogRecord[]>([]);
  const [connectionLogsError, setConnectionLogsError] = useState<string | null>(null);
  const [audienceAnalytics, setAudienceAnalytics] = useState<EventAnalyticsRecord[]>([]);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionSuccessToast, setActionSuccessToast] = useState<string | null>(null);
  const [actionErrorToast, setActionErrorToast] = useState<string | null>(null);
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const [failedEmailsCount, setFailedEmailsCount] = useState<number>(0);
  const [soldTickets, setSoldTickets] = useState<UserTicket[]>(tickets || []);
  const [selectedTicketForPass, setSelectedTicketForPass] = useState<UserTicket | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const loadSupabaseData = async () => {
    setIsLoading(true);
    fetchFailedEmailsCountLast7Days().then(setFailedEmailsCount);
    setActionErrorToast(null);

    try {
      const [
        { orders: dbOrders, error: ordersErr },
        { events: dbEvents },
        { profiles: dbProfiles },
        { tickets: dbTickets, error: ticketsErr },
        { agents: dbAgents },
        { stations: dbStations },
        { logs: dbLogs, error: logsErr },
        { records: dbAnalytics, error: analyticsErr },
      ] = await Promise.all([
        fetchOrdersFromSupabase(),
        fetchEventsFromSupabase(),
        fetchAllProfilesFromSupabase(),
        fetchAllSoldTicketsFromSupabase(),
        fetchSalesAgentsFromSupabase(),
        fetchScanStationsFromSupabase('all'),
        fetchConnectionLogs(80),
        fetchEventAnalytics({ days: 30 }),
      ]);

      if (ticketsErr) {
        console.warn('Sold tickets fetch warning:', ticketsErr);
      }
      if (dbTickets && dbTickets.length > 0) {
        setSoldTickets(dbTickets);
      }

      if (ordersErr) {
        console.warn('Orders fetch warning, repli sur le cache local :', ordersErr);
      }

      setOrders(dbOrders && dbOrders.length > 0 ? dbOrders : getStoredOrders());
      if (dbEvents && dbEvents.length > 0) {
        setEvents(dbEvents);
      } else {
        setEvents(propEvents);
      }
      setProfiles(dbProfiles || []);
      setSalesAgents(dbAgents || []);
      setScanStations(dbStations || []);
      setConnectionLogs(dbLogs || []);
      setConnectionLogsError(logsErr);
      setAudienceAnalytics(dbAnalytics || []);
      setAnalyticsError(analyticsErr);
    } catch (err: unknown) {
      console.error('Erreur chargement Supabase AdminDashboard :', err);
      const message =
        err instanceof Error ? err.message : 'Erreur lors de la lecture des tables Supabase.';
      setActionErrorToast(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSupabaseData();
  }, []);

  useEffect(() => {
    if (propEvents.length > 0) {
      setEvents(propEvents);
    }
  }, [propEvents]);

  useEffect(() => {
    if (tickets && tickets.length > 0) {
      setSoldTickets((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const additions = tickets.filter((t) => !existingIds.has(t.id));
        return additions.length > 0 ? [...additions, ...prev] : prev;
      });
    }
  }, [tickets]);

  const approvedEventsCount = events.filter((e) => e.status === 'approved').length;
  const pendingEvents = events.filter((e) => e.status === 'pending');
  const pendingEventsCount = pendingEvents.length;

  const confirmedOrders = orders.filter((o) => o.status === 'confirmed');
  const pendingOrders = orders.filter(
    (o) => o.status === 'pending' || o.status === 'payment_signaled'
  );
  const pendingOrdersCount = pendingOrders.length;

  const totalTicketsSold = confirmedOrders.reduce((sum, o) => sum + (o.quantity || 1), 0);
  const totalRevenue = confirmedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const platformCommission10 = Math.round(totalRevenue * 0.1);

  const handleConfirmOrder = async (order: OrderRecord) => {
    setProcessingOrderId(order.id);
    try {
      const targetEvent = events.find((e) => e.id === order.eventId);
      const result = await confirmManualOrderAtomic(order.id, targetEvent, 'admin-super');

      if (result.success && result.tickets) {
        if (onTicketsCreated) {
          onTicketsCreated(result.tickets);
        }
        setSoldTickets((prev) => [...result.tickets!, ...prev]);
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? { ...o, status: 'confirmed' } : o))
        );
        setActionSuccessToast(
          `Paiement de ${order.customerName} validé ! ${result.tickets.length} billet(s) émis.`
        );
        const supabase = getSupabaseClient();
        const clientEmail = order.customerEmail;
        if (supabase && clientEmail && clientEmail.includes('@')) {
          try {
            await supabase.functions.invoke('send-order-confirmation', {
              body: { orderId: order.id },
            });
          } catch (emailErr) {
            console.warn('Envoi email Resend non bloquant ignoré:', emailErr);
          }
        }
        fetchFailedEmailsCountLast7Days().then(setFailedEmailsCount);
        setTimeout(() => setActionSuccessToast(null), 4000);
      } else {
        setActionErrorToast(result.message || 'Impossible de confirmer cette commande.');
        setTimeout(() => setActionErrorToast(null), 4000);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur réseau lors de la validation.';
      setActionErrorToast(message);
      setTimeout(() => setActionErrorToast(null), 4000);
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleRejectOrder = async (orderId: string, reason?: string) => {
    setProcessingOrderId(orderId);
    try {
      const result = await rejectManualOrderAtomic(
        orderId,
        reason || 'Paiement Wave/OM non reçu sur le compte officiel.'
      );
      if (result.success) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: 'rejected' } : o))
        );
        setActionSuccessToast('Commande marquée comme rejetée.');
        setTimeout(() => setActionSuccessToast(null), 3000);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors du rejet.';
      setActionErrorToast(message);
      setTimeout(() => setActionErrorToast(null), 3000);
    } finally {
      setProcessingOrderId(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = cardOrder.indexOf(active.id as AdminDashboardSectionId);
    const newIndex = cardOrder.indexOf(over.id as AdminDashboardSectionId);
    if (oldIndex === -1 || newIndex === -1) return;
    setCardOrder(arrayMove(cardOrder, oldIndex, newIndex));
  };

  const renderSection = (sectionId: AdminDashboardSectionId): React.ReactNode => {
    switch (sectionId) {
      case 'kpis':
        return (
          <section className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 ${densityClasses.gridGap}`}>
            <StatsCard
              title="Événements"
              value={events.length}
              subtitle={`${approvedEventsCount} approuvés • ${pendingEventsCount} en attente`}
              icon={Calendar}
              glowColor="purple"
              onClick={() => onNavigateTab('events_mgmt')}
            />
            <StatsCard
              title="Billets Vendus"
              value={totalTicketsSold}
              subtitle="QR Codes uniques émis"
              icon={Ticket}
              glowColor="gold"
              onClick={() => onNavigateTab('finances')}
            />
            <StatsCard
              title="Chiffre d'Affaires"
              value={`${totalRevenue.toLocaleString('fr-FR')} FCFA`}
              subtitle={`10% Plateforme: ${platformCommission10.toLocaleString('fr-FR')} F`}
              icon={DollarSign}
              glowColor="emerald"
              onClick={() => onNavigateTab('finances')}
            />
            <StatsCard
              title="Paiements à Vérifier"
              value={pendingOrdersCount}
              subtitle={
                pendingOrdersCount > 0
                  ? 'Paiements Wave/OM en attente'
                  : 'Toutes les commandes sont à jour'
              }
              icon={Clock}
              glowColor="rose"
              alert={pendingOrdersCount > 0}
              onClick={() => onNavigateTab('orders')}
            />
          </section>
        );

      case 'senegal_map':
        return (
          <section className={`glass-panel rounded-3xl ${densityClasses.cardPadding} border border-[#8A2BE2]/30 shadow-2xl space-y-3`}>
            <div className="flex flex-wrap items-center justify-between gap-2 pr-24">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#8A2BE2]/20 border border-[#8A2BE2]/40 text-[#DCB8FF] text-xs font-bold uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#E9C349]" />
                  <span>Carte Cyber-Sécurité &amp; Heatmap Sénégal</span>
                </span>
                {salesAgents.length === 0 && connectionLogs.length === 0 && !isLoading && (
                  <ContextualTooltip
                    variant="info"
                    title="Carte avec marqueurs partiels"
                    reason="Aucun point de vente ou log de connexion n'est encore remonté depuis Supabase."
                    remedy="Exécutez supabase_migration_command_center_analytics.sql puis créez un point de vente ou reconnectez-vous."
                    align="left"
                  />
                )}
              </div>
            </div>

            <SenegalMap
              salesAgents={salesAgents}
              scanStations={scanStations}
              events={events}
              connectionLogs={connectionLogs}
              analytics={audienceAnalytics}
            />
          </section>
        );

      case 'audience_analytics':
        return (
          <AudienceAnalyticsCard
            analytics={audienceAnalytics}
            events={events}
            isLoading={isLoading}
            errorMessage={analyticsError}
            scopeLabel="Global Plateforme"
            cardPaddingClass={densityClasses.cardPadding}
          />
        );

      case 'audit_logs':
        return (
          <section className={`glass-panel rounded-3xl ${densityClasses.cardPadding} border border-white/10 space-y-4`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3 pr-24">
              <div className="flex items-center gap-2 flex-wrap">
                <History className="w-5 h-5 text-cyan-400" />
                <h2 className="font-heading text-base font-extrabold text-white">
                  Journal d&apos;Audit &amp; Connexions Récentes ({connectionLogs.length})
                </h2>
                {connectionLogsError ? (
                  <ContextualTooltip
                    variant="rbac"
                    title="Accès restreint au journal (RBAC)"
                    reason={`Lecture bloquée : ${connectionLogsError}`}
                    remedy="Vérifiez que votre profil possède le rôle 'admin' et que la politique RLS is_admin() est active."
                    align="left"
                  />
                ) : (
                  connectionLogs.length === 0 &&
                  !isLoading && (
                    <ContextualTooltip
                      variant="info"
                      title="Journal des connexions vide"
                      reason="La table connection_logs ne contient pas encore d'entrée récente."
                      remedy="Exécutez la migration SQL puis reconnectez-vous pour capturer l'IP et l'empreinte appareil."
                      align="left"
                    />
                  )
                )}
              </div>

              <button
                type="button"
                onClick={() => onNavigateTab('login_history')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-xs font-bold text-[#E9C349] self-start sm:self-auto cursor-pointer"
              >
                <span>Historique complet</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {connectionLogs.length === 0 ? (
              <p className="text-xs text-gray-300 py-4 text-center">
                Aucune connexion journalisée pour le moment.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {connectionLogs.slice(0, 6).map((log) => (
                  <div
                    key={log.id}
                    className={`p-3 rounded-2xl border text-xs space-y-1 ${
                      log.isSuspicious
                        ? 'bg-red-950/35 border-red-500/40'
                        : 'bg-[#15141C] border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-white truncate">{log.email}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase shrink-0 ${
                          log.isSuspicious
                            ? 'bg-red-500/25 text-red-300'
                            : 'bg-cyan-500/20 text-cyan-300'
                        }`}
                      >
                        {log.isSuspicious ? 'Suspect' : 'Sûr'}
                      </span>
                    </div>
                    <p className="text-gray-300 flex items-center justify-between gap-2">
                      <span>
                        {log.city || 'Thiès'}, {log.country || 'Sénégal'}
                      </span>
                      <span className="font-mono text-[11px] text-cyan-300">
                        {log.ipAddress || '127.0.0.1'}
                      </span>
                    </p>
                    <p className="text-[10px] text-gray-300 truncate">
                      {log.deviceFingerprint ? `FP: ${log.deviceFingerprint} • ` : ''}
                      {new Date(log.createdAt).toLocaleString('fr-FR')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        );

      case 'quick_modules':
        return (
          <section className={`glass-panel ${densityClasses.cardPadding} rounded-3xl border border-white/10 space-y-4`}>
            <h2 className="text-base font-heading font-bold text-[#E9C349] flex items-center gap-2 pr-24">
              <LayoutGrid className="w-4 h-4 text-[#8A2BE2]" />
              <span>Accès Direct aux Modules de Gestion</span>
            </h2>

            <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 ${densityClasses.gridGap}`}>
              <button
                onClick={() => onNavigateTab('events_mgmt')}
                className="p-4 rounded-2xl bg-[#1C1B1B] hover:bg-[#252427] border border-white/5 hover:border-[#8A2BE2]/50 transition-all flex flex-col items-center text-center gap-2 group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-[#8A2BE2]/20 text-[#DCB8FF] flex items-center justify-center group-hover:scale-110 transition-transform relative">
                  <Ticket className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#E9C349] text-black text-[9px] font-black flex items-center justify-center">
                    {events.length}
                  </span>
                </div>
                <span className="text-xs font-bold text-white">Tous les Événements</span>
                <span className="text-[10px] text-gray-300">{events.length} au total</span>
              </button>

              <button
                onClick={() => onNavigateTab('moderation')}
                className="p-4 rounded-2xl bg-[#1C1B1B] hover:bg-[#252427] border border-white/5 hover:border-[#8A2BE2]/50 transition-all flex flex-col items-center text-center gap-2 group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-[#8A2BE2]/20 text-[#DCB8FF] flex items-center justify-center group-hover:scale-110 transition-transform relative">
                  <ShieldCheck className="w-5 h-5" />
                  {pendingEventsCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {pendingEventsCount}
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold text-white">Modération</span>
                <span className="text-[10px] text-gray-300">{pendingEventsCount} en attente</span>
              </button>

              <button
                onClick={() => onNavigateTab('orders')}
                className="p-4 rounded-2xl bg-[#1C1B1B] hover:bg-[#252427] border border-white/5 hover:border-[#E9C349]/50 transition-all flex flex-col items-center text-center gap-2 group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-[#E9C349]/20 text-[#E9C349] flex items-center justify-center group-hover:scale-110 transition-transform relative">
                  <CreditCard className="w-5 h-5" />
                  {pendingOrdersCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {pendingOrdersCount}
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold text-white">Validation Paiements</span>
                <span className="text-[10px] text-gray-300">{pendingOrdersCount} à vérifier</span>
              </button>

              <button
                onClick={() => onNavigateTab('users')}
                className="p-4 rounded-2xl bg-[#1C1B1B] hover:bg-[#252427] border border-white/5 hover:border-[#8A2BE2]/50 transition-all flex flex-col items-center text-center gap-2 group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-white">Gestion Utilisateurs</span>
                <span className="text-[10px] text-gray-300">
                  {profiles.length || 'Comptes'} inscrits
                </span>
              </button>

              <button
                onClick={() => onNavigateTab('finances')}
                className="p-4 rounded-2xl bg-[#1C1B1B] hover:bg-[#252427] border border-white/5 hover:border-emerald-500/50 transition-all flex flex-col items-center text-center gap-2 group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Wallet className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-white">Finances &amp; CA</span>
                <span className="text-[10px] text-gray-300">
                  {totalRevenue.toLocaleString('fr-FR')} F
                </span>
              </button>

              <button
                onClick={() => onNavigateTab('checkin')}
                className="p-4 rounded-2xl bg-[#1C1B1B] hover:bg-[#252427] border border-white/5 hover:border-[#8A2BE2]/50 transition-all flex flex-col items-center text-center gap-2 group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <QrCode className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-white">Scanner d&apos;Accès</span>
                <span className="text-[10px] text-gray-300">Guichet QR Code</span>
              </button>

              <button
                onClick={() => onNavigateTab('settings')}
                className="p-4 rounded-2xl bg-[#1C1B1B] hover:bg-[#252427] border border-white/5 hover:border-white/20 transition-all flex flex-col items-center text-center gap-2 group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-gray-500/20 text-gray-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Settings className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-white">Paramètres</span>
                <span className="text-[10px] text-gray-300">Configuration</span>
              </button>
            </div>
          </section>
        );

      case 'orders_table':
        return (
          <section className={`glass-panel rounded-3xl ${densityClasses.cardPadding} border border-white/10 space-y-4`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4 pr-24">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Clock className="w-5 h-5 text-[#E9C349]" />
                  <h2 className="text-base sm:text-lg font-heading font-bold text-white">
                    Toutes les Commandes de la Table `orders` ({orders.length})
                  </h2>
                  {orders.length === 0 && !isLoading && (
                    <ContextualTooltip
                      variant="info"
                      title="Aucune commande enregistrée"
                      reason="Aucun client n'a encore initié de réservation Wave/OM ou les droits RLS empêchent la lecture."
                      remedy="Vérifiez votre session administrateur Supabase ou testez une réservation depuis le Mode Visiteur."
                      align="left"
                    />
                  )}
                </div>
                <p className="text-xs text-[#E5E2E1] mt-0.5">
                  Historique complet de toutes les commandes enregistrées dans Supabase pour l&apos;ensemble des événements.
                </p>
              </div>

              <button
                onClick={() => onNavigateTab('orders')}
                className="btn-primary-glow px-4 py-2 rounded-xl text-xs font-bold font-heading uppercase tracking-wider flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
              >
                <span>Ouvrir Gestionnaire Paiements</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <OrdersTable
              orders={orders}
              events={events}
              isLoading={isLoading}
              onRefresh={loadSupabaseData}
              onConfirmOrder={handleConfirmOrder}
              onRejectOrder={handleRejectOrder}
              processingOrderId={processingOrderId}
            />
          </section>
        );

      case 'sold_tickets':
        return (
          <div className="relative">
            {soldTickets.length === 0 && !isLoading && (
              <div className="mb-2 flex justify-start">
                <ContextualTooltip
                  variant="info"
                  title="Aucun billet émis"
                  reason="Aucun billet digital validé ni billet physique vendu n'est remonté pour le moment."
                  remedy="Validez une commande Wave/OM en attente ou activez un billet physique depuis un guichet POS."
                  align="left"
                />
              </div>
            )}
            <SoldTicketsSection
              tickets={soldTickets}
              events={events}
              isLoading={isLoading}
              onOpenTicketModal={(tkt) => setSelectedTicketForPass(tkt)}
            />
          </div>
        );

      case 'pending_moderation':
        if (pendingEvents.length === 0) return null;
        return (
          <section className={`glass-panel rounded-3xl ${densityClasses.cardPadding} border border-white/10 space-y-4`}>
            <div className="flex items-center justify-between border-b border-white/10 pb-4 pr-24">
              <div>
                <h2 className="text-base font-heading font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                  <span>Événements en Attente de Modération ({pendingEvents.length})</span>
                </h2>
                <p className="text-xs text-[#E5E2E1] mt-0.5">
                  Vérifiez les 3 liens de paiement Wave obligatoires avant d&apos;autoriser la vente.
                </p>
              </div>

              <button
                onClick={() => onNavigateTab('moderation')}
                className="btn-gold-glow px-4 py-2 rounded-xl text-xs font-bold font-heading uppercase tracking-wider text-[#241A00] cursor-pointer"
              >
                File Complète
              </button>
            </div>

            <div className="space-y-3">
              {pendingEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="p-4 rounded-2xl bg-[#1C1B1B] border border-white/10 hover:border-white/20 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={evt.posterUrl}
                      alt={evt.title}
                      className="w-16 h-16 rounded-xl object-cover border border-white/10 flex-shrink-0"
                    />
                    <div>
                      <h3 className="font-heading font-bold text-sm text-white">{evt.title}</h3>
                      <p className="text-xs text-[#DCB8FF]">
                        Promoteur :{' '}
                        <span className="font-semibold text-white">{evt.promoter.name}</span>
                      </p>
                      <p className="text-[11px] text-gray-300 mt-1 flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-[#E9C349]" />
                        <span>
                          {evt.venue}
                          {evt.quartier ? ` (${evt.quartier})` : ''}, {evt.city}
                        </span>
                        <span>•</span>
                        <span>
                          {evt.date} à {evt.time}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-auto flex-shrink-0">
                    <button
                      onClick={() => onPreviewEvent(evt)}
                      className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-xs font-bold transition-all cursor-pointer"
                    >
                      Aperçu
                    </button>
                    <button
                      onClick={() => onRejectEvent(evt.id, 'Informations non conformes')}
                      className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer"
                    >
                      Refuser
                    </button>
                    <button
                      onClick={() => onApproveEvent(evt.id)}
                      className="px-4 py-2 rounded-xl bg-[#8A2BE2] hover:bg-[#7823c9] text-white text-xs font-bold font-heading uppercase tracking-wider transition-all shadow-md shadow-[#8A2BE2]/30 flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approuver &amp; Mettre en Vente</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
    }
  };

  return (
    <div
      className={`${densityClasses.sectionGap} pb-[calc(80px+env(safe-area-inset-bottom))] animate-in fade-in duration-300`}
    >
      {/* Notifications Toasts */}
      {actionSuccessToast && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-[#1C1B1B] border border-emerald-500 shadow-2xl text-white flex items-center gap-3 animate-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-semibold">{actionSuccessToast}</span>
        </div>
      )}

      {actionErrorToast && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-[#1C1B1B] border border-rose-500 shadow-2xl text-rose-300 flex items-center gap-3 animate-in slide-in-from-top-4 duration-300">
          <AlertCircle className="w-5 h-5 text-rose-400" />
          <span className="text-sm font-semibold">{actionErrorToast}</span>
        </div>
      )}

      {failedEmailsCount > 0 && (
        <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/40 flex items-center justify-between gap-3 text-xs text-rose-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>
              <strong>Alerte Emails Resend :</strong> {failedEmailsCount} email(s) en échec cette
              semaine.
            </span>
          </div>
        </div>
      )}

      {/* Barre de Pilotage & Personnalisation UX Command Center */}
      <div className="glass-panel rounded-2xl px-4 py-3 border border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#E9C349]" />
            <span>Super Admin Command Center</span>
          </h1>
          <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
            Live PostgreSQL
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sélecteur de Densité */}
          <div className="inline-flex items-center bg-[#141418] border border-white/10 rounded-xl p-0.5 text-[11px]">
            {(
              [
                { id: 'compact', label: 'Compact' },
                { id: 'normal', label: 'Normal' },
                { id: 'spacious', label: 'Spacieux' },
              ] as ReadonlyArray<{ id: AdminDensity; label: string }>
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setDensity(item.id)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  density === item.id
                    ? 'bg-[#8A2BE2] text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Toggle Contraste Élevé WCAG AAA */}
          <button
            type="button"
            onClick={() => setHighContrast(!highContrast)}
            className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
              highContrast
                ? 'bg-white text-black border-white'
                : 'bg-[#1F1F1F] text-gray-200 border-white/15 hover:border-[#E9C349]/60'
            }`}
            title="Activer / Désactiver le Mode Contraste Élevé WCAG AAA"
          >
            <Contrast className="w-3.5 h-3.5" />
            <span>{highContrast ? 'WCAG AAA' : 'Contraste'}</span>
          </button>

          {/* Réinitialiser l'ordre Drag & Drop */}
          <button
            type="button"
            onClick={resetCardOrder}
            className="px-2.5 py-1.5 rounded-xl bg-[#1F1F1F] hover:bg-[#2A2A2A] text-gray-300 hover:text-white border border-white/10 text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer"
            title="Réinitialiser l'ordre des cartes"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Réinit. ordre</span>
          </button>

          <button
            onClick={loadSupabaseData}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-xl bg-[#1F1F1F] hover:bg-[#282828] text-gray-200 hover:text-white border border-white/10 transition-all inline-flex items-center gap-1.5 text-[11px] font-bold cursor-pointer"
            title="Rafraîchir les données Supabase"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#E9C349]' : ''}`} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>

          <button
            onClick={onOpenVisitorPreview}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 text-[#E9C349] border border-[#E9C349]/40 text-[11px] font-heading font-extrabold tracking-wider uppercase transition-all inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Mode Visiteur</span>
            <ExternalLink className="w-3 h-3 opacity-70" />
          </button>
        </div>
      </div>

      {/* Sections réorganisables par Drag & Drop */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={cardOrder} strategy={verticalListSortingStrategy}>
          <div className={densityClasses.sectionGap}>
            {cardOrder.map((sectionId) => {
              const content = renderSection(sectionId);
              if (!content) return null;
              return (
                <SortableDashboardSection key={sectionId} id={sectionId}>
                  {content}
                </SortableDashboardSection>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* Modale d'inspection et téléchargement direct du Pass HD */}
      <TicketDetailModal
        ticket={selectedTicketForPass}
        isOpen={selectedTicketForPass !== null}
        onClose={() => setSelectedTicketForPass(null)}
        mode="admin"
      />
    </div>
  );
};
