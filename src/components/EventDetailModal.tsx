import React, { useState } from 'react';
import {
  X,
  Calendar,
  MapPin,
  Clock,
  ShieldCheck,
  Tag,
  Heart,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Facebook,
  Instagram,
  Youtube,
  Globe,
  Share2,
  Sparkles,
  Info,
  MessageSquare,
  Percent,
  Check,
  Play,
  Bell,
  Send,
} from 'lucide-react';
import { EventItem, TicketTier, UserTicket, OrderRecord } from '../types';
import { createOrderWithStockCheck, registerEventPreRegistration } from '../services/supabase';
import { CountdownTimer } from './CountdownTimer';
import { SpotifyVinylPlayer } from './SpotifyVinylPlayer';

const TikTokIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .58.04.86.12V9.42a6.34 6.34 0 0 0-.86-.06 6.34 6.34 0 1 0 6.34 6.34V9.05a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.48z" />
  </svg>
);

interface EventDetailModalProps {
  event: EventItem | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated?: (order: OrderRecord) => void;
  onPurchaseSuccess?: (ticket: UserTicket) => void;
  userName: string;
  isEmailConfirmed?: boolean;
  isAuthenticated?: boolean;
  onRequireAuth?: () => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  isOpen,
  onClose,
  onOrderCreated,
  userName,
  isEmailConfirmed = true,
  isAuthenticated = true,
  onRequireAuth,
}) => {
  if (!isOpen || !event) return null;

  const defaultTier: TicketTier = event.tiers?.[0] || {
    id: 't-default',
    name: 'Billet Standard',
    price: event.price,
    description: 'Accès régulier à l’événement',
    perks: ['Entrée garantie', 'Accès salle'],
    available: 100,
  };

  const [step, setStep] = useState<'select' | 'confirmation'>('select');
  const [selectedTier, setSelectedTier] = useState<TicketTier>(defaultTier);
  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState(userName || 'Client Thièsdn');
  const [phoneNumber, setPhoneNumber] = useState('77 000 00 00');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active Order state once created in Supabase
  const [activeOrder, setActiveOrder] = useState<OrderRecord | null>(null);
  const [openedWaveUrl, setOpenedWaveUrl] = useState<string | null>(null);

  // Gestion des Codes Promo & Remises
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discountPercent: number;
    discountAmount: number;
  } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  // État Modale Teaser Vidéo YouTube
  const [isTeaserOpen, setIsTeaserOpen] = useState(false);

  // État Pré-inscription (quand les ventes ne sont pas encore ouvertes)
  const [preRegName, setPreRegName] = useState(userName || '');
  const [preRegPhone, setPreRegPhone] = useState('');
  const [preRegEmail, setPreRegEmail] = useState('');
  const [isPreRegSubmitting, setIsPreRegSubmitting] = useState(false);
  const [preRegSuccess, setPreRegSuccess] = useState<string | null>(null);

  // Vérifier si les ventes sont dans le futur
  const isSalesUpcoming = Boolean(
    event.salesOpenAt && new Date(event.salesOpenAt).getTime() > Date.now()
  );

  // Extraction d'ID YouTube robuste (supporte standard, shorts, embed, et lien court youtu.be)
  const extractYouTubeId = (url?: string): string | null => {
    if (!url) return null;
    const match = url.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i
    );
    return match ? match[1] : null;
  };

  const youtubeVideoId = extractYouTubeId(event.videoSpotUrl || event.youtubeUrl || event.socialYoutube);

  const tiers = event.tiers && event.tiers.length > 0 ? event.tiers : [defaultTier];
  const baseTotalPrice = selectedTier.price * quantity;
  const discountAmount = appliedPromo
    ? Math.round((baseTotalPrice * appliedPromo.discountPercent) / 100)
    : 0;
  const totalPrice = Math.max(0, baseTotalPrice - discountAmount);

  // Application dynamique du code promo
  const handleApplyPromo = () => {
    setPromoError(null);
    const cleanCode = promoInput.trim().toUpperCase();
    if (!cleanCode) {
      setPromoError('Veuillez renseigner un code promo.');
      return;
    }

    if (event.promoCode && cleanCode === event.promoCode.trim().toUpperCase()) {
      const percent = event.promoDiscountPercent || 15;
      const discount = Math.round((baseTotalPrice * percent) / 100);
      setAppliedPromo({
        code: cleanCode,
        discountPercent: percent,
        discountAmount: discount,
      });
      return;
    }

    if (cleanCode === 'THIESDN10' || cleanCode === 'VIPTHIES' || cleanCode === 'PRESTIGE2026') {
      const percent = cleanCode === 'PRESTIGE2026' ? 20 : 10;
      const discount = Math.round((baseTotalPrice * percent) / 100);
      setAppliedPromo({
        code: cleanCode,
        discountPercent: percent,
        discountAmount: discount,
      });
      return;
    }

    setPromoError('Code promo invalide ou expiré pour cet événement.');
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoInput('');
    setPromoError(null);
  };

  // URL du partage WhatsApp avec aperçu riche
  const eventPreviewUrl = `https://billetterie.thiesdn.site/event/${event.id}`;
  const whatsappShareText =
    `🎟️ *${event.title}* à Thiès !\n\n` +
    `📅 *Date :* ${event.date} à ${event.time}\n` +
    `📍 *Lieu :* ${event.venue}${event.quartier ? ` (${event.quartier})` : ''}, ${event.city}\n` +
    `💰 *Tarif :* À partir de ${event.price.toLocaleString('fr-FR')} FCFA\n\n` +
    `⚡ ${isSalesUpcoming ? 'Les ventes ouvrent très bientôt ! Rejoignez la liste prioritaire ici :' : 'Réservez votre pass officiel 100% sécurisé via Wave en 1 clic :'}\n` +
    `👉 ${eventPreviewUrl}`;

  const whatsappShareEventUrl = `https://wa.me/?text=${encodeURIComponent(whatsappShareText)}`;

  const generateWhatsAppConfirmationUrl = (order: OrderRecord) => {
    const promoLine = order.promoCodeApplied
      ? `🎁 *Code Promo :* ${order.promoCodeApplied} (-${order.discountAmount?.toLocaleString('fr-FR')} FCFA)\n`
      : '';

    const message =
      `🎉 *CONFIRMATION DE COMMANDE — THIÈS DAYS AND NIGHTS*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `✨ *Événement :* ${order.eventTitle}\n` +
      `🎟️ *Formule :* ${order.tierName} (x${order.quantity} place${order.quantity > 1 ? 's' : ''})\n` +
      promoLine +
      `💳 *Montant Réglé :* ${order.totalAmount.toLocaleString('fr-FR')} FCFA via Wave 1-Clic\n` +
      `📋 *Réf. Commande :* ${order.reference}\n` +
      `👤 *Titulaire :* ${order.customerName}\n` +
      `📱 *Téléphone :* ${order.customerPhone}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⏳ *Statut :* Paiement Wave en cours de vérification administrative.\n` +
      `Votre pass numérique officiel avec QR Code unique sera accessible dans l'onglet *Mes Billets* dès validation de l'équipe.\n\n` +
      `🔗 ${eventPreviewUrl}`;

    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  };

  const resolveWaveUrl = (tier: TicketTier): string => {
    if (tier.wavePaymentUrl && tier.wavePaymentUrl.trim().startsWith('http')) {
      return tier.wavePaymentUrl.trim();
    }
    const nameLower = (tier.name || '').toLowerCase();
    if (nameLower.includes('vip') && event.waveLinkVip) return event.waveLinkVip;
    if (nameLower.includes('jour') && event.waveLinkJourJ) return event.waveLinkJourJ;
    if ((nameLower.includes('prévente') || nameLower.includes('prevente')) && event.waveLinkPrevente) {
      return event.waveLinkPrevente;
    }
    if (event.waveLinkPrevente) return event.waveLinkPrevente;
    return 'https://pay.wave.com/m/M_p1_xT73E21bN/c/sn/';
  };

  // Traitement Paiement Wave
  const handleWaveCheckout = async () => {
    if (!isAuthenticated || !isEmailConfirmed) {
      setErrorMessage('Veuillez confirmer votre adresse email pour continuer.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    const cleanName = customerName.trim() || 'Client Thièsdn';
    const cleanPhone = phoneNumber.trim().startsWith('+221')
      ? phoneNumber.trim()
      : `+221 ${phoneNumber.trim()}`;

    try {
      const result = await createOrderWithStockCheck(
        event,
        selectedTier,
        quantity,
        {
          name: cleanName,
          phone: cleanPhone,
          paymentMethod: 'wave',
          customTotal: totalPrice,
          discountAmount: discountAmount > 0 ? discountAmount : undefined,
          promoCodeApplied: appliedPromo ? appliedPromo.code : undefined,
        }
      );

      if (!result.success || !result.order) {
        setErrorMessage(result.message || 'Impossible d’enregistrer la commande.');
        setIsProcessing(false);
        return;
      }

      const order = result.order;
      setActiveOrder(order);

      if (onOrderCreated) onOrderCreated(order);

      const waveUrl = resolveWaveUrl(selectedTier);
      setOpenedWaveUrl(waveUrl);

      if (typeof window !== 'undefined') {
        window.open(waveUrl, '_blank', 'noopener,noreferrer');
      }

      setStep('confirmation');
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors du traitement de votre commande.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Traitement Pré-inscription "Me notifier à l'ouverture"
  const handlePreRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preRegName.trim() || !preRegPhone.trim()) {
      setErrorMessage('Veuillez remplir votre nom et votre numéro de téléphone.');
      return;
    }

    setIsPreRegSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await registerEventPreRegistration({
        eventId: event.id,
        fullName: preRegName.trim(),
        phone: preRegPhone.trim(),
        email: preRegEmail.trim() || undefined,
      });

      if (res.success) {
        setPreRegSuccess(res.message);
      } else {
        setErrorMessage(res.error || 'Erreur lors de la pré-inscription.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Impossible de vous enregistrer pour le moment.');
    } finally {
      setIsPreRegSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
        <div className="relative w-full max-w-2xl bg-[#171717] border border-white/10 rounded-3xl overflow-hidden shadow-2xl my-8 max-h-[90vh] flex flex-col">
          {/* Poster Header */}
          <div className="relative h-48 sm:h-56 w-full flex-shrink-0">
            <img
              src={event.posterUrl}
              alt={event.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#171717] via-black/40 to-transparent" />

            {/* Top Controls */}
            <div className="absolute top-4 inset-x-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <span className="bg-[#1C1B1B]/80 backdrop-blur-md text-[#E9C349] border border-[#E9C349]/30 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-lg flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  {event.category}
                </span>
                <span className="bg-[#8A2BE2]/90 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {event.city}{event.quartier ? ` • ${event.quartier}` : ''}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={whatsappShareEventUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-emerald-600/80 hover:bg-emerald-500 backdrop-blur-md text-white flex items-center justify-center border border-emerald-400/30 transition-all hover:scale-105 shadow-lg"
                  title="Partager cet événement sur WhatsApp"
                >
                  <Share2 className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setIsLiked(!isLiked)}
                  className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-md text-white hover:text-red-400 flex items-center justify-center border border-white/10 transition-colors"
                >
                  <Heart className={`w-4 h-4 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
                </button>
                <button
                  onClick={onClose}
                  className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-md text-white hover:bg-white/20 flex items-center justify-center border border-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Event Title & Bouton Teaser sur Poster */}
            <div className="absolute bottom-4 inset-x-6 z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                {event.isExclusive && (
                  <span className="bg-[#E9C349] text-[#241A00] text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full mb-1 inline-flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Soirée Exclusive
                  </span>
                )}
                <h2 className="font-heading text-xl sm:text-2xl font-extrabold text-white leading-tight">
                  {event.title}
                </h2>
              </div>

              {/* Bouton Voir le Teaser YouTube (TÂCHE 4) */}
              {youtubeVideoId && (
                <button
                  type="button"
                  onClick={() => setIsTeaserOpen(true)}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-red-600/90 hover:bg-red-600 text-white font-heading font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-red-900/40 hover:scale-105 transition-all self-start sm:self-auto shrink-0 border border-red-400/30"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Voir le Teaser</span>
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Content Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {errorMessage && (
              <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* ÉTAPE 1 : Choix de la catégorie OU Compte à Rebours / Pré-inscription */}
            {step === 'select' && (
              <>
                {/* GRAND COMPTE À REBOURS SI VENTES FUTURES (TÂCHE 1) */}
                {isSalesUpcoming && event.salesOpenAt && (
                  <div className="space-y-4">
                    <CountdownTimer
                      targetDate={event.salesOpenAt}
                      size="lg"
                      label="Ouverture officielle de la billetterie dans :"
                    />

                    {/* Formulaire "Me notifier à l'ouverture" */}
                    <div className="p-5 rounded-3xl bg-gradient-to-br from-[#201B2E]/90 to-[#12111A]/95 border border-[#8A2BE2]/40 shadow-xl space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#E9C349]/20 text-[#E9C349] flex items-center justify-center shrink-0 border border-[#E9C349]/30">
                          <Bell className="w-5 h-5 animate-wiggle" />
                        </div>
                        <div>
                          <h4 className="font-heading font-extrabold text-base text-white">
                            Soyez le premier alerté de l'ouverture
                          </h4>
                          <p className="text-xs text-gray-300">
                            Recevez une alerte WhatsApp dès l'ouverture des réservations pour obtenir les tarifs prévente avant rupture de stock.
                          </p>
                        </div>
                      </div>

                      {preRegSuccess ? (
                        <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-3 animate-in fade-in">
                          <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
                          <div>
                            <p className="font-bold text-sm text-emerald-200">Pré-inscription confirmée !</p>
                            <p className="text-xs text-gray-300 mt-0.5">{preRegSuccess}</p>
                          </div>
                        </div>
                      ) : (
                        <form onSubmit={handlePreRegister} className="space-y-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="bg-[#14131A] p-3 rounded-2xl border border-white/10">
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                                Votre Nom Complet *
                              </label>
                              <input
                                type="text"
                                required
                                value={preRegName}
                                onChange={(e) => setPreRegName(e.target.value)}
                                placeholder="Ex: Moussa Diop"
                                className="bg-transparent border-none outline-none text-white text-xs w-full p-0 font-medium"
                              />
                            </div>

                            <div className="bg-[#14131A] p-3 rounded-2xl border border-white/10">
                              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                                Numéro WhatsApp / Mobile *
                              </label>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-[#E9C349]">+221</span>
                                <input
                                  type="tel"
                                  required
                                  value={preRegPhone}
                                  onChange={(e) => setPreRegPhone(e.target.value)}
                                  placeholder="77 123 45 67"
                                  className="bg-transparent border-none outline-none text-white text-xs font-mono w-full p-0"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="bg-[#14131A] p-3 rounded-2xl border border-white/10">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                              Adresse Email (Optionnelle)
                            </label>
                            <input
                              type="email"
                              value={preRegEmail}
                              onChange={(e) => setPreRegEmail(e.target.value)}
                              placeholder="votre.email@gmail.com"
                              className="bg-transparent border-none outline-none text-white text-xs w-full p-0"
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={isPreRegSubmitting}
                            className="w-full py-3.5 px-6 rounded-2xl font-heading font-black text-xs sm:text-sm tracking-wider uppercase transition-all shadow-xl bg-gradient-to-r from-[#E9C349] via-[#F3D779] to-[#d6ad30] hover:scale-[1.01] active:scale-[0.99] text-[#241A00] flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {isPreRegSubmitting ? (
                              <div className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-[#241A00] border-t-transparent rounded-full animate-spin" />
                                <span>Inscription en cours...</span>
                              </div>
                            ) : (
                              <>
                                <Bell className="w-4 h-4 fill-current" />
                                <span>Me notifier à l'ouverture</span>
                              </>
                            )}
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                )}

                {/* Infos Clés */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#201F1F] p-4 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#8A2BE2]/20 text-[#DCB8FF] flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">Date & Heure</p>
                      <p className="text-sm font-semibold text-white">{event.date} • {event.time}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#E9C349]/20 text-[#E9C349] flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">Lieu & Ville</p>
                      <p className="text-sm font-semibold text-white truncate">{event.venue}{event.quartier ? ` • ${event.quartier}` : ''}, {event.city}</p>
                    </div>
                  </div>
                </div>

                {/* LECTEUR VINYLE SPOTIFY "EFFET WOW" (TÂCHE 3) */}
                {event.spotifyUrl && (
                  <SpotifyVinylPlayer
                    spotifyUrl={event.spotifyUrl}
                    posterUrl={event.posterUrl}
                    eventTitle={event.title}
                  />
                )}

                {/* Description & Réseaux Sociaux Promoteur */}
                {(event.description || event.longDescription || event.socialFacebook || event.socialInstagram || event.socialTiktok || event.socialYoutube || event.youtubeUrl || event.websiteUrl) && (
                  <div className="bg-[#201F1F] p-4 sm:p-5 rounded-2xl border border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-heading text-xs font-bold text-[#DCB8FF] uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-[#8A2BE2]" />
                        <span>À Propos de l'Événement</span>
                      </h3>
                      <span className="text-[11px] text-[#E9C349] font-medium">
                        Par {event.promoter.name}
                      </span>
                    </div>

                    {/* Accroche / Description Courte */}
                    {event.description && (
                      <p className="text-xs text-gray-300 leading-relaxed font-medium">
                        {event.description}
                      </p>
                    )}

                    {/* Description Détaillée */}
                    {event.longDescription && (
                      <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 text-xs text-gray-300 leading-relaxed whitespace-pre-line">
                        {event.longDescription}
                      </div>
                    )}

                    {/* Liens Réseaux Sociaux Promoteur / Artiste */}
                    {(event.socialFacebook || event.socialInstagram || event.socialTiktok || event.socialYoutube || event.youtubeUrl || event.websiteUrl) && (
                      <div className="pt-2 border-t border-white/5 flex flex-wrap items-center gap-2">
                        <span className="text-[10px] uppercase font-bold text-gray-400 mr-1 flex items-center gap-1">
                          <Share2 className="w-3 h-3 text-[#E9C349]" />
                          Suivre :
                        </span>

                        {event.socialFacebook && (
                          <a
                            href={event.socialFacebook}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/15 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-semibold transition-all hover:scale-105"
                          >
                            <Facebook className="w-3.5 h-3.5" />
                            <span>Facebook</span>
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </a>
                        )}

                        {event.socialInstagram && (
                          <a
                            href={event.socialInstagram}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-600/15 hover:bg-pink-600/30 text-pink-400 border border-pink-500/30 text-xs font-semibold transition-all hover:scale-105"
                          >
                            <Instagram className="w-3.5 h-3.5" />
                            <span>Instagram</span>
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </a>
                        )}

                        {event.socialTiktok && (
                          <a
                            href={event.socialTiktok}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition-all hover:scale-105"
                          >
                            <TikTokIcon className="w-3.5 h-3.5" />
                            <span>TikTok</span>
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </a>
                        )}

                        {/* YouTube Teaser */}
                        {(event.socialYoutube || event.youtubeUrl || event.videoSpotUrl) && (
                          <button
                            type="button"
                            onClick={() => setIsTeaserOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/15 hover:bg-red-600/30 text-red-400 border border-red-500/30 text-xs font-semibold transition-all hover:scale-105"
                          >
                            <Youtube className="w-3.5 h-3.5" />
                            <span>Teaser Vidéo</span>
                            <Play className="w-2.5 h-2.5 fill-current opacity-80" />
                          </button>
                        )}

                        {event.websiteUrl && (
                          <a
                            href={event.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E9C349]/15 hover:bg-[#E9C349]/30 text-[#E9C349] border border-[#E9C349]/30 text-xs font-semibold transition-all hover:scale-105"
                          >
                            <Globe className="w-3.5 h-3.5" />
                            <span>Site Officiel</span>
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Partage WhatsApp avec Aperçu Visuel Dynamique */}
                <div className="bg-gradient-to-r from-emerald-950/40 via-emerald-900/20 to-black/40 p-3.5 rounded-2xl border border-emerald-500/25 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                      <Share2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Partager cet événement sur WhatsApp</p>
                      <p className="text-[10px] text-gray-300">Générez un aperçu automatique avec l'affiche officielle</p>
                    </div>
                  </div>
                  <a
                    href={whatsappShareEventUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shrink-0"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Partager sur WhatsApp</span>
                  </a>
                </div>

                {/* Choix de Formule & Coordonnées (Affiché UNIQUEMENT si ventes ouvertes) */}
                {!isSalesUpcoming && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-heading text-xs font-bold text-gray-300 uppercase tracking-wider">
                          1. Choisissez votre Formule
                        </h3>
                        <span className="text-xs text-[#DCB8FF] font-semibold">
                          {tiers.length} formule(s) disponible(s)
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {tiers.map((tier) => {
                          const isSelected = selectedTier.id === tier.id;
                          const isVipTier =
                            tier.name.toLowerCase().includes('vip') ||
                            tier.name.toLowerCase().includes('prestige');

                          return (
                            <div
                              key={tier.id}
                              onClick={() => setSelectedTier(tier)}
                              className={`p-4 rounded-2xl cursor-pointer transition-all border ${
                                isSelected
                                  ? isVipTier
                                    ? 'bg-[#241A00]/80 border-[#E9C349] shadow-lg shadow-[#E9C349]/15'
                                    : 'bg-[#1DC3F4]/10 border-[#1DC3F4] shadow-lg shadow-[#1DC3F4]/15'
                                  : 'bg-[#201F1F] border-white/5 hover:border-white/20'
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-heading font-bold text-sm text-white">
                                      {tier.name}
                                    </span>
                                    {isVipTier && (
                                      <span className="bg-[#E9C349] text-[#241A00] text-[9px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                        <ShieldCheck className="w-2.5 h-2.5" /> VIP
                                      </span>
                                    )}
                                    <span className="text-[11px] text-gray-400 bg-white/5 px-2 py-0.5 rounded-full">
                                      {tier.available} places
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-400 mt-1">{tier.description}</p>
                                </div>

                                <div className="text-right">
                                  <span className="font-heading font-extrabold text-base text-[#E9C349]">
                                    {tier.price.toLocaleString('fr-FR')} FCFA
                                  </span>
                                  <p className="text-[10px] text-gray-400">par billet</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Quantité & Coordonnées Client */}
                    <div className="space-y-3">
                      {(!isAuthenticated || !isEmailConfirmed) && (
                        <div className="p-4 rounded-2xl bg-[#241A00]/80 border border-[#E9C349]/50 text-[#E9C349] flex items-center justify-between gap-3 animate-in fade-in">
                          <div className="flex items-center gap-2.5">
                            <AlertCircle className="w-5 h-5 text-[#E9C349] shrink-0" />
                            <div>
                              <p className="font-bold text-xs">Vérification de compte requise</p>
                              <p className="text-[11px] text-gray-300">
                                Veuillez confirmer votre adresse email pour continuer et recevoir vos billets officiels.
                              </p>
                            </div>
                          </div>
                          {onRequireAuth && (
                            <button
                              type="button"
                              onClick={onRequireAuth}
                              className="px-3 py-1.5 rounded-xl bg-[#E9C349] text-[#131313] font-bold text-xs uppercase tracking-wider whitespace-nowrap hover:bg-[#d4ad39] transition-colors"
                            >
                              Se connecter
                            </button>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between p-4 bg-[#201F1F] rounded-2xl border border-white/5">
                        <div>
                          <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">Nombre de places</p>
                          <p className="text-xs text-gray-400 mt-0.5">Places disponibles : {selectedTier.available}</p>
                        </div>
                        <div className="flex items-center gap-3 bg-[#131313] p-1 rounded-xl border border-white/10">
                          <button
                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                            className="w-8 h-8 rounded-lg bg-[#242424] hover:bg-[#333] text-white flex items-center justify-center font-bold text-base transition-colors"
                          >
                            -
                          </button>
                          <span className="font-heading font-bold text-base text-white px-2">
                            {quantity}
                          </span>
                          <button
                            onClick={() => setQuantity(Math.min(Math.min(10, selectedTier.available), quantity + 1))}
                            className="w-8 h-8 rounded-lg bg-[#242424] hover:bg-[#333] text-white flex items-center justify-center font-bold text-base transition-colors"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-[#1C1B1B] p-3.5 rounded-2xl border border-white/5">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                            Nom complet du participant
                          </label>
                          <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Ex: Babacar Ndiaye"
                            className="bg-transparent border-none outline-none text-white text-xs w-full p-0 font-medium"
                          />
                        </div>

                        <div className="bg-[#1C1B1B] p-3.5 rounded-2xl border border-white/5">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                            Numéro Mobile Wave
                          </label>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#1DC3F4] tracking-wider">+221</span>
                            <input
                              type="tel"
                              value={phoneNumber}
                              onChange={(e) => setPhoneNumber(e.target.value)}
                              placeholder="77 000 00 00"
                              className="bg-transparent border-none outline-none text-white text-xs font-mono w-full p-0"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Code Promo */}
                      <div className="bg-[#1C1B1B] p-3.5 rounded-2xl border border-white/5 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-[#E9C349]" />
                            <span>Code Promo / Réduction Spéciale</span>
                          </label>
                          {appliedPromo && (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                              -{appliedPromo.discountPercent}% appliqué
                            </span>
                          )}
                        </div>

                        {!appliedPromo ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={promoInput}
                              onChange={(e) => setPromoInput(e.target.value.toUpperCase().replace(/\s/g, ''))}
                              placeholder={event.promoCode ? `Code promo (${event.promoCode})` : 'EX: THIES2027'}
                              className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase font-bold focus:border-[#E9C349] outline-none"
                            />
                            <button
                              type="button"
                              onClick={handleApplyPromo}
                              className="px-3.5 py-2 rounded-xl bg-[#241A00] hover:bg-[#362700] text-[#E9C349] border border-[#E9C349]/40 text-xs font-bold font-heading transition-colors"
                            >
                              Appliquer
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs">
                            <div className="flex items-center gap-2 text-emerald-300 font-medium">
                              <Sparkles className="w-4 h-4 text-[#E9C349]" />
                              <span>Code <strong>{appliedPromo.code}</strong> : -{discountAmount.toLocaleString('fr-FR')} FCFA</span>
                            </div>
                            <button
                              type="button"
                              onClick={handleRemovePromo}
                              className="text-[11px] text-gray-400 hover:text-white underline font-bold"
                            >
                              Retirer
                            </button>
                          </div>
                        )}

                        {promoError && (
                          <p className="text-[11px] text-rose-400 font-medium flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            <span>{promoError}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* ÉTAPE 2 : Confirmation après ouverture de Wave */}
            {step === 'confirmation' && activeOrder && (
              <div className="py-6 px-2 text-center space-y-6 animate-in fade-in duration-300">
                <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-[#1DC3F4]/20 animate-ping" />
                  <div className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-[#1DC3F4] to-[#0A85EA] text-[#0D0D11] flex items-center justify-center shadow-xl shadow-[#1DC3F4]/30">
                    <Clock className="w-8 h-8 stroke-[2.5]" />
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#1DC3F4]/15 text-[#1DC3F4] border border-[#1DC3F4]/30">
                    <Smartphone className="w-3.5 h-3.5" />
                    Application Wave Ouverte
                  </span>
                  <h3 className="font-heading text-xl sm:text-2xl font-extrabold text-white">
                    Paiement en cours de vérification
                  </h3>
                  <p className="text-xs text-gray-300 max-w-md mx-auto leading-relaxed">
                    Votre commande <strong className="text-[#E9C349] font-mono text-sm">{activeOrder.reference}</strong> a bien été enregistrée.
                  </p>
                </div>

                {/* Récapitulatif commande */}
                <div className="p-4 rounded-2xl bg-[#201F1F] border border-white/5 text-xs text-left max-w-md mx-auto space-y-2">
                  <div className="flex justify-between items-center text-gray-400">
                    <span>Événement :</span>
                    <strong className="text-white text-right truncate max-w-[200px]">{event.title}</strong>
                  </div>
                  <div className="flex justify-between items-center text-gray-400">
                    <span>Formule choisie :</span>
                    <strong className="text-white">{activeOrder.tierName} ({activeOrder.quantity} place(s))</strong>
                  </div>
                  {activeOrder.promoCodeApplied && (
                    <div className="flex justify-between items-center text-emerald-400 font-semibold">
                      <span>Code promo ({activeOrder.promoCodeApplied}) :</span>
                      <span>-{activeOrder.discountAmount?.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-gray-400">
                    <span>Bénéficiaire :</span>
                    <strong className="text-white">{activeOrder.customerName}</strong>
                  </div>
                  <div className="pt-2 border-t border-white/10 flex justify-between items-center font-bold">
                    <span className="text-gray-300">Montant total :</span>
                    <span className="text-[#E9C349] text-base font-extrabold tabular-nums">
                      {activeOrder.totalAmount.toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                </div>

                {/* Bouton WhatsApp */}
                <div className="max-w-md mx-auto pt-1">
                  <a
                    href={generateWhatsAppConfirmationUrl(activeOrder)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3.5 px-5 rounded-2xl font-heading font-extrabold text-xs sm:text-sm tracking-wider uppercase flex items-center justify-center gap-2.5 transition-all shadow-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 active:scale-[0.98]"
                  >
                    <MessageSquare className="w-4 h-4 fill-current" />
                    <span>Envoyer mon billet par WhatsApp</span>
                  </a>
                  <p className="text-[11px] text-gray-400 mt-2">
                    Recevez immédiatement une copie certifiée de votre reçu sur WhatsApp.
                  </p>
                </div>

                <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                  Une fois votre paiement effectué sur l'application Wave, l'équipe valide votre commande. Votre pass avec QR Code unique sera accessible directement dans l'onglet <strong className="text-white">Mes Billets</strong>.
                </p>

                {openedWaveUrl && (
                  <div className="pt-2">
                    <a
                      href={openedWaveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-[#1DC3F4] hover:underline font-semibold"
                    >
                      <span>L'application ne s'est pas ouverte ? Cliquez ici</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="p-5 bg-[#141414] border-t border-white/10 flex items-center justify-between gap-4">
            {step === 'select' && (
              <>
                {isSalesUpcoming ? (
                  /* En mode ventes non ouvertes : affichage informatif et bouton de fermeture */
                  <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-[#DCB8FF]">
                      <Clock className="w-4 h-4 text-[#E9C349]" />
                      <span>Inscrivez-vous ci-dessus pour être alerté en priorité.</span>
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-heading font-bold text-xs uppercase tracking-wider transition-all"
                    >
                      Fermer
                    </button>
                  </div>
                ) : (
                  /* En mode ventes ouvertes : Total et Bouton Wave */
                  <>
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Total à payer</p>
                      <div className="flex items-baseline gap-2">
                        <p className="font-heading text-xl sm:text-2xl font-extrabold text-[#E9C349]">
                          {totalPrice.toLocaleString('fr-FR')} FCFA
                        </p>
                        {discountAmount > 0 && (
                          <span className="text-xs text-gray-400 line-through font-mono">
                            {baseTotalPrice.toLocaleString('fr-FR')} F
                          </span>
                        )}
                      </div>
                    </div>

                    {!isAuthenticated || !isEmailConfirmed ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (onRequireAuth) {
                            onRequireAuth();
                          } else {
                            setErrorMessage('Veuillez confirmer votre adresse email pour continuer.');
                          }
                        }}
                        className="flex-1 max-w-sm py-3.5 px-6 rounded-2xl font-heading font-extrabold text-xs sm:text-sm tracking-wider uppercase flex items-center justify-center gap-2.5 transition-all shadow-lg bg-[#241A00] hover:bg-[#362700] text-[#E9C349] border border-[#E9C349]/40 hover:scale-[1.02] active:scale-[0.98]"
                      >
                        <AlertCircle className="w-4 h-4 text-[#E9C349]" />
                        <span>Veuillez confirmer votre email</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleWaveCheckout}
                        disabled={isProcessing || selectedTier.available < quantity}
                        className="flex-1 max-w-sm py-3.5 px-6 rounded-2xl font-heading font-extrabold text-xs sm:text-sm tracking-wider uppercase flex items-center justify-center gap-2.5 transition-all shadow-lg bg-[#1DC3F4] hover:bg-[#1bb3e0] text-[#07131D] shadow-[#1DC3F4]/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <div className="flex items-center gap-2">
                            <span className="w-4 h-4 border-2 border-[#07131D] border-t-transparent rounded-full animate-spin" />
                            <span>Enregistrement...</span>
                          </div>
                        ) : (
                          <>
                            <Smartphone className="w-4 h-4 fill-current" />
                            <span>Payer {totalPrice.toLocaleString('fr-FR')} FCFA avec Wave</span>
                          </>
                        )}
                      </button>
                    )}
                  </>
                )}
              </>
            )}

            {step === 'confirmation' && (
              <button
                onClick={onClose}
                className="w-full py-3.5 px-6 rounded-2xl font-heading font-bold text-xs tracking-wider uppercase transition-all bg-[#8A2BE2] hover:bg-[#7824c7] text-white shadow-lg shadow-[#8A2BE2]/25"
              >
                Compris, fermer
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MODALE TEASER VIDÉO YOUTUBE 16:9 AVEC LAZY LOADING (TÂCHE 4) */}
      {isTeaserOpen && youtubeVideoId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl bg-[#0D0C12] border border-[#8A2BE2]/50 rounded-3xl overflow-hidden shadow-2xl">
            {/* Header de la modale vidéo */}
            <div className="p-4 bg-[#14131A] border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Youtube className="w-5 h-5 text-red-500" />
                <h3 className="font-heading font-extrabold text-sm sm:text-base text-white truncate max-w-md">
                  Teaser Officiel : {event.title}
                </h3>
              </div>
              <button
                onClick={() => setIsTeaserOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Container Iframe YouTube 16:9 Lazy Loadé */}
            <div className="relative w-full pb-[56.25%] bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&rel=0&modestbranding=1`}
                title={`Teaser ${event.title}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full border-none"
              />
            </div>

            {/* Footer de la modale vidéo */}
            <div className="p-3.5 bg-[#14131A] border-t border-white/10 flex items-center justify-between text-xs text-gray-400">
              <span className="truncate">Produit et partagé par {event.promoter.name}</span>
              <button
                onClick={() => setIsTeaserOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs"
              >
                Fermer la vidéo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
