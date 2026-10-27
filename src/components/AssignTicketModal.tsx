import React, { useState } from 'react';
import {
  X,
  UserPlus,
  Share2,
  Check,
  Copy,
  MessageSquare,
  Smartphone,
  ShieldCheck,
  Send,
  Ticket,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { UserTicket } from '../types';
import { assignTicketToFriend } from '../services/supabase';

interface AssignTicketModalProps {
  ticket: UserTicket | null;
  isOpen: boolean;
  onClose: () => void;
  buyerName: string;
  onAssignedSuccess: (updatedTicket: UserTicket) => void;
}

export const AssignTicketModal: React.FC<AssignTicketModalProps> = ({
  ticket,
  isOpen,
  onClose,
  buyerName,
  onAssignedSuccess,
}) => {
  const [friendName, setFriendName] = useState('');
  const [friendPhone, setFriendPhone] = useState('');
  const [friendEmail, setFriendEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Écran post-assignation avec boutons de partage
  const [assignedResult, setAssignedResult] = useState<{
    claimToken: string;
    ticket: UserTicket;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !ticket) return null;

  // Construction de l'URL de réclamation
  const getClaimUrl = (token: string): string => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://thiesdn-billetterie.vercel.app';
    return `${origin}/claim-ticket/${token}`;
  };

  // Normaliser le numéro pour wa.me (retirer espaces et ajouter indicatif Sénégal si 7XXXXXXXX)
  const normalizePhoneForWhatsApp = (phone: string): string => {
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('00221')) clean = clean.substring(2);
    if (clean.length === 9 && (clean.startsWith('70') || clean.startsWith('75') || clean.startsWith('76') || clean.startsWith('77') || clean.startsWith('78'))) {
      clean = '221' + clean;
    }
    return clean;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = friendName.trim();
    const cleanPhone = friendPhone.trim();

    if (!cleanName) {
      setErrorMessage('Le nom complet de votre ami est obligatoire.');
      return;
    }
    if (!cleanPhone || cleanPhone.length < 8) {
      setErrorMessage('Un numéro de téléphone valide est obligatoire.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await assignTicketToFriend(ticket.id, cleanName, cleanPhone, friendEmail);
      if (res.success && res.claimToken && res.ticket) {
        setAssignedResult({
          claimToken: res.claimToken,
          ticket: res.ticket,
        });
        onAssignedSuccess(res.ticket);
      } else {
        setErrorMessage(res.message || 'Une erreur est survenue lors de l’assignation.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur réseau.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (!assignedResult) return;
    const url = getClaimUrl(assignedResult.claimToken);
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleClose = () => {
    setFriendName('');
    setFriendPhone('');
    setFriendEmail('');
    setAssignedResult(null);
    setErrorMessage(null);
    onClose();
  };

  const claimUrl = assignedResult ? getClaimUrl(assignedResult.claimToken) : '';
  const waPhone = assignedResult ? normalizePhoneForWhatsApp(assignedResult.ticket.assignedToPhone || friendPhone) : '';
  const shareMessage = `Bonjour ${assignedResult?.ticket.assignedToName || friendName} ! ${buyerName} vous a offert un billet officiel pour "${ticket.eventTitle}" (${ticket.tierName}). Cliquez ici pour récupérer votre pass personnel sur votre smartphone : ${claimUrl}`;
  const whatsappUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(shareMessage)}`;
  const smsUrl = `sms:${waPhone}?body=${encodeURIComponent(shareMessage)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-gradient-to-b from-[#1C1824] via-[#0A0A0A] to-[#121118] border border-[#8A2BE2]/40 rounded-3xl overflow-hidden shadow-2xl my-4 sm:my-6">
        {/* Header */}
        <div className="p-4 flex items-center justify-between border-b border-white/10 bg-black/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#8A2BE2]/20 border border-[#8A2BE2]/40 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-[#E9C349]" />
            </div>
            <div>
              <h3 className="font-heading font-black text-sm text-white">
                Assigner ce Billet à un Ami
              </h3>
              <p className="text-[10px] text-gray-400">
                {ticket.tierName} • {ticket.seatNumber || ticket.qrCode}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            aria-label="Fermer"
            className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corps */}
        <div className="p-6 space-y-5">
          {/* ÉTAPE 1 : FORMULAIRE DE SAISIE */}
          {!assignedResult ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#E9C349] block">
                  Événement Concerné
                </span>
                <p className="font-heading font-bold text-sm text-white">
                  {ticket.eventTitle}
                </p>
                <p className="text-xs text-gray-400">
                  {ticket.eventDate} à {ticket.eventTime} • {ticket.eventVenue}
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-300 block mb-1.5">
                    Nom complet de votre ami <span className="text-[#E9C349]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={friendName}
                    onChange={(e) => setFriendName(e.target.value)}
                    placeholder="Ex: Moussa Ndiaye"
                    className="w-full bg-[#181818] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-[#8A2BE2]"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Ce nom sera inscrit sur son billet et vérifié à l'entrée par les vigiles.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-300 block mb-1.5">
                    Numéro de Téléphone (WhatsApp / Mobile) <span className="text-[#E9C349]">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    inputMode="tel"
                    value={friendPhone}
                    onChange={(e) => setFriendPhone(e.target.value)}
                    placeholder="Ex: 77 123 45 67 ou +221..."
                    className="w-full bg-[#181818] border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-[#8A2BE2]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1.5">
                    Email de l'ami (Optionnel)
                  </label>
                  <input
                    type="email"
                    value={friendEmail}
                    onChange={(e) => setFriendEmail(e.target.value)}
                    placeholder="ami@exemple.com"
                    className="w-full bg-[#181818] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full btn-primary-glow py-3.5 px-4 rounded-xl font-heading font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    'Génération du lien en cours...'
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Confirmer l'Assignation
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* ÉTAPE 2 : SUCCÈS & ENVOI VIA WHATSAPP OU LIEN */
            <div className="space-y-4 text-center animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8" />
              </div>

              <div>
                <h4 className="font-heading font-black text-lg text-white">
                  Billet Préparé pour {assignedResult.ticket.assignedToName} !
                </h4>
                <p className="text-xs text-gray-300 mt-1">
                  Envoyez maintenant le lien d'invitation à votre ami pour qu'il récupère son pass personnel avec son propre QR code.
                </p>
              </div>

              {/* BOUTON OFFICIEL WHATSAPP 1-CLIC */}
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-heading font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all active:scale-[0.98]"
              >
                <MessageSquare className="w-4 h-4 fill-current" />
                Envoyer par WhatsApp à {assignedResult.ticket.assignedToName}
              </a>

              {/* LIEN UNIQUE & BOUTON COPIER */}
              <div className="p-3 bg-black/60 border border-white/10 rounded-2xl text-left space-y-2">
                <span className="text-[10px] uppercase font-bold text-gray-400 block">
                  Lien unique de récupération du pass :
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={claimUrl}
                    className="flex-1 bg-[#121212] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-[#DCB8FF] font-mono truncate"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1 transition-all"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copié' : 'Copier'}</span>
                  </button>
                </div>
              </div>

              {/* SMS alternative */}
              {waPhone && (
                <div className="pt-1">
                  <a
                    href={smsUrl}
                    className="text-xs text-[#DCB8FF] hover:underline inline-flex items-center gap-1"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Envoyer par SMS classique</span>
                  </a>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-heading font-bold text-xs uppercase tracking-wider transition-colors"
                >
                  Terminer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
