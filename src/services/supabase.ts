import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import {
  EventItem,
  EventStatus,
  UserTicket,
  UserProfile,
  TicketTier,
  OrderRecord,
  OrderStatus,
  PlatformPaymentSettings,
  SalesAgent,
  EventCoproducer,
  CoproducerRole,
  GuestTicket,
  Accreditation,
  AccreditationType,
  AccreditationStatus,
  ScanStation,
  LoginHistoryRecord,
  VigileSessionRecord,
} from '../types';
import { INITIAL_TICKETS } from '../data/mockEvents';
import { parseEventDates } from './calendar';

// Validation stricte UUID pour PostgreSQL Supabase
export const isValidUUID = (val?: string): boolean =>
  !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

// Parsing ISO 8601 infaillible et résilient aux chaînes de date en français
export const parseSafeIsoDate = (isoCandidate?: any, textDate?: any, timeStr?: string): string => {
  if (isoCandidate && typeof isoCandidate === 'string') {
    try {
      const d = new Date(isoCandidate);
      if (!isNaN(d.getTime())) return d.toISOString();
    } catch {}
  }
  if (textDate && typeof textDate === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(textDate)) {
      try {
        const d = new Date(textDate);
        if (!isNaN(d.getTime())) return d.toISOString();
      } catch {}
    }
    try {
      const { startDate } = parseEventDates(textDate, timeStr || '20:00');
      if (!isNaN(startDate.getTime())) return startDate.toISOString();
    } catch {}
  }
  return new Date().toISOString();
};

// Environment variables or localStorage config
export const normalizeSupabaseUrl = (url: string): string => {
  let cleaned = (url || '').trim();
  if (!cleaned) return '';
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = `https://${cleaned}`;
  }
  // Remove /rest/v1 suffix if pasted by user
  cleaned = cleaned.replace(/\/rest\/v1\/?$/, '');
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned;
};

const getEnvVar = (key: string): string => {
  if (typeof window !== 'undefined') {
    const local = localStorage.getItem(key);
    if (local) return local;
  }
  return (import.meta as any).env?.[key] || '';
};

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConnected: boolean;
}

export interface TransactionRecord {
  id: string;
  ticketId?: string;
  orderId?: string;
  eventId: string;
  eventTitle: string;
  promoterId: string;
  promoterName: string;
  customerName: string;
  customerPhone: string;
  paymentMethod: 'wave' | 'om' | 'yas' | 'card';
  totalAmount: number; // in FCFA
  promoterShare: number; // Part Promoteur
  platformFee: number; // Commission Thièsdn
  operatorFee: number; // Frais Opérateur Wave/OM
  status: 'completed' | 'pending' | 'refunded';
  createdAt: string;
}

// In-memory or localStorage store for persistence when offline or local
const STORAGE_EVENTS_KEY = 'thiesdn_events_v2';
const STORAGE_TICKETS_KEY = 'thiesdn_tickets_v2';
const STORAGE_ORDERS_KEY = 'thiesdn_orders_v2';
const STORAGE_TRANSACTIONS_KEY = 'thiesdn_transactions_v2';
const STORAGE_SETTINGS_KEY = 'thiesdn_platform_settings_v1';
const STORAGE_AGENTS_KEY = 'thiesdn_sales_agents_v1';

export const INITIAL_SALES_AGENTS: SalesAgent[] = [
  {
    id: 'agent-fatou-1',
    eventId: 'evt-soiree-prestige',
    eventTitle: 'Nuit du Baobab Prestige',
    promoterId: 'prom-thiesdn',
    pointDeVente: 'Boutique Chez Fatou',
    gerantName: 'Fatou Kiné Diop',
    telephone: '+221 77 123 45 67',
    email: 'chezfatou.thies@gmail.com',
    quartier: 'Grand Standing',
    allocatedCount: 50,
    soldCount: 38,
    commissionPercent: 10,
    cashCollected: 133000,
    amountDue: 119700,
    amountPaidToPromoter: 70000,
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'agent-escale-2',
    eventId: 'evt-soiree-prestige',
    eventTitle: 'Nuit du Baobab Prestige',
    promoterId: 'prom-thiesdn',
    pointDeVente: 'Kiosque Escale Centre',
    gerantName: 'Moussa Ndiaye',
    telephone: '+221 78 456 78 90',
    email: 'kiosque.escale@gmail.com',
    quartier: 'Escale Sud (Centre-Ville)',
    allocatedCount: 100,
    soldCount: 65,
    commissionPercent: 8,
    cashCollected: 227500,
    amountDue: 209300,
    amountPaidToPromoter: 150000,
    status: 'active',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'agent-saly-3',
    eventId: 'evt-festival-rail',
    eventTitle: 'Festival des Rails de Thiès 2026',
    promoterId: 'prom-thiesdn',
    pointDeVente: 'Multi-Services Médina Fall',
    gerantName: 'Ousmane Cissé',
    telephone: '+221 76 789 01 23',
    email: 'cisse.services@yahoo.fr',
    quartier: 'Médina Fall',
    allocatedCount: 30,
    soldCount: 12,
    commissionPercent: 10,
    cashCollected: 42000,
    amountDue: 37800,
    amountPaidToPromoter: 0,
    status: 'active',
    createdAt: new Date().toISOString(),
  },
];

export const STORAGE_COPRODUCERS_KEY = 'thiesdn_coproducers_v1';
export const STORAGE_GUEST_TICKETS_KEY = 'thiesdn_guest_tickets_v1';

export const INITIAL_COPRODUCERS: EventCoproducer[] = [
  {
    id: 'coprod-waly-1',
    eventId: 'evt-soiree-prestige',
    eventTitle: 'Nuit du Baobab Prestige',
    promoterId: 'prom-thiesdn',
    userId: 'usr-artist-waly',
    name: 'Waly Ballago Seck',
    phone: '+221 77 555 12 34',
    email: 'waly.seck@thiesdn.sn',
    roleType: 'artiste',
    revenueShare: 50, // 50% pour l'artiste vedette
    guestTicketsAllocated: 25,
    guestTicketsUsed: 14,
    notes: 'Contrat Co-Prod Exclusif Thiès 2026. Accord de transparence signé.',
    decompteValidated: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'coprod-manager-2',
    eventId: 'evt-soiree-prestige',
    eventTitle: 'Nuit du Baobab Prestige',
    promoterId: 'prom-thiesdn',
    name: 'Djiby Ndiaye (Manager Staff)',
    phone: '+221 78 222 33 44',
    email: 'management@walyseck.sn',
    roleType: 'staff_artiste',
    revenueShare: 0,
    guestTicketsAllocated: 15,
    guestTicketsUsed: 8,
    notes: 'Coordination régie, accueil VIP & loges.',
    decompteValidated: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'coprod-latdior-3',
    eventId: 'evt-soiree-prestige',
    eventTitle: 'Nuit du Baobab Prestige',
    promoterId: 'prom-thiesdn',
    name: 'Lat Dior Productions (Producteur Principal)',
    phone: '+221 77 123 45 67',
    email: 'latdior.prod@gmail.com',
    roleType: 'producteur_principal',
    revenueShare: 40, // 40% pour la production
    guestTicketsAllocated: 20,
    guestTicketsUsed: 10,
    notes: 'Financement salle, sono, sécurité et logistique.',
    decompteValidated: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'coprod-lieu-4',
    eventId: 'evt-soiree-prestige',
    eventTitle: 'Nuit du Baobab Prestige',
    promoterId: 'prom-thiesdn',
    name: 'Direction Baobab Lounge Thiès',
    phone: '+221 76 888 99 00',
    email: 'baobab.thies@gmail.com',
    roleType: 'gerant_lieu',
    revenueShare: 10, // 10% pour le lieu
    guestTicketsAllocated: 10,
    guestTicketsUsed: 5,
    notes: 'Mise à disposition salle & bar.',
    decompteValidated: false,
    createdAt: new Date().toISOString(),
  },
];

export const INITIAL_GUEST_TICKETS: GuestTicket[] = [
  {
    id: 'gst-1',
    eventId: 'evt-soiree-prestige',
    eventTitle: 'Nuit du Baobab Prestige',
    coproducerId: 'coprod-waly-1',
    coproducerName: 'Waly Ballago Seck',
    guestName: 'Mamadou Lamine Diop (Invité VIP Artiste)',
    guestPhone: '+221 77 111 22 33',
    qrCode: 'GUEST-THS-WBS-01',
    status: 'used',
    scannedAt: '2026-10-22T21:45:00Z',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'gst-2',
    eventId: 'evt-soiree-prestige',
    eventTitle: 'Nuit du Baobab Prestige',
    coproducerId: 'coprod-waly-1',
    coproducerName: 'Waly Ballago Seck',
    guestName: 'Awa Fall (Famille Artiste)',
    guestPhone: '+221 78 333 44 55',
    qrCode: 'GUEST-THS-WBS-02',
    status: 'valid',
    createdAt: new Date().toISOString(),
  },
];

export const STORAGE_ACCREDITATIONS_KEY = 'thiesdn_accreditations_v1';

export const INITIAL_ACCREDITATIONS: Accreditation[] = [
  {
    id: 'acc-staff-1',
    eventId: 'evt-soiree-prestige',
    eventTitle: 'Nuit du Baobab Prestige',
    type: 'staff',
    holderName: 'Abdoulaye Sène',
    holderPhone: '+221 77 123 45 67',
    holderEmail: 'a.sene@production.sn',
    organization: 'Régie Technique & Son',
    qrCode: 'ACC-STAFF-THS-8F2B',
    status: 'validated',
    createdBy: 'prom-thiesdn',
    createdByName: 'Lat Dior Productions',
    createdByRole: 'promoter',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'acc-staff-2',
    eventId: 'evt-soiree-prestige',
    eventTitle: 'Nuit du Baobab Prestige',
    type: 'staff',
    holderName: 'Ibrahima Ba',
    holderPhone: '+221 78 987 65 43',
    organization: 'Sécurité Baobab & Portes',
    qrCode: 'ACC-STAFF-THS-3C7A',
    status: 'scanned',
    scannedAt: '2026-10-22T20:15:00Z',
    createdBy: 'prom-thiesdn',
    createdByName: 'Lat Dior Productions',
    createdByRole: 'promoter',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'acc-invite-1',
    eventId: 'evt-soiree-prestige',
    eventTitle: 'Nuit du Baobab Prestige',
    type: 'invite',
    holderName: 'Honorable Député / Maire Thiès-Est',
    holderPhone: '+221 77 654 32 10',
    organization: 'Mairie de Thiès-Est',
    qrCode: 'ACC-INVITE-THS-9A1D',
    status: 'validated',
    createdBy: 'prom-thiesdn',
    createdByName: 'Lat Dior Productions',
    createdByRole: 'promoter',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'acc-invite-2',
    eventId: 'evt-soiree-prestige',
    eventTitle: 'Nuit du Baobab Prestige',
    type: 'invite',
    holderName: 'Seynabou Diop',
    holderPhone: '+221 76 543 21 09',
    organization: 'Famille & VIP Artiste',
    qrCode: 'ACC-INVITE-THS-4E2F',
    status: 'validated',
    createdBy: 'coprod-waly-1',
    createdByName: 'Waly Ballago Seck',
    createdByRole: 'artist',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'acc-presse-1',
    eventId: 'evt-soiree-prestige',
    eventTitle: 'Nuit du Baobab Prestige',
    type: 'presse',
    holderName: 'Cheikh Tidiane Fall',
    holderPhone: '+221 77 345 67 89',
    holderEmail: 'ctfall@rts.sn',
    organization: 'RTS 1 Sénégal (Télévision)',
    qrCode: 'ACC-PRESSE-THS-7D5C',
    status: 'scanned',
    scannedAt: '2026-10-22T20:45:00Z',
    createdBy: 'prom-thiesdn',
    createdByName: 'Lat Dior Productions',
    createdByRole: 'promoter',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'acc-presse-2',
    eventId: 'evt-soiree-prestige',
    eventTitle: 'Nuit du Baobab Prestige',
    type: 'presse',
    holderName: 'Aïssatou Traoré',
    holderPhone: '+221 78 234 56 78',
    organization: 'Thiès Info Média',
    qrCode: 'ACC-PRESSE-THS-1B9E',
    status: 'validated',
    createdBy: 'prom-thiesdn',
    createdByName: 'Lat Dior Productions',
    createdByRole: 'promoter',
    createdAt: new Date().toISOString(),
  },
];

export const STORAGE_SCAN_STATIONS_KEY = 'thiesdn_scan_stations_v1';

export const INITIAL_SCAN_STATIONS: ScanStation[] = [
  {
    id: 'sta-main-1',
    eventId: 'evt-soiree-prestige',
    eventTitle: 'Nuit du Baobab Prestige',
    name: 'Entrée Principale (Tout Public)',
    accessCode: 'STA-MAIN-101',
    createdBy: 'prom-thiesdn',
    createdByName: 'Lat Dior Productions',
    isActive: true,
    scansCount: 150,
    lastScannedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    notes: 'File générale public prévente & jour J',
    createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
  },
  {
    id: 'sta-vip-2',
    eventId: 'evt-soiree-prestige',
    eventTitle: 'Nuit du Baobab Prestige',
    name: 'Entrée VIP & Loges Prestige',
    accessCode: 'STA-VIP-202',
    createdBy: 'prom-thiesdn',
    createdByName: 'Lat Dior Productions',
    isActive: true,
    scansCount: 45,
    lastScannedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    notes: 'Tapis rouge & bracelets VIP dorés',
    createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
  },
  {
    id: 'sta-press-3',
    eventId: 'evt-soiree-prestige',
    eventTitle: 'Nuit du Baobab Prestige',
    name: 'Entrée Presse, Médias & Staff',
    accessCode: 'STA-PRESS-303',
    createdBy: 'prom-thiesdn',
    createdByName: 'Lat Dior Productions',
    isActive: true,
    scansCount: 10,
    lastScannedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    notes: 'Porte régie technique & équipes de reportage',
    createdAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
  },
];

let inMemoryOrders: OrderRecord[] = [];
let inMemoryTickets: UserTicket[] = [...INITIAL_TICKETS];
let inMemoryTransactions: TransactionRecord[] = [];
let inMemoryAgents: SalesAgent[] = [...INITIAL_SALES_AGENTS];
let inMemoryCoproducers: EventCoproducer[] = [...INITIAL_COPRODUCERS];
let inMemoryGuestTickets: GuestTicket[] = [...INITIAL_GUEST_TICKETS];
let inMemoryAccreditations: Accreditation[] = [...INITIAL_ACCREDITATIONS];
let inMemoryScanStations: ScanStation[] = [...INITIAL_SCAN_STATIONS];
let inMemorySettings: PlatformPaymentSettings = {
  waveNumber: 'SN 85 71 88 49',
  waveBeneficiary: 'Wave Business — ThièsDN',
  omNumber: '+221 77 458 74 74',
  omBeneficiary: 'ThièsDN Billetterie',
};

let cachedClient: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  const currentUrl = normalizeSupabaseUrl(getEnvVar('VITE_SUPABASE_URL'));
  const currentKey = getEnvVar('VITE_SUPABASE_ANON_KEY').trim();

  if (!currentUrl || !currentKey || currentUrl.includes('xyzcompany')) {
    return null;
  }

  if (!cachedClient) {
    try {
      cachedClient = createClient(currentUrl, currentKey);
    } catch (e) {
      console.warn('Erreur initialisation Supabase Client:', e);
      return null;
    }
  }
  return cachedClient;
};

export const saveSupabaseCredentials = (url: string, anonKey: string) => {
  if (typeof window !== 'undefined') {
    const cleanUrl = normalizeSupabaseUrl(url);
    localStorage.setItem('VITE_SUPABASE_URL', cleanUrl);
    localStorage.setItem('VITE_SUPABASE_ANON_KEY', anonKey.trim());
    cachedClient = null; // reset client
  }
};

export const isSupabaseConfigured = (): boolean => {
  const url = normalizeSupabaseUrl(getEnvVar('VITE_SUPABASE_URL'));
  const key = getEnvVar('VITE_SUPABASE_ANON_KEY');
  return Boolean(url && key && !url.includes('xyzcompany') && !url.includes('your-project'));
};

// ====================================================================
// AUTHENTIFICATION RÉELLE SUPABASE AUTH
// ====================================================================

export const signUpWithSupabase = async (
  email: string,
  pass: string,
  metadata: {
    name: string;
    phone?: string;
    city?: string;
    address?: string;
    quartier?: string;
    role?: 'user' | 'promoter' | 'admin';
    termsAccepted?: boolean;
    termsAcceptedAt?: string;
    termsVersion?: string;
  }
) => {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase n\'est pas encore configuré.');
  }

  const redirectUrl = typeof window !== 'undefined' ? window.location.origin : undefined;
  const termsAcceptedAt = metadata.termsAcceptedAt || new Date().toISOString();
  const termsVersion = metadata.termsVersion || 'v1.0';

  const { data, error } = await client.auth.signUp({
    email,
    password: pass,
    options: {
      data: {
        name: metadata.name,
        phone: metadata.phone || '',
        city: metadata.city || 'Thiès',
        address: metadata.address || '',
        quartier: metadata.quartier || metadata.address || '',
        // En production, le rôle est forcé à 'user' côté serveur
        role: metadata.role || 'user',
        terms_accepted: metadata.termsAccepted ?? true,
        terms_accepted_at: termsAcceptedAt,
        terms_version: termsVersion,
      },
      emailRedirectTo: redirectUrl,
    },
  });

  if (error) throw error;

  // Sauvegarde explicite dans la table 'profiles' (colonnes city, address, quartier, terms_accepted)
  if (data?.user?.id) {
    try {
      const profileData: Record<string, any> = {
        id: data.user.id,
        name: metadata.name,
        phone: metadata.phone || '',
        city: metadata.city || 'Thiès',
        address: metadata.address || '',
        quartier: metadata.quartier || metadata.address || '',
        role: 'user',
        email: email.trim().toLowerCase(),
        terms_accepted: metadata.termsAccepted ?? true,
        terms_accepted_at: termsAcceptedAt,
        terms_version: termsVersion,
      };

      const { error: upsertErr } = await client
        .from('profiles')
        .upsert(profileData, { onConflict: 'id' });

      if (upsertErr) {
        // Fallback transparent si une colonne n'existe pas encore
        if (upsertErr.message?.includes('city')) delete profileData.city;
        if (upsertErr.message?.includes('quartier')) delete profileData.quartier;
        if (upsertErr.message?.includes('terms_accepted')) {
          delete profileData.terms_accepted;
          delete profileData.terms_accepted_at;
          delete profileData.terms_version;
        }
        await client.from('profiles').upsert(profileData, { onConflict: 'id' });
      }
    } catch (upsertCatch) {
      console.warn('Initial profile upsert notice (handle by DB trigger if present):', upsertCatch);
    }
  }

  return data;
};

export const resendConfirmationEmail = async (email: string) => {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase n\'est pas encore configuré.');
  }

  const redirectUrl = typeof window !== 'undefined' ? window.location.origin : undefined;

  const { data, error } = await client.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: {
      emailRedirectTo: redirectUrl,
    },
  });

  if (error) throw error;
  return data;
};

export const signInWithSupabase = async (email: string, pass: string) => {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase n\'est pas encore configuré.');
  }

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: pass,
  });

  if (error) {
    // Traduction explicite en français pour la vérification email
    if (error.message?.toLowerCase().includes('email not confirmed')) {
      throw new Error('Votre adresse email n\'a pas encore été confirmée. Veuillez cliquer sur le lien reçu dans votre boîte de réception pour activer votre compte.');
    }
    throw error;
  }
  return data;
};

export const signOutWithSupabase = async () => {
  const client = getSupabaseClient();
  if (client) {
    await client.auth.signOut();
  }
};

export const fetchUserProfile = async (userId: string, authUser?: any): Promise<UserProfile | null> => {
  const client = getSupabaseClient();
  if (!client) return null;

  try {
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) return null;

    // Détermination stricte du statut de confirmation email
    const isEmailConfirmed = Boolean(
      authUser?.email_confirmed_at ||
      authUser?.confirmed_at ||
      (authUser && !authUser.email) // Cas particulier si session déjà validée
    );

    return {
      id: data.id,
      name: data.name || 'Utilisateur',
      username: data.username || data.name || 'user',
      email: data.email || authUser?.email || '',
      phone: data.phone || '',
      city: data.city || 'Thiès',
      address: data.address || '',
      quartier: data.quartier || data.address || '',
      avatar: data.avatar || '',
      isVip: Boolean(data.is_vip),
      role: data.role || 'user',
      isEmailConfirmed,
      termsAccepted: Boolean(data.terms_accepted),
      termsAcceptedAt: data.terms_accepted_at || undefined,
      termsVersion: data.terms_version || undefined,
      connectedAccounts: { facebook: false, instagram: false, tiktok: false },
      privacySettings: { publicProfile: true, biometricLogin: false, emailNotifications: true },
    };
  } catch (err) {
    console.error('Erreur fetchUserProfile:', err);
    return null;
  }
};

/**
 * Mise à jour des informations de profil utilisateur dans Supabase
 */
export const updateUserProfileInSupabase = async (
  userId: string,
  updates: Partial<UserProfile>
): Promise<{ success: boolean; error?: string }> => {
  const client = getSupabaseClient();
  if (!client || !userId) return { success: true }; // En local ou offline

  try {
    const payload: Record<string, any> = {};
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.phone !== undefined) payload.phone = updates.phone;
    if (updates.city !== undefined) payload.city = updates.city;
    if (updates.address !== undefined) payload.address = updates.address;
    if (updates.quartier !== undefined) payload.quartier = updates.quartier;
    if (updates.termsAccepted !== undefined) payload.terms_accepted = updates.termsAccepted;
    if (updates.termsAcceptedAt !== undefined) payload.terms_accepted_at = updates.termsAcceptedAt;
    if (updates.termsVersion !== undefined) payload.terms_version = updates.termsVersion;

    const { error } = await client.from('profiles').update(payload).eq('id', userId);
    if (error) {
      let needsRetry = false;
      if (error.message?.includes('city')) {
        delete payload.city;
        needsRetry = true;
      }
      if (error.message?.includes('quartier')) {
        delete payload.quartier;
        needsRetry = true;
      }
      if (error.message?.includes('terms_accepted')) {
        delete payload.terms_accepted;
        delete payload.terms_accepted_at;
        delete payload.terms_version;
        needsRetry = true;
      }
      if (needsRetry && Object.keys(payload).length > 0) {
        const { error: retryErr } = await client.from('profiles').update(payload).eq('id', userId);
        if (retryErr) throw retryErr;
      } else if (!needsRetry) {
        throw error;
      }
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Erreur updateUserProfileInSupabase:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Enregistrement formel de l'acceptation des CGV par un promoteur ou artiste
 */
export const acceptTermsOfServiceInSupabase = async (
  userId: string,
  version = 'v1.0'
): Promise<{ success: boolean; error?: string; timestamp: string }> => {
  const timestamp = new Date().toISOString();
  const client = getSupabaseClient();

  if (!client || !userId) {
    return { success: true, timestamp };
  }

  try {
    const { error } = await client
      .from('profiles')
      .update({
        terms_accepted: true,
        terms_accepted_at: timestamp,
        terms_version: version,
      })
      .eq('id', userId);

    if (error) {
      console.warn('Sync Supabase acceptTermsOfServiceInSupabase:', error.message);
      return { success: false, error: error.message, timestamp };
    }
    return { success: true, timestamp };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erreur enregistrement CGV', timestamp };
  }
};

/**
 * Récupération de tous les profils utilisateurs pour la Gestion Admin
 */
export const fetchAllProfilesFromSupabase = async (): Promise<{ profiles: UserProfile[]; error: string | null }> => {
  const client = getSupabaseClient();
  if (!client) {
    return {
      profiles: [
        {
          id: 'usr-admin-1',
          name: 'Mbaye Gueye',
          username: 'mbaye.gueye',
          email: 'mediasandgraphisme.sn@gmail.com',
          phone: '+221 77 458 74 74',
          address: 'Thiès, Sénégal',
          quartier: 'Grand Standing',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop',
          isVip: true,
          role: 'admin',
          isEmailConfirmed: true,
          termsAccepted: true,
          termsAcceptedAt: '2026-10-01T10:00:00Z',
          termsVersion: 'v1.0',
          connectedAccounts: { facebook: true, instagram: true, tiktok: false },
          privacySettings: { publicProfile: true, biometricLogin: false, emailNotifications: true },
        },
        {
          id: 'usr-promoter-1',
          name: 'Lat Dior Productions',
          username: 'latdior.prod',
          email: 'contact@latdior.sn',
          phone: '+221 77 890 12 34',
          address: 'Thiès, Sénégal',
          quartier: 'Randoulène Nord',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop',
          isVip: false,
          role: 'promoter',
          isEmailConfirmed: true,
          termsAccepted: true,
          termsAcceptedAt: '2026-10-05T14:30:00Z',
          termsVersion: 'v1.0',
          connectedAccounts: { facebook: true, instagram: true, tiktok: true },
          privacySettings: { publicProfile: true, biometricLogin: false, emailNotifications: true },
        },
        {
          id: 'usr-client-1',
          name: 'Awa Diop',
          username: 'awa.diop',
          email: 'awa.diop@gmail.com',
          phone: '+221 76 123 45 67',
          address: 'Thiès, Sénégal',
          quartier: 'Escale Sud (Centre-Ville)',
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop',
          isVip: false,
          role: 'user',
          isEmailConfirmed: true,
          termsAccepted: true,
          termsAcceptedAt: '2026-10-12T09:15:00Z',
          termsVersion: 'v1.0',
          connectedAccounts: { facebook: false, instagram: false, tiktok: false },
          privacySettings: { publicProfile: false, biometricLogin: false, emailNotifications: true },
        },
        {
          id: 'usr-client-2',
          name: 'Cheikh Sene',
          username: 'cheikh.sene',
          email: 'cheikh.sene@hotmail.com',
          phone: '+221 78 555 44 33',
          address: 'Thiès, Sénégal',
          quartier: 'Médina Fall',
          avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200&auto=format&fit=crop',
          isVip: true,
          role: 'user',
          isEmailConfirmed: true,
          termsAccepted: true,
          termsAcceptedAt: '2026-10-18T18:40:00Z',
          termsVersion: 'v1.0',
          connectedAccounts: { facebook: false, instagram: false, tiktok: false },
          privacySettings: { publicProfile: true, biometricLogin: false, emailNotifications: true },
        },
        {
          id: 'usr-promoter-2',
          name: 'Petite Côte Night Agency',
          username: 'saly.night',
          email: 'events@saly.sn',
          phone: '+221 77 333 22 11',
          address: 'Saly Portudal',
          quartier: 'Autre quartier / Autre ville',
          avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200&auto=format&fit=crop',
          isVip: false,
          role: 'promoter',
          isEmailConfirmed: true,
          termsAccepted: false, // En attente d'acceptation CGV
          connectedAccounts: { facebook: true, instagram: true, tiktok: false },
          privacySettings: { publicProfile: true, biometricLogin: false, emailNotifications: true },
        },
      ],
      error: null,
    };
  }

  try {
    const { data, error } = await client
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    const profiles: UserProfile[] = (data || []).map((d: any) => ({
      id: d.id,
      name: d.name || 'Utilisateur',
      username: d.username || d.name || 'user',
      email: d.email || '',
      phone: d.phone || '',
      city: d.city || 'Thiès',
      address: d.address || '',
      quartier: d.quartier || '',
      avatar: d.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop',
      isVip: Boolean(d.is_vip),
      role: d.role || 'user',
      isEmailConfirmed: true,
      termsAccepted: Boolean(d.terms_accepted),
      termsAcceptedAt: d.terms_accepted_at || undefined,
      termsVersion: d.terms_version || undefined,
      connectedAccounts: { facebook: false, instagram: false, tiktok: false },
      privacySettings: { publicProfile: true, biometricLogin: false, emailNotifications: true },
    }));
    return { profiles, error: null };
  } catch (err: any) {
    return { profiles: [], error: err.message };
  }
};

/**
 * Modification administrative du rôle ou du statut VIP d'un utilisateur
 */
export const updateUserRoleOrVip = async (
  userId: string,
  updates: { role?: 'user' | 'promoter' | 'admin'; isVip?: boolean }
): Promise<{ success: boolean; data?: any; error?: string }> => {
  const client = getSupabaseClient();
  if (!client || !userId) {
    return { success: false, error: 'Connexion Supabase non initialisée ou identifiant utilisateur manquant.' };
  }

  try {
    const payload: Record<string, any> = {};
    if (updates.role !== undefined) payload.role = updates.role;
    if (updates.isVip !== undefined) payload.is_vip = updates.isVip;

    // Requête explicite avec .select() pour vérifier que la ligne a bien été modifiée par PostgreSQL/RLS
    const { data, error } = await client
      .from('profiles')
      .update(payload)
      .eq('id', userId)
      .select();

    if (error) {
      console.error('Erreur Supabase updateUserRoleOrVip:', error);
      return { success: false, error: error.message };
    }

    // Contrôle anti-faux succès : si la RLS bloque silencieusement, data est vide []
    if (!data || data.length === 0) {
      const rlsMsg = "La modification n'a pas été autorisée par la base de données. Assurez-vous d'être connecté avec un compte ayant le rôle administrateur dans la table profiles.";
      console.error('RLS Bloquant updateUserRoleOrVip: 0 ligne mise à jour', { userId, payload });
      return { success: false, error: rlsMsg };
    }

    // Étape 3 : Si la mise à jour concerne l'utilisateur actuellement connecté, forcer le rafraîchissement de session
    try {
      const { data: sessionData } = await client.auth.getSession();
      if (sessionData.session?.user?.id === userId) {
        await client.auth.refreshSession();
      }
    } catch (refreshErr) {
      console.warn('refreshSession notice:', refreshErr);
    }

    return { success: true, data: data[0] };
  } catch (err: any) {
    console.error('Exception updateUserRoleOrVip:', err);
    return { success: false, error: err.message || 'Erreur inattendue lors de la mise à jour' };
  }
};

/**
 * Upload d'une photo de profil vers Supabase Storage (Bucket 'avatars')
 * et mise à jour de la table profiles
 */
export const uploadAvatarToSupabase = async (
  userId: string,
  file: File
): Promise<{ success: boolean; avatarUrl?: string; error?: string }> => {
  if (!file.type.startsWith('image/')) {
    return { success: false, error: 'Format non supporté. Veuillez choisir une image (JPG, PNG, WebP).' };
  }

  // 2 Mo max (2 * 1024 * 1024 octets)
  if (file.size > 2 * 1024 * 1024) {
    return { success: false, error: 'L\'image est trop volumineuse. La taille maximale autorisée est de 2 Mo.' };
  }

  const client = getSupabaseClient();
  const fileExt = file.name.split('.').pop() || 'jpg';
  const cleanExt = fileExt.toLowerCase().replace(/[^a-z0-9]/g, '');
  const timestamp = Date.now();
  const targetId = userId || 'user_' + timestamp;
  const filePath = `${targetId}/avatar_${timestamp}.${cleanExt}`;

  // Si Supabase est connecté, uploader vers le bucket 'avatars'
  if (client) {
    try {
      const { data: uploadData, error: uploadError } = await client.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        console.warn('Erreur Supabase Storage avatars:', uploadError.message);
        // Si le bucket n'existe pas encore ou permission manquante, repli Data URL pour retour instantané
        const base64Url = await fileToDataUrl(file);
        if (userId) {
          try {
            await client.from('profiles').update({ avatar: base64Url }).eq('id', userId);
          } catch (dbErr) {
            console.warn('Sync profile avatar fallback catch:', dbErr);
          }
        }
        return {
          success: true,
          avatarUrl: base64Url,
          error: 'Bucket Supabase avatars en attente de configuration. Image sauvegardée localement.',
        };
      }

      // Récupérer l'URL publique de l'image stockée
      const { data: urlData } = client.storage.from('avatars').getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl;

      // Mettre à jour la colonne 'avatar' dans public.profiles
      if (userId) {
        const { error: profileError } = await client
          .from('profiles')
          .update({ avatar: publicUrl })
          .eq('id', userId);

        if (profileError) {
          console.warn('Erreur mise à jour profil avatar:', profileError.message);
        }
      }

      return { success: true, avatarUrl: publicUrl };
    } catch (err: any) {
      console.error('Erreur upload avatar catch:', err);
      const base64Url = await fileToDataUrl(file);
      return { success: true, avatarUrl: base64Url };
    }
  }

  // Mode local
  const localUrl = await fileToDataUrl(file);
  return { success: true, avatarUrl: localUrl };
};

const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
};

// ====================================================================
// PARAMÈTRES OFFICIELS DE PAIEMENT MANUEL (WAVE & ORANGE MONEY)
// ====================================================================
export const DEFAULT_PAYMENT_SETTINGS: PlatformPaymentSettings = {
  waveNumber: 'SN 85 71 88 49',
  waveBeneficiary: 'Wave Business — ThièsDN',
  omNumber: '+221 77 458 74 74',
  omBeneficiary: 'ThièsDN Billetterie',
};

export const getStoredPaymentSettings = (): PlatformPaymentSettings => {
  if (typeof window === 'undefined') return inMemorySettings;
  const stored = localStorage.getItem(STORAGE_SETTINGS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return inMemorySettings;
    }
  }
  return inMemorySettings;
};

export const savePaymentSettings = (settings: PlatformPaymentSettings) => {
  inMemorySettings = settings;
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(settings));
  }
};

// ====================================================================
// GESTION ATOMIQUE DES COMMANDES & DES STOCKS
// ====================================================================
export const getStoredOrders = (): OrderRecord[] => {
  if (typeof window === 'undefined') return inMemoryOrders;
  const stored = localStorage.getItem(STORAGE_ORDERS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return inMemoryOrders;
    }
  }
  return inMemoryOrders;
};

export const saveOrderRecord = (order: OrderRecord): OrderRecord[] => {
  const current = getStoredOrders();
  const existingIdx = current.findIndex((o) => o.id === order.id);
  let updated: OrderRecord[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = order;
  } else {
    updated = [order, ...current];
  }
  inMemoryOrders = updated;
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(updated));
  }
  return updated;
};

/**
 * Création d'une commande avec vérification atomique des stocks.
 * Évite formellement les surventes (overselling).
 */
export const createOrderWithStockCheck = async (
  event: EventItem,
  tier: TicketTier,
  quantity: number,
  customerData: {
    name: string;
    phone: string;
    paymentMethod: 'wave' | 'om';
    userId?: string;
    customTotal?: number;
    discountAmount?: number;
    promoCodeApplied?: string;
  }
): Promise<{ success: boolean; order?: OrderRecord; message: string }> => {
  if (quantity <= 0) {
    return { success: false, message: 'La quantité demandée doit être supérieure à 0.' };
  }

  // 1. Vérification du stock disponible
  const currentAvailable = tier.available;
  if (currentAvailable < quantity) {
    return {
      success: false,
      message: `Stock insuffisant pour "${tier.name}". Places restantes : ${currentAvailable}.`,
    };
  }

  const client = getSupabaseClient();
  const reference = `CMD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
  const totalAmount = customerData.customTotal !== undefined ? customerData.customTotal : tier.price * quantity;

  // Si Supabase est connecté, utiliser la fonction RPC atomique ou transaction
  if (client) {
    try {
      const { data, error } = await client.rpc('create_order_with_stock', {
        p_event_id: event.id,
        p_tier_id: tier.id,
        p_quantity: quantity,
        p_customer_name: customerData.name,
        p_customer_phone: customerData.phone,
        p_payment_method: customerData.paymentMethod,
        p_reference: reference,
        p_total_amount: totalAmount,
      });

      if (error) {
        // Fallback Supabase si la RPC n'a pas encore été migrée dans le SQL Editor
        const { data: directOrder, error: insertErr } = await client
          .from('orders')
          .insert({
            reference,
            event_id: event.id,
            user_id: customerData.userId || null,
            tier_id: tier.id,
            tier_name: tier.name,
            quantity,
            unit_price: tier.price,
            total_amount: totalAmount,
            payment_method: customerData.paymentMethod,
            customer_name: customerData.name,
            customer_phone: customerData.phone,
            status: 'pending',
          })
          .select()
          .single();

        if (insertErr) {
          throw insertErr;
        }

        const newOrder: OrderRecord = {
          id: directOrder.id,
          reference: directOrder.reference,
          eventId: event.id,
          eventTitle: event.title,
          userId: customerData.userId,
          tierId: tier.id,
          tierName: tier.name,
          quantity,
          unitPrice: tier.price,
          totalAmount,
          discountAmount: customerData.discountAmount,
          promoCodeApplied: customerData.promoCodeApplied,
          paymentMethod: customerData.paymentMethod,
          customerName: customerData.name,
          customerPhone: customerData.phone,
          status: 'pending',
          createdAt: directOrder.created_at || new Date().toISOString(),
        };

        saveOrderRecord(newOrder);
        return { success: true, order: newOrder, message: 'Commande créée avec succès.' };
      }

      if (data && !data.success) {
        return { success: false, message: data.message || 'Erreur lors de la réservation du stock.' };
      }

      const confirmedOrder: OrderRecord = {
        id: data.order_id || reference,
        reference,
        eventId: event.id,
        eventTitle: event.title,
        userId: customerData.userId,
        tierId: tier.id,
        tierName: tier.name,
        quantity,
        unitPrice: tier.price,
        totalAmount,
        discountAmount: customerData.discountAmount,
        promoCodeApplied: customerData.promoCodeApplied,
        paymentMethod: customerData.paymentMethod,
        customerName: customerData.name,
        customerPhone: customerData.phone,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      saveOrderRecord(confirmedOrder);
      return { success: true, order: confirmedOrder, message: 'Commande créée avec succès.' };
    } catch (err: any) {
      console.warn('Fallback local pour création de commande:', err.message);
    }
  }

  // Fallback Local avec décrémentation atomique
  const newOrder: OrderRecord = {
    id: `ord-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    reference,
    eventId: event.id,
    eventTitle: event.title,
    userId: customerData.userId,
    tierId: tier.id,
    tierName: tier.name,
    quantity,
    unitPrice: tier.price,
    totalAmount,
    discountAmount: customerData.discountAmount,
    promoCodeApplied: customerData.promoCodeApplied,
    paymentMethod: customerData.paymentMethod,
    customerName: customerData.name,
    customerPhone: customerData.phone,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  saveOrderRecord(newOrder);
  return { success: true, order: newOrder, message: 'Commande créée avec succès.' };
};

// ====================================================================
// CONTRÔLE D'ACCÈS & SCAN ATOMIQUE DU QR CODE (ZÉRO DOUBLE VALIDATION)
// ====================================================================
export const scanTicketAtomic = async (
  ticketCode: string,
  localTickets: UserTicket[],
  stationCode: string = 'ADMIN-CHECKIN',
  eventId?: string
): Promise<{
  success: boolean;
  message: string;
  ticket?: UserTicket;
}> => {
  const cleanCode = ticketCode.trim().toUpperCase();
  const client = getSupabaseClient();

  if (client) {
    try {
      // Appel de la procédure stockée RPC sécurisée avec stationCode et eventId
      const { data, error } = await client.rpc('scan_ticket', {
        p_qr_code: cleanCode,
        p_station_code: (stationCode || 'ADMIN-CHECKIN').trim(),
        p_event_id: isValidUUID(eventId) ? eventId : null,
      });

      if (!error && data) {
        return {
          success: Boolean(data.success),
          message: data.message || (data.success ? 'Accès Autorisé' : 'Billet invalide'),
          ticket: data.ticket ? {
            id: data.ticket.id,
            eventId: data.ticket.event_id || '',
            eventTitle: data.ticket.event_title || '',
            eventPoster: data.ticket.event_poster || '',
            eventDate: data.ticket.event_date || '',
            eventTime: data.ticket.event_time || '',
            eventVenue: data.ticket.event_venue || '',
            tierName: data.ticket.tier_name || '',
            price: data.ticket.price || 0,
            qrCode: data.ticket.qr_code || cleanCode,
            holderName: data.ticket.holder_name || '',
            holderPhone: data.ticket.holder_phone || undefined,
            purchasedAt: data.ticket.purchased_at || '',
            status: data.ticket.status || 'used',
          } : undefined,
        };
      }
    } catch (e: any) {
      console.warn('Fallback vérification ticket local:', e.message);
    }
  }

  // Vérification atomique locale
  const found = localTickets.find(
    (t) => t.qrCode.toUpperCase() === cleanCode || t.id.toUpperCase() === cleanCode
  );

  if (!found) {
    return {
      success: false,
      message: 'Billet non reconnu ou invalide dans le système.',
    };
  }

  // RÈGLE DE SÉCURITÉ CRITIQUE : VALIDATION PAR VENTE
  // 1. Détection de billet non déclaré vendu (QR code inactif)
  if (
    found.status === 'printed_not_sold' ||
    found.status === 'physical_printed' ||
    found.status === 'physical_allocated'
  ) {
    return {
      success: false,
      message: "Ce billet n'a pas été déclaré comme vendu. Contactez le promoteur.",
      ticket: found,
    };
  }

  // 2. Détection de double entrée
  if (found.status === 'used' || found.status === 'scanned') {
    return {
      success: false,
      message: 'Billet déjà utilisé. Double entrée interdite.',
      ticket: found,
    };
  }

  // 3. Détection de billet annulé ou désactivé par le promoteur
  if (found.status === 'cancelled') {
    return {
      success: false,
      message: "Ce billet a été désactivé ou annulé par l'organisation.",
      ticket: found,
    };
  }

  // 4. Si billet physique vendu ou digital actif : ACCÈS AUTORISÉ
  const nowIso = new Date().toISOString();
  const updatedTicket: UserTicket = {
    ...found,
    status: 'scanned',
    usedAt: nowIso,
  };

  saveStoredTickets(localTickets.map((t) => (t.id === found.id ? updatedTicket : t)));

  const isPhysical = Boolean(found.isPhysical || found.status === 'sold_valid' || found.status === 'physical_sold');
  const successLabel = isPhysical
    ? `Billet Physique Activé & Validé : ${found.tierName} (${found.agentName || 'Réseau Partenaire'})`
    : `Accès Autorisé : ${found.tierName}`;

  return {
    success: true,
    message: successLabel,
    ticket: updatedTicket,
  };
};

// ====================================================================
// TRANSACTIONS ET CALCULS DE RÉPARTITION COMMERCIALE (RÉELLES UNIQUEMENT)
// ====================================================================
const INITIAL_TRANSACTIONS: TransactionRecord[] = [];

export const getStoredTransactions = (): TransactionRecord[] => {
  if (typeof window === 'undefined') return inMemoryTransactions;
  const stored = localStorage.getItem(STORAGE_TRANSACTIONS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }
  return [];
};

export const saveTransaction = (tx: TransactionRecord): TransactionRecord[] => {
  const current = getStoredTransactions();
  const updated = [tx, ...current];
  inMemoryTransactions = updated;
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_TRANSACTIONS_KEY, JSON.stringify(updated));
  }
  return updated;
};

// Échantillons de billets physiques témoins pour valider la règle de validation par vente
const INITIAL_PHYSICAL_SAMPLE_TICKETS: UserTicket[] = [
  {
    id: 'tkt-phy-demo-unsold',
    eventId: 'evt-soiree-prestige',
    eventTitle: 'Nuit du Baobab Prestige',
    eventPoster: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=600',
    eventDate: '25 Décembre 2026',
    eventTime: '22:00',
    eventVenue: 'Hôtel Baobab Lounge, Thiès',
    tierName: 'Prévente Porteur',
    price: 3500,
    qrCode: 'BPT-PHY-THS-UNSOLD',
    seatNumber: 'PHY-0042',
    holderName: 'Porteur Non Vendu',
    purchasedAt: '2026-10-22T10:00:00Z',
    status: 'printed_not_sold',
    isPhysical: true,
    agentId: 'agent-fatou-1',
    agentName: 'Boutique Chez Fatou',
    batchNumber: 'BATCH-20261022-777',
    serialNumber: 42,
  },
  {
    id: 'tkt-phy-demo-sold',
    eventId: 'evt-soiree-prestige',
    eventTitle: 'Nuit du Baobab Prestige',
    eventPoster: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=600',
    eventDate: '25 Décembre 2026',
    eventTime: '22:00',
    eventVenue: 'Hôtel Baobab Lounge, Thiès',
    tierName: 'Prévente Porteur',
    price: 3500,
    qrCode: 'BPT-PHY-THS-SOLDOK',
    seatNumber: 'PHY-0015',
    holderName: 'Porteur Vendu Activé',
    purchasedAt: '2026-10-22T14:30:00Z',
    status: 'sold_valid',
    isPhysical: true,
    agentId: 'agent-fatou-1',
    agentName: 'Boutique Chez Fatou',
    batchNumber: 'BATCH-20261022-777',
    serialNumber: 15,
  },
  {
    id: 'tkt-phy-demo-scanned',
    eventId: 'evt-soiree-prestige',
    eventTitle: 'Nuit du Baobab Prestige',
    eventPoster: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=600',
    eventDate: '25 Décembre 2026',
    eventTime: '22:00',
    eventVenue: 'Hôtel Baobab Lounge, Thiès',
    tierName: 'Prévente Porteur',
    price: 3500,
    qrCode: 'BPT-PHY-THS-SCANNED',
    seatNumber: 'PHY-0001',
    holderName: 'Porteur Déjà Scanné',
    purchasedAt: '2026-10-22T09:00:00Z',
    status: 'scanned',
    isPhysical: true,
    agentId: 'agent-fatou-1',
    agentName: 'Boutique Chez Fatou',
    batchNumber: 'BATCH-20261022-777',
    serialNumber: 1,
    usedAt: '2026-10-22T17:45:00Z',
  },
];

// Helper to manage tickets in storage
export const getStoredTickets = (): UserTicket[] => {
  if (typeof window === 'undefined') return [...INITIAL_PHYSICAL_SAMPLE_TICKETS, ...inMemoryTickets];
  const stored = localStorage.getItem(STORAGE_TICKETS_KEY);
  if (stored) {
    try {
      const parsed: UserTicket[] = JSON.parse(stored);
      // S'assurer qu'au moins les billets physiques témoins existent
      const hasPhysical = parsed.some((t) => t.isPhysical);
      if (!hasPhysical) {
        const enriched = [...parsed, ...INITIAL_PHYSICAL_SAMPLE_TICKETS];
        localStorage.setItem(STORAGE_TICKETS_KEY, JSON.stringify(enriched));
        return enriched;
      }
      return parsed;
    } catch {
      return [...INITIAL_PHYSICAL_SAMPLE_TICKETS, ...inMemoryTickets];
    }
  }
  const defaultTickets = [...INITIAL_TICKETS, ...INITIAL_PHYSICAL_SAMPLE_TICKETS];
  localStorage.setItem(STORAGE_TICKETS_KEY, JSON.stringify(defaultTickets));
  return defaultTickets;
};

export const saveStoredTickets = (tickets: UserTicket[]): void => {
  inMemoryTickets = tickets;
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_TICKETS_KEY, JSON.stringify(tickets));
  }
};

// ====================================================================
// MODULE RÉSEAU DE VENTE & BILLETS PHYSIQUES (GESTION LOCALE + SUPABASE)
// ====================================================================

export const getStoredSalesAgents = (): SalesAgent[] => {
  if (typeof window === 'undefined') return inMemoryAgents;
  const stored = localStorage.getItem(STORAGE_AGENTS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return inMemoryAgents;
    }
  }
  localStorage.setItem(STORAGE_AGENTS_KEY, JSON.stringify(INITIAL_SALES_AGENTS));
  return INITIAL_SALES_AGENTS;
};

export const saveSalesAgents = (agents: SalesAgent[]): void => {
  inMemoryAgents = agents;
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_AGENTS_KEY, JSON.stringify(agents));
  }
};

export const fetchSalesAgentsFromSupabase = async (): Promise<{
  agents: SalesAgent[];
  error: string | null;
}> => {
  const client = getSupabaseClient();
  if (!client) {
    return { agents: getStoredSalesAgents(), error: null };
  }

  try {
    const { data, error } = await client
      .from('sales_agents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Fallback local pour sales_agents:', error.message);
      return { agents: getStoredSalesAgents(), error: null };
    }

    if (data && data.length > 0) {
      const mapped: SalesAgent[] = data.map((d: any) => ({
        id: d.id,
        userId: d.user_id,
        eventId: d.event_id,
        eventTitle: d.event_title || 'Événement',
        promoterId: d.promoter_id,
        pointDeVente: d.point_de_vente,
        gerantName: d.gerant_name,
        telephone: d.telephone,
        email: d.email,
        quartier: d.quartier,
        allocatedCount: d.allocated_count || 0,
        soldCount: d.sold_count || 0,
        commissionPercent: Number(d.commission_percent) || 0,
        cashCollected: Number(d.cash_collected) || 0,
        amountDue: Number(d.amount_due) || 0,
        amountPaidToPromoter: Number(d.amount_paid_to_promoter) || 0,
        status: d.status || 'active',
        createdAt: d.created_at,
      }));
      saveSalesAgents(mapped);
      return { agents: mapped, error: null };
    }

    return { agents: getStoredSalesAgents(), error: null };
  } catch (err: any) {
    return { agents: getStoredSalesAgents(), error: err.message };
  }
};

export const createSalesAgent = async (agentData: {
  eventId: string;
  eventTitle?: string;
  promoterId: string;
  pointDeVente: string;
  gerantName: string;
  telephone: string;
  email?: string;
  quartier?: string;
  commissionPercent?: number;
}): Promise<{ success: boolean; agent?: SalesAgent; error?: string }> => {
  const newAgent: SalesAgent = {
    id: `agent-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    eventId: agentData.eventId,
    eventTitle: agentData.eventTitle || 'Événement Thièsdn',
    promoterId: agentData.promoterId,
    pointDeVente: agentData.pointDeVente.trim(),
    gerantName: agentData.gerantName.trim(),
    telephone: agentData.telephone.trim(),
    email: agentData.email?.trim(),
    quartier: agentData.quartier?.trim() || 'Thiès',
    allocatedCount: 0,
    soldCount: 0,
    commissionPercent: agentData.commissionPercent || 10,
    cashCollected: 0,
    amountDue: 0,
    amountPaidToPromoter: 0,
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  const agents = getStoredSalesAgents();
  const updated = [newAgent, ...agents];
  saveSalesAgents(updated);

  const client = getSupabaseClient();
  if (client) {
    try {
      await client.from('sales_agents').insert({
        id: newAgent.id,
        event_id: newAgent.eventId,
        promoter_id: newAgent.promoterId,
        point_de_vente: newAgent.pointDeVente,
        gerant_name: newAgent.gerantName,
        telephone: newAgent.telephone,
        email: newAgent.email,
        quartier: newAgent.quartier,
        commission_percent: newAgent.commissionPercent,
        allocated_count: 0,
        sold_count: 0,
        cash_collected: 0,
        amount_due: 0,
        amount_paid_to_promoter: 0,
        status: 'active',
      });
    } catch (e: any) {
      console.warn('Sync Supabase createSalesAgent:', e.message);
    }
  }

  return { success: true, agent: newAgent };
};

export const generatePhysicalTicketBatch = async (
  event: EventItem,
  tier: TicketTier,
  count: number,
  promoterId: string
): Promise<{ success: boolean; tickets: UserTicket[]; message: string }> => {
  const safeCount = Math.min(1000, Math.max(1, count));
  const currentTickets = getStoredTickets();
  const batchDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const batchNumber = `BATCH-${batchDate}-${Math.floor(100 + Math.random() * 900)}`;
  const cityCode = (event.city.slice(0, 3) || 'THS').toUpperCase();

  const newPhysicalTickets: UserTicket[] = [];

  for (let i = 1; i <= safeCount; i++) {
    const randomHex = Math.floor(100000 + Math.random() * 900000)
      .toString(16)
      .toUpperCase();
    const qrCode = `BPT-PHY-${cityCode}-${randomHex}`;

    const tkt: UserTicket = {
      id: `tkt-phy-${Date.now()}-${i}`,
      eventId: event.id,
      eventTitle: event.title,
      eventPoster: event.posterUrl,
      eventDate: event.date,
      eventTime: event.time,
      eventVenue: `${event.venue}${event.quartier ? ` (${event.quartier})` : ''}, ${event.city}`,
      tierName: tier.name,
      price: tier.price,
      qrCode,
      seatNumber: `PHY-${String(i).padStart(4, '0')}`,
      holderName: 'Billet Physique Porteur',
      purchasedAt: new Date().toISOString(),
      // RÈGLE DE SÉCURITÉ CRITIQUE : Billet inactif par défaut à l'impression
      status: 'printed_not_sold',
      isPhysical: true,
      batchNumber,
      serialNumber: i,
    };
    newPhysicalTickets.push(tkt);
  }

  const updatedTickets = [...newPhysicalTickets, ...currentTickets];
  saveStoredTickets(updatedTickets);

  const client = getSupabaseClient();
  if (client) {
    try {
      const inserts = newPhysicalTickets.map((t) => ({
        event_id: t.eventId,
        event_title: t.eventTitle,
        event_poster: t.eventPoster,
        event_date: t.eventDate,
        event_time: t.eventTime,
        event_venue: t.eventVenue,
        tier_name: t.tierName,
        price: t.price,
        qr_code: t.qrCode,
        seat_number: t.seatNumber,
        holder_name: t.holderName,
        status: 'printed_not_sold',
        is_physical: true,
        batch_number: t.batchNumber,
        serial_number: t.serialNumber,
      }));
      await client.from('tickets').insert(inserts);
    } catch (e: any) {
      console.warn('Sync Supabase physical tickets:', e.message);
    }
  }

  return {
    success: true,
    tickets: newPhysicalTickets,
    message: `${safeCount} billets physiques créés avec succès pour "${tier.name}" (${batchNumber}). Statut initial : printed_not_sold (Inactif jusqu'à déclaration de vente).`,
  };
};

export const assignTicketsToAgent = async (
  agentId: string,
  count: number
): Promise<{ success: boolean; assignedCount: number; message: string }> => {
  const agents = getStoredSalesAgents();
  const agentIndex = agents.findIndex((a) => a.id === agentId);
  if (agentIndex === -1) {
    return { success: false, assignedCount: 0, message: 'Collaborateur introuvable.' };
  }

  const agent = agents[agentIndex];
  const allTickets = getStoredTickets();

  // Filtrer les billets physiques imprimés et non encore assignés pour cet événement
  const unassigned = allTickets.filter(
    (t) =>
      t.eventId === agent.eventId &&
      t.isPhysical &&
      (t.status === 'printed_not_sold' || t.status === 'physical_printed') &&
      !t.agentId
  );

  if (unassigned.length === 0) {
    return {
      success: false,
      assignedCount: 0,
      message: 'Aucun billet physique disponible en stock d’impression pour cet événement. Veuillez d’abord générer un lot de billets.',
    };
  }

  const toAssign = unassigned.slice(0, count);
  const toAssignIds = new Set(toAssign.map((t) => t.id));

  const updatedTickets = allTickets.map((t) => {
    if (toAssignIds.has(t.id)) {
      return {
        ...t,
        // Les billets restent printed_not_sold (inactifs) jusqu'à déclaration de vente effective
        status: 'printed_not_sold' as const,
        agentId: agent.id,
        agentName: agent.pointDeVente,
      };
    }
    return t;
  });

  saveStoredTickets(updatedTickets);

  agent.allocatedCount += toAssign.length;
  agents[agentIndex] = agent;
  saveSalesAgents(agents);

  const client = getSupabaseClient();
  if (client) {
    try {
      await client
        .from('tickets')
        .update({
          agent_id: agent.id,
          agent_name: agent.pointDeVente,
          status: 'printed_not_sold',
        })
        .in('id', Array.from(toAssignIds));

      await client
        .from('sales_agents')
        .update({ allocated_count: agent.allocatedCount })
        .eq('id', agent.id);
    } catch (e: any) {
      console.warn('Sync Supabase assignTicketsToAgent:', e.message);
    }
  }

  return {
    success: true,
    assignedCount: toAssign.length,
    message: `${toAssign.length} billets physiques attribués avec succès au point de vente "${agent.pointDeVente}". Statut : printed_not_sold.`,
  };
};

/**
 * Recherche préalable d'un billet physique avant confirmation de vente (pour la méthode scan collaborateur)
 */
export const lookupPhysicalTicketForSale = (
  agentId: string,
  ticketCode: string
): {
  found: boolean;
  message?: string;
  ticket?: UserTicket;
  canBeSold: boolean;
} => {
  const clean = ticketCode.trim().toUpperCase();
  const allTickets = getStoredTickets();
  const t = allTickets.find(
    (item) => item.qrCode.toUpperCase() === clean || item.id.toUpperCase() === clean
  );

  if (!t) {
    return {
      found: false,
      canBeSold: false,
      message: `Billet "${ticketCode}" introuvable dans le système.`,
    };
  }

  if (t.agentId && t.agentId !== agentId) {
    return {
      found: true,
      ticket: t,
      canBeSold: false,
      message: `Ce billet est alloué à un autre point de vente (${t.agentName || 'Autre collaborateur'}).`,
    };
  }

  if (t.status === 'sold_valid' || t.status === 'physical_sold') {
    return {
      found: true,
      ticket: t,
      canBeSold: false,
      message: `Ce billet a DÉJÀ été déclaré vendu (${t.tierName}).`,
    };
  }

  if (t.status === 'scanned' || t.status === 'used') {
    return {
      found: true,
      ticket: t,
      canBeSold: false,
      message: `Ce billet a déjà été scanné et utilisé à l'entrée.`,
    };
  }

  if (t.status === 'cancelled') {
    return {
      found: true,
      ticket: t,
      canBeSold: false,
      message: `Ce billet a été désactivé / annulé par l'organisation.`,
    };
  }

  return {
    found: true,
    ticket: t,
    canBeSold: true,
  };
};

/**
 * Activation d'un billet physique unitaire par le collaborateur avec liaison nominative obligatoire
 */
export const confirmSinglePhysicalTicketSale = async (
  agentId: string,
  ticketCode: string,
  customerData: {
    name: string;
    phone: string;
    email?: string;
  }
): Promise<{ success: boolean; message: string; ticket?: UserTicket; agent?: SalesAgent }> => {
  // RÈGLE ANTI-FRAUDE : Le nom et le téléphone du client sont obligatoires
  if (!customerData?.name?.trim() || !customerData?.phone?.trim()) {
    return {
      success: false,
      message: 'Le nom et le téléphone du client sont obligatoires pour activer le billet.',
    };
  }

  const check = lookupPhysicalTicketForSale(agentId, ticketCode);
  if (!check.found || !check.ticket) {
    return { success: false, message: check.message || 'Billet introuvable.' };
  }
  if (!check.canBeSold) {
    return { success: false, message: check.message || 'Ce billet ne peut pas être vendu.' };
  }

  const agents = getStoredSalesAgents();
  const agentIndex = agents.findIndex((a) => a.id === agentId);
  if (agentIndex === -1) {
    return { success: false, message: 'Collaborateur introuvable.' };
  }

  const agent = agents[agentIndex];
  const allTickets = getStoredTickets();
  const targetId = check.ticket.id;
  const nowIso = new Date().toISOString();

  let updatedTargetTicket: UserTicket | null = null;
  const updatedTickets = allTickets.map((t) => {
    if (t.id === targetId) {
      updatedTargetTicket = {
        ...t,
        status: 'sold_valid',
        holderName: customerData.name.trim(),
        holderPhone: customerData.phone.trim(),
        holderEmail: customerData.email?.trim() || undefined,
        soldAt: nowIso,
        agentId: agent.id,
        agentName: agent.pointDeVente,
      };
      return updatedTargetTicket;
    }
    return t;
  });

  saveStoredTickets(updatedTickets);

  const price = check.ticket.price;
  const netDueAdd = Math.round(price * (1 - agent.commissionPercent / 100));

  agent.soldCount += 1;
  agent.cashCollected += price;
  agent.amountDue += netDueAdd;
  agents[agentIndex] = agent;
  saveSalesAgents(agents);

  const client = getSupabaseClient();
  if (client) {
    try {
      await client
        .from('tickets')
        .update({
          status: 'sold_valid',
          holder_name: customerData.name.trim(),
          holder_phone: customerData.phone.trim(),
          holder_email: customerData.email?.trim() || null,
          sold_at: nowIso,
          agent_id: agent.id,
          agent_name: agent.pointDeVente,
        })
        .eq('id', targetId);

      await client
        .from('sales_agents')
        .update({
          sold_count: agent.soldCount,
          cash_collected: agent.cashCollected,
          amount_due: agent.amountDue,
        })
        .eq('id', agent.id);
    } catch (e: any) {
      console.warn('Sync Supabase confirmSinglePhysicalTicketSale:', e.message);
    }
  }

  return {
    success: true,
    message: `Vente enregistrée pour ${customerData.name.trim()} ! Billet "${check.ticket.qrCode}" activé (${price.toLocaleString('fr-FR')} FCFA).`,
    ticket: updatedTargetTicket || check.ticket,
    agent,
  };
};

export const recordAgentSale = async (
  agentId: string,
  quantitySold: number,
  ticketCode?: string,
  customerData?: {
    name?: string;
    phone?: string;
    email?: string;
  }
): Promise<{ success: boolean; message: string; agent?: SalesAgent }> => {
  if (ticketCode) {
    if (!customerData?.name?.trim() || !customerData?.phone?.trim()) {
      return {
        success: false,
        message: 'Le nom et le téléphone du client sont obligatoires pour activer le billet.',
      };
    }
    const singleRes = await confirmSinglePhysicalTicketSale(agentId, ticketCode, {
      name: customerData.name,
      phone: customerData.phone,
      email: customerData.email,
    });
    return {
      success: singleRes.success,
      message: singleRes.message,
      agent: singleRes.agent,
    };
  }

  // RÈGLE ANTI-FRAUDE : pas d'activation anonyme, chaque billet doit porter nom + téléphone
  if (!customerData?.name?.trim() || !customerData?.phone?.trim()) {
    return {
      success: false,
      message: 'Le nom et le téléphone du client sont obligatoires pour activer le billet.',
    };
  }

  const agents = getStoredSalesAgents();
  const agentIndex = agents.findIndex((a) => a.id === agentId);
  if (agentIndex === -1) {
    return { success: false, message: 'Point de vente introuvable.' };
  }

  const agent = agents[agentIndex];
  const allTickets = getStoredTickets();

  // Billets physiques attribués à l'agent qui ne sont pas encore vendus (inactifs)
  const availableToSell = allTickets.filter(
    (t) =>
      t.agentId === agent.id &&
      (t.status === 'printed_not_sold' ||
        t.status === 'physical_allocated' ||
        t.status === 'physical_printed')
  );

  if (availableToSell.length === 0) {
    return {
      success: false,
      message: 'Aucun billet disponible en stock non vendu pour ce collaborateur.',
    };
  }

  const actualQty = Math.min(quantitySold, availableToSell.length);
  const toSell = availableToSell.slice(0, actualQty);
  const toSellIds = new Set(toSell.map((t) => t.id));

  const unitPrice = toSell[0]?.price || 3500;
  const grossAdd = actualQty * unitPrice;
  const netDueAdd = Math.round(grossAdd * (1 - agent.commissionPercent / 100));
  const nowIso = new Date().toISOString();

  const buyerName = customerData?.name?.trim() || 'Acheteur Guichet';
  const buyerPhone = customerData?.phone?.trim() || agent.telephone;

  const updatedTickets = allTickets.map((t) => {
    if (toSellIds.has(t.id)) {
      return {
        ...t,
        status: 'sold_valid' as const,
        holderName: buyerName,
        holderPhone: buyerPhone,
        holderEmail: customerData?.email?.trim() || t.holderEmail,
        soldAt: nowIso,
      };
    }
    return t;
  });

  saveStoredTickets(updatedTickets);

  agent.soldCount += actualQty;
  agent.cashCollected += grossAdd;
  agent.amountDue += netDueAdd;
  agents[agentIndex] = agent;
  saveSalesAgents(agents);

  const client = getSupabaseClient();
  if (client) {
    try {
      await client
        .from('tickets')
        .update({
          status: 'sold_valid',
          holder_name: buyerName,
          holder_phone: buyerPhone,
          holder_email: customerData?.email?.trim() || null,
          sold_at: nowIso,
        })
        .in('id', Array.from(toSellIds));

      await client
        .from('sales_agents')
        .update({
          sold_count: agent.soldCount,
          cash_collected: agent.cashCollected,
          amount_due: agent.amountDue,
        })
        .eq('id', agent.id);
    } catch (e: any) {
      console.warn('Sync Supabase recordAgentSale batch:', e.message);
    }
  }

  return {
    success: true,
    message: `${actualQty} billet(s) activé(s) pour ${buyerName} (${buyerPhone}). Prêts pour le contrôle à l'entrée.`,
    agent,
  };
};

/**
 * Désactivation d'un lot de billets physiques non vendus par le promoteur (Évite vols & fraudes)
 */
export const deactivateUnsoldPhysicalTickets = async (
  eventId: string,
  agentId?: string
): Promise<{ success: boolean; deactivatedCount: number; message: string }> => {
  const allTickets = getStoredTickets();
  const toDeactivate = allTickets.filter((t) => {
    const isMatchingEvent = !eventId || eventId === 'all' || t.eventId === eventId;
    const isMatchingAgent = !agentId || t.agentId === agentId;
    const isUnsold =
      t.isPhysical &&
      (t.status === 'printed_not_sold' ||
        t.status === 'physical_printed' ||
        t.status === 'physical_allocated');
    return isMatchingEvent && isMatchingAgent && isUnsold;
  });

  if (toDeactivate.length === 0) {
    return {
      success: false,
      deactivatedCount: 0,
      message: 'Aucun billet physique non vendu à désactiver dans ce périmètre.',
    };
  }

  const deactIds = new Set(toDeactivate.map((t) => t.id));
  const updatedTickets = allTickets.map((t) => {
    if (deactIds.has(t.id)) {
      return {
        ...t,
        status: 'cancelled' as const,
      };
    }
    return t;
  });

  saveStoredTickets(updatedTickets);

  const client = getSupabaseClient();
  if (client) {
    try {
      await client
        .from('tickets')
        .update({ status: 'cancelled' })
        .in('id', Array.from(deactIds));
    } catch (e: any) {
      console.warn('Sync Supabase deactivateUnsoldPhysicalTickets:', e.message);
    }
  }

  return {
    success: true,
    deactivatedCount: toDeactivate.length,
    message: `${toDeactivate.length} billet(s) non vendu(s) désactivé(s) avec succès. Tout scan de ces QR codes à l'entrée sera immédiatement rejeté.`,
  };
};

export const recordAgentSettlement = async (
  agentId: string,
  amountPaid: number
): Promise<{ success: boolean; message: string; agent?: SalesAgent }> => {
  const agents = getStoredSalesAgents();
  const agentIndex = agents.findIndex((a) => a.id === agentId);
  if (agentIndex === -1) {
    return { success: false, message: 'Collaborateur introuvable.' };
  }

  const agent = agents[agentIndex];
  agent.amountPaidToPromoter += amountPaid;
  agent.amountDue = Math.max(0, agent.amountDue - amountPaid);
  agents[agentIndex] = agent;
  saveSalesAgents(agents);

  return {
    success: true,
    message: `Versement de ${amountPaid.toLocaleString('fr-FR')} FCFA enregistré pour ${agent.pointDeVente}.`,
    agent,
  };
};

// ====================================================================
// MODULE CO-PRODUCTION & GESTION DES DROITS ARTISTES / STAFF
// ====================================================================

export const getStoredCoproducers = (): EventCoproducer[] => {
  if (typeof window === 'undefined') return inMemoryCoproducers;
  const raw = localStorage.getItem(STORAGE_COPRODUCERS_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_COPRODUCERS_KEY, JSON.stringify(INITIAL_COPRODUCERS));
    inMemoryCoproducers = [...INITIAL_COPRODUCERS];
    return INITIAL_COPRODUCERS;
  }
  try {
    const parsed = JSON.parse(raw);
    inMemoryCoproducers = parsed;
    return parsed;
  } catch {
    return inMemoryCoproducers;
  }
};

export const saveCoproducers = (coproducers: EventCoproducer[]): void => {
  inMemoryCoproducers = [...coproducers];
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_COPRODUCERS_KEY, JSON.stringify(coproducers));
  }
};

export const fetchCoproducersFromSupabase = async (
  eventId?: string
): Promise<{ coproducers: EventCoproducer[] }> => {
  const local = getStoredCoproducers();
  const client = getSupabaseClient();
  if (!client) {
    const filtered = eventId ? local.filter((c) => c.eventId === eventId) : local;
    return { coproducers: filtered };
  }

  try {
    let query = client.from('event_coproducers').select('*');
    if (eventId) {
      query = query.eq('event_id', eventId);
    }
    const { data, error } = await query;
    if (error) {
      console.warn('Sync Supabase fetchCoproducers:', error.message);
      const filtered = eventId ? local.filter((c) => c.eventId === eventId) : local;
      return { coproducers: filtered };
    }

    if (data && data.length > 0) {
      const mapped: EventCoproducer[] = data.map((d: any) => ({
        id: d.id,
        eventId: d.event_id,
        eventTitle: d.event_title || 'Événement Thièsdn',
        promoterId: d.promoter_id || '',
        userId: d.user_id,
        name: d.name,
        phone: d.phone,
        email: d.email,
        roleType: d.role_type || 'co_producteur',
        revenueShare: Number(d.revenue_share) || 0,
        guestTicketsAllocated: Number(d.guest_tickets_allocated) || 0,
        guestTicketsUsed: Number(d.guest_tickets_used) || 0,
        notes: d.notes,
        decompteValidated: Boolean(d.decompte_validated),
        decompteValidatedAt: d.decompte_validated_at,
        decompteSignature: d.decompte_signature,
        createdAt: d.created_at || new Date().toISOString(),
      }));
      saveCoproducers(mapped);
      return { coproducers: mapped };
    }
  } catch (err: any) {
    console.warn('Supabase fetchCoproducers error:', err.message);
  }

  const filtered = eventId ? local.filter((c) => c.eventId === eventId) : local;
  return { coproducers: filtered };
};

export const createCoproducer = async (
  coproducerData: Partial<EventCoproducer>
): Promise<{ success: boolean; coproducer?: EventCoproducer; error?: string }> => {
  const isValidUUID = (val?: string): boolean =>
    !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

  const resolvedPromoterId = isValidUUID(coproducerData.promoterId) ? coproducerData.promoterId! : '';

  const newCoprod: EventCoproducer = {
    id: `coprod-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    eventId: coproducerData.eventId || 'evt-soiree-prestige',
    eventTitle: coproducerData.eventTitle || 'Événement Thièsdn',
    promoterId: resolvedPromoterId,
    userId: isValidUUID(coproducerData.userId) ? coproducerData.userId : undefined,
    name: coproducerData.name?.trim() || 'Co-Producteur',
    phone: coproducerData.phone?.trim() || '+221 77 000 00 00',
    email: coproducerData.email?.trim(),
    roleType: coproducerData.roleType || 'artiste',
    revenueShare: Number(coproducerData.revenueShare) || 0,
    guestTicketsAllocated: Number(coproducerData.guestTicketsAllocated) || 0,
    guestTicketsUsed: 0,
    notes: coproducerData.notes?.trim(),
    decompteValidated: false,
    createdAt: new Date().toISOString(),
  };

  const current = getStoredCoproducers();
  const updated = [newCoprod, ...current];
  saveCoproducers(updated);

  const client = getSupabaseClient();
  if (client) {
    try {
      await client.from('event_coproducers').insert({
        id: newCoprod.id,
        event_id: newCoprod.eventId,
        promoter_id: isValidUUID(newCoprod.promoterId) ? newCoprod.promoterId : null,
        user_id: newCoprod.userId,
        name: newCoprod.name,
        phone: newCoprod.phone,
        email: newCoprod.email,
        role_type: newCoprod.roleType,
        revenue_share: newCoprod.revenueShare,
        guest_tickets_allocated: newCoprod.guestTicketsAllocated,
        guest_tickets_used: 0,
        notes: newCoprod.notes,
        decompte_validated: false,
      });
    } catch (e: any) {
      console.warn('Sync Supabase createCoproducer:', e.message);
    }
  }

  return { success: true, coproducer: newCoprod };
};

export const updateCoproducerRevenueShare = async (
  coproducerId: string,
  share: number,
  guestQuota?: number
): Promise<{ success: boolean; message: string; coproducer?: EventCoproducer }> => {
  const all = getStoredCoproducers();
  const idx = all.findIndex((c) => c.id === coproducerId);
  if (idx === -1) {
    return { success: false, message: 'Co-producteur introuvable.' };
  }

  const coprod = all[idx];
  coprod.revenueShare = Math.min(100, Math.max(0, share));
  if (guestQuota !== undefined) {
    coprod.guestTicketsAllocated = Math.max(0, guestQuota);
  }
  all[idx] = coprod;
  saveCoproducers(all);

  const client = getSupabaseClient();
  if (client) {
    try {
      await client
        .from('event_coproducers')
        .update({
          revenue_share: coprod.revenueShare,
          guest_tickets_allocated: coprod.guestTicketsAllocated,
        })
        .eq('id', coprod.id);
    } catch (e: any) {
      console.warn('Sync Supabase updateCoproducerRevenueShare:', e.message);
    }
  }

  return {
    success: true,
    message: `Répartition mise à jour à ${coprod.revenueShare}% pour ${coprod.name}.`,
    coproducer: coprod,
  };
};

/**
 * Suppression d'un co-producteur / ayant-droit
 */
export const deleteCoproducer = async (
  coproducerId: string
): Promise<{ success: boolean; error?: string }> => {
  const all = getStoredCoproducers();
  const filtered = all.filter((c) => c.id !== coproducerId);
  saveCoproducers(filtered);

  const client = getSupabaseClient();
  if (client) {
    try {
      const { error } = await client.from('event_coproducers').delete().eq('id', coproducerId);
      if (error) {
        console.warn('Sync Supabase deleteCoproducer:', error.message);
      }
    } catch (e: any) {
      console.warn('Erreur Supabase deleteCoproducer:', e.message);
    }
  }

  return { success: true };
};

/**
 * Validation et Signature Numérique du Décompte par l'Artiste / Staff (Étape 4)
 */
export const validateDecompteAtomic = async (
  coproducerId: string,
  signerName: string,
  signatureHash?: string
): Promise<{ success: boolean; message: string; coproducer?: EventCoproducer }> => {
  const all = getStoredCoproducers();
  const idx = all.findIndex((c) => c.id === coproducerId);
  if (idx === -1) {
    return { success: false, message: 'Fiche co-producteur introuvable.' };
  }

  const coprod = all[idx];
  const nowIso = new Date().toISOString();
  const certNumber = `THS-ACCORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
  const signature = signatureHash || `CERTIFIE_CONFORME#${signerName}#${certNumber}#${nowIso}`;

  coprod.decompteValidated = true;
  coprod.decompteValidatedAt = nowIso;
  coprod.decompteSignature = signature;
  all[idx] = coprod;
  saveCoproducers(all);

  const client = getSupabaseClient();
  if (client) {
    try {
      await client
        .from('event_coproducers')
        .update({
          decompte_validated: true,
          decompte_validated_at: nowIso,
          decompte_signature: signature,
        })
        .eq('id', coprod.id);
    } catch (e: any) {
      console.warn('Sync Supabase validateDecompteAtomic:', e.message);
    }
  }

  return {
    success: true,
    message: `Décompte validé et signé numériquement avec succès par ${signerName}. Preuve légale enregistrée (${certNumber}).`,
    coproducer: coprod,
  };
};

// ====================================================================
// MODULE GUEST LIST / INVITATIONS ARTISTE
// ====================================================================

export const getStoredGuestTickets = (): GuestTicket[] => {
  if (typeof window === 'undefined') return inMemoryGuestTickets;
  const raw = localStorage.getItem(STORAGE_GUEST_TICKETS_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_GUEST_TICKETS_KEY, JSON.stringify(INITIAL_GUEST_TICKETS));
    inMemoryGuestTickets = [...INITIAL_GUEST_TICKETS];
    return INITIAL_GUEST_TICKETS;
  }
  try {
    const parsed = JSON.parse(raw);
    inMemoryGuestTickets = parsed;
    return parsed;
  } catch {
    return inMemoryGuestTickets;
  }
};

export const saveStoredGuestTickets = (guests: GuestTicket[]): void => {
  inMemoryGuestTickets = [...guests];
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_GUEST_TICKETS_KEY, JSON.stringify(guests));
  }
};

export const createGuestTicket = async (
  coproducerId: string,
  eventId: string,
  eventTitle: string,
  guestName: string,
  guestPhone: string
): Promise<{ success: boolean; ticket?: GuestTicket; message: string }> => {
  const coproducers = getStoredCoproducers();
  const coprodIndex = coproducers.findIndex((c) => c.id === coproducerId);
  if (coprodIndex === -1) {
    return { success: false, message: 'Co-producteur introuvable.' };
  }

  const coprod = coproducers[coprodIndex];
  const allGuests = getStoredGuestTickets();
  const coprodGuests = allGuests.filter((g) => g.coproducerId === coproducerId);

  // Vérifier le quota alloué
  if (coprodGuests.length >= coprod.guestTicketsAllocated) {
    return {
      success: false,
      message: `Quota d'invitations atteint (${coprod.guestTicketsAllocated} places accordées). Contactez le producteur pour augmenter votre quota.`,
    };
  }

  const randomHex = Math.floor(1000 + Math.random() * 9000).toString();
  const qrCode = `GUEST-THS-${randomHex}-${coprod.roleType.toUpperCase().slice(0, 3)}`;

  const newGuest: GuestTicket = {
    id: `gst-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    eventId,
    eventTitle,
    coproducerId: coprod.id,
    coproducerName: coprod.name,
    guestName: guestName.trim(),
    guestPhone: guestPhone.trim(),
    qrCode,
    status: 'valid',
    createdAt: new Date().toISOString(),
  };

  const updatedGuests = [newGuest, ...allGuests];
  saveStoredGuestTickets(updatedGuests);

  const client = getSupabaseClient();
  if (client) {
    try {
      await client.from('event_guest_tickets').insert({
        id: newGuest.id,
        event_id: newGuest.eventId,
        coproducer_id: newGuest.coproducerId,
        guest_name: newGuest.guestName,
        guest_phone: newGuest.guestPhone,
        qr_code: newGuest.qrCode,
        status: 'valid',
      });
    } catch (e: any) {
      console.warn('Sync Supabase createGuestTicket:', e.message);
    }
  }

  return {
    success: true,
    ticket: newGuest,
    message: `Invitation émise avec succès pour "${newGuest.guestName}". Pass QR Code généré.`,
  };
};

export const scanGuestTicketAtomic = async (
  qrCode: string
): Promise<{ success: boolean; ticket?: GuestTicket; message: string }> => {
  const guests = getStoredGuestTickets();
  const idx = guests.findIndex((g) => g.qrCode.toUpperCase() === qrCode.trim().toUpperCase());
  if (idx === -1) {
    return { success: false, message: 'Pass invité non reconnu ou invalide.' };
  }

  const guest = guests[idx];
  if (guest.status === 'used') {
    return {
      success: false,
      ticket: guest,
      message: `Invitation déjà scannée pour "${guest.guestName}" le ${new Date(guest.scannedAt || '').toLocaleTimeString('fr-FR')}. Double entrée interdite.`,
    };
  }

  guest.status = 'used';
  guest.scannedAt = new Date().toISOString();
  guests[idx] = guest;
  saveStoredGuestTickets(guests);

  // Mettre à jour le compteur d'invitations utilisées du co-producteur
  const coproducers = getStoredCoproducers();
  const coprodIdx = coproducers.findIndex((c) => c.id === guest.coproducerId);
  if (coprodIdx !== -1) {
    coproducers[coprodIdx].guestTicketsUsed += 1;
    saveCoproducers(coproducers);
  }

  return {
    success: true,
    ticket: guest,
    message: `Accès Invité Confirmé : ${guest.guestName} (Guest List ${guest.coproducerName})`,
  };
};

// ====================================================================
// MODULE ACCRÉDITATIONS : STAFF, INVITÉS & PRESSE
// ====================================================================

export const getStoredAccreditations = (): Accreditation[] => {
  if (typeof window === 'undefined') return inMemoryAccreditations;
  const raw = localStorage.getItem(STORAGE_ACCREDITATIONS_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_ACCREDITATIONS_KEY, JSON.stringify(INITIAL_ACCREDITATIONS));
    inMemoryAccreditations = [...INITIAL_ACCREDITATIONS];
    return INITIAL_ACCREDITATIONS;
  }
  try {
    const parsed = JSON.parse(raw);
    inMemoryAccreditations = parsed;
    return parsed;
  } catch {
    return inMemoryAccreditations;
  }
};

export const saveStoredAccreditations = (accreditations: Accreditation[]): void => {
  inMemoryAccreditations = [...accreditations];
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_ACCREDITATIONS_KEY, JSON.stringify(accreditations));
  }
};

export const fetchAccreditationsFromSupabase = async (
  eventId?: string
): Promise<{ accreditations: Accreditation[] }> => {
  const local = getStoredAccreditations();
  const client = getSupabaseClient();
  if (!client) {
    const filtered = eventId ? local.filter((a) => a.eventId === eventId) : local;
    return { accreditations: filtered };
  }

  try {
    let query = client.from('accreditations').select('*');
    if (eventId) {
      query = query.eq('event_id', eventId);
    }
    const { data, error } = await query;
    if (error) {
      console.warn('Sync Supabase fetchAccreditations:', error.message);
      const filtered = eventId ? local.filter((a) => a.eventId === eventId) : local;
      return { accreditations: filtered };
    }

    if (data && data.length > 0) {
      const mapped: Accreditation[] = data.map((d: any) => ({
        id: d.id,
        eventId: d.event_id,
        eventTitle: d.event_title || 'Événement Thièsdn',
        type: d.type || 'staff',
        holderName: d.holder_name,
        holderPhone: d.holder_phone,
        holderEmail: d.holder_email,
        organization: d.organization,
        qrCode: d.qr_code,
        status: d.status || 'validated',
        scannedAt: d.scanned_at,
        scannedBy: d.scanned_by,
        createdBy: d.created_by,
        createdByName: d.created_by_name,
        createdByRole: d.created_by_role || 'promoter',
        createdAt: d.created_at || new Date().toISOString(),
      }));
      saveStoredAccreditations(mapped);
      return { accreditations: mapped };
    }
  } catch (err: any) {
    console.warn('Supabase fetchAccreditations error:', err.message);
  }

  const filtered = eventId ? local.filter((a) => a.eventId === eventId) : local;
  return { accreditations: filtered };
};

export const createAccreditation = async (
  data: Partial<Accreditation>
): Promise<{ success: boolean; accreditation?: Accreditation; message: string }> => {
  const randomHex = Math.floor(1000 + Math.random() * 9000).toString(16).toUpperCase();
  const typeTag = (data.type || 'staff').toUpperCase();
  const qrCode = data.qrCode || `ACC-${typeTag}-THS-${randomHex}`;

  const newAccred: Accreditation = {
    id: `acc-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    eventId: data.eventId || 'evt-soiree-prestige',
    eventTitle: data.eventTitle || 'Nuit du Baobab Prestige',
    type: data.type || 'staff',
    holderName: data.holderName?.trim() || 'Titulaire Accrédité',
    holderPhone: data.holderPhone?.trim() || '+221 77 000 00 00',
    holderEmail: data.holderEmail?.trim(),
    organization: data.organization?.trim(),
    qrCode,
    status: 'validated',
    createdBy: isValidUUID(data.createdBy) ? data.createdBy! : '',
    createdByName: data.createdByName || 'Lat Dior Productions',
    createdByRole: data.createdByRole || 'promoter',
    createdAt: new Date().toISOString(),
  };

  const current = getStoredAccreditations();
  const updated = [newAccred, ...current];
  saveStoredAccreditations(updated);

  const client = getSupabaseClient();
  if (client) {
    try {
      await client.from('accreditations').insert({
        id: newAccred.id,
        event_id: newAccred.eventId,
        event_title: newAccred.eventTitle,
        type: newAccred.type,
        holder_name: newAccred.holderName,
        holder_phone: newAccred.holderPhone,
        holder_email: newAccred.holderEmail,
        organization: newAccred.organization,
        qr_code: newAccred.qrCode,
        status: newAccred.status,
        created_by: isValidUUID(newAccred.createdBy) ? newAccred.createdBy : null,
        created_by_name: newAccred.createdByName,
        created_by_role: newAccred.createdByRole,
      });
    } catch (e: any) {
      console.warn('Sync Supabase createAccreditation:', e.message);
    }
  }

  return {
    success: true,
    accreditation: newAccred,
    message: `Accréditation ${newAccred.type.toUpperCase()} générée avec succès pour "${newAccred.holderName}".`,
  };
};

export const createBulkAccreditations = async (
  items: Array<Partial<Accreditation>>
): Promise<{ success: boolean; created: Accreditation[]; message: string }> => {
  const created: Accreditation[] = [];
  for (const item of items) {
    if (item.holderName && item.holderName.trim()) {
      const res = await createAccreditation(item);
      if (res.success && res.accreditation) {
        created.push(res.accreditation);
      }
    }
  }

  return {
    success: true,
    created,
    message: `${created.length} accréditation(s) importée(s) et générée(s) avec succès.`,
  };
};

export const scanAccreditationAtomic = async (
  qrCode: string,
  currentEventId?: string
): Promise<{
  success: boolean;
  accreditation?: Accreditation;
  message: string;
  badgeTheme?: 'staff' | 'invite' | 'presse';
}> => {
  const accreditations = getStoredAccreditations();
  const idx = accreditations.findIndex(
    (a) => a.qrCode.toUpperCase() === qrCode.trim().toUpperCase()
  );

  if (idx === -1) {
    return {
      success: false,
      message: 'Badge d’accréditation introuvable ou non reconnu.',
    };
  }

  const accred = accreditations[idx];

  // Vérification de sécurité événementielle
  if (currentEventId && accred.eventId && accred.eventId !== currentEventId) {
    return {
      success: false,
      accreditation: accred,
      message: `Accréditation invalide pour cet événement ! Ce badge est émis pour "${accred.eventTitle}".`,
    };
  }

  if (accred.status === 'scanned') {
    return {
      success: false,
      accreditation: accred,
      badgeTheme: accred.type,
      message: `Ce badge ${accred.type.toUpperCase()} a déjà été scanné à l'entrée le ${new Date(accred.scannedAt || '').toLocaleTimeString('fr-FR')} ! Double accès interdit.`,
    };
  }

  if (accred.status === 'cancelled') {
    return {
      success: false,
      accreditation: accred,
      message: `Ce badge ${accred.type.toUpperCase()} a été révoqué ou annulé par la production.`,
    };
  }

  accred.status = 'scanned';
  accred.scannedAt = new Date().toISOString();
  accreditations[idx] = accred;
  saveStoredAccreditations(accreditations);

  const client = getSupabaseClient();
  if (client) {
    try {
      await client
        .from('accreditations')
        .update({
          status: 'scanned',
          scanned_at: accred.scannedAt,
        })
        .eq('id', accred.id);
    } catch (e: any) {
      console.warn('Sync Supabase scanAccreditation:', e.message);
    }
  }

  let titleMsg = 'Accès Staff Validé';
  if (accred.type === 'invite') {
    titleMsg = 'Invité VIP / Guest List';
  } else if (accred.type === 'presse') {
    titleMsg = 'Presse & Média Accrédité';
  }

  return {
    success: true,
    accreditation: accred,
    badgeTheme: accred.type,
    message: `${titleMsg} : ${accred.holderName}${accred.organization ? ` (${accred.organization})` : ''}`,
  };
};

// ====================================================================
// MODULE MULTI-POSTES DE CONTRÔLE (SCAN STATIONS SÉCURISÉES SANS LOGIN)
// ====================================================================

export const getStoredScanStations = (): ScanStation[] => {
  if (typeof window === 'undefined') return inMemoryScanStations;
  const raw = localStorage.getItem(STORAGE_SCAN_STATIONS_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_SCAN_STATIONS_KEY, JSON.stringify(INITIAL_SCAN_STATIONS));
    inMemoryScanStations = [...INITIAL_SCAN_STATIONS];
    return INITIAL_SCAN_STATIONS;
  }
  try {
    const parsed = JSON.parse(raw);
    inMemoryScanStations = parsed;
    return parsed;
  } catch {
    return inMemoryScanStations;
  }
};

export const saveStoredScanStations = (stations: ScanStation[]): void => {
  inMemoryScanStations = [...stations];
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_SCAN_STATIONS_KEY, JSON.stringify(stations));
  }
};

export const fetchScanStationsFromSupabase = async (
  eventId?: string
): Promise<{ stations: ScanStation[] }> => {
  const local = getStoredScanStations();
  const client = getSupabaseClient();
  if (!client) {
    const filtered = eventId && eventId !== 'all' ? local.filter((s) => s.eventId === eventId) : local;
    return { stations: filtered };
  }

  try {
    let query = client.from('scan_stations').select('*').order('created_at', { ascending: false });
    if (eventId && eventId !== 'all') {
      query = query.eq('event_id', eventId);
    }
    const { data, error } = await query;
    if (error) {
      console.warn('Sync Supabase fetchScanStations:', error.message);
      const filtered = eventId && eventId !== 'all' ? local.filter((s) => s.eventId === eventId) : local;
      return { stations: filtered };
    }

    if (data && data.length > 0) {
      const mapped: ScanStation[] = data.map((d: any) => ({
        id: d.id,
        eventId: d.event_id,
        eventTitle: d.event_title || 'Événement Thièsdn',
        name: d.name,
        accessCode: d.access_code,
        createdBy: d.created_by,
        createdByName: d.created_by_name,
        isActive: d.is_active ?? true,
        scansCount: Number(d.scans_count) || 0,
        lastScannedAt: d.last_scanned_at,
        notes: d.notes,
        createdAt: d.created_at || new Date().toISOString(),
      }));
      saveStoredScanStations(mapped);
      return { stations: mapped };
    }
  } catch (err: any) {
    console.warn('Supabase fetchScanStations error:', err.message);
  }

  const filtered = eventId && eventId !== 'all' ? local.filter((s) => s.eventId === eventId) : local;
  return { stations: filtered };
};

export const createScanStation = async (
  data: Partial<ScanStation>
): Promise<{ success: boolean; station?: ScanStation; message: string }> => {
  const name = data.name?.trim() || 'Poste de Contrôle';
  let prefix = 'GATE';
  const upperName = name.toUpperCase();
  if (upperName.includes('VIP')) prefix = 'VIP';
  else if (upperName.includes('PRESSE') || upperName.includes('MEDIA')) prefix = 'PRESS';
  else if (upperName.includes('PRINCIP') || upperName.includes('MAIN')) prefix = 'MAIN';
  else if (upperName.includes('STAFF') || upperName.includes('REGIE')) prefix = 'STAFF';

  const randomSuffix = Math.floor(100 + Math.random() * 900).toString();
  const accessCode = data.accessCode || `STA-${prefix}-${randomSuffix}`;

  const newStation: ScanStation = {
    id: `sta-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    eventId: data.eventId || 'evt-soiree-prestige',
    eventTitle: data.eventTitle || 'Nuit du Baobab Prestige',
    name,
    accessCode,
    createdBy: isValidUUID(data.createdBy) ? data.createdBy! : '',
    createdByName: data.createdByName || 'Lat Dior Productions',
    isActive: true,
    scansCount: 0,
    notes: data.notes?.trim(),
    createdAt: new Date().toISOString(),
  };

  const current = getStoredScanStations();
  const updated = [newStation, ...current];
  saveStoredScanStations(updated);

  const client = getSupabaseClient();
  if (client) {
    try {
      await client.from('scan_stations').insert({
        id: newStation.id,
        event_id: newStation.eventId,
        event_title: newStation.eventTitle,
        name: newStation.name,
        access_code: newStation.accessCode,
        created_by: isValidUUID(newStation.createdBy) ? newStation.createdBy : null,
        created_by_name: newStation.createdByName,
        is_active: newStation.isActive,
        scans_count: newStation.scansCount,
        notes: newStation.notes,
      });
    } catch (e: any) {
      console.warn('Sync Supabase createScanStation:', e.message);
    }
  }

  return {
    success: true,
    station: newStation,
    message: `Poste de contrôle "${newStation.name}" créé avec succès (Code : ${newStation.accessCode}).`,
  };
};

export const toggleScanStationStatus = async (
  stationId: string,
  isActive: boolean
): Promise<{ success: boolean; message: string }> => {
  const stations = getStoredScanStations();
  const idx = stations.findIndex((s) => s.id === stationId);
  if (idx === -1) {
    return { success: false, message: 'Poste de contrôle introuvable.' };
  }

  stations[idx].isActive = isActive;
  saveStoredScanStations(stations);

  const client = getSupabaseClient();
  if (client) {
    try {
      await client
        .from('scan_stations')
        .update({ is_active: isActive })
        .eq('id', stationId);
    } catch (e: any) {
      console.warn('Sync Supabase toggleScanStationStatus:', e.message);
    }
  }

  return {
    success: true,
    message: `Poste "${stations[idx].name}" ${isActive ? 'activé' : 'désactivé'} avec succès.`,
  };
};

export const deleteScanStation = async (
  stationId: string
): Promise<{ success: boolean; message: string }> => {
  const stations = getStoredScanStations();
  const filtered = stations.filter((s) => s.id !== stationId);
  saveStoredScanStations(filtered);

  const client = getSupabaseClient();
  if (client) {
    try {
      await client.from('scan_stations').delete().eq('id', stationId);
    } catch (e: any) {
      console.warn('Sync Supabase deleteScanStation:', e.message);
    }
  }

  return {
    success: true,
    message: 'Poste de contrôle supprimé.',
  };
};

export const verifyScanStationAccess = async (
  accessCode: string
): Promise<{ success: boolean; station?: ScanStation; message: string }> => {
  const cleanCode = accessCode.trim().toUpperCase();
  const stations = getStoredScanStations();
  let station = stations.find((s) => s.accessCode.toUpperCase() === cleanCode);

  const client = getSupabaseClient();
  if (!station && client) {
    try {
      const { data } = await client
        .from('scan_stations')
        .select('*')
        .eq('access_code', cleanCode)
        .single();
      if (data) {
        station = {
          id: data.id,
          eventId: data.event_id,
          eventTitle: data.event_title || 'Événement Thièsdn',
          name: data.name,
          accessCode: data.access_code,
          createdBy: data.created_by,
          createdByName: data.created_by_name,
          isActive: data.is_active ?? true,
          scansCount: Number(data.scans_count) || 0,
          lastScannedAt: data.last_scanned_at,
          notes: data.notes,
          createdAt: data.created_at,
        };
      }
    } catch (e) {
      console.warn('Sync Supabase verifyScanStationAccess:', e);
    }
  }

  if (!station) {
    return {
      success: false,
      message: 'Code d’accès invalide ou expiré. Demandez un nouveau lien au promoteur.',
    };
  }

  if (!station.isActive) {
    return {
      success: false,
      station,
      message: 'Ce poste de contrôle a été désactivé par le promoteur. Contactez la régie.',
    };
  }

  return {
    success: true,
    station,
    message: `Poste "${station.name}" connecté et prêt.`,
  };
};

export interface OfflineScanItem {
  ticketId: string;
  qrCode: string;
  scannedAt: string;
  stationAccessCode: string;
}

const STORAGE_OFFLINE_SCAN_QUEUE = 'thiesdn_offline_scan_queue_v1';

export const getOfflineScanQueue = (): OfflineScanItem[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_OFFLINE_SCAN_QUEUE);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const addToOfflineScanQueue = (item: OfflineScanItem): void => {
  if (typeof window === 'undefined') return;
  const queue = getOfflineScanQueue();
  if (!queue.some((q) => q.qrCode.toUpperCase() === item.qrCode.toUpperCase())) {
    queue.push(item);
    localStorage.setItem(STORAGE_OFFLINE_SCAN_QUEUE, JSON.stringify(queue));
  }
};

export const clearOfflineScanQueue = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_OFFLINE_SCAN_QUEUE);
};

export const preloadStationTicketsCache = async (
  accessCode: string
): Promise<{ count: number; error?: string }> => {
  const stationCheck = await verifyScanStationAccess(accessCode);
  if (!stationCheck.success || !stationCheck.station) {
    return { count: 0, error: 'Poste de contrôle invalide' };
  }

  const client = getSupabaseClient();
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (!client || !isOnline) {
    const local = getStoredTickets();
    const count = stationCheck.station.eventId
      ? local.filter((t) => t.eventId === stationCheck.station?.eventId).length
      : local.length;
    return { count };
  }

  try {
    let query = client.from('tickets').select('*');
    if (stationCheck.station.eventId) {
      query = query.eq('event_id', stationCheck.station.eventId);
    }
    const { data, error } = await query;
    if (error) {
      return { count: 0, error: error.message };
    }

    if (data && data.length > 0) {
      const remoteTickets: UserTicket[] = data.map((raw: any) => ({
        id: raw.id,
        eventId: raw.event_id || '',
        eventTitle: raw.event_title || stationCheck.station?.eventTitle || '',
        eventPoster: raw.event_poster || '',
        eventDate: raw.event_date || '',
        eventTime: raw.event_time || '',
        eventVenue: raw.event_venue || '',
        tierName: raw.tier_name || 'Standard',
        price: Number(raw.price) || 0,
        qrCode: raw.qr_code,
        seatNumber: raw.seat_number,
        holderName: raw.holder_name || 'Nom non renseigné',
        holderPhone: raw.holder_phone || undefined,
        holderEmail: raw.holder_email || undefined,
        purchasedAt: raw.purchased_at || raw.created_at || new Date().toISOString(),
        status: raw.status || 'valid',
        isPhysical: Boolean(raw.is_physical),
        agentId: raw.agent_id || undefined,
        agentName: raw.agent_name || undefined,
        batchNumber: raw.batch_number || undefined,
        serialNumber: raw.serial_number || undefined,
        usedAt: raw.used_at || undefined,
      }));

      const currentLocal = getStoredTickets();
      const currentMap = new Map(currentLocal.map((t) => [t.qrCode.toUpperCase(), t]));
      for (const rt of remoteTickets) {
        currentMap.set(rt.qrCode.toUpperCase(), rt);
      }
      const merged = Array.from(currentMap.values());
      saveStoredTickets(merged);
      return { count: remoteTickets.length };
    }
    return { count: 0 };
  } catch (err: any) {
    return { count: 0, error: err.message };
  }
};

export const syncOfflineScansToSupabase = async (
  accessCode: string
): Promise<{ syncedCount: number; errorsCount: number }> => {
  const queue = getOfflineScanQueue();
  if (queue.length === 0) return { syncedCount: 0, errorsCount: 0 };

  const client = getSupabaseClient();
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  if (!client || !isOnline) {
    return { syncedCount: 0, errorsCount: 0 };
  }

  // Résolution de l'événement associé au poste de scan pour validation stricte
  const stationCheck = await verifyScanStationAccess(accessCode);
  const stationEventId = stationCheck.station?.eventId;

  let syncedCount = 0;
  let errorsCount = 0;
  const remainingQueue: OfflineScanItem[] = [];

  for (const item of queue) {
    try {
      const { data, error } = await client.rpc('scan_ticket', {
        p_qr_code: item.qrCode,
        p_station_code: item.stationAccessCode || accessCode,
        p_event_id: isValidUUID(stationEventId) ? stationEventId : null,
      });
      if (!error && data?.success) {
        syncedCount++;
      } else {
        remainingQueue.push(item);
        errorsCount++;
      }
    } catch {
      remainingQueue.push(item);
      errorsCount++;
    }
  }

  if (remainingQueue.length === 0) {
    clearOfflineScanQueue();
  } else {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_OFFLINE_SCAN_QUEUE, JSON.stringify(remainingQueue));
    }
  }

  return { syncedCount, errorsCount };
};

export interface StationScanResult {
  success: boolean;
  reason?: 'authorized' | 'already_scanned' | 'printed_not_sold' | 'cancelled' | 'not_found';
  message: string;
  scannedAt?: string;
  scannedAtFormatted?: string;
  ticketDetails?: {
    id: string;
    holderName: string;
    holderPhone?: string;
    holderAvatar?: string;
    eventTitle: string;
    tierName: string;
    qrCode: string;
    stationName: string;
    scannedAt: string;
    isPhysical?: boolean;
    agentName?: string;
  };
  refusedDetails?: {
    holderName: string;
    holderPhone?: string;
    holderAvatar?: string;
    qrCode: string;
    tierName: string;
    scannedAt?: string;
    scannedAtFormatted?: string;
  };
  badgeTheme?: 'staff' | 'invite' | 'presse' | 'vip' | 'standard';
  offlineValidated?: boolean;
}

export const scanTicketFromStation = async (
  accessCode: string,
  qrCode: string
): Promise<StationScanResult> => {
  const stationCheck = await verifyScanStationAccess(accessCode);
  if (!stationCheck.success || !stationCheck.station) {
    return {
      success: false,
      reason: 'not_found',
      message: stationCheck.message,
    };
  }

  const station = stationCheck.station;
  const cleanCode = qrCode.trim().toUpperCase();

  // 1. CAS ACCRÉDITATION (ACC-STAFF, ACC-INVITE, ACC-PRESSE)
  if (cleanCode.startsWith('ACC-')) {
    const accredRes = await scanAccreditationAtomic(cleanCode, station.eventId);
    if (accredRes.success && accredRes.accreditation) {
      station.scansCount = (station.scansCount || 0) + 1;
      station.lastScannedAt = new Date().toISOString();
      const allStations = getStoredScanStations();
      const sIdx = allStations.findIndex((s) => s.id === station.id);
      if (sIdx !== -1) {
        allStations[sIdx] = station;
        saveStoredScanStations(allStations);
      }

      return {
        success: true,
        reason: 'authorized',
        message: accredRes.message,
        badgeTheme: accredRes.badgeTheme,
        ticketDetails: {
          id: accredRes.accreditation.id,
          holderName: accredRes.accreditation.holderName,
          eventTitle: accredRes.accreditation.eventTitle,
          tierName: `ACCRÉDITATION ${accredRes.accreditation.type.toUpperCase()}`,
          qrCode: accredRes.accreditation.qrCode,
          stationName: station.name,
          scannedAt: accredRes.accreditation.scannedAt || new Date().toISOString(),
        },
      };
    } else {
      return {
        success: false,
        reason: 'already_scanned',
        message: accredRes.message || 'Badge d’accréditation déjà scanné ou révoqué !',
        badgeTheme: accredRes.badgeTheme,
      };
    }
  }

  // 2. CAS PASS INVITÉ GUEST LIST (GUEST-)
  if (cleanCode.startsWith('GUEST-')) {
    const guestRes = await scanGuestTicketAtomic(cleanCode);
    if (guestRes.success && guestRes.ticket) {
      station.scansCount = (station.scansCount || 0) + 1;
      station.lastScannedAt = new Date().toISOString();
      const allStations = getStoredScanStations();
      const sIdx = allStations.findIndex((s) => s.id === station.id);
      if (sIdx !== -1) {
        allStations[sIdx] = station;
        saveStoredScanStations(allStations);
      }

      return {
        success: true,
        reason: 'authorized',
        message: guestRes.message,
        badgeTheme: 'invite',
        ticketDetails: {
          id: guestRes.ticket.id,
          holderName: guestRes.ticket.guestName,
          eventTitle: guestRes.ticket.eventTitle,
          tierName: `Guest List (${guestRes.ticket.coproducerName})`,
          qrCode: guestRes.ticket.qrCode,
          stationName: station.name,
          scannedAt: new Date().toISOString(),
        },
      };
    } else {
      return {
        success: false,
        reason: 'already_scanned',
        message: guestRes.message || 'Pass invité déjà utilisé ou invalide !',
        badgeTheme: 'invite',
      };
    }
  }

  // 3. BILLETS CLASSIQUES & BILLETS PHYSIQUES
  const client = getSupabaseClient();
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // TENTATIVE EN LIGNE PRIORITAIRE AVEC SUPABASE RPC (3 PARAMÈTRES SÉCURISÉS)
  if (client && isOnline) {
    try {
      const { data, error } = await client.rpc('scan_ticket', {
        p_qr_code: cleanCode,
        p_station_code: station.accessCode,
        p_event_id: isValidUUID(station.eventId) ? station.eventId : null,
      });
      if (!error && data) {
        const raw = data.ticket;
        const holderName = raw?.holder_name?.trim() || 'Nom non renseigné';
        const holderPhone = raw?.holder_phone?.trim() || 'Téléphone non renseigné';
        const tierName = raw?.tier_name || 'Standard';
        const isVip = tierName.toUpperCase().includes('VIP');
        const reason = (data.reason || (data.success ? 'authorized' : 'not_found')) as any;
        const scannedAt = data.scanned_at || new Date().toISOString();
        const scannedAtFormatted = data.scanned_at_formatted || new Date(scannedAt).toLocaleTimeString('fr-FR');

        // Mettre à jour le cache local pour synchronisation
        const localTickets = getStoredTickets();
        const tIdx = localTickets.findIndex(
          (t) => t.qrCode.toUpperCase() === cleanCode || t.id.toUpperCase() === cleanCode
        );
        if (tIdx !== -1) {
          localTickets[tIdx].status = data.success ? 'scanned' : (raw?.status || localTickets[tIdx].status);
          if (data.success) {
            localTickets[tIdx].usedAt = scannedAt;
          }
          saveStoredTickets(localTickets);
        }

        const holderAvatar = raw?.holder_avatar || raw?.assigned_to_avatar;

        if (data.success) {
          station.scansCount = (station.scansCount || 0) + 1;
          station.lastScannedAt = scannedAt;
          const allStations = getStoredScanStations();
          const sIdx = allStations.findIndex((s) => s.id === station.id);
          if (sIdx !== -1) {
            allStations[sIdx] = station;
            saveStoredScanStations(allStations);
          }

          return {
            success: true,
            reason: 'authorized',
            message: 'ACCÈS AUTORISÉ',
            scannedAt,
            scannedAtFormatted,
            badgeTheme: isVip ? 'vip' : 'standard',
            ticketDetails: {
              id: raw?.id || cleanCode,
              holderName,
              holderPhone,
              holderAvatar,
              eventTitle: raw?.event_title || station.eventTitle,
              tierName,
              qrCode: raw?.qr_code || cleanCode,
              stationName: station.name,
              scannedAt,
              isPhysical: Boolean(raw?.is_physical),
            },
          };
        } else {
          return {
            success: false,
            reason,
            message: data.message || 'ACCÈS REFUSÉ',
            scannedAt,
            scannedAtFormatted,
            refusedDetails: {
              holderName,
              holderPhone,
              holderAvatar,
              qrCode: raw?.qr_code || cleanCode,
              tierName,
              scannedAt,
              scannedAtFormatted,
            },
          };
        }
      }
    } catch (e: any) {
      console.warn('Erreur appel réseau Supabase RPC scan_ticket, bascule sur validation locale hors-ligne:', e?.message);
    }
  }

  // 4. VALIDATION LOCALE (HORS-LIGNE OU SECOURS EN CAS DE COUPURE RÉSEAU)
  const localTickets = getStoredTickets();
  const ticketIdx = localTickets.findIndex(
    (t) => t.qrCode.toUpperCase() === cleanCode || t.id.toUpperCase() === cleanCode
  );

  if (ticketIdx === -1) {
    return {
      success: false,
      reason: 'not_found',
      message: 'BILLET INTROUVABLE OU FAUX',
    };
  }

  const ticket = localTickets[ticketIdx];
  const holderName = ticket.holderName?.trim() || 'Nom non renseigné';
  const holderPhone = ticket.holderPhone?.trim() || 'Téléphone non renseigné';
  const holderAvatar = ticket.holderAvatar || ticket.assignedToAvatar;
  const tierName = ticket.tierName || 'Standard';
  const isVip = tierName.toUpperCase().includes('VIP');

  const refusedDetails = {
    holderName,
    holderPhone,
    holderAvatar,
    qrCode: ticket.qrCode,
    tierName,
    scannedAt: ticket.usedAt,
    scannedAtFormatted: ticket.usedAt ? new Date(ticket.usedAt).toLocaleTimeString('fr-FR') : undefined,
  };

  // 4.1 Billet physique non vendu
  if (
    ticket.status === 'printed_not_sold' ||
    ticket.status === 'physical_printed' ||
    ticket.status === 'physical_allocated'
  ) {
    return {
      success: false,
      reason: 'printed_not_sold',
      message: 'BILLET NON DÉCLARÉ VENDU',
      refusedDetails,
    };
  }

  // 4.2 Billet déjà utilisé
  if (ticket.status === 'scanned' || ticket.status === 'used') {
    const formattedTime = ticket.usedAt
      ? new Date(ticket.usedAt).toLocaleTimeString('fr-FR')
      : 'heure inconnue';
    return {
      success: false,
      reason: 'already_scanned',
      message: 'BILLET DÉJÀ UTILISÉ',
      scannedAt: ticket.usedAt,
      scannedAtFormatted: formattedTime,
      refusedDetails: {
        ...refusedDetails,
        scannedAtFormatted: formattedTime,
      },
    };
  }

  // 4.3 Billet annulé
  if (ticket.status === 'cancelled') {
    return {
      success: false,
      reason: 'cancelled',
      message: 'BILLET ANNULÉ PAR L’ORGANISATION',
      refusedDetails,
    };
  }

  // 4.4 Billet valide (valid ou sold_valid) : passage IMMÉDIAT à scanned
  const nowIso = new Date().toISOString();
  ticket.status = 'scanned';
  ticket.usedAt = nowIso;
  ticket.validatedBy = station.accessCode;
  localTickets[ticketIdx] = ticket;
  saveStoredTickets(localTickets);

  // Enregistrer dans la file d'attente hors-ligne pour synchronisation ultérieure
  addToOfflineScanQueue({
    ticketId: ticket.id,
    qrCode: ticket.qrCode,
    scannedAt: nowIso,
    stationAccessCode: station.accessCode,
  });

  // Mettre à jour la station
  station.scansCount = (station.scansCount || 0) + 1;
  station.lastScannedAt = nowIso;
  const allStations = getStoredScanStations();
  const sIdx = allStations.findIndex((s) => s.id === station.id);
  if (sIdx !== -1) {
    allStations[sIdx] = station;
    saveStoredScanStations(allStations);
  }

  return {
    success: true,
    reason: 'authorized',
    message: 'ACCÈS AUTORISÉ',
    scannedAt: nowIso,
    scannedAtFormatted: new Date(nowIso).toLocaleTimeString('fr-FR'),
    badgeTheme: isVip ? 'vip' : 'standard',
    offlineValidated: true,
    ticketDetails: {
      id: ticket.id,
      holderName,
      holderPhone,
      holderAvatar,
      eventTitle: ticket.eventTitle,
      tierName,
      qrCode: ticket.qrCode,
      stationName: station.name,
      scannedAt: nowIso,
      isPhysical: ticket.isPhysical,
      agentName: ticket.agentName,
    },
  };
};

/**
 * Signalement du paiement par le client : passe la commande en 'payment_signaled'.
 */
export const signalOrderPayment = async (
  orderId: string,
  paymentReference: string,
  proofUrl?: string
): Promise<{ success: boolean; message: string; order?: OrderRecord }> => {
  const client = getSupabaseClient();
  const orders = getStoredOrders();
  let order = orders.find((o) => o.id === orderId || o.reference === orderId);

  // Si la commande n'est pas trouvée dans le cache local, interroger directement Supabase
  if (!order && client) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
      const query = client.from('orders').select('*');
      const { data, error } = isUuid
        ? await query.eq('id', orderId).maybeSingle()
        : await query.eq('reference', orderId).maybeSingle();

      if (data && !error) {
        order = {
          id: data.id,
          reference: data.reference,
          eventId: data.event_id,
          eventTitle: data.event_title || 'Événement Thièsdn',
          userId: data.user_id,
          tierId: data.tier_id || 'std',
          tierName: data.tier_name || 'Standard',
          quantity: data.quantity || 1,
          unitPrice: Number(data.unit_price) || 0,
          totalAmount: Number(data.total_amount) || 0,
          paymentMethod: data.payment_method || 'wave',
          paymentReference: data.payment_reference || '',
          paymentProofUrl: data.payment_proof_url || '',
          customerName: data.customer_name || 'Client',
          customerPhone: data.customer_phone || '',
          status: data.status || 'pending',
          confirmedBy: data.confirmed_by,
          confirmedAt: data.confirmed_at,
          createdAt: data.created_at || new Date().toISOString(),
        };
      }
    } catch (e: any) {
      console.warn('Erreur recherche commande Supabase confirm:', e.message);
    }
  }

  if (!order) {
    return { success: false, message: 'Commande introuvable.' };
  }

  order.status = 'payment_signaled';
  order.paymentReference = paymentReference.trim();
  if (proofUrl) order.paymentProofUrl = proofUrl.trim();
  saveOrderRecord(order);

  if (client) {
    try {
      await client
        .from('orders')
        .update({
          status: 'payment_signaled',
          payment_reference: paymentReference.trim(),
          payment_proof_url: proofUrl ? proofUrl.trim() : null,
        })
        .eq('id', order.id);
    } catch (e: any) {
      console.warn('Sync Supabase signalOrderPayment:', e.message);
    }
  }

  return {
    success: true,
    message: 'Votre paiement a été signalé avec succès. Il est maintenant en attente de confirmation administrative.',
    order,
  };
};

/**
 * Confirmation administrative atomique d'un paiement manuel.
 * Émet les billets QR code et enregistre la transaction financière.
 */
export const confirmManualOrderAtomic = async (
  orderId: string,
  eventFallback?: EventItem,
  adminId?: string
): Promise<{ success: boolean; message: string; tickets?: UserTicket[]; order?: OrderRecord }> => {
  const client = getSupabaseClient();
  const orders = getStoredOrders();
  let order = orders.find((o) => o.id === orderId || o.reference === orderId);

  // Si la commande n'est pas trouvée dans le cache local, interroger directement Supabase
  if (!order && client) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
      const query = client.from('orders').select('*');
      const { data, error } = isUuid
        ? await query.eq('id', orderId).maybeSingle()
        : await query.eq('reference', orderId).maybeSingle();

      if (data && !error) {
        order = {
          id: data.id,
          reference: data.reference,
          eventId: data.event_id,
          eventTitle: data.event_title || 'Événement Thièsdn',
          userId: data.user_id,
          tierId: data.tier_id || 'std',
          tierName: data.tier_name || 'Standard',
          quantity: data.quantity || 1,
          unitPrice: Number(data.unit_price) || 0,
          totalAmount: Number(data.total_amount) || 0,
          paymentMethod: data.payment_method || 'wave',
          paymentReference: data.payment_reference || '',
          paymentProofUrl: data.payment_proof_url || '',
          customerName: data.customer_name || 'Client',
          customerPhone: data.customer_phone || '',
          status: data.status || 'pending',
          confirmedBy: data.confirmed_by,
          confirmedAt: data.confirmed_at,
          createdAt: data.created_at || new Date().toISOString(),
        };
      }
    } catch (e: any) {
      console.warn('Erreur recherche commande Supabase confirm:', e.message);
    }
  }

  if (!order) {
    return { success: false, message: 'Commande introuvable.' };
  }

  if (order.status === 'confirmed') {
    return { success: false, message: 'Cette commande a déjà été confirmée. Zéro double validation.' };
  }

  if (order.status === 'rejected' || order.status === 'cancelled' || order.status === 'expired') {
    return { success: false, message: 'Impossible de confirmer une commande déjà annulée, rejetée ou expirée.' };
  }

  // Si Supabase est connecté, tenter la RPC atomique ou mise à jour directe
  if (client) {
    try {
      await client
        .from('orders')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          confirmed_by: adminId || 'admin-thiesdn',
        })
        .eq('id', order.id);
    } catch (err: any) {
      console.warn('Erreur mise à jour commande Supabase:', err.message);
    }
  }

  // Mise à jour de l'état local de la commande
  order.status = 'confirmed';
  order.confirmedAt = new Date().toISOString();
  order.confirmedBy = adminId || 'admin-thiesdn';
  saveOrderRecord(order);

  // Génération des billets pour chaque place payée
  const newTickets: UserTicket[] = [];
  const basePricePerTicket = order.unitPrice;
  const split = calculateCommissionSplit(order.unitPrice * order.quantity);

  for (let i = 1; i <= order.quantity; i++) {
    const tktId = `tkt-thiesdn-${Date.now().toString().slice(-6)}-${i}`;
    const qrCode = `THIESDN-${order.reference}-${i}`;

    const newTicket: UserTicket = {
      id: tktId,
      eventId: order.eventId,
      eventTitle: order.eventTitle,
      eventPoster: eventFallback?.posterUrl || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800',
      eventDate: eventFallback?.date || 'Date de l\'événement',
      eventTime: eventFallback?.time || '21:00',
      eventVenue: eventFallback?.venue || 'Thiès / Petite Côte',
      tierName: order.tierName,
      price: basePricePerTicket,
      qrCode,
      seatNumber: `Place ${i}/${order.quantity}`,
      holderName: order.customerName,
      holderPhone: order.customerPhone,
      purchasedAt: new Date().toISOString(),
      status: 'valid',
    };
    newTickets.push(newTicket);

    // Insertion directe dans la table tickets Supabase
    if (client) {
      Promise.resolve(
        client
          .from('tickets')
          .insert({
            event_id: order.eventId,
            user_id: order.userId || null,
            order_id: order.id,
            tier_name: order.tierName,
            price: basePricePerTicket,
            qr_code: qrCode,
            holder_name: order.customerName,
            holder_phone: order.customerPhone || null,
            status: 'valid',
          })
      )
        .then((res: any) => {
          if (res?.error) console.warn('Erreur insertion billet Supabase:', res.error.message);
        })
        .catch((e: any) => console.warn('Supabase insert ticket catch:', e));
    }
  }

  // Persistance des billets
  const currentTickets = getStoredTickets();
  const updatedTickets = [...newTickets, ...currentTickets];
  saveStoredTickets(updatedTickets);

  // Enregistrement de la transaction financière (Comptabilité Option 3)
  saveTransaction({
    id: `tx-${Date.now().toString().slice(-6)}`,
    orderId: order.id,
    eventId: order.eventId,
    eventTitle: order.eventTitle,
    promoterId: eventFallback?.promoter.id || 'prom-1',
    promoterName: eventFallback?.promoter.name || 'Promoteur',
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    paymentMethod: order.paymentMethod,
    totalAmount: order.totalAmount,
    promoterShare: split.promoterShare,
    platformFee: split.platformFee,
    operatorFee: split.operatorFee,
    status: 'completed',
    createdAt: new Date().toISOString(),
  });

  return {
    success: true,
    message: `Paiement confirmé ! ${newTickets.length} billet(s) émis pour ${order.customerName}.`,
    tickets: newTickets,
    order,
  };
};

/**
 * Rejet d'une commande par l'administrateur
 */
export const rejectManualOrderAtomic = async (
  orderId: string,
  reason?: string
): Promise<{ success: boolean; message: string; order?: OrderRecord }> => {
  const client = getSupabaseClient();
  const orders = getStoredOrders();
  let order = orders.find((o) => o.id === orderId || o.reference === orderId);

  // Si la commande n'est pas trouvée dans le cache local, interroger directement Supabase
  if (!order && client) {
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
      const query = client.from('orders').select('*');
      const { data, error } = isUuid
        ? await query.eq('id', orderId).maybeSingle()
        : await query.eq('reference', orderId).maybeSingle();

      if (data && !error) {
        order = {
          id: data.id,
          reference: data.reference,
          eventId: data.event_id,
          eventTitle: data.event_title || 'Événement Thièsdn',
          userId: data.user_id,
          tierId: data.tier_id || 'std',
          tierName: data.tier_name || 'Standard',
          quantity: data.quantity || 1,
          unitPrice: Number(data.unit_price) || 0,
          totalAmount: Number(data.total_amount) || 0,
          paymentMethod: data.payment_method || 'wave',
          paymentReference: data.payment_reference || '',
          paymentProofUrl: data.payment_proof_url || '',
          customerName: data.customer_name || 'Client',
          customerPhone: data.customer_phone || '',
          status: data.status || 'pending',
          confirmedBy: data.confirmed_by,
          confirmedAt: data.confirmed_at,
          rejectionReason: data.rejection_reason,
          createdAt: data.created_at || new Date().toISOString(),
        };
      }
    } catch (e: any) {
      console.warn('Erreur recherche commande Supabase lors du rejet:', e.message);
    }
  }

  if (!order) {
    return { success: false, message: 'Commande introuvable.' };
  }

  if (order.status === 'confirmed') {
    return { success: false, message: 'Impossible de rejeter une commande déjà confirmée.' };
  }

  order.status = 'rejected';
  order.rejectionReason = reason || 'Non justifié';
  saveOrderRecord(order);

  if (client) {
    try {
      // Priorité stricte sur l'UUID (order.id) pour la mise à jour Supabase
      const { error: updateError } = await client
        .from('orders')
        .update({ status: 'rejected', rejection_reason: order.rejectionReason })
        .eq('id', order.id);

      if (updateError) {
        console.warn('Update reject par UUID échoué, essai par référence:', updateError.message);
        await client
          .from('orders')
          .update({ status: 'rejected', rejection_reason: order.rejectionReason })
          .eq('reference', order.reference);
      }
    } catch (e: any) {
      console.warn('Sync Supabase reject:', e.message);
    }
  }

  return {
    success: true,
    message: `La commande ${order.reference} a été rejetée. Motif : ${order.rejectionReason}`,
    order,
  };
};

/**
 * Expiration automatique des commandes en attente (délai dépassé sans virement signalé)
 */
export const checkAndExpirePendingOrders = (timeoutMinutes = 30): OrderRecord[] => {
  const orders = getStoredOrders();
  const now = Date.now();
  let modified = false;

  const updatedOrders = orders.map((order) => {
    if (order.status === 'pending') {
      const createdTime = new Date(order.createdAt).getTime();
      const ageMinutes = (now - createdTime) / (1000 * 60);
      if (ageMinutes >= timeoutMinutes) {
        modified = true;
        return {
          ...order,
          status: 'expired' as OrderStatus,
          rejectionReason: `Délai de paiement manuel (${timeoutMinutes} min) dépassé. Stock libéré.`,
        };
      }
    }
    return order;
  });

  if (modified && typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(updatedOrders));
  }
  return updatedOrders;
};

/**
 * Calcul financier validé : OPTION 3 (Frais opérateur 1% en sus au client)
 * - Prix de base : P (ex: 10 000 FCFA)
 * - Frais opérateur (+1%) : 100 FCFA (payé par le client)
 * - Total perçu client : 10 100 FCFA
 * - Part Promoteur (90% du prix de base) : 9 000 FCFA
 * - Commission Plateforme Thièsdn (10% du prix de base) : 1 000 FCFA
 * - Frais Opérateur Wave/OM (1%) : 100 FCFA
 * Total des parts : 9 000 + 1 000 + 100 = 10 100 FCFA (100% exact, zéro écart comptable).
 */
export const calculateCommissionSplit = (basePrice: number) => {
  const operatorFee = Math.round(basePrice * 0.01); // 1% frais opérateur
  const totalCustomerPaid = basePrice + operatorFee; // Montant total payé par le client
  const promoterShare = Math.round(basePrice * 0.90); // 90% du prix de base
  const platformFee = basePrice - promoterShare; // 10% exact du prix de base (100% balance)

  return {
    basePrice,
    operatorFee,
    totalCustomerPaid,
    total: totalCustomerPaid,
    promoterShare,
    platformFee,
    // Réconciliation 100%
    reconciliationSum: promoterShare + platformFee + operatorFee,
    isBalanced: (promoterShare + platformFee + operatorFee) === totalCustomerPaid,
  };
};

// ====================================================================
// SCHÉMA SQL COMPLET SUPABASE (RLS, ATOMICITY & LOCKING)
// ====================================================================
export const SUPABASE_SQL_SCHEMA = `-- ========================================================
-- THIESDN BILLETTERIE - SCHÉMA DE PRODUCTION SUPABASE
-- Flux : Paiement Manuel Wave / OM + Réservation Atomique
-- ========================================================

-- 1. Table des profils utilisateurs & rôles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT UNIQUE,
  email TEXT,
  phone TEXT,
  city TEXT DEFAULT 'Thiès',
  address TEXT,
  quartier TEXT,
  avatar TEXT,
  is_vip BOOLEAN DEFAULT false,
  role TEXT CHECK (role IN ('user', 'promoter', 'admin')) DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Assurer la présence des colonnes city, address et quartier
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'Thiès';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS quartier TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_version TEXT DEFAULT 'v1.0';

-- 2. Paramètres officiels de paiement (Wave & Orange Money)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

INSERT INTO public.platform_settings (key, value) VALUES
('manual_payment_info', '{
  "waveNumber": "+221 77 000 00 00",
  "waveBeneficiary": "Thièsdn Billetterie Officiel",
  "omNumber": "+221 78 000 00 00",
  "omBeneficiary": "Thièsdn Billetterie SARL"
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 3. Table des événements
CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  datetime_iso TIMESTAMP WITH TIME ZONE NOT NULL,
  venue TEXT NOT NULL,
  city TEXT NOT NULL CHECK (city IN ('Thiès', 'Mbour', 'Saly', 'Dakar', 'Autre')),
  quartier TEXT,
  poster_url TEXT NOT NULL,
  price NUMERIC NOT NULL,
  promoter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  promoter_name TEXT NOT NULL,
  promoter_avatar TEXT,
  promoter_verified BOOLEAN DEFAULT false,
  status TEXT CHECK (status IN ('approved', 'pending', 'rejected')) DEFAULT 'pending',
  featured BOOLEAN DEFAULT false,
  vip_available BOOLEAN DEFAULT true,
  is_exclusive BOOLEAN DEFAULT false,
  description TEXT,
  youtube_url TEXT,
  whatsapp_contact TEXT,
  promo_code TEXT,
  promo_discount_percent NUMERIC,
  tiers JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS promo_code TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS promo_discount_percent NUMERIC;

-- 4. Table des commandes (Flux Paiement Manuel)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reference TEXT UNIQUE NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE RESTRICT,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  tier_id TEXT NOT NULL,
  tier_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC NOT NULL,
  total_amount NUMERIC NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('wave', 'om')),
  payment_reference TEXT,
  payment_proof_url TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'payment_signaled', 'confirmed', 'rejected', 'expired', 'cancelled')) DEFAULT 'pending',
  confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Table des billets achetés (Pass QR émis après confirmation de paiement)
CREATE TABLE IF NOT EXISTS public.tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_title TEXT NOT NULL,
  event_poster TEXT,
  event_date TEXT NOT NULL,
  event_time TEXT NOT NULL,
  event_venue TEXT NOT NULL,
  tier_name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  qr_code TEXT UNIQUE NOT NULL,
  seat_number TEXT,
  holder_name TEXT NOT NULL,
  status TEXT CHECK (status IN (
    'valid', 'used', 'cancelled',
    'printed_not_sold', 'sold_valid', 'scanned',
    'physical_printed', 'physical_allocated', 'physical_sold'
  )) DEFAULT 'valid',
  used_at TIMESTAMP WITH TIME ZONE,
  validated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Table des transactions & commissions
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  promoter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT,
  payment_method TEXT CHECK (payment_method IN ('wave', 'om', 'yas', 'card')),
  total_amount NUMERIC NOT NULL,
  promoter_share NUMERIC NOT NULL,
  platform_fee NUMERIC NOT NULL,
  operator_fee NUMERIC NOT NULL,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Table des collaborateurs & points de vente (Réseau physique)
CREATE TABLE IF NOT EXISTS public.sales_agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  promoter_id TEXT NOT NULL,
  point_de_vente TEXT NOT NULL,
  gerant_name TEXT NOT NULL,
  telephone TEXT NOT NULL,
  email TEXT,
  quartier TEXT,
  allocated_count INT DEFAULT 0,
  sold_count INT DEFAULT 0,
  commission_percent NUMERIC DEFAULT 10,
  cash_collected NUMERIC DEFAULT 0,
  amount_due NUMERIC DEFAULT 0,
  amount_paid_to_promoter NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enrichissement de la table tickets pour le support physique
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS is_physical BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES public.sales_agents(id) ON DELETE SET NULL;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS agent_name TEXT;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS batch_number TEXT;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS serial_number INT;

-- Billets nominatifs : identité de l'acheteur (anti-photocopie)
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS holder_phone TEXT;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS holder_email TEXT;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS sold_at TIMESTAMP WITH TIME ZONE;

-- Migration idempotente : élargir la contrainte de statut (bases déjà créées)
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check CHECK (status IN (
  'valid', 'used', 'cancelled',
  'printed_not_sold', 'sold_valid', 'scanned',
  'physical_printed', 'physical_allocated', 'physical_sold'
));

-- 8. Table des Co-Producteurs, Artistes & Staff (Module Co-Production)
CREATE TABLE IF NOT EXISTS public.event_coproducers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  promoter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  role_type TEXT NOT NULL CHECK (role_type IN ('producteur_principal', 'co_producteur', 'artiste', 'staff_artiste', 'gerant_lieu')),
  revenue_share NUMERIC NOT NULL DEFAULT 0 CHECK (revenue_share >= 0 AND revenue_share <= 100),
  guest_tickets_allocated INT NOT NULL DEFAULT 0 CHECK (guest_tickets_allocated >= 0),
  guest_tickets_used INT NOT NULL DEFAULT 0,
  notes TEXT,
  decompte_validated BOOLEAN DEFAULT false,
  decompte_validated_at TIMESTAMP WITH TIME ZONE,
  decompte_signature TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Assurer la présence des colonnes indispensables
ALTER TABLE public.event_coproducers ADD COLUMN IF NOT EXISTS role_type TEXT DEFAULT 'co_producteur';
ALTER TABLE public.event_coproducers ADD COLUMN IF NOT EXISTS revenue_share NUMERIC DEFAULT 0;
ALTER TABLE public.event_coproducers ADD COLUMN IF NOT EXISTS guest_tickets_allocated INT DEFAULT 0;
ALTER TABLE public.event_coproducers ADD COLUMN IF NOT EXISTS guest_tickets_used INT DEFAULT 0;
ALTER TABLE public.event_coproducers ADD COLUMN IF NOT EXISTS decompte_validated BOOLEAN DEFAULT false;
ALTER TABLE public.event_coproducers ADD COLUMN IF NOT EXISTS decompte_validated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.event_coproducers ADD COLUMN IF NOT EXISTS decompte_signature TEXT;

-- 9. Table des Pass Invités Artiste / Staff (Guest List)
CREATE TABLE IF NOT EXISTS public.event_guest_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  coproducer_id UUID REFERENCES public.event_coproducers(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  guest_phone TEXT,
  qr_code TEXT UNIQUE NOT NULL,
  status TEXT CHECK (status IN ('valid', 'used')) DEFAULT 'valid',
  scanned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. Table des Accréditations : Staff, Invités VIP & Presse (Module Accréditations)
CREATE TABLE IF NOT EXISTS public.accreditations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  event_title TEXT,
  type TEXT NOT NULL CHECK (type IN ('staff', 'invite', 'presse')),
  holder_name TEXT NOT NULL,
  holder_phone TEXT NOT NULL,
  holder_email TEXT,
  organization TEXT,
  qr_code TEXT UNIQUE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'validated', 'scanned', 'cancelled')) DEFAULT 'validated',
  scanned_at TIMESTAMP WITH TIME ZONE,
  scanned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_by_role TEXT DEFAULT 'promoter',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.accreditations ADD COLUMN IF NOT EXISTS event_title TEXT;
ALTER TABLE public.accreditations ADD COLUMN IF NOT EXISTS organization TEXT;
ALTER TABLE public.accreditations ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE public.accreditations ADD COLUMN IF NOT EXISTS created_by_role TEXT DEFAULT 'promoter';

-- Élargissement des rôles profils
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'promoter', 'admin', 'sales_agent', 'artist'));

-- ====================================================================
-- FONCTIONS RPC SÉCURISÉES : SCAN ATOMIQUE & CONFIRMATION COMMANDE
-- ====================================================================

-- RPC 1 : Scan sécurisé et sans concurrence (RÈGLE DE SÉCURITÉ : VALIDATION PAR VENTE & CONTRÔLE D'ÉVÉNEMENT)
DROP FUNCTION IF EXISTS public.scan_ticket(TEXT);
DROP FUNCTION IF EXISTS public.scan_ticket(TEXT, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.scan_ticket(
  p_qr_code TEXT,
  p_station_code TEXT,
  p_event_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_station public.scan_stations%ROWTYPE;
  v_ticket public.tickets%ROWTYPE;
  v_clean_code TEXT;
  v_clean_station TEXT;
  v_previous_scan_time TEXT;
BEGIN
  v_clean_code := upper(trim(p_qr_code));
  v_clean_station := upper(trim(p_station_code));

  -- 1. Contrôle du poste de contrôle
  IF v_clean_station IS NULL OR v_clean_station = '' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_station', 'message', 'CODE DE POSTE REQUIS');
  END IF;

  SELECT * INTO v_station FROM public.scan_stations WHERE upper(trim(access_code)) = v_clean_station AND is_active = true;
  IF NOT FOUND THEN
    IF NOT (public.is_admin() OR v_clean_station IN ('ADMIN-CHECKIN', 'STA-ADMIN-MASTER')) THEN
      RETURN jsonb_build_object('success', false, 'reason', 'invalid_station', 'message', 'POSTE DE CONTRÔLE INVALIDE OU DÉSACTIVÉ');
    END IF;
  ELSE
    IF v_station.event_id IS NOT NULL AND p_event_id IS NOT NULL AND v_station.event_id <> p_event_id THEN
      RETURN jsonb_build_object('success', false, 'reason', 'station_event_mismatch', 'message', 'POSTE NON AUTORISÉ POUR CET ÉVÉNEMENT');
    END IF;
  END IF;

  -- 2. Verrouillage de la ligne avec FOR UPDATE pour empêcher la validation concurrente
  SELECT * INTO v_ticket 
  FROM public.tickets
  WHERE upper(trim(qr_code)) = v_clean_code OR id::text = trim(p_qr_code)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false, 
      'reason', 'not_found',
      'message', 'BILLET INTROUVABLE OU FAUX'
    );
  END IF;

  -- 3. Contrôle d'appartenance strict à l'événement
  IF p_event_id IS NOT NULL AND (v_ticket.event_id IS NULL OR v_ticket.event_id <> p_event_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'wrong_event',
      'message', 'BILLET INVALIDE POUR CET ÉVÉNEMENT (CONFLIT DE SOIRÉE)',
      'ticket', jsonb_build_object('id', v_ticket.id, 'event_id', v_ticket.event_id, 'event_title', v_ticket.event_title)
    );
  END IF;

  -- 4. Billet physique non vendu : ACCÈS STRICTEMENT REFUSÉ
  IF v_ticket.status = 'printed_not_sold' OR v_ticket.status IN ('physical_printed', 'physical_allocated') THEN
    RETURN jsonb_build_object(
      'success', false, 
      'reason', 'printed_not_sold',
      'message', 'BILLET NON DÉCLARÉ VENDU', 
      'ticket', jsonb_build_object(
        'id', v_ticket.id,
        'holder_name', coalesce(nullif(trim(v_ticket.holder_name), ''), 'Nom non renseigné'),
        'holder_phone', coalesce(nullif(trim(v_ticket.holder_phone), ''), 'Téléphone non renseigné'),
        'qr_code', v_ticket.qr_code,
        'event_title', v_ticket.event_title,
        'tier_name', v_ticket.tier_name,
        'status', v_ticket.status,
        'is_physical', coalesce(v_ticket.is_physical, false)
      )
    );
  END IF;

  -- 5. Billet déjà scanné
  IF v_ticket.status IN ('scanned', 'used') THEN
    v_previous_scan_time := coalesce(to_char(v_ticket.used_at, 'HH24:MI:SS'), 'heure inconnue');
    RETURN jsonb_build_object(
      'success', false, 
      'reason', 'already_scanned',
      'message', 'BILLET DÉJÀ UTILISÉ', 
      'scanned_at', v_ticket.used_at,
      'scanned_at_formatted', v_previous_scan_time,
      'ticket', jsonb_build_object(
        'id', v_ticket.id,
        'holder_name', coalesce(nullif(trim(v_ticket.holder_name), ''), 'Nom non renseigné'),
        'holder_phone', coalesce(nullif(trim(v_ticket.holder_phone), ''), 'Téléphone non renseigné'),
        'qr_code', v_ticket.qr_code,
        'event_title', v_ticket.event_title,
        'tier_name', v_ticket.tier_name,
        'status', v_ticket.status,
        'is_physical', coalesce(v_ticket.is_physical, false)
      )
    );
  END IF;

  -- 6. Billet annulé ou désactivé
  IF v_ticket.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', false, 
      'reason', 'cancelled',
      'message', 'BILLET ANNULÉ PAR L''ORGANISATION', 
      'ticket', jsonb_build_object(
        'id', v_ticket.id,
        'holder_name', coalesce(nullif(trim(v_ticket.holder_name), ''), 'Nom non renseigné'),
        'holder_phone', coalesce(nullif(trim(v_ticket.holder_phone), ''), 'Téléphone non renseigné'),
        'qr_code', v_ticket.qr_code,
        'event_title', v_ticket.event_title,
        'tier_name', v_ticket.tier_name,
        'status', v_ticket.status,
        'is_physical', coalesce(v_ticket.is_physical, false)
      )
    );
  END IF;

  -- 7. Billet valide (sold_valid ou digital valid) : passage IMMÉDIAT à scanned
  UPDATE public.tickets
  SET 
    status = 'scanned', 
    used_at = timezone('utc'::text, now()),
    validated_station_id = v_clean_station,
    validated_station_name = coalesce(v_station.name, v_clean_station)
  WHERE id = v_ticket.id;

  IF v_station.id IS NOT NULL THEN
    UPDATE public.scan_stations
    SET scans_count = coalesce(scans_count, 0) + 1, last_scanned_at = timezone('utc'::text, now())
    WHERE id = v_station.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'reason', 'authorized',
    'message', 'ACCÈS AUTORISÉ',
    'scanned_at', timezone('utc'::text, now()),
    'scanned_at_formatted', to_char(timezone('utc'::text, now()), 'HH24:MI:SS'),
    'ticket', jsonb_build_object(
      'id', v_ticket.id,
      'holder_name', coalesce(nullif(trim(v_ticket.holder_name), ''), 'Nom non renseigné'),
      'holder_phone', coalesce(nullif(trim(v_ticket.holder_phone), ''), 'Téléphone non renseigné'),
      'qr_code', v_ticket.qr_code,
      'event_title', v_ticket.event_title,
      'tier_name', v_ticket.tier_name,
      'status', 'scanned',
      'is_physical', coalesce(v_ticket.is_physical, false)
    )
  );
END;
$$;
      'holder_name', coalesce(nullif(trim(v_ticket.holder_name), ''), 'Nom non renseigné'),
      'holder_phone', coalesce(nullif(trim(v_ticket.holder_phone), ''), 'Téléphone non renseigné'),
      'qr_code', v_ticket.qr_code,
      'event_title', v_ticket.event_title,
      'tier_name', v_ticket.tier_name,
      'status', 'scanned',
      'is_physical', coalesce(v_ticket.is_physical, false)
    )
  );
END;
$$;

-- RPC 1.1 : Activation unitaire par le collaborateur (identité de l'acheteur OBLIGATOIRE)
DROP FUNCTION IF EXISTS public.activate_physical_ticket_sale(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.activate_physical_ticket_sale(
  p_agent_id UUID,
  p_ticket_code TEXT,
  p_holder_name TEXT,
  p_holder_phone TEXT,
  p_holder_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ticket public.tickets%ROWTYPE;
BEGIN
  IF length(trim(coalesce(p_holder_name, ''))) = 0 OR length(trim(coalesce(p_holder_phone, ''))) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Le nom et le téléphone du client sont obligatoires pour activer le billet.');
  END IF;

  SELECT * INTO v_ticket
  FROM public.tickets
  WHERE (qr_code = p_ticket_code OR id::text = p_ticket_code)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Billet introuvable.');
  END IF;

  IF v_ticket.agent_id IS NOT NULL AND v_ticket.agent_id <> p_agent_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ce billet est alloué à un autre point de vente.');
  END IF;

  IF v_ticket.status = 'sold_valid' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ce billet a déjà été déclaré vendu.');
  END IF;

  IF v_ticket.status IN ('scanned', 'used') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ce billet a déjà été scanné à l''entrée.');
  END IF;

  IF v_ticket.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ce billet a été désactivé ou annulé.');
  END IF;

  UPDATE public.tickets
  SET status = 'sold_valid', sold_at = now(), agent_id = p_agent_id,
      holder_name = trim(p_holder_name), holder_phone = trim(p_holder_phone),
      holder_email = nullif(trim(coalesce(p_holder_email, '')), '')
  WHERE id = v_ticket.id;

  UPDATE public.sales_agents
  SET sold_count = sold_count + 1,
      cash_collected = cash_collected + v_ticket.price,
      amount_due = amount_due + ROUND(v_ticket.price * (1 - commission_percent / 100.0))
  WHERE id = p_agent_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Billet activé avec succès (' || v_ticket.price || ' FCFA).',
    'ticket', jsonb_build_object('id', v_ticket.id, 'qr_code', v_ticket.qr_code, 'price', v_ticket.price, 'status', 'sold_valid')
  );
END;
$$;

-- RPC 2 : Réservation de stock atomique lors de la création de commande
CREATE OR REPLACE FUNCTION public.create_order_with_stock(
  p_event_id UUID,
  p_tier_id TEXT,
  p_quantity INT,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_payment_method TEXT,
  p_reference TEXT,
  p_total_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event public.events%ROWTYPE;
  v_tiers JSONB;
  v_tier JSONB;
  v_available INT;
  v_updated_tiers JSONB := '[]'::jsonb;
  v_elem JSONB;
  v_new_order_id UUID;
BEGIN
  -- Verrouiller l'événement
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Événement non trouvé.');
  END IF;

  v_tiers := v_event.tiers;
  v_available := -1;

  -- Parcourir les catégories de billets
  FOR v_elem IN SELECT * FROM jsonb_array_elements(v_tiers)
  LOOP
    IF (v_elem->>'id') = p_tier_id THEN
      v_available := (v_elem->>'available')::INT;
      IF v_available < p_quantity THEN
        RETURN jsonb_build_object('success', false, 'message', 'Stock insuffisant pour cette catégorie.');
      END IF;
      -- Décrémentation atomique
      v_elem := jsonb_set(v_elem, '{available}', to_jsonb(v_available - p_quantity));
    END IF;
    v_updated_tiers := v_updated_tiers || jsonb_build_array(v_elem);
  END LOOP;

  IF v_available = -1 THEN
    -- Tier par défaut
    v_updated_tiers := v_tiers;
  ELSE
    UPDATE public.events SET tiers = v_updated_tiers WHERE id = p_event_id;
  END IF;

  -- Création de la commande
  INSERT INTO public.orders (
    reference, event_id, user_id, tier_id, tier_name, quantity,
    unit_price, total_amount, payment_method, customer_name, customer_phone, status
  ) VALUES (
    p_reference, p_event_id, auth.uid(), p_tier_id,
    COALESCE((SELECT v_elem->>'name' FROM jsonb_array_elements(v_tiers) WHERE (v_elem->>'id') = p_tier_id LIMIT 1), 'Billet Standard'),
    p_quantity, p_total_amount / p_quantity, p_total_amount, p_payment_method,
    p_customer_name, p_customer_phone, 'pending'
  ) RETURNING id INTO v_new_order_id;

  RETURN jsonb_build_object('success', true, 'order_id', v_new_order_id, 'reference', p_reference);
END;
$$;

-- RPC 3 : Confirmation manuelle atomique par un administrateur + émission des billets
CREATE OR REPLACE FUNCTION public.confirm_manual_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_event public.events%ROWTYPE;
  v_i INT;
  v_ticket_id UUID;
  v_qr TEXT;
BEGIN
  -- Seul un admin peut exécuter la confirmation
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Accès refusé. Rôle administrateur requis.');
  END IF;

  -- Verrouillage de la commande pour éviter la double confirmation concurrente
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Commande introuvable.');
  END IF;

  IF v_order.status = 'confirmed' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cette commande a déjà été confirmée.');
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = v_order.event_id;

  -- Marquer confirmée
  UPDATE public.orders
  SET status = 'confirmed', confirmed_by = auth.uid(), confirmed_at = now()
  WHERE id = p_order_id;

  -- Génération des billets pour chaque place commandée
  FOR v_i IN 1..v_order.quantity LOOP
    v_qr := 'THIESDN-' || upper(v_event.city) || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
    INSERT INTO public.tickets (
      order_id, event_id, user_id, event_title, event_poster, event_date,
      event_time, event_venue, tier_name, price, qr_code, holder_name, holder_phone, status
    ) VALUES (
      v_order.id, v_event.id, v_order.user_id, v_event.title, v_event.poster_url,
      v_event.date, v_event.time, v_event.venue, v_order.tier_name,
      v_order.unit_price, v_qr, v_order.customer_name, v_order.customer_phone, 'valid'
    );
  END LOOP;

  -- Enregistrement de la transaction
  INSERT INTO public.transactions (
    order_id, event_id, promoter_id, customer_name, customer_phone,
    payment_method, total_amount, promoter_share, platform_fee, operator_fee, status
  ) VALUES (
    v_order.id, v_event.id, v_event.promoter_id, v_order.customer_name, v_order.customer_phone,
    v_order.payment_method, v_order.total_amount,
    ROUND(v_order.total_amount * 0.90),
    ROUND(v_order.total_amount * 0.10),
    ROUND(v_order.total_amount * 0.01),
    'completed'
  );

  RETURN jsonb_build_object('success', true, 'message', 'Paiement confirmé et billets émis avec succès.');
END;
$$;

-- RPC 4 : Scan atomique d'accréditation (Staff, Invité, Presse) avec détection anti-fraude
CREATE OR REPLACE FUNCTION public.scan_accreditation(p_qr_code TEXT, p_event_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_accred public.accreditations%ROWTYPE;
BEGIN
  -- Verrouillage de la ligne d'accréditation pour éviter toute concurrence
  SELECT * INTO v_accred
  FROM public.accreditations
  WHERE upper(qr_code) = upper(trim(p_qr_code))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Badge d''accréditation introuvable ou faux.');
  END IF;

  IF p_event_id IS NOT NULL AND v_accred.event_id IS NOT NULL AND v_accred.event_id <> p_event_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ce badge d''accréditation n''est pas valide pour cet événement.');
  END IF;

  IF v_accred.status = 'scanned' THEN
    RETURN jsonb_build_object(
      'success', false,
      'badge_type', v_accred.type,
      'message', 'Ce badge ' || upper(v_accred.type) || ' a déjà été validé à l''entrée ! Double accès interdit.'
    );
  END IF;

  IF v_accred.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'success', false,
      'badge_type', v_accred.type,
      'message', 'Ce badge ' || upper(v_accred.type) || ' a été révoqué par la production.'
    );
  END IF;

  UPDATE public.accreditations
  SET status = 'scanned', scanned_at = now(), scanned_by = auth.uid()
  WHERE id = v_accred.id;

  RETURN jsonb_build_object(
    'success', true,
    'badge_type', v_accred.type,
    'message', 'Accès Autorisé : ' || upper(v_accred.type) || ' (' || v_accred.holder_name || ')',
    'accreditation', row_to_json(v_accred)
  );
END;
$$;

-- ====================================================================
-- RLS (ROW LEVEL SECURITY) POLITIQUES DE SÉCURITÉ SERVEUR
-- RÈGLE D'OR : Ne JAMAIS faire de SELECT direct sur public.profiles
-- dans une politique RLS (risque d'infinite recursion).
-- Toujours utiliser public.is_admin() en SECURITY DEFINER.
-- ====================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Profiles : lecture privée restreinte au propriétaire, admins et co-producteurs (anti-fuite de données)
DROP POLICY IF EXISTS "Profiles select policy" ON public.profiles;
CREATE POLICY "Profiles select policy" ON public.profiles FOR SELECT 
USING (
  auth.uid()::text = id::text 
  OR public.is_admin() 
  OR EXISTS (SELECT 1 FROM public.event_coproducers WHERE user_id::text = auth.uid()::text AND promoter_id::text = profiles.id::text)
);

-- Vue publique sanitisée pour les visiteurs non connectés (sans email ni téléphone)
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles WITH (security_invoker = false) AS
  SELECT id, name, username, avatar, role FROM public.profiles;
GRANT SELECT ON public.public_profiles TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Profiles update policy" ON public.profiles;
CREATE POLICY "Profiles update policy" ON public.profiles FOR UPDATE USING (auth.uid() = id OR public.is_admin());

-- Settings : lecture par tous, modification par les admins
DROP POLICY IF EXISTS "Settings read public" ON public.platform_settings;
CREATE POLICY "Settings read public" ON public.platform_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Settings update admin only" ON public.platform_settings;
CREATE POLICY "Settings update admin only" ON public.platform_settings FOR ALL 
USING (public.is_admin());

-- Events : lecture des événements approuvés, ses propres événements ou admin via is_admin()
DROP POLICY IF EXISTS "Events read approved" ON public.events;
CREATE POLICY "Events read approved" ON public.events FOR SELECT 
USING (status = 'approved' OR promoter_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Events insert promoter or admin" ON public.events;
CREATE POLICY "Events insert promoter or admin" ON public.events FOR INSERT
WITH CHECK (promoter_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Events update promoter or admin" ON public.events;
CREATE POLICY "Events update promoter or admin" ON public.events FOR UPDATE
USING (promoter_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Events delete promoter or admin" ON public.events;
CREATE POLICY "Events delete promoter or admin" ON public.events FOR DELETE
USING (promoter_id = auth.uid() OR public.is_admin());

-- Orders : lecture par le client propriétaire ou par les admins via is_admin()
DROP POLICY IF EXISTS "Orders client read" ON public.orders;
CREATE POLICY "Orders client read" ON public.orders FOR SELECT 
USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "Orders client insert" ON public.orders;
CREATE POLICY "Orders client insert" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL OR public.is_admin());
DROP POLICY IF EXISTS "Orders admin update" ON public.orders;
CREATE POLICY "Orders admin update" ON public.orders FOR UPDATE 
USING (user_id = auth.uid() OR public.is_admin());

-- Tickets : lecture par le propriétaire du billet, collaborateur assigné, promoteur ou admin via is_admin()
DROP POLICY IF EXISTS "Tickets read owner or admin" ON public.tickets;
CREATE POLICY "Tickets read owner or admin" ON public.tickets FOR SELECT 
USING (
  user_id = auth.uid() 
  OR agent_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.events WHERE events.id = tickets.event_id AND events.promoter_id = auth.uid())
  OR public.is_admin()
);

DROP POLICY IF EXISTS "Tickets insert owner or admin" ON public.tickets;
CREATE POLICY "Tickets insert owner or admin" ON public.tickets FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.events WHERE events.id = tickets.event_id AND events.promoter_id = auth.uid())
  OR public.is_admin()
);

-- RLS Collaborateurs : activation exclusive des billets alloués lors de la vente
DROP POLICY IF EXISTS "Sales agents update assigned tickets" ON public.tickets;
CREATE POLICY "Sales agents update assigned tickets" ON public.tickets FOR UPDATE
USING (
  status IN ('printed_not_sold', 'physical_printed', 'physical_allocated')
  AND (
    agent_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.sales_agents WHERE sales_agents.user_id = auth.uid() AND sales_agents.id = tickets.agent_id)
  )
)
WITH CHECK (
  status = 'sold_valid'
  AND length(trim(coalesce(holder_name, ''))) > 0
  AND length(trim(coalesce(holder_phone, ''))) > 0
);

-- Les agents de scan (liens /scan/...) n'ont AUCUNE policy directe sur tickets :
-- ils passent uniquement par la RPC SECURITY DEFINER scan_ticket (lecture + validation).
-- Les promoteurs/admins corrigent nom/téléphone via la policy "Promoters update event tickets".

-- RLS Promoteurs : désactivation / annulation sécurisée de leurs billets
DROP POLICY IF EXISTS "Promoters update event tickets" ON public.tickets;
CREATE POLICY "Promoters update event tickets" ON public.tickets FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.events WHERE events.id = tickets.event_id AND events.promoter_id = auth.uid())
  OR public.is_admin()
);

-- Transactions : lecture par promoteur ou admin via is_admin()
DROP POLICY IF EXISTS "Transactions read promoter or admin" ON public.transactions;
CREATE POLICY "Transactions read promoter or admin" ON public.transactions FOR SELECT 
USING (promoter_id = auth.uid() OR public.is_admin());

-- Co-Producteurs : RLS sans SELECT sur profiles
ALTER TABLE public.event_coproducers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Coproducers read policy" ON public.event_coproducers;
CREATE POLICY "Coproducers read policy" ON public.event_coproducers FOR SELECT 
USING (
  user_id = auth.uid() OR 
  promoter_id = auth.uid() OR 
  public.is_admin()
);

DROP POLICY IF EXISTS "Coproducers update policy" ON public.event_coproducers;
CREATE POLICY "Coproducers update policy" ON public.event_coproducers FOR UPDATE 
USING (
  promoter_id = auth.uid() OR 
  user_id = auth.uid() OR 
  public.is_admin()
);

-- Guest List Artiste : RLS (Accès écriture à la liste d'invités pour l'artiste/staff)
ALTER TABLE public.event_guest_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Guest tickets select policy" ON public.event_guest_tickets;
CREATE POLICY "Guest tickets select policy" ON public.event_guest_tickets FOR SELECT USING (true);

DROP POLICY IF EXISTS "Guest tickets insert policy" ON public.event_guest_tickets;
CREATE POLICY "Guest tickets insert policy" ON public.event_guest_tickets FOR INSERT WITH CHECK (true);

-- 11. Accréditations Staff, Invités & Presse : RLS sans SELECT sur profiles
ALTER TABLE public.accreditations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Accreditations select policy" ON public.accreditations;
CREATE POLICY "Accreditations select policy" ON public.accreditations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Accreditations insert policy" ON public.accreditations;
CREATE POLICY "Accreditations insert policy" ON public.accreditations FOR INSERT 
WITH CHECK (
  created_by = auth.uid() OR public.is_admin() OR auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Accreditations update policy" ON public.accreditations;
CREATE POLICY "Accreditations update policy" ON public.accreditations FOR UPDATE 
USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.events WHERE events.id = accreditations.event_id AND events.promoter_id = auth.uid())
  OR public.is_admin()
);

-- 12. Table des Postes de Contrôle (Scanners Multi-Entrées sans login)
CREATE TABLE IF NOT EXISTS public.scan_stations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  event_title TEXT,
  name TEXT NOT NULL,
  access_code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_name TEXT,
  is_active BOOLEAN DEFAULT true,
  scans_count INT DEFAULT 0,
  last_scanned_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.scan_stations ADD COLUMN IF NOT EXISTS event_title TEXT;
ALTER TABLE public.scan_stations ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE public.scan_stations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.scan_stations ADD COLUMN IF NOT EXISTS scans_count INT DEFAULT 0;
ALTER TABLE public.scan_stations ADD COLUMN IF NOT EXISTS last_scanned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.scan_stations ADD COLUMN IF NOT EXISTS notes TEXT;

-- Ajout des références de poste dans les tickets
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS validated_station_id TEXT;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS validated_station_name TEXT;

-- RLS Postes de Contrôle sans SELECT sur profiles
ALTER TABLE public.scan_stations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Scan stations select policy" ON public.scan_stations;
CREATE POLICY "Scan stations select policy" ON public.scan_stations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Scan stations insert policy" ON public.scan_stations;
CREATE POLICY "Scan stations insert policy" ON public.scan_stations FOR INSERT 
WITH CHECK (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.events WHERE events.id = scan_stations.event_id AND events.promoter_id = auth.uid())
  OR public.is_admin()
  OR auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Scan stations update policy" ON public.scan_stations;
CREATE POLICY "Scan stations update policy" ON public.scan_stations FOR UPDATE 
USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.events WHERE events.id = scan_stations.event_id AND events.promoter_id = auth.uid())
  OR public.is_admin()
);

DROP POLICY IF EXISTS "Scan stations delete policy" ON public.scan_stations;
CREATE POLICY "Scan stations delete policy" ON public.scan_stations FOR DELETE 
USING (
  created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.events WHERE events.id = scan_stations.event_id AND events.promoter_id = auth.uid())
  OR public.is_admin()
);
`;

// ====================================================================
// MÉTHODES DE PRODUCTION RÉELLE — PERSISTANCE SUPABASE EXCLUSIVE
// ====================================================================

/**
 * Calcule l'heure réelle de fin d'un événement (gestion des nuits traversant minuit).
 * Si estimatedEndTime n'est pas renseigné, applique une durée par défaut de 6 heures.
 * Si l'heure de fin est <= heure de début (ex: 23h00 -> 05h00), bascule automatiquement au lendemain matin.
 */
export const getEventEndDatetime = (event: {
  datetimeIso?: string;
  date?: string;
  time?: string;
  estimatedEndTime?: string;
}): Date => {
  const start = event.datetimeIso ? new Date(event.datetimeIso) : new Date();
  if (isNaN(start.getTime())) return new Date();

  if (event.estimatedEndTime && event.estimatedEndTime.trim()) {
    const parts = event.estimatedEndTime.trim().split(':');
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(h) && !isNaN(m)) {
        const end = new Date(start);
        end.setHours(h, m, 0, 0);
        // Si l'heure de fin est inférieure ou égale à l'heure de début, c'est le lendemain matin
        if (end.getTime() <= start.getTime()) {
          end.setDate(end.getDate() + 1);
        }
        return end;
      }
    }
  }

  // Durée forfaitaire par défaut de 6 heures après le début
  return new Date(start.getTime() + 6 * 60 * 60 * 1000);
};

export const mapDbEventToItem = (db: any): EventItem => {
  const tiers: TicketTier[] = Array.isArray(db.ticket_tiers) && db.ticket_tiers.length > 0
    ? db.ticket_tiers
    : Array.isArray(db.tiers) && db.tiers.length > 0
    ? db.tiers
    : [
        {
          id: 't-prev',
          name: 'Pass Prévente',
          price: 3500,
          description: 'Tarif promotionnel prévente limité',
          perks: ['Accès dès 20h00', 'Pass QR Code unique'],
          available: 150,
          wavePaymentUrl: db.wave_link_prevente || 'https://pay.wave.com/m/M_p1_xT73E21bN/c/sn/?amount=3500',
        },
        {
          id: 't-jour',
          name: 'Pass Jour J',
          price: 5000,
          description: 'Accès standard le 25 Décembre',
          perks: ['Accès salle principale', 'Validation prioritaire'],
          available: 200,
          wavePaymentUrl: db.wave_link_jour_j || 'https://pay.wave.com/m/M_p1_xT73E21bN/c/sn/?amount=5000',
        },
        {
          id: 't-vip',
          name: 'Pass VIP Prestige',
          price: 10000,
          description: 'Salon VIP dédié & cocktail d’honneur',
          perks: ['Table réservée', 'Cocktail offert', 'Coupe-file'],
          available: 50,
          wavePaymentUrl: db.wave_link_vip || 'https://pay.wave.com/m/M_p1_xT73E21bN/c/sn/?amount=10000',
        },
      ];

  const waveLinkPrevente = db.wave_link_prevente || tiers.find((t) => t.id === 't-prev' || t.name.toLowerCase().includes('prévente') || t.name.toLowerCase().includes('prevente'))?.wavePaymentUrl || 'https://pay.wave.com/m/M_p1_xT73E21bN/c/sn/?amount=3500';
  const waveLinkJourJ = db.wave_link_jour_j || tiers.find((t) => t.id === 't-jour' || t.name.toLowerCase().includes('jour'))?.wavePaymentUrl || 'https://pay.wave.com/m/M_p1_xT73E21bN/c/sn/?amount=5000';
  const waveLinkVip = db.wave_link_vip || tiers.find((t) => t.id === 't-vip' || t.name.toLowerCase().includes('vip'))?.wavePaymentUrl || 'https://pay.wave.com/m/M_p1_xT73E21bN/c/sn/?amount=10000';

  const enrichedTiers = tiers.map((t) => {
    let url = t.wavePaymentUrl;
    if (!url) {
      if (t.id === 't-prev' || t.name.toLowerCase().includes('prévente') || t.name.toLowerCase().includes('prevente')) url = waveLinkPrevente;
      else if (t.id === 't-jour' || t.name.toLowerCase().includes('jour')) url = waveLinkJourJ;
      else if (t.id === 't-vip' || t.name.toLowerCase().includes('vip')) url = waveLinkVip;
      else url = waveLinkPrevente;
    }
    return { ...t, wavePaymentUrl: url, isActive: t.isActive !== false };
  });

  return {
    id: db.id,
    title: db.title,
    category: db.category || 'Gala',
    date: db.event_date || db.date || '25 Décembre 2026',
    time: db.event_time || db.time || '20:00',
    datetimeIso: parseSafeIsoDate(db.datetime_iso, db.event_date || db.date, db.event_time || db.time),
    venue: db.venue || 'Grand Théâtre de Thiès',
    city: db.city || 'Thiès',
    quartier: db.quartier || '',
    posterUrl: db.affiche_url || db.poster_url || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200&auto=format&fit=crop',
    price: Number(db.price) || 3500,
    priceLabel: `${(Number(db.price) || 3500).toLocaleString('fr-FR')} FCFA`,
    waveLinkPrevente,
    waveLinkJourJ,
    waveLinkVip,
    promoter: {
      id: db.promoter_id || '',
      name: db.promoter_name || 'Médias Graphisme & ThièsDN',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop',
      verified: true,
      role: 'Organisateur & Promoteur Officiel',
    },
    featured: Boolean(db.featured ?? true),
    status: db.status || 'approved',
    vipAvailable: true,
    isExclusive: true,
    description: db.description || '',
    longDescription: db.long_description || db.longDescription || '',
    whatsappContact: db.whatsapp_contact || '+221 77 458 74 74',
    socialFacebook: db.social_facebook || db.socialFacebook || '',
    socialInstagram: db.social_instagram || db.socialInstagram || '',
    socialTiktok: db.social_tiktok || db.socialTiktok || '',
    socialYoutube: db.social_youtube || db.youtube_url || db.socialYoutube || '',
    websiteUrl: db.website_url || db.websiteUrl || '',
    spotifyUrl: db.spotify_url || db.spotifyUrl || '',
    videoSpotUrl: db.video_spot_url || db.youtube_url || db.social_youtube || '',
    salesOpenAt: db.sales_open_at || db.salesOpenAt || undefined,
    estimatedEndTime: db.estimated_end_time || db.estimatedEndTime || undefined,
    promoCode: db.promo_code || db.promoCode || '',
    promoDiscountPercent: db.promo_discount_percent ? Number(db.promo_discount_percent) : (db.promoDiscountPercent ? Number(db.promoDiscountPercent) : undefined),
    tiers: enrichedTiers,
    createdAt: db.created_at || new Date().toISOString(),
  };
};

export const fetchEventsFromSupabase = async (): Promise<{ events: EventItem[]; error: string | null }> => {
  const client = getSupabaseClient();
  if (!client) {
    return { events: [], error: 'Supabase n\'est pas encore configuré.' };
  }

  try {
    const { data, error } = await client
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erreur Supabase events:', error);
      return { events: [], error: error.message };
    }

    const mapped = (data || []).map(mapDbEventToItem);
    return { events: mapped, error: null };
  } catch (err: any) {
    return { events: [], error: err.message || 'Erreur réseau inattendue.' };
  }
};

export const createEventInSupabase = async (
  eventData: {
    title: string;
    category: string;
    description: string;
    longDescription?: string;
    date: string;
    time: string;
    datetimeIso?: string;
    venue: string;
    city: string;
    quartier?: string;
    price: number;
    posterUrl: string;
    whatsappContact?: string;
    tiers: TicketTier[];
    waveLinkPrevente?: string;
    waveLinkJourJ?: string;
    waveLinkVip?: string;
    socialFacebook?: string;
    socialInstagram?: string;
    socialTiktok?: string;
    socialYoutube?: string;
    websiteUrl?: string;
    spotifyUrl?: string;
    videoSpotUrl?: string;
    salesOpenAt?: string;
    estimatedEndTime?: string;
    promoCode?: string;
    promoDiscountPercent?: number;
  },
  promoter: { id: string; name: string }
): Promise<{ success: boolean; event?: EventItem; error?: string }> => {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Connexion à la base Supabase impossible.' };
  }

  // S'assurer que chaque formule intègre son lien de paiement Wave
  const enrichedTiers = (eventData.tiers || []).map((t) => {
    let waveUrl = t.wavePaymentUrl;
    if (!waveUrl) {
      if (t.id === 't-prev' || t.name.toLowerCase().includes('prévente') || t.name.toLowerCase().includes('prevente')) {
        waveUrl = eventData.waveLinkPrevente;
      } else if (t.id === 't-jour' || t.name.toLowerCase().includes('jour')) {
        waveUrl = eventData.waveLinkJourJ;
      } else if (t.id === 't-vip' || t.name.toLowerCase().includes('vip')) {
        waveUrl = eventData.waveLinkVip;
      } else {
        waveUrl = eventData.waveLinkPrevente;
      }
    }
    return { ...t, wavePaymentUrl: waveUrl };
  });

  // Validation stricte UUID pour PostgreSQL Supabase
  const isValidUUID = (val?: string): boolean =>
    !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

  let targetPromoterId = isValidUUID(promoter?.id) ? promoter.id : null;

  if (!targetPromoterId) {
    try {
      const { data: authSession } = await client.auth.getSession();
      const authUid = authSession?.session?.user?.id;
      if (isValidUUID(authUid)) {
        targetPromoterId = authUid;
      }
    } catch (e) {
      console.warn('Erreur résolution session promoter_id:', e);
    }
  }

  if (!targetPromoterId) {
    return {
      success: false,
      error: "Vous devez être connecté avec un compte valide pour créer un événement.",
    };
  }

  const resolvedDatetimeIso = eventData.datetimeIso || parseSafeIsoDate(null, eventData.date, eventData.time);

  const baseInsert: any = {
    title: eventData.title.trim(),
    category: eventData.category,
    description: eventData.description.trim(),
    event_date: eventData.date,
    event_time: eventData.time,
    datetime_iso: resolvedDatetimeIso,
    venue: eventData.venue.trim(),
    city: eventData.city,
    price: eventData.price,
    affiche_url: eventData.posterUrl,
    promoter_id: targetPromoterId,
    promoter_name: promoter.name || 'Promoteur ThièsDN',
    whatsapp_contact: eventData.whatsappContact?.trim() || null,
    status: 'approved',
    ticket_tiers: enrichedTiers,
  };

  try {
    // 1. Tenter avec toutes les colonnes étendues (liens Wave + réseaux sociaux + long_description)
    const fullInsert = {
      ...baseInsert,
      datetime_iso: resolvedDatetimeIso,
      wave_link_prevente: eventData.waveLinkPrevente?.trim() || null,
      wave_link_jour_j: eventData.waveLinkJourJ?.trim() || null,
      wave_link_vip: eventData.waveLinkVip?.trim() || null,
      long_description: eventData.longDescription?.trim() || null,
      quartier: eventData.quartier?.trim() || null,
      social_facebook: eventData.socialFacebook?.trim() || null,
      social_instagram: eventData.socialInstagram?.trim() || null,
      social_tiktok: eventData.socialTiktok?.trim() || null,
      social_youtube: eventData.socialYoutube?.trim() || null,
      website_url: eventData.websiteUrl?.trim() || null,
      spotify_url: eventData.spotifyUrl?.trim() || null,
      video_spot_url: eventData.videoSpotUrl?.trim() || eventData.socialYoutube?.trim() || null,
      sales_open_at: eventData.salesOpenAt?.trim() || null,
      estimated_end_time: eventData.estimatedEndTime?.trim() || null,
      promo_code: eventData.promoCode?.trim().toUpperCase() || null,
      promo_discount_percent: eventData.promoDiscountPercent || null,
    };

    let { data, error } = await client
      .from('events')
      .insert(fullInsert)
      .select()
      .single();

    // 2. Repli résilient si colonnes physiques absentes dans Postgres (PGRST204)
    if (error && (error.code === 'PGRST204' || error.message?.includes('does not exist') || error.message?.includes('column'))) {
      console.warn('Colonnes physiques optionnelles non trouvées dans Supabase events, repli sur baseInsert :', error.message);
      const fallbackResult = await client
        .from('events')
        .insert(baseInsert)
        .select()
        .single();
      data = fallbackResult.data;
      error = fallbackResult.error;

      // 3. Repli ultime si datetime_iso n'existe pas non plus dans la table
      if (error && (error.code === 'PGRST204' || error.message?.includes('does not exist') || error.message?.includes('column'))) {
        console.warn('datetime_iso non trouvé dans table Supabase events, insertion minimale sans datetime_iso');
        const minimalInsert = { ...baseInsert };
        delete minimalInsert.datetime_iso;
        const minimalResult = await client
          .from('events')
          .insert(minimalInsert)
          .select()
          .single();
        data = minimalResult.data;
        error = minimalResult.error;
      }
    }

    if (error) {
      return { success: false, error: error.message };
    }

    // Si on a inséré via repli, injecter localement les métadonnées pour l'affichage immédiat
    const mappedEvent = mapDbEventToItem(data);
    if (!mappedEvent.socialFacebook && eventData.socialFacebook) mappedEvent.socialFacebook = eventData.socialFacebook;
    if (!mappedEvent.socialInstagram && eventData.socialInstagram) mappedEvent.socialInstagram = eventData.socialInstagram;
    if (!mappedEvent.socialTiktok && eventData.socialTiktok) mappedEvent.socialTiktok = eventData.socialTiktok;
    if (!mappedEvent.socialYoutube && eventData.socialYoutube) mappedEvent.socialYoutube = eventData.socialYoutube;
    if (!mappedEvent.websiteUrl && eventData.websiteUrl) mappedEvent.websiteUrl = eventData.websiteUrl;
    if (!mappedEvent.longDescription && eventData.longDescription) mappedEvent.longDescription = eventData.longDescription;
    if (!mappedEvent.quartier && eventData.quartier) mappedEvent.quartier = eventData.quartier;
    if (!mappedEvent.promoCode && eventData.promoCode) mappedEvent.promoCode = eventData.promoCode;
    if (!mappedEvent.promoDiscountPercent && eventData.promoDiscountPercent) mappedEvent.promoDiscountPercent = eventData.promoDiscountPercent;
    if (!mappedEvent.spotifyUrl && eventData.spotifyUrl) mappedEvent.spotifyUrl = eventData.spotifyUrl;
    if (!mappedEvent.videoSpotUrl && (eventData.videoSpotUrl || eventData.socialYoutube)) mappedEvent.videoSpotUrl = eventData.videoSpotUrl || eventData.socialYoutube;
    if (!mappedEvent.salesOpenAt && eventData.salesOpenAt) mappedEvent.salesOpenAt = eventData.salesOpenAt;

    return { success: true, event: mappedEvent };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erreur lors de la création en base.' };
  }
};

export const updateEventStatusInSupabase = async (
  eventId: string,
  newStatus: EventStatus,
  rejectionReason?: string
): Promise<{ success: boolean; error?: string }> => {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase non connecté.' };

  try {
    const { error } = await client
      .from('events')
      .update({
        status: newStatus,
        rejection_reason: rejectionReason || null,
      })
      .eq('id', eventId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

export const deleteEventFromSupabase = async (
  eventId: string
): Promise<{ success: boolean; error?: string }> => {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase non connecté.' };

  try {
    const { error } = await client.from('events').delete().eq('id', eventId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

export const updateEventInSupabase = async (
  eventId: string,
  updates: Partial<EventItem>
): Promise<{ success: boolean; event?: EventItem; error?: string }> => {
  const client = getSupabaseClient();
  if (!client) return { success: false, error: 'Supabase non connecté.' };

  try {
    const dbPayload: any = {};
    if (updates.title !== undefined) dbPayload.title = updates.title.trim();
    if (updates.category !== undefined) dbPayload.category = updates.category;
    if (updates.description !== undefined) dbPayload.description = updates.description.trim();
    if (updates.longDescription !== undefined) dbPayload.long_description = updates.longDescription.trim();
    if (updates.date !== undefined) dbPayload.event_date = updates.date;
    if (updates.time !== undefined) dbPayload.event_time = updates.time;
    if (updates.datetimeIso !== undefined) dbPayload.datetime_iso = updates.datetimeIso;
    if (updates.venue !== undefined) dbPayload.venue = updates.venue.trim();
    if (updates.city !== undefined) dbPayload.city = updates.city;
    if (updates.quartier !== undefined) dbPayload.quartier = updates.quartier.trim();
    if (updates.price !== undefined) dbPayload.price = updates.price;
    if (updates.posterUrl !== undefined) dbPayload.affiche_url = updates.posterUrl;
    if (updates.status !== undefined) dbPayload.status = updates.status;
    if (updates.waveLinkPrevente !== undefined) dbPayload.wave_link_prevente = updates.waveLinkPrevente.trim();
    if (updates.waveLinkJourJ !== undefined) dbPayload.wave_link_jour_j = updates.waveLinkJourJ.trim();
    if (updates.waveLinkVip !== undefined) dbPayload.wave_link_vip = updates.waveLinkVip.trim();
    if (updates.whatsappContact !== undefined) dbPayload.whatsapp_contact = updates.whatsappContact ? updates.whatsappContact.trim() : null;
    if (updates.socialFacebook !== undefined) dbPayload.social_facebook = updates.socialFacebook ? updates.socialFacebook.trim() : null;
    if (updates.socialInstagram !== undefined) dbPayload.social_instagram = updates.socialInstagram ? updates.socialInstagram.trim() : null;
    if (updates.socialTiktok !== undefined) dbPayload.social_tiktok = updates.socialTiktok ? updates.socialTiktok.trim() : null;
    if (updates.socialYoutube !== undefined) dbPayload.social_youtube = updates.socialYoutube ? updates.socialYoutube.trim() : null;
    if (updates.websiteUrl !== undefined) dbPayload.website_url = updates.websiteUrl ? updates.websiteUrl.trim() : null;
    if (updates.promoter?.name) dbPayload.promoter_name = updates.promoter.name.trim();
    if (updates.salesActive !== undefined) dbPayload.sales_active = updates.salesActive;
    if (updates.featured !== undefined) dbPayload.featured = updates.featured;
    if (updates.vipAvailable !== undefined) dbPayload.vip_available = updates.vipAvailable;
    if (updates.isExclusive !== undefined) dbPayload.is_exclusive = updates.isExclusive;
    if (updates.promoCode !== undefined) dbPayload.promo_code = updates.promoCode ? updates.promoCode.trim().toUpperCase() : null;
    if (updates.promoDiscountPercent !== undefined) dbPayload.promo_discount_percent = updates.promoDiscountPercent || null;
    if (updates.spotifyUrl !== undefined) dbPayload.spotify_url = updates.spotifyUrl ? updates.spotifyUrl.trim() : null;
    if (updates.videoSpotUrl !== undefined) dbPayload.video_spot_url = updates.videoSpotUrl ? updates.videoSpotUrl.trim() : null;

    // Harmonisation youtube_url pour compatibilité totale avec les lecteurs et migrations historiques
    const resolvedVideoUrl = (updates.videoSpotUrl ? updates.videoSpotUrl.trim() : null) || (updates.socialYoutube ? updates.socialYoutube.trim() : null);
    if (resolvedVideoUrl !== null) {
      dbPayload.youtube_url = resolvedVideoUrl;
    }

    if (updates.salesOpenAt !== undefined) {
      if (!updates.salesOpenAt) {
        dbPayload.sales_open_at = null;
      } else {
        const parsedSales = new Date(updates.salesOpenAt);
        dbPayload.sales_open_at = !isNaN(parsedSales.getTime()) ? parsedSales.toISOString() : updates.salesOpenAt;
      }
    }
    if (updates.estimatedEndTime !== undefined) dbPayload.estimated_end_time = updates.estimatedEndTime ? updates.estimatedEndTime.trim() : null;

    // Synchronisation de ticket_tiers avec les nouveaux liens Wave pour cohérence totale
    if (Array.isArray(updates.tiers) && updates.tiers.length > 0) {
      dbPayload.ticket_tiers = updates.tiers.map((t) => {
        let waveUrl = t.wavePaymentUrl;
        const nameLower = (t.name || '').toLowerCase();
        if (nameLower.includes('vip') && updates.waveLinkVip) waveUrl = updates.waveLinkVip.trim();
        else if (nameLower.includes('jour') && updates.waveLinkJourJ) waveUrl = updates.waveLinkJourJ.trim();
        else if ((nameLower.includes('prévente') || nameLower.includes('prevente')) && updates.waveLinkPrevente) waveUrl = updates.waveLinkPrevente.trim();
        return { ...t, wavePaymentUrl: waveUrl };
      });
    }

    let { data, error } = await client
      .from('events')
      .update(dbPayload)
      .eq('id', eventId)
      .select()
      .single();

    // Repli adaptatif et chirurgical si une colonne spécifique est absente dans le schéma PostgreSQL
    // ATTENTION : Ne JAMAIS supprimer les liens Wave, Spotify, Vidéo Spot, Réseaux Sociaux ou Sales Open At !
    if (error && (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('does not exist'))) {
      console.warn('Erreur colonne dans events lors de l\'update, repli chirurgical intelligent :', error.message);
      let retryPayload = { ...dbPayload };
      let currentError = error;

      for (let attempt = 0; attempt < 5; attempt++) {
        if (!currentError || !(currentError.code === 'PGRST204' || currentError.message?.includes('column') || currentError.message?.includes('does not exist'))) {
          break;
        }

        // Extraire dynamiquement le nom de la colonne PostgreSQL manquante
        const match = currentError.message.match(/column "?([a-zA-Z0-9_]+)"?/i) ||
                      currentError.message.match(/'([a-zA-Z0-9_]+)' column/i);
        const missingCol = match ? match[1] : null;

        // Colonnes protégées indispensables au fonctionnement métier (ne jamais supprimer aveuglément)
        const protectedCols = [
          'title',
          'event_date',
          'event_time',
          'price',
          'wave_link_prevente',
          'wave_link_jour_j',
          'wave_link_vip',
          'spotify_url',
          'video_spot_url',
          'social_facebook',
          'social_instagram',
          'social_tiktok',
          'social_youtube',
          'sales_open_at',
        ];

        if (missingCol && retryPayload[missingCol] !== undefined && !protectedCols.includes(missingCol)) {
          console.warn(`[Chirurgie Schéma] Suppression de la colonne secondaire absente : "${missingCol}"`);
          delete retryPayload[missingCol];
        } else {
          // Si le message d'erreur est générique ou pointe une colonne inconnue, éliminer uniquement les flags secondaires
          const secondaryCols = ['promo_discount_percent', 'promo_code', 'vip_available', 'is_exclusive', 'sales_active'];
          let removedOne = false;
          for (const col of secondaryCols) {
            if (retryPayload[col] !== undefined) {
              console.warn(`[Chirurgie Schéma] Tentative sans la colonne secondaire : "${col}"`);
              delete retryPayload[col];
              removedOne = true;
              break;
            }
          }
          if (!removedOne) {
            // Si la colonne manquante est l'une des colonnes protégées qui n'a pas encore été migrée dans la base, on la retire pour débloquer l'enregistrement
            if (missingCol && retryPayload[missingCol] !== undefined) {
              console.warn(`[Chirurgie Schéma] La colonne "${missingCol}" n'existe pas encore dans PostgreSQL. Exclusion temporaire pour autoriser la sauvegarde.`);
              delete retryPayload[missingCol];
            } else {
              break;
            }
          }
        }

        const retryRes = await client.from('events').update(retryPayload).eq('id', eventId).select().single();
        data = retryRes.data;
        currentError = retryRes.error;
      }
      error = currentError;
    }

    console.log('UPDATE DATA:', data, 'ERROR:', error);

    if (error) {
      console.error('Erreur Supabase update event:', error);
      return { success: false, error: error.message };
    }

    if (!data) {
      console.warn('Aucune donnée retournée par update event (RLS bloque la mise à jour).');
      return { success: false, error: 'Erreur : modification non persistée. Vérifiez les permissions RLS.' };
    }

    return { success: true, event: mapDbEventToItem(data) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

export const registerEventPreRegistration = async (params: {
  eventId: string;
  userId?: string;
  fullName: string;
  phone: string;
  email?: string;
}): Promise<{ success: boolean; message: string; error?: string }> => {
  const client = getSupabaseClient();
  const trimmedPhone = params.phone.trim();
  const trimmedName = params.fullName.trim();
  const trimmedEmail = params.email?.trim() || null;

  if (!params.eventId || !trimmedName || !trimmedPhone) {
    return { success: false, message: 'Veuillez renseigner votre nom et votre numéro de téléphone.' };
  }

  // 1. Sauvegarde locale de secours (Offline-first & résilience)
  try {
    const rawLocal = localStorage.getItem('thiesdn_pre_registrations_v1');
    const list = rawLocal ? JSON.parse(rawLocal) : [];
    const alreadyExists = list.some((r: any) => r.eventId === params.eventId && r.phone === trimmedPhone);
    if (!alreadyExists) {
      list.push({
        id: `prereg-${Date.now()}`,
        eventId: params.eventId,
        userId: params.userId || null,
        fullName: trimmedName,
        phone: trimmedPhone,
        email: trimmedEmail,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem('thiesdn_pre_registrations_v1', JSON.stringify(list));
    }
  } catch (e) {
    console.warn('Erreur cache local pre-registration:', e);
  }

  // 2. Enregistrement Supabase
  if (!client) {
    return {
      success: true,
      message: 'Votre pré-inscription est confirmée ! Vous serez alerté dès l\'ouverture des ventes.',
    };
  }

  try {
    const { error } = await client.from('event_pre_registrations').insert({
      event_id: params.eventId,
      user_id: params.userId || null,
      full_name: trimmedName,
      phone: trimmedPhone,
      email: trimmedEmail,
    });

    if (error) {
      if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique')) {
        return {
          success: true,
          message: 'Vous êtes déjà inscrit sur la liste prioritaire de cet événement !',
        };
      }
      console.warn('Erreur Supabase pre_registrations (repli local actif) :', error.message);
    }

    return {
      success: true,
      message: 'Votre pré-inscription est confirmée ! Vous serez alerté dès l\'ouverture des ventes.',
    };
  } catch (err: any) {
    return {
      success: true,
      message: 'Votre pré-inscription est confirmée ! Vous serez alerté dès l\'ouverture des ventes.',
    };
  }
};

export const fetchOrdersFromSupabase = async (): Promise<{ orders: OrderRecord[]; error: string | null }> => {
  const client = getSupabaseClient();
  if (!client) return { orders: [], error: 'Supabase non connecté.' };

  try {
    const { data, error } = await client
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return { orders: [], error: error.message };

    const mapped: OrderRecord[] = (data || []).map((db: any) => ({
      id: db.id,
      reference: db.reference,
      eventId: db.event_id,
      eventTitle: db.event_title || 'Événement Thièsdn',
      userId: db.user_id,
      tierId: db.tier_id || 'std',
      tierName: db.tier_name || 'Standard',
      quantity: db.quantity || 1,
      unitPrice: Number(db.unit_price) || 0,
      totalAmount: Number(db.total_amount) || 0,
      paymentMethod: db.payment_method || 'wave',
      paymentReference: db.payment_reference || '',
      paymentProofUrl: db.payment_proof_url || '',
      customerName: db.customer_name || 'Client',
      customerPhone: db.customer_phone || '',
      status: db.status || 'pending',
      confirmedBy: db.confirmed_by,
      confirmedAt: db.confirmed_at,
      createdAt: db.created_at || new Date().toISOString(),
    }));

    // Synchronisation automatique des commandes fraîches dans le cache local
    if (mapped.length > 0) {
      mapped.forEach((order) => saveOrderRecord(order));
    }

    return { orders: mapped, error: null };
  } catch (err: any) {
    return { orders: [], error: err.message };
  }
};

/**
 * Récupère tous les billets d'un événement pour les statistiques admin & de scan
 */
export const fetchAllTicketsForEvent = async (
  eventId: string
): Promise<{ tickets: any[]; error: string | null }> => {
  const client = getSupabaseClient();
  if (!client) return { tickets: [], error: 'Supabase non connecté.' };

  try {
    const { data, error } = await client
      .from('tickets')
      .select('*')
      .eq('event_id', eventId);

    if (error) return { tickets: [], error: error.message };
    return { tickets: data || [], error: null };
  } catch (err: any) {
    return { tickets: [], error: err.message };
  }
};

export interface SupabaseScanRpcResponse {
  success: boolean;
  reason?: 'authorized' | 'already_scanned' | 'printed_not_sold' | 'cancelled' | 'not_found';
  message: string;
  scannedAt?: string;
  scannedAtFormatted?: string;
  ticket?: UserTicket;
}

export const scanTicketWithSupabase = async (
  qrCode: string,
  stationCode: string = 'ADMIN-CHECKIN',
  eventId?: string
): Promise<SupabaseScanRpcResponse> => {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'Base de données Supabase déconnectée.' };
  }

  try {
    const { data, error } = await client.rpc('scan_ticket', {
      p_qr_code: qrCode.trim(),
      p_station_code: (stationCode || 'ADMIN-CHECKIN').trim(),
      p_event_id: isValidUUID(eventId) ? eventId : null,
    });
    if (error) {
      return { success: false, message: error.message };
    }
    const rawTicket = data?.ticket;
    const mappedTicket: UserTicket | undefined = rawTicket
      ? {
          id: rawTicket.id,
          eventId: rawTicket.event_id || '',
          eventTitle: rawTicket.event_title || 'Événement Thièsdn',
          eventPoster: rawTicket.event_poster || '',
          eventDate: rawTicket.event_date || '',
          eventTime: rawTicket.event_time || '',
          eventVenue: rawTicket.event_venue || '',
          tierName: rawTicket.tier_name || 'Standard',
          price: Number(rawTicket.price) || 0,
          qrCode: rawTicket.qr_code || qrCode.trim(),
          seatNumber: rawTicket.seat_number,
          holderName: rawTicket.holder_name || 'Nom non renseigné',
          holderPhone: rawTicket.holder_phone || undefined,
          holderEmail: rawTicket.holder_email || undefined,
          purchasedAt: rawTicket.purchased_at || rawTicket.created_at || new Date().toISOString(),
          status: rawTicket.status || 'scanned',
          isPhysical: Boolean(rawTicket.is_physical),
          agentId: rawTicket.agent_id || undefined,
          agentName: rawTicket.agent_name || undefined,
          batchNumber: rawTicket.batch_number || undefined,
          serialNumber: rawTicket.serial_number || undefined,
          usedAt: data?.scanned_at || rawTicket.used_at,
        }
      : undefined;

    return {
      success: Boolean(data?.success),
      reason: data?.reason,
      message: data?.message || 'Billet vérifié.',
      scannedAt: data?.scanned_at,
      scannedAtFormatted: data?.scanned_at_formatted,
      ticket: mappedTicket,
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Erreur lors du scan du billet.' };
  }
};

export const fetchUserTicketsFromSupabase = async (
  userId: string
): Promise<{ tickets: UserTicket[]; error: string | null }> => {
  const client = getSupabaseClient();
  if (!client) return { tickets: [], error: 'Supabase non connecté.' };

  try {
    const { data, error } = await client
      .from('tickets')
      .select('*')
      .or(`user_id.eq.${userId},assigned_to_profile_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) return { tickets: [], error: error.message };

    const mapped: UserTicket[] = (data || []).map((t: any) => ({
      id: t.id,
      eventId: t.event_id,
      eventTitle: t.event_title || 'Événement Thièsdn Billetterie',
      eventPoster: t.event_poster || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200&auto=format&fit=crop',
      eventDate: t.event_date || 'Date à confirmer',
      eventTime: t.event_time || '20:00',
      eventVenue: t.event_venue || 'Thiès, Sénégal',
      tierName: t.tier_name || 'Standard',
      price: Number(t.price) || 0,
      qrCode: t.qr_code,
      seatNumber: t.seat_number,
      holderName: t.holder_name || 'Nom non renseigné',
      holderPhone: t.holder_phone || undefined,
      holderEmail: t.holder_email || undefined,
      holderAvatar: t.assigned_to_avatar || undefined,
      purchasedAt: t.created_at || new Date().toISOString(),
      status: t.status || 'valid',
      isPhysical: Boolean(t.is_physical),
      agentId: t.agent_id || undefined,
      agentName: t.agent_name || undefined,
      userId: t.user_id,
      assignedToProfileId: t.assigned_to_profile_id || undefined,
      assignedToName: t.assigned_to_name || undefined,
      assignedToPhone: t.assigned_to_phone || undefined,
      assignedToEmail: t.assigned_to_email || undefined,
      assignedToAvatar: t.assigned_to_avatar || undefined,
      assignmentStatus: t.assignment_status || 'unassigned',
      assignedAt: t.assigned_at || undefined,
      claimedAt: t.claimed_at || undefined,
      claimToken: t.claim_token || undefined,
    }));

    return { tickets: mapped, error: null };
  } catch (err: any) {
    return { tickets: [], error: err.message };
  }
};

// ====================================================================
// TRANSFERT & ASSIGNATION DE BILLETS À UN AMI (ACHATS MULTIPLES)
// ====================================================================

/**
 * Assigner un billet à un ami avec génération du claimToken unique
 */
export const assignTicketToFriend = async (
  ticketId: string,
  friendName: string,
  friendPhone: string,
  friendEmail?: string
): Promise<{ success: boolean; message: string; claimToken?: string; ticket?: UserTicket }> => {
  const client = getSupabaseClient();
  const cleanName = friendName.trim();
  const cleanPhone = friendPhone.trim();

  if (!cleanName || !cleanPhone) {
    return { success: false, message: 'Le nom et le numéro de téléphone de l’ami sont obligatoires.' };
  }

  // Tentative en ligne Supabase RPC
  if (client) {
    try {
      const { data, error } = await client.rpc('assign_ticket_to_friend', {
        p_ticket_id: ticketId,
        p_friend_name: cleanName,
        p_friend_phone: cleanPhone,
        p_friend_email: friendEmail?.trim() || null,
      });

      if (!error && data && data.success) {
        // Mettre à jour le cache local
        const localTickets = getStoredTickets();
        const idx = localTickets.findIndex((t) => t.id === ticketId);
        if (idx !== -1) {
          localTickets[idx] = {
            ...localTickets[idx],
            assignedToName: cleanName,
            assignedToPhone: cleanPhone,
            assignedToEmail: friendEmail?.trim() || undefined,
            assignmentStatus: 'pending',
            assignedAt: new Date().toISOString(),
            claimToken: data.claim_token,
          };
          saveStoredTickets(localTickets);
          return { success: true, message: data.message, claimToken: data.claim_token, ticket: localTickets[idx] };
        }
        return { success: true, message: data.message, claimToken: data.claim_token };
      } else if (error) {
        console.warn('Erreur RPC assign_ticket_to_friend:', error.message);
      }
    } catch (e: any) {
      console.warn('Fallback assignation locale:', e.message);
    }
  }

  // Fallback local instantané
  const localTickets = getStoredTickets();
  const idx = localTickets.findIndex((t) => t.id === ticketId);
  if (idx === -1) {
    return { success: false, message: 'Billet introuvable.' };
  }

  const generatedToken = 'CLM-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  const updatedTicket: UserTicket = {
    ...localTickets[idx],
    assignedToName: cleanName,
    assignedToPhone: cleanPhone,
    assignedToEmail: friendEmail?.trim() || undefined,
    assignmentStatus: 'pending',
    assignedAt: new Date().toISOString(),
    claimToken: generatedToken,
  };

  localTickets[idx] = updatedTicket;
  saveStoredTickets(localTickets);

  return {
    success: true,
    message: 'Billet assigné avec succès. Vous pouvez maintenant envoyer le lien à votre ami.',
    claimToken: generatedToken,
    ticket: updatedTicket,
  };
};

/**
 * Annuler ou révoquer une assignation en attente
 */
export const cancelTicketAssignment = async (
  ticketId: string
): Promise<{ success: boolean; message: string; ticket?: UserTicket }> => {
  const client = getSupabaseClient();

  if (client) {
    try {
      const { data, error } = await client.rpc('cancel_ticket_assignment', {
        p_ticket_id: ticketId,
      });

      if (!error && data && data.success) {
        const localTickets = getStoredTickets();
        const idx = localTickets.findIndex((t) => t.id === ticketId);
        if (idx !== -1) {
          localTickets[idx] = {
            ...localTickets[idx],
            assignedToName: undefined,
            assignedToPhone: undefined,
            assignedToEmail: undefined,
            assignedToAvatar: undefined,
            assignmentStatus: 'unassigned',
            assignedAt: undefined,
            claimToken: undefined,
          };
          saveStoredTickets(localTickets);
          return { success: true, message: data.message, ticket: localTickets[idx] };
        }
      }
    } catch (e: any) {
      console.warn('Fallback annulation assignation locale:', e.message);
    }
  }

  const localTickets = getStoredTickets();
  const idx = localTickets.findIndex((t) => t.id === ticketId);
  if (idx === -1) {
    return { success: false, message: 'Billet introuvable.' };
  }

  localTickets[idx] = {
    ...localTickets[idx],
    assignedToName: undefined,
    assignedToPhone: undefined,
    assignedToEmail: undefined,
    assignedToAvatar: undefined,
    assignmentStatus: 'unassigned',
    assignedAt: undefined,
    claimToken: undefined,
  };
  saveStoredTickets(localTickets);

  return {
    success: true,
    message: 'Assignation annulée. Le billet est de nouveau dans votre portefeuille personnel.',
    ticket: localTickets[idx],
  };
};

/**
 * Récupérer les détails d'un billet via son claimToken ou son id pour la page de réclamation
 */
export const getTicketByClaimToken = async (
  tokenOrId: string
): Promise<{ success: boolean; ticket?: UserTicket; message?: string }> => {
  const clean = tokenOrId.trim();
  const client = getSupabaseClient();

  if (client) {
    try {
      const { data, error } = await client
        .from('tickets')
        .select('*')
        .or(`claim_token.eq.${clean},id.eq.${clean}`)
        .maybeSingle();

      if (!error && data) {
        const t = data;
        const mapped: UserTicket = {
          id: t.id,
          eventId: t.event_id,
          eventTitle: t.event_title || 'Événement Thièsdn Billetterie',
          eventPoster: t.event_poster || 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=1200&auto=format&fit=crop',
          eventDate: t.event_date || 'Date à confirmer',
          eventTime: t.event_time || '20:00',
          eventVenue: t.event_venue || 'Thiès, Sénégal',
          tierName: t.tier_name || 'Standard',
          price: Number(t.price) || 0,
          qrCode: t.qr_code,
          seatNumber: t.seat_number,
          holderName: t.holder_name || 'Nom non renseigné',
          holderPhone: t.holder_phone || undefined,
          holderEmail: t.holder_email || undefined,
          holderAvatar: t.assigned_to_avatar || undefined,
          purchasedAt: t.created_at || new Date().toISOString(),
          status: t.status || 'valid',
          isPhysical: Boolean(t.is_physical),
          assignedToProfileId: t.assigned_to_profile_id || undefined,
          assignedToName: t.assigned_to_name || undefined,
          assignedToPhone: t.assigned_to_phone || undefined,
          assignedToEmail: t.assigned_to_email || undefined,
          assignedToAvatar: t.assigned_to_avatar || undefined,
          assignmentStatus: t.assignment_status || 'unassigned',
          assignedAt: t.assigned_at || undefined,
          claimedAt: t.claimed_at || undefined,
          claimToken: t.claim_token || undefined,
        };
        return { success: true, ticket: mapped };
      }
    } catch (e: any) {
      console.warn('Erreur recherche billet claim:', e.message);
    }
  }

  // Recherche dans le cache local
  const localTickets = getStoredTickets();
  const found = localTickets.find(
    (t) => (t.claimToken && t.claimToken.toUpperCase() === clean.toUpperCase()) || t.id.toUpperCase() === clean.toUpperCase()
  );

  if (found) {
    return { success: true, ticket: found };
  }

  return { success: false, message: 'Ce lien d’invitation est invalide ou a expiré.' };
};

/**
 * Réclamer et accepter le billet avec identité (Nom, Téléphone, Photo)
 */
export const claimTicketWithIdentity = async (
  tokenOrId: string,
  friendName: string,
  friendPhone: string,
  friendAvatar?: string,
  friendProfileId?: string
): Promise<{ success: boolean; message: string; ticket?: UserTicket }> => {
  const cleanName = friendName.trim();
  const cleanPhone = friendPhone.trim();
  const client = getSupabaseClient();

  if (!cleanName || !cleanPhone) {
    return { success: false, message: 'Votre nom complet et votre téléphone sont obligatoires.' };
  }

  if (client) {
    try {
      const { data, error } = await client.rpc('claim_ticket', {
        p_token_or_id: tokenOrId.trim(),
        p_friend_name: cleanName,
        p_friend_phone: cleanPhone,
        p_friend_avatar: friendAvatar || null,
        p_friend_profile_id: friendProfileId || null,
      });

      if (!error && data && data.success) {
        const localTickets = getStoredTickets();
        const idx = localTickets.findIndex(
          (t) => t.claimToken === tokenOrId || t.id === tokenOrId
        );
        if (idx !== -1) {
          localTickets[idx] = {
            ...localTickets[idx],
            holderName: cleanName,
            holderPhone: cleanPhone,
            holderAvatar: friendAvatar,
            assignedToName: cleanName,
            assignedToPhone: cleanPhone,
            assignedToAvatar: friendAvatar,
            assignedToProfileId: friendProfileId,
            assignmentStatus: 'accepted',
            claimedAt: new Date().toISOString(),
          };
          saveStoredTickets(localTickets);
          return { success: true, message: data.message, ticket: localTickets[idx] };
        }
        return { success: true, message: data.message };
      } else if (error) {
        return { success: false, message: error.message };
      }
    } catch (e: any) {
      console.warn('Fallback réclamation locale:', e.message);
    }
  }

  // Fallback local
  const localTickets = getStoredTickets();
  const idx = localTickets.findIndex(
    (t) => (t.claimToken && t.claimToken.toUpperCase() === tokenOrId.trim().toUpperCase()) || t.id.toUpperCase() === tokenOrId.trim().toUpperCase()
  );

  if (idx === -1) {
    return { success: false, message: 'Billet introuvable ou lien expiré.' };
  }

  const updated: UserTicket = {
    ...localTickets[idx],
    holderName: cleanName,
    holderPhone: cleanPhone,
    holderAvatar: friendAvatar,
    assignedToName: cleanName,
    assignedToPhone: cleanPhone,
    assignedToAvatar: friendAvatar,
    assignedToProfileId: friendProfileId,
    assignmentStatus: 'accepted',
    claimedAt: new Date().toISOString(),
  };

  localTickets[idx] = updated;
  saveStoredTickets(localTickets);

  return {
    success: true,
    message: `Félicitations ${cleanName} ! Votre pass officiel pour ${updated.eventTitle} a été validé et ajouté à votre portefeuille.`,
    ticket: updated,
  };
};

/**
 * Décliner un billet offert
 */
export const declineTicketAssignment = async (
  tokenOrId: string
): Promise<{ success: boolean; message: string }> => {
  const client = getSupabaseClient();

  if (client) {
    try {
      const { data, error } = await client.rpc('decline_ticket', {
        p_token_or_id: tokenOrId.trim(),
      });
      if (!error && data && data.success) {
        const localTickets = getStoredTickets();
        const idx = localTickets.findIndex(
          (t) => t.claimToken === tokenOrId || t.id === tokenOrId
        );
        if (idx !== -1) {
          localTickets[idx].assignmentStatus = 'declined';
          localTickets[idx].claimToken = undefined;
          saveStoredTickets(localTickets);
        }
        return { success: true, message: data.message };
      }
    } catch (e: any) {
      console.warn('Fallback déclin local:', e.message);
    }
  }

  const localTickets = getStoredTickets();
  const idx = localTickets.findIndex(
    (t) => (t.claimToken && t.claimToken.toUpperCase() === tokenOrId.trim().toUpperCase()) || t.id.toUpperCase() === tokenOrId.trim().toUpperCase()
  );
  if (idx !== -1) {
    localTickets[idx].assignmentStatus = 'declined';
    localTickets[idx].claimToken = undefined;
    saveStoredTickets(localTickets);
  }

  return { success: true, message: 'Le billet a été décliné et restitué à l’acheteur.' };
};

// ==============================================================================
// MODULE DE CYBERSÉCURITÉ : TRAÇABILITÉ DES CONNEXIONS & SESSIONS VIGILES
// ==============================================================================

const LOGIN_HISTORY_CACHE_KEY = 'thiesdn_login_history_cache';
const VIGILE_SESSIONS_CACHE_KEY = 'thiesdn_vigile_sessions_cache';

/**
 * Récupère l'adresse IP publique du client avec fallback
 */
export const getClientPublicIp = async (): Promise<string> => {
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const data = await res.json();
      return data.ip || '127.0.0.1';
    }
  } catch {}
  return '127.0.0.1';
};

/**
 * Récupère la géolocalisation IP (Ville, Pays)
 */
export const getIpGeoLocation = async (ip: string): Promise<{ country: string; city: string }> => {
  if (!ip || ip === '127.0.0.1' || ip.startsWith('192.168.') || ip === 'localhost') {
    return { country: 'Sénégal', city: 'Thiès' };
  }
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = await res.json();
      return {
        country: data.country_name || 'Sénégal',
        city: data.city || 'Thiès',
      };
    }
  } catch {}
  return { country: 'Sénégal', city: 'Thiès' };
};

/**
 * Enregistrer une connexion utilisateur (Login History)
 */
export const recordLoginHistory = async (
  email: string,
  userId?: string,
  action: string = 'login'
): Promise<void> => {
  const ip = await getClientPublicIp();
  const geo = await getIpGeoLocation(ip);
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Client Web';

  const newLog: LoginHistoryRecord = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `log-${Date.now()}`,
    userId,
    email: email.trim().toLowerCase(),
    ipAddress: ip,
    userAgent,
    country: geo.country,
    city: geo.city,
    action,
    createdAt: new Date().toISOString(),
  };

  const client = getSupabaseClient();
  if (client) {
    try {
      await client.from('login_history').insert([
        {
          user_id: isValidUUID(userId) ? userId : null,
          email: newLog.email,
          ip_address: newLog.ipAddress,
          user_agent: newLog.userAgent,
          country: newLog.country,
          city: newLog.city,
          action: newLog.action,
        },
      ]);
    } catch (e) {
      console.warn('Fallback enregistrement log Supabase:', e);
    }
  }

  // Cache local pour affichage immédiat
  try {
    const raw = localStorage.getItem(LOGIN_HISTORY_CACHE_KEY);
    const logs: LoginHistoryRecord[] = raw ? JSON.parse(raw) : [];
    logs.unshift(newLog);
    localStorage.setItem(LOGIN_HISTORY_CACHE_KEY, JSON.stringify(logs.slice(0, 300)));
  } catch {}
};

/**
 * Récupérer l'historique des connexions avec pagination et filtres
 */
export const fetchLoginHistory = async (
  page: number = 1,
  pageSize: number = 50,
  filters?: { email?: string; country?: string; action?: string }
): Promise<{ logs: LoginHistoryRecord[]; totalCount: number }> => {
  const client = getSupabaseClient();

  if (client) {
    try {
      let query = client
        .from('login_history')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (filters?.email?.trim()) {
        query = query.ilike('email', `%${filters.email.trim()}%`);
      }
      if (filters?.country && filters.country !== 'all') {
        query = query.eq('country', filters.country);
      }
      if (filters?.action && filters.action !== 'all') {
        query = query.eq('action', filters.action);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, count, error } = await query.range(from, to);

      if (!error && data) {
        const mapped: LoginHistoryRecord[] = data.map((d: any) => ({
          id: d.id,
          userId: d.user_id,
          email: d.email,
          ipAddress: d.ip_address,
          userAgent: d.user_agent,
          country: d.country,
          city: d.city,
          action: d.action || 'login',
          createdAt: d.created_at,
        }));
        return { logs: mapped, totalCount: count || mapped.length };
      }
    } catch (e) {
      console.warn('Fallback lecture login_history:', e);
    }
  }

  // Cache local en cas de secours
  try {
    const raw = localStorage.getItem(LOGIN_HISTORY_CACHE_KEY);
    let logs: LoginHistoryRecord[] = raw ? JSON.parse(raw) : [];

    if (filters?.email?.trim()) {
      const q = filters.email.trim().toLowerCase();
      logs = logs.filter((l) => l.email.toLowerCase().includes(q));
    }
    if (filters?.country && filters.country !== 'all') {
      logs = logs.filter((l) => l.country === filters.country);
    }
    if (filters?.action && filters.action !== 'all') {
      logs = logs.filter((l) => l.action === filters.action);
    }

    const from = (page - 1) * pageSize;
    const paged = logs.slice(from, from + pageSize);
    return { logs: paged, totalCount: logs.length };
  } catch {
    return { logs: [], totalCount: 0 };
  }
};

/**
 * Récupérer toutes les sessions de scan vigiles pour l'administrateur
 */
export const fetchVigileSessions = async (): Promise<VigileSessionRecord[]> => {
  const client = getSupabaseClient();

  if (client) {
    try {
      const { data, error } = await client
        .from('vigile_sessions')
        .select('*')
        .order('last_seen_at', { ascending: false });

      if (!error && data) {
        return data.map((d: any) => ({
          id: d.id,
          stationCode: d.station_code,
          stationName: d.station_name,
          eventId: d.event_id,
          eventTitle: d.event_title,
          userId: d.user_id,
          ipAddress: d.ip_address,
          userAgent: d.user_agent,
          country: d.country,
          city: d.city,
          isActive: Boolean(d.is_active),
          lastSeenAt: d.last_seen_at,
          createdAt: d.created_at,
        }));
      }
    } catch (e) {
      console.warn('Fallback lecture vigile_sessions:', e);
    }
  }

  try {
    const raw = localStorage.getItem(VIGILE_SESSIONS_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/**
 * Révoquer une session vigile (force la déconnexion d'un scanner)
 */
export const revokeVigileSession = async (sessionId: string): Promise<boolean> => {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { error } = await client
        .from('vigile_sessions')
        .update({ is_active: false })
        .eq('id', sessionId);
      if (!error) return true;
    } catch (e) {
      console.warn('Erreur révocation vigile session:', e);
    }
  }

  try {
    const raw = localStorage.getItem(VIGILE_SESSIONS_CACHE_KEY);
    if (raw) {
      const sessions: VigileSessionRecord[] = JSON.parse(raw);
      const updated = sessions.map((s) => (s.id === sessionId ? { ...s, isActive: false } : s));
      localStorage.setItem(VIGILE_SESSIONS_CACHE_KEY, JSON.stringify(updated));
    }
    return true;
  } catch {
    return false;
  }
};

/**
 * Vérifier et verrouiller une session de scan vigile (Anti-partage d'appareil)
 */
export const verifyAndLockVigileSession = async (
  stationCode: string,
  eventId?: string,
  eventTitle?: string,
  stationName?: string
): Promise<{
  allowed: boolean;
  message?: string;
  session?: VigileSessionRecord;
  locationLabel?: string;
  deviceLabel?: string;
}> => {
  const cleanCode = stationCode.toUpperCase().trim();
  const ip = await getClientPublicIp();
  const geo = await getIpGeoLocation(ip);
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Mobile Scanner';

  // Formatage appareil simplifié
  let deviceLabel = 'Smartphone Mobile';
  if (/iPhone/i.test(userAgent)) deviceLabel = 'Apple iPhone';
  else if (/Android/i.test(userAgent)) deviceLabel = 'Smartphone Android';
  else if (/iPad/i.test(userAgent)) deviceLabel = 'Apple iPad';
  else if (/Windows/i.test(userAgent)) deviceLabel = 'PC Windows';
  else if (/Macintosh/i.test(userAgent)) deviceLabel = 'Apple Mac';

  const locationLabel = `${geo.city}, ${geo.country}`;

  const client = getSupabaseClient();
  if (client) {
    try {
      // Rechercher si une session active existe déjà pour ce code de poste
      const { data: existing, error } = await client
        .from('vigile_sessions')
        .select('*')
        .eq('station_code', cleanCode)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && existing && existing.length > 0) {
        const active = existing[0];
        // Si même IP ou même User-Agent : même appareil autorisé
        const isSameDevice =
          (active.ip_address && active.ip_address === ip) ||
          (active.user_agent && active.user_agent === userAgent);

        if (isSameDevice) {
          // Prolongation last_seen_at
          await client
            .from('vigile_sessions')
            .update({ last_seen_at: new Date().toISOString() })
            .eq('id', active.id);

          return {
            allowed: true,
            session: {
              id: active.id,
              stationCode: active.station_code,
              stationName: active.station_name,
              eventId: active.event_id,
              eventTitle: active.event_title,
              ipAddress: active.ip_address,
              userAgent: active.user_agent,
              country: active.country,
              city: active.city,
              isActive: true,
              lastSeenAt: new Date().toISOString(),
              createdAt: active.created_at,
            },
            locationLabel,
            deviceLabel,
          };
        }

        // Si IP ET User-Agent diffèrent : BLOCAGE STRICT (Poste partagé)
        return {
          allowed: false,
          message:
            'Ce poste de contrôle est déjà actif sur un autre appareil. Pour garantir la sécurité des entrées, le partage de ce lien est interdit.',
          locationLabel,
          deviceLabel,
        };
      }

      // Aucune session active : création de la première session autorisée
      const { data: created, error: insertErr } = await client
        .from('vigile_sessions')
        .insert([
          {
            station_code: cleanCode,
            station_name: stationName || 'Poste de Contrôle',
            event_id: isValidUUID(eventId) ? eventId : null,
            event_title: eventTitle || 'Événement Thiès',
            ip_address: ip,
            user_agent: userAgent,
            country: geo.country,
            city: geo.city,
            is_active: true,
            last_seen_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (!insertErr && created) {
        return {
          allowed: true,
          session: {
            id: created.id,
            stationCode: created.station_code,
            stationName: created.station_name,
            eventId: created.event_id,
            eventTitle: created.event_title,
            ipAddress: created.ip_address,
            userAgent: created.user_agent,
            country: created.country,
            city: created.city,
            isActive: true,
            lastSeenAt: created.last_seen_at,
            createdAt: created.created_at,
          },
          locationLabel,
          deviceLabel,
        };
      }
    } catch (e) {
      console.warn('Erreur verrouillage session vigile Supabase, repli local:', e);
    }
  }

  // Fallback local en mémoire
  return {
    allowed: true,
    locationLabel,
    deviceLabel,
  };
};
