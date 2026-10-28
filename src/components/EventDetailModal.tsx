import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SafeImage } from './SafeImage';
import confetti from 'canvas-confetti';
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
  Zap,
  AlignLeft,
  Ticket,
  Info,
  MessageSquare,
  Percent,
  Check,
  Play,
  Bell,
  Send,
  Copy,
  Lock,
  ArrowLeft,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { EventItem, TicketTier, UserTicket, OrderRecord } from '../types';
import { getOptimizedImageUrl } from '../utils/imageOptimizer';
import {
  createOrderWithStockCheck,
  registerEventPreRegistration,
  getSupabaseClient,
  ensureGuestOrUserSession,
  signalOrderPayment,
} from '../services/supabase';
import { TurnstileGate, type TurnstileGateHandle } from './TurnstileGate';
import { CountdownTimer } from './CountdownTimer';
import { SpotifyVinylPlayer } from './SpotifyVinylPlayer';

const TikTokIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .58.04.86.12V9.42a6.34 6.34 0 0 0-.86-.06 6.34 6.34 0 1 0 6.34 6.34V9.05a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.48z" />
  </svg>
);

export type ModalFlow = 'details' | 'step_captcha' | 'step_contact' | 'step_tickets' | 'step_payment' | 'confirmation';

interface EventDetailModalProps {
  event: EventItem | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated?: (order: OrderRecord) => void;
  onPurchaseSuccess?: (ticket: UserTicket) => void;
  onNavigateToTickets?: () => void;
  userName: string;
  userEmail?: string;
  isEmailConfirmed?: boolean;
  isAuthenticated?: boolean;
  onRequireAuth?: () => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  isOpen,
  onClose,
  onOrderCreated,
  onPurchaseSuccess,
  onNavigateToTickets,
  userName,
  userEmail = '',
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

  // State Machine du tunnel par étapes
  const [flow, setFlow] = useState<ModalFlow>('details');
  const [selectedTier, setSelectedTier] = useState<TicketTier>(defaultTier);
  const [quantity, setQuantity] = useState(1);

  // Guest Checkout : champs strictement vides par défaut si non connecté
  const [customerName, setCustomerName] = useState(
    isAuthenticated && userName && userName.trim().toLowerCase() !== 'utilisateur' ? userName : ''
  );
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerEmail, setCustomerEmail] = useState(
    isAuthenticated && userEmail ? userEmail : ''
  );

  const [isSignalingPayment, setIsSignalingPayment] = useState(false);
  const [paymentSignaledSuccess, setPaymentSignaledSuccess] = useState(false);
  const modalScrollRef = useRef<HTMLDivElement | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Active Order state once created in Supabase
  const [activeOrder, setActiveOrder] = useState<OrderRecord | null>(null);
  const [openedWaveUrl, setOpenedWaveUrl] = useState<string | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  // Captcha & Session vérifiée
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [hasVerifiedSession, setHasVerifiedSession] = useState<boolean>(Boolean(isAuthenticated));
  const turnstileRef = useRef<TurnstileGateHandle | null>(null);
  const checkoutLockRef = useRef<boolean>(false);

  // Conversion compte invité
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPassword, setGuestPassword] = useState('');
  const [isConvertingAccount, setIsConvertingAccount] = useState(false);
  const [accountConverted, setAccountConverted] = useState(false);
  const [accountConvertError, setAccountConvertError] = useState<string | null>(null);

  // Codes Promo
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discountPercent: number;
    discountAmount: number;
  } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [isPromoExpanded, setIsPromoExpanded] = useState(false);

  // Teaser Vidéo YouTube
  const [isTeaserOpen, setIsTeaserOpen] = useState(false);

  // Pré-inscription (quand ventes fermées)
  const [preRegName, setPreRegName] = useState(userName || '');
  const [preRegPhone, setPreRegPhone] = useState('');
  const [preRegEmail, setPreRegEmail] = useState('');
  const [isPreRegSubmitting, setIsPreRegSubmitting] = useState(false);
  const [preRegSuccess, setPreRegSuccess] = useState<string | null>(null);

  const isSalesUpcoming = Boolean(
    event.salesOpenAt && new Date(event.salesOpenAt).getTime() > Date.now()
  );

  useEffect(() => {
    let active = true;
    if (isAuthenticated) {
      setHasVerifiedSession(true);
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      setHasVerifiedSession(false);
      return;
    }
    supabase.auth
      .getSession()
      .then(async ({ data: sessionData }) => {
        if (!active) return;
        if (sessionData?.session) {
          const { data: userData, error: userErr } = await supabase.auth.getUser();
          if (active) {
            setHasVerifiedSession(Boolean(!userErr && userData?.user));
          }
        } else {
          setHasVerifiedSession(false);
        }
      })
      .catch(() => {
        if (active) setHasVerifiedSession(false);
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated, event.id]);

  // Synchronisation des coordonnées utilisateur si authentifié
  useEffect(() => {
    if (isAuthenticated) {
      if (userName && userName.trim().toLowerCase() !== 'utilisateur') {
        setCustomerName((prev) => (prev ? prev : userName));
      }
      if (userEmail) {
        setCustomerEmail((prev) => (prev ? prev : userEmail));
      }
    }
  }, [isAuthenticated, userName, userEmail]);

  // Scroll reset instantané à chaque changement de flow
  useEffect(() => {
    if (modalScrollRef.current) {
      modalScrollRef.current.scrollTo({ top: 0, behavior: 'instant' });
    }
    if (flow === 'confirmation' && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [flow]);

  // Transition automatique dès réception du CAPTCHA
  useEffect(() => {
    if (flow === 'step_captcha' && captchaToken) {
      const timer = setTimeout(() => {
        setFlow('step_contact');
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [flow, captchaToken]);

  const handleCloseModal = () => {
    onClose();
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Signalement immédiat du paiement Wave
  const handleSignalTransfer = async () => {
    if (!activeOrder) return;
    setIsSignalingPayment(true);
    try {
      const res = await signalOrderPayment(activeOrder.id, activeOrder.reference);
      if (res.success && res.order) {
        setActiveOrder(res.order);
        setPaymentSignaledSuccess(true);
      }
    } catch (e: any) {
      console.warn('Erreur signalement transfert:', e);
    } finally {
      setIsSignalingPayment(false);
    }
  };

  // Validation coordonnées : Nom (≥2) + (Tél valide OU Email valide)
  const isCustomerNameFilled = customerName.trim().length >= 2;
  const isPhoneFilled = phoneNumber.trim().replace(/\s/g, '').length >= 7;
  const isEmailFilled = customerEmail.trim().length >= 5 && customerEmail.includes('@') && customerEmail.includes('.');
  const isContactInfoValid = isCustomerNameFilled && (isPhoneFilled || isEmailFilled);

  // Extraction ID YouTube
  const extractYouTubeId = (url?: string): string | null => {
    if (!url) return null;
    const trimmed = url.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
    const match = trimmed.match(
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i
    );
    return match ? match[1] : null;
  };
  const youtubeVideoId = extractYouTubeId(event.videoSpotUrl || event.youtubeUrl || event.socialYoutube);

  // Formules actives
  const activeTiers = useMemo(() => {
    const rawTiers = event.tiers && event.tiers.length > 0 ? event.tiers : [defaultTier];
    const availableTiers = rawTiers.filter((t) => t.isActive !== false && t.available > 0);
    return availableTiers.length > 0 ? availableTiers : rawTiers.filter((t) => t.isActive !== false);
  }, [event.tiers, defaultTier]);

  const tiers = activeTiers;
  const baseTotalPrice = selectedTier.price * quantity;
  const discountAmount = appliedPromo
    ? Math.round((baseTotalPrice * appliedPromo.discountPercent) / 100)
    : 0;
  const totalPrice = Math.max(0, baseTotalPrice - discountAmount);

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
      `🎟️ *Événement :* ${order.eventTitle}\n` +
      `📋 *Formule :* ${order.tierName} (x${order.quantity} place${order.quantity > 1 ? 's' : ''})\n` +
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
    if (nameLower.includes('vip') && event.waveLinkVip && event.waveLinkVip.trim().startsWith('http')) return event.waveLinkVip.trim();
    if (nameLower.includes('jour') && event.waveLinkJourJ && event.waveLinkJourJ.trim().startsWith('http')) return event.waveLinkJourJ.trim();
    if ((nameLower.includes('prévente') || nameLower.includes('prevente')) && event.waveLinkPrevente && event.waveLinkPrevente.trim().startsWith('http')) {
      return event.waveLinkPrevente.trim();
    }
    if (event.waveLinkPrevente && event.waveLinkPrevente.trim().startsWith('http')) return event.waveLinkPrevente.trim();
    return '';
  };

  // Traitement Wave Checkout
  const handleWaveCheckout = async () => {
    if (checkoutLockRef.current) return;
    checkoutLockRef.current = true;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      let resolvedUserId: string | undefined = undefined;
      const supabase = getSupabaseClient();

      if (supabase) {
        const sessionRes = await ensureGuestOrUserSession(captchaToken);
        if (!sessionRes.reused) {
          turnstileRef.current?.resetToken();
        }
        if (sessionRes.error) {
          setErrorMessage(sessionRes.error);
          return;
        }
        if (sessionRes.user?.id) {
          resolvedUserId = sessionRes.user.id;
          setHasVerifiedSession(true);
        }
      }

      const cleanName = customerName.trim() || 'Client Thièsdn';
      const cleanPhone = phoneNumber.trim().startsWith('+221')
        ? phoneNumber.trim()
        : `+221 ${phoneNumber.trim()}`;

      const result = await createOrderWithStockCheck(
        event,
        selectedTier,
        quantity,
        {
          name: cleanName,
          phone: cleanPhone,
          paymentMethod: 'wave',
          userId: resolvedUserId,
          customTotal: totalPrice,
          discountAmount: discountAmount > 0 ? discountAmount : undefined,
          promoCodeApplied: appliedPromo ? appliedPromo.code : undefined,
          email: customerEmail.trim() || undefined,
        }
      );

      if (!result.success || !result.order) {
        setErrorMessage(result.message || 'Impossible d’enregistrer la commande.');
        return;
      }

      const order = result.order;
      setActiveOrder(order);

      if (onOrderCreated) onOrderCreated(order);

      let waveUrl = resolveWaveUrl(selectedTier);
      if (waveUrl && waveUrl.startsWith('http')) {
        const sep = waveUrl.includes('?') ? '&' : '?';
        const successUrl = encodeURIComponent('https://billetterie.thiesdn.site/?payment=success');
        const errorUrl = encodeURIComponent('https://billetterie.thiesdn.site/?payment=error');
        waveUrl = `${waveUrl}${sep}success_url=${successUrl}&error_url=${errorUrl}`;
      }
      setOpenedWaveUrl(waveUrl);

      if (typeof window !== 'undefined') {
        window.open(waveUrl, '_blank', 'noopener,noreferrer');
      }

      setFlow('confirmation');
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors du traitement de votre commande.');
    } finally {
      setIsProcessing(false);
      checkoutLockRef.current = false;
    }
  };

  // CTA Secours : Paiement manuel déjà transféré
  const handleManualTransferCheckout = async () => {
    if (checkoutLockRef.current) return;
    checkoutLockRef.current = true;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      let resolvedUserId: string | undefined = undefined;
      const supabase = getSupabaseClient();
      if (supabase) {
        const sessionRes = await ensureGuestOrUserSession(captchaToken);
        if (sessionRes.user?.id) {
          resolvedUserId = sessionRes.user.id;
          setHasVerifiedSession(true);
        }
      }

      const cleanName = customerName.trim() || 'Client Thièsdn';
      const cleanPhone = phoneNumber.trim().startsWith('+221')
        ? phoneNumber.trim()
        : `+221 ${phoneNumber.trim()}`;

      const result = await createOrderWithStockCheck(
        event,
        selectedTier,
        quantity,
        {
          name: cleanName,
          phone: cleanPhone,
          paymentMethod: 'wave',
          userId: resolvedUserId,
          customTotal: totalPrice,
          discountAmount: discountAmount > 0 ? discountAmount : undefined,
          promoCodeApplied: appliedPromo ? appliedPromo.code : undefined,
          email: customerEmail.trim() || undefined,
        }
      );

      if (!result.success || !result.order) {
        setErrorMessage(result.message || 'Impossible d’enregistrer la commande.');
        return;
      }

      const order = result.order;
      setActiveOrder(order);
      if (onOrderCreated) onOrderCreated(order);

      // Signalement automatique du transfert manuel
      await signalOrderPayment(order.id, order.reference);
      setPaymentSignaledSuccess(true);
      setFlow('confirmation');
    } catch (err: any) {
      setErrorMessage(err.message || 'Erreur lors de l’enregistrement de votre commande.');
    } finally {
      setIsProcessing(false);
      checkoutLockRef.current = false;
    }
  };

  // Conversion du compte invité anonyme
  const handleConvertGuestAccount = async () => {
    if (!guestEmail.trim() || guestPassword.length < 6) {
      setAccountConvertError('Veuillez saisir un email valide et un mot de passe d’au moins 6 caractères.');
      return;
    }
    setIsConvertingAccount(true);
    setAccountConvertError(null);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error('Service Supabase indisponible');
      const { error } = await supabase.auth.updateUser({
        email: guestEmail.trim().toLowerCase(),
        password: guestPassword,
      });
      if (error) throw error;
      setAccountConverted(true);
    } catch (err: any) {
      setAccountConvertError(err.message || 'Impossible d’associer le compte.');
    } finally {
      setIsConvertingAccount(false);
    }
  };

  // Pré-inscription
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

  // Démarrer la réservation
  const handleStartBooking = () => {
    if (!isAuthenticated && !hasVerifiedSession && !captchaToken) {
      setFlow('step_captcha');
    } else {
      setFlow('step_contact');
    }
  };

  // Index de l'étape pour le stepper (1 à 4)
  const currentStepNum = flow === 'step_captcha' ? 1
    : flow === 'step_contact' ? 2
    : flow === 'step_tickets' ? 3
    : flow === 'step_payment' ? 4
    : 4;

  const isWizardActive = flow !== 'details';

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto"
      >
        <motion.div
          initial={{ opacity: 0, y: 35, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-h-[88dvh] max-w-xl bg-[#181926] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col"
        >
          {/* ============================================================== */}
          {/* HEADER : Deux modes selon le flow                             */}
          {/* 1. Mode Details : Poster Header avec Image                      */}
          {/* 2. Mode Wizard (flow !== 'details') : Header ultra-compact <48px*/}
          {/* ============================================================== */}
          {flow === 'details' ? (
            <div className="relative h-44 sm:h-52 w-full flex-shrink-0">
              <SafeImage
                src={getOptimizedImageUrl(event.posterUrl, 1200, 85)}
                rawSrc={event.posterUrl}
                alt={event.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#181926] via-black/40 to-transparent" />

              {/* Contrôles supérieurs */}
              <div className="absolute top-3 inset-x-3 flex items-center justify-between z-10 gap-2">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
                  <span className="bg-[#121118]/85 backdrop-blur-md text-[#E9C349] border border-[#E9C349]/30 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1.5 shrink-0">
                    <Tag className="w-3.5 h-3.5" />
                    {event.category}
                  </span>
                  <span className="bg-[#8A2BE2]/90 backdrop-blur-md text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1 max-w-full min-w-0 truncate">
                    <MapPin className="w-3 h-3 shrink-0" />
                    <span className="truncate">{event.city}{event.quartier ? ` • ${event.quartier}` : ''}</span>
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <a
                    href={whatsappShareEventUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full bg-emerald-600/80 hover:bg-emerald-500 backdrop-blur-md text-white flex items-center justify-center border border-emerald-400/30 transition-all hover:scale-105 shadow-lg"
                    title="Partager sur WhatsApp"
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
                    onClick={handleCloseModal}
                    className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-md text-white hover:bg-white/20 flex items-center justify-center border border-white/10 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Titre & Teaser bouton sur poster */}
              <div className="absolute bottom-3 inset-x-4 z-10 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {event.isExclusive && (
                    <span className="bg-[#E9C349] text-[#241A00] text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full mb-1 inline-flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Soirée Exclusive
                    </span>
                  )}
                  <h2 className="font-heading text-lg sm:text-xl font-extrabold text-white leading-tight truncate">
                    {event.title}
                  </h2>
                </div>

                {(youtubeVideoId || event.videoSpotUrl || event.youtubeUrl || event.socialYoutube) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (youtubeVideoId) {
                        setIsTeaserOpen(true);
                      } else {
                        const targetUrl = event.videoSpotUrl || event.youtubeUrl || event.socialYoutube;
                        if (targetUrl && typeof window !== 'undefined') {
                          window.open(targetUrl, '_blank', 'noopener,noreferrer');
                        }
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#8A2BE2] hover:bg-[#7824c7] text-white font-heading font-extrabold text-xs uppercase tracking-wider shadow-md shadow-[#8A2BE2]/30 hover:scale-105 transition-all shrink-0 border border-white/20 self-start sm:self-auto"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Teaser</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* HEADER ULTRA-COMPACT (<48px) DÈS QUE FLOW !== 'DETAILS' */
            <div className="h-12 px-3 sm:px-4 bg-[#10111A] border-b border-white/10 flex items-center justify-between gap-2 flex-shrink-0 z-20">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {flow !== 'confirmation' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (flow === 'step_payment') setFlow('step_tickets');
                      else if (flow === 'step_tickets') setFlow('step_contact');
                      else if (flow === 'step_contact') {
                        if (!isAuthenticated && !hasVerifiedSession) setFlow('step_captcha');
                        else setFlow('details');
                      } else if (flow === 'step_captcha') setFlow('details');
                    }}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
                    title="Étape précédente"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-heading text-xs font-bold text-white truncate leading-tight">
                    {event.title}
                  </h3>
                  <span className="text-[10px] text-[#E9C349] font-medium flex items-center gap-1">
                    <MapPin className="w-2.5 h-2.5" />
                    <span>{event.city}</span>
                  </span>
                </div>
              </div>

              {/* Stepper 4 points/barres néon */}
              {flow !== 'confirmation' && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/40 border border-white/5">
                  {[1, 2, 3, 4].map((step) => {
                    const isActive = step === currentStepNum;
                    const isPassed = step < currentStepNum;
                    return (
                      <div
                        key={step}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          isActive
                            ? 'w-5 bg-gradient-to-r from-[#8A2BE2] to-[#E9C349] shadow-sm shadow-[#E9C349]/50'
                            : isPassed
                            ? 'w-2 bg-[#8A2BE2]'
                            : 'w-2 bg-white/15'
                        }`}
                      />
                    );
                  })}
                  <span className="text-[10px] font-mono font-bold text-[#E9C349] ml-1">
                    {currentStepNum}/4
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={handleCloseModal}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-gray-400 hover:text-white flex items-center justify-center transition-colors"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ============================================================== */}
          {/* BODY SCROLLABLE (Reset instantané à chaque étape)              */}
          {/* ============================================================== */}
          <div
            ref={modalScrollRef}
            className="p-3 sm:p-5 overflow-y-auto space-y-4 flex-1 select-none"
          >
            {errorMessage && (
              <div className="p-3 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span className="flex-1">{errorMessage}</span>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="text-rose-400 hover:text-white text-xs font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            {/* ============================================================ */}
            {/* VUE 0 : DETAILS (Affichage complet initial)                  */}
            {/* ============================================================ */}
            {flow === 'details' && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Ventes non ouvertes : Compte à rebours */}
                {isSalesUpcoming && event.salesOpenAt && (
                  <div className="bg-gradient-to-br from-[#1F172E] to-[#120F1D] p-4 rounded-2xl border border-[#8A2BE2]/40 shadow-lg space-y-3">
                    <div className="flex items-center gap-2 text-[#E9C349]">
                      <Clock className="w-4 h-4" />
                      <span className="text-xs font-heading font-extrabold uppercase tracking-wider">
                        Ouverture des Ventes
                      </span>
                    </div>
                    <CountdownTimer targetDate={event.salesOpenAt} />

                    {/* Formulaire Pré-inscription */}
                    {!preRegSuccess ? (
                      <form onSubmit={handlePreRegister} className="pt-2 space-y-2 border-t border-white/10">
                        <p className="text-[11px] text-gray-300">
                          Soyez alerté en priorité dès l'ouverture des billets.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={preRegName}
                            onChange={(e) => setPreRegName(e.target.value)}
                            placeholder="Votre nom complet"
                            className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#E9C349]"
                          />
                          <input
                            type="tel"
                            value={preRegPhone}
                            onChange={(e) => setPreRegPhone(e.target.value)}
                            placeholder="Téléphone Wave (+221)"
                            className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#E9C349]"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={isPreRegSubmitting}
                          className="w-full py-2.5 rounded-xl bg-[#E9C349] hover:bg-[#f5d56b] text-[#241A00] font-heading font-bold text-xs uppercase tracking-wider transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          <Bell className="w-3.5 h-3.5 fill-current" />
                          <span>{isPreRegSubmitting ? 'Enregistrement...' : 'Me notifier à l’ouverture'}</span>
                        </button>
                      </form>
                    ) : (
                      <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{preRegSuccess}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Date & Lieu */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-[#10111A] p-3.5 rounded-2xl border border-white/5 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#8A2BE2]/20 text-[#DCB8FF] flex items-center justify-center shrink-0">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-gray-400">Date & Heure</p>
                      <p className="font-semibold text-white">{event.date} • {event.time}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#E9C349]/20 text-[#E9C349] flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <p className="text-[10px] uppercase font-bold text-gray-400">Lieu</p>
                      <p className="font-semibold text-white truncate">{event.venue}, {event.city}</p>
                    </div>
                  </div>
                </div>

                {/* Spotify Vinyl Player */}
                {event.spotifyUrl && (
                  <SpotifyVinylPlayer
                    spotifyUrl={event.spotifyUrl}
                    posterUrl={event.posterUrl}
                    eventTitle={event.title}
                  />
                )}

                {/* Description */}
                {(event.description || event.longDescription) && (
                  <div className="bg-[#10111A] p-3.5 rounded-2xl border border-white/5 space-y-2 text-xs">
                    <h4 className="font-heading font-bold text-[#DCB8FF] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <AlignLeft className="w-3.5 h-3.5 text-[#E9C349]" />
                      <span>À Propos</span>
                    </h4>
                    {event.description && (
                      <p className="text-gray-300 leading-relaxed font-medium">{event.description}</p>
                    )}
                    {event.longDescription && (
                      <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-gray-300 leading-relaxed whitespace-pre-line text-[11px]">
                        {event.longDescription}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* ÉTAPE 1 : step_captcha (Vérification Sécurité)               */}
            {/* ============================================================ */}
            {flow === 'step_captcha' && (
              <div className="py-4 text-center space-y-4 animate-in fade-in duration-200">
                <div className="w-12 h-12 rounded-2xl bg-[#8A2BE2]/20 border border-[#8A2BE2]/40 text-[#DCB8FF] flex items-center justify-center mx-auto shadow-lg shadow-[#8A2BE2]/20">
                  <ShieldCheck className="w-6 h-6 text-[#E9C349]" />
                </div>
                <div>
                  <h3 className="font-heading text-base font-extrabold text-white">
                    Vérification de Sécurité
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                    Protection anti-robot instantanée avant d'accéder à la réservation.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[#10111A] border border-white/10 flex justify-center items-center min-h-[100px] overflow-hidden max-w-sm mx-auto">
                  <TurnstileGate
                    ref={turnstileRef}
                    onTokenChange={setCaptchaToken}
                  />
                </div>

                {captchaToken ? (
                  <div className="space-y-2 animate-in fade-in">
                    <div className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Vérification réussie ! Redirection...</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFlow('step_contact')}
                      className="w-full py-3 rounded-xl bg-[#E9C349] hover:bg-[#F3D779] text-[#241A00] font-heading font-extrabold text-xs uppercase tracking-wider transition-all"
                    >
                      Continuer vers mes coordonnées →
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-500">
                    Cochez la case ci-dessus pour continuer automatiquement.
                  </p>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* ÉTAPE 2 : step_contact (Coordonnées Réception)              */}
            {/* ============================================================ */}
            {flow === 'step_contact' && (
              <div className="space-y-3.5 animate-in fade-in duration-200">
                <div>
                  <h3 className="font-heading text-sm font-extrabold text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#8A2BE2] text-white text-[11px] flex items-center justify-center font-bold">
                      2
                    </span>
                    <span>Coordonnées de Réception</span>
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Indiquez le nom du titulaire et votre contact pour recevoir vos billets officiels.
                  </p>
                </div>

                <div className="space-y-2.5 bg-[#10111A] p-3.5 rounded-2xl border border-white/5">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1 flex items-center justify-between">
                      <span>Nom complet du participant</span>
                      <span className="text-[#E9C349] font-bold text-[9px]">* Requis (≥2 car.)</span>
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Prénom et Nom"
                      className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-medium outline-none focus:border-[#E9C349] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1 flex items-center justify-between">
                      <span>Numéro Mobile Wave</span>
                      <span className="text-gray-400 text-[9px]">Tél. ou Email requis</span>
                    </label>
                    <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 focus-within:border-[#1DC3F4] transition-colors">
                      <span className="text-xs font-bold text-[#1DC3F4] tracking-wider">+221</span>
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="77 123 45 67"
                        className="w-full bg-transparent border-none outline-none text-white text-xs font-mono p-0"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1 flex items-center justify-between">
                      <span>Email de réception</span>
                      <span className="text-gray-400 text-[9px]">Recommandé</span>
                    </label>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => setCustomerEmail(e.target.value)}
                      placeholder="votre@email.com"
                      className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-medium outline-none focus:border-[#E9C349] transition-colors"
                    />
                  </div>
                </div>

                {!isContactInfoValid && (
                  <div className="p-2.5 rounded-xl bg-amber-950/40 border border-[#E9C349]/30 text-amber-300 text-[11px] flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-[#E9C349] shrink-0" />
                    <span>Renseignez votre nom et au moins un contact (téléphone ou email).</span>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================ */}
            {/* ÉTAPE 3 : step_tickets (Formules & Quantité)                 */}
            {/* ============================================================ */}
            {flow === 'step_tickets' && (
              <div className="space-y-3.5 animate-in fade-in duration-200">
                <div>
                  <h3 className="font-heading text-sm font-extrabold text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#8A2BE2] text-white text-[11px] flex items-center justify-center font-bold">
                      3
                    </span>
                    <span>Choix de la Formule</span>
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Sélectionnez votre pass et le nombre de places souhaité.
                  </p>
                </div>

                {/* Formules en Radio Cards */}
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {tiers.map((tier) => {
                    const isSelected = selectedTier.id === tier.id;
                    const isVipTier = tier.name.toLowerCase().includes('vip') || tier.name.toLowerCase().includes('salon');
                    return (
                      <div
                        key={tier.id}
                        onClick={() => setSelectedTier(tier)}
                        className={`p-3 rounded-2xl cursor-pointer transition-all border flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-[#E9C349]/10 border-[#E9C349] shadow-md shadow-[#E9C349]/10'
                            : 'bg-[#10111A] border-white/5 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                              isSelected ? 'border-[#E9C349] bg-[#E9C349]' : 'border-gray-500'
                            }`}
                          >
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-heading font-bold text-xs text-white truncate">
                                {tier.name}
                              </span>
                              {isVipTier && (
                                <span className="bg-[#E9C349] text-[#241A00] text-[8px] font-black px-1.5 py-0.2 rounded-full shrink-0">
                                  VIP
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-400 truncate">{tier.description}</p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-heading font-extrabold text-xs text-[#E9C349]">
                            {tier.price.toLocaleString('fr-FR')} F
                          </span>
                          <p className="text-[9px] text-gray-400">
                            {tier.available > 5 ? `${tier.available} dispo` : `⚠️ Plus que ${tier.available} !`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Quantité & Code Promo */}
                <div className="p-3 bg-[#10111A] rounded-2xl border border-white/5 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-300 text-[11px]">Nombre de places</p>
                      <p className="text-[10px] text-gray-400">Disponibles : {selectedTier.available}</p>
                    </div>
                    <div className="flex items-center gap-3 bg-black/40 px-2 py-1 rounded-xl border border-white/10">
                      <button
                        type="button"
                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                        className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition-colors"
                      >
                        -
                      </button>
                      <span className="font-heading font-bold text-sm text-white px-1">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity(Math.min(Math.min(10, selectedTier.available), quantity + 1))}
                        className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Code Promo compact 1-ligne */}
                  <div className="pt-2 border-t border-white/5">
                    {!appliedPromo ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={promoInput}
                          onChange={(e) => setPromoInput(e.target.value.toUpperCase().replace(/\s/g, ''))}
                          placeholder="Code promo (ex: THIES2027)"
                          className="flex-1 bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono uppercase font-bold outline-none focus:border-[#E9C349]"
                        />
                        <button
                          type="button"
                          onClick={handleApplyPromo}
                          className="px-3 py-1.5 rounded-xl bg-[#241A00] hover:bg-[#362700] text-[#E9C349] border border-[#E9C349]/40 text-[11px] font-bold transition-colors"
                        >
                          Appliquer
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-[11px]">
                        <span className="text-emerald-300 font-medium">
                          🎁 Code <strong>{appliedPromo.code}</strong> (-{discountAmount.toLocaleString('fr-FR')} F)
                        </span>
                        <button
                          type="button"
                          onClick={handleRemovePromo}
                          className="text-gray-400 hover:text-white underline font-bold text-[10px]"
                        >
                          Retirer
                        </button>
                      </div>
                    )}
                    {promoError && (
                      <p className="text-[10px] text-rose-400 mt-1">{promoError}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* ÉTAPE 4 : step_payment (Récapitulatif & Déclenchement Wave)   */}
            {/* ============================================================ */}
            {flow === 'step_payment' && (
              <div className="space-y-3.5 animate-in fade-in duration-200">
                <div>
                  <h3 className="font-heading text-sm font-extrabold text-white flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#8A2BE2] text-white text-[11px] flex items-center justify-center font-bold">
                      4
                    </span>
                    <span>Récapitulatif & Paiement</span>
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Vérifiez les détails avant d'ouvrir l'application Wave.
                  </p>
                </div>

                {/* Mini-carte Récapitulative Or Impérial */}
                <div className="p-3.5 rounded-2xl bg-[#10111A] border border-[#E9C349]/30 shadow-lg shadow-[#E9C349]/5 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-gray-400">
                    <span>Événement :</span>
                    <strong className="text-white text-right truncate max-w-[180px]">{event.title}</strong>
                  </div>
                  <div className="flex justify-between items-center text-gray-400">
                    <span>Formule :</span>
                    <strong className="text-white">{selectedTier.name} (x{quantity})</strong>
                  </div>
                  <div className="flex justify-between items-center text-gray-400">
                    <span>Titulaire :</span>
                    <strong className="text-white">{customerName}</strong>
                  </div>
                  <div className="flex justify-between items-center text-gray-400">
                    <span>Contact :</span>
                    <span className="text-gray-300 font-mono text-[11px]">
                      {phoneNumber ? `+221 ${phoneNumber}` : customerEmail}
                    </span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex justify-between items-center text-emerald-400 font-semibold pt-1 border-t border-white/5">
                      <span>Réduction ({appliedPromo?.code}) :</span>
                      <span>-{discountAmount.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-white/10 flex justify-between items-baseline">
                    <span className="font-bold text-gray-300">Total à payer :</span>
                    <span className="font-heading font-extrabold text-xl text-[#E9C349] tracking-tight">
                      {totalPrice.toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                </div>

                {/* Bouton Principal Wave Cyan */}
                <button
                  type="button"
                  onClick={handleWaveCheckout}
                  disabled={isProcessing}
                  className="w-full h-12 py-3 px-6 rounded-2xl font-heading font-extrabold text-xs sm:text-sm tracking-wider uppercase flex items-center justify-center gap-2.5 transition-all shadow-lg bg-[#00D2FF] hover:bg-[#00b8e6] text-[#07131D] shadow-[#00D2FF]/25 active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isProcessing ? (
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-[#07131D] border-t-transparent rounded-full animate-spin" />
                      <span>Génération de la commande...</span>
                    </div>
                  ) : (
                    <>
                      <Smartphone className="w-4 h-4 fill-current" />
                      <span>Payer {totalPrice.toLocaleString('fr-FR')} FCFA avec Wave</span>
                    </>
                  )}
                </button>

                {/* CTA Secours : J'ai déjà transféré manuellement */}
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={handleManualTransferCheckout}
                    disabled={isProcessing}
                    className="text-[11px] text-gray-400 hover:text-[#00D2FF] underline transition-colors"
                  >
                    J'ai déjà transféré manuellement via Wave
                  </button>
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* VUE CONFIRMATION : Suivi Post-Paiement (Zero-scroll)         */}
            {/* ============================================================ */}
            {flow === 'confirmation' && activeOrder && (
              <div className="py-2 text-center space-y-3.5 animate-in fade-in duration-300">
                {/* Badge Statut Animé */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#00D2FF]/15 text-[#00D2FF] border border-[#00D2FF]/30">
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  <span>Paiement en cours de vérification</span>
                </div>

                <h3 className="font-heading text-lg font-extrabold text-white">
                  Commande Enregistrée !
                </h3>

                {/* Ticket Stub Card */}
                <div className="p-3.5 rounded-2xl bg-[#10111A] border-2 border-[#00D2FF]/40 text-center max-w-sm mx-auto space-y-2 shadow-lg shadow-[#00D2FF]/10">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Référence de Commande
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-mono text-xl sm:text-2xl font-black text-[#00D2FF] tracking-wider selection:bg-[#00D2FF] selection:text-black">
                      {activeOrder.reference}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(activeOrder.reference);
                        setCopiedRef(true);
                        setTimeout(() => setCopiedRef(false), 2500);
                      }}
                      className="p-1.5 px-2.5 rounded-xl bg-[#00D2FF]/20 hover:bg-[#00D2FF]/30 text-[#00D2FF] transition-all text-xs font-bold flex items-center gap-1"
                      title="Copier"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedRef ? 'Copié' : 'Copier'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-[#E9C349] font-medium leading-snug bg-[#241A00]/60 p-2 rounded-xl border border-[#E9C349]/20">
                    💡 Mentionnez ce code dans le motif de votre transfert Wave.
                  </p>
                  <div className="text-right text-xs pt-1 border-t border-white/5 flex justify-between items-center text-gray-400">
                    <span>Montant total :</span>
                    <strong className="text-[#E9C349] font-extrabold font-mono text-sm">
                      {activeOrder.totalAmount.toLocaleString('fr-FR')} FCFA
                    </strong>
                  </div>
                </div>

                {/* Actions Clés Zero-Scroll */}
                <div className="space-y-2 max-w-sm mx-auto">
                  {/* Bouton J'ai effectué le transfert Wave */}
                  {!paymentSignaledSuccess && activeOrder.status === 'pending' ? (
                    <button
                      type="button"
                      onClick={handleSignalTransfer}
                      disabled={isSignalingPayment}
                      className="w-full py-3 px-4 rounded-2xl font-heading font-extrabold text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-all shadow-md bg-[#00D2FF] hover:bg-[#00b8e6] text-[#07131D] shadow-[#00D2FF]/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {isSignalingPayment ? (
                        <div className="flex items-center gap-1.5">
                          <span className="w-3.5 h-3.5 border-2 border-[#07131D] border-t-transparent rounded-full animate-spin" />
                          <span>Signalement...</span>
                        </div>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>J'ai effectué le transfert Wave</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-400 text-xs font-semibold flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Transfert signalé ! Nos équipes vérifient la réception.</span>
                    </div>
                  )}

                  {/* Conserver mon reçu sur WhatsApp */}
                  <a
                    href={generateWhatsAppConfirmationUrl(activeOrder)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-4 rounded-2xl font-heading font-extrabold text-xs tracking-wider uppercase flex items-center justify-center gap-2 transition-all bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                  >
                    <MessageSquare className="w-3.5 h-3.5 fill-current" />
                    <span>Conserver mon reçu sur WhatsApp</span>
                  </a>

                  {/* Lien discret de sortie */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="text-xs text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-1 mx-auto"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      <span>Retourner à la billetterie</span>
                    </button>
                  </div>
                </div>

                {/* Sauvegarde invité ultra-compacte */}
                {!isAuthenticated && !accountConverted && (
                  <div className="p-3 rounded-2xl bg-[#10111A] border border-white/10 text-left max-w-sm mx-auto space-y-2 text-xs">
                    <p className="font-bold text-white text-[11px] flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-[#E9C349]" />
                      <span>Créer un mot de passe pour retrouver vos pass</span>
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="email"
                        placeholder="Votre email"
                        value={guestEmail}
                        onChange={(e) => setGuestEmail(e.target.value)}
                        className="px-2.5 py-1.5 rounded-xl bg-black/40 border border-white/10 text-white text-[11px] outline-none"
                      />
                      <input
                        type="password"
                        placeholder="Mot de passe (min 6)"
                        value={guestPassword}
                        onChange={(e) => setGuestPassword(e.target.value)}
                        className="px-2.5 py-1.5 rounded-xl bg-black/40 border border-white/10 text-white text-[11px] outline-none"
                      />
                    </div>
                    {accountConvertError && (
                      <p className="text-[10px] text-red-400">{accountConvertError}</p>
                    )}
                    <button
                      type="button"
                      disabled={isConvertingAccount}
                      onClick={handleConvertGuestAccount}
                      className="w-full py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-[10px] uppercase transition-colors"
                    >
                      {isConvertingAccount ? 'Sécurisation...' : 'Enregistrer mon compte'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ============================================================== */}
          {/* FOOTER BAR CONTEXTUELLE SELON L'ÉTAPE DU WIZARD                */}
          {/* ============================================================== */}
          {flow === 'details' && !isSalesUpcoming && (
            <div className="p-3.5 sm:p-4 bg-[#10111A] border-t border-white/10 flex items-center justify-between gap-3 flex-shrink-0">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Tarif</p>
                <p className="font-heading text-lg font-extrabold text-[#E9C349]">
                  À partir de {event.price.toLocaleString('fr-FR')} F
                </p>
              </div>
              <button
                type="button"
                onClick={handleStartBooking}
                className="py-3 px-6 rounded-2xl font-heading font-extrabold text-xs sm:text-sm tracking-wider uppercase flex items-center gap-2 transition-all shadow-lg bg-[#E9C349] hover:bg-[#F3D779] text-[#241A00] shadow-[#E9C349]/20 active:scale-95 cursor-pointer"
              >
                <span>Réserver mes places</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {flow === 'step_contact' && (
            <div className="p-3 sm:p-4 bg-[#10111A] border-t border-white/10 flex items-center justify-between gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setFlow('details')}
                className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-xs flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Détails</span>
              </button>

              <button
                type="button"
                onClick={() => setFlow('step_tickets')}
                disabled={!isContactInfoValid}
                className="flex-1 py-3 px-5 rounded-2xl font-heading font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md bg-[#8A2BE2] hover:bg-[#7824c7] text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <span>Suivant : Formules</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {flow === 'step_tickets' && (
            <div className="p-3 sm:p-4 bg-[#10111A] border-t border-white/10 flex items-center justify-between gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setFlow('step_contact')}
                className="px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-xs flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Contact</span>
              </button>

              <div className="text-right px-2">
                <span className="font-heading font-extrabold text-sm text-[#E9C349]">
                  {totalPrice.toLocaleString('fr-FR')} F
                </span>
                <p className="text-[9px] text-gray-400">Total</p>
              </div>

              <button
                type="button"
                onClick={() => setFlow('step_payment')}
                className="py-3 px-5 rounded-2xl font-heading font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md bg-[#E9C349] hover:bg-[#F3D779] text-[#241A00] cursor-pointer"
              >
                <span>Vérifier</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {flow === 'step_payment' && (
            <div className="p-2.5 sm:p-3 bg-[#10111A] border-t border-white/10 flex items-center justify-between text-xs flex-shrink-0">
              <button
                type="button"
                onClick={() => setFlow('step_tickets')}
                className="text-gray-400 hover:text-white transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Modifier ma sélection</span>
              </button>

              <button
                type="button"
                onClick={handleCloseModal}
                className="text-gray-400 hover:text-white transition-colors"
              >
                Annuler
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>

      {/* MODALE TEASER VIDÉO YOUTUBE LAZY LOADÉE */}
      {isTeaserOpen && youtubeVideoId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl bg-[#0D0C12] border border-[#8A2BE2]/50 rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-4 bg-[#14131A] border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Youtube className="w-5 h-5 text-red-500" />
                <h3 className="font-heading font-extrabold text-sm sm:text-base text-white truncate max-w-md">
                  Teaser : {event.title}
                </h3>
              </div>
              <button
                onClick={() => setIsTeaserOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="relative w-full pb-[56.25%] bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&mute=0&rel=0&modestbranding=1`}
                title={`Teaser ${event.title}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="absolute inset-0 w-full h-full border-none"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
