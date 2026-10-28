import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Ticket,
  Search,
  Download,
  Share2,
  ExternalLink,
  CheckCircle2,
  Clock,
  Phone,
  Calendar,
  MapPin,
  Eye,
  Check,
  Copy,
  MessageCircle,
  FileText,
} from 'lucide-react';
import { UserTicket } from '../../types';

interface SoldTicketsSectionProps {
  tickets: UserTicket[];
  onOpenTicketModal: (ticket: UserTicket) => void;
  isLoading?: boolean;
}

export const SoldTicketsSection: React.FC<SoldTicketsSectionProps> = ({
  tickets,
  onOpenTicketModal,
  isLoading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'valid' | 'used'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filtrage des billets
  const filteredTickets = tickets.filter((t) => {
    const term = searchTerm.toLowerCase();
    const matchSearch =
      (t.holderName && t.holderName.toLowerCase().includes(term)) ||
      (t.holderPhone && t.holderPhone.toLowerCase().includes(term)) ||
      (t.eventTitle && t.eventTitle.toLowerCase().includes(term)) ||
      (t.qrCode && t.qrCode.toLowerCase().includes(term)) ||
      (t.id && t.id.toLowerCase().includes(term));

    const matchStatus =
      filterStatus === 'all'
        ? true
        : filterStatus === 'valid'
        ? t.status === 'valid'
        : t.status === 'used';

    return matchSearch && matchStatus;
  });

  const handleCopyLink = (ticket: UserTicket) => {
    const url = `${window.location.origin}/ticket/${ticket.id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(ticket.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleWhatsAppShare = (ticket: UserTicket) => {
    const phone = (ticket.holderPhone || '').replace(/\D/g, '');
    const validPhone = phone.startsWith('221') ? phone : `221${phone}`;
    const url = `${window.location.origin}/ticket/${ticket.id}`;
    const msg = encodeURIComponent(
      `Bonjour ${ticket.holderName} ! 👋\nVoici votre billet officiel pour *${ticket.eventTitle}* :\n🎫 Formule : ${ticket.tierName}\n🔗 Accès au pass : ${url}\n\nPrésentez ce QR Code à l'entrée de l'événement.`
    );
    window.open(`https://wa.me/${validPhone}?text=${msg}`, '_blank');
  };

  const handleDownloadQrOnly = (ticket: UserTicket) => {
    const svgElem = document.getElementById(`qr-svg-${ticket.id}`);
    if (!svgElem) {
      onOpenTicketModal(ticket);
      return;
    }
    const svgData = new XMLSerializer().serializeToString(svgElem);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      canvas.width = 400;
      canvas.height = 400;
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 400, 400);
        ctx.drawImage(img, 20, 20, 360, 360);
        const a = document.createElement('a');
        a.download = `Billet-QR-${ticket.holderName.replace(/\s+/g, '_')}-${ticket.id.slice(0, 8)}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
      }
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <section className="glass-panel rounded-3xl p-6 border border-white/10 space-y-5">
      {/* En-tête de section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-[#8A2BE2]/20 border border-[#8A2BE2]/40 text-[#DCB8FF]">
              <Ticket className="w-5 h-5 text-[#E9C349]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-heading font-bold text-white flex items-center gap-2">
                <span>Billets Vendus & Émis</span>
                <span className="px-2 py-0.5 rounded-full bg-[#8A2BE2]/20 border border-[#8A2BE2]/40 text-[#DCB8FF] text-xs font-semibold">
                  {filteredTickets.length} / {tickets.length}
                </span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Chaque billet dispose d'un QR code unique cryptographique sécurisé avec le logo officiel Thièsdn incrusté.
              </p>
            </div>
          </div>
        </div>

        {/* Filtres de recherche */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher nom, tél, code..."
              className="pl-9 pr-3 py-2 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#8A2BE2] transition-colors w-48 sm:w-60"
            />
          </div>

          <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 text-xs">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterStatus === 'all'
                  ? 'bg-[#8A2BE2] text-white font-bold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setFilterStatus('valid')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterStatus === 'valid'
                  ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Valides
            </button>
            <button
              onClick={() => setFilterStatus('used')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                filterStatus === 'used'
                  ? 'bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Scannés
            </button>
          </div>
        </div>
      </div>

      {/* Liste des billets */}
      {isLoading ? (
        <div className="py-12 text-center text-gray-400 space-y-2">
          <Clock className="w-8 h-8 mx-auto animate-spin text-[#E9C349]" />
          <p className="text-xs">Chargement des billets vendus...</p>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="py-12 text-center text-gray-500 space-y-2 bg-black/20 rounded-2xl border border-dashed border-white/10">
          <Ticket className="w-10 h-10 mx-auto text-gray-600" />
          <p className="text-xs font-semibold">Aucun billet vendu trouvé</p>
          <p className="text-[11px] text-gray-500">
            Les billets validés depuis les commandes apparaîtront automatiquement ici.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTickets.map((ticket) => {
            const isUsed = ticket.status === 'used';
            const qrValue = ticket.qrCode || `THIESDN-TKT-${ticket.id}`;
            const directUrl = `${window.location.origin}/ticket/${ticket.id}`;

            return (
              <div
                key={ticket.id}
                className="bg-[#18161D] rounded-2xl p-4 border border-white/10 hover:border-[#8A2BE2]/40 transition-all flex flex-col justify-between gap-3 shadow-lg relative group overflow-hidden"
              >
                {/* Liseré néon discret */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#8A2BE2] via-[#E9C349] to-[#8A2BE2] opacity-40 group-hover:opacity-100 transition-opacity" />

                <div className="flex gap-4">
                  {/* QR Code Brandé Haute Résolution (avec Logo ThièsDN au centre) */}
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <div className="p-2 bg-white rounded-xl shadow-md border border-white/20 relative">
                      <QRCodeSVG
                        id={`qr-svg-${ticket.id}`}
                        value={qrValue}
                        size={104}
                        level="H"
                        includeMargin={false}
                        imageSettings={{
                          src: '/logo-qr.png',
                          height: 24,
                          width: 24,
                          excavate: true,
                        }}
                      />
                    </div>
                    <span className="text-[9px] font-mono text-gray-400 truncate max-w-[104px]">
                      {ticket.qrCode?.slice(0, 14)}...
                    </span>
                  </div>

                  {/* Infos Porteur & Événement */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          isUsed
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {isUsed ? '🎟️ Scanné' : '✅ Valide'}
                      </span>
                      <span className="text-[11px] font-bold text-[#E9C349]">
                        {Number(ticket.price).toLocaleString()} F
                      </span>
                    </div>

                    <h3 className="font-heading font-bold text-sm text-white truncate" title={ticket.holderName}>
                      {ticket.holderName}
                    </h3>

                    {ticket.holderPhone && (
                      <p className="text-xs text-gray-300 flex items-center gap-1 truncate">
                        <Phone className="w-3 h-3 text-[#E9C349] shrink-0" />
                        <span className="font-mono">{ticket.holderPhone}</span>
                      </p>
                    )}

                    <p className="text-xs text-[#DCB8FF] font-medium truncate" title={ticket.eventTitle}>
                      {ticket.eventTitle}
                    </p>

                    <p className="text-[11px] text-gray-400 flex items-center gap-1 truncate">
                      <Calendar className="w-3 h-3 text-gray-500 shrink-0" />
                      <span>{ticket.eventDate} • {ticket.tierName}</span>
                    </p>
                  </div>
                </div>

                {/* Barre d'actions rapides du billet */}
                <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1">
                    {/* Bouton voir pass complet */}
                    <button
                      onClick={() => onOpenTicketModal(ticket)}
                      className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-[11px] font-bold transition-all flex items-center gap-1"
                      title="Ouvrir le pass officiel HD avec animations et PDF"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#DCB8FF]" />
                      <span>Pass</span>
                    </button>

                    {/* Bouton télécharger QR Code PNG direct */}
                    <button
                      onClick={() => handleDownloadQrOnly(ticket)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#8A2BE2]/15 hover:bg-[#8A2BE2]/30 text-[#DCB8FF] border border-[#8A2BE2]/30 text-[11px] font-bold transition-all flex items-center gap-1"
                      title="Télécharger l'image QR Code HD pour impression"
                    >
                      <Download className="w-3.5 h-3.5 text-[#E9C349]" />
                      <span>QR</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Copier lien */}
                    <button
                      onClick={() => handleCopyLink(ticket)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-xs transition-all"
                      title="Copier le lien direct du billet"
                    >
                      {copiedId === ticket.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Partager WhatsApp */}
                    {ticket.holderPhone && (
                      <button
                        onClick={() => handleWhatsAppShare(ticket)}
                        className="p-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs transition-all"
                        title="Envoyer le billet sur WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
