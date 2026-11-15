import React, { useMemo, useState, useEffect } from 'react';
import {
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Store,
  Smartphone,
  Copy,
  Check,
  QrCode,
  Send,
  Ticket,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { EventItem, UserTicket } from '../../types';

interface SoldTicketsSectionProps {
  tickets: UserTicket[];
  events?: EventItem[];
  onOpenTicketModal: (ticket: UserTicket) => void;
  isLoading?: boolean;
}

const isOnlinePurchase = (ticket: UserTicket): boolean =>
  !ticket.isPhysical && !ticket.agentId;

const resolveAgentLabel = (ticket: UserTicket): string | null =>
  ticket.agentName ||
  ticket.sales_agents?.point_de_vente ||
  ticket.sales_agents?.gerant_name ||
  null;

const getStatusMeta = (status: UserTicket['status']) => {
  if (status === 'used' || status === 'scanned') {
    return {
      label: 'Scanné',
      className: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      icon: 'used' as const,
    };
  }
  if (status === 'cancelled') {
    return {
      label: 'Désactivé',
      className: 'bg-red-500/15 text-red-400 border-red-500/30',
      icon: 'disabled' as const,
    };
  }
  if (status === 'pending' || status === 'payment_signaled') {
    return {
      label: 'En attente',
      className: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      icon: 'pending' as const,
    };
  }
  return {
    label: 'Valide',
    className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    icon: 'valid' as const,
  };
};

export const SoldTicketsSection: React.FC<SoldTicketsSectionProps> = ({
  tickets,
  events = [],
  onOpenTicketModal,
  isLoading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | 'online' | 'physical'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'valid' | 'scanned' | 'disabled'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const eventOptions = useMemo(() => {
    const map = new Map<string, string>();
    events.forEach((ev) => {
      if (ev.id && ev.title) {
        map.set(ev.id, ev.title);
      }
    });
    tickets.forEach((t) => {
      if (t.eventId && t.eventTitle && !map.has(t.eventId)) {
        map.set(t.eventId, t.eventTitle);
      }
    });
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [events, tickets]);

  const filteredTickets = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return tickets.filter((t) => {
      if (selectedEventId !== 'all' && t.eventId !== selectedEventId) return false;

      const online = isOnlinePurchase(t);
      if (channelFilter === 'online' && !online) return false;
      if (channelFilter === 'physical' && online) return false;

      if (filterStatus === 'valid') {
        if (t.status !== 'valid' && t.status !== 'sold_valid' && t.status !== 'confirmed' && t.status !== 'physical_sold') {
          return false;
        }
      } else if (filterStatus === 'scanned') {
        if (t.status !== 'used' && t.status !== 'scanned') return false;
      } else if (filterStatus === 'disabled') {
        if (t.status !== 'cancelled') return false;
      }

      if (!q) return true;

      const agentLabel = resolveAgentLabel(t) || '';
      return (
        (t.holderName || '').toLowerCase().includes(q) ||
        (t.holderPhone || '').toLowerCase().includes(q) ||
        (t.holderEmail || '').toLowerCase().includes(q) ||
        (t.eventTitle || '').toLowerCase().includes(q) ||
        (t.tierName || '').toLowerCase().includes(q) ||
        (t.qrCode || '').toLowerCase().includes(q) ||
        agentLabel.toLowerCase().includes(q)
      );
    });
  }, [tickets, selectedEventId, channelFilter, filterStatus, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedEventId, channelFilter, filterStatus, pageSize, tickets.length]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedTickets = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredTickets.slice(start, start + pageSize);
  }, [filteredTickets, safePage, pageSize]);

  const stats = useMemo(() => {
    const onlineCount = filteredTickets.filter((t) => isOnlinePurchase(t)).length;
    const posCount = filteredTickets.length - onlineCount;
    const scannedCount = filteredTickets.filter((t) => t.status === 'used' || t.status === 'scanned').length;
    return {
      total: filteredTickets.length,
      onlineCount,
      posCount,
      scannedCount,
    };
  }, [filteredTickets]);

  const handleCopyLink = (ticket: UserTicket, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/?ticket=${encodeURIComponent(ticket.qrCode || ticket.id)}`;
    navigator.clipboard?.writeText(url);
    setCopiedId(ticket.id);
    window.setTimeout(() => {
      setCopiedId((prev) => (prev === ticket.id ? null : prev));
    }, 1800);
  };

  const handleWhatsAppShare = (ticket: UserTicket, e: React.MouseEvent) => {
    e.stopPropagation();
    const rawPhone = (ticket.holderPhone || '').replace(/[^0-9]/g, '');
    const waPhone = rawPhone.length === 9 ? `221${rawPhone}` : rawPhone;
    const passUrl = `${window.location.origin}/?ticket=${encodeURIComponent(ticket.qrCode || ticket.id)}`;
    const message =
      `Bonjour ${ticket.holderName || 'Client'}, voici votre Pass ${ticket.tierName} pour ${ticket.eventTitle} (${ticket.eventDate}).\n` +
      `Code billet : ${ticket.qrCode}\n` +
      `Lien : ${passUrl}`;
    const targetUrl = waPhone
      ? `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const startIndex = filteredTickets.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIndex = Math.min(safePage * pageSize, filteredTickets.length);

  return (
    <section className="space-y-4">
      {/* En-tête + Compteurs compacts */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-[#141414] border border-white/10 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#8A2BE2]/20 border border-[#8A2BE2]/30 flex items-center justify-center shrink-0">
            <Ticket className="w-5 h-5 text-[#DCB8FF]" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-base sm:text-lg text-white">
              Registre des Billets Vendus ({stats.total})
            </h2>
            <p className="text-xs text-gray-400">
              Liste optimisée haute performance • Cliquez sur « Voir le QR » pour afficher et télécharger un Pass
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 font-semibold inline-flex items-center gap-1.5">
            <Smartphone className="w-3.5 h-3.5 text-[#8A2BE2]" />
            En ligne : {stats.onlineCount}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-300 font-semibold inline-flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5 text-[#E9C349]" />
            Guichet POS : {stats.posCount}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 font-semibold inline-flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Scannés : {stats.scannedCount}
          </span>
        </div>
      </div>

      {/* Barre de filtres */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Client, tél, code THIES-..., POS..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#161616] border border-white/10 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-[#8A2BE2]"
          />
        </div>

        <select
          value={selectedEventId}
          onChange={(e) => setSelectedEventId(e.target.value)}
          className="w-full px-3 py-2.5 rounded-xl bg-[#161616] border border-white/10 text-sm text-white focus:outline-none focus:border-[#8A2BE2]"
        >
          <option value="all">Tous les événements</option>
          {eventOptions.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.title}
            </option>
          ))}
        </select>

        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value as 'all' | 'online' | 'physical')}
          className="w-full px-3 py-2.5 rounded-xl bg-[#161616] border border-white/10 text-sm text-white focus:outline-none focus:border-[#8A2BE2]"
        >
          <option value="all">Tous les canaux</option>
          <option value="online">Achats en ligne (Wave/OM)</option>
          <option value="physical">Guichets Physiques (POS)</option>
        </select>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Filter className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={filterStatus}
              onChange={(e) =>
                setFilterStatus(e.target.value as 'all' | 'valid' | 'scanned' | 'disabled')
              }
              className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-[#161616] border border-white/10 text-sm text-white focus:outline-none focus:border-[#8A2BE2]"
            >
              <option value="all">Tous les statuts</option>
              <option value="valid">Valides</option>
              <option value="scanned">Scannés</option>
              <option value="disabled">Désactivés</option>
            </select>
          </div>

          <select
            aria-label="Billets par page"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="px-2.5 py-2.5 rounded-xl bg-[#161616] border border-white/10 text-xs font-semibold text-gray-200 focus:outline-none focus:border-[#8A2BE2]"
          >
            <option value={25}>25 / p.</option>
            <option value={50}>50 / p.</option>
            <option value={100}>100 / p.</option>
          </select>
        </div>
      </div>

      {/* Contenu principal */}
      {isLoading ? (
        <div className="rounded-2xl bg-[#141414] border border-white/10 p-8 text-center text-sm text-gray-400">
          Chargement des billets en cours...
        </div>
      ) : paginatedTickets.length === 0 ? (
        <div className="rounded-2xl bg-[#141414] border border-white/10 p-8 text-center space-y-2">
          <Ticket className="w-8 h-8 text-gray-600 mx-auto" />
          <p className="text-sm font-semibold text-gray-300">Aucun billet trouvé</p>
          <p className="text-xs text-gray-500">
            Ajustez votre recherche ou vos filtres pour afficher d&apos;autres billets.
          </p>
        </div>
      ) : (
        <>
          {/* Tableau Desktop (Colonnes : Client, Événement, Formule, Statut, Actions) */}
          <div className="hidden md:block rounded-2xl bg-[#141414] border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-[#1A1A1A] text-[11px] uppercase tracking-wider text-gray-400">
                    <th className="py-3 px-4 font-bold">Client</th>
                    <th className="py-3 px-4 font-bold">Événement</th>
                    <th className="py-3 px-4 font-bold">Formule</th>
                    <th className="py-3 px-4 font-bold">Statut</th>
                    <th className="py-3 px-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {paginatedTickets.map((ticket) => {
                    const online = isOnlinePurchase(ticket);
                    const agentLabel = resolveAgentLabel(ticket);
                    const statusMeta = getStatusMeta(ticket.status);

                    return (
                      <tr
                        key={ticket.id}
                        className="hover:bg-white/[0.03] transition-colors"
                      >
                        <td className="py-3 px-4 align-middle">
                          <div className="min-w-0">
                            <p className="font-semibold text-white truncate max-w-[220px]">
                              {ticket.holderName || 'Client Billetterie'}
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs text-gray-400">
                              <span>{ticket.holderPhone || 'Tél. non renseigné'}</span>
                              <span>•</span>
                              {online ? (
                                <span className="text-[#DCB8FF] inline-flex items-center gap-1">
                                  <Smartphone className="w-3 h-3" /> En ligne
                                </span>
                              ) : (
                                <span className="text-[#E9C349] inline-flex items-center gap-1 truncate max-w-[140px]">
                                  <Store className="w-3 h-3 shrink-0" /> {agentLabel || 'Guichet POS'}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] font-mono text-gray-500 mt-0.5 truncate max-w-[220px]">
                              {ticket.qrCode}
                            </p>
                          </div>
                        </td>

                        <td className="py-3 px-4 align-middle">
                          <p className="font-medium text-white truncate max-w-[210px]">
                            {ticket.eventTitle}
                          </p>
                          <p className="text-xs text-gray-400 truncate max-w-[210px]">
                            {ticket.eventDate}
                            {ticket.eventTime ? ` • ${ticket.eventTime}` : ''}
                          </p>
                        </td>

                        <td className="py-3 px-4 align-middle">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-[#E9C349]/15 border border-[#E9C349]/30 text-[#E9C349] text-xs font-bold">
                            {ticket.tierName}
                          </span>
                          <p className="text-xs font-semibold text-gray-300 mt-1">
                            {(ticket.price || 0).toLocaleString('fr-FR')} FCFA
                          </p>
                        </td>

                        <td className="py-3 px-4 align-middle">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusMeta.className}`}
                          >
                            {statusMeta.icon === 'used' && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {statusMeta.icon === 'disabled' && <XCircle className="w-3.5 h-3.5" />}
                            {statusMeta.icon === 'pending' && <Clock className="w-3.5 h-3.5" />}
                            {statusMeta.icon === 'valid' && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {statusMeta.label}
                          </span>
                        </td>

                        <td className="py-3 px-4 align-middle">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => onOpenTicketModal(ticket)}
                              className="px-3 py-1.5 rounded-xl bg-[#8A2BE2] hover:bg-[#7A1FD2] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-sm"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                              <span>Voir le QR</span>
                            </button>

                            <button
                              type="button"
                              title="Copier le lien du billet"
                              onClick={(e) => handleCopyLink(ticket, e)}
                              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-colors"
                            >
                              {copiedId === ticket.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <button
                              type="button"
                              title="Envoyer via WhatsApp"
                              onClick={(e) => handleWhatsAppShare(ticket, e)}
                              className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 transition-colors"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cartes compactes Mobile */}
          <div className="block md:hidden space-y-2.5">
            {paginatedTickets.map((ticket) => {
              const online = isOnlinePurchase(ticket);
              const agentLabel = resolveAgentLabel(ticket);
              const statusMeta = getStatusMeta(ticket.status);

              return (
                <div
                  key={ticket.id}
                  className="p-3.5 rounded-2xl bg-[#141414] border border-white/10 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-white truncate">
                        {ticket.holderName || 'Client Billetterie'}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {ticket.holderPhone || 'Tél. non renseigné'} •{' '}
                        {online ? 'En ligne' : agentLabel || 'Guichet POS'}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${statusMeta.className}`}
                    >
                      {statusMeta.label}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs bg-white/[0.03] rounded-xl px-3 py-2 border border-white/5">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-200 truncate">{ticket.eventTitle}</p>
                      <p className="text-[11px] text-gray-400 truncate">
                        {ticket.eventDate} • {ticket.tierName}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-[#E9C349]">
                        {(ticket.price || 0).toLocaleString('fr-FR')} F
                      </p>
                      <p className="text-[10px] font-mono text-gray-500">{ticket.qrCode}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenTicketModal(ticket)}
                      className="flex-1 py-2 px-3 rounded-xl bg-[#8A2BE2] hover:bg-[#7A1FD2] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Voir le QR</span>
                    </button>

                    <button
                      type="button"
                      title="Copier le lien"
                      onClick={(e) => handleCopyLink(ticket, e)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300"
                    >
                      {copiedId === ticket.id ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      type="button"
                      title="Envoyer via WhatsApp"
                      onClick={(e) => handleWhatsAppShare(ticket, e)}
                      className="p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Barre de pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#141414] border border-white/10 rounded-2xl px-4 py-3 text-xs text-gray-400">
            <span>
              Affichage <strong className="text-white">{startIndex}</strong>–
              <strong className="text-white">{endIndex}</strong> sur{' '}
              <strong className="text-white">{filteredTickets.length}</strong> billet(s)
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none border border-white/10 text-white font-semibold inline-flex items-center gap-1 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Précédent</span>
              </button>

              <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white font-bold">
                Page {safePage} / {totalPages}
              </span>

              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none border border-white/10 text-white font-semibold inline-flex items-center gap-1 transition-colors"
              >
                <span>Suivant</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
};
