import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Info,
  MapPin,
  Image as ImageIcon,
  Link,
  Phone,
  CheckCircle2,
  AlertCircle,
  Upload,
  Calendar,
  DollarSign,
  Compass,
  Smartphone,
  ExternalLink,
  Facebook,
  Instagram,
  Youtube,
  Globe,
  FileText,
  Sparkles,
  Share2,
  Tag,
  Percent,
  Users,
  Crown,
  ShieldCheck,
  Trash2,
  Plus,
  Scale,
  Lock,
  X,
  Music2,
  Clock,
} from 'lucide-react';
import { EventItem, EventCategory, EventCoproducer, CoproducerRole, UserProfile, CURRENT_TERMS_VERSION } from '../types';
import { createEventInSupabase, createCoproducer, acceptTermsOfServiceInSupabase, getSupabaseClient } from '../services/supabase';
import { THIES_33_QUARTIERS, THIES_QUARTIERS_BY_ZONE } from '../data/thiesQuartiers';
import { TermsOfServiceModal } from '../components/TermsOfServiceModal';
import { useAuth } from '../contexts/AuthContext';

const TikTokIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .58.04.86.12V9.42a6.34 6.34 0 0 0-.86-.06 6.34 6.34 0 1 0 6.34 6.34V9.05a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.48z" />
  </svg>
);

interface CreateEventViewProps {
  onEventCreated: (newEvent: EventItem) => void;
  onBack: () => void;
  promoterName?: string;
  promoterAvatar?: string;
  isEmailConfirmed?: boolean;
  currentUser?: UserProfile;
  onAcceptTerms?: (updatedUser: UserProfile) => void;
}

const PRESET_POSTERS = [
  {
    name: 'Gala Prestige Thiès',
    url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200&auto=format&fit=crop',
  },
  {
    name: 'Saly Beach Festival',
    url: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?q=80&w=1200&auto=format&fit=crop',
  },
  {
    name: 'Afro Vibes & Mbalax Live',
    url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=1200&auto=format&fit=crop',
  },
  {
    name: 'Neon Laser Night Dakar',
    url: 'https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?q=80&w=1200&auto=format&fit=crop',
  },
  {
    name: 'Jazz & Lounge Prestige',
    url: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?q=80&w=1200&auto=format&fit=crop',
  },
  {
    name: 'Open Air Urban Sound',
    url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=1200&auto=format&fit=crop',
  },
];

// Clé dynamique de stockage du brouillon liée à l'utilisateur connecté
const getDraftStorageKey = (userId?: string | null): string | null => {
  if (!userId) return null;
  return `thiesdn_event_draft_${userId}`;
};

interface EventFormData {
  title: string;
  category: EventCategory;
  startDatetime: string;
  endDatetime: string;
  venue: string;
  city: string;
  quartier: string;
  posterUrl: string;
  youtubeUrl: string;
  whatsappContact: string;
  description: string;
  longDescription: string;
  socialFacebook: string;
  socialInstagram: string;
  socialTiktok: string;
  socialYoutube: string;
  websiteUrl: string;
  spotifyUrl: string;
  salesOpenAt: string;
  pricePrevente: number;
  priceJourJ: number;
  priceVip: number;
  waveLinkPrevente: string;
  waveLinkJourJ: string;
  waveLinkVip: string;
  promoCode: string;
  promoDiscountPercent: number | '';
  enableCoproduction: boolean;
  coproducersList: Array<{
    name: string;
    phone: string;
    roleType: CoproducerRole;
    revenueShare: number;
    guestTicketsAllocated: number;
  }>;
}

const INITIAL_FORM_STATE: EventFormData = {
  title: '',
  category: 'Gala',
  startDatetime: '2024-11-20T21:30',
  endDatetime: '',
  venue: '',
  city: 'Thiès',
  quartier: 'Grand Standing',
  posterUrl: PRESET_POSTERS[0].url,
  youtubeUrl: '',
  whatsappContact: '+221 77 890 12 34',
  description: '',
  longDescription: '',
  socialFacebook: '',
  socialInstagram: '',
  socialTiktok: '',
  socialYoutube: '',
  websiteUrl: '',
  spotifyUrl: '',
  salesOpenAt: '',
  pricePrevente: 3500,
  priceJourJ: 5000,
  priceVip: 10000,
  waveLinkPrevente: 'https://pay.wave.com/m/M_p1_xT73E21bN/c/sn/?amount=3500',
  waveLinkJourJ: 'https://pay.wave.com/m/M_p1_xT73E21bN/c/sn/?amount=5000',
  waveLinkVip: 'https://pay.wave.com/m/M_p1_xT73E21bN/c/sn/?amount=10000',
  promoCode: '',
  promoDiscountPercent: '',
  enableCoproduction: true,
  coproducersList: [
    {
      name: 'Artiste Vedette Thiès',
      phone: '+221 77 555 12 34',
      roleType: 'artiste',
      revenueShare: 50,
      guestTicketsAllocated: 20,
    },
    {
      name: 'Manager / Staff Artiste',
      phone: '+221 78 222 33 44',
      roleType: 'staff_artiste',
      revenueShare: 0,
      guestTicketsAllocated: 10,
    },
  ],
};

export const CreateEventView: React.FC<CreateEventViewProps> = ({
  onEventCreated,
  onBack,
  promoterName = 'Lat Dior Productions',
  promoterAvatar = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop',
  isEmailConfirmed = true,
  currentUser,
  onAcceptTerms,
}) => {
  const { userRole, user: authUser, isAuthenticated } = useAuth();
  const effectiveUser = currentUser || authUser;
  const currentUserId = effectiveUser?.id;
  const isAllowedToCreate = userRole === 'promoter' || userRole === 'admin' || userRole === 'artist';

  // Initialisation du state avec les données du localStorage si un utilisateur connecté a un brouillon
  const [formData, setFormData] = useState<EventFormData>(() => {
    if (typeof window === 'undefined') return INITIAL_FORM_STATE;
    const key = getDraftStorageKey(currentUserId);
    if (!key) return INITIAL_FORM_STATE;
    try {
      const saved = localStorage.getItem(key);
      return saved ? { ...INITIAL_FORM_STATE, ...JSON.parse(saved) } : INITIAL_FORM_STATE;
    } catch {
      return INITIAL_FORM_STATE;
    }
  });

  // Nettoyage préventif des anciennes clés orphelines globales non sécurisées
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem('thiesdn_event_draft');
      localStorage.removeItem('thiesdn_create_event_draft');
    } catch {}
  }, []);

  // Synchronisation dynamique si l'utilisateur change ou se connecte/déconnecte
  const [lastUserId, setLastUserId] = useState<string | null>(currentUserId || null);
  useEffect(() => {
    const newUserId = effectiveUser?.id || null;
    if (newUserId !== lastUserId) {
      setLastUserId(newUserId);
      if (typeof window !== 'undefined') {
        const key = getDraftStorageKey(newUserId);
        if (key) {
          try {
            const saved = localStorage.getItem(key);
            if (saved) {
              setFormData({ ...INITIAL_FORM_STATE, ...JSON.parse(saved) });
            } else {
              setFormData(INITIAL_FORM_STATE);
            }
          } catch {
            setFormData(INITIAL_FORM_STATE);
          }
        } else {
          setFormData(INITIAL_FORM_STATE);
        }
      }
    }
  }, [effectiveUser?.id, lastUserId]);

  // Sauvegarde automatique à chaque modification uniquement si un utilisateur est connecté
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = getDraftStorageKey(effectiveUser?.id);
    if (!key) return; // Ne pas sauvegarder de données pour un utilisateur anonyme/déconnecté
    try {
      localStorage.setItem(key, JSON.stringify(formData));
    } catch (e) {
      console.warn(`Erreur sauvegarde brouillon ${key}:`, e);
    }
  }, [formData, effectiveUser?.id]);

  // Effacement manuel du brouillon avec confirmation de sécurité
  const handleClearDraft = () => {
    if (typeof window === 'undefined') return;
    const hasData = Object.keys(formData).some((k) => {
      const val = (formData as any)[k];
      return typeof val === 'string' ? val.trim() !== '' : Boolean(val);
    });

    if (
      hasData &&
      !window.confirm(
        'Voulez-vous vraiment effacer l’intégralité de ce brouillon ? Tous les champs saisis seront réinitialisés.'
      )
    ) {
      return;
    }

    const key = getDraftStorageKey(effectiveUser?.id);
    if (key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn('Erreur suppression brouillon utilisateur:', e);
      }
    }
    try {
      localStorage.removeItem('thiesdn_event_draft');
      localStorage.removeItem('thiesdn_create_event_draft');
    } catch {}

    setFormData(INITIAL_FORM_STATE);
  };

  const updateField = <K extends keyof EventFormData>(field: K, value: EventFormData[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const {
    title,
    category,
    startDatetime,
    endDatetime,
    venue,
    city,
    quartier,
    posterUrl,
    youtubeUrl,
    whatsappContact,
    description,
    longDescription,
    socialFacebook,
    socialInstagram,
    socialTiktok,
    socialYoutube,
    websiteUrl,
    spotifyUrl,
    salesOpenAt,
    pricePrevente,
    priceJourJ,
    priceVip,
    waveLinkPrevente,
    waveLinkJourJ,
    waveLinkVip,
    promoCode,
    promoDiscountPercent,
    enableCoproduction,
    coproducersList,
  } = formData;

  // Individual state setters mapped to formData updates for seamless reactivity
  const setTitle = (val: string) => updateField('title', val);
  const setCategory = (val: EventCategory) => updateField('category', val);
  const setStartDatetime = (val: string) => updateField('startDatetime', val);
  const setEndDatetime = (val: string) => updateField('endDatetime', val);
  const setSalesOpenAt = (val: string) => updateField('salesOpenAt', val);
  const setSpotifyUrl = (val: string) => updateField('spotifyUrl', val);
  const setVenue = (val: string) => updateField('venue', val);
  const setCity = (val: string) => updateField('city', val);
  const setQuartier = (val: string) => updateField('quartier', val);
  const setPosterUrl = (val: string) => updateField('posterUrl', val);
  const setYoutubeUrl = (val: string) => updateField('youtubeUrl', val);
  const setWhatsappContact = (val: string) => updateField('whatsappContact', val);
  const setDescription = (val: string) => updateField('description', val);
  const setLongDescription = (val: string) => updateField('longDescription', val);
  const setSocialFacebook = (val: string) => updateField('socialFacebook', val);
  const setSocialInstagram = (val: string) => updateField('socialInstagram', val);
  const setSocialTiktok = (val: string) => updateField('socialTiktok', val);
  const setSocialYoutube = (val: string) => updateField('socialYoutube', val);
  const setWebsiteUrl = (val: string) => updateField('websiteUrl', val);
  const setPricePrevente = (val: number) => updateField('pricePrevente', val);
  const setPriceJourJ = (val: number) => updateField('priceJourJ', val);
  const setPriceVip = (val: number) => updateField('priceVip', val);
  const setWaveLinkPrevente = (val: string) => updateField('waveLinkPrevente', val);
  const setWaveLinkJourJ = (val: string) => updateField('waveLinkJourJ', val);
  const setWaveLinkVip = (val: string) => updateField('waveLinkVip', val);
  const setPromoCode = (val: string) => updateField('promoCode', val);
  const setPromoDiscountPercent = (val: number | '') => updateField('promoDiscountPercent', val);
  const setEnableCoproduction = (val: boolean) => updateField('enableCoproduction', val);
  const setCoproducersList = (val: Array<any> | ((prev: Array<any>) => Array<any>)) => {
    if (typeof val === 'function') {
      updateField('coproducersList', val(formData.coproducersList));
    } else {
      updateField('coproducersList', val);
    }
  };

  const [showTermsModal, setShowTermsModal] = useState(false);
  const [agreedTermsLocal, setAgreedTermsLocal] = useState(false);
  const [isAcceptingTerms, setIsAcceptingTerms] = useState(false);

  // Formulaire d'ajout rapide d'un ayant-droit
  const [newCoprodName, setNewCoprodName] = useState('');
  const [newCoprodPhone, setNewCoprodPhone] = useState('');
  const [newCoprodRole, setNewCoprodRole] = useState<CoproducerRole>('artiste');
  const [newCoprodShare, setNewCoprodShare] = useState<number>(30);
  const [newCoprodGuestQuota, setNewCoprodGuestQuota] = useState<number>(15);

  const totalCoProdShare = coproducersList.reduce((acc, c) => acc + (Number(c.revenueShare) || 0), 0);
  const remainingProducerShare = Math.max(0, 100 - totalCoProdShare);

  const handleAddCoproducer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCoprodName.trim() || !newCoprodPhone.trim()) {
      alert('Veuillez renseigner le nom et le téléphone du co-producteur/artiste.');
      return;
    }

    const updatedList = [
      ...coproducersList,
      {
        name: newCoprodName.trim(),
        phone: newCoprodPhone.trim(),
        roleType: newCoprodRole,
        revenueShare: Number(newCoprodShare) || 0,
        guestTicketsAllocated: Number(newCoprodGuestQuota) || 0,
      },
    ];

    updateField('coproducersList', updatedList);
    setNewCoprodName('');
    setNewCoprodPhone('');
    setNewCoprodShare(20);
    setNewCoprodGuestQuota(10);
  };

  const handleRemoveCoproducer = (index: number) => {
    updateField('coproducersList', coproducersList.filter((_, i) => i !== index));
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmailConfirmed) {
      setSubmitError('Veuillez confirmer votre adresse email pour continuer et publier un événement sur Thièsdn Billetterie.');
      return;
    }

    if (!title.trim()) {
      alert('Veuillez entrer un titre pour l’événement.');
      return;
    }

    if (!waveLinkPrevente.trim().startsWith('http') || !waveLinkJourJ.trim().startsWith('http') || !waveLinkVip.trim().startsWith('http')) {
      setSubmitError('Veuillez renseigner les 3 liens de paiement Wave obligatoires (Prévente, Jour J, VIP).');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const parsedDate = startDatetime ? new Date(startDatetime) : new Date();
    const isDateValid = !isNaN(parsedDate.getTime());
    const validDate = isDateValid ? parsedDate : new Date();

    const formattedDate = validDate.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const formattedTime = validDate.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const eventIsoString = validDate.toISOString();

    const standardTiers = [
      {
        id: 't-prev',
        name: `Pass Prévente ${city}`,
        price: Number(pricePrevente) || 3500,
        description: 'Tarif promotionnel prévente limité',
        perks: ['Entrée garantie dès 20h00', 'Pass QR Code unique'],
        available: 150,
        wavePaymentUrl: waveLinkPrevente.trim(),
      },
      {
        id: 't-jour',
        name: `Pass Jour J ${city}`,
        price: Number(priceJourJ) || 5000,
        description: 'Accès standard le jour de l’événement',
        perks: ['Accès salle principale', 'Validation prioritaire'],
        available: 200,
        wavePaymentUrl: waveLinkJourJ.trim(),
      },
      {
        id: 't-vip',
        name: `Pass VIP Prestige ${city}`,
        price: Number(priceVip) || 10000,
        description: 'Salon VIP dédié & cocktail d’honneur',
        perks: ['Table réservée', 'Cocktail offert', 'Coupe-file exclusif'],
        available: 50,
        wavePaymentUrl: waveLinkVip.trim(),
      },
    ];

    // Validation stricte de l'UUID du promoteur (obligatoire pour PostgreSQL)
    const isValidUUID = (id?: string) =>
      !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    let activePromoterId: string | null = isValidUUID(effectiveUser?.id) ? effectiveUser!.id : null;

    if (!activePromoterId) {
      const client = getSupabaseClient();
      if (client) {
        try {
          const { data: sessionData } = await client.auth.getSession();
          const sessionUid = sessionData?.session?.user?.id;
          if (isValidUUID(sessionUid)) {
            activePromoterId = sessionUid;
          }
        } catch {
          // ignore
        }
      }
    }

    if (!activePromoterId) {
      setIsSubmitting(false);
      setSubmitError('Vous devez être connecté avec un compte valide pour créer un événement.');
      return;
    }

    try {
      const result = await createEventInSupabase(
        {
          title,
          category,
          description: description || `Événement haut de gamme à ${city} organisé avec ThièsDN Billetterie.`,
          longDescription: longDescription.trim() || undefined,
          date: formattedDate || '25 Décembre 2026',
          time: formattedTime || '20:00',
          datetimeIso: eventIsoString,
          venue: venue || `Salle Prestige, ${city}`,
          city: city || 'Thiès',
          quartier: city === 'Thiès' ? quartier : undefined,
          price: Number(pricePrevente) || 3500,
          posterUrl: posterUrl || PRESET_POSTERS[0].url,
          whatsappContact: whatsappContact || '+221 77 458 74 74',
          tiers: standardTiers,
          waveLinkPrevente: waveLinkPrevente.trim(),
          waveLinkJourJ: waveLinkJourJ.trim(),
          waveLinkVip: waveLinkVip.trim(),
          socialFacebook: socialFacebook.trim() || undefined,
          socialInstagram: socialInstagram.trim() || undefined,
          socialTiktok: socialTiktok.trim() || undefined,
          socialYoutube: (socialYoutube.trim() || youtubeUrl.trim()) || undefined,
          websiteUrl: websiteUrl.trim() || undefined,
          spotifyUrl: spotifyUrl.trim() || undefined,
          salesOpenAt: salesOpenAt ? new Date(salesOpenAt).toISOString() : undefined,
          videoSpotUrl: (youtubeUrl.trim() || socialYoutube.trim()) || undefined,
          promoCode: promoCode.trim().toUpperCase() || undefined,
          promoDiscountPercent: promoDiscountPercent ? Number(promoDiscountPercent) : undefined,
        },
        {
          id: activePromoterId,
          name: promoterName || effectiveUser?.name || 'Médias Graphisme & ThièsDN',
        }
      );

      if (!result.success || !result.event) {
        setSubmitError(result.error || 'Erreur lors de l’enregistrement de l’événement dans la base.');
        setIsSubmitting(false);
        return;
      }

      // Enregistrement des co-producteurs / artistes rattachés à cet événement
      if (enableCoproduction && coproducersList.length > 0) {
        for (const c of coproducersList) {
          await createCoproducer({
            eventId: result.event.id,
            eventTitle: result.event.title,
            promoterId: activePromoterId,
            name: c.name,
            phone: c.phone,
            roleType: c.roleType,
            revenueShare: c.revenueShare,
            guestTicketsAllocated: c.guestTicketsAllocated,
          });
        }
      }

      // Nettoyage du draft après publication réussie
      try {
        const key = getDraftStorageKey(effectiveUser?.id);
        if (key) {
          localStorage.removeItem(key);
        }
        localStorage.removeItem('thiesdn_event_draft');
        localStorage.removeItem('thiesdn_create_event_draft');
      } catch (e) {
        console.warn('Erreur suppression draft après publication:', e);
      }

      setIsSubmitting(false);
      setShowSuccessToast(true);
      onEventCreated(result.event);

      setTimeout(() => {
        onBack();
      }, 1200);
    } catch (err: any) {
      setSubmitError(err.message || 'Erreur réseau inattendue.');
      setIsSubmitting(false);
    }
  };

  const isTermsAccepted = Boolean(
    effectiveUser?.termsAccepted && effectiveUser?.termsVersion === CURRENT_TERMS_VERSION
  );

  const handleValidateTermsInBlocker = async () => {
    if (!effectiveUser || !agreedTermsLocal || isAcceptingTerms) return;
    setIsAcceptingTerms(true);
    const res = await acceptTermsOfServiceInSupabase(effectiveUser.id, CURRENT_TERMS_VERSION);
    setIsAcceptingTerms(false);
    if (res.success) {
      const updated: UserProfile = {
        ...effectiveUser,
        termsAccepted: true,
        termsAcceptedAt: res.timestamp,
        termsVersion: CURRENT_TERMS_VERSION,
      };
      if (onAcceptTerms) {
        onAcceptTerms(updated);
      }
    }
  };

  // Tâche 2 : Si l'utilisateur n'est pas promoteur, artiste ou admin, afficher le message de blocage d'accès
  if (!isAllowedToCreate) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 animate-in fade-in duration-300 text-center space-y-6">
        <div className="glass-panel p-8 rounded-3xl border border-red-500/30 bg-[#121115] shadow-2xl space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-red-950/80 border border-red-500/50 flex items-center justify-center mx-auto text-red-400 shadow-lg">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-red-500/20 text-red-300 border border-red-500/40 tracking-wider inline-flex items-center gap-1.5">
              Accès Réservé
            </span>
            <h2 className="font-heading text-2xl font-black text-white tracking-tight">
              Espace Création Réservé aux Promoteurs & Artistes
            </h2>
            <p className="text-xs sm:text-sm text-gray-300 max-w-md mx-auto leading-relaxed">
              La publication d'événements et la billetterie mobile sont exclusivement réservées aux organisateurs et promoteurs officiels.
            </p>
          </div>

          <div className="pt-3">
            <button
              type="button"
              onClick={onBack}
              className="px-6 py-3 rounded-2xl btn-primary-glow font-heading font-extrabold text-xs uppercase tracking-wider"
            >
              Retour à l'accueil
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ÉCRAN DE BLOCAGE CONTRACTUEL SI LES CGV NE SONT PAS ENCORE ACCEPTÉES (ÉTAPE 3)
  if (effectiveUser && !isTermsAccepted) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 animate-in fade-in duration-300">
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border-2 border-[#E9C349]/50 bg-[#121115] shadow-2xl space-y-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#E9C349]/15 border border-[#E9C349]/30 flex items-center justify-center mx-auto text-[#E9C349] shadow-lg">
            <Scale className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-[#8A2BE2]/20 text-[#DCB8FF] border border-[#8A2BE2]/40 tracking-wider inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-[#E9C349]" />
              Étape Préalable Obligatoire
            </span>
            <h2 className="font-heading text-2xl sm:text-3xl font-black text-white tracking-tight">
              Acceptation des Conditions Générales de Vente
            </h2>
            <p className="text-xs sm:text-sm text-gray-300 max-w-md mx-auto leading-relaxed">
              Avant de créer votre premier événement, vous devez accepter les Conditions Générales de Vente (CGV) de Thièsdn Billetterie.
            </p>
          </div>

          {/* Encart récapitulatif des 4 engagements légaux */}
          <div className="p-4 rounded-2xl bg-black/50 border border-white/10 text-left space-y-2 text-xs text-gray-300">
            <p className="font-bold text-[#E9C349] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Vos Engagements Contractuels en tant que Promoteur :
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-gray-300 text-[11px]">
              <li>Détenir les autorisations administratives de la Ville de Thiès et de la Préfecture.</li>
              <li>Respecter la répartition Option 3 : 90% promoteur / 10% frais plateforme Thièsdn.</li>
              <li>Garantir la sécurité du public et respecter les jauges d'accueil maximales.</li>
              <li>Obligation de remboursement des spectateurs en cas d'annulation de l'événement.</li>
            </ul>
          </div>

          {/* Bouton pour lire les CGV complètes */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowTermsModal(true)}
              className="text-xs text-[#DCB8FF] hover:text-white underline font-semibold transition-colors flex items-center justify-center gap-1.5 mx-auto"
            >
              <FileText className="w-4 h-4 text-[#E9C349]" />
              Consulter le texte complet des Conditions Générales de Vente (v1.0)
            </button>
          </div>

          {/* Case à cocher de validation */}
          <div className="p-4 rounded-2xl bg-[#18181E] border border-white/10 text-left">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreedTermsLocal}
                onChange={(e) => setAgreedTermsLocal(e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded-lg border-2 border-[#E9C349] bg-black text-[#8A2BE2] focus:ring-0 cursor-pointer shrink-0"
              />
              <span className="text-xs text-white leading-relaxed">
                Je reconnais avoir pris connaissance de l'intégralité des{' '}
                <strong className="text-[#E9C349]">Conditions Générales de Vente (CGV v1.0)</strong>{' '}
                de Thièsdn Billetterie et je les accepte sans réserve. Cette acceptation numérique fait foi d'accord contractuel opposable.
              </span>
            </label>
          </div>

          {/* Boutons d'Action */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={onBack}
              className="sm:w-1/3 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-xs uppercase"
            >
              Retour
            </button>

            <button
              type="button"
              disabled={!agreedTermsLocal || isAcceptingTerms}
              onClick={handleValidateTermsInBlocker}
              className={`sm:w-2/3 py-3 rounded-2xl font-heading font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg ${
                agreedTermsLocal && !isAcceptingTerms
                  ? 'btn-primary-glow cursor-pointer'
                  : 'bg-white/10 text-gray-500 cursor-not-allowed opacity-60'
              }`}
            >
              {isAcceptingTerms ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Enregistrement en base...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Valider les CGV et Créer mon Événement</span>
                </>
              )}
            </button>
          </div>
        </div>

        <TermsOfServiceModal
          isOpen={showTermsModal}
          onClose={() => setShowTermsModal(false)}
          showAcceptButton={true}
          onAccept={() => setAgreedTermsLocal(true)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-16 animate-in fade-in duration-300">
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-[#CFC2D7] hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Retour</span>
        </button>
        <span className="text-xs font-bold text-[#E9C349] uppercase tracking-wider bg-[#241A00] px-3 py-1 rounded-full border border-[#E9C349]/30">
          Studio Promoteur Sénégal
        </span>
      </div>

      <div className="mb-8">
        <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Créer un Événement
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Soumettez votre événement à Thiès, Mbour, Saly ou Dakar pour modération et vente avec Mobile Money.
        </p>
      </div>

      {!isEmailConfirmed && (
        <div className="mb-6 p-4 rounded-2xl bg-[#241A00]/80 border border-[#E9C349]/50 text-[#E9C349] flex items-center gap-3 animate-in fade-in slide-in-from-top duration-300">
          <AlertCircle className="w-6 h-6 text-[#E9C349] flex-shrink-0" />
          <div>
            <p className="font-bold text-sm">Vérification de compte requise</p>
            <p className="text-xs text-gray-300">
              Veuillez confirmer votre adresse email pour continuer et publier un événement sur Thièsdn Billetterie.
            </p>
          </div>
        </div>
      )}

      {showSuccessToast && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 flex items-center gap-3 animate-in fade-in slide-in-from-top duration-300">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
          <div>
            <p className="font-bold text-sm">Événement enregistré avec succès dans Supabase !</p>
            <p className="text-xs text-emerald-300/80">
              Votre événement est maintenant disponible sur la plateforme.
            </p>
          </div>
        </div>
      )}

      {submitError && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-950/80 border border-rose-500/50 text-rose-200 flex items-center gap-3 animate-in fade-in slide-in-from-top duration-300">
          <AlertCircle className="w-6 h-6 text-rose-400 flex-shrink-0" />
          <div>
            <p className="font-bold text-sm">Erreur d'enregistrement</p>
            <p className="text-xs text-rose-300/80">{submitError}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information Section */}
        <section className="bg-[#1F1F1F] rounded-2xl p-6 border border-white/10 relative overflow-hidden space-y-4">
          <div className="flex items-center gap-2 text-[#DCB8FF] font-heading font-bold text-base border-b border-white/10 pb-3">
            <Info className="w-5 h-5" />
            <span>Informations Générales</span>
          </div>

          {/* Event Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Titre de l'événement
            </label>
            <div className="input-glass rounded-xl px-4 py-3">
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Nuit du Rail Thiès & Mbalax Live"
                className="w-full bg-transparent border-none outline-none text-white text-sm focus:ring-0 p-0"
              />
            </div>
          </div>

          {/* Category & City */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Catégorie
              </label>
              <div className="input-glass rounded-xl px-4 py-3">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as EventCategory)}
                  className="w-full bg-transparent border-none outline-none text-white text-sm focus:ring-0 p-0 cursor-pointer"
                >
                  <option value="Gala" className="bg-[#1F1F1F]">Gala & Prestige</option>
                  <option value="Concert" className="bg-[#1F1F1F]">Concert & Mbalax</option>
                  <option value="Festival" className="bg-[#1F1F1F]">Festival & Open Air</option>
                  <option value="Boîte de nuit" className="bg-[#1F1F1F]">Boîte de nuit & Clubbing</option>
                  <option value="VIP Lounge" className="bg-[#1F1F1F]">VIP Lounge</option>
                  <option value="Piscine" className="bg-[#1F1F1F]">Piscine & Beach Party</option>
                  <option value="After-work" className="bg-[#1F1F1F]">After-work & Networking</option>
                  <option value="Culture" className="bg-[#1F1F1F]">Culture & Théâtre</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Ville / Région Sénégal
              </label>
              <div className="input-glass rounded-xl px-4 py-3">
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-white text-sm focus:ring-0 p-0 cursor-pointer font-bold text-[#E9C349]"
                >
                  <option value="Thiès" className="bg-[#1F1F1F]">Thiès</option>
                  <option value="Mbour" className="bg-[#1F1F1F]">Mbour</option>
                  <option value="Saly" className="bg-[#1F1F1F]">Saly Portudal</option>
                  <option value="Dakar" className="bg-[#1F1F1F]">Dakar</option>
                </select>
              </div>
            </div>
          </div>

          {/* Date & Time Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Date & Heure de Début
              </label>
              <div className="input-glass rounded-xl px-4 py-3">
                <input
                  type="datetime-local"
                  value={startDatetime}
                  onChange={(e) => setStartDatetime(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-white text-sm focus:ring-0 p-0 [color-scheme:dark]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Fin (Optionnel)
              </label>
              <div className="input-glass rounded-xl px-4 py-3">
                <input
                  type="datetime-local"
                  value={endDatetime}
                  onChange={(e) => setEndDatetime(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-white text-sm focus:ring-0 p-0 [color-scheme:dark]"
                />
              </div>
            </div>
          </div>

          {/* Date d'ouverture des ventes (Compte à rebours & Pré-inscriptions) */}
          <div className="p-4 rounded-xl bg-[#241A00]/40 border border-[#E9C349]/30 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[#E9C349] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Date d'Ouverture des Ventes (Optionnel - Compte à Rebours)</span>
              </label>
              <span className="text-[10px] text-gray-400">
                Laisser vide = ventes ouvertes immédiatement
              </span>
            </div>
            <div className="input-glass rounded-xl px-4 py-3">
              <input
                type="datetime-local"
                value={salesOpenAt}
                onChange={(e) => setSalesOpenAt(e.target.value)}
                className="w-full bg-transparent border-none outline-none text-white text-sm focus:ring-0 p-0 [color-scheme:dark]"
              />
            </div>
            <p className="text-[11px] text-gray-400">
              Si une date future est renseignée, la carte affichera un compte à rebours et un formulaire de pré-inscription pour capturer les coordonnées des acheteurs.
            </p>
          </div>

          {/* Short Description */}
          <div className="flex flex-col gap-1.5 pt-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Accroche courte / Teaser
            </label>
            <div className="input-glass rounded-xl px-4 py-3">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: La plus prestigieuse soirée de gala de la Petite Côte avec orchestre live"
                className="w-full bg-transparent border-none outline-none text-white text-sm focus:ring-0 p-0"
              />
            </div>
          </div>

          {/* Long Description (Ambiance & Dress Code) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[#DCB8FF] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#8A2BE2]" />
                <span>Description détaillée (Ambiance, Dress Code, Artistes)</span>
              </label>
              <span className="text-[10px] text-gray-400">Optionnel mais recommandé</span>
            </div>
            <div className="input-glass rounded-xl px-4 py-3">
              <textarea
                rows={4}
                value={longDescription}
                onChange={(e) => setLongDescription(e.target.value)}
                placeholder="Décrivez l'ambiance, les artistes invités, le code vestimentaire (ex: Tenue de soirée exigée, All White), le déroulement de la soirée, les tables VIP..."
                className="w-full bg-transparent border-none outline-none text-white text-sm focus:ring-0 p-0 resize-y min-h-[90px] leading-relaxed"
              />
            </div>
          </div>
        </section>

        {/* Location Section */}
        <section className="bg-[#1F1F1F] rounded-2xl p-6 border border-white/10 space-y-4">
          <div className="flex items-center gap-2 text-[#DCB8FF] font-heading font-bold text-base border-b border-white/10 pb-3">
            <MapPin className="w-5 h-5 text-[#E9C349]" />
            <span>Lieu & Adresse à {city}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Nom de la salle, hôtel ou plage
            </label>
            <div className="input-glass rounded-xl px-4 py-3 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              <input
                type="text"
                required
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder={`Ex: Grand Théâtre de ${city}, Esplanade`}
                className="w-full bg-transparent border-none outline-none text-white text-sm focus:ring-0 p-0"
              />
            </div>
          </div>

          {/* Sélecteur parmi les 33 quartiers de la Ville de Thiès */}
          {city === 'Thiès' && (
            <div className="flex flex-col gap-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-[#DCB8FF] flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#E9C349]" />
                  <span>Quartier de Thiès (33 Quartiers)</span>
                </label>
                <span className="text-[10px] font-bold text-[#E9C349] bg-[#E9C349]/10 px-2 py-0.5 rounded-full border border-[#E9C349]/20">
                  33 Quartiers Officiels
                </span>
              </div>
              <div className="input-glass rounded-xl px-4 py-3 flex items-center gap-2">
                <select
                  value={quartier}
                  onChange={(e) => setQuartier(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-white text-sm focus:ring-0 p-0 cursor-pointer font-medium"
                >
                  <optgroup label="📍 Thiès Ouest (11 quartiers)" className="bg-[#1A1A1A] text-[#DCB8FF] font-bold">
                    {THIES_QUARTIERS_BY_ZONE['Thiès Ouest'].map((q) => (
                      <option key={q.name} value={q.name} className="bg-[#1F1F1F] text-white font-normal">
                        {q.name} ({q.description})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="📍 Thiès Est (11 quartiers)" className="bg-[#1A1A1A] text-[#DCB8FF] font-bold">
                    {THIES_QUARTIERS_BY_ZONE['Thiès Est'].map((q) => (
                      <option key={q.name} value={q.name} className="bg-[#1F1F1F] text-white font-normal">
                        {q.name} ({q.description})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="📍 Thiès Nord (11 quartiers)" className="bg-[#1A1A1A] text-[#DCB8FF] font-bold">
                    {THIES_QUARTIERS_BY_ZONE['Thiès Nord'].map((q) => (
                      <option key={q.name} value={q.name} className="bg-[#1F1F1F] text-white font-normal">
                        {q.name} ({q.description})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <p className="text-[11px] text-gray-400">
                Sélectionnez le quartier hôte parmi les 33 quartiers de Thiès pour guider au mieux le public.
              </p>
            </div>
          )}
        </section>

        {/* Media & Poster Section */}
        <section className="bg-[#1F1F1F] rounded-2xl p-6 border border-white/10 space-y-4">
          <div className="flex items-center gap-2 text-[#DCB8FF] font-heading font-bold text-base border-b border-white/10 pb-3">
            <ImageIcon className="w-5 h-5" />
            <span>Affiche Haute Définition</span>
          </div>

          {/* URL de l'affiche personnalisée (prioritaire sur les présets) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <Link className="w-3.5 h-3.5 text-[#E9C349]" />
              Lien de l'affiche (URL) — Recommandé
            </label>
            <div className={`input-glass rounded-xl px-4 py-3 flex items-center gap-2 transition-all ${
              posterUrl && !PRESET_POSTERS.some(p => p.url === posterUrl)
                ? 'border border-[#E9C349]/60 ring-1 ring-[#E9C349]/20'
                : 'border border-white/10'
            }`}>
              <ImageIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                type="url"
                value={PRESET_POSTERS.some(p => p.url === posterUrl) ? '' : posterUrl}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  if (val) setPosterUrl(val);
                  else setPosterUrl(PRESET_POSTERS[0].url);
                }}
                placeholder="https://i.imgur.com/... ou autre URL d'image directe"
                className="w-full bg-transparent border-none outline-none text-white text-sm focus:ring-0 p-0 placeholder-gray-500"
              />
              {posterUrl && !PRESET_POSTERS.some(p => p.url === posterUrl) && (
                <button
                  type="button"
                  onClick={() => setPosterUrl(PRESET_POSTERS[0].url)}
                  className="text-gray-500 hover:text-red-400 transition-colors flex-shrink-0"
                  title="Effacer et revenir aux présets"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {posterUrl && !PRESET_POSTERS.some(p => p.url === posterUrl) && (
              <div className="flex items-start gap-2 p-2.5 rounded-xl bg-[#E9C349]/5 border border-[#E9C349]/20">
                <img
                  src={posterUrl}
                  alt="Aperçu de l'affiche"
                  className="w-16 h-16 rounded-lg object-cover border border-white/10 flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = PRESET_POSTERS[0].url;
                  }}
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-[#E9C349] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Affiche personnalisée active
                  </p>
                  <p className="text-[10px] text-gray-400 truncate mt-0.5 font-mono">{posterUrl}</p>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-2">
              Ou sélectionner un visuel préconfiguré
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {PRESET_POSTERS.map((preset, idx) => (
                <div
                  key={idx}
                  onClick={() => setPosterUrl(preset.url)}
                  className={`relative h-24 rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                    posterUrl === preset.url
                      ? 'border-[#E9C349] ring-2 ring-[#E9C349]/40 scale-[1.02]'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={preset.url}
                    alt={preset.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-end p-2">
                    <span className="text-[10px] font-bold text-white truncate">
                      {preset.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* YouTube Promo Link */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Lien Spot Vidéo / YouTube (Optionnel)
            </label>
            <div className="input-glass rounded-xl px-4 py-3 flex items-center gap-2">
              <Link className="w-4 h-4 text-gray-400" />
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full bg-transparent border-none outline-none text-white text-sm focus:ring-0 p-0"
              />
            </div>
          </div>
        </section>

        {/* Wave Payment Links & Tiers Section (3 Liens Obligatoires) */}
        <section className="bg-[#1F1F1F] rounded-2xl p-6 border border-[#1DC3F4]/30 space-y-5 shadow-lg shadow-[#1DC3F4]/5">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2 text-[#1DC3F4] font-heading font-bold text-base">
              <Smartphone className="w-5 h-5" />
              <span>Configuration Paiement Wave Direct (3 Liens Obligatoires)</span>
            </div>
            <span className="text-[10px] uppercase font-bold text-sky-400 bg-sky-500/20 px-2.5 py-0.5 rounded-full border border-sky-500/30">
              Wave 1-Clic
            </span>
          </div>

          <p className="text-xs text-gray-400">
            Configurez les liens de paiement Wave Business pour chaque formule. Lors de l'achat, le client est redirigé directement vers son application Wave sans recopie de numéro.
          </p>

          <div className="space-y-4">
            {/* Formule 1 : Prévente */}
            <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-heading font-bold text-sm text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  1. Formule Prévente
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Prix :</span>
                  <input
                    type="number"
                    min="500"
                    step="500"
                    required
                    value={pricePrevente}
                    onChange={(e) => setPricePrevente(Number(e.target.value))}
                    className="w-24 bg-[#1F1F1F] border border-white/20 rounded-lg px-2.5 py-1 text-xs font-bold text-[#E9C349] text-right"
                  />
                  <span className="text-xs text-[#E9C349] font-bold">FCFA</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-[#1DC3F4]" />
                  Lien de paiement Wave - Prévente (Obligatoire)
                </label>
                <input
                  type="url"
                  required
                  value={waveLinkPrevente}
                  onChange={(e) => setWaveLinkPrevente(e.target.value)}
                  placeholder="https://pay.wave.com/m/..."
                  className="w-full bg-[#1F1F1F] border border-white/10 focus:border-[#1DC3F4] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none"
                />
              </div>
            </div>

            {/* Formule 2 : Jour J */}
            <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-heading font-bold text-sm text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-400" />
                  2. Formule Jour J
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Prix :</span>
                  <input
                    type="number"
                    min="500"
                    step="500"
                    required
                    value={priceJourJ}
                    onChange={(e) => setPriceJourJ(Number(e.target.value))}
                    className="w-24 bg-[#1F1F1F] border border-white/20 rounded-lg px-2.5 py-1 text-xs font-bold text-[#E9C349] text-right"
                  />
                  <span className="text-xs text-[#E9C349] font-bold">FCFA</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-[#1DC3F4]" />
                  Lien de paiement Wave - Jour J (Obligatoire)
                </label>
                <input
                  type="url"
                  required
                  value={waveLinkJourJ}
                  onChange={(e) => setWaveLinkJourJ(e.target.value)}
                  placeholder="https://pay.wave.com/m/..."
                  className="w-full bg-[#1F1F1F] border border-white/10 focus:border-[#1DC3F4] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none"
                />
              </div>
            </div>

            {/* Formule 3 : VIP */}
            <div className="p-4 rounded-xl bg-black/40 border border-[#E9C349]/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-heading font-bold text-sm text-[#E9C349] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#E9C349]" />
                  3. Formule VIP Prestige
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">Prix :</span>
                  <input
                    type="number"
                    min="500"
                    step="500"
                    required
                    value={priceVip}
                    onChange={(e) => setPriceVip(Number(e.target.value))}
                    className="w-24 bg-[#1F1F1F] border border-white/20 rounded-lg px-2.5 py-1 text-xs font-bold text-[#E9C349] text-right"
                  />
                  <span className="text-xs text-[#E9C349] font-bold">FCFA</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#E9C349] flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-[#E9C349]" />
                  Lien de paiement Wave - VIP (Obligatoire)
                </label>
                <input
                  type="url"
                  required
                  value={waveLinkVip}
                  onChange={(e) => setWaveLinkVip(e.target.value)}
                  placeholder="https://pay.wave.com/m/..."
                  className="w-full bg-[#1F1F1F] border border-[#E9C349]/30 focus:border-[#E9C349] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono outline-none"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section Codes Promo & Réductions (Optionnelle) */}
        <section className="bg-[#1F1F1F] rounded-2xl p-6 border border-[#E9C349]/20 space-y-4 relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2 text-[#E9C349] font-heading font-bold text-base">
              <Tag className="w-5 h-5 text-[#E9C349]" />
              <span>Code Promo & Réduction Spéciale (Marketing)</span>
            </div>
            <span className="text-[10px] uppercase font-bold text-[#E9C349] bg-[#E9C349]/10 px-2.5 py-0.5 rounded-full border border-[#E9C349]/20">
              Optionnel
            </span>
          </div>

          <p className="text-xs text-gray-400">
            Créez un code de réduction pour vos partenaires, influenceurs ou vos campagnes de lancement. La déduction sera appliquée automatiquement lors du paiement Wave du client.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-[#E9C349]" />
                <span>Code Promo (Ex: THIES2027)</span>
              </label>
              <div className="input-glass rounded-xl px-4 py-3 flex items-center gap-2">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase().replace(/\s/g, ''))}
                  placeholder="EX: THIES2027"
                  className="w-full bg-transparent border-none outline-none text-white text-xs font-mono font-bold tracking-wider uppercase focus:ring-0 p-0"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-[#DCB8FF]" />
                <span>Pourcentage de réduction (%)</span>
              </label>
              <div className="input-glass rounded-xl px-4 py-3 flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={promoDiscountPercent}
                  onChange={(e) => setPromoDiscountPercent(e.target.value === '' ? '' : Math.min(100, Math.max(1, Number(e.target.value))))}
                  placeholder="Ex: 15 pour 15% de remise"
                  className="w-full bg-transparent border-none outline-none text-white text-xs font-bold focus:ring-0 p-0"
                />
                <span className="text-xs font-bold text-[#DCB8FF]">%</span>
              </div>
            </div>
          </div>

          {promoCode && promoDiscountPercent && (
            <div className="p-3 rounded-xl bg-[#241A00] border border-[#E9C349]/30 text-xs text-[#E9C349] flex items-center gap-2">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>
                Offre active : Les acheteurs entrant le code <strong>{promoCode}</strong> bénéficieront de <strong>{promoDiscountPercent}% de remise immédiate</strong> sur leur commande Wave.
              </span>
            </div>
          )}
        </section>

        {/* Liens & Réseaux Sociaux Promoteur / Artiste (Optionnels) */}
        <section className="bg-[#1F1F1F] rounded-2xl p-6 border border-white/10 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2 text-[#DCB8FF] font-heading font-bold text-base">
              <Share2 className="w-5 h-5 text-[#8A2BE2]" />
              <span>Liens & Réseaux Sociaux (Promoteur / Artiste)</span>
            </div>
            <span className="text-[10px] uppercase font-bold text-[#E9C349] bg-[#E9C349]/10 px-2.5 py-0.5 rounded-full border border-[#E9C349]/20">
              Optionnel
            </span>
          </div>

          <p className="text-xs text-gray-400">
            Associez vos profils officiels pour renforcer la confiance des acheteurs et offrir un accès direct à vos teasers et actualités.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Facebook */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Facebook className="w-3.5 h-3.5 text-blue-500" />
                <span>Événement / Page Facebook</span>
              </label>
              <div className="input-glass rounded-xl px-4 py-3 flex items-center gap-2">
                <input
                  type="url"
                  value={socialFacebook}
                  onChange={(e) => setSocialFacebook(e.target.value)}
                  placeholder="https://facebook.com/events/..."
                  className="w-full bg-transparent border-none outline-none text-white text-xs focus:ring-0 p-0 font-mono"
                />
              </div>
            </div>

            {/* Instagram */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Instagram className="w-3.5 h-3.5 text-pink-500" />
                <span>Instagram (Artiste / Promoteur)</span>
              </label>
              <div className="input-glass rounded-xl px-4 py-3 flex items-center gap-2">
                <input
                  type="url"
                  value={socialInstagram}
                  onChange={(e) => setSocialInstagram(e.target.value)}
                  placeholder="https://instagram.com/nom_artiste"
                  className="w-full bg-transparent border-none outline-none text-white text-xs focus:ring-0 p-0 font-mono"
                />
              </div>
            </div>

            {/* TikTok */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <TikTokIcon className="w-3.5 h-3.5 text-cyan-400" />
                <span>TikTok Officiel</span>
              </label>
              <div className="input-glass rounded-xl px-4 py-3 flex items-center gap-2">
                <input
                  type="url"
                  value={socialTiktok}
                  onChange={(e) => setSocialTiktok(e.target.value)}
                  placeholder="https://tiktok.com/@artiste_officiel"
                  className="w-full bg-transparent border-none outline-none text-white text-xs focus:ring-0 p-0 font-mono"
                />
              </div>
            </div>

            {/* YouTube */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Youtube className="w-3.5 h-3.5 text-red-500" />
                <span>Lien Teaser / Aftermovie YouTube</span>
              </label>
              <div className="input-glass rounded-xl px-4 py-3 flex items-center gap-2">
                <input
                  type="url"
                  value={socialYoutube}
                  onChange={(e) => setSocialYoutube(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full bg-transparent border-none outline-none text-white text-xs focus:ring-0 p-0 font-mono"
                />
              </div>
            </div>

            {/* Spotify Audio Player */}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#1DB954] flex items-center gap-1.5">
                <Music2 className="w-3.5 h-3.5" />
                <span>Lien Spotify (Album, Morceau ou Playlist pour le lecteur vinyle interactif)</span>
              </label>
              <div className="input-glass rounded-xl px-4 py-3 flex items-center gap-2">
                <input
                  type="url"
                  value={spotifyUrl}
                  onChange={(e) => setSpotifyUrl(e.target.value)}
                  placeholder="https://open.spotify.com/album/... ou track/..."
                  className="w-full bg-transparent border-none outline-none text-white text-xs focus:ring-0 p-0 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Site Web Officiel */}
          <div className="flex flex-col gap-1.5 pt-1">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[#E9C349]" />
              <span>Site Web Officiel / Billetterie Externe (Optionnel)</span>
            </label>
            <div className="input-glass rounded-xl px-4 py-3 flex items-center gap-2">
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://mon-festival.sn ou https://artiste.com"
                className="w-full bg-transparent border-none outline-none text-white text-xs focus:ring-0 p-0 font-mono"
              />
            </div>
          </div>
        </section>

        {/* Module Co-Production & Partage de Recettes (Étape 2) */}
        <section className="bg-[#1F1F1F] rounded-2xl p-6 border border-white/10 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#E9C349]" />
              <h3 className="text-white font-heading font-extrabold text-base">
                Co-Production, Droits Artiste & Partage de Recettes
              </h3>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={enableCoproduction}
                onChange={(e) => setEnableCoproduction(e.target.checked)}
                className="w-4 h-4 accent-[#E9C349] rounded"
              />
              <span className="text-xs font-bold text-gray-300">
                Activer la Co-Production
              </span>
            </label>
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            Offrez une visibilité transparente à l'artiste, à son staff et aux co-producteurs. Définissez le pourcentage des recettes (revenue share) et allouez un quota d'invitations Guest List.
          </p>

          {enableCoproduction && (
            <div className="space-y-5 pt-2">
              {/* Jauge Visuelle de Répartition des Recettes */}
              <div className="p-4 rounded-2xl bg-[#141414] border border-white/10 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-300 font-bold uppercase tracking-wider">
                    Répartition des Recettes Billetterie
                  </span>
                  <span className={`font-mono font-extrabold ${totalCoProdShare > 100 ? 'text-rose-400' : 'text-[#E9C349]'}`}>
                    {totalCoProdShare}% attribué / {remainingProducerShare}% Producteur Principal
                  </span>
                </div>
                <div className="w-full bg-[#2A2A2A] h-2.5 rounded-full overflow-hidden flex">
                  {coproducersList.map((c, i) => (
                    <div
                      key={i}
                      title={`${c.name} (${c.roleType}): ${c.revenueShare}%`}
                      className={`h-full ${
                        c.roleType === 'artiste'
                          ? 'bg-[#E9C349]'
                          : c.roleType === 'staff_artiste'
                          ? 'bg-[#8A2BE2]'
                          : c.roleType === 'gerant_lieu'
                          ? 'bg-emerald-500'
                          : 'bg-sky-500'
                      }`}
                      style={{ width: `${Math.min(100, c.revenueShare)}%` }}
                    />
                  ))}
                  {remainingProducerShare > 0 && (
                    <div
                      title={`Producteur Principal: ${remainingProducerShare}%`}
                      className="h-full bg-white/20"
                      style={{ width: `${remainingProducerShare}%` }}
                    />
                  )}
                </div>
                {totalCoProdShare > 100 && (
                  <p className="text-[11px] text-rose-400 font-bold">
                    ⚠️ Attention : Le total des pourcentages dépasse 100% ({totalCoProdShare}%). Veuillez ajuster les parts.
                  </p>
                )}
              </div>

              {/* Liste des Co-Producteurs Déjà Ajoutés */}
              {coproducersList.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Ayants-droit enregistrés ({coproducersList.length})
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {coproducersList.map((coprod, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-heading font-bold text-white text-xs truncate">
                              {coprod.name}
                            </span>
                            <span className="bg-[#8A2BE2]/20 text-[#DCB8FF] text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase">
                              {coprod.roleType === 'artiste'
                                ? 'Artiste'
                                : coprod.roleType === 'staff_artiste'
                                ? 'Staff'
                                : coprod.roleType === 'gerant_lieu'
                                ? 'Lieu'
                                : 'Co-Prod'}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                            {coprod.phone} • <strong className="text-[#E9C349]">{coprod.revenueShare}% CA</strong> • {coprod.guestTicketsAllocated} invitations
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveCoproducer(idx)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                          title="Supprimer cet ayant-droit"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Formulaire d'Ajout d'un Nouvel Ayant-Droit */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#DCB8FF] uppercase">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter un Artiste, Staff ou Co-Producteur</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-gray-400 font-semibold">Rôle</label>
                    <select
                      value={newCoprodRole}
                      onChange={(e) => setNewCoprodRole(e.target.value as CoproducerRole)}
                      className="input-glass w-full rounded-xl px-3 py-2 text-xs text-white mt-1 outline-none focus:border-[#E9C349]"
                    >
                      <option value="artiste">Artiste Principal / Vedette</option>
                      <option value="staff_artiste">Staff / Manager Artiste</option>
                      <option value="co_producteur">Co-Producteur Associé</option>
                      <option value="gerant_lieu">Gérant du Lieu / Salle</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 font-semibold">Nom / Structure *</label>
                    <input
                      type="text"
                      value={newCoprodName}
                      onChange={(e) => setNewCoprodName(e.target.value)}
                      placeholder="Ex: Waly Seck, Pape Diouf..."
                      className="input-glass w-full rounded-xl px-3 py-2 text-xs text-white mt-1 outline-none focus:border-[#E9C349]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 font-semibold">Téléphone Wave/OM *</label>
                    <input
                      type="tel"
                      value={newCoprodPhone}
                      onChange={(e) => setNewCoprodPhone(e.target.value)}
                      placeholder="+221 77 XXX XX XX"
                      className="input-glass w-full rounded-xl px-3 py-2 text-xs text-white mt-1 outline-none focus:border-[#E9C349]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] text-gray-400 font-semibold flex justify-between">
                      <span>Part des Recettes (Revenue Share)</span>
                      <strong className="text-[#E9C349] font-mono">{newCoprodShare}%</strong>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={newCoprodShare}
                      onChange={(e) => setNewCoprodShare(Number(e.target.value))}
                      className="input-glass w-full rounded-xl px-3 py-2 text-xs text-white mt-1 outline-none focus:border-[#E9C349]"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-gray-400 font-semibold flex justify-between">
                      <span>Quota Billets Invités (Guest List)</span>
                      <strong className="text-white font-mono">{newCoprodGuestQuota} places</strong>
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="200"
                      value={newCoprodGuestQuota}
                      onChange={(e) => setNewCoprodGuestQuota(Number(e.target.value))}
                      className="input-glass w-full rounded-xl px-3 py-2 text-xs text-white mt-1 outline-none focus:border-[#E9C349]"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddCoproducer}
                  className="w-full py-2.5 rounded-xl bg-[#8A2BE2]/30 hover:bg-[#8A2BE2]/40 text-[#DCB8FF] border border-[#8A2BE2]/40 text-xs font-bold uppercase transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Enregistrer cet Ayant-Droit</span>
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Contact & WhatsApp Section */}
        <section className="bg-[#1F1F1F] rounded-2xl p-6 border border-white/10 space-y-4">
          <div className="flex items-center gap-2 text-[#E9C349] font-heading font-bold text-base border-b border-white/10 pb-3">
            <Phone className="w-5 h-5 text-emerald-400" />
            <span>Contact Organisateur Sénégal</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Numéro WhatsApp Organisateur
            </label>
            <div className="input-glass rounded-xl px-4 py-3 flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-400" />
              <input
                type="tel"
                value={whatsappContact}
                onChange={(e) => setWhatsappContact(e.target.value)}
                placeholder="+221 77 XXX XX XX"
                className="w-full bg-transparent border-none outline-none text-white text-sm focus:ring-0 p-0"
              />
            </div>
          </div>
        </section>

        {/* Actions du Formulaire */}
        <div className="pt-4 flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={handleClearDraft}
            className="w-full sm:w-auto px-5 py-4 rounded-2xl bg-white/5 hover:bg-rose-500/10 text-gray-400 hover:text-rose-400 border border-white/10 hover:border-rose-500/30 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
            title="Réinitialiser tous les champs et effacer le brouillon sauvegardé"
          >
            <Trash2 className="w-4 h-4" />
            <span>Effacer le brouillon</span>
          </button>

          <button
            type="submit"
            disabled={isSubmitting || !isEmailConfirmed}
            className="w-full flex-1 btn-gold-glow py-4 px-6 rounded-2xl font-heading font-extrabold text-sm tracking-wider uppercase flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 border-2 border-[#241A00] border-t-transparent rounded-full animate-spin" />
                <span>Envoi vers Supabase & Modération...</span>
              </div>
            ) : !isEmailConfirmed ? (
              <>
                <AlertCircle className="w-5 h-5" />
                <span>Veuillez confirmer votre adresse email pour continuer</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>Publier pour Modération Administrative</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
