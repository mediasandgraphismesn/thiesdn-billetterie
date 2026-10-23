import React, { useState, useEffect } from 'react';
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
  TrendingUp,
  MapPin,
  Sparkles,
  ArrowRight,
  CreditCard,
  Users,
  Wallet,
  QrCode,
  Settings,
} from 'lucide-react';
import { EventItem, OrderRecord, UserProfile, UserTicket } from '../types';
import {
  fetchOrdersFromSupabase,
  getStoredOrders,
  confirmManualOrderAtomic,
  rejectManualOrderAtomic,
  fetchEventsFromSupabase,
  fetchAllProfilesFromSupabase,
  getSupabaseClient,
} from '../services/supabase';
import { StatsCard } from '../components/admin/StatsCard';
import { OrdersTable } from '../components/admin/OrdersTable';

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
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [events, setEvents] = useState<EventItem[]>(propEvents);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionSuccessToast, setActionSuccessToast] = useState<string | null>(null);
  const [actionErrorToast, setActionErrorToast] = useState<string | null>(null);
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

  /**
   * Chargement direct de TOUTES les données réelles depuis Supabase
   * - Table `orders` : TOUTES les commandes (tous les événements)
   * - Table `events` : TOUS les événements créés
   * - Table `profiles` : TOUS les utilisateurs enregistrés
   */
  const loadSupabaseData = async () => {
    setIsLoading(true);
    setActionErrorToast(null);

    try {
      const [{ orders: dbOrders, error: ordersErr }, { events: dbEvents, error: eventsErr }, { profiles: dbProfiles }] =
        await Promise.all([
          fetchOrdersFromSupabase(),
          fetchEventsFromSupabase(),
          fetchAllProfilesFromSupabase(),
        ]);

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
    } catch (err: any) {
      console.error('Erreur chargement Supabase AdminDashboard :', err);
      setActionErrorToast(err.message || 'Erreur lors de la lecture des tables Supabase.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSupabaseData();
  }, []);

  // Synchronisation si les props d'événements changent
  useEffect(() => {
    if (propEvents.length > 0) {
      setEvents(propEvents);
    }
  }, [propEvents]);

  // Statistiques en temps réel calculées sur la totalité des données
  const approvedEventsCount = events.filter((e) => e.status === 'approved').length;
  const pendingEvents = events.filter((e) => e.status === 'pending');
  const pendingEventsCount = pendingEvents.length;

  const confirmedOrders = orders.filter((o) => o.status === 'confirmed');
  const pendingOrders = orders.filter(
    (o) => o.status === 'pending' || o.status === 'payment_signaled'
  );
  const pendingOrdersCount = pendingOrders.length;

  // Billets vendus calculés
  const totalTicketsSold = confirmedOrders.reduce((sum, o) => sum + (o.quantity || 1), 0);

  // Chiffre d'Affaires Global en FCFA
  const totalRevenue = confirmedOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const platformCommission10 = Math.round(totalRevenue * 0.10);
  const promotersShare90 = totalRevenue - platformCommission10;

  // Actions atomiques de validation de commande
  const handleConfirmOrder = async (order: OrderRecord) => {
    setProcessingOrderId(order.id);
    try {
      const targetEvent = events.find((e) => e.id === order.eventId);
      const result = await confirmManualOrderAtomic(order.id, targetEvent, 'admin-super');

      if (result.success && result.tickets) {
        if (onTicketsCreated) {
          onTicketsCreated(result.tickets);
        }
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? { ...o, status: 'confirmed' } : o))
        );
        setActionSuccessToast(`Paiement de ${order.customerName} validé ! ${result.tickets.length} billet(s) émis.`);
        setTimeout(() => setActionSuccessToast(null), 4000);
      } else {
        setActionErrorToast(result.message || 'Impossible de confirmer cette commande.');
        setTimeout(() => setActionErrorToast(null), 4000);
      }
    } catch (err: any) {
      setActionErrorToast(err.message || 'Erreur réseau lors de la validation.');
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
    } catch (err: any) {
      setActionErrorToast(err.message || 'Erreur lors du rejet.');
      setTimeout(() => setActionErrorToast(null), 3000);
    } finally {
      setProcessingOrderId(null);
    }
  };

  return (
    <div className="space-y-8 pb-16 animate-in fade-in duration-300">
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

      {/* Header Back-Office Super Admin */}
      <section className="glass-panel rounded-3xl p-6 sm:p-8 relative overflow-hidden border border-[#8A2BE2]/30 shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-[#8A2BE2]/20 via-[#E9C349]/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="bg-[#8A2BE2]/20 text-[#DCB8FF] border border-[#8A2BE2]/40 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                <ShieldCheck className="w-3.5 h-3.5 text-[#E9C349]" />
                Console Supabase Active
              </span>
              <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live PostgreSQL
              </span>
            </div>

            <h1 className="font-heading text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Tableau de Bord Super Admin
            </h1>
            <p className="text-sm text-[#CFC2D7] max-w-2xl">
              Console centrale de gestion multi-événements connectée à Supabase. Validation des paiements Wave/OM, encaissements et audit des billets pour tout le Sénégal.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={loadSupabaseData}
              disabled={isLoading}
              className="p-3 rounded-xl bg-[#1F1F1F] hover:bg-[#282828] text-gray-300 hover:text-white border border-white/10 transition-all flex items-center gap-2 text-xs font-bold"
              title="Rafraîchir les données de Supabase"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#E9C349]' : ''}`} />
              <span className="hidden sm:inline">Actualiser Supabase</span>
            </button>

            <button
              onClick={onOpenVisitorPreview}
              className="px-4 py-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 text-[#E9C349] border border-[#E9C349]/40 text-xs font-heading font-extrabold tracking-wider uppercase transition-all flex items-center gap-2 shadow-lg"
            >
              <Eye className="w-4 h-4" />
              <span>Mode Visiteur (Tester Public)</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </button>
          </div>
        </div>
      </section>

      {/* 4 CARTES DE STATISTIQUES GLOBALES (StatsCard Component) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatsCard
          title="Événements"
          value={events.length}
          subtitle={`${approvedEventsCount} approuvés • ${pendingEventsCount} en attente`}
          icon={Calendar}
          glowColor="purple"
          onClick={() => onNavigateTab('moderation')}
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
          subtitle={pendingOrdersCount > 0 ? 'Paiements Wave/OM en attente' : 'Toutes les commandes sont à jour'}
          icon={Clock}
          glowColor="rose"
          alert={pendingOrdersCount > 0}
          onClick={() => onNavigateTab('orders')}
        />
      </section>

      {/* MODULES DE GESTION RAPIDE SUPER ADMIN */}
      <section className="glass-panel p-6 rounded-3xl border border-white/10 space-y-4">
        <h2 className="text-base font-heading font-bold text-[#E9C349] flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#8A2BE2]" />
          <span>Accès Direct aux Modules de Gestion</span>
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => onNavigateTab('moderation')}
            className="p-4 rounded-2xl bg-[#1C1B1B] hover:bg-[#252427] border border-white/5 hover:border-[#8A2BE2]/50 transition-all flex flex-col items-center text-center gap-2 group"
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
            <span className="text-[10px] text-gray-400">{pendingEventsCount} en attente</span>
          </button>

          <button
            onClick={() => onNavigateTab('orders')}
            className="p-4 rounded-2xl bg-[#1C1B1B] hover:bg-[#252427] border border-white/5 hover:border-[#E9C349]/50 transition-all flex flex-col items-center text-center gap-2 group"
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
            <span className="text-[10px] text-gray-400">{pendingOrdersCount} à vérifier</span>
          </button>

          <button
            onClick={() => onNavigateTab('users')}
            className="p-4 rounded-2xl bg-[#1C1B1B] hover:bg-[#252427] border border-white/5 hover:border-[#8A2BE2]/50 transition-all flex flex-col items-center text-center gap-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-white">Gestion Utilisateurs</span>
            <span className="text-[10px] text-gray-400">{profiles.length || 'Comptes'} inscrits</span>
          </button>

          <button
            onClick={() => onNavigateTab('finances')}
            className="p-4 rounded-2xl bg-[#1C1B1B] hover:bg-[#252427] border border-white/5 hover:border-emerald-500/50 transition-all flex flex-col items-center text-center gap-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Wallet className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-white">Finances & CA</span>
            <span className="text-[10px] text-gray-400">{totalRevenue.toLocaleString('fr-FR')} F</span>
          </button>

          <button
            onClick={() => onNavigateTab('checkin')}
            className="p-4 rounded-2xl bg-[#1C1B1B] hover:bg-[#252427] border border-white/5 hover:border-[#8A2BE2]/50 transition-all flex flex-col items-center text-center gap-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <QrCode className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-white">Scanner d'Accès</span>
            <span className="text-[10px] text-gray-400">Guichet QR Code</span>
          </button>

          <button
            onClick={() => onNavigateTab('settings')}
            className="p-4 rounded-2xl bg-[#1C1B1B] hover:bg-[#252427] border border-white/5 hover:border-white/20 transition-all flex flex-col items-center text-center gap-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-gray-500/20 text-gray-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Settings className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-white">Paramètres</span>
            <span className="text-[10px] text-gray-400">Configuration</span>
          </button>
        </div>
      </section>

      {/* SECTION PRINCIPALE : TABLE DE TOUTES LES COMMANDES SUPABASE (OrdersTable Component) */}
      <section className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-heading font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#E9C349]" />
              <span>Toutes les Commandes de la Table `orders` ({orders.length})</span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Historique complet de toutes les commandes enregistrées dans Supabase pour l'ensemble des événements.
            </p>
          </div>

          <button
            onClick={() => onNavigateTab('orders')}
            className="btn-primary-glow px-4 py-2 rounded-xl text-xs font-bold font-heading uppercase tracking-wider flex items-center gap-1.5 self-start sm:self-auto"
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

      {/* SECTION SECONDAIRE : ÉVÉNEMENTS EN ATTENTE DE MODÉRATION */}
      {pendingEvents.length > 0 && (
        <section className="glass-panel rounded-3xl p-6 border border-white/10 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h2 className="text-base font-heading font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-400" />
                <span>Événements en Attente de Modération ({pendingEvents.length})</span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Vérifiez les 3 liens de paiement Wave obligatoires avant d'autoriser la vente.
              </p>
            </div>

            <button
              onClick={() => onNavigateTab('moderation')}
              className="btn-gold-glow px-4 py-2 rounded-xl text-xs font-bold font-heading uppercase tracking-wider text-[#241A00]"
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
                    <h3 className="font-heading font-bold text-sm text-white">
                      {evt.title}
                    </h3>
                    <p className="text-xs text-[#DCB8FF]">
                      Promoteur : <span className="font-semibold text-white">{evt.promoter.name}</span>
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-[#E9C349]" />
                      <span>{evt.venue}{evt.quartier ? ` (${evt.quartier})` : ''}, {evt.city}</span>
                      <span>•</span>
                      <span>{evt.date} à {evt.time}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-auto flex-shrink-0">
                  <button
                    onClick={() => onPreviewEvent(evt)}
                    className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-xs font-bold transition-all"
                  >
                    Aperçu
                  </button>
                  <button
                    onClick={() => onRejectEvent(evt.id, 'Informations non conformes')}
                    className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all"
                  >
                    Refuser
                  </button>
                  <button
                    onClick={() => onApproveEvent(evt.id)}
                    className="px-4 py-2 rounded-xl bg-[#8A2BE2] hover:bg-[#7823c9] text-white text-xs font-bold font-heading uppercase tracking-wider transition-all shadow-md shadow-[#8A2BE2]/30 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approuver & Mettre en Vente</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
