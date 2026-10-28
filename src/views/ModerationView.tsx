import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Check,
  X,
  Calendar,
  MapPin,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Smartphone,
  Clock,
  User,
  Ticket,
  Copy,
  DollarSign,
  RefreshCw,
} from 'lucide-react';
import { EventItem, OrderRecord, UserTicket } from '../types';
import {
  getStoredOrders,
  fetchOrdersFromSupabase,
  confirmManualOrderAtomic,
  rejectManualOrderAtomic,
  getSupabaseClient,
  fetchFailedEmailsCountLast7Days,
} from '../services/supabase';

interface ModerationViewProps {
  events: EventItem[];
  onApproveEvent: (eventId: string) => void;
  onRejectEvent: (eventId: string, reason?: string) => void;
  onPreviewEvent: (event: EventItem) => void;
  onTicketsCreated?: (tickets: UserTicket[]) => void;
  initialTab?: 'events' | 'orders';
  onNavigateTab?: (tab: string) => void;
}

export const ModerationView: React.FC<ModerationViewProps> = ({
  events,
  onApproveEvent,
  onRejectEvent,
  onPreviewEvent,
  onTicketsCreated,
  initialTab = 'events',
  onNavigateTab,
}) => {
  const [activeTab, setActiveTab] = useState<'events' | 'orders'>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [orderFilter, setOrderFilter] = useState<'all' | 'payment_signaled' | 'pending' | 'confirmed' | 'rejected'>('all');
  const [selectedEventId, setSelectedEventId] = useState<string>('all');
  const [rejectingEvent, setRejectingEvent] = useState<EventItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('Informations de lieu incomplètes');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [failedEmailsCount, setFailedEmailsCount] = useState<number>(0);
  const [isLoadingOrders, setIsLoadingOrders] = useState<boolean>(true);

  const refreshOrders = async () => {
    setIsLoadingOrders(true);
    const { orders: dbOrders, error } = await fetchOrdersFromSupabase();
    if (error) {
      console.warn('Fallback lecture orders:', error);
      setOrders(getStoredOrders());
    } else {
      setOrders(dbOrders);
    }
    setIsLoadingOrders(false);
    fetchFailedEmailsCountLast7Days().then(setFailedEmailsCount);
  };

  useEffect(() => {
    refreshOrders();
  }, []);

  const pendingEvents = events.filter((e) => e.status === 'pending');
  const signaledOrdersCount = orders.filter((o) => o.status === 'payment_signaled').length;
  const pendingOrdersCount = orders.filter((o) => o.status === 'pending').length;

  const filteredPending = pendingEvents.filter((e) => {
    const matchesSearch =
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.promoter.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.venue.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCat = filterCategory === 'All' || e.category === filterCategory;
    return matchesSearch && matchesCat;
  });

  const filteredOrders = orders.filter((o) => {
    if (selectedEventId !== 'all' && o.eventId !== selectedEventId) return false;
    if (orderFilter !== 'all' && o.status !== orderFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.reference.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.customerPhone.toLowerCase().includes(q) ||
      o.eventTitle.toLowerCase().includes(q) ||
      (o.organizerName && o.organizerName.toLowerCase().includes(q)) ||
      (o.paymentReference && o.paymentReference.toLowerCase().includes(q))
    );
  });

  const handleApprove = (e: React.MouseEvent, event: EventItem) => {
    e.stopPropagation();
    onApproveEvent(event.id);
    setToastMessage(`L’événement "${event.title}" a été approuvé et publié !`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleConfirmReject = () => {
    if (!rejectingEvent) return;
    onRejectEvent(rejectingEvent.id, rejectionReason);
    setToastMessage(`L’événement "${rejectingEvent.title}" a été rejeté.`);
    setRejectingEvent(null);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Confirmation administrative atomique d'un paiement Wave/OM
  const handleConfirmPayment = async (order: OrderRecord) => {
    setProcessingOrderId(order.id);
    try {
      const matchedEvent = events.find((e) => e.id === order.eventId);
      const res = await confirmManualOrderAtomic(order.id, matchedEvent);

      if (!res.success) {
        setToastMessage(`Erreur: ${res.message}`);
      } else {
        refreshOrders();
        if (res.tickets && onTicketsCreated) {
          onTicketsCreated(res.tickets);
        }
        const supabase = getSupabaseClient();
        const clientEmail = (order as any).customerEmail || (order as any).customer_email;
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
        setToastMessage(`Paiement validé pour ${order.customerName} : ${order.quantity} billet(s) émis.`);
      }
    } catch (err: any) {
      setToastMessage(`Erreur: ${err.message}`);
    } finally {
      setProcessingOrderId(null);
      setTimeout(() => setToastMessage(null), 4000);
    }
  };

  // Rejet administratif d'un paiement
  const handleRejectPayment = async (order: OrderRecord) => {
    const targetId = order.id || order.reference;
    setProcessingOrderId(targetId);
    try {
      const res = await rejectManualOrderAtomic(targetId, 'Transfert non reçu ou montant erroné');
      await refreshOrders();
      setToastMessage(res.message);
    } catch (err: any) {
      setToastMessage(`Erreur: ${err.message}`);
    } finally {
      setProcessingOrderId(null);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">
      {/* Toast alert */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-[#1C1B1B] border border-[#8A2BE2] shadow-2xl text-white flex items-center gap-3 animate-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Hub de Modération & Encaissements
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Validation des événements et vérification manuelle des transferts Wave / Orange Money
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-2 bg-[#1C1B1B] p-1 rounded-2xl border border-white/10 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'orders'
                ? 'bg-[#8A2BE2] text-white shadow-lg shadow-[#8A2BE2]/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Paiements Wave/OM</span>
            {signaledOrdersCount > 0 && (
              <span className="bg-[#E9C349] text-[#241A00] text-[10px] font-black px-1.5 py-0.2 rounded-full">
                {signaledOrdersCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('events')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'events'
                ? 'bg-[#8A2BE2] text-white shadow-lg shadow-[#8A2BE2]/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Événements ({pendingEvents.length})</span>
          </button>
        </div>
      </div>

      {/* VUE 1 : VÉRIFICATION DES COMMANDES ET PAIEMENTS MANUELS */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Sélecteur Déroulant Événements (Spécification ThièsDN Soft Delete & Comptabilité) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#141414] rounded-2xl border border-white/10 shadow-lg">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs text-gray-300 font-extrabold flex items-center gap-1.5 whitespace-nowrap">
                <Filter className="w-3.5 h-3.5 text-[#8A2BE2]" />
                Filtrer par Événement :
              </span>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="bg-[#1C1B1B] border border-white/15 text-white text-xs rounded-xl px-3.5 py-2 outline-none focus:border-[#8A2BE2] font-semibold"
              >
                <option value="all">Tous les événements</option>
                {events.map((evt) => {
                  const isArchived = evt.status === 'archived' || evt.status?.toUpperCase() === 'ARCHIVED' || evt.isDeleted || Boolean(evt.deletedAt);
                  return (
                    <option key={evt.id} value={evt.id}>
                      {isArchived ? `📦 [Archivé] ${evt.title}` : `🎟️ ${evt.title}`}
                    </option>
                  );
                })}
              </select>
            </div>
            {selectedEventId !== 'all' && (
              <span className="text-xs text-[#E9C349] font-medium bg-[#E9C349]/10 px-3 py-1 rounded-lg border border-[#E9C349]/20 self-start sm:self-auto">
                {filteredOrders.length} commande(s) filtrée(s)
              </span>
            )}
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-[#1C1B1B] rounded-2xl border border-white/5">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'all', label: 'Toutes les commandes' },
                { id: 'pending', label: 'En attente Wave', badge: pendingOrdersCount, badgeColor: 'bg-[#1DC3F4] text-black font-extrabold' },
                { id: 'payment_signaled', label: 'Signalées', badge: signaledOrdersCount, badgeColor: 'bg-amber-400 text-black' },
                { id: 'confirmed', label: 'Confirmées (Billets émis)' },
                { id: 'rejected', label: 'Rejetées' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setOrderFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    orderFilter === f.id
                      ? 'bg-[#8A2BE2]/30 text-[#DCB8FF] border border-[#8A2BE2]/50'
                      : 'text-gray-400 hover:text-white bg-black/30'
                  }`}
                >
                  <span>{f.label}</span>
                  {f.badge !== undefined && f.badge > 0 && (
                    <span className={`text-[10px] font-black px-1.5 rounded-full ${f.badgeColor}`}>
                      {f.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={refreshOrders}
              className="px-3 py-1.5 rounded-xl bg-white/5 text-gray-300 hover:text-white text-xs font-medium"
            >
              Actualiser
            </button>
          </div>

          {/* Guide Validation Wave Business */}
          {failedEmailsCount > 0 && (
            <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/40 flex items-center justify-between gap-3 text-xs text-rose-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  <strong>Traçabilité Emails (Resend) :</strong> {failedEmailsCount} email(s) en échec cette semaine.
                </span>
              </div>
            </div>
          )}
          <div className="p-4 rounded-2xl bg-[#1DC3F4]/10 border border-[#1DC3F4]/25 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-5 h-5 text-[#1DC3F4] shrink-0" />
              <p className="text-gray-300">
                <strong className="text-white">Validation Wave Business :</strong> Vérifiez sur votre application Wave la réception du montant exact, puis cliquez sur <span className="text-emerald-400 font-bold">"Valider & Émettre"</span> pour générer le pass QR Code du client.
              </p>
            </div>
            <span className="text-[10px] uppercase font-bold text-[#1DC3F4] bg-[#1DC3F4]/15 px-2.5 py-1 rounded-full border border-[#1DC3F4]/30 shrink-0 hidden sm:inline-block">
              Zéro Faux Billet
            </span>
          </div>

          {/* Orders List */}
          {isLoadingOrders ? (
            <div className="glass-panel p-12 rounded-3xl text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-[#E9C349] animate-spin mx-auto" />
              <p className="text-xs text-gray-400">Synchronisation des commandes avec Supabase...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="glass-panel p-12 rounded-3xl text-center space-y-3">
              <Smartphone className="w-10 h-10 text-gray-600 mx-auto" />
              <h3 className="font-heading text-base font-bold text-white">
                Aucune commande dans cette catégorie
              </h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Les commandes passées par les clients via Wave ou Orange Money apparaîtront ici pour vérification.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const isSignaled = order.status === 'payment_signaled';
                const isConfirmed = order.status === 'confirmed';
                const isRejected = order.status === 'rejected';

                return (
                  <div
                    key={order.id}
                    className={`p-5 rounded-2xl border transition-all ${
                      isSignaled
                        ? 'bg-[#241A00]/40 border-[#E9C349]/50 shadow-lg shadow-[#E9C349]/10'
                        : isConfirmed
                        ? 'bg-[#181818] border-emerald-500/30'
                        : isRejected
                        ? 'bg-[#181818] border-rose-500/20 opacity-70'
                        : 'bg-[#181818] border-white/5'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Info */}
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-extrabold text-[#E9C349] bg-[#E9C349]/10 px-2 py-0.5 rounded">
                            {order.reference}
                          </span>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            isSignaled
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : isConfirmed
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : isRejected
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                          }`}>
                            {isSignaled ? 'Virement Signalé' : isConfirmed ? 'Confirmé' : isRejected ? 'Rejeté' : 'En attente Wave'}
                          </span>
                          <span className="text-[11px] text-gray-400">
                            {new Date(order.createdAt).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-heading font-bold text-white text-base">
                            {order.eventTitle}
                          </h3>
                          {(() => {
                            const matchedEvt = events.find((e) => e.id === order.eventId);
                            const isArchived = matchedEvt?.status === 'archived' || matchedEvt?.status?.toUpperCase() === 'ARCHIVED' || matchedEvt?.isDeleted || Boolean(matchedEvt?.deletedAt);
                            return isArchived ? (
                              <span className="text-[10px] bg-slate-700/60 text-slate-300 font-bold px-2 py-0.5 rounded-full border border-slate-600">
                                📦 Événement Archivé
                              </span>
                            ) : null;
                          })()}
                        </div>
                        {order.organizerName && (
                          <p className="text-[11px] text-[#DCB8FF] font-medium">
                            Organisateur : {order.organizerName}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-gray-300">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-[#DCB8FF]" />
                            {order.customerName} ({order.customerPhone})
                          </span>
                          <span className="flex items-center gap-1 text-[#E9C349]">
                            <Ticket className="w-3.5 h-3.5" />
                            {order.tierName} • {order.quantity} place(s)
                          </span>
                          <span className="flex items-center gap-1">
                            <Smartphone className="w-3.5 h-3.5 text-sky-400" />
                            Moyen : <strong className="uppercase">{order.paymentMethod}</strong>
                          </span>
                        </div>

                        {/* Référence client déclarée */}
                        {order.paymentReference && (
                          <div className="mt-2 p-2.5 rounded-xl bg-black/50 border border-white/5 text-xs flex items-center justify-between">
                            <span className="text-gray-400">
                              Réf. transaction déclarée par le client : <strong className="text-white font-mono">{order.paymentReference}</strong>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right: Amount & Action */}
                      <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-white/10">
                        <div className="text-left lg:text-right">
                          <span className="text-[10px] uppercase font-bold text-gray-400 block">
                            Montant perçu (TTC)
                          </span>
                          <span className="font-heading font-extrabold text-xl text-[#E9C349] tabular-nums">
                            {order.totalAmount.toLocaleString('fr-FR')} FCFA
                          </span>
                        </div>

                        {/* Actions pour l'administrateur */}
                        {order.status !== 'confirmed' && order.status !== 'rejected' && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleConfirmPayment(order)}
                              disabled={processingOrderId === order.id}
                              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-emerald-900/30 disabled:opacity-50"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Valider & Émettre</span>
                            </button>

                            <button
                              onClick={() => handleRejectPayment(order)}
                              disabled={processingOrderId === order.id}
                              className="px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/30 font-bold text-xs flex items-center gap-1 transition-all disabled:opacity-50"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Rejeter</span>
                            </button>
                          </div>
                        )}

                        {isConfirmed && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-4 h-4" /> Billets délivrés
                            </span>
                            {(() => {
                              const cleanPhone = order.customerPhone ? order.customerPhone.replace(/[^0-9]/g, '') : '';
                              if (!cleanPhone) return null;
                              const waPhone = cleanPhone.startsWith('221') ? cleanPhone : `221${cleanPhone}`;
                              const origin = typeof window !== 'undefined' ? window.location.origin : 'https://billetterie.thiesdn.site';
                              const ticketUrl = `${origin}/?ref=${order.reference}#tickets`;
                              const waText = encodeURIComponent(
                                `Bonjour ${order.customerName} ! Votre commande pour "${order.eventTitle}" (${order.tierName}) a été validée avec succès par Thièsdn Billetterie.\n\n` +
                                `🎫 Référence : ${order.reference}\n` +
                                `🎟️ Vos billets officiels sont accessibles ici : ${ticketUrl}\n\n` +
                                `Présentez votre QR Code à l'entrée de l'événement. Bon spectacle !`
                              );
                              return (
                                <a
                                  href={`https://wa.me/${waPhone}?text=${waText}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1 transition-all"
                                  title="Envoyer le lien des billets par WhatsApp"
                                >
                                  <span>💬 WhatsApp</span>
                                </a>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VUE 2 : MODÉRATION DES ÉVÉNEMENTS */}
      {activeTab === 'events' && (
        <>
          {/* Actions & Filters Header */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#1C1B1B] p-4 rounded-2xl border border-white/5">
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un événement, lieu ou promoteur..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#141414] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#8A2BE2]"
              />
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {['All', 'Concert', 'Boîte de nuit', 'Gala', 'Festival'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                    filterCategory === cat
                      ? 'bg-[#8A2BE2] text-white'
                      : 'bg-[#141414] text-gray-400 hover:text-white border border-white/5'
                  }`}
                >
                  {cat === 'All' ? 'Tous' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Pending Events List */}
          {filteredPending.length === 0 ? (
            <div className="glass-panel p-12 rounded-3xl text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-heading text-lg font-bold text-white">
                  File de modération vide
                </h3>
                <p className="text-xs text-gray-300 mt-2 max-w-md mx-auto leading-relaxed">
                  Aucun événement en attente de validation. Tous vos événements sont visibles dans <span className="text-[#E9C349] font-bold">"Gestion des Événements"</span>.
                </p>
                {onNavigateTab && (
                  <button
                    onClick={() => onNavigateTab('events_mgmt')}
                    className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#8A2BE2] to-[#B8860B] hover:opacity-90 text-white font-bold text-xs shadow-lg transition-all"
                  >
                    <span>Accéder à la Gestion des Événements</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredPending.map((event) => (
                <div
                  key={event.id}
                  onClick={() => onPreviewEvent(event)}
                  className="glass-panel rounded-3xl p-5 border border-white/10 hover:border-[#8A2BE2]/50 transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {/* Header with image */}
                    <div className="flex gap-4">
                      <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0 relative">
                        <img
                          src={event.posterUrl}
                          alt={event.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <span className="absolute top-1 left-1 bg-[#8A2BE2] text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                          {event.category}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-heading font-bold text-white text-base leading-snug truncate">
                          {event.title}
                        </h3>
                        <p className="text-xs text-[#E9C349] font-medium mt-1">
                          {event.venue}, {event.city}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span>{event.date} • {event.time}</span>
                        </p>
                      </div>
                    </div>

                    {/* Promoter & Pricing info */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5 text-xs">
                      <div>
                        <span className="text-[10px] text-gray-400 block">Promoteur :</span>
                        <strong className="text-white">{event.promoter.name}</strong>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-gray-400 block">Prix de base :</span>
                        <strong className="text-[#E9C349] font-bold">{event.price.toLocaleString('fr-FR')} FCFA</strong>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-4 mt-4 border-t border-white/10">
                    <button
                      onClick={(e) => handleApprove(e, event)}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-900/30"
                    >
                      <Check className="w-4 h-4" />
                      <span>Approuver</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRejectingEvent(event);
                      }}
                      className="py-2.5 px-4 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/30 font-bold text-xs flex items-center justify-center gap-1 transition-all"
                    >
                      <X className="w-4 h-4" />
                      <span>Rejeter</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Reject Reason Modal */}
      {rejectingEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1C1B1B] border border-white/10 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-heading font-bold text-base text-white">
                Rejeter l'événement
              </h3>
            </div>
            <p className="text-xs text-gray-300">
              Veuillez spécifier le motif du rejet pour "{rejectingEvent.title}". Ce motif sera transmis au promoteur.
            </p>

            <div className="space-y-2">
              {[
                'Informations de lieu ou date incomplètes',
                'Affiche non conforme ou de mauvaise qualité',
                'Tarification ou contact promoteur manquant',
                'Événement non autorisé sur la plateforme',
              ].map((reason) => (
                <label
                  key={reason}
                  onClick={() => setRejectionReason(reason)}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer text-xs ${
                    rejectionReason === reason
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                      : 'bg-black/40 border-white/5 text-gray-400 hover:text-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="rejectionReason"
                    checked={rejectionReason === reason}
                    onChange={() => setRejectionReason(reason)}
                    className="text-rose-500 focus:ring-0"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setRejectingEvent(null)}
                className="px-4 py-2 rounded-xl text-xs text-gray-400 hover:text-white"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-900/30"
              >
                Confirmer le Rejet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

