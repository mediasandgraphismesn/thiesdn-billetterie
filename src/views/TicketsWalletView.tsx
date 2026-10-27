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
} from 'lucide-react';
import { UserTicket, OrderRecord } from '../types';
import { getStoredOrders, fetchOrdersFromSupabase, cancelTicketAssignment } from '../services/supabase';
import { AddToCalendarButton } from '../components/AddToCalendarButton';
import { AssignTicketModal } from '../components/AssignTicketModal';

interface TicketsWalletViewProps {
  tickets: UserTicket[];
  userName?: string;
  onOpenPass: (ticket: UserTicket) => void;
  onExploreEvents: () => void;
  onTicketUpdated?: (ticket: UserTicket) => void;
}

export const TicketsWalletView: React.FC<TicketsWalletViewProps> = ({
  tickets,
  userName = 'Moi',
  onOpenPass,
  onExploreEvents,
  onTicketUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'tickets' | 'orders'>('tickets');
  const [ticketFilter, setTicketFilter] = useState<'upcoming' | 'past'>('upcoming');
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [selectedTicketForAssign, setSelectedTicketForAssign] = useState<UserTicket | null>(null);
  const [cancellingTicketId, setCancellingTicketId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrdersFromSupabase().then((res) => {
      if (res.orders && res.orders.length > 0) {
        setOrders(res.orders);
      } else {
        setOrders(getStoredOrders());
      }
    });
  }, []);

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

  const upcomingTickets = tickets.filter((t) => !isTicketPast(t));
  const pastTickets = tickets.filter((t) => isTicketPast(t));

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
                <div className="space-y-4">
                  {upcomingTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      onClick={() => onOpenPass(ticket)}
                      className="glass-panel rounded-3xl p-5 hover:border-[#8A2BE2] transition-all cursor-pointer group relative overflow-hidden shadow-xl"
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        {/* Poster Thumbnail */}
                        <div className="w-full sm:w-28 h-28 rounded-2xl overflow-hidden flex-shrink-0 relative">
                          <img
                            src={ticket.eventPoster}
                            alt={ticket.eventTitle}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute top-1 left-1 bg-[#E9C349] text-[#241A00] text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded">
                            {ticket.tierName}
                          </div>
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-extrabold uppercase text-[#E9C349] tracking-wider">
                              Pass Exclusif
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-[#8A2BE2]" />
                            <span className="text-[11px] text-[#DCB8FF] font-semibold">
                              {ticket.seatNumber || 'VIP Accès'}
                            </span>
                          </div>

                          <h3 className="font-heading text-lg font-bold text-white truncate group-hover:text-[#DCB8FF] transition-colors">
                            {ticket.eventTitle}
                          </h3>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-[#DCB8FF]" />
                              <span>{ticket.eventDate} • {ticket.eventTime}</span>
                            </div>
                            <div className="flex items-center gap-1.5 truncate">
                              <MapPin className="w-3.5 h-3.5 text-[#E9C349]" />
                              <span className="truncate">{ticket.eventVenue}</span>
                            </div>
                          </div>
                        </div>

                        {/* QR Code Trigger Button & Calendrier */}
                        <div
                          className="w-full sm:w-auto flex items-center justify-between sm:flex-col sm:items-end gap-2.5 pt-3 sm:pt-0 border-t sm:border-t-0 border-white/5 flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="text-left sm:text-right">
                            <p className="text-[10px] text-gray-400 font-mono">{ticket.qrCode}</p>
                            <p className="font-heading font-extrabold text-sm text-[#E9C349] tabular-nums">
                              {ticket.price.toLocaleString('fr-FR')} FCFA
                            </p>
                          </div>

                          <div className="flex flex-wrap sm:flex-col items-center sm:items-end gap-2">
                            <button
                              onClick={() => onOpenPass(ticket)}
                              className="btn-primary-glow px-4 py-2 rounded-xl text-xs font-heading font-bold flex items-center gap-2"
                            >
                              <QrCode className="w-4 h-4" />
                              <span>Afficher Pass</span>
                            </button>

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
                                ticketUrl: typeof window !== 'undefined' ? window.location.href : 'https://thiesdn.mgartswork.site/',
                              }}
                              variant="compact"
                            />
                          </div>
                        </div>
                      </div>

                      {/* SECTION ASSIGNATION / TRANSFERT À UN AMI */}
                      <div
                        className="mt-4 pt-3.5 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {ticket.assignmentStatus === 'pending' ? (
                          <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 w-full">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                              <div>
                                <p className="text-xs font-bold text-amber-200">
                                  En attente d'acceptation par <span className="text-white font-black">{ticket.assignedToName}</span>
                                </p>
                                <p className="text-[10px] text-amber-300/80 font-mono">
                                  {ticket.assignedToPhone}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              {ticket.claimToken && (
                                <a
                                  href={`https://wa.me/${ticket.assignedToPhone?.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                                    `Bonjour ${ticket.assignedToName} ! Voici votre lien officiel pour récupérer votre pass ${ticket.eventTitle} (${ticket.tierName}) : ${
                                      typeof window !== 'undefined' ? window.location.origin : 'https://thiesdn-billetterie.vercel.app'
                                    }/claim-ticket/${ticket.claimToken}`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-heading font-black text-[11px] uppercase tracking-wider flex items-center gap-1.5 shadow transition-all"
                                >
                                  <MessageSquare className="w-3.5 h-3.5 fill-current" />
                                  <span>Renvoyer WhatsApp</span>
                                </a>
                              )}

                              <button
                                onClick={(e) => handleCancelAssignment(ticket.id, e)}
                                disabled={cancellingTicketId === ticket.id}
                                className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-[11px] font-bold transition-colors"
                              >
                                {cancellingTicketId === ticket.id ? 'Annulation...' : 'Annuler'}
                              </button>
                            </div>
                          </div>
                        ) : ticket.assignmentStatus === 'accepted' ? (
                          <div className="flex items-center justify-between gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 w-full">
                            <div className="flex items-center gap-2.5">
                              {ticket.assignedToAvatar || ticket.holderAvatar ? (
                                <img
                                  src={ticket.assignedToAvatar || ticket.holderAvatar}
                                  alt={ticket.assignedToName}
                                  className="w-9 h-9 rounded-xl object-cover border border-emerald-400"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                                  <UserCheck className="w-5 h-5 text-emerald-400" />
                                </div>
                              )}
                              <div>
                                <p className="text-xs font-bold text-emerald-200">
                                  Pass accepté & transféré à <span className="text-white font-black">{ticket.assignedToName}</span>
                                </p>
                                <p className="text-[10px] text-gray-400">
                                  Billet sécurisé et rattaché à son propre smartphone
                                </p>
                              </div>
                            </div>

                            <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-emerald-500 text-black">
                              Transféré
                            </span>
                          </div>
                        ) : ticket.assignmentStatus === 'declined' ? (
                          <div className="flex items-center justify-between gap-2 bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3 w-full">
                            <p className="text-xs text-rose-200">
                              Ce pass a été décliné et est de nouveau disponible dans votre portefeuille.
                            </p>
                            <button
                              onClick={() => setSelectedTicketForAssign(ticket)}
                              className="px-3 py-1.5 rounded-xl bg-[#8A2BE2] hover:bg-[#7822c9] text-white text-[11px] font-heading font-black uppercase tracking-wider flex items-center gap-1.5 transition-all"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>Réassigner</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 w-full">
                            <span className="text-[11px] text-gray-400">
                              Vous venez à plusieurs ? Offrez ou transférez cette place à votre ami.
                            </span>
                            <button
                              onClick={() => setSelectedTicketForAssign(ticket)}
                              className="self-end sm:self-auto px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#8A2BE2]/20 to-[#E9C349]/20 hover:from-[#8A2BE2]/30 hover:to-[#E9C349]/30 text-white border border-[#E9C349]/40 hover:border-[#E9C349] text-xs font-heading font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                            >
                              <UserPlus className="w-3.5 h-3.5 text-[#E9C349]" />
                              <span>Assigner à un ami</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
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
                <div className="space-y-4">
                  {pastTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      onClick={() => onOpenPass(ticket)}
                      className="glass-panel rounded-3xl p-5 hover:border-[#8A2BE2] transition-all cursor-pointer group relative overflow-hidden shadow-lg opacity-90 hover:opacity-100"
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="w-full sm:w-28 h-28 rounded-2xl overflow-hidden flex-shrink-0 relative grayscale group-hover:grayscale-0 transition-all">
                          <img
                            src={ticket.eventPoster}
                            alt={ticket.eventTitle}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-1 left-1 bg-black/80 text-gray-300 text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded">
                            Passé
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">
                              Événement Clôturé
                            </span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-[11px] text-[#DCB8FF] font-semibold">
                              {ticket.tierName}
                            </span>
                          </div>

                          <h3 className="font-heading text-lg font-bold text-white truncate">
                            {ticket.eventTitle}
                          </h3>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-gray-400" />
                              <span>{ticket.eventDate}</span>
                            </div>
                            <div className="flex items-center gap-1.5 truncate">
                              <MapPin className="w-3.5 h-3.5 text-gray-400" />
                              <span className="truncate">{ticket.eventVenue}</span>
                            </div>
                          </div>
                        </div>

                        <div
                          className="w-full sm:w-auto flex items-center justify-between sm:flex-col sm:items-end gap-2.5 pt-3 sm:pt-0 border-t sm:border-t-0 border-white/5 flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <a
                            href="https://youtube.com/@thiesdn"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white border border-red-500/30 text-xs font-bold transition-all"
                          >
                            <Youtube className="w-3.5 h-3.5 fill-current" />
                            <span>Voir Aftermovie</span>
                          </a>

                          <button
                            onClick={() => onOpenPass(ticket)}
                            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold transition-all"
                          >
                            Pass Archivé
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
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
