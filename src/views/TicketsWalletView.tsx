import React, { useState, useEffect } from 'react';
import {
  Ticket,
  QrCode,
  Calendar,
  MapPin,
  ShieldCheck,
  ArrowRight,
  Clock,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Copy,
  Youtube,
  BadgeCheck,
  ExternalLink,
  Film,
  Play,
  History,
  UserPlus,
  UserCheck,
  MessageSquare,
  RotateCcw,
  User,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { UserTicket, OrderRecord } from '../types';
import { getStoredOrders, fetchOrdersFromSupabase, cancelTicketAssignment } from '../services/supabase';
import { AddToCalendarButton } from '../components/AddToCalendarButton';
import { AssignTicketModal } from '../components/AssignTicketModal';
import { SafeImage } from '../components/SafeImage';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';

interface TicketsWalletViewProps {
  tickets: UserTicket[];
  userId?: string;
  userName?: string;
  onOpenPass: (ticket: UserTicket) => void;
  onExploreEvents: () => void;
  onTicketUpdated?: (ticket: UserTicket) => void;
  orderFilter?: string | null;
  onClearOrderFilter?: () => void;
}

export const TicketsWalletView: React.FC<TicketsWalletViewProps> = ({
  tickets,
  userId,
  userName = 'Moi',
  onOpenPass,
  onExploreEvents,
  onTicketUpdated,
  orderFilter = null,
  onClearOrderFilter,
}) => {
  const [activeTab, setActiveTab] = useState<'tickets' | 'orders'>('tickets');
  const [ticketFilter, setTicketFilter] = useState<'upcoming' | 'past'>('upcoming');
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [selectedTicketForAssign, setSelectedTicketForAssign] = useState<UserTicket | null>(null);
  const [cancellingTicketId, setCancellingTicketId] = useState<string | null>(null);
  const [upcomingPage, setUpcomingPage] = useState<number>(1);
  const [pastPage, setPastPage] = useState<number>(1);
  const WALLET_PAGE_SIZE = 25;

  useEffect(() => {
    setUpcomingPage(1);
    setPastPage(1);
  }, [tickets.length, orderFilter, ticketFilter]);

  useEffect(() => {
    fetchOrdersFromSupabase(userId ? { userId } : undefined).then((res) => {
      if (res.orders && res.orders.length > 0) {
        setOrders(res.orders);
      } else {
        setOrders(getStoredOrders());
      }
    });
  }, [userId]);

  const handleCancelAssignment = async (ticketId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Voulez-vous annuler l’assignation de ce billet ? Il redeviendra disponible dans votre portefeuille.')) {
      return;
    }
    setCancellingTicketId(ticketId);
    try {
      const res = await cancelTicketAssignment(ticketId);
      if (res.success && res.ticket && onTicketUpdated) {
        onTicketUpdated(res.ticket);
      }
    } catch (err: any) {
      alert(err.message || 'Erreur.');
    } finally {
      setCancellingTicketId(null);
    }
  };

  // Détection des événements passés vs à venir
  const isTicketPast = (ticket: UserTicket): boolean => {
    if (ticket.status === 'used') return true;
    if (!ticket.eventDate) return false;
    try {
      const monthsMap: Record<string, number> = {
        janvier: 0, février: 1, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5,
        juillet: 6, août: 7, aout: 7, septembre: 8, octobre: 9, novembre: 10, décembre: 11, decembre: 11,
      };
      const parts = ticket.eventDate.toLowerCase().split(' ');
      if (parts.length >= 3) {
        const day = parseInt(parts[0], 10);
        const month = monthsMap[parts[1]] ?? -1;
        const year = parseInt(parts[2], 10);
        if (!isNaN(day) && month !== -1 && !isNaN(year)) {
          const eventDateObj = new Date(year, month, day, 23, 59, 59);
          return eventDateObj.getTime() < Date.now();
        }
      }
      const parsed = new Date(ticket.eventDate);
      if (!isNaN(parsed.getTime())) {
        return parsed.getTime() < Date.now();
      }
    } catch {
      // repli
    }
    return false;
  };

  const filteredByOrderTickets = orderFilter
    ? tickets.filter((t) => t.qrCode?.includes(orderFilter) || orders.some((o) => o.reference === orderFilter && o.eventId === t.eventId) || tickets.length > 0)
    : tickets;
  const upcomingTickets = filteredByOrderTickets.filter((t) => !isTicketPast(t));
  const pastTickets = tickets.filter((t) => isTicketPast(t));

  const upcomingTotalPages = Math.max(1, Math.ceil(upcomingTickets.length / WALLET_PAGE_SIZE));
  const safeUpcomingPage = Math.min(upcomingPage, upcomingTotalPages);
  const paginatedUpcomingTickets = upcomingTickets.slice(
    (safeUpcomingPage - 1) * WALLET_PAGE_SIZE,
    safeUpcomingPage * WALLET_PAGE_SIZE
  );

  const pastTotalPages = Math.max(1, Math.ceil(pastTickets.length / WALLET_PAGE_SIZE));
  const safePastPage = Math.min(pastPage, pastTotalPages);
  const paginatedPastTickets = pastTickets.slice(
    (safePastPage - 1) * WALLET_PAGE_SIZE,
    safePastPage * WALLET_PAGE_SIZE
  );

  const getTicketStatusMeta = (ticket: UserTicket) => {
    if (ticket.status === 'used' || ticket.status === 'scanned') {
      return { label: 'Scanné', className: 'bg-blue-500/15 text-blue-300 border-blue-500/30' };
    }
    if (ticket.status === 'cancelled') {
      return { label: 'Annulé', className: 'bg-red-500/15 text-red-300 border-red-500/30' };
    }
    if (ticket.status === 'pending' || ticket.status === 'payment_signaled') {
      return { label: 'Paiement en vérif.', className: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    }
    if (ticket.assignmentStatus === 'pending') {
      return { label: "En attente d'acceptation", className: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
    }
    if (ticket.assignmentStatus === 'accepted') {
      return { label: 'Transféré', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
    }
    return { label: 'Valide', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
  };

  const pendingOrders = orders.filter((o) => o.status === 'pending' || o.status === 'payment_signaled');

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Portefeuille Billets & Commandes
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Retrouvez tous vos accès exclusifs, pass VIP et suivi de vos paiements Wave/OM
          </p>
        </div>

        {/* Tab switch between tickets and orders */}
        <div className="flex bg-[#1C1B1B] p-1 rounded-2xl border border-white/10 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('tickets')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'tickets' ? 'bg-[#8A2BE2] text-white shadow-md' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Ticket className="w-3.5 h-3.5" />
            <span>Pass Valides ({tickets.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('orders')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'orders' ? 'bg-[#8A2BE2] text-white shadow-md' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Commandes ({orders.length})</span>
            {pendingOrders.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* ONGLET 1 : BILLETS CONFIRMÉS */}
      {orderFilter && (
        <div className="p-3.5 rounded-2xl bg-[#8A2BE2]/15 border border-[#8A2BE2]/40 flex items-center justify-between gap-3 text-xs text-white">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#E9C349] shrink-0" />
            <span>
              Affichage des billets de votre commande <strong className="font-mono text-[#E9C349]">{orderFilter}</strong>
            </span>
          </div>
          {onClearOrderFilter && (
            <button
              type="button"
              onClick={onClearOrderFilter}
              className="text-[11px] font-bold text-[#DCB8FF] hover:underline"
            >
              Voir tout le portefeuille
            </button>
          )}
        </div>
      )}
      {activeTab === 'tickets' && (
        <div className="space-y-4">
          {/* Sous-filtre : À venir vs Passés & Souvenirs */}
          <div className="flex items-center gap-2 pb-1">
            <button
              type="button"
              onClick={() => setTicketFilter('upcoming')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                ticketFilter === 'upcoming'
                  ? 'bg-[#E9C349] text-[#241A00] shadow-md shadow-[#E9C349]/20'
                  : 'bg-[#181818] text-gray-400 hover:text-white border border-white/5'
              }`}
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>À venir ({upcomingTickets.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setTicketFilter('past')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                ticketFilter === 'past'
                  ? 'bg-[#8A2BE2] text-white shadow-md shadow-[#8A2BE2]/20'
                  : 'bg-[#181818] text-gray-400 hover:text-white border border-white/5'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Passés & Souvenirs ({pastTickets.length})</span>
            </button>
          </div>

          {/* CAS 1 : BILLETS À VENIR */}
          {ticketFilter === 'upcoming' && (
            <>
              {upcomingTickets.length === 0 ? (
                <div className="glass-panel p-12 rounded-3xl text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-[#8A2BE2]/10 text-[#DCB8FF] flex items-center justify-center mx-auto border border-[#8A2BE2]/30">
                    <Ticket className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="font-heading text-lg font-bold text-white">
                      Aucun billet à venir dans votre portefeuille
                    </h3>
                    <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                      Réservez vos places pour les meilleures soirées et galas exclusifs de Thiès, Saly et Mbour.
                    </p>
                  </div>
                  <button
                    onClick={onExploreEvents}
                    className="btn-primary-glow py-3 px-6 rounded-xl text-xs font-heading font-extrabold tracking-wider uppercase inline-flex items-center gap-2"
                  >
                    <span>Explorer les Soirées</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {paginatedUpcomingTickets.map((ticket) => {
                    const statusMeta = getTicketStatusMeta(ticket);

                    return (
                      <div
                        key={ticket.id}
                        onClick={() => onOpenPass(ticket)}
                        className="p-3 sm:p-3.5 rounded-2xl bg-[#161616] border border-white/10 hover:border-[#8A2BE2] transition-all cursor-pointer group flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-[#141414] border border-white/10">
                            <SafeImage
                              src={getOptimizedImageUrl(ticket.eventPoster, 200)}
                              rawSrc={ticket.eventPoster}
                              alt={ticket.eventTitle}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          </div>

                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-extrabold uppercase text-[#E9C349] tracking-wider">
                                {ticket.tierName}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusMeta.className}`}
                              >
                                {statusMeta.label}
                              </span>
                              {ticket.assignmentStatus === 'pending' && ticket.assignedToName && (
                                <span className="text-[10px] text-amber-300 truncate">
                                  → {ticket.assignedToName}
                                </span>
                              )}
                              {ticket.assignmentStatus === 'accepted' && ticket.assignedToName && (
                                <span className="text-[10px] text-emerald-300 truncate">
                                  → {ticket.assignedToName}
                                </span>
                              )}
                            </div>

                            <h3 className="font-heading text-sm sm:text-base font-bold text-white truncate group-hover:text-[#DCB8FF] transition-colors">
                              {ticket.eventTitle}
                            </h3>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-400">
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-[#DCB8FF]" />
                                {ticket.eventDate}{ticket.eventTime ? ` • ${ticket.eventTime}` : ''}
                              </span>
                              <span className="text-[11px] font-mono text-gray-500 hidden sm:inline">
                                {ticket.qrCode}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions compactes : Voir mon Pass + icônes Calendrier & Transfert */}
                        <div
                          className="flex items-center justify-end gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5 flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <AddToCalendarButton
                            eventData={{
                              title: ticket.eventTitle,
                              dateStr: ticket.eventDate,
                              timeStr: ticket.eventTime,
                              venue: ticket.eventVenue,
                              city: 'Thiès / Petite Côte',
                              tierName: ticket.tierName,
                              qrCode: ticket.qrCode,
                              holderName: ticket.holderName,
                              ticketUrl:
                                typeof window !== 'undefined'
                                  ? window.location.href
                                  : 'https://billetterie.thiesdn.site/',
                            }}
                            variant="compact"
                            iconOnly
                          />

                          {ticket.assignmentStatus === 'pending' ? (
                            <>
                              {ticket.claimToken && (
                                <a
                                  href={`https://wa.me/${ticket.assignedToPhone?.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                                    `Bonjour ${ticket.assignedToName} ! Voici votre lien officiel pour récupérer votre pass ${ticket.eventTitle} (${ticket.tierName}) : ${
                                      typeof window !== 'undefined'
                                        ? window.location.origin
                                        : 'https://billetterie.thiesdn.site'
                                    }/claim-ticket/${ticket.claimToken}`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Renvoyer le lien WhatsApp"
                                  aria-label="Renvoyer le lien WhatsApp"
                                  className="w-9 h-9 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/30 text-emerald-400 flex items-center justify-center transition-colors"
                                >
                                  <MessageSquare className="w-4 h-4" />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={(e) => handleCancelAssignment(ticket.id, e)}
                                disabled={cancellingTicketId === ticket.id}
                                title="Annuler l'assignation"
                                aria-label="Annuler l'assignation"
                                className="w-9 h-9 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 text-gray-300 hover:text-rose-300 flex items-center justify-center transition-colors"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            </>
                          ) : ticket.assignmentStatus === 'declined' ? (
                            <button
                              type="button"
                              onClick={() => setSelectedTicketForAssign(ticket)}
                              title="Réassigner ce billet"
                              aria-label="Réassigner ce billet"
                              className="w-9 h-9 rounded-xl bg-[#8A2BE2]/25 hover:bg-[#8A2BE2]/40 border border-[#8A2BE2]/40 text-[#DCB8FF] flex items-center justify-center transition-colors"
                            >
                              <UserPlus className="w-4 h-4" />
                            </button>
                          ) : ticket.assignmentStatus === 'accepted' ? (
                            <span
                              title={`Transféré à ${ticket.assignedToName || ''}`}
                              className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center"
                            >
                              <UserCheck className="w-4 h-4" />
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSelectedTicketForAssign(ticket)}
                              title="Transférer / Assigner à un ami"
                              aria-label="Transférer à un ami"
                              className="w-9 h-9 rounded-xl bg-[#E9C349]/10 hover:bg-[#E9C349]/20 border border-[#E9C349]/30 text-[#E9C349] flex items-center justify-center transition-colors"
                            >
                              <UserPlus className="w-4 h-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onOpenPass(ticket)}
                            className="btn-primary-glow px-3.5 py-2 rounded-xl text-xs font-heading font-bold flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>Voir mon Pass</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {upcomingTickets.length > WALLET_PAGE_SIZE && (
                    <div className="flex items-center justify-between pt-2 text-xs text-gray-400">
                      <span>
                        Page {safeUpcomingPage} / {upcomingTotalPages} ({upcomingTickets.length} billets)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={safeUpcomingPage <= 1}
                          onClick={() => setUpcomingPage((p) => Math.max(1, p - 1))}
                          className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/10 text-white inline-flex items-center gap-1"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          Précédent
                        </button>
                        <button
                          type="button"
                          disabled={safeUpcomingPage >= upcomingTotalPages}
                          onClick={() => setUpcomingPage((p) => Math.min(upcomingTotalPages, p + 1))}
                          className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/10 text-white inline-flex items-center gap-1"
                        >
                          Suivant
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* CAS 2 : BILLETS PASSÉS & SOUVENIRS YOUTUBE */}
          {ticketFilter === 'past' && (
            <div className="space-y-5 animate-in fade-in duration-300">
              {/* Carte Souvenirs & Aftermovies YouTube @thiesdn */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-[#1F1728] via-[#141414] to-[#1F1414] border border-[#8A2BE2]/30 shadow-2xl relative overflow-hidden space-y-3">
                <div className="absolute top-0 right-0 w-48 h-48 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
                <div className="flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-red-600/20 text-red-500 flex items-center justify-center border border-red-500/30">
                      <Youtube className="w-5 h-5 fill-current" />
                    </div>
                    <div>
                      <h4 className="font-heading font-extrabold text-base text-white">
                        Souvenirs & Aftermovies Thièsdn 🎥
                      </h4>
                      <p className="text-xs text-gray-400">
                        Revivez la magie de vos soirées passées en vidéo officielle
                      </p>
                    </div>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[#E9C349] bg-[#E9C349]/10 px-2.5 py-1 rounded-full border border-[#E9C349]/20">
                    <BadgeCheck className="w-3 h-3" /> Chaîne Officielle
                  </span>
                </div>

                <p className="text-xs text-gray-300 leading-relaxed relative z-10">
                  Chaque gala, concert et grande nuit festive thiessoise est documenté par nos équipes. Découvrez les aftermovies officiels en immersion totale, les interviews exclusives d'artistes et les coulisses de la scène culturelle sur notre chaîne YouTube.
                </p>

                <div className="pt-2 flex flex-wrap items-center gap-3 relative z-10">
                  <a
                    href="https://youtube.com/@thiesdn"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-heading font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-red-600/30 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Regarder les Aftermovies sur YouTube @thiesdn</span>
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </div>
              </div>

              {/* Liste des Billets Passés */}
              {pastTickets.length === 0 ? (
                <div className="p-8 rounded-2xl bg-[#141414] border border-white/5 text-center space-y-2">
                  <Film className="w-8 h-8 text-gray-500 mx-auto" />
                  <h4 className="font-heading font-bold text-sm text-white">
                    Aucun événement passé pour le moment
                  </h4>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">
                    Dès qu'une soirée à laquelle vous avez assisté est terminée, votre pass et son aftermovie s'archiveront automatiquement dans cette section.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {paginatedPastTickets.map((ticket) => {
                    const statusMeta = getTicketStatusMeta(ticket);

                    return (
                      <div
                        key={ticket.id}
                        onClick={() => onOpenPass(ticket)}
                        className="p-3 rounded-2xl bg-[#161616] border border-white/10 hover:border-[#8A2BE2] transition-all cursor-pointer group flex items-center justify-between gap-3 opacity-90 hover:opacity-100"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 grayscale group-hover:grayscale-0 transition-all bg-[#141414] border border-white/10">
                            <SafeImage
                              src={getOptimizedImageUrl(ticket.eventPoster, 200)}
                              rawSrc={ticket.eventPoster}
                              alt={ticket.eventTitle}
                              loading="lazy"
                              decoding="async"
                              className="w-full h-full object-cover"
                            />
                          </div>

                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold uppercase text-[#DCB8FF] truncate">
                                {ticket.tierName}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusMeta.className}`}
                              >
                                {ticket.status === 'used' || ticket.status === 'scanned' ? 'Scanné' : 'Passé'}
                              </span>
                            </div>
                            <h3 className="font-heading text-sm font-bold text-white truncate">
                              {ticket.eventTitle}
                            </h3>
                            <p className="text-xs text-gray-400 truncate">
                              {ticket.eventDate} • {ticket.eventVenue}
                            </p>
                          </div>
                        </div>

                        <div
                          className="flex items-center gap-1.5 flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <a
                            href="https://youtube.com/@thiesdn"
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Voir Aftermovie"
                            aria-label="Voir Aftermovie"
                            className="w-9 h-9 rounded-xl bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white border border-red-500/30 flex items-center justify-center transition-all"
                          >
                            <Youtube className="w-4 h-4 fill-current" />
                          </a>

                          <button
                            type="button"
                            onClick={() => onOpenPass(ticket)}
                            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>Voir mon Pass</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {pastTickets.length > WALLET_PAGE_SIZE && (
                    <div className="flex items-center justify-between pt-2 text-xs text-gray-400">
                      <span>
                        Page {safePastPage} / {pastTotalPages} ({pastTickets.length} billets)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={safePastPage <= 1}
                          onClick={() => setPastPage((p) => Math.max(1, p - 1))}
                          className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/10 text-white inline-flex items-center gap-1"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          Précédent
                        </button>
                        <button
                          type="button"
                          disabled={safePastPage >= pastTotalPages}
                          onClick={() => setPastPage((p) => Math.min(pastTotalPages, p + 1))}
                          className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/10 text-white inline-flex items-center gap-1"
                        >
                          Suivant
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ONGLET 2 : SUIVI DES COMMANDES WAVE / OM */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="glass-panel p-12 rounded-3xl text-center space-y-3">
              <Clock className="w-12 h-12 text-gray-600 mx-auto" />
              <h3 className="font-heading text-base font-bold text-white">
                Aucune commande enregistrée
              </h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto">
                Lorsque vous réservez un événement avec Wave ou Orange Money, votre suivi de commande s'affichera ici.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => {
                const isSignaled = order.status === 'payment_signaled';
                const isConfirmed = order.status === 'confirmed';
                const isRejected = order.status === 'rejected';
                const isExpired = order.status === 'expired';

                return (
                  <div
                    key={order.id}
                    className={`p-5 rounded-2xl border transition-all ${
                      isSignaled
                        ? 'bg-[#241A00]/40 border-amber-500/40'
                        : isConfirmed
                        ? 'bg-[#181818] border-emerald-500/30'
                        : isRejected
                        ? 'bg-[#181818] border-rose-500/30'
                        : isExpired
                        ? 'bg-[#181818] border-gray-600/30 opacity-75'
                        : 'bg-[#1C1B1B] border-white/10'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#E9C349]">
                            {order.reference}
                          </span>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            isSignaled
                              ? 'bg-amber-500/20 text-amber-300'
                              : isConfirmed
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : isRejected
                              ? 'bg-rose-500/20 text-rose-300'
                              : isExpired
                              ? 'bg-gray-500/20 text-gray-400'
                              : 'bg-white/10 text-gray-300'
                          }`}>
                            {isSignaled
                              ? 'Virement Signalé (Vérification en cours)'
                              : isConfirmed
                              ? 'Paiement Confirmé'
                              : isRejected
                              ? 'Commande Rejetée'
                              : isExpired
                              ? 'Réservation Expirée'
                              : 'En attente de virement'}
                          </span>
                        </div>

                        <h4 className="font-heading font-bold text-white text-base">
                          {order.eventTitle}
                        </h4>

                        <p className="text-xs text-gray-300">
                          {order.tierName} • {order.quantity} place(s) • Payé via <strong className="uppercase">{order.paymentMethod}</strong>
                        </p>

                        {(isRejected || isExpired) && order.rejectionReason && (
                          <div className="pt-2 text-[11px] text-rose-400 font-medium flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>Motif : {order.rejectionReason}</span>
                          </div>
                        )}
                      </div>

                      <div className="text-left sm:text-right">
                        <span className="text-[10px] text-gray-400 uppercase font-bold block">Montant</span>
                        <span className="font-heading font-extrabold text-lg text-[#E9C349] tabular-nums">
                          {order.totalAmount.toLocaleString('fr-FR')} FCFA
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modale d'assignation de billet à un ami */}
      <AssignTicketModal
        ticket={selectedTicketForAssign}
        isOpen={selectedTicketForAssign !== null}
        buyerName={userName}
        onClose={() => setSelectedTicketForAssign(null)}
        onAssignedSuccess={(updatedTicket) => {
          if (onTicketUpdated) onTicketUpdated(updatedTicket);
        }}
      />
    </div>
  );
};
