export type EventCategory = 
  | 'Concert'
  | 'Boîte de nuit'
  | 'Piscine'
  | 'After-work'
  | 'Gala'
  | 'VIP Lounge'
  | 'Festival'
  | 'Culture';

export type EventStatus = 'approved' | 'pending' | 'rejected' | 'archived';

export type OrderStatus =
  | 'pending'            // Attente de paiement
  | 'payment_signaled'   // Paiement signalé par le client
  | 'confirmed'          // Paiement confirmé par admin
  | 'rejected'           // Rejeté par admin
  | 'expired'            // Expiré
  | 'cancelled';         // Annulé

export interface OrderRecord {
  id: string;
  reference: string;
  eventId: string;
  eventTitle: string;
  userId?: string;
  tierId: string;
  tierName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  discountAmount?: number;
  promoCodeApplied?: string;
  paymentMethod: 'wave' | 'om';
  paymentReference?: string;
  paymentProofUrl?: string;
  customerName: string;
  customerPhone: string;
  status: OrderStatus;
  rejectionReason?: string;
  confirmedBy?: string;
  confirmedAt?: string;
  expiresAt?: string;
  createdAt: string;
}

export interface PlatformPaymentSettings {
  waveNumber: string;
  waveBeneficiary: string;
  omNumber: string;
  omBeneficiary: string;
}

export interface TicketTier {
  id: string;
  name: string;
  price: number; // in FCFA
  description: string;
  perks: string[];
  available: number;
  wavePaymentUrl?: string; // Lien de paiement Wave direct
}

export interface EventItem {
  id: string;
  title: string;
  category: EventCategory;
  date: string; // e.g. "25 Octobre 2024"
  time: string; // e.g. "22:00"
  datetimeIso: string;
  venue: string;
  city: string;
  quartier?: string; // Quartier officiel de Thiès (ex: Grand Standing, Randoulène, Escale...)
  coordinates?: { lat: number; lng: number };
  posterUrl: string;
  price: number; // Base price in FCFA
  priceLabel?: string;
  waveLinkPrevente?: string;
  waveLinkJourJ?: string;
  waveLinkVip?: string;
  promoter: {
    id: string;
    name: string;
    avatar: string;
    verified: boolean;
    role?: string;
  };
  featured?: boolean;
  status: EventStatus;
  vipAvailable?: boolean;
  isExclusive?: boolean;
  salesActive?: boolean;
  description?: string;
  longDescription?: string;
  youtubeUrl?: string;
  whatsappContact?: string;
  socialFacebook?: string;
  socialInstagram?: string;
  socialTiktok?: string;
  socialYoutube?: string;
  websiteUrl?: string;
  spotifyUrl?: string;
  videoSpotUrl?: string;
  salesOpenAt?: string; // Date & Heure ISO d'ouverture officielle des ventes (si future => mode compte a rebours et pre-inscription)
  estimatedEndTime?: string; // Heure estimée de fin (ex: "05:00" le lendemain matin, défaut: +6h après début)
  promoCode?: string;
  promoDiscountPercent?: number;
  tiers?: TicketTier[];
  coproducers?: EventCoproducer[];
  createdAt: string;
}

export type CoproducerRole =
  | 'producteur_principal'
  | 'co_producteur'
  | 'artiste'
  | 'staff_artiste'
  | 'gerant_lieu';

export interface EventCoproducer {
  id: string;
  eventId: string;
  eventTitle: string;
  userId?: string;
  promoterId: string;
  name: string;
  phone: string;
  email?: string;
  roleType: CoproducerRole;
  revenueShare: number; // Pourcentage de répartition des recettes (ex: 40 pour 40%)
  guestTicketsAllocated: number; // Quota d'invitations gratuites allouées
  guestTicketsUsed: number; // Invitations déjà scannées à l'entrée
  notes?: string;
  decompteValidated: boolean;
  decompteValidatedAt?: string;
  decompteSignature?: string;
  createdAt: string;
}

export interface GuestTicket {
  id: string;
  eventId: string;
  eventTitle: string;
  coproducerId: string;
  coproducerName: string;
  guestName: string;
  guestPhone: string;
  qrCode: string;
  status: 'valid' | 'used';
  scannedAt?: string;
  createdAt: string;
}

export interface SalesAgent {
  id: string;
  userId?: string;
  eventId: string;
  eventTitle: string;
  promoterId: string;
  pointDeVente: string;     // Ex: "Boutique Chez Fatou", "Kiosque Station Escale"
  gerantName: string;       // Nom du vendeur / gérant
  telephone: string;        // Contact Wave / OM
  email?: string;
  quartier?: string;
  allocatedCount: number;   // Nombre total de billets confiés
  soldCount: number;        // Nombre de billets déclarés vendus
  commissionPercent: number; // Commission (ex: 5% ou 10%)
  cashCollected: number;    // Montant brut collecté en espèces (FCFA)
  amountDue: number;        // Montant net à reverser au promoteur (FCFA)
  amountPaidToPromoter: number; // Montant déjà remis
  status: 'active' | 'suspended';
  createdAt: string;
}

export type TicketAssignmentStatus = 'unassigned' | 'pending' | 'accepted' | 'declined';

export interface UserTicket {
  id: string;
  eventId: string;
  eventTitle: string;
  eventPoster: string;
  eventDate: string;
  eventTime: string;
  eventVenue: string;
  tierName: string;
  price: number;
  qrCode: string;
  seatNumber?: string;
  holderName: string;
  holderPhone?: string;
  holderEmail?: string;
  holderAvatar?: string;
  purchasedAt: string;
  status:
    | 'valid'
    | 'sold_valid'
    | 'printed_not_sold'
    | 'scanned'
    | 'used'
    | 'cancelled'
    | 'physical_printed'
    | 'physical_allocated'
    | 'physical_sold';
  isPhysical?: boolean;
  agentId?: string;
  agentName?: string;
  batchNumber?: string;
  serialNumber?: number;
  soldAt?: string;
  usedAt?: string;
  validatedBy?: string;
  validatedStationId?: string;
  validatedStationName?: string;
  // Champs d'assignation / transfert à un ami
  assignedToProfileId?: string;
  assignedToName?: string;
  assignedToPhone?: string;
  assignedToEmail?: string;
  assignedToAvatar?: string;
  assignmentStatus?: TicketAssignmentStatus;
  assignedAt?: string;
  claimedAt?: string;
  claimToken?: string;
  userId?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  username: string;
  email: string;
  phone: string;
  city?: string;
  address: string;
  quartier?: string; // Quartier officiel de Thiès
  avatar: string;
  isVip: boolean;
  role: 'user' | 'promoter' | 'admin' | 'sales_agent' | 'artist';
  assignedAgentId?: string;
  isEmailConfirmed?: boolean;
  termsAccepted?: boolean;
  termsAcceptedAt?: string;
  termsVersion?: string;
  connectedAccounts: {
    facebook: boolean;
    instagram: boolean;
    tiktok: boolean;
  };
  privacySettings: {
    publicProfile: boolean;
    biometricLogin: boolean;
    emailNotifications: boolean;
  };
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'event' | 'ticket' | 'moderation' | 'vip';
}

export type AccreditationType = 'staff' | 'invite' | 'presse';
export type AccreditationStatus = 'pending' | 'validated' | 'scanned' | 'cancelled';

export interface Accreditation {
  id: string;
  eventId: string;
  eventTitle: string;
  type: AccreditationType;
  holderName: string;
  holderPhone: string;
  holderEmail?: string;
  organization?: string; // ex: "RTS Thiès", "Le Soleil", "Régie Lumière", "Staff Waly"
  qrCode: string; // Ex: ACC-STAFF-THS-8F2B
  status: AccreditationStatus;
  scannedAt?: string;
  scannedBy?: string;
  createdBy: string;
  createdByName?: string;
  createdByRole: 'promoter' | 'artist' | 'admin';
  createdAt: string;
}

export interface ScanStation {
  id: string;
  eventId: string;
  eventTitle: string;
  name: string; // ex: "Entrée Principale", "Entrée VIP", "Entrée Presse"
  accessCode: string; // ex: "STA-VIP-123"
  createdBy: string;
  createdByName?: string;
  isActive: boolean;
  scansCount: number;
  lastScannedAt?: string;
  notes?: string;
  createdAt: string;
}

export interface EventPreRegistration {
  id: string;
  eventId: string;
  userId?: string;
  fullName: string;
  phone: string;
  email?: string;
  createdAt: string;
}

export const CURRENT_TERMS_VERSION = 'v1.0';

export const CATEGORIES: { label: string; value: string; icon: string }[] = [
  { label: 'Tous', value: 'All', icon: 'auto_awesome' },
  { label: 'Galas & Prestige', value: 'Gala', icon: 'celebration' },
  { label: 'Concerts & Mbalax', value: 'Concert', icon: 'music_note' },
  { label: 'Festivals Plage', value: 'Festival', icon: 'festival' },
  { label: 'Nightlife & Clubs', value: 'Boîte de nuit', icon: 'nightlife' },
  { label: 'VIP Lounge', value: 'VIP Lounge', icon: 'local_bar' },
  { label: 'Culture & After-work', value: 'Culture', icon: 'groups' },
];

export const SENEGAL_CITIES = ['All', 'Thiès', 'Mbour', 'Saly', 'Dakar'];

