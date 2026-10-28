import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Calendar,
  MapPin,
  Clock,
  User,
  Edit3,
  Trash2,
  Archive,
  ArchiveRestore,
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
  X,
  Save,
  Eye,
  ExternalLink,
  Layers,
  FileText,
  Users,
  BarChart3,
  Settings,
  Plus,
  Phone,
  Globe,
  Facebook,
  Instagram,
  Youtube,
  Share2,
  DollarSign,
  Ticket,
  QrCode,
  Printer,
  TrendingUp,
  Check,
  ShieldCheck,
  Star,
  Copy,
  Smartphone,
  Music2,
  Bell,
  Download,
  Send,
  MessageCircle,
} from 'lucide-react';
import {
  EventItem,
  EventStatus,
  CATEGORIES,
  SENEGAL_CITIES,
  EventCoproducer,
  CoproducerRole,
  TicketTier,
  EventPreRegistration,
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  deleteEventFromSupabase,
  softDeleteEventInSupabase,
  updateEventStatusInSupabase,
  updateEventInSupabase,
  fetchCoproducersFromSupabase,
  createCoproducer,
  deleteCoproducer,
  fetchOrdersFromSupabase,
  fetchAllTicketsForEvent,
  fetchEventPreRegistrations,
  fetchPreRegistrationCounts,
} from '../services/supabase';
import { PhysicalTicketsModal } from '../components/PhysicalTicketsModal';

const TikTokIcon = ({ className = 'w-4 h-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .58.04.86.12V9.42a6.34 6.34 0 0 0-.86-.06 6.34 6.34 0 1 0 6.34 6.34V9.05a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.48z" />
  </svg>
);

const THIES_QUARTIERS = [
  'Escale',
  'Dixième',
  'Grand Standing',
  'Randoulène',
  'Cité Lamy',
  'Mbour 1',
  'Mbour 2',
  'Mbour 3',
  'Médina Fall',
  'Sampathé',
  'Fahu',
  'Diamaguène',
  'Nguinth',
  'Silmang',
  'Thialy',
  'Peycouck',
];

interface EventsManagementViewProps {
  events: EventItem[];
  onRefreshEvents: () => Promise<void>;
  onNavigateCreate: () => void;
  onPreviewEvent: (event: EventItem) => void;
}

export const EventsManagementView: React.FC<EventsManagementViewProps> = ({
  events,
  onRefreshEvents,
  onNavigateCreate,
  onPreviewEvent,
}) => {
  const { userRole } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | EventStatus>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Modal d'édition avancée (Onglets)
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'details' | 'tiers' | 'coproducers' | 'preregistrations' | 'stats' | 'settings'>('details');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [isPhysicalModalOpen, setIsPhysicalModalOpen] = useState(false);

  // État des Pré-inscriptions & Leads (Onglet Pré-inscriptions)
  const [modalPreRegistrations, setModalPreRegistrations] = useState<EventPreRegistration[]>([]);
  const [isLoadingPreReg, setIsLoadingPreReg] = useState(false);
  const [copiedBroadcast, setCopiedBroadcast] = useState(false);
  const [preRegCounts, setPreRegCounts] = useState<Record<string, number>>({});

  // Chargement initial des compteurs de pré-inscriptions pour chaque carte
  useEffect(() => {
    let active = true;
    fetchPreRegistrationCounts().then((counts) => {
      if (active) {
        setPreRegCounts(counts);
      }
    });
    return () => {
      active = false;
    };
  }, [events]);

  // État des Catégories & Tarifs (Onglet Tarifs)
  const [modalTiers, setModalTiers] = useState<TicketTier[]>([]);
  const [tierDeleteError, setTierDeleteError] = useState<string | null>(null);
  const [newTier, setNewTier] = useState({
    name: '',
    price: 3500,
    available: 100,
    description: '',
    wavePaymentUrl: '',
    perks: '',
  });
  const [newTierError, setNewTierError] = useState<string | null>(null);

  // Verrouillage du défilement du body pendant l'ouverture de la modale plein écran
  useEffect(() => {
    if (editingEvent) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [editingEvent]);

  // État local du formulaire d'édition
  const [editForm, setEditForm] = useState({
    title: '',
    category: 'Gala',
    date: '',
    time: '20:00',
    venue: '',
    city: 'Thiès',
    quartier: '',
    price: 3500,
    posterUrl: '',
    status: 'approved' as EventStatus,
    description: '',
    longDescription: '',
    promoterName: '',
    whatsappContact: '',
    socialFacebook: '',
    socialInstagram: '',
    socialTiktok: '',
    socialYoutube: '',
    websiteUrl: '',
    salesActive: true,
    featured: false,
    salesOpenAt: '',
    estimatedEndTime: '',
    spotifyUrl: '',
    videoSpotUrl: '',
    waveLinkPrevente: '',
    waveLinkJourJ: '',
    waveLinkVip: '',
  });

  // État des co-producteurs (Onglet Co-organisateurs)
  const [modalCoproducers, setModalCoproducers] = useState<EventCoproducer[]>([]);
  const [isLoadingCoproducers, setIsLoadingCoproducers] = useState(false);
  const [newCoprod, setNewCoprod] = useState({
    name: '',
    roleType: 'artiste' as CoproducerRole,
    phone: '',
    revenueShare: 30,
    guestQuota: 10,
  });
  const [isAddingCoprod, setIsAddingCoprod] = useState(false);

  // État des statistiques en temps réel (Onglet Statistiques)
  const [modalStats, setModalStats] = useState({
    soldTickets: 0,
    grossCA: 0,
    scannedTickets: 0,
    scanRate: 0,
    ordersCount: 0,
    orders: [] as any[],
  });
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  // Modal de suppression
  const [deletingEvent, setDeletingEvent] = useState<EventItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSoftDeleting, setIsSoftDeleting] = useState(false);
  const [deleteOrdersCount, setDeleteOrdersCount] = useState<number | null>(null);
  const [isLoadingDeleteInfo, setIsLoadingDeleteInfo] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);

  // Notifications toast
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Chargement des co-organisateurs pour l'événement sélectionné
  const loadEventCoproducers = async (eventId: string) => {
    setIsLoadingCoproducers(true);
    try {
      const res = await fetchCoproducersFromSupabase(eventId);
      setModalCoproducers(res.coproducers || []);
    } catch (err) {
      console.warn('Erreur chargement co-producteurs:', err);
    } finally {
      setIsLoadingCoproducers(false);
    }
  };

  // Chargement des pré-inscriptions (Leads marketing) pour l'événement sélectionné
  const loadEventPreRegistrations = async (eventId: string) => {
    setIsLoadingPreReg(true);
    try {
      const res = await fetchEventPreRegistrations(eventId);
      const list = res.preRegistrations || [];
      setModalPreRegistrations(list);
      setPreRegCounts((prev) => ({ ...prev, [eventId]: list.length }));
    } catch (err) {
      console.warn('Erreur chargement pré-inscriptions:', err);
    } finally {
      setIsLoadingPreReg(false);
    }
  };

  // Chargement des statistiques en direct (orders + tickets)
  const loadEventStats = async (eventId: string) => {
    setIsLoadingStats(true);
    try {
      const [ordersRes, ticketsRes] = await Promise.all([
        fetchOrdersFromSupabase(),
        fetchAllTicketsForEvent(eventId),
      ]);

      const eventOrders = (ordersRes.orders || []).filter((o) => o.eventId === eventId);
      const paidOrders = eventOrders.filter((o) => o.status === 'confirmed');

      const soldTickets = paidOrders.reduce((sum, o) => sum + (Number(o.quantity) || 1), 0);
      const grossCA = paidOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);

      const eventTickets = ticketsRes.tickets || [];
      const scannedTickets = eventTickets.filter(
        (t) => t.status === 'scanned' || t.status === 'used' || Boolean(t.scanned_at)
      ).length;

      const totalToCheck = Math.max(soldTickets, eventTickets.length);
      const scanRate = totalToCheck > 0 ? Math.round((scannedTickets / totalToCheck) * 100) : 0;

      setModalStats({
        soldTickets,
        grossCA,
        scannedTickets,
        scanRate,
        ordersCount: eventOrders.length,
        orders: eventOrders.slice(0, 10),
      });
    } catch (err) {
      console.warn('Erreur chargement stats événement:', err);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const safeEvents = Array.isArray(events) ? events.filter(Boolean) : [];

  // Détection stricte d'un événement archivé ou soft-deleted
  const isEventArchived = (e: EventItem) => {
    if (!e) return false;
    const s = String(e.status || '').toLowerCase();
    return s === 'archived' || Boolean(e.isDeleted) || Boolean(e.deletedAt);
  };

  // Filtrage des événements avec routage automatique des événements soft-deleted vers "Archivés"
  const filteredEvents = safeEvents.filter((e) => {
    if (!e) return false;
    const s = String(e.status || '').toLowerCase();

    if (selectedStatus === 'archived') {
      if (!isEventArchived(e)) return false;
    } else if (selectedStatus === 'approved') {
      if (isEventArchived(e) || s !== 'approved') return false;
    } else if (selectedStatus === 'pending') {
      if (isEventArchived(e) || s !== 'pending') return false;
    } else if (selectedStatus === 'rejected') {
      if (isEventArchived(e) || s !== 'rejected') return false;
    }

    if (selectedCategory !== 'All' && e.category !== selectedCategory) return false;
    if (!searchQuery.trim()) return true;

    const q = searchQuery.toLowerCase();
    const titleMatch = e.title ? e.title.toLowerCase().includes(q) : false;
    const cityMatch = e.city ? e.city.toLowerCase().includes(q) : false;
    const venueMatch = e.venue ? e.venue.toLowerCase().includes(q) : false;
    const promoterMatch = e.promoter?.name ? e.promoter.name.toLowerCase().includes(q) : false;

    return titleMatch || cityMatch || venueMatch || promoterMatch;
  });

  // Compteurs alignés sur le Soft Delete
  const countArchived = safeEvents.filter(isEventArchived).length;
  const countApproved = safeEvents.filter((e) => !isEventArchived(e) && String(e.status || '').toLowerCase() === 'approved').length;
  const countPending = safeEvents.filter((e) => !isEventArchived(e) && String(e.status || '').toLowerCase() === 'pending').length;
  const countRejected = safeEvents.filter((e) => !isEventArchived(e) && String(e.status || '').toLowerCase() === 'rejected').length;
  const countAll = safeEvents.length;

  // Ouvrir la modale d'édition pré-remplie
  const handleOpenEdit = (event: EventItem) => {
    setEditingEvent(event);
    setActiveModalTab('details');
    setEditError(null);
    setEditForm({
      title: event.title,
      category: event.category,
      date: event.date,
      time: event.time,
      venue: event.venue,
      city: event.city,
      quartier: event.quartier || '',
      price: event.price,
      posterUrl: event.posterUrl,
      status: event.status,
      description: event.description || '',
      longDescription: event.longDescription || '',
      promoterName: event.promoter?.name || '',
      whatsappContact: event.whatsappContact || '',
      socialFacebook: event.socialFacebook || '',
      socialInstagram: event.socialInstagram || '',
      socialTiktok: event.socialTiktok || '',
      socialYoutube: event.socialYoutube || event.youtubeUrl || '',
      websiteUrl: event.websiteUrl || '',
      salesActive: event.salesActive !== undefined ? event.salesActive : true,
      featured: Boolean(event.featured),
      salesOpenAt: event.salesOpenAt || '',
      estimatedEndTime: event.estimatedEndTime || '',
      spotifyUrl: event.spotifyUrl || '',
      videoSpotUrl: event.videoSpotUrl || event.youtubeUrl || event.socialYoutube || '',
      waveLinkPrevente: event.waveLinkPrevente || '',
      waveLinkJourJ: event.waveLinkJourJ || '',
      waveLinkVip: event.waveLinkVip || '',
    });

    // Initialisation des Catégories & Tarifs
    const defaultTiers: TicketTier[] = event.tiers && event.tiers.length > 0 ? event.tiers : [
      {
        id: 't-prev',
        name: 'Pass Prévente',
        price: 3500,
        description: 'Tarif promotionnel prévente limité',
        perks: ['Accès dès 20h00', 'Pass QR Code unique'],
        available: 150,
        isActive: true,
        wavePaymentUrl: event.waveLinkPrevente || '',
      },
      {
        id: 't-jour',
        name: 'Pass Jour J',
        price: 5000,
        description: 'Accès standard le jour de l’événement',
        perks: ['Accès salle principale', 'Validation prioritaire'],
        available: 200,
        isActive: true,
        wavePaymentUrl: event.waveLinkJourJ || '',
      },
      {
        id: 't-vip',
        name: 'Pass VIP Prestige',
        price: 10000,
        description: 'Salon VIP dédié & cocktail d’honneur',
        perks: ['Table réservée', 'Cocktail offert', 'Coupe-file'],
        available: 50,
        isActive: true,
        wavePaymentUrl: event.waveLinkVip || '',
      },
    ];
    setModalTiers(defaultTiers.map((t) => ({ ...t, isActive: t.isActive !== false })));
    setTierDeleteError(null);
    setNewTierError(null);

    // Chargement dynamique des co-producteurs, pré-inscriptions et statistiques
    loadEventCoproducers(event.id);
    loadEventPreRegistrations(event.id);
    loadEventStats(event.id);
  };

  // Ouverture directe de la modale sur l'onglet Pré-inscriptions & Leads
  const handleOpenLeads = (event: EventItem) => {
    handleOpenEdit(event);
    setActiveModalTab('preregistrations');
  };

  // Actions sur les catégories de billets
  const handleToggleTierActive = (tierId: string) => {
    setModalTiers((prev) =>
      prev.map((t) => (t.id === tierId ? { ...t, isActive: t.isActive === false ? true : false } : t))
    );
  };

  const handleDeleteTier = (tier: TicketTier) => {
    setTierDeleteError(null);
    const hasOrders = (modalStats.orders || []).some(
      (ord: any) => ord.tierId === tier.id || (ord.tierName && ord.tierName.toLowerCase() === tier.name.toLowerCase())
    );
    if (hasOrders) {
      setTierDeleteError(
        `Impossible de supprimer "${tier.name}" car des commandes ont déjà été enregistrées avec ce tarif. Veuillez plutôt la "Désactiver" pour conserver l'historique comptable.`
      );
      return;
    }
    setModalTiers((prev) => prev.filter((t) => t.id !== tier.id));
  };

  const handleAddTier = (e: React.FormEvent) => {
    e.preventDefault();
    setNewTierError(null);
    if (modalTiers.length >= 8) {
      setNewTierError('Limite atteinte : 8 catégories de billets maximum par événement.');
      return;
    }
    const trimmedName = newTier.name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 40) {
      setNewTierError('Le nom de la catégorie doit comporter entre 2 et 40 caractères.');
      return;
    }
    const priceNum = Number(newTier.price);
    if (isNaN(priceNum) || priceNum <= 0) {
      setNewTierError('Le prix doit être un entier strictement supérieur à 0 FCFA.');
      return;
    }
    const availNum = Number(newTier.available);
    if (isNaN(availNum) || availNum < 0) {
      setNewTierError('Le stock disponible doit être un entier supérieur ou égal à 0.');
      return;
    }
    const trimmedDesc = newTier.description.trim();
    if (trimmedDesc.length > 200) {
      setNewTierError('La description ne doit pas dépasser 200 caractères.');
      return;
    }

    const perksArray = newTier.perks
      ? newTier.perks.split(',').map((p) => p.trim()).filter(Boolean)
      : ['Accès garanti', 'Pass QR Code unique'];

    const created: TicketTier = {
      id: crypto.randomUUID(),
      name: trimmedName,
      price: Math.round(priceNum),
      available: Math.round(availNum),
      description: trimmedDesc || 'Accès à l’événement',
      perks: perksArray,
      isActive: true,
      wavePaymentUrl: userRole === 'admin' && newTier.wavePaymentUrl ? newTier.wavePaymentUrl.trim() : undefined,
    };

    setModalTiers((prev) => [...prev, created]);
    setNewTier({
      name: '',
      price: 3500,
      available: 100,
      description: '',
      wavePaymentUrl: '',
      perks: '',
    });
  };

  // Sauvegarder la modification
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;

    // Diagnostic console de l'envoi des liens Wave
    console.log('PAYLOAD WAVE:', {
      wave_link_prevente: editForm.waveLinkPrevente,
      wave_link_jour_j: editForm.waveLinkJourJ,
      wave_link_vip: editForm.waveLinkVip,
    });

    setIsSavingEdit(true);
    setEditError(null);

    const res = await updateEventInSupabase(editingEvent.id, {
      title: editForm.title,
      category: editForm.category,
      date: editForm.date,
      time: editForm.time,
      venue: editForm.venue,
      city: editForm.city,
      quartier: editForm.quartier,
      price: Number(editForm.price) || 0,
      posterUrl: editForm.posterUrl,
      status: editForm.status,
      description: editForm.description,
      longDescription: editForm.longDescription,
      whatsappContact: editForm.whatsappContact,
      socialFacebook: editForm.socialFacebook,
      socialInstagram: editForm.socialInstagram,
      socialTiktok: editForm.socialTiktok,
      socialYoutube: editForm.socialYoutube,
      websiteUrl: editForm.websiteUrl,
      spotifyUrl: editForm.spotifyUrl,
      salesOpenAt: editForm.salesOpenAt || undefined,
      estimatedEndTime: editForm.estimatedEndTime || undefined,
      videoSpotUrl: editForm.videoSpotUrl || editForm.socialYoutube,
      salesActive: editForm.salesActive,
      featured: editForm.featured,
      promoter: {
        ...editingEvent.promoter,
        name: editForm.promoterName || editingEvent.promoter?.name || 'Organisateur',
      },
      waveLinkPrevente: editForm.waveLinkPrevente,
      waveLinkJourJ: editForm.waveLinkJourJ,
      waveLinkVip: editForm.waveLinkVip,
      tiers: modalTiers,
    });

    setIsSavingEdit(false);

    // Élimination du faux succès : on exige un retour de données effectif de Supabase
    if (!res.success || !res.event) {
      setEditError(res.error || 'Erreur : modification non persistée. Vérifiez les permissions RLS.');
      return;
    }

    setEditingEvent(null);
    await onRefreshEvents();
    showToast(`Événement "${editForm.title}" mis à jour avec succès !`);
  };

  // Ajouter un ayant-droit / co-organisateur
  const handleAddCoproducer = async () => {
    if (!editingEvent) return;
    if (!newCoprod.name.trim()) {
      alert('Veuillez renseigner le nom de l’ayant-droit.');
      return;
    }
    setIsAddingCoprod(true);
    const res = await createCoproducer({
      eventId: editingEvent.id,
      eventTitle: editingEvent.title,
      name: newCoprod.name.trim(),
      roleType: newCoprod.roleType,
      phone: newCoprod.phone.trim() || '+221 77 000 00 00',
      revenueShare: Number(newCoprod.revenueShare) || 0,
      guestTicketsAllocated: Number(newCoprod.guestQuota) || 0,
    });
    setIsAddingCoprod(false);

    if (res.success && res.coproducer) {
      setModalCoproducers((prev) => [res.coproducer!, ...prev]);
      setNewCoprod({
        name: '',
        roleType: 'artiste',
        phone: '',
        revenueShare: 30,
        guestQuota: 10,
      });
      showToast(`Co-organisateur "${res.coproducer.name}" ajouté avec succès !`);
    } else {
      showToast(res.error || 'Erreur lors de l’ajout.', 'error');
    }
  };

  // Supprimer un ayant-droit / co-organisateur
  const handleDeleteCoproducer = async (coprodId: string, coprodName: string) => {
    if (!window.confirm(`Confirmez-vous le retrait de "${coprodName}" de la liste des co-producteurs ?`)) {
      return;
    }
    const res = await deleteCoproducer(coprodId);
    if (res.success) {
      setModalCoproducers((prev) => prev.filter((c) => c.id !== coprodId));
      showToast(`Ayant-droit "${coprodName}" retiré.`);
    } else {
      showToast(res.error || 'Erreur lors de la suppression.', 'error');
    }
  };

  // Archiver / Désarchiver un événement
  const handleToggleArchive = async (event: EventItem) => {
    const isCurrentlyArchived = event.status === 'archived';
    const newStatus: EventStatus = isCurrentlyArchived ? 'approved' : 'archived';

    const res = await updateEventStatusInSupabase(event.id, newStatus);
    if (!res.success) {
      showToast(res.error || "Erreur lors du changement de statut d'archivage.", 'error');
      return;
    }

    await onRefreshEvents();
    showToast(
      isCurrentlyArchived
        ? `Événement "${event.title}" restauré et désormais public (statut approuvé).`
        : `Événement "${event.title}" archivé (retiré du site public, conservé en base).`
    );
  };

  // Démarrer la gestion de suppression (pré-chargement des commandes associées)
  const handleStartDelete = async (event: EventItem) => {
    setDeletingEvent(event);
    setDeleteErrorMessage(null);
    setDeleteOrdersCount(null);
    setIsLoadingDeleteInfo(true);

    try {
      const ordersRes = await fetchOrdersFromSupabase();
      const eventOrders = (ordersRes.orders || []).filter((o) => o.eventId === event.id);
      setDeleteOrdersCount(eventOrders.length);
    } catch (err) {
      console.warn('Impossible de pré-charger les commandes pour la suppression:', err);
      setDeleteOrdersCount(0);
    } finally {
      setIsLoadingDeleteInfo(false);
    }
  };

  // Option Recommandée : Soft Delete (Archivage sécurisé & préservation comptable)
  const handleConfirmSoftDelete = async () => {
    if (!deletingEvent) return;

    setIsSoftDeleting(true);
    setDeleteErrorMessage(null);
    const res = await softDeleteEventInSupabase(deletingEvent.id);
    setIsSoftDeleting(false);

    if (!res.success) {
      setDeleteErrorMessage(res.error || "Erreur lors de l'archivage.");
      showToast(res.error || "Erreur lors de l'archivage.", 'error');
      return;
    }

    const title = deletingEvent.title;
    setDeletingEvent(null);
    await onRefreshEvents();
    showToast(`Événement "${title}" archivé avec succès (Soft Delete). Traçabilité comptable préservée.`);
  };

  // Option Alternative : Suppression Définitive (Hard Delete SQL)
  const handleConfirmHardDelete = async () => {
    if (!deletingEvent) return;

    setIsDeleting(true);
    setDeleteErrorMessage(null);
    const res = await deleteEventFromSupabase(deletingEvent.id);
    setIsDeleting(false);

    if (!res.success) {
      setDeleteErrorMessage(res.error || 'Erreur lors de la suppression.');
      showToast(res.error || 'Erreur lors de la suppression.', 'error');
      return;
    }

    const title = deletingEvent.title;
    setDeletingEvent(null);
    await onRefreshEvents();
    showToast(`Événement "${title}" supprimé définitivement de la base.`);
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border text-sm font-semibold transition-all ${
            toastMessage.type === 'success'
              ? 'bg-[#181818] text-emerald-400 border-emerald-500/30 shadow-emerald-950/40'
              : 'bg-[#181818] text-rose-400 border-rose-500/30 shadow-rose-950/40'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header View */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#141414] p-6 rounded-3xl border border-white/10 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-[#8A2BE2]/30 to-[#E9C349]/20 text-[#E9C349] border border-[#E9C349]/30">
              Console Super Admin
            </span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-white mt-1">
            Gestion Complète des Événements
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Catalogue unifié de tous les événements en base • Modification en direct, suppression et archivage
          </p>
        </div>

        <button
          onClick={onNavigateCreate}
          className="btn-primary-glow px-5 py-3 rounded-2xl font-heading font-bold text-xs tracking-wider flex items-center justify-center gap-2 text-white shrink-0 self-start md:self-auto"
        >
          <PlusCircle className="w-4 h-4 text-[#E9C349]" />
          <span>Créer un Nouvel Événement</span>
        </button>
      </div>

      {/* Filtres & Recherche */}
      <div className="bg-[#181818] p-4 sm:p-5 rounded-3xl border border-white/10 space-y-4">
        {/* Ligne 1 : Statuts */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedStatus('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedStatus === 'all'
                ? 'bg-white text-black shadow-md'
                : 'bg-white/5 text-gray-400 hover:text-white border border-white/5'
            }`}
          >
            Tous ({countAll})
          </button>
          <button
            onClick={() => setSelectedStatus('approved')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedStatus === 'approved'
                ? 'bg-emerald-500 text-white shadow-md'
                : 'bg-white/5 text-emerald-400/80 hover:text-emerald-300 border border-emerald-500/20'
            }`}
          >
            ✅ Approuvés ({countApproved})
          </button>
          <button
            onClick={() => setSelectedStatus('pending')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedStatus === 'pending'
                ? 'bg-amber-500 text-black font-extrabold shadow-md'
                : 'bg-white/5 text-amber-400/80 hover:text-amber-300 border border-amber-500/20'
            }`}
          >
            ⏳ En attente ({countPending})
          </button>
          <button
            onClick={() => setSelectedStatus('rejected')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedStatus === 'rejected'
                ? 'bg-rose-500 text-white shadow-md'
                : 'bg-white/5 text-rose-400/80 hover:text-rose-300 border border-rose-500/20'
            }`}
          >
            ❌ Rejetés ({countRejected})
          </button>
          <button
            onClick={() => setSelectedStatus('archived')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedStatus === 'archived'
                ? 'bg-slate-600 text-white shadow-md'
                : 'bg-white/5 text-gray-400 hover:text-white border border-white/5'
            }`}
          >
            📦 Archivés ({countArchived})
          </button>
        </div>

        {/* Ligne 2 : Recherche & Catégorie */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-white/5">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher par titre, ville, promoteur..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#111111] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#8A2BE2]"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-colors ${
                  selectedCategory === cat.value
                    ? 'bg-[#8A2BE2] text-white shadow-sm'
                    : 'bg-[#111111] text-gray-400 hover:text-white border border-white/5'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grille des Événements */}
      {filteredEvents.length === 0 ? (
        <div className="glass-panel p-12 rounded-3xl text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-white/5 text-gray-400 flex items-center justify-center mx-auto border border-white/10">
            <Layers className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-heading text-lg font-bold text-white">
              Aucun événement trouvé
            </h3>
            <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
              Aucun événement ne correspond à vos filtres actuels.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredEvents.map((event) => {
            const isArchived = event.status === 'archived';
            const isPending = event.status === 'pending';
            const isApproved = event.status === 'approved';
            const isRejected = event.status === 'rejected';

            return (
              <div
                key={event.id}
                className={`glass-panel rounded-3xl p-5 border transition-all flex flex-col justify-between group ${
                  isArchived
                    ? 'border-white/5 opacity-75 bg-[#141414]/60'
                    : 'border-white/10 hover:border-[#8A2BE2]/50 bg-[#161616]'
                }`}
              >
                <div className="space-y-4">
                  {/* Top Image + Badges */}
                  <div className="relative w-full h-44 rounded-2xl overflow-hidden bg-black/40">
                    <img
                      src={event.posterUrl}
                      alt={event.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Statut Badge */}
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                      {isApproved && (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/90 text-white text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-md">
                          ✅ Approuvé
                        </span>
                      )}
                      {isPending && (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/90 text-black text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-md">
                          ⏳ En attente
                        </span>
                      )}
                      {isRejected && (
                        <span className="px-2.5 py-1 rounded-lg bg-rose-500/90 text-white text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-md">
                          ❌ Rejeté
                        </span>
                      )}
                      {isArchived && (
                        <span className="px-2.5 py-1 rounded-lg bg-slate-700/90 text-gray-200 text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-md">
                          📦 Archivé
                        </span>
                      )}
                    </div>

                    {/* Catégorie */}
                    <div className="absolute top-3 right-3">
                      <span className="px-2.5 py-1 rounded-lg bg-black/70 border border-white/20 text-[#DCB8FF] text-[10px] font-bold backdrop-blur-md">
                        {event.category}
                      </span>
                    </div>

                    {/* Prix */}
                    <div className="absolute bottom-3 right-3">
                      <span className="px-3 py-1 rounded-xl bg-black/80 border border-[#E9C349]/40 text-[#E9C349] font-heading font-black text-xs backdrop-blur-md">
                        {event.priceLabel || `${event.price.toLocaleString('fr-FR')} FCFA`}
                      </span>
                    </div>
                  </div>

                  {/* Infos Événement */}
                  <div className="space-y-2">
                    <h3 className="font-heading text-lg font-extrabold text-white line-clamp-1 group-hover:text-[#E9C349] transition-colors">
                      {event.title}
                    </h3>

                    <div className="flex flex-col gap-1 text-xs text-gray-300">
                      <div className="flex items-center gap-1.5 text-gray-300">
                        <Calendar className="w-3.5 h-3.5 text-[#E9C349] shrink-0" />
                        <span>{event.date} à {event.time}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-400">
                        <MapPin className="w-3.5 h-3.5 text-[#8A2BE2] shrink-0" />
                        <span className="truncate">{event.venue}, {event.city}</span>
                      </div>
                    </div>

                    {/* Promoteur */}
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                        </div>
                        <span className="text-gray-300 truncate font-semibold">
                          {event.promoter?.name || 'Promoteur ThièsDN'}
                        </span>
                      </div>
                      <button
                        onClick={() => onPreviewEvent(event)}
                        className="text-[11px] text-[#DCB8FF] hover:underline flex items-center gap-1 shrink-0 ml-2 font-medium"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Aperçu</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* BOUTONS D'ACTION (LEADS DIRECT / MODIFIER / ARCHIVER / SUPPRIMER) */}
                <div className="pt-4 mt-4 border-t border-white/10 space-y-2">
                  {/* Bouton Accès Direct Leads Marketing */}
                  <button
                    onClick={() => handleOpenLeads(event)}
                    className="w-full px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-semibold text-xs flex items-center justify-between hover:bg-amber-500/20 transition-all shadow-sm"
                    title="Voir directement les pré-inscriptions et leads pour cet événement"
                  >
                    <span className="flex items-center gap-1.5">
                      <span>🔔</span>
                      <strong className="font-bold">Leads / Pré-inscriptions</strong>
                      <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-[#E9C349] font-mono font-bold border border-amber-500/30">
                        {preRegCounts[event.id] ?? 0}
                      </span>
                    </span>
                    <span className="text-[10px] text-amber-300 font-mono hover:underline flex items-center gap-1">
                      <span>Ouvrir</span>
                      <span>→</span>
                    </span>
                  </button>

                  <div className="grid grid-cols-3 gap-2">
                    {/* 1. Modifier */}
                    <button
                      onClick={() => handleOpenEdit(event)}
                      className="py-2.5 px-2 rounded-xl bg-white/5 hover:bg-[#8A2BE2]/20 border border-white/10 text-[11px] font-bold text-white hover:text-[#DCB8FF] flex items-center justify-center gap-1.5 transition-all"
                      title="Modifier les informations"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#DCB8FF]" />
                      <span>Modifier</span>
                    </button>

                    {/* 2. Archiver / Désarchiver */}
                    <button
                      onClick={() => handleToggleArchive(event)}
                      className={`py-2.5 px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all ${
                        isArchived
                          ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
                          : 'bg-white/5 hover:bg-amber-500/20 border-white/10 text-gray-300 hover:text-amber-300'
                      }`}
                      title={isArchived ? "Désarchiver (rendre public)" : "Archiver l'événement"}
                    >
                      {isArchived ? (
                        <>
                          <ArchiveRestore className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Restaurer</span>
                        </>
                      ) : (
                        <>
                          <Archive className="w-3.5 h-3.5 text-amber-400" />
                          <span>Archiver</span>
                        </>
                      )}
                    </button>

                    {/* 3. Supprimer */}
                    <button
                      onClick={() => handleStartDelete(event)}
                      className="py-2.5 px-2 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 text-[11px] font-bold text-gray-300 hover:text-rose-400 flex items-center justify-center gap-1.5 transition-all"
                      title="Supprimer définitivement"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Supprimer</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODALE D'ÉDITION AVANCÉE (5 ONGLETS) - PLEIN ÉCRAN RESPONSIVE */}
      {editingEvent && (
        <div className="fixed inset-0 z-50 h-dvh w-full max-w-none rounded-none bg-[#0D0C12] flex flex-col overflow-hidden animate-in fade-in duration-200">
          <form onSubmit={handleSaveEdit} className="h-full w-full flex flex-col justify-between overflow-hidden">
            {/* Header & Onglets Sticky Top */}
            <div className="sticky top-0 z-20 bg-[#14131A] border-b border-white/10 shrink-0 px-4 sm:px-8 py-3.5 shadow-md">
              <div className="max-w-5xl mx-auto w-full space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#8A2BE2]/20 border border-[#8A2BE2]/40 flex items-center justify-center text-[#DCB8FF] shrink-0">
                      <Edit3 className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="font-heading text-lg sm:text-xl font-black text-white leading-tight">
                        Gestion Avancée de l'Événement
                      </h2>
                      <p className="text-xs text-gray-400 truncate max-w-xs sm:max-w-md">
                        {editingEvent.title} • <span className="font-mono text-[10px] text-gray-300">{editingEvent.id}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingEvent(null)}
                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Barre de 5 Onglets */}
                <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-black/40 border border-white/10 overflow-x-auto shrink-0 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setActiveModalTab('details')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                      activeModalTab === 'details'
                        ? 'bg-[#8A2BE2] text-white shadow-lg shadow-[#8A2BE2]/30'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Détails & Contenu</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveModalTab('tiers')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                      activeModalTab === 'tiers'
                        ? 'bg-[#8A2BE2] text-white shadow-lg shadow-[#8A2BE2]/30'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Ticket className="w-3.5 h-3.5" />
                    <span>Tarifs & Billetterie</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/15 font-mono">
                      {modalTiers.filter((t) => t.isActive !== false).length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveModalTab('coproducers')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                      activeModalTab === 'coproducers'
                        ? 'bg-[#8A2BE2] text-white shadow-lg shadow-[#8A2BE2]/30'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Co-organisateurs</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/15 font-mono">
                      {modalCoproducers.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveModalTab('preregistrations')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                      activeModalTab === 'preregistrations'
                        ? 'bg-[#8A2BE2] text-white shadow-lg shadow-[#8A2BE2]/30'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>Pré-inscriptions & Leads</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      modalPreRegistrations.length > 0
                        ? 'bg-[#E9C349] text-[#241A00] font-bold'
                        : 'bg-white/15 text-gray-300'
                    }`}>
                      {modalPreRegistrations.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveModalTab('stats')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                      activeModalTab === 'stats'
                        ? 'bg-[#8A2BE2] text-white shadow-lg shadow-[#8A2BE2]/30'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Statistiques</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveModalTab('settings')}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shrink-0 ${
                      activeModalTab === 'settings'
                        ? 'bg-[#8A2BE2] text-white shadow-lg shadow-[#8A2BE2]/30'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Paramètres</span>
                  </button>
                </div>

                {editError && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 shrink-0">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{editError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Corps Scrollable du Formulaire (max-w-5xl mx-auto) */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-8 w-full">
              <div className="max-w-5xl mx-auto w-full space-y-6">
              {/* ONGLET 1 : DÉTAILS */}
              {activeModalTab === 'details' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  {/* Titre & Catégorie & Promoteur */}
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                        Titre de l'Événement *
                      </label>
                      <input
                        type="text"
                        required
                        value={editForm.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#8A2BE2]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                          Catégorie
                        </label>
                        <select
                          value={editForm.category}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value as any })}
                          className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                        >
                          {CATEGORIES.filter((c) => c.value !== 'All').map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                          Nom du Promoteur / Organisateur
                        </label>
                        <input
                          type="text"
                          value={editForm.promoterName}
                          onChange={(e) => setEditForm({ ...editForm, promoterName: e.target.value })}
                          placeholder="Ex: Médias Graphisme, Lat Dior..."
                          className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Date, Heure & Lieu */}
                  <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#DCB8FF]">
                      Date, Horaires & Emplacement
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1 sm:col-span-1">
                        <label className="text-[10px] text-gray-400">Date textuelle *</label>
                        <input
                          type="text"
                          required
                          value={editForm.date}
                          onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                          placeholder="ex: 25 Décembre 2026"
                          className="w-full bg-[#111111] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                        />
                      </div>

                      <div className="space-y-1 sm:col-span-1">
                        <label className="text-[10px] text-gray-400">Heure de début *</label>
                        <input
                          type="text"
                          required
                          value={editForm.time}
                          onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                          placeholder="ex: 23:00"
                          className="w-full bg-[#111111] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                        />
                      </div>

                      <div className="space-y-1 sm:col-span-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] text-gray-400">Fin estimée</label>
                          <span className="text-[9px] text-[#DCB8FF]">Défaut: +6h</span>
                        </div>
                        <input
                          type="text"
                          value={editForm.estimatedEndTime}
                          onChange={(e) => setEditForm({ ...editForm, estimatedEndTime: e.target.value })}
                          placeholder="ex: 05:00 (traversée 00h)"
                          className="w-full bg-[#111111] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                        />
                      </div>
                    </div>

                    {/* Date d'ouverture des ventes */}
                    <div className="p-3 rounded-xl bg-[#241A00]/30 border border-[#E9C349]/20 space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-[#E9C349] uppercase tracking-wider flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Date d'ouverture des ventes (Optionnel - Compte à rebours)
                        </label>
                        <span className="text-[9px] text-gray-400">Vide = ventes ouvertes immédiatement</span>
                      </div>
                      <input
                        type="datetime-local"
                        value={editForm.salesOpenAt ? editForm.salesOpenAt.substring(0, 16) : ''}
                        onChange={(e) => setEditForm({ ...editForm, salesOpenAt: e.target.value })}
                        className="w-full bg-[#111111] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2] [color-scheme:dark]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-400">Lieu / Salle *</label>
                        <input
                          type="text"
                          required
                          value={editForm.venue}
                          onChange={(e) => setEditForm({ ...editForm, venue: e.target.value })}
                          placeholder="Ex: Place de France..."
                          className="w-full bg-[#111111] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-400">Ville *</label>
                        <select
                          value={editForm.city}
                          onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                          className="w-full bg-[#111111] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                        >
                          {SENEGAL_CITIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-400">Quartier (si Thiès)</label>
                        {editForm.city === 'Thiès' ? (
                          <select
                            value={editForm.quartier}
                            onChange={(e) => setEditForm({ ...editForm, quartier: e.target.value })}
                            className="w-full bg-[#111111] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                          >
                            <option value="">Sélectionner le quartier...</option>
                            {THIES_QUARTIERS.map((q) => (
                              <option key={q} value={q}>
                                {q}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={editForm.quartier}
                            onChange={(e) => setEditForm({ ...editForm, quartier: e.target.value })}
                            placeholder="Quartier..."
                            className="w-full bg-[#111111] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Prix & Affiche avec aperçu */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                    <div className="space-y-1.5 sm:col-span-1">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                        Prix Standard (FCFA) *
                      </label>
                      <input
                        type="number"
                        required
                        min={0}
                        value={editForm.price}
                        onChange={(e) => setEditForm({ ...editForm, price: Number(e.target.value) })}
                        className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#8A2BE2]"
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                        URL de l'Affiche (HD)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="url"
                          value={editForm.posterUrl}
                          onChange={(e) => setEditForm({ ...editForm, posterUrl: e.target.value })}
                          placeholder="https://..."
                          className="flex-1 bg-[#111111] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                        />
                        {editForm.posterUrl && (
                          <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/20 shrink-0">
                            <img
                              src={editForm.posterUrl}
                              alt="Aperçu"
                              className="w-full h-full object-cover"
                              onError={(e) => ((e.target as any).style.display = 'none')}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Descriptions */}
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                        Accroche / Description Courte
                      </label>
                      <textarea
                        rows={2}
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        placeholder="Une phrase percutante pour captiver les festivaliers..."
                        className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                        Description Détaillée (Ambiance, Artistes, Programme, Dress Code)
                      </label>
                      <textarea
                        rows={4}
                        value={editForm.longDescription}
                        onChange={(e) => setEditForm({ ...editForm, longDescription: e.target.value })}
                        placeholder="Détaillez le déroulement, les têtes d'affiche, l'ambiance et les consignes d'accès..."
                        className="w-full bg-[#111111] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                      />
                    </div>
                  </div>

                  {/* Réseaux Sociaux & Contact Organisateur */}
                  <div className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#E9C349] flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5" />
                      <span>Réseaux Sociaux & Contact Officiel</span>
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-gray-400 flex items-center gap-1 mb-1">
                          <Phone className="w-3 h-3 text-emerald-400" /> WhatsApp Organisateur
                        </label>
                        <input
                          type="tel"
                          value={editForm.whatsappContact}
                          onChange={(e) => setEditForm({ ...editForm, whatsappContact: e.target.value })}
                          placeholder="+221 77 XXX XX XX"
                          className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-gray-400 flex items-center gap-1 mb-1">
                          <Facebook className="w-3 h-3 text-blue-400" /> Page Facebook
                        </label>
                        <input
                          type="url"
                          value={editForm.socialFacebook}
                          onChange={(e) => setEditForm({ ...editForm, socialFacebook: e.target.value })}
                          placeholder="https://facebook.com/..."
                          className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-gray-400 flex items-center gap-1 mb-1">
                          <Instagram className="w-3 h-3 text-pink-400" /> Profil Instagram
                        </label>
                        <input
                          type="url"
                          value={editForm.socialInstagram}
                          onChange={(e) => setEditForm({ ...editForm, socialInstagram: e.target.value })}
                          placeholder="https://instagram.com/..."
                          className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-gray-400 flex items-center gap-1 mb-1">
                          <TikTokIcon className="w-3 h-3 text-cyan-300" /> Compte TikTok
                        </label>
                        <input
                          type="url"
                          value={editForm.socialTiktok}
                          onChange={(e) => setEditForm({ ...editForm, socialTiktok: e.target.value })}
                          placeholder="https://tiktok.com/@..."
                          className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-gray-400 flex items-center gap-1 mb-1">
                          <Youtube className="w-3 h-3 text-red-500" /> Vidéo Teaser / YouTube
                        </label>
                        <input
                          type="url"
                          value={editForm.videoSpotUrl || editForm.socialYoutube}
                          onChange={(e) => setEditForm({ ...editForm, videoSpotUrl: e.target.value, socialYoutube: e.target.value })}
                          placeholder="https://youtube.com/watch?v=... ou youtu.be/..."
                          className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-gray-400 flex items-center gap-1 mb-1">
                          <Globe className="w-3 h-3 text-[#E9C349]" /> Site Web Officiel
                        </label>
                        <input
                          type="url"
                          value={editForm.websiteUrl}
                          onChange={(e) => setEditForm({ ...editForm, websiteUrl: e.target.value })}
                          placeholder="https://mon-festival.sn"
                          className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[10px] text-[#1DB954] flex items-center gap-1 mb-1 font-bold">
                          <Music2 className="w-3 h-3" /> Lien Spotify (Lecteur Vinyle Effet Wow)
                        </label>
                        <input
                          type="url"
                          value={editForm.spotifyUrl}
                          onChange={(e) => setEditForm({ ...editForm, spotifyUrl: e.target.value })}
                          placeholder="https://open.spotify.com/album/... ou track/..."
                          className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Liens Mobile Money Wave (Réservé Admin) */}
                  {userRole === 'admin' && (
                    <div className="p-4 rounded-2xl bg-black/30 border border-[#1DC3F4]/20 space-y-3">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-[#1DC3F4] flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5" />
                        <span>Liens de Paiement Mobile Money Wave (Réservé Admin)</span>
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-1">Pass Prévente</label>
                          <input
                            type="url"
                            placeholder="https://pay.wave.com/..."
                            value={editForm.waveLinkPrevente}
                            onChange={(e) => setEditForm({ ...editForm, waveLinkPrevente: e.target.value })}
                            className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-1">Pass Jour J</label>
                          <input
                            type="url"
                            placeholder="https://pay.wave.com/..."
                            value={editForm.waveLinkJourJ}
                            onChange={(e) => setEditForm({ ...editForm, waveLinkJourJ: e.target.value })}
                            className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-1">Pass VIP Prestige</label>
                          <input
                            type="url"
                            placeholder="https://pay.wave.com/..."
                            value={editForm.waveLinkVip}
                            onChange={(e) => setEditForm({ ...editForm, waveLinkVip: e.target.value })}
                            className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ONGLET : GRILLE TARIFAIRE DYNAMIQUE */}
              {activeModalTab === 'tiers' && (
                <div className="space-y-6 animate-in fade-in duration-150">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-black/40 border border-white/10">
                    <div>
                      <h3 className="font-heading font-black text-sm text-white uppercase tracking-wider flex items-center gap-2">
                        <Ticket className="w-4 h-4 text-[#E9C349]" />
                        <span>Grille Tarifaire Dynamique & Billetterie</span>
                      </h3>
                      <p className="text-xs text-gray-400 mt-1">
                        Activez, désactivez ou ajoutez des catégories de billets. Seules les formules actives avec places disponibles sont proposées à l'achat.
                      </p>
                    </div>
                    <span className="self-start sm:self-center px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#8A2BE2]/20 border border-[#8A2BE2]/40 text-[#DCB8FF]">
                      {modalTiers.length} / 8 formules
                    </span>
                  </div>

                  {tierDeleteError && (
                    <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{tierDeleteError}</span>
                    </div>
                  )}

                  {/* Liste des formules existantes */}
                  <div className="space-y-3">
                    {modalTiers.map((tier) => {
                      const isActive = tier.isActive !== false;
                      const hasWaveUrl = Boolean(tier.wavePaymentUrl && tier.wavePaymentUrl.trim().startsWith('http'));

                      return (
                        <div
                          key={tier.id}
                          className={`p-4 rounded-2xl border transition-all ${
                            isActive
                              ? 'bg-[#181720] border-white/10 hover:border-white/20'
                              : 'bg-black/40 border-white/5 opacity-60'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                            <div className="flex items-center gap-3">
                              <span
                                className={`w-3 h-3 rounded-full shrink-0 ${
                                  isActive ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-gray-500'
                                }`}
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-heading font-bold text-sm text-white">{tier.name}</h4>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                      isActive
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                        : 'bg-gray-800 text-gray-400 border border-gray-700'
                                    }`}
                                  >
                                    {isActive ? 'Active' : 'Désactivée'}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5">{tier.description}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 self-end sm:self-center">
                              <div className="text-right">
                                <span className="font-heading font-black text-base text-[#E9C349]">
                                  {tier.price.toLocaleString('fr-FR')} FCFA
                                </span>
                                <span className="block text-[11px] text-gray-400 font-mono">
                                  {tier.available} place(s) dispo.
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Détails secondaires & Actions */}
                          <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              {tier.perks && tier.perks.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {tier.perks.map((p, idx) => (
                                    <span
                                      key={idx}
                                      className="px-2 py-0.5 rounded-lg bg-white/5 text-gray-300 text-[10px]"
                                    >
                                      ✓ {p}
                                    </span>
                                  ))}
                                </div>
                              )}
                              {hasWaveUrl ? (
                                <span className="text-[10px] text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded-lg border border-sky-500/20">
                                  Lien Wave direct configuré
                                </span>
                              ) : (
                                <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-lg">
                                  Lien Wave événement par défaut
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              <button
                                type="button"
                                onClick={() => handleToggleTierActive(tier.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                                  isActive
                                    ? 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/30'
                                    : 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/30'
                                }`}
                              >
                                {isActive ? 'Désactiver' : 'Réactiver'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteTier(tier)}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 hover:border-rose-500/40 transition-colors flex items-center gap-1.5"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Supprimer</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Formulaire d'ajout d'une nouvelle catégorie */}
                  {modalTiers.length < 8 ? (
                    <div className="p-4 sm:p-5 rounded-2xl bg-black/40 border border-white/10 space-y-4">
                      <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <h4 className="font-heading font-bold text-sm text-white flex items-center gap-2">
                          <Plus className="w-4 h-4 text-[#8A2BE2]" />
                          <span>Ajouter une Nouvelle Catégorie de Billet</span>
                        </h4>
                        <span className="text-[10px] uppercase font-bold text-gray-400">
                          {8 - modalTiers.length} emplacement(s) libre(s)
                        </span>
                      </div>

                      {newTierError && (
                        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>{newTierError}</span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-1">
                          <label className="text-[11px] font-bold text-gray-300 block mb-1">
                            Nom de la formule *
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: Pass Couple, Table VIP..."
                            value={newTier.name}
                            onChange={(e) => setNewTier({ ...newTier, name: e.target.value })}
                            className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-gray-300 block mb-1">
                            Prix (FCFA) *
                          </label>
                          <input
                            type="number"
                            min="500"
                            step="500"
                            placeholder="3500"
                            value={newTier.price}
                            onChange={(e) => setNewTier({ ...newTier, price: Number(e.target.value) })}
                            className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-gray-300 block mb-1">
                            Stock disponible (Places) *
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="100"
                            value={newTier.available}
                            onChange={(e) => setNewTier({ ...newTier, available: Number(e.target.value) })}
                            className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-bold text-gray-300 block mb-1">
                            Description courte (max 200 car.)
                          </label>
                          <input
                            type="text"
                            maxLength={200}
                            placeholder="Description des prestations incluses..."
                            value={newTier.description}
                            onChange={(e) => setNewTier({ ...newTier, description: e.target.value })}
                            className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-gray-300 block mb-1">
                            Avantages / Perks (séparés par virgules)
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: Coupe-file, Boisson offerte, Accès salon..."
                            value={newTier.perks}
                            onChange={(e) => setNewTier({ ...newTier, perks: e.target.value })}
                            className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                          />
                        </div>
                      </div>

                      {/* Champ Wave réservé à l'administrateur */}
                      {userRole === 'admin' && (
                        <div>
                          <label className="text-[11px] font-bold text-[#1DC3F4] flex items-center gap-1.5 mb-1">
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Lien Wave Direct Spécifique (Réservé Admin - Optionnel)</span>
                          </label>
                          <input
                            type="url"
                            placeholder="https://pay.wave.com/m/..."
                            value={newTier.wavePaymentUrl}
                            onChange={(e) => setNewTier({ ...newTier, wavePaymentUrl: e.target.value })}
                            className="w-full bg-[#111111] border border-[#1DC3F4]/30 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#1DC3F4]"
                          />
                        </div>
                      )}

                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          onClick={handleAddTier}
                          className="px-5 py-2.5 rounded-xl bg-[#8A2BE2] hover:bg-[#7823c7] text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-[#8A2BE2]/30"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Ajouter cette Formule</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 text-center text-xs text-gray-400">
                      Nombre maximum de formules atteint (8/8). Supprimez ou modifiez une formule existante pour en ajouter une nouvelle.
                    </div>
                  )}
                </div>
              )}

              {/* ONGLET 2 : CO-ORGANISATEURS */}
              {activeModalTab === 'coproducers' && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/40 border border-white/10">
                    <div>
                      <p className="text-xs font-bold text-white">Partage des Recettes Co-Production</p>
                      <p className="text-[10px] text-gray-400">
                        {modalCoproducers.length} ayant(s)-droit enregistré(s) • Total quotes-parts :{' '}
                        <strong className="text-[#E9C349]">
                          {modalCoproducers.reduce((sum, c) => sum + (c.revenueShare || 0), 0)}%
                        </strong>
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                      Part Promoteur : {Math.max(0, 100 - modalCoproducers.reduce((sum, c) => sum + (c.revenueShare || 0), 0))}%
                    </span>
                  </div>

                  {/* Liste des Co-Producteurs */}
                  {isLoadingCoproducers ? (
                    <div className="p-8 text-center text-gray-400 text-xs">
                      Chargement des co-organisateurs...
                    </div>
                  ) : modalCoproducers.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-white/5 border border-white/5 text-center space-y-2">
                      <Users className="w-8 h-8 text-gray-500 mx-auto" />
                      <p className="text-xs text-gray-300 font-semibold">Aucun co-organisateur associé</p>
                      <p className="text-[11px] text-gray-400">
                        Ajoutez des artistes vedettes, managers ou coproducteurs ci-dessous pour leur allouer une quote-part et des invitations.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {modalCoproducers.map((coprod) => (
                        <div
                          key={coprod.id}
                          className="p-3.5 rounded-2xl bg-[#1C1B1B] border border-white/5 flex items-center justify-between gap-3 hover:border-white/15 transition-all"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-white truncate">{coprod.name}</span>
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-[#8A2BE2]/20 text-[#DCB8FF] border border-[#8A2BE2]/30">
                                {coprod.roleType}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-2">
                              <span>📱 {coprod.phone}</span>
                              <span>•</span>
                              <strong className="text-[#E9C349]">{coprod.revenueShare}% du CA</strong>
                              <span>•</span>
                              <span>{coprod.guestTicketsAllocated} invitations ({coprod.guestTicketsUsed} utilisées)</span>
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteCoproducer(coprod.id, coprod.name)}
                            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 flex items-center justify-center transition-all shrink-0 border border-white/5"
                            title="Retirer cet ayant-droit"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Formulaire d'ajout rapide */}
                  <div className="p-4 rounded-2xl bg-[#1A1919] border border-white/10 space-y-3">
                    <p className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-[#E9C349]" />
                      <span>Ajouter un Nouvel Ayant-Droit / Co-Organisateur</span>
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="space-y-1 sm:col-span-1">
                        <label className="text-[10px] text-gray-400">Nom / Structure *</label>
                        <input
                          type="text"
                          value={newCoprod.name}
                          onChange={(e) => setNewCoprod({ ...newCoprod, name: e.target.value })}
                          placeholder="Ex: Waly Seck, DJ..."
                          className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                        />
                      </div>

                      <div className="space-y-1 sm:col-span-1">
                        <label className="text-[10px] text-gray-400">Rôle</label>
                        <select
                          value={newCoprod.roleType}
                          onChange={(e) => setNewCoprod({ ...newCoprod, roleType: e.target.value as CoproducerRole })}
                          className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                        >
                          <option value="artiste">Artiste Vedette</option>
                          <option value="staff_artiste">Staff / Manager Artiste</option>
                          <option value="co_producteur">Co-Producteur Associé</option>
                          <option value="gerant_lieu">Gérant du Lieu</option>
                        </select>
                      </div>

                      <div className="space-y-1 sm:col-span-1">
                        <label className="text-[10px] text-gray-400">Téléphone Wave/OM *</label>
                        <input
                          type="tel"
                          value={newCoprod.phone}
                          onChange={(e) => setNewCoprod({ ...newCoprod, phone: e.target.value })}
                          placeholder="+221 77 XXX XX XX"
                          className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-400 flex justify-between">
                          <span>Quote-part de recettes</span>
                          <strong className="text-[#E9C349] font-mono">{newCoprod.revenueShare}%</strong>
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={newCoprod.revenueShare}
                          onChange={(e) => setNewCoprod({ ...newCoprod, revenueShare: Number(e.target.value) })}
                          className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-gray-400 flex justify-between">
                          <span>Quota Invitations gratuites</span>
                          <strong className="text-white font-mono">{newCoprod.guestQuota} places</strong>
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={300}
                          value={newCoprod.guestQuota}
                          onChange={(e) => setNewCoprod({ ...newCoprod, guestQuota: Number(e.target.value) })}
                          className="w-full bg-[#111111] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isAddingCoprod}
                      onClick={handleAddCoproducer}
                      className="w-full py-2.5 rounded-xl bg-[#8A2BE2]/25 hover:bg-[#8A2BE2]/40 text-[#DCB8FF] border border-[#8A2BE2]/40 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      {isAddingCoprod ? (
                        <span>Enregistrement...</span>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Enregistrer cet Ayant-Droit pour l'Événement</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* ONGLET : PRÉ-INSCRIPTIONS & LEADS MARKETING */}
              {activeModalTab === 'preregistrations' && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  {/* En-tête récapitulatif & Badges */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-[#1E162D] to-[#12111A] border border-[#8A2BE2]/30">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold font-heading bg-[#E9C349]/20 text-[#E9C349] border border-[#E9C349]/30 flex items-center gap-1.5">
                          <span>🔥</span>
                          <span>{modalPreRegistrations.length} prospect{modalPreRegistrations.length > 1 ? 's' : ''} en attente</span>
                        </span>
                        {editingEvent.salesOpenAt && new Date(editingEvent.salesOpenAt).getTime() > Date.now() && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-[#8A2BE2]/20 text-[#DCB8FF] border border-[#8A2BE2]/30">
                            Compte à rebours actif
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-300">
                        Liste prioritaire des personnes ayant demandé à être alertées pour <strong className="text-white">{editingEvent.title}</strong>.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Bouton Copier Broadcast WhatsApp */}
                      <button
                        type="button"
                        onClick={() => {
                          const eventUrl = `https://billetterie.thiesdn.site/event/${editingEvent.id}`;
                          const broadcastText =
                            `🎉 *OUVERTURE OFFICIELLE DES VENTES !*\n\n` +
                            `Les billets pour l'événement *${editingEvent.title}* sont désormais en vente sur Thiès Days and Nights.\n\n` +
                            `📍 *Lieu :* ${editingEvent.venue}, ${editingEvent.city}\n` +
                            `📅 *Date :* ${editingEvent.date} à ${editingEvent.time}\n` +
                            `💰 *Tarif :* À partir de ${editingEvent.price.toLocaleString('fr-FR')} FCFA\n\n` +
                            `👉 *Réservez votre pass officiel 1-Clic Wave ici :*\n${eventUrl}`;

                          navigator.clipboard.writeText(broadcastText);
                          setCopiedBroadcast(true);
                          setTimeout(() => setCopiedBroadcast(false), 3000);
                        }}
                        className="px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
                        title="Copier le message prêt pour diffusion WhatsApp"
                      >
                        {copiedBroadcast ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Message copié !</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copier texte Diffusion</span>
                          </>
                        )}
                      </button>

                      {/* Bouton Exporter CSV */}
                      <button
                        type="button"
                        onClick={() => {
                          if (modalPreRegistrations.length === 0) return;
                          const headers = ['Nom', 'Telephone', 'Email', 'Date_Inscription', 'Evenement'];
                          const rows = modalPreRegistrations.map((p) => [
                            `"${(p.fullName || '').replace(/"/g, '""')}"`,
                            `"${(p.phone || '').replace(/"/g, '""')}"`,
                            `"${(p.email || '').replace(/"/g, '""')}"`,
                            `"${p.createdAt ? new Date(p.createdAt).toLocaleString('fr-FR') : ''}"`,
                            `"${(editingEvent.title || '').replace(/"/g, '""')}"`,
                          ]);
                          const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
                          const encodedUri = encodeURI(csvContent);
                          const link = document.createElement('a');
                          link.setAttribute('href', encodedUri);
                          link.setAttribute('download', `leads_${editingEvent.title.replace(/\s+/g, '_').toLowerCase()}.csv`);
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        disabled={modalPreRegistrations.length === 0}
                        className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/15 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-40"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Exporter CSV</span>
                      </button>
                    </div>
                  </div>

                  {/* Tableau des prospects */}
                  <div className="space-y-3">
                    {isLoadingPreReg ? (
                      <div className="p-8 text-center text-gray-400 text-xs">
                        Chargement des pré-inscriptions...
                      </div>
                    ) : modalPreRegistrations.length === 0 ? (
                      <div className="p-8 rounded-2xl bg-[#111111] border border-white/5 text-center space-y-2">
                        <Bell className="w-8 h-8 text-gray-600 mx-auto" />
                        <p className="text-xs text-gray-400 font-medium">
                          Aucun prospect pré-inscrit pour le moment.
                        </p>
                        <p className="text-[11px] text-gray-500 max-w-sm mx-auto">
                          Lorsque vous configurez une date d'ouverture des ventes ultérieure (mode compte à rebours), les clients peuvent laisser leur numéro pour être prévenus en priorité.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#111111]">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-white/10 bg-black/40 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                              <th className="py-3 px-3.5">Nom complet</th>
                              <th className="py-3 px-3.5">Téléphone / WhatsApp</th>
                              <th className="py-3 px-3.5">Email</th>
                              <th className="py-3 px-3.5">Date d'inscription</th>
                              <th className="py-3 px-3.5 text-right">Relance WhatsApp</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {modalPreRegistrations.map((lead) => {
                              // Normalisation du téléphone pour l'indicatif international Sénégal (+221)
                              const rawDigits = (lead.phone || '').replace(/\D/g, '');
                              const normalizedPhone = rawDigits.startsWith('221')
                                ? rawDigits
                                : rawDigits.length === 9
                                ? `221${rawDigits}`
                                : rawDigits;

                              const eventUrl = `https://billetterie.thiesdn.site/event/${editingEvent.id}`;
                              const personalizedMessage =
                                `Bonjour ${lead.fullName}, les ventes de billets pour l'événement *${editingEvent.title}* sont officiellement ouvertes sur ThièsDN ! ` +
                                `Réservez votre place dès maintenant en 1 clic : ${eventUrl}`;
                              const whatsappLink = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(personalizedMessage)}`;

                              const formattedDate = lead.createdAt
                                ? new Date(lead.createdAt).toLocaleDateString('fr-FR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '—';

                              return (
                                <tr key={lead.id} className="hover:bg-white/[0.02] transition-colors">
                                  <td className="py-3 px-3.5 font-bold text-white">
                                    {lead.fullName}
                                  </td>
                                  <td className="py-3 px-3.5 font-mono text-[#DCB8FF]">
                                    {lead.phone}
                                  </td>
                                  <td className="py-3 px-3.5 text-gray-400">
                                    {lead.email || '—'}
                                  </td>
                                  <td className="py-3 px-3.5 text-gray-400 font-mono text-[11px]">
                                    {formattedDate}
                                  </td>
                                  <td className="py-3 px-3.5 text-right">
                                    <a
                                      href={whatsappLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold transition-all hover:scale-105"
                                      title={`Envoyer une relance WhatsApp à ${lead.fullName}`}
                                    >
                                      <MessageCircle className="w-3.5 h-3.5 fill-current" />
                                      <span>Relancer (1-Clic)</span>
                                    </a>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ONGLET 3 : STATISTIQUES */}
              {activeModalTab === 'stats' && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  {isLoadingStats ? (
                    <div className="p-8 text-center text-gray-400 text-xs">
                      Calcul des statistiques en direct...
                    </div>
                  ) : (
                    <>
                      {/* 4 Cartes KPI */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                            <Ticket className="w-3 h-3 text-[#DCB8FF]" /> Billets Vendus
                          </p>
                          <p className="text-xl font-black text-white font-mono">
                            {modalStats.soldTickets}
                          </p>
                          <p className="text-[9px] text-gray-400">Places validées</p>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-black/40 border border-emerald-500/20 space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                            <DollarSign className="w-3 h-3" /> Chiffre d'Affaires
                          </p>
                          <p className="text-lg font-black text-emerald-400 font-mono">
                            {modalStats.grossCA.toLocaleString('fr-FR')} <span className="text-[10px]">F</span>
                          </p>
                          <p className="text-[9px] text-gray-400">Recettes brutes</p>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1">
                            <QrCode className="w-3 h-3" /> Scans Entrée
                          </p>
                          <p className="text-xl font-black text-cyan-300 font-mono">
                            {modalStats.scannedTickets}
                          </p>
                          <p className="text-[9px] text-gray-400">Validés au portique</p>
                        </div>

                        <div className="p-3.5 rounded-2xl bg-black/40 border border-amber-500/20 space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> Taux Présence
                          </p>
                          <p className="text-xl font-black text-amber-300 font-mono">
                            {modalStats.scanRate}%
                          </p>
                          <p className="text-[9px] text-gray-400">Taux de check-in</p>
                        </div>
                      </div>

                      {/* Dernières Transactions */}
                      <div className="p-4 rounded-2xl bg-black/30 border border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-white">Dernières Commandes Encaissées</p>
                          <span className="text-[10px] text-gray-400 font-mono">
                            {modalStats.ordersCount} commande(s) totale(s)
                          </span>
                        </div>

                        {modalStats.orders.length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-4">
                            Aucune commande enregistrée pour le moment.
                          </p>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {modalStats.orders.map((ord: any) => (
                              <div
                                key={ord.id}
                                className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between text-xs"
                              >
                                <div className="min-w-0">
                                  <p className="font-bold text-white truncate">
                                    {ord.customerName} • <span className="font-mono text-gray-400">{ord.reference}</span>
                                  </p>
                                  <p className="text-[10px] text-gray-400">
                                    {ord.tierName} (x{ord.quantity}) • {ord.customerPhone}
                                  </p>
                                </div>
                                <div className="text-right shrink-0 ml-2">
                                  <span className="font-mono font-bold text-emerald-400">
                                    {Number(ord.totalAmount).toLocaleString('fr-FR')} FCFA
                                  </span>
                                  <span className={`block text-[9px] font-bold uppercase ${
                                    ord.status === 'confirmed' || ord.status === 'paid' ? 'text-emerald-400' : 'text-amber-400'
                                  }`}>
                                    {ord.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ONGLET 4 : PARAMÈTRES & STATUT */}
              {activeModalTab === 'settings' && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  {/* Sélecteur Visuel de Statut */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                      Statut de Modération & Visibilité Publique
                    </label>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setEditForm({ ...editForm, status: 'approved' })}
                        className={`p-3 rounded-2xl border text-left transition-all ${
                          editForm.status === 'approved'
                            ? 'bg-emerald-500/20 border-emerald-400 text-white shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-400'
                            : 'bg-black/30 border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approuvé</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">Visible sur la billetterie publique</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditForm({ ...editForm, status: 'pending' })}
                        className={`p-3 rounded-2xl border text-left transition-all ${
                          editForm.status === 'pending'
                            ? 'bg-amber-500/20 border-amber-400 text-white shadow-lg shadow-amber-950/40 ring-1 ring-amber-400'
                            : 'bg-black/30 border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs text-amber-300">
                          <Clock className="w-3.5 h-3.5" />
                          <span>En Attente</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">En file de modération</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditForm({ ...editForm, status: 'rejected' })}
                        className={`p-3 rounded-2xl border text-left transition-all ${
                          editForm.status === 'rejected'
                            ? 'bg-rose-500/20 border-rose-400 text-white shadow-lg shadow-rose-950/40 ring-1 ring-rose-400'
                            : 'bg-black/30 border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs text-rose-400">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Rejeté</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">Refusé par l'administrateur</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditForm({ ...editForm, status: 'archived' })}
                        className={`p-3 rounded-2xl border text-left transition-all ${
                          editForm.status === 'archived'
                            ? 'bg-purple-500/20 border-purple-400 text-white shadow-lg shadow-purple-950/40 ring-1 ring-purple-400'
                            : 'bg-black/30 border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs text-purple-300">
                          <Archive className="w-3.5 h-3.5" />
                          <span>Archivé</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">Masqué, conservé en base</p>
                      </button>
                    </div>
                  </div>

                  {/* Contrôles de Vente & Mise en Avant */}
                  <div className="p-4 rounded-2xl bg-black/30 border border-white/10 space-y-4">
                    <p className="text-xs font-bold text-white">Contrôles Commerciaux & Visibilité</p>

                    {/* Toggle Ventes */}
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold text-white">Ventes de Billetterie Ouvertes</p>
                        <p className="text-[10px] text-gray-400">
                          Active ou suspend immédiatement les achats de billets en ligne sans dépublier la fiche
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditForm({ ...editForm, salesActive: !editForm.salesActive })}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          editForm.salesActive
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white/10 text-gray-400 hover:text-white'
                        }`}
                      >
                        {editForm.salesActive ? 'Ventes Actives' : 'Ventes Suspendues'}
                      </button>
                    </div>

                    {/* Toggle Vedette */}
                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/5">
                      <div>
                        <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <Star className="w-3.5 h-3.5 text-[#E9C349]" />
                          <span>Mettre en Une (Featured)</span>
                        </p>
                        <p className="text-[10px] text-gray-400">
                          Affiche cet événement en grand dans le carrousel principal d'accueil
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditForm({ ...editForm, featured: !editForm.featured })}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          editForm.featured
                            ? 'bg-[#E9C349] text-[#241A00]'
                            : 'bg-white/10 text-gray-400 hover:text-white'
                        }`}
                      >
                        {editForm.featured ? '⭐ En Vedette' : 'Standard'}
                      </button>
                    </div>
                  </div>

                  {/* Raccourcis Rapides */}
                  <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onPreviewEvent(editingEvent)}
                      className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-[#DCB8FF] flex items-center gap-1.5 transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Voir la page publique du festival</span>
                    </button>

                    <a
                      href={`https://billetterie.thiesdn.site/event/${editingEvent.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Lien officiel WhatsApp (/event/{editingEvent.id.slice(0, 8)}...)</span>
                    </a>
                  </div>

                  {/* Bloc Gestion des Billets Physiques & Impression */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-[#8A2BE2]/15 via-black/40 to-[#E9C349]/10 border border-[#8A2BE2]/30 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Printer className="w-4 h-4 text-[#E9C349]" />
                          <span>Gestion des Billets Physiques</span>
                        </p>
                        <p className="text-[10px] text-gray-300 mt-0.5">
                          Générez et imprimez des planches A4 de billets sécurisés avec l'affiche officielle en fond, QR code centré et code-barres laser 1D.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsPhysicalModalOpen(true)}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#8A2BE2] to-[#A855F7] hover:from-[#7824c7] hover:to-[#9333ea] text-white font-heading font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#8A2BE2]/30 transition-all shrink-0 hover:scale-[1.02]"
                      >
                        <Printer className="w-4 h-4 text-[#E9C349]" />
                        <span>Générer les QR Codes pour Impression</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              </div>
            </div>

            {/* Actions Footer Sticky Bottom */}
            <div className="sticky bottom-0 z-20 bg-[#14131A] border-t border-white/10 shrink-0 px-4 sm:px-8 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] shadow-xl">
              <div className="max-w-5xl mx-auto w-full flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setEditingEvent(null)}
                  className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-300 transition-colors"
                >
                  Fermer
                </button>

                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="btn-primary-glow px-6 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-2 transition-all shadow-lg shadow-[#8A2BE2]/20"
                >
                  {isSavingEdit ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Enregistrer toutes les modifications</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* MODALE DE CONFIRMATION DE SUPPRESSION / ARCHIVAGE (SOFT DELETE & HARD DELETE) */}
      {deletingEvent && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#141414] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl text-center relative overflow-hidden">
            <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/20 shadow-lg shadow-rose-950/30">
              <Trash2 className="w-8 h-8" />
            </div>

            <div>
              <div className="inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-300 border border-rose-500/25 mb-2">
                Action Critique • Événement
              </div>
              <h3 className="font-heading text-xl font-extrabold text-white">
                Supprimer ou Archiver ?
              </h3>
              <p className="text-sm font-semibold text-[#E9C349] mt-1 line-clamp-1">
                « {deletingEvent.title} »
              </p>
            </div>

            {/* Diagnostic Commandes & Traçabilité */}
            {isLoadingDeleteInfo ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-center gap-3 text-xs text-gray-400">
                <span className="w-4 h-4 border-2 border-[#8A2BE2] border-t-transparent rounded-full animate-spin" />
                <span>Vérification de l'intégrité comptable et des commandes en base...</span>
              </div>
            ) : deleteOrdersCount !== null && deleteOrdersCount > 0 ? (
              /* CAS 1 : >= 1 commande -> MODALE CONFORME SPÉCIFICATION THIÈSDN */
              <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl p-4 text-left space-y-3 animate-in fade-in">
                <div className="flex items-start gap-2.5 text-amber-300 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <span className="leading-snug">
                    Cet événement contient des transactions financières. Il sera archivé et retiré de la billetterie publique, mais son historique comptable restera conservé.
                  </span>
                </div>
                <div className="bg-black/30 rounded-xl p-2.5 text-[11px] text-gray-300 border border-white/5 flex items-center justify-between">
                  <span>Transactions rattachées :</span>
                  <span className="font-extrabold text-[#E9C349] font-mono">{deleteOrdersCount} commande(s)</span>
                </div>
              </div>
            ) : (
              /* CAS 2 : 0 commande -> Suppression totale autorisée */
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-left space-y-2">
                <div className="flex items-center gap-2 text-emerald-300 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Aucune commande financière rattachée (0 commande).</span>
                </div>
                <p className="text-[11px] text-gray-300 leading-relaxed">
                  Cet événement ne contient aucune transaction financière. La suppression totale de la base (Hard Delete SQL) est autorisée.
                </p>
              </div>
            )}

            {/* Message d'erreur explicite avec interception de clé étrangère */}
            {deleteErrorMessage && (
              <div className="bg-rose-950/60 border border-rose-500/40 rounded-2xl p-4 text-left space-y-2 animate-in shake">
                <div className="flex items-start gap-2.5 text-rose-300 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{deleteErrorMessage}</span>
                </div>
              </div>
            )}

            {/* Boutons d'actions conditionnels */}
            <div className="space-y-3 pt-2">
              {deleteOrdersCount !== null && deleteOrdersCount > 0 ? (
                /* ÉVÉNEMENT AVEC >= 1 COMMANDE : SOFT DELETE REQUIS */
                <>
                  <button
                    type="button"
                    disabled={isSoftDeleting}
                    onClick={handleConfirmSoftDelete}
                    className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-[#8A2BE2] via-[#7B24CC] to-[#E9C349]/90 hover:from-[#9D3CF2] hover:to-[#E9C349] text-white font-extrabold text-xs flex items-center justify-center gap-2.5 shadow-xl shadow-[#8A2BE2]/30 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isSoftDeleting ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Archive className="w-4 h-4 text-[#E9C349]" />
                        <span>Archiver l'Événement (Soft Delete)</span>
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-gray-400 text-center italic">
                    🔒 La suppression totale SQL est verrouillée pour garantir la réconciliation financière.
                  </p>
                </>
              ) : (
                /* ÉVÉNEMENT AVEC 0 COMMANDE : SUPPRESSION TOTALE AUTORISÉE */
                <>
                  <button
                    type="button"
                    disabled={isDeleting || isSoftDeleting}
                    onClick={handleConfirmHardDelete}
                    className="w-full py-3 px-5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-900/30 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isDeleting ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        <span>Supprimer Définitivement (Hard Delete SQL)</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isDeleting || isSoftDeleting}
                    onClick={handleConfirmSoftDelete}
                    className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Archive className="w-3.5 h-3.5 text-[#E9C349]" />
                    <span>Archiver plutôt (Soft Delete)</span>
                  </button>
                </>
              )}

              {/* Annuler */}
              <button
                type="button"
                disabled={isSoftDeleting || isDeleting}
                onClick={() => {
                  setDeletingEvent(null);
                  setDeleteErrorMessage(null);
                }}
                className="w-full py-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale de Génération des Billets Physiques Imprimables */}
      <PhysicalTicketsModal
        isOpen={isPhysicalModalOpen}
        onClose={() => setIsPhysicalModalOpen(false)}
        event={editingEvent}
      />
    </div>
  );
};
