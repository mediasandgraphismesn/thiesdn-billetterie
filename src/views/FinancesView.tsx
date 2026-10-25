import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  DollarSign,
  TrendingUp,
  Percent,
  Layers,
  Download,
  CheckCircle2,
  Clock,
  Smartphone,
  ShieldCheck,
  Database,
  Copy,
  Check,
  Key,
  ExternalLink,
  RefreshCw,
  Settings,
  Phone,
  AlertCircle,
  HelpCircle,
  BarChart3,
  MessageSquare,
  Users,
  QrCode,
  Sparkles,
  Calendar,
  MapPin,
  Send,
  Ticket,
  ChevronRight,
  ArrowRight,
  Printer,
  Store,
  Plus,
  X,
  FileText,
  CheckCheck,
  Truck,
  Scissors,
  Crown,
  Award,
} from 'lucide-react';
import {
  getStoredTransactions,
  TransactionRecord,
  SUPABASE_SQL_SCHEMA,
  saveSupabaseCredentials,
  isSupabaseConfigured,
  getSupabaseClient,
  getStoredOrders,
  fetchOrdersFromSupabase,
  getStoredPaymentSettings,
  savePaymentSettings,
  getStoredTickets,
  getStoredSalesAgents,
  createSalesAgent,
  generatePhysicalTicketBatch,
  assignTicketsToAgent,
  recordAgentSettlement,
  deactivateUnsoldPhysicalTickets,
  getStoredCoproducers,
  createCoproducer,
} from '../services/supabase';
import {
  PlatformPaymentSettings,
  OrderRecord,
  EventItem,
  UserTicket,
  SalesAgent,
  TicketTier,
  EventCoproducer,
  CoproducerRole,
} from '../types';
import { generatePhysicalTicketsPdf } from '../services/pdfTicketGenerator';
import { THIES_33_QUARTIERS } from '../data/thiesQuartiers';
import { SalesAgentDashboardView } from './SalesAgentDashboardView';
import { ArtistDashboardView } from './ArtistDashboardView';
import { AccreditationsView } from './AccreditationsView';
import { ScanStationsView } from './ScanStationsView';

interface FinancesViewProps {
  currentRole: 'user' | 'promoter' | 'admin';
  events?: EventItem[];
  promoterName?: string;
}

export const FinancesView: React.FC<FinancesViewProps> = ({
  currentRole,
  events = [],
  promoterName,
}) => {
  const [transactions, setTransactions] = useState<TransactionRecord[]>(getStoredTransactions());
  const [orders, setOrders] = useState<OrderRecord[]>(getStoredOrders());
  const [tickets, setTickets] = useState<UserTicket[]>(getStoredTickets());
  const [copiedSql, setCopiedSql] = useState(false);
  const [customUrl, setCustomUrl] = useState(
    localStorage.getItem('VITE_SUPABASE_URL') || ''
  );
  const [customKey, setCustomKey] = useState(
    localStorage.getItem('VITE_SUPABASE_ANON_KEY') || ''
  );
  const [connectionSaved, setConnectionSaved] = useState(false);
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    events: any[];
    error?: string;
  } | null>(null);

  // Configuration des numéros de paiement Wave & OM (Admin)
  const [paymentSettings, setLocalPaymentSettings] = useState<PlatformPaymentSettings>(
    getStoredPaymentSettings()
  );
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Pour le promoteur : choix entre "stats", "finances", "network", "unsold", "coprod", "accreditations" et "stations"
  const [promoterTab, setPromoterTab] = useState<'stats' | 'finances' | 'network' | 'unsold' | 'coprod' | 'accreditations' | 'stations'>('stats');
  const [selectedEventId, setSelectedEventId] = useState<string>('all');

  // ====================================================================
  // ÉTATS GESTION DU RÉSEAU & BILLETS PHYSIQUES
  // ====================================================================
  const [agents, setAgents] = useState<SalesAgent[]>(getStoredSalesAgents());
  const [coproducers, setCoproducers] = useState<EventCoproducer[]>(getStoredCoproducers());
  const [previewCoproducer, setPreviewCoproducer] = useState<EventCoproducer | null>(null);

  // Formulaire d'ajout rapide co-producteur dans Cockpit
  const [showAddCoprodModal, setShowAddCoprodModal] = useState(false);
  const [newCoprodName, setNewCoprodName] = useState('');
  const [newCoprodPhone, setNewCoprodPhone] = useState('');
  const [newCoprodRole, setNewCoprodRole] = useState<CoproducerRole>('artiste');
  const [newCoprodShare, setNewCoprodShare] = useState<number>(40);
  const [newCoprodGuestQuota, setNewCoprodGuestQuota] = useState<number>(20);
  const [isSavingCoprod, setIsSavingCoprod] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ current: number; total: number } | null>(null);
  const [batchCount, setBatchCount] = useState<number>(50);
  const [batchTierId, setBatchTierId] = useState<string>('');
  const [batchSuccessMessage, setBatchSuccessMessage] = useState<string | null>(null);

  // Modale d'ajout d'un point de vente / collaborateur
  const [showAddAgentModal, setShowAddAgentModal] = useState(false);
  const [newAgentShop, setNewAgentShop] = useState('');
  const [newAgentManager, setNewAgentManager] = useState('');
  const [newAgentPhone, setNewAgentPhone] = useState('');
  const [newAgentQuartier, setNewAgentQuartier] = useState('Escale Sud (Centre-Ville)');
  const [newAgentCommission, setNewAgentCommission] = useState(10);
  const [isSavingAgent, setIsSavingAgent] = useState(false);

  // Modale d'attribution de billets physiques
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedAgentForAssign, setSelectedAgentForAssign] = useState<SalesAgent | null>(null);
  const [assignCountInput, setAssignCountInput] = useState<number>(20);
  const [assignNotification, setAssignNotification] = useState<{ message: string; waUrl?: string } | null>(null);

  // Modale d'enregistrement de versement d'espèces
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [selectedAgentForSettlement, setSelectedAgentForSettlement] = useState<SalesAgent | null>(null);
  const [settlementAmountInput, setSettlementAmountInput] = useState<number>(0);

  // Aperçu du Guichet Vendeur Mobile
  const [previewAgent, setPreviewAgent] = useState<SalesAgent | null>(null);

  const isConnected = isSupabaseConfigured();

  useEffect(() => {
    setTickets(getStoredTickets());
    setAgents(getStoredSalesAgents());
    setCoproducers(getStoredCoproducers());
    fetchOrdersFromSupabase().then((res) => {
      if (res.orders && res.orders.length > 0) {
        setOrders(res.orders);
      }
    });
  }, []);

  const handleRefresh = async () => {
    setTransactions(getStoredTransactions());
    setTickets(getStoredTickets());
    setAgents(getStoredSalesAgents());
    setCoproducers(getStoredCoproducers());
    const res = await fetchOrdersFromSupabase();
    if (res.orders && res.orders.length > 0) {
      setOrders(res.orders);
    } else {
      setOrders(getStoredOrders());
    }
  };

  const handleSavePaymentSettings = (e: React.FormEvent) => {
    e.preventDefault();
    savePaymentSettings(paymentSettings);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  const handleSaveSupabase = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseCredentials(customUrl, customKey);
    setConnectionSaved(true);
    setTimeout(() => setConnectionSaved(false), 3000);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleTestSupabaseLive = async () => {
    setIsTestingSupabase(true);
    setTestResult(null);

    const client = getSupabaseClient();
    if (!client) {
      setTestResult({
        success: false,
        message: 'Clés Supabase manquantes ou non valides.',
        events: [],
        error: 'Veuillez renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.',
      });
      setIsTestingSupabase(false);
      return;
    }

    try {
      const { data, error } = await client
        .from('events')
        .select('*')
        .eq('status', 'approved');

      if (error) {
        setTestResult({
          success: false,
          message: `Erreur Supabase: ${error.message}`,
          events: [],
          error: error.message,
        });
      } else {
        setTestResult({
          success: true,
          message: `Connexion Supabase réussie ! ${data?.length || 0} événements trouvés`,
          events: data || [],
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'Erreur inattendue de connexion réseau.',
        events: [],
        error: err.message,
      });
    } finally {
      setIsTestingSupabase(false);
    }
  };

  // ====================================================================
  // CALCULS DU COCKPIT PROMOTEUR
  // ====================================================================
  const promoterEvents = useMemo(() => {
    if (!events || events.length === 0) return [];
    if (!promoterName) return events;
    const filtered = events.filter((e) =>
      e.promoter.name.toLowerCase().includes(promoterName.toLowerCase())
    );
    return filtered.length > 0 ? filtered : events;
  }, [events, promoterName]);

  const activeEvent = useMemo(() => {
    if (selectedEventId === 'all') return promoterEvents[0] || null;
    return promoterEvents.find((e) => e.id === selectedEventId) || promoterEvents[0] || null;
  }, [promoterEvents, selectedEventId]);

  // Commandes filtrées pour le promoteur
  const filteredOrders = useMemo(() => {
    if (selectedEventId === 'all') return orders;
    return orders.filter((o) => o.eventId === selectedEventId);
  }, [orders, selectedEventId]);

  const confirmedOrders = useMemo(() => {
    return filteredOrders.filter((o) => o.status === 'confirmed');
  }, [filteredOrders]);

  // Billets correspondants
  const filteredTickets = useMemo(() => {
    if (selectedEventId === 'all') return tickets;
    return tickets.filter((t) => t.eventId === selectedEventId);
  }, [tickets, selectedEventId]);

  const scannedTicketsCount = useMemo(() => {
    return filteredTickets.filter((t) => t.status === 'used').length;
  }, [filteredTickets]);

  const totalTicketsSold = useMemo(() => {
    const fromOrders = confirmedOrders.reduce((acc, o) => acc + o.quantity, 0);
    return fromOrders > 0 ? fromOrders : filteredTickets.length;
  }, [confirmedOrders, filteredTickets]);

  const totalGrossCA = useMemo(() => {
    return confirmedOrders.reduce((acc, o) => acc + o.totalAmount, 0);
  }, [confirmedOrders]);

  const promoterNetShare = Math.round(totalGrossCA * 0.9);
  const platformFeeShare = Math.round(totalGrossCA * 0.1);

  // Ventilation par Catégories (Prévente, Jour J, VIP)
  const statsByCategory = useMemo(() => {
    // 1. Prévente
    const preventeOrders = confirmedOrders.filter(
      (o) =>
        o.tierName.toLowerCase().includes('prévente') ||
        o.tierName.toLowerCase().includes('prevente')
    );
    const preventeSold = preventeOrders.reduce((acc, o) => acc + o.quantity, 0);
    const preventeCA = preventeOrders.reduce((acc, o) => acc + o.totalAmount, 0);
    const preventeQuota =
      activeEvent?.tiers?.find(
        (t) => t.id === 't-prev' || t.name.toLowerCase().includes('prévente')
      )?.available || 150;

    // 2. Jour J
    const jourJOrders = confirmedOrders.filter((o) =>
      o.tierName.toLowerCase().includes('jour')
    );
    const jourJSold = jourJOrders.reduce((acc, o) => acc + o.quantity, 0);
    const jourJCA = jourJOrders.reduce((acc, o) => acc + o.totalAmount, 0);
    const jourJQuota =
      activeEvent?.tiers?.find(
        (t) => t.id === 't-jour' || t.name.toLowerCase().includes('jour')
      )?.available || 200;

    // 3. VIP Prestige
    const vipOrders = confirmedOrders.filter((o) =>
      o.tierName.toLowerCase().includes('vip')
    );
    const vipSold = vipOrders.reduce((acc, o) => acc + o.quantity, 0);
    const vipCA = vipOrders.reduce((acc, o) => acc + o.totalAmount, 0);
    const vipQuota =
      activeEvent?.tiers?.find(
        (t) => t.id === 't-vip' || t.name.toLowerCase().includes('vip')
      )?.available || 50;

    return {
      prevente: { sold: preventeSold, quota: preventeQuota, ca: preventeCA },
      jourJ: { sold: jourJSold, quota: jourJQuota, ca: jourJCA },
      vip: { sold: vipSold, quota: vipQuota, ca: vipCA },
    };
  }, [confirmedOrders, activeEvent]);

  // Message WhatsApp global pour contacter tous les clients de l'événement
  const generateBroadcastWhatsAppUrl = () => {
    const eventTitle = activeEvent ? activeEvent.title : 'votre événement Thièsdn';
    const eventDate = activeEvent ? `${activeEvent.date} à ${activeEvent.time}` : 'très prochainement';
    const eventVenue = activeEvent ? `${activeEvent.venue}, ${activeEvent.city}` : 'dans votre salle';

    const message =
      `🌟 *RAPPEL OFFICIEL - THIÈSDN BILLETTERIE* 🇸🇳\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Bonjour cher festivalier !\n\n` +
      `Nous vous rappelons que la soirée *${eventTitle}* a lieu ce :\n` +
      `📅 *Date & Heure :* ${eventDate}\n` +
      `📍 *Lieu :* ${eventVenue}\n\n` +
      `🎫 *Consignes d'accès :*\n` +
      `• Pensez à charger votre smartphone pour présenter votre pass QR Code unique à l'entrée.\n` +
      `• Votre pass officiel est accessible en direct sur https://thiesdn.mgartswork.site/ (onglet "Mes Billets").\n` +
      `• L'accueil prioritaire débutera dès l'ouverture des portes.\n\n` +
      `Toute l'équipe vous attend pour vivre un moment d'exception !\n` +
      `✨ *Production & Thièsdn Billetterie*`;

    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  };

  // Message WhatsApp personnalisé pour un client spécifique
  const generateClientWhatsAppUrl = (order: OrderRecord) => {
    const cleanPhone = order.customerPhone ? order.customerPhone.replace(/[^0-9]/g, '') : '';
    const message =
      `Bonjour ${order.customerName} ! 🌟\n` +
      `Rappel officiel pour votre réservation *${order.eventTitle}* (Réf: ${order.reference}).\n` +
      `Formule : ${order.tierName} (${order.quantity} place(s)).\n` +
      `Retrouvez votre pass QR Code sur https://thiesdn.mgartswork.site/ (onglet Mes Billets).\n` +
      `À très vite pour une soirée inoubliable !`;

    const phoneParam = cleanPhone.length >= 9 ? cleanPhone : '';
    return phoneParam
      ? `https://wa.me/${phoneParam}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
  };

  // ====================================================================
  // CALCULS DU RÉSEAU DE VENTE & BILLETS PHYSIQUES
  // ====================================================================
  const networkAgents = useMemo(() => {
    if (!activeEvent) return agents;
    return agents.filter((a) => !a.eventId || a.eventId === activeEvent.id);
  }, [agents, activeEvent]);

  // Billets physiques de l'événement actif
  const eventPhysicalTickets = useMemo(() => {
    if (!activeEvent) return tickets.filter((t) => t.isPhysical);
    return tickets.filter((t) => t.isPhysical && t.eventId === activeEvent.id);
  }, [tickets, activeEvent]);

  // Billets imprimés en stock promoteur non encore alloués
  const unassignedPhysicalTickets = useMemo(() => {
    return eventPhysicalTickets.filter((t) => t.status === 'physical_printed');
  }, [eventPhysicalTickets]);

  // Billets alloués aux points de vente
  const allocatedPhysicalTickets = useMemo(() => {
    return eventPhysicalTickets.filter((t) => t.status === 'physical_allocated');
  }, [eventPhysicalTickets]);

  // Billets physiques vendus ou scannés
  const soldPhysicalTickets = useMemo(() => {
    return eventPhysicalTickets.filter(
      (t) =>
        t.status === 'sold_valid' ||
        t.status === 'physical_sold' ||
        t.status === 'scanned' ||
        t.status === 'used'
    );
  }, [eventPhysicalTickets]);

  // Billets physiques non vendus (inactifs) pour l'événement sélectionné
  const totalUnsoldTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchEvt = !activeEvent || t.eventId === activeEvent.id;
      return (
        matchEvt &&
        t.isPhysical &&
        (t.status === 'printed_not_sold' ||
          t.status === 'physical_allocated' ||
          t.status === 'physical_printed')
      );
    }).length;
  }, [tickets, activeEvent]);

  // Statistiques détaillées des Billets Physiques Non Vendus par Collaborateur
  const physicalTicketsByAgent = useMemo(() => {
    return networkAgents.map((ag) => {
      const allocated = tickets.filter((t) => t.isPhysical && t.agentId === ag.id);
      const printedCount = allocated.length > 0 ? allocated.length : ag.allocatedCount;
      const soldCount = allocated.filter(
        (t) =>
          t.status === 'sold_valid' ||
          t.status === 'physical_sold' ||
          t.status === 'scanned' ||
          t.status === 'used'
      ).length;
      const unsoldCount = allocated.filter(
        (t) =>
          t.status === 'printed_not_sold' ||
          t.status === 'physical_allocated' ||
          t.status === 'physical_printed'
      ).length;
      const cancelledCount = allocated.filter((t) => t.status === 'cancelled').length;

      return {
        agent: ag,
        printedCount,
        soldCount: soldCount > 0 ? soldCount : ag.soldCount,
        unsoldCount: unsoldCount > 0 ? unsoldCount : Math.max(0, printedCount - ag.soldCount),
        cancelledCount,
      };
    });
  }, [networkAgents, tickets]);

  const [deactivateSuccessMessage, setDeactivateSuccessMessage] = useState<string | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);

  const handleDeactivateUnsoldTickets = async (agentId?: string) => {
    const targetAgent = agentId ? networkAgents.find((a) => a.id === agentId) : null;
    const confirmPrompt = targetAgent
      ? `Êtes-vous sûr de vouloir désactiver TOUS les billets physiques non vendus confiés à "${targetAgent.pointDeVente}" ?\n\nCette action protégera l'événement contre les vols et fraudes : tout QR code scanné à l'entrée sera immédiatement REFUSÉ.`
      : `Êtes-vous sûr de vouloir désactiver TOUS les billets physiques non vendus pour cet événement (${totalUnsoldTickets} billets) ?\n\nCette action sécurisera vos entrées avant l'ouverture des portes. Tout scan d'un billet non vendu sera rejeté.`;

    if (!window.confirm(confirmPrompt)) return;

    setIsDeactivating(true);
    setDeactivateSuccessMessage(null);

    const res = await deactivateUnsoldPhysicalTickets(activeEvent?.id || 'all', agentId);
    setIsDeactivating(false);

    if (res.success) {
      setDeactivateSuccessMessage(res.message);
      setTickets(getStoredTickets());
      setAgents(getStoredSalesAgents());
    }
  };

  // Totaux financiers du réseau
  const networkTotalGrossCollected = useMemo(() => {
    return networkAgents.reduce((sum, a) => sum + (a.cashCollected || 0), 0);
  }, [networkAgents]);

  const networkTotalAmountDue = useMemo(() => {
    return networkAgents.reduce((sum, a) => sum + (a.amountDue || 0), 0);
  }, [networkAgents]);

  const networkTotalPaid = useMemo(() => {
    return networkAgents.reduce((sum, a) => sum + (a.amountPaidToPromoter || 0), 0);
  }, [networkAgents]);

  const networkTotalCommissions = useMemo(() => {
    return networkAgents.reduce((sum, a) => {
      const comm = Math.round(a.cashCollected * (a.commissionPercent / 100));
      return sum + comm;
    }, 0);
  }, [networkAgents]);

  // Action : Génération du lot de billets physiques + Téléchargement PDF A4
  const handleGeneratePhysicalBatch = async () => {
    if (!activeEvent) return;
    const tier = activeEvent.tiers?.find((t) => t.id === batchTierId) || activeEvent.tiers?.[0];
    if (!tier) return;

    setIsGeneratingPdf(true);
    setPdfProgress({ current: 0, total: batchCount });
    setBatchSuccessMessage(null);

    try {
      // 1. Créer le lot en base Supabase & mémoire
      const res = await generatePhysicalTicketBatch(
        activeEvent,
        tier,
        batchCount,
        activeEvent.promoter.id
      );

      // 2. Générer le document PDF haute définition
      const pdfBlob = await generatePhysicalTicketsPdf(activeEvent, tier, res.tickets, {
        batchName: res.tickets[0]?.batchNumber,
        onProgress: (current, total) => setPdfProgress({ current, total }),
      });

      // 3. Téléchargement immédiat
      const blobUrl = URL.createObjectURL(pdfBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      const cleanTitle = activeEvent.title.replace(/[^a-zA-Z0-9]/g, '_');
      const cleanTier = tier.name.replace(/[^a-zA-Z0-9]/g, '_');
      downloadLink.download = `Billets_A4_${cleanTitle}_${cleanTier}_${batchCount}pcs.pdf`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(blobUrl);

      // 4. Mettre à jour l'interface
      setTickets(getStoredTickets());
      setBatchSuccessMessage(
        `🎉 Lot de ${res.tickets.length} billets généré avec succès ! Le PDF A4 prêt pour impression haute définition a été téléchargé.`
      );
    } catch (err: any) {
      console.error('Erreur génération lot physique:', err);
      alert("Erreur lors de la génération du PDF d'impression.");
    } finally {
      setIsGeneratingPdf(false);
      setPdfProgress(null);
    }
  };

  // Action : Création d'un collaborateur
  const handleCreateSalesAgentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentShop.trim() || !newAgentManager.trim() || !newAgentPhone.trim()) {
      alert('Veuillez renseigner tous les champs obligatoires.');
      return;
    }

    setIsSavingAgent(true);
    try {
      const res = await createSalesAgent({
        eventId: activeEvent?.id || 'evt-thies-01',
        eventTitle: activeEvent?.title || 'Événement Thièsdn',
        promoterId: activeEvent?.promoter.id || 'usr-promoter-1',
        pointDeVente: newAgentShop.trim(),
        gerantName: newAgentManager.trim(),
        telephone: newAgentPhone.trim(),
        quartier: newAgentQuartier,
        commissionPercent: Number(newAgentCommission) || 10,
      });

      if (res.success && res.agent) {
        setAgents(getStoredSalesAgents());
        setShowAddAgentModal(false);
        setNewAgentShop('');
        setNewAgentManager('');
        setNewAgentPhone('');
        setNewAgentCommission(10);
      }
    } catch (err) {
      console.error('Erreur création collaborateur:', err);
    } finally {
      setIsSavingAgent(false);
    }
  };

  // Action : Attribution de billets
  const handleAssignTicketsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentForAssign) return;

    const count = Number(assignCountInput);
    if (isNaN(count) || count <= 0) {
      alert('Veuillez saisir un nombre valide de billets.');
      return;
    }

    const res = await assignTicketsToAgent(selectedAgentForAssign.id, count);
    if (res.success) {
      setTickets(getStoredTickets());
      setAgents(getStoredSalesAgents());

      // Construire le lien WhatsApp d'attribution
      const cleanPhone = selectedAgentForAssign.telephone.replace(/[^0-9]/g, '');
      const eventTitle = activeEvent ? activeEvent.title : 'Événement Thièsdn';
      const message =
        `🎟️ *NOUVEAU STOCK DE BILLETS PHYSIQUES - THIÈSDN* 🇸🇳\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `Bonjour ${selectedAgentForAssign.gerantName} (${selectedAgentForAssign.pointDeVente}) !\n\n` +
        `Nous venons de vous confier un nouveau lot de *${res.assignedCount} billets physiques* pour :\n` +
        `🎪 *Événement :* ${eventTitle}\n` +
        `📍 *Lieu :* ${activeEvent ? activeEvent.venue : 'Thiès'}\n` +
        `💰 *Votre commission commerçant :* ${selectedAgentForAssign.commissionPercent}%\n\n` +
        `📱 Retrouvez votre guichet et déclarez vos ventes en temps réel :\n` +
        `https://thiesdn.mgartswork.site/\n\n` +
        `Bonnes ventes à ${selectedAgentForAssign.quartier} !`;

      const waUrl = cleanPhone.length >= 9
        ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`;

      setAssignNotification({ message: res.message, waUrl });
      setShowAssignModal(false);
    } else {
      alert(res.message);
    }
  };

  // Action : Enregistrement de versement
  const handleRecordSettlementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentForSettlement) return;
    const amount = Number(settlementAmountInput);
    if (isNaN(amount) || amount <= 0) {
      alert('Veuillez saisir un montant valide.');
      return;
    }

    const res = await recordAgentSettlement(selectedAgentForSettlement.id, amount);
    if (res.success) {
      setAgents(getStoredSalesAgents());
      setShowSettlementModal(false);
      setSettlementAmountInput(0);
      setSelectedAgentForSettlement(null);
    } else {
      alert(res.message);
    }
  };

  // Génération de lien WhatsApp de récapitulatif collaborateur
  const generateAgentWhatsAppReportUrl = (agent: SalesAgent) => {
    const cleanPhone = agent.telephone.replace(/[^0-9]/g, '');
    const remaining = Math.max(0, agent.allocatedCount - agent.soldCount);
    const commFcfa = Math.round(agent.cashCollected * (agent.commissionPercent / 100));
    const eventTitle = activeEvent ? activeEvent.title : 'votre événement';

    const message =
      `📋 *RÉCAPITULATIF DES VENTES RÉSEAU - THIÈSDN* 🇸🇳\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Point de Vente : *${agent.pointDeVente}*\n` +
      `Gérant : ${agent.gerantName} (${agent.quartier})\n` +
      `Événement : ${eventTitle}\n\n` +
      `📊 *État des Stocks :*\n` +
      `• Billets confiés : ${agent.allocatedCount}\n` +
      `• Billets vendus : ${agent.soldCount}\n` +
      `• Stock restant en boutique : ${remaining}\n\n` +
      `💰 *Situation Financière :*\n` +
      `• Espèces encaissées : ${agent.cashCollected.toLocaleString('fr-FR')} FCFA\n` +
      `• Votre commission (${agent.commissionPercent}%) : ${commFcfa.toLocaleString('fr-FR')} FCFA\n` +
      `• Déjà reversé : ${agent.amountPaidToPromoter.toLocaleString('fr-FR')} FCFA\n` +
      `👉 *Reste net à verser au promoteur :* ${agent.amountDue.toLocaleString('fr-FR')} FCFA\n\n` +
      `Merci pour votre collaboration et excellente suite de journée !`;

    const phoneParam = cleanPhone.length >= 9 ? cleanPhone : '';
    return phoneParam
      ? `https://wa.me/${phoneParam}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
  };

  // ====================================================================
  // CALCULS GLOBAUX PLATEFORME (ADMIN)
  // ====================================================================
  const totalVolumeConfirmed = transactions.reduce((acc, t) => acc + t.totalAmount, 0);
  const totalPromoterShare = transactions.reduce((acc, t) => acc + t.promoterShare, 0);
  const totalPlatformFee = transactions.reduce((acc, t) => acc + t.platformFee, 0);

  const signaledOrders = orders.filter((o) => o.status === 'payment_signaled');
  const signaledVolume = signaledOrders.reduce((acc, o) => acc + o.totalAmount, 0);

  // ====================================================================
  // 1. VUE PROMOTEUR : LE COCKPIT ORGANISATEUR & STATISTIQUES EN DIRECT
  // ====================================================================
  if (currentRole === 'promoter') {
    return (
      <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-in fade-in duration-300">
        {/* Header Bar Promoteur */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-[#E9C349]/20 text-[#E9C349] text-xs font-extrabold uppercase px-3 py-1 rounded-full border border-[#E9C349]/30 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Le Cockpit Organisateur</span>
              </span>
              <span className="bg-[#8A2BE2]/20 text-[#DCB8FF] text-xs font-bold px-2.5 py-0.5 rounded-full border border-[#8A2BE2]/30">
                Mode Promoteur Actif
              </span>
            </div>
            <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-2">
              Tableau de Bord & Cockpit des Ventes
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Statistiques temps réel, ventilation par catégorie, taux de scan et relance WhatsApp de vos clients.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={handleRefresh}
              className="px-3.5 py-2 rounded-xl bg-[#1F1F1F] hover:bg-[#2A2A2A] border border-white/10 text-xs font-bold text-white flex items-center gap-2 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#8A2BE2]" />
              <span>Actualiser</span>
            </button>
          </div>
        </div>

        {/* Barre d'onglets du Cockpit Promoteur */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex bg-[#1C1B1B] p-1 rounded-2xl border border-white/10 self-start sm:self-auto">
            <button
              onClick={() => setPromoterTab('stats')}
              className={`px-4 py-2 rounded-xl text-xs font-heading font-extrabold tracking-wider uppercase transition-all flex items-center gap-2 ${
                promoterTab === 'stats'
                  ? 'bg-[#E9C349] text-[#241A00] shadow-md shadow-[#E9C349]/20'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Mes Statistiques (Cockpit)</span>
            </button>

            <button
              onClick={() => setPromoterTab('finances')}
              className={`px-4 py-2 rounded-xl text-xs font-heading font-extrabold tracking-wider uppercase transition-all flex items-center gap-2 ${
                promoterTab === 'finances'
                  ? 'bg-[#8A2BE2] text-white shadow-md shadow-[#8A2BE2]/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>Mes Ventes & Reversements (90%)</span>
            </button>

            <button
              onClick={() => setPromoterTab('network')}
              className={`px-4 py-2 rounded-xl text-xs font-heading font-extrabold tracking-wider uppercase transition-all flex items-center gap-2 ${
                promoterTab === 'network'
                  ? 'bg-gradient-to-r from-[#8A2BE2] to-[#E9C349] text-white shadow-md shadow-[#8A2BE2]/40'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>Réseau & Billets Physiques</span>
              <span className="bg-white/20 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                {networkAgents.length}
              </span>
            </button>

            <button
              onClick={() => setPromoterTab('unsold')}
              className={`px-4 py-2 rounded-xl text-xs font-heading font-extrabold tracking-wider uppercase transition-all flex items-center gap-2 ${
                promoterTab === 'unsold'
                  ? 'bg-gradient-to-r from-amber-600 to-rose-600 text-white shadow-md shadow-amber-500/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <AlertCircle className="w-4 h-4" />
              <span>Billets Non Vendus</span>
              <span className="bg-white/20 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                {totalUnsoldTickets}
              </span>
            </button>

            <button
              onClick={() => setPromoterTab('coprod')}
              className={`px-4 py-2 rounded-xl text-xs font-heading font-extrabold tracking-wider uppercase transition-all flex items-center gap-2 ${
                promoterTab === 'coprod'
                  ? 'bg-gradient-to-r from-[#E9C349] to-amber-500 text-[#241A00] shadow-md shadow-[#E9C349]/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Crown className="w-4 h-4" />
              <span>Co-Production & Artiste</span>
              <span className="bg-white/20 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                {coproducers.filter((c) => !activeEvent || c.eventId === activeEvent.id).length}
              </span>
            </button>

            <button
              onClick={() => setPromoterTab('accreditations')}
              className={`px-4 py-2 rounded-xl text-xs font-heading font-extrabold tracking-wider uppercase transition-all flex items-center gap-2 ${
                promoterTab === 'accreditations'
                  ? 'bg-gradient-to-r from-[#8A2BE2] to-indigo-600 text-white shadow-md shadow-[#8A2BE2]/40'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Accréditations</span>
            </button>

            <button
              onClick={() => setPromoterTab('stations')}
              className={`px-4 py-2 rounded-xl text-xs font-heading font-extrabold tracking-wider uppercase transition-all flex items-center gap-2 ${
                promoterTab === 'stations'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-4 h-4" />
              <span>Postes de Contrôle</span>
            </button>
          </div>

          {/* Sélecteur d'Événement pour filtrer les statistiques */}
          {promoterEvents.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-bold hidden sm:inline">Événement :</span>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="bg-[#1C1B1B] border border-white/10 text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-[#E9C349] font-medium"
              >
                <option value="all">Tous mes événements cumulés</option>
                {promoterEvents.map((evt) => (
                  <option key={evt.id} value={evt.id}>
                    {evt.title} ({evt.city})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* SOUS-VUE 1 : MES STATISTIQUES (LE COCKPIT) */}
        {promoterTab === 'stats' && (
          <div className="space-y-6">
            {/* Bannière d'Action WhatsApp : "Contacter mes clients" */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-[#1C1B1B] to-emerald-950/20 border border-emerald-500/30 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 fill-current" />
                  </div>
                  <h3 className="font-heading font-extrabold text-base sm:text-lg text-white">
                    Canal Direct WhatsApp - Rappel des Festivaliers
                  </h3>
                </div>
                <p className="text-xs text-gray-300 max-w-xl leading-relaxed">
                  Envoyez en un clic un message de rappel pré-rempli à vos festivaliers pour leur rappeler la date, le lieu et les inciter à préparer leur QR Code à l'entrée.
                </p>
              </div>

              <a
                href={generateBroadcastWhatsAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-heading font-extrabold text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/30 hover:scale-[1.02] active:scale-[0.98] shrink-0"
              >
                <Send className="w-4 h-4" />
                <span>Contacter mes clients (WhatsApp)</span>
              </a>
            </div>

            {/* 4 Cartes KPI Temps Réel du Cockpit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Billets Vendus Totaux */}
              <div className="glass-panel p-5 rounded-2xl border border-sky-500/30 space-y-2 relative overflow-hidden bg-sky-950/20">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
                  <Ticket className="w-5 h-5" />
                </div>
                <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">Billets Vendus</p>
                <h3 className="font-heading text-2xl font-black text-white">
                  {totalTicketsSold} <span className="text-xs text-sky-400 font-bold">places</span>
                </h3>
                <p className="text-[11px] text-gray-400">Total réservations confirmées</p>
              </div>

              {/* 2. Chiffre d'Affaires Brut */}
              <div className="glass-panel p-5 rounded-2xl border border-emerald-500/30 space-y-2 relative overflow-hidden bg-emerald-950/20">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <DollarSign className="w-5 h-5" />
                </div>
                <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">CA Brut Généré</p>
                <h3 className="font-heading text-2xl font-black text-emerald-300">
                  {totalGrossCA.toLocaleString('fr-FR')} <span className="text-xs text-white font-bold">FCFA</span>
                </h3>
                <p className="text-[11px] text-gray-400">Volume total encaissé Wave</p>
              </div>

              {/* 3. Reversement Net Promoteur (90%) */}
              <div className="glass-panel p-5 rounded-2xl border border-[#E9C349]/30 space-y-2 relative overflow-hidden bg-[#241A00]/40">
                <div className="w-10 h-10 rounded-xl bg-[#E9C349]/20 text-[#E9C349] flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">Net Promoteur (90%)</p>
                <h3 className="font-heading text-2xl font-black text-[#E9C349]">
                  {promoterNetShare.toLocaleString('fr-FR')} <span className="text-xs text-white font-bold">FCFA</span>
                </h3>
                <p className="text-[11px] text-gray-400">Reversement garanti sous 24h</p>
              </div>

              {/* 4. Billets Scannés à l'Entrée */}
              <div className="glass-panel p-5 rounded-2xl border border-[#8A2BE2]/30 space-y-2 relative overflow-hidden bg-[#1F1728]/40">
                <div className="w-10 h-10 rounded-xl bg-[#8A2BE2]/20 text-[#DCB8FF] flex items-center justify-center">
                  <QrCode className="w-5 h-5" />
                </div>
                <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">Billets Scannés</p>
                <h3 className="font-heading text-2xl font-black text-[#DCB8FF]">
                  {scannedTicketsCount} <span className="text-xs text-gray-400 font-bold">/ {totalTicketsSold}</span>
                </h3>
                <p className="text-[11px] text-gray-400">
                  {totalTicketsSold > 0
                    ? `${Math.round((scannedTicketsCount / totalTicketsSold) * 100)}% de taux de présence`
                    : 'Contrôle le jour J'}
                </p>
              </div>
            </div>

            {/* Ventilation par Catégorie de Billets (Prévente, Jour J, VIP) */}
            <div className="glass-panel p-6 rounded-3xl space-y-5 border border-white/10">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[#E9C349]" />
                  <h3 className="font-heading font-extrabold text-base text-white">
                    Ventes par Catégorie de Billet (Jauges en Direct)
                  </h3>
                </div>
                <span className="text-xs text-gray-400">Temps Réel</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* 1. Pass Prévente */}
                <div className="p-4 rounded-2xl bg-black/40 border border-sky-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                      Pass Prévente
                    </span>
                    <span className="text-xs font-bold text-white font-heading">
                      {statsByCategory.prevente.sold} vendus
                    </span>
                  </div>

                  {/* Barre de progression */}
                  <div className="w-full bg-[#1F1F1F] rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-sky-400 h-2.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          (statsByCategory.prevente.sold / (statsByCategory.prevente.quota || 1)) * 100
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-xs text-gray-400 pt-1">
                    <span>Quota restant : {Math.max(0, statsByCategory.prevente.quota - statsByCategory.prevente.sold)}</span>
                    <span className="font-extrabold text-[#E9C349] font-mono">
                      {statsByCategory.prevente.ca.toLocaleString('fr-FR')} F
                    </span>
                  </div>
                </div>

                {/* 2. Pass Jour J */}
                <div className="p-4 rounded-2xl bg-black/40 border border-[#8A2BE2]/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#DCB8FF] uppercase tracking-wider">
                      Pass Jour J
                    </span>
                    <span className="text-xs font-bold text-white font-heading">
                      {statsByCategory.jourJ.sold} vendus
                    </span>
                  </div>

                  <div className="w-full bg-[#1F1F1F] rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-[#8A2BE2] h-2.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          (statsByCategory.jourJ.sold / (statsByCategory.jourJ.quota || 1)) * 100
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-xs text-gray-400 pt-1">
                    <span>Quota restant : {Math.max(0, statsByCategory.jourJ.quota - statsByCategory.jourJ.sold)}</span>
                    <span className="font-extrabold text-[#E9C349] font-mono">
                      {statsByCategory.jourJ.ca.toLocaleString('fr-FR')} F
                    </span>
                  </div>
                </div>

                {/* 3. Pass VIP Prestige */}
                <div className="p-4 rounded-2xl bg-black/40 border border-[#E9C349]/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#E9C349] uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      Pass VIP Prestige
                    </span>
                    <span className="text-xs font-bold text-white font-heading">
                      {statsByCategory.vip.sold} vendus
                    </span>
                  </div>

                  <div className="w-full bg-[#1F1F1F] rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-[#E9C349] h-2.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          (statsByCategory.vip.sold / (statsByCategory.vip.quota || 1)) * 100
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-xs text-gray-400 pt-1">
                    <span>Quota restant : {Math.max(0, statsByCategory.vip.quota - statsByCategory.vip.sold)}</span>
                    <span className="font-extrabold text-[#E9C349] font-mono">
                      {statsByCategory.vip.ca.toLocaleString('fr-FR')} F
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Liste des Festivaliers / Commandes avec Relance WhatsApp Individuelle */}
            <div className="glass-panel p-6 rounded-3xl space-y-4 border border-white/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-heading font-extrabold text-base text-white">
                    Liste des Participants & Contact Direct ({filteredOrders.length})
                  </h3>
                </div>
                <span className="text-xs text-gray-400">
                  Cliquez sur l'icône WhatsApp pour envoyer un rappel personnalisé
                </span>
              </div>

              {filteredOrders.length === 0 ? (
                <div className="p-8 rounded-2xl bg-[#141414] text-center space-y-2 border border-white/5">
                  <Ticket className="w-8 h-8 text-gray-500 mx-auto" />
                  <p className="text-xs text-gray-400">
                    Aucune réservation enregistrée pour le moment.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-400 uppercase font-heading tracking-wider">
                        <th className="pb-3 px-3">Participant</th>
                        <th className="pb-3 px-3">Téléphone Wave</th>
                        <th className="pb-3 px-3">Formule</th>
                        <th className="pb-3 px-3">Places</th>
                        <th className="pb-3 px-3">Montant</th>
                        <th className="pb-3 px-3">Statut</th>
                        <th className="pb-3 px-3 text-right">Relance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-3 px-3 font-semibold text-white">
                            {order.customerName}
                          </td>
                          <td className="py-3 px-3 font-mono text-gray-300">
                            {order.customerPhone}
                          </td>
                          <td className="py-3 px-3 text-gray-300">
                            {order.tierName}
                          </td>
                          <td className="py-3 px-3 font-bold text-white">
                            {order.quantity}
                          </td>
                          <td className="py-3 px-3 font-bold text-[#E9C349]">
                            {order.totalAmount.toLocaleString('fr-FR')} F
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                order.status === 'confirmed'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : order.status === 'payment_signaled'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-white/10 text-gray-400'
                              }`}
                            >
                              {order.status === 'confirmed'
                                ? 'Confirmé'
                                : order.status === 'payment_signaled'
                                ? 'À valider'
                                : 'En attente'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right">
                            <a
                              href={generateClientWhatsAppUrl(order)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 text-xs font-bold transition-all"
                              title="Envoyer un rappel WhatsApp à ce participant"
                            >
                              <MessageSquare className="w-3.5 h-3.5 fill-current" />
                              <span className="hidden sm:inline">Rappel</span>
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SOUS-VUE 2 : MES VENTES & REVERSEMENTS (90%) */}
        {promoterTab === 'finances' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="glass-panel p-5 rounded-2xl border border-[#E9C349]/30 bg-[#241A00]/30 space-y-2">
                <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">Total Encaissé</p>
                <h3 className="font-heading text-2xl font-black text-white">
                  {totalGrossCA.toLocaleString('fr-FR')} <span className="text-xs text-[#E9C349]">FCFA</span>
                </h3>
                <p className="text-[11px] text-gray-400">Paiements validés pour vos soirées</p>
              </div>

              <div className="glass-panel p-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 space-y-2">
                <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">Votre Part Nette (90%)</p>
                <h3 className="font-heading text-2xl font-black text-emerald-400">
                  {promoterNetShare.toLocaleString('fr-FR')} <span className="text-xs text-white">FCFA</span>
                </h3>
                <p className="text-[11px] text-gray-400">À virer directement sur votre Wave Business</p>
              </div>

              <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-2">
                <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">Commission Thièsdn (10%)</p>
                <h3 className="font-heading text-2xl font-black text-[#DCB8FF]">
                  {platformFeeShare.toLocaleString('fr-FR')} <span className="text-xs text-white">FCFA</span>
                </h3>
                <p className="text-[11px] text-gray-400">Frais de plateforme et hébergement</p>
              </div>
            </div>

            {/* Protocole de Reversement */}
            <div className="p-5 rounded-2xl bg-[#1C1B1B] border border-white/10 space-y-2 text-xs text-gray-300">
              <h4 className="font-heading font-bold text-sm text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Règle de Clôture & Payout (Option 3 Réconciliée)</span>
              </h4>
              <p className="leading-relaxed">
                Les fonds collectés via les liens Wave Business sont réconciliés quotidiennement. Votre part de 90% est débloquée et virée dès la validation des commandes ou au lendemain de votre événement sur votre compte Wave officiel.
              </p>
            </div>
          </div>
        )}

        {/* SOUS-VUE 3 : RÉSEAU DE VENTE & BILLETS PHYSIQUES (PAPIER) */}
        {promoterTab === 'network' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Notification de succès de génération de lot */}
            {batchSuccessMessage && (
              <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3">
                  <CheckCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                  <p className="text-xs font-semibold">{batchSuccessMessage}</p>
                </div>
                <button
                  onClick={() => setBatchSuccessMessage(null)}
                  className="text-xs font-bold text-gray-400 hover:text-white px-2 py-1"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Notification d'attribution de billets avec lien WhatsApp */}
            {assignNotification && (
              <div className="p-5 rounded-2xl bg-sky-950/80 border border-sky-500/40 text-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <Truck className="w-6 h-6 text-sky-400 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      Stock Distribué avec Succès
                    </h4>
                    <p className="text-xs text-sky-200 mt-0.5">{assignNotification.message}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {assignNotification.waUrl && (
                    <a
                      href={assignNotification.waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Notifier le Gérant (WhatsApp)</span>
                    </a>
                  )}
                  <button
                    onClick={() => setAssignNotification(null)}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* SECTION 1 : GÉNÉRATEUR DE LOTS DE BILLETS PHYSIQUES (A4 IMPRIMABLE) */}
            <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 relative overflow-hidden bg-gradient-to-br from-[#1C1B1B] via-[#141414] to-[#1F1728]/40 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
                <div>
                  <div className="flex items-center gap-2 text-[#E9C349] text-xs font-extrabold uppercase tracking-wider">
                    <Printer className="w-4 h-4" />
                    <span>Générateur de Planches A4 Imprimables</span>
                  </div>
                  <h3 className="font-heading text-xl sm:text-2xl font-black text-white mt-1">
                    Générer un Lot de Billets Physiques avec QR Code
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 max-w-2xl leading-relaxed">
                    Créez des planches A4 de 4 billets avec souche détachable et QR Code unique certifié pour distribution dans les boutiques, kiosques et vendeurs de rue de Thiès.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="bg-[#8A2BE2]/20 text-[#DCB8FF] text-xs font-extrabold px-3 py-1.5 rounded-xl border border-[#8A2BE2]/40 flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-[#E9C349]" />
                    <span>Format 4 billets / page A4</span>
                  </span>
                </div>
              </div>

              {/* Paramétrage du Lot */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* 1. Choix de la formule / Tier */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-300">
                    Formule & Catégorie
                  </label>
                  <select
                    value={batchTierId || activeEvent?.tiers?.[0]?.id || ''}
                    onChange={(e) => setBatchTierId(e.target.value)}
                    className="w-full bg-[#141414] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-[#E9C349] font-medium"
                  >
                    {activeEvent?.tiers?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} — {t.price.toLocaleString('fr-FR')} FCFA
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Volume de billets à générer */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-300 flex justify-between">
                    <span>Nombre de Billets</span>
                    <span className="text-[#E9C349] font-mono">{batchCount} pièces</span>
                  </label>
                  <div className="flex gap-1.5">
                    {[20, 50, 100, 200, 500].map((qty) => (
                      <button
                        key={qty}
                        type="button"
                        onClick={() => setBatchCount(qty)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                          batchCount === qty
                            ? 'bg-[#E9C349] text-[#241A00] border-[#E9C349] shadow-md font-extrabold'
                            : 'bg-[#141414] text-gray-400 border-white/10 hover:text-white'
                        }`}
                      >
                        {qty}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. Synthèse & Bouton de Téléchargement */}
                <div className="space-y-2 md:self-end">
                  <button
                    onClick={handleGeneratePhysicalBatch}
                    disabled={isGeneratingPdf || !activeEvent}
                    className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#8A2BE2] via-[#A855F7] to-[#E9C349] text-white font-heading font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-[#8A2BE2]/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isGeneratingPdf ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>
                          Génération {pdfProgress ? `${pdfProgress.current}/${pdfProgress.total}` : 'en cours...'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 text-white" />
                        <span>Télécharger le PDF A4 ({Math.ceil(batchCount / 4)} pages)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Bandeau d'astuce d'impression */}
              <div className="p-4 rounded-2xl bg-[#0F0F12] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-400 gap-3">
                <div className="flex items-center gap-2.5">
                  <Printer className="w-4 h-4 text-[#E9C349]" />
                  <span>
                    Conseil imprimerie : Papier couché 200g à 250g. Les billets comportent liseré or, code-barres unique et souche détachable.
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] font-mono text-gray-300 shrink-0">
                  <span>Valeur faciale du lot :</span>
                  <span className="font-extrabold text-[#E9C349] text-sm">
                    {(
                      batchCount *
                      (activeEvent?.tiers?.find((t) => t.id === batchTierId)?.price ||
                        activeEvent?.tiers?.[0]?.price ||
                        3500)
                    ).toLocaleString('fr-FR')}{' '}
                    FCFA
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION 2 : 4 CARTES KPI DU RÉSEAU DE VENTE PHYSIQUE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Billets Imprimés en Réserve */}
              <div className="glass-panel p-5 rounded-2xl border border-sky-500/30 bg-sky-950/20 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">En Réserve Promoteur</p>
                <h3 className="font-heading text-2xl font-black text-white">
                  {unassignedPhysicalTickets.length} <span className="text-xs text-sky-400 font-bold">billets</span>
                </h3>
                <p className="text-[11px] text-gray-400">Imprimés, prêts à être alloués</p>
              </div>

              {/* 2. Billets Distribués au Réseau */}
              <div className="glass-panel p-5 rounded-2xl border border-amber-500/30 bg-amber-950/20 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Store className="w-5 h-5" />
                </div>
                <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">Distribués en Boutique</p>
                <h3 className="font-heading text-2xl font-black text-amber-300">
                  {allocatedPhysicalTickets.length + soldPhysicalTickets.length} <span className="text-xs text-white font-bold">billets</span>
                </h3>
                <p className="text-[11px] text-gray-400">Confier à {networkAgents.length} partenaires</p>
              </div>

              {/* 3. Billets Physiques Vendus */}
              <div className="glass-panel p-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <CheckCheck className="w-5 h-5" />
                </div>
                <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">Vendus & Déclarés</p>
                <h3 className="font-heading text-2xl font-black text-emerald-300">
                  {soldPhysicalTickets.length} <span className="text-xs text-white font-bold">billets</span>
                </h3>
                <p className="text-[11px] text-gray-400">
                  CA Réseau : {networkTotalGrossCollected.toLocaleString('fr-FR')} FCFA
                </p>
              </div>

              {/* 4. Cash Restant à Récupérer */}
              <div className="glass-panel p-5 rounded-2xl border border-[#E9C349]/30 bg-[#241A00]/40 space-y-2">
                <div className="w-10 h-10 rounded-xl bg-[#E9C349]/20 text-[#E9C349] flex items-center justify-center">
                  <DollarSign className="w-5 h-5" />
                </div>
                <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">Cash Net à Récupérer</p>
                <h3 className="font-heading text-2xl font-black text-[#E9C349]">
                  {networkTotalAmountDue.toLocaleString('fr-FR')} <span className="text-xs text-white font-bold">FCFA</span>
                </h3>
                <p className="text-[11px] text-gray-400">
                  Déjà versé : {networkTotalPaid.toLocaleString('fr-FR')} FCFA
                </p>
              </div>
            </div>

            {/* SECTION 3 : TABLEAU DES COLLABORATEURS & POINTS DE VENTE */}
            <div className="glass-panel p-6 rounded-3xl space-y-5 border border-white/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-[#E9C349]" />
                    <h3 className="font-heading font-extrabold text-base sm:text-lg text-white">
                      Points de Vente & Vendeurs Partenaires ({networkAgents.length})
                    </h3>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Suivi des stocks confiés, commissions commerçants (10%) et encaissement des espèces.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddAgentModal(true)}
                    className="px-4 py-2.5 rounded-xl bg-[#8A2BE2] hover:bg-[#7b24cc] text-white text-xs font-heading font-bold flex items-center gap-2 transition-all shadow-md shadow-[#8A2BE2]/30"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Ajouter un Point de Vente</span>
                  </button>
                </div>
              </div>

              {networkAgents.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-[#141414] border border-white/5 space-y-3">
                  <Store className="w-10 h-10 text-gray-500 mx-auto" />
                  <h4 className="font-heading font-bold text-sm text-white">
                    Aucun collaborateur enregistré
                  </h4>
                  <p className="text-xs text-gray-400 max-w-sm mx-auto">
                    Ajoutez vos points de vente partenaires à Thiès (boutiques, kiosques, stations-service) pour leur confier des stocks de billets.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-400 uppercase font-heading tracking-wider">
                        <th className="pb-3 px-3">Point de Vente & Quartier</th>
                        <th className="pb-3 px-3">Gérant & Contact</th>
                        <th className="pb-3 px-3">Billets Confiés / Vendus</th>
                        <th className="pb-3 px-3">Stock Restant</th>
                        <th className="pb-3 px-3">Espèces Encaissées</th>
                        <th className="pb-3 px-3">Reste Net Dû</th>
                        <th className="pb-3 px-3 text-right">Actions Réseau</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {networkAgents.map((agent) => {
                        const remaining = Math.max(0, agent.allocatedCount - agent.soldCount);
                        const progressPercent = agent.allocatedCount > 0
                          ? Math.round((agent.soldCount / agent.allocatedCount) * 100)
                          : 0;

                        return (
                          <tr key={agent.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-4 px-3">
                              <div className="font-heading font-bold text-white text-sm">
                                {agent.pointDeVente}
                              </div>
                              <span className="inline-block mt-1 bg-white/10 text-gray-300 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-white/10">
                                📍 {agent.quartier}
                              </span>
                            </td>

                            <td className="py-4 px-3">
                              <div className="text-gray-200 font-medium">{agent.gerantName}</div>
                              <a
                                href={`https://wa.me/${agent.telephone.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-emerald-400 hover:underline flex items-center gap-1 text-[11px] mt-0.5"
                              >
                                <Phone className="w-3 h-3" />
                                {agent.telephone}
                              </a>
                            </td>

                            <td className="py-4 px-3">
                              <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                                <span className="text-emerald-400">{agent.soldCount} vendus</span>
                                <span className="text-gray-400">/ {agent.allocatedCount}</span>
                              </div>
                              <div className="w-28 bg-[#1F1F1F] rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-emerald-400 h-1.5 rounded-full transition-all duration-300"
                                  style={{ width: `${Math.min(100, progressPercent)}%` }}
                                />
                              </div>
                            </td>

                            <td className="py-4 px-3">
                              <span
                                className={`font-mono font-bold px-2 py-0.5 rounded-lg text-xs ${
                                  remaining <= 5 && remaining > 0
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : remaining === 0
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-white/5 text-gray-300'
                                }`}
                              >
                                {remaining} billets
                              </span>
                            </td>

                            <td className="py-4 px-3">
                              <div className="font-mono font-bold text-white">
                                {agent.cashCollected.toLocaleString('fr-FR')} F
                              </div>
                              <div className="text-[10px] text-gray-400">
                                Com: {agent.commissionPercent}% (
                                {Math.round(
                                  agent.cashCollected * (agent.commissionPercent / 100)
                                ).toLocaleString('fr-FR')}{' '}
                                F)
                              </div>
                            </td>

                            <td className="py-4 px-3">
                              <div className="font-mono font-extrabold text-[#E9C349] text-sm">
                                {agent.amountDue.toLocaleString('fr-FR')} FCFA
                              </div>
                              {agent.amountPaidToPromoter > 0 && (
                                <div className="text-[10px] text-emerald-400">
                                  Versé: {agent.amountPaidToPromoter.toLocaleString('fr-FR')} F
                                </div>
                              )}
                            </td>

                            <td className="py-4 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* Bouton Distribuer des Billets */}
                                <button
                                  onClick={() => {
                                    setSelectedAgentForAssign(agent);
                                    setAssignCountInput(20);
                                    setShowAssignModal(true);
                                  }}
                                  className="p-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 transition-colors"
                                  title="Confier un nouveau lot de billets"
                                >
                                  <Truck className="w-3.5 h-3.5" />
                                </button>

                                {/* Bouton Encaisser Versement */}
                                <button
                                  onClick={() => {
                                    setSelectedAgentForSettlement(agent);
                                    setSettlementAmountInput(agent.amountDue);
                                    setShowSettlementModal(true);
                                  }}
                                  className="p-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 transition-colors"
                                  title="Enregistrer un versement d'espèces"
                                >
                                  <DollarSign className="w-3.5 h-3.5" />
                                </button>

                                {/* Bouton Relance WhatsApp */}
                                <a
                                  href={generateAgentWhatsAppReportUrl(agent)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition-colors"
                                  title="Envoyer le récapitulatif par WhatsApp"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                </a>

                                {/* Bouton Tester son Guichet Mobile */}
                                <button
                                  onClick={() => setPreviewAgent(agent)}
                                  className="px-2.5 py-1.5 rounded-xl bg-[#8A2BE2]/20 hover:bg-[#8A2BE2]/30 text-[#DCB8FF] border border-[#8A2BE2]/30 text-[11px] font-bold transition-colors"
                                  title="Ouvrir le guichet de vente mobile du collaborateur"
                                >
                                  Guichet
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* MODALE : AJOUTER UN POINT DE VENTE / COLLABORATEUR */}
            {showAddAgentModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
                <div className="glass-panel w-full max-w-lg p-6 sm:p-8 rounded-3xl border border-white/20 shadow-2xl space-y-6">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-2">
                      <Store className="w-5 h-5 text-[#E9C349]" />
                      <h3 className="font-heading font-extrabold text-lg text-white">
                        Nouveau Point de Vente Partenaire
                      </h3>
                    </div>
                    <button
                      onClick={() => setShowAddAgentModal(false)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleCreateSalesAgentSubmit} className="space-y-4">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-300">
                        Nom du Commerce / Boutique *
                      </label>
                      <input
                        type="text"
                        required
                        value={newAgentShop}
                        onChange={(e) => setNewAgentShop(e.target.value)}
                        placeholder="Ex: Boutique Chez Fatou, Kiosque Orange Escale"
                        className="input-glass w-full rounded-2xl px-4 py-3 text-sm text-white mt-1 outline-none focus:border-[#E9C349]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-300">
                          Nom du Gérant *
                        </label>
                        <input
                          type="text"
                          required
                          value={newAgentManager}
                          onChange={(e) => setNewAgentManager(e.target.value)}
                          placeholder="Ex: Fatou Kiné Diop"
                          className="input-glass w-full rounded-2xl px-4 py-3 text-sm text-white mt-1 outline-none focus:border-[#E9C349]"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-300">
                          Téléphone Wave / OM *
                        </label>
                        <input
                          type="tel"
                          required
                          value={newAgentPhone}
                          onChange={(e) => setNewAgentPhone(e.target.value)}
                          placeholder="Ex: +221 77 123 45 67"
                          className="input-glass w-full rounded-2xl px-4 py-3 text-sm text-white mt-1 outline-none focus:border-[#E9C349]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-300">
                          Quartier de Thiès
                        </label>
                        <select
                          value={newAgentQuartier}
                          onChange={(e) => setNewAgentQuartier(e.target.value)}
                          className="input-glass w-full rounded-2xl px-4 py-3 text-sm text-white mt-1 outline-none focus:border-[#E9C349]"
                        >
                          {THIES_33_QUARTIERS.map((q) => (
                            <option key={q.name} value={q.name}>
                              {q.name} ({q.zone})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-300">
                          Commission Commerçant (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="50"
                          value={newAgentCommission}
                          onChange={(e) => setNewAgentCommission(Number(e.target.value))}
                          className="input-glass w-full rounded-2xl px-4 py-3 text-sm text-white mt-1 outline-none focus:border-[#E9C349]"
                        />
                      </div>
                    </div>

                    <div className="pt-4 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setShowAddAgentModal(false)}
                        className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingAgent}
                        className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-[#8A2BE2] to-[#E9C349] text-white font-heading font-extrabold text-xs uppercase tracking-wider shadow-lg disabled:opacity-50"
                      >
                        {isSavingAgent ? 'Enregistrement...' : 'Créer le Partenaire'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* MODALE : ATTRIBUER DES BILLETS PHYSIQUES */}
            {showAssignModal && selectedAgentForAssign && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
                <div className="glass-panel w-full max-w-md p-6 sm:p-8 rounded-3xl border border-white/20 shadow-2xl space-y-6">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-2">
                      <Truck className="w-5 h-5 text-sky-400" />
                      <h3 className="font-heading font-extrabold text-lg text-white">
                        Confier des Billets
                      </h3>
                    </div>
                    <button
                      onClick={() => setShowAssignModal(false)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                      <p className="text-xs text-gray-400 uppercase font-bold">Destinataire</p>
                      <h4 className="font-heading font-extrabold text-white text-base">
                        {selectedAgentForAssign.pointDeVente}
                      </h4>
                      <p className="text-xs text-gray-300">
                        Gérant : {selectedAgentForAssign.gerantName} ({selectedAgentForAssign.quartier})
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-sky-950/30 border border-sky-500/30 text-xs text-sky-200">
                      Stock d’impression disponible pour cet événement :{' '}
                      <strong className="text-white font-mono text-sm">
                        {unassignedPhysicalTickets.length} billets
                      </strong>
                    </div>

                    <form onSubmit={handleAssignTicketsSubmit} className="space-y-4">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-300 flex justify-between">
                          <span>Quantité à attribuer</span>
                          <span className="text-[#E9C349] font-mono">{assignCountInput} billets</span>
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={Math.max(1, unassignedPhysicalTickets.length)}
                          value={assignCountInput}
                          onChange={(e) => setAssignCountInput(Number(e.target.value))}
                          className="input-glass w-full rounded-2xl px-4 py-3 text-lg font-mono font-bold text-white mt-1 outline-none focus:border-[#E9C349]"
                        />

                        <div className="flex gap-2 mt-2">
                          {[10, 20, 50, 100].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setAssignCountInput(n)}
                              className="flex-1 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-gray-300 font-mono border border-white/5"
                            >
                              +{n}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 flex gap-3">
                        <button
                          type="button"
                          onClick={() => setShowAssignModal(false)}
                          className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase"
                        >
                          Annuler
                        </button>
                        <button
                          type="submit"
                          disabled={unassignedPhysicalTickets.length === 0}
                          className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-sky-600 to-[#8A2BE2] text-white font-heading font-extrabold text-xs uppercase tracking-wider shadow-lg disabled:opacity-40"
                        >
                          Confirmer l’Attribution
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {/* MODALE : ENCAISSER UN VERSEMENT D'ESPÈCES */}
            {showSettlementModal && selectedAgentForSettlement && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
                <div className="glass-panel w-full max-w-md p-6 sm:p-8 rounded-3xl border border-white/20 shadow-2xl space-y-6">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-emerald-400" />
                      <h3 className="font-heading font-extrabold text-lg text-white">
                        Encaisser un Versement
                      </h3>
                    </div>
                    <button
                      onClick={() => setShowSettlementModal(false)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleRecordSettlementSubmit} className="space-y-4">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                      <p className="text-xs text-gray-400 uppercase font-bold">Collaborateur</p>
                      <h4 className="font-heading font-extrabold text-white text-base">
                        {selectedAgentForSettlement.pointDeVente}
                      </h4>
                      <div className="flex justify-between items-center pt-2 border-t border-white/10 text-xs text-gray-300">
                        <span>Solde net dû :</span>
                        <strong className="text-[#E9C349] font-mono text-sm">
                          {selectedAgentForSettlement.amountDue.toLocaleString('fr-FR')} FCFA
                        </strong>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-300">
                        Montant Versé en FCFA *
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={settlementAmountInput}
                        onChange={(e) => setSettlementAmountInput(Number(e.target.value))}
                        className="input-glass w-full rounded-2xl px-4 py-3 text-lg font-mono font-bold text-white mt-1 outline-none focus:border-[#E9C349]"
                      />
                    </div>

                    <div className="pt-2 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setShowSettlementModal(false)}
                        className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-heading font-extrabold text-xs uppercase tracking-wider shadow-lg"
                      >
                        Enregistrer la Remise
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* MODALE : APERÇU DU GUICHET VENDEUR MOBILE (Expérience Commerçant) */}
            {previewAgent && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
                <div className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl bg-[#0A0A0C] border-2 border-[#8A2BE2]/40 shadow-2xl p-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-emerald-400" />
                      <span className="text-xs font-bold text-white">
                        Aperçu Guichet Smartphone : {previewAgent.pointDeVente}
                      </span>
                    </div>
                    <button
                      onClick={() => setPreviewAgent(null)}
                      className="p-1.5 rounded-xl bg-white/10 text-gray-300 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <SalesAgentDashboardView
                    user={{
                      id: previewAgent.id,
                      name: previewAgent.gerantName,
                      email: previewAgent.email || 'agent@thiesdn.sn',
                      role: 'sales_agent',
                      phone: previewAgent.telephone,
                      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
                    }}
                    onNavigateBack={() => setPreviewAgent(null)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* SOUS-VUE : BILLETS NON VENDUS, SUIVI DES PERTES & SÉCURITÉ */}
        {promoterTab === 'unsold' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Bannière de Sécurité & Prévention des Fraudes */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-[#241A00]/80 via-[#1C1B1B] to-[#1F1728]/50 border border-amber-500/40 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <h3 className="font-heading font-extrabold text-base sm:text-lg text-white">
                    Suivi des Billets Non Vendus & Prévention des Pertes
                  </h3>
                </div>
                <p className="text-xs text-gray-300 max-w-2xl leading-relaxed">
                  Règle de validation par vente : Tout billet papier imprimé est <strong className="text-amber-400">inactif par défaut</strong> (<code className="text-[11px] bg-black/40 px-1.5 py-0.5 rounded text-amber-300 font-mono">printed_not_sold</code>). Le scanner à l'entrée refusera catégoriquement tout billet qui n'a pas été formellement activé par votre collaborateur lors de la vente.
                </p>
              </div>

              {totalUnsoldTickets > 0 && (
                <button
                  type="button"
                  disabled={isDeactivating}
                  onClick={() => handleDeactivateUnsoldTickets()}
                  className="px-5 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-heading font-extrabold text-xs uppercase tracking-wider transition-all shadow-lg shrink-0 flex items-center justify-center gap-2 active:scale-95"
                >
                  <AlertCircle className="w-4 h-4" />
                  <span>
                    {isDeactivating ? 'Verrouillage...' : `Désactiver Tous les Invendus (${totalUnsoldTickets})`}
                  </span>
                </button>
              )}
            </div>

            {/* Notification de succès */}
            {deactivateSuccessMessage && (
              <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 flex items-center justify-between shadow-lg animate-in slide-in-from-top-2">
                <div className="flex items-center gap-3">
                  <CheckCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                  <p className="text-xs font-semibold">{deactivateSuccessMessage}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeactivateSuccessMessage(null)}
                  className="text-xs font-bold text-gray-400 hover:text-white px-2 py-1"
                >
                  ✕
                </button>
              </div>
            )}

            {/* 4 KPIs de Traçabilité */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-panel p-5 rounded-3xl border border-white/10 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  Billets Imprimés
                </p>
                <h4 className="font-heading text-2xl font-black text-white">
                  {eventPhysicalTickets.length}{' '}
                  <span className="text-xs font-bold text-gray-400">billets</span>
                </h4>
                <p className="text-[10px] text-gray-400">Total lots physiques générés</p>
              </div>

              <div className="glass-panel p-5 rounded-3xl border border-emerald-500/30 bg-emerald-950/20 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Déclarés Vendus
                </p>
                <h4 className="font-heading text-2xl font-black text-emerald-300">
                  {soldPhysicalTickets.length}{' '}
                  <span className="text-xs font-bold text-white">activés</span>
                </h4>
                <p className="text-[10px] text-emerald-400/80">Statut sold_valid (Accès autorisé)</p>
              </div>

              <div className="glass-panel p-5 rounded-3xl border border-amber-500/40 bg-amber-950/20 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  Non Vendus (Inactifs)
                </p>
                <h4 className="font-heading text-2xl font-black text-amber-300">
                  {totalUnsoldTickets}{' '}
                  <span className="text-xs font-bold text-white">en circulation</span>
                </h4>
                <p className="text-[10px] text-amber-300/80">Accès refusé au scanner</p>
              </div>

              <div className="glass-panel p-5 rounded-3xl border border-rose-500/30 bg-rose-950/20 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400">
                  Désactivés / Sécurisés
                </p>
                <h4 className="font-heading text-2xl font-black text-rose-300">
                  {eventPhysicalTickets.filter((t) => t.status === 'cancelled').length}{' '}
                  <span className="text-xs font-bold text-white">verrouillés</span>
                </h4>
                <p className="text-[10px] text-gray-400">Protection anti-vols active</p>
              </div>
            </div>

            {/* Tableau Récapitulatif par Collaborateur : "X imprimés, Y vendus, Z non vendus" */}
            <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <h4 className="font-heading font-black text-base text-white">
                    État des Stocks par Collaborateur du Réseau
                  </h4>
                  <p className="text-xs text-gray-400">
                    Suivi précis des billets confiés et bouton de désactivation préventive des invendus avant l'événement.
                  </p>
                </div>
              </div>

              {physicalTicketsByAgent.length === 0 ? (
                <p className="text-xs text-gray-500 py-6 text-center">
                  Aucun collaborateur n'a encore été rattaché à cet événement.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/5 text-gray-400 uppercase font-heading text-[10px]">
                        <th className="py-3 px-3">Point de Vente & Gérant</th>
                        <th className="py-3 px-3">Téléphone</th>
                        <th className="py-3 px-3 text-center">Imprimés (X)</th>
                        <th className="py-3 px-3 text-center">Vendus (Y)</th>
                        <th className="py-3 px-3 text-center">Non Vendus (Z)</th>
                        <th className="py-3 px-3 text-center">Sécurité Entrée</th>
                        <th className="py-3 px-3 text-right">Action Préventive</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {physicalTicketsByAgent.map((item) => (
                        <tr key={item.agent.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-3">
                            <span className="font-heading font-bold text-white block">
                              {item.agent.pointDeVente}
                            </span>
                            <span className="text-[11px] text-gray-400 flex items-center gap-1">
                              <span>Responsable :</span>
                              <strong className="text-gray-300">{item.agent.gerantName}</strong>
                              <span>•</span>
                              <span className="text-[#E9C349]">{item.agent.quartier || 'Thiès'}</span>
                            </span>
                          </td>

                          <td className="py-3 px-3 font-mono text-gray-300">
                            {item.agent.telephone}
                          </td>

                          <td className="py-3 px-3 text-center font-heading font-bold text-white">
                            {item.printedCount}
                          </td>

                          <td className="py-3 px-3 text-center font-heading font-bold text-emerald-400">
                            {item.soldCount}
                          </td>

                          <td className="py-3 px-3 text-center font-heading font-bold text-amber-300">
                            {item.unsoldCount}
                          </td>

                          <td className="py-3 px-3 text-center">
                            {item.unsoldCount > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                                Inactifs (Protégés)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                                Lot épuisé
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3 text-right">
                            {item.unsoldCount > 0 ? (
                              <button
                                type="button"
                                disabled={isDeactivating}
                                onClick={() => handleDeactivateUnsoldTickets(item.agent.id)}
                                className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-[11px] font-bold transition-all"
                                title="Désactive définitivement les billets non vendus pour empêcher les vols"
                              >
                                Désactiver les {item.unsoldCount} invendus
                              </button>
                            ) : (
                              <span className="text-[11px] text-gray-500 italic">Aucun invendu</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SOUS-VUE 4 : CO-PRODUCTION, DROITS ARTISTE & TRANSPARENCE */}
        {promoterTab === 'coprod' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Bannière de Transparence */}
            <div className="p-6 rounded-3xl bg-gradient-to-r from-[#241A00]/60 via-[#1C1B1B] to-[#1F1728]/40 border border-[#E9C349]/30 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#E9C349]/20 text-[#E9C349] flex items-center justify-center">
                    <Crown className="w-4 h-4" />
                  </div>
                  <h3 className="font-heading font-extrabold text-base sm:text-lg text-white">
                    Transparence Contractuelle & Partage des Recettes Co-Production
                  </h3>
                </div>
                <p className="text-xs text-gray-300 max-w-2xl leading-relaxed">
                  Thièsdn Billetterie garantit à vos artistes partenaires et à leur staff une visibilité totale sur les ventes réelles, les mouvements de scans aux portes et les quotas d’invitations, éliminant tout litige lors du décompte final.
                </p>
              </div>

              <button
                onClick={() => setShowAddCoprodModal(true)}
                className="btn-gold-glow px-5 py-3 rounded-2xl font-heading font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 shrink-0 shadow-lg"
              >
                <Plus className="w-4 h-4 text-[#241A00]" />
                <span>Ajouter un Ayant-Droit</span>
              </button>
            </div>

            {/* Récapitulatif Global de la Répartition */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-2">
                <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">CA Total Événement</p>
                <h3 className="font-heading text-2xl font-black text-white">
                  {totalGrossCA.toLocaleString('fr-FR')} <span className="text-xs text-[#E9C349]">FCFA</span>
                </h3>
                <p className="text-[11px] text-gray-400">Base de calcul pour tous les ayants-droit</p>
              </div>

              <div className="glass-panel p-5 rounded-2xl border border-[#E9C349]/30 bg-[#241A00]/20 space-y-2">
                <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">Total Parts Co-Producteurs</p>
                <h3 className="font-heading text-2xl font-black text-[#E9C349]">
                  {coproducers
                    .filter((c) => !activeEvent || c.eventId === activeEvent.id)
                    .reduce((sum, c) => sum + c.revenueShare, 0)}% <span className="text-xs text-white">du CA</span>
                </h3>
                <p className="text-[11px] text-gray-400">
                  Soit{' '}
                  {Math.round(
                    (totalGrossCA *
                      coproducers
                        .filter((c) => !activeEvent || c.eventId === activeEvent.id)
                        .reduce((sum, c) => sum + c.revenueShare, 0)) /
                      100
                  ).toLocaleString('fr-FR')}{' '}
                  FCFA à reverser
                </p>
              </div>

              <div className="glass-panel p-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 space-y-2">
                <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">Part Nette Producteur Principal</p>
                <h3 className="font-heading text-2xl font-black text-emerald-400">
                  {Math.max(
                    0,
                    100 -
                      coproducers
                        .filter((c) => !activeEvent || c.eventId === activeEvent.id)
                        .reduce((sum, c) => sum + c.revenueShare, 0)
                  )}% <span className="text-xs text-white">du CA</span>
                </h3>
                <p className="text-[11px] text-gray-400">
                  Soit{' '}
                  {Math.round(
                    (totalGrossCA *
                      Math.max(
                        0,
                        100 -
                          coproducers
                            .filter((c) => !activeEvent || c.eventId === activeEvent.id)
                            .reduce((sum, c) => sum + c.revenueShare, 0)
                      )) /
                      100
                  ).toLocaleString('fr-FR')}{' '}
                  FCFA conservés
                </p>
              </div>
            </div>

            {/* Tableau des Co-Producteurs & Droits Artistes */}
            <div className="glass-panel p-6 rounded-3xl space-y-5 border border-white/10">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <h3 className="font-heading font-extrabold text-base sm:text-lg text-white">
                    Liste des Ayants-Droit & Répartition ({coproducers.filter((c) => !activeEvent || c.eventId === activeEvent.id).length})
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Chaque ayant-droit dispose d’un accès dédié en direct pour vérifier ses chiffres et sa guest list.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-400 uppercase font-heading tracking-wider">
                      <th className="pb-3 px-3">Ayant-Droit & Rôle</th>
                      <th className="pb-3 px-3">Contact Téléphone</th>
                      <th className="pb-3 px-3">Part Contractuelle</th>
                      <th className="pb-3 px-3">Montant Net Dû</th>
                      <th className="pb-3 px-3">Guest List (Invités)</th>
                      <th className="pb-3 px-3">Validation Décompte</th>
                      <th className="pb-3 px-3 text-right">Actions Transparence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {coproducers
                      .filter((c) => !activeEvent || c.eventId === activeEvent.id)
                      .map((coprod) => {
                        const netAmount = Math.round((totalGrossCA * coprod.revenueShare) / 100);

                        return (
                          <tr key={coprod.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-4 px-3">
                              <div className="font-heading font-bold text-white text-sm">
                                {coprod.name}
                              </div>
                              <span className="inline-block mt-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase border bg-[#8A2BE2]/20 text-[#DCB8FF] border-[#8A2BE2]/40">
                                {coprod.roleType === 'artiste'
                                  ? 'Artiste Vedette'
                                  : coprod.roleType === 'staff_artiste'
                                  ? 'Staff Artiste'
                                  : coprod.roleType === 'gerant_lieu'
                                  ? 'Gérant du Lieu'
                                  : 'Co-Producteur'}
                              </span>
                            </td>

                            <td className="py-4 px-3 font-mono text-gray-300">
                              {coprod.phone}
                            </td>

                            <td className="py-4 px-3">
                              <span className="font-heading font-extrabold text-base text-[#E9C349]">
                                {coprod.revenueShare}%
                              </span>
                            </td>

                            <td className="py-4 px-3">
                              <div className="font-mono font-extrabold text-white text-sm">
                                {netAmount.toLocaleString('fr-FR')} FCFA
                              </div>
                              <div className="text-[10px] text-gray-400">Revenus nets</div>
                            </td>

                            <td className="py-4 px-3">
                              <span className="font-mono font-bold text-gray-200">
                                {coprod.guestTicketsUsed} / {coprod.guestTicketsAllocated} places
                              </span>
                            </td>

                            <td className="py-4 px-3">
                              {coprod.decompteValidated ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full text-[10px] font-bold border border-emerald-500/40">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Signé & Conforme</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-full text-[10px] font-bold border border-amber-500/40">
                                  <Clock className="w-3 h-3" />
                                  <span>En attente</span>
                                </span>
                              )}
                            </td>

                            <td className="py-4 px-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {/* Bouton Aperçu Cockpit Artiste */}
                                <button
                                  onClick={() => setPreviewCoproducer(coprod)}
                                  className="px-3 py-1.5 rounded-xl bg-[#E9C349]/20 hover:bg-[#E9C349]/30 text-[#E9C349] border border-[#E9C349]/30 text-xs font-bold transition-all flex items-center gap-1.5"
                                  title="Voir exactement ce que voit l'artiste"
                                >
                                  <Crown className="w-3.5 h-3.5" />
                                  <span>Aperçu Cockpit</span>
                                </button>

                                {/* Bouton Partager sur WhatsApp */}
                                <a
                                  href={`https://wa.me/${coprod.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                                    `Bonjour ${coprod.name} ! Voici le point en temps réel pour *${activeEvent?.title || 'votre événement'}* sur Thièsdn Billetterie :\n• Chiffre d'affaires brut : ${totalGrossCA.toLocaleString('fr-FR')} FCFA\n• Votre part (${coprod.revenueShare}%) : ${netAmount.toLocaleString('fr-FR')} FCFA\n• Accédez à votre Cockpit Artiste officiel : https://thiesdn.mgartswork.site/`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 transition-all"
                                  title="Envoyer les chiffres sur WhatsApp"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MODALE : AJOUTER UN CO-PRODUCTEUR DANS LE COCKPIT */}
            {showAddCoprodModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
                <div className="glass-panel w-full max-w-lg p-6 sm:p-8 rounded-3xl border border-[#E9C349]/30 shadow-2xl space-y-6">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-2">
                      <Crown className="w-5 h-5 text-[#E9C349]" />
                      <h3 className="font-heading font-extrabold text-lg text-white">
                        Ajouter un Co-Producteur ou Artiste
                      </h3>
                    </div>
                    <button
                      onClick={() => setShowAddCoprodModal(false)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!newCoprodName.trim() || !newCoprodPhone.trim() || !activeEvent) return;
                      setIsSavingCoprod(true);
                      const res = await createCoproducer({
                        eventId: activeEvent.id,
                        eventTitle: activeEvent.title,
                        promoterId: activeEvent.promoter.id || '',
                        name: newCoprodName.trim(),
                        phone: newCoprodPhone.trim(),
                        roleType: newCoprodRole,
                        revenueShare: Number(newCoprodShare) || 0,
                        guestTicketsAllocated: Number(newCoprodGuestQuota) || 0,
                      });
                      setIsSavingCoprod(false);
                      if (res.success) {
                        setCoproducers(getStoredCoproducers());
                        setShowAddCoprodModal(false);
                        setNewCoprodName('');
                        setNewCoprodPhone('');
                      }
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-300">
                        Rôle de l'Ayant-Droit *
                      </label>
                      <select
                        value={newCoprodRole}
                        onChange={(e) => setNewCoprodRole(e.target.value as CoproducerRole)}
                        className="input-glass w-full rounded-2xl px-4 py-3 text-sm text-white mt-1 outline-none focus:border-[#E9C349]"
                      >
                        <option value="artiste">Artiste Principal / Vedette</option>
                        <option value="staff_artiste">Staff / Manager Artiste</option>
                        <option value="co_producteur">Co-Producteur Associé</option>
                        <option value="gerant_lieu">Gérant du Lieu / Salle</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-300">
                          Nom / Structure *
                        </label>
                        <input
                          type="text"
                          required
                          value={newCoprodName}
                          onChange={(e) => setNewCoprodName(e.target.value)}
                          placeholder="Ex: Pape Diouf, Waly Seck..."
                          className="input-glass w-full rounded-2xl px-4 py-3 text-sm text-white mt-1 outline-none focus:border-[#E9C349]"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-300">
                          Téléphone Wave / OM *
                        </label>
                        <input
                          type="tel"
                          required
                          value={newCoprodPhone}
                          onChange={(e) => setNewCoprodPhone(e.target.value)}
                          placeholder="+221 77 XXX XX XX"
                          className="input-glass w-full rounded-2xl px-4 py-3 text-sm text-white mt-1 outline-none focus:border-[#E9C349]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-300">
                          Part des Recettes (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={newCoprodShare}
                          onChange={(e) => setNewCoprodShare(Number(e.target.value))}
                          className="input-glass w-full rounded-2xl px-4 py-3 text-sm text-white mt-1 outline-none focus:border-[#E9C349]"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-300">
                          Quota Billets Invités (Guest List)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="200"
                          value={newCoprodGuestQuota}
                          onChange={(e) => setNewCoprodGuestQuota(Number(e.target.value))}
                          className="input-glass w-full rounded-2xl px-4 py-3 text-sm text-white mt-1 outline-none focus:border-[#E9C349]"
                        />
                      </div>
                    </div>

                    <div className="pt-3 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setShowAddCoprodModal(false)}
                        className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        disabled={isSavingCoprod}
                        className="flex-1 py-3 rounded-2xl btn-gold-glow font-heading font-extrabold text-xs uppercase tracking-wider shadow-lg disabled:opacity-50"
                      >
                        {isSavingCoprod ? 'Enregistrement...' : 'Enregistrer cet Ayant-Droit'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* MODALE : APERÇU COMPLET COCKPIT ARTISTE */}
            {previewCoproducer && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in">
                <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-3xl bg-[#0F0F12] border-2 border-[#E9C349]/40 shadow-2xl p-6 sm:p-8 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-4">
                    <div className="flex items-center gap-2">
                      <Crown className="w-5 h-5 text-[#E9C349]" />
                      <span className="text-sm font-bold text-white">
                        Aperçu Réel Cockpit Artiste : {previewCoproducer.name} ({previewCoproducer.revenueShare}% du CA)
                      </span>
                    </div>
                    <button
                      onClick={() => setPreviewCoproducer(null)}
                      className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <ArtistDashboardView
                    user={{
                      id: previewCoproducer.id,
                      name: previewCoproducer.name,
                      username: previewCoproducer.name.toLowerCase().replace(/\s+/g, '_'),
                      email: previewCoproducer.email || 'artiste@thiesdn.sn',
                      phone: previewCoproducer.phone,
                      address: 'Thiès, Sénégal',
                      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
                      isVip: true,
                      role: 'artist',
                      connectedAccounts: { facebook: true, instagram: true, tiktok: true },
                      privacySettings: { publicProfile: true, biometricLogin: false, emailNotifications: true },
                    }}
                    events={events}
                    currentCoproducer={previewCoproducer}
                    onNavigateBack={() => setPreviewCoproducer(null)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ONGLET 5 : MODULE D'ACCRÉDITATIONS (STAFF, INVITÉS & PRESSE) */}
        {promoterTab === 'accreditations' && (
          <AccreditationsView
            currentRole="promoter"
            events={promoterEvents}
            defaultEventId={activeEvent?.id}
          />
        )}

        {/* ONGLET 6 : MULTI-POSTES DE CONTRÔLE (SCANNERS SÉCURISÉS) */}
        {promoterTab === 'stations' && (
          <ScanStationsView
            events={promoterEvents}
            defaultEventId={activeEvent?.id}
            promoterId={activeEvent?.promoter?.id || ''}
            promoterName={promoterName || activeEvent?.promoter?.name || 'Lat Dior Productions'}
          />
        )}
      </div>
    );
  }

  // ====================================================================
  // 2. VUE ADMIN GLOBALE : MODULE FINANCIER & RÉCONCILIATION GÉNÉRALE
  // ====================================================================
  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#8A2BE2]/20 text-[#DCB8FF] text-xs font-extrabold uppercase px-3 py-1 rounded-full border border-[#8A2BE2]/40">
              Module Financier & Règle Option 3
            </span>
            {isConnected ? (
              <span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-500/30">
                <Check className="w-3 h-3" /> Supabase Connecté
              </span>
            ) : (
              <span className="bg-[#E9C349]/20 text-[#E9C349] text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-[#E9C349]/30">
                Mode Local Actif
              </span>
            )}
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-2">
            Comptabilité du MVP & Réconciliation des Fonds
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Formule validée (Option 3) : 90% Promoteur • 10% Thièsdn • 100% équilibré
          </p>
        </div>

        <button
          onClick={handleRefresh}
          className="px-4 py-2.5 rounded-xl bg-[#1F1F1F] hover:bg-[#2A2A2A] border border-white/10 text-xs font-bold text-white flex items-center gap-2 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4 text-[#8A2BE2]" />
          Actualiser les Données
        </button>
      </div>

      {/* KPI Cards : État des Flux Financiers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Confirmé Encaissé */}
        <div className="glass-panel p-5 rounded-2xl border border-emerald-500/30 space-y-2 relative overflow-hidden bg-emerald-950/20">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
          <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">Encaissé Confirmé</p>
          <h3 className="font-heading text-2xl font-black text-white">
            {totalVolumeConfirmed.toLocaleString('fr-FR')} <span className="text-xs text-emerald-400 font-bold">FCFA</span>
          </h3>
          <p className="text-[11px] text-gray-400">Paiements validés & billets émis</p>
        </div>

        {/* Signalé en Attente de Vérification */}
        <div className="glass-panel p-5 rounded-2xl border border-amber-500/30 space-y-2 relative overflow-hidden bg-amber-950/20">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">Signalé (À Vérifier)</p>
          <h3 className="font-heading text-2xl font-black text-amber-300">
            {signaledVolume.toLocaleString('fr-FR')} <span className="text-xs text-white font-bold">FCFA</span>
          </h3>
          <p className="text-[11px] text-gray-400">{signaledOrders.length} virement(s) à confirmer dans Modération</p>
        </div>

        {/* Part Promoteurs (90%) */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-2 relative overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-[#E9C349]/20 text-[#E9C349] flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
          <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">Part Promoteurs (90%)</p>
          <h3 className="font-heading text-2xl font-black text-[#E9C349]">
            {totalPromoterShare.toLocaleString('fr-FR')} <span className="text-xs text-white font-bold">FCFA</span>
          </h3>
          <p className="text-[11px] text-gray-400">À reverser aux organisateurs</p>
        </div>

        {/* Commission Thièsdn (10%) */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-2 relative overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-[#DCB8FF]/20 text-[#DCB8FF] flex items-center justify-center">
            <Percent className="w-5 h-5" />
          </div>
          <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">Commission Thièsdn (10%)</p>
          <h3 className="font-heading text-2xl font-black text-[#DCB8FF]">
            {totalPlatformFee.toLocaleString('fr-FR')} <span className="text-xs text-white font-bold">FCFA</span>
          </h3>
          <p className="text-[11px] text-gray-400">Revenu net plateforme</p>
        </div>
      </div>

      {/* Configuration des Coordonnées Officielles Wave / Orange Money (Admin) */}
      <div className="glass-panel p-6 rounded-3xl border border-amber-500/30 space-y-4 bg-[#1A1810]">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-[#E9C349]" />
            <h2 className="font-heading font-bold text-base text-white">
              Coordonnées Officielles de Réception (Wave & Orange Money)
            </h2>
          </div>
          <span className="text-[10px] uppercase font-bold text-[#E9C349] bg-[#E9C349]/10 px-2 py-0.5 rounded">
            Administration Seule
          </span>
        </div>

        <p className="text-xs text-gray-300">
          Ces numéros sont directement présentés aux acheteurs lors de l'achat manuel de billets. Ne jamais renseigner un compte personnel non habilité.
        </p>

        <form onSubmit={handleSavePaymentSettings} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3 bg-black/40 p-4 rounded-2xl border border-white/5">
            <h4 className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4" /> Wave Sénégal
            </h4>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Numéro Wave Récepteur
              </label>
              <input
                type="text"
                value={paymentSettings.waveNumber}
                onChange={(e) =>
                  setLocalPaymentSettings({ ...paymentSettings, waveNumber: e.target.value })
                }
                placeholder="+221 77 000 00 00"
                className="input-glass w-full rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Nom du Bénéficiaire Wave
              </label>
              <input
                type="text"
                value={paymentSettings.waveBeneficiary}
                onChange={(e) =>
                  setLocalPaymentSettings({ ...paymentSettings, waveBeneficiary: e.target.value })
                }
                placeholder="Thièsdn Billetterie"
                className="input-glass w-full rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div className="space-y-3 bg-black/40 p-4 rounded-2xl border border-white/5">
            <h4 className="text-xs font-bold text-orange-400 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4" /> Orange Money Sénégal
            </h4>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Numéro Orange Money Récepteur
              </label>
              <input
                type="text"
                value={paymentSettings.omNumber}
                onChange={(e) =>
                  setLocalPaymentSettings({ ...paymentSettings, omNumber: e.target.value })
                }
                placeholder="+221 78 000 00 00"
                className="input-glass w-full rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Nom du Bénéficiaire Orange Money
              </label>
              <input
                type="text"
                value={paymentSettings.omBeneficiary}
                onChange={(e) =>
                  setLocalPaymentSettings({ ...paymentSettings, omBeneficiary: e.target.value })
                }
                placeholder="Thièsdn Billetterie SARL"
                className="input-glass w-full rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div className="md:col-span-2 flex items-center gap-3">
            <button
              type="submit"
              className="btn-primary-glow py-2.5 px-5 rounded-xl text-xs font-heading font-bold uppercase tracking-wider"
            >
              Mettre à jour les Numéros Officiels
            </button>
            {settingsSaved && (
              <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                <Check className="w-4 h-4" /> Coordonnées enregistrées avec succès !
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Supabase Connection Setup & SQL Schema Accordion */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6 rounded-3xl space-y-4">
          <div className="flex items-center gap-2 text-white font-heading font-bold text-base border-b border-white/10 pb-3">
            <Database className="w-5 h-5 text-[#8A2BE2]" />
            <span>Paramètres de Connexion Supabase</span>
          </div>

          <p className="text-xs text-gray-300 leading-relaxed">
            Pour brancher votre propre projet Supabase en direct, renseignez l'URL de votre API et la clé publique anonyme (<code className="text-[#DCB8FF]">anon key</code>).
          </p>

          <form onSubmit={handleSaveSupabase} className="space-y-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                Supabase URL (VITE_SUPABASE_URL)
              </label>
              <input
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                placeholder="https://votrenom.supabase.co"
                className="input-glass w-full rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                Supabase Anon Key (VITE_SUPABASE_ANON_KEY)
              </label>
              <input
                type="password"
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="input-glass w-full rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="submit"
                className="btn-primary-glow py-2.5 px-4 rounded-xl text-xs font-heading font-bold uppercase tracking-wider flex items-center gap-2"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Enregistrer</span>
              </button>

              <button
                type="button"
                onClick={handleTestSupabaseLive}
                disabled={isTestingSupabase}
                className="px-4 py-2.5 rounded-xl bg-[#8A2BE2]/20 hover:bg-[#8A2BE2]/40 text-[#DCB8FF] border border-[#8A2BE2]/40 text-xs font-bold flex items-center gap-2 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isTestingSupabase ? 'animate-spin' : ''}`} />
                <span>Tester Requête 'events'</span>
              </button>

              {connectionSaved && (
                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="w-4 h-4" /> Enregistré !
                </span>
              )}
            </div>
          </form>

          {testResult && (
            <div
              className={`p-4 rounded-2xl border text-xs space-y-2 mt-4 ${
                testResult.success
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
              }`}
            >
              <div className="font-bold flex items-center gap-2">
                <span>{testResult.message}</span>
              </div>
              {testResult.error && (
                <p className="text-[11px] text-gray-300 bg-black/40 p-2.5 rounded-lg border border-white/5 font-mono">
                  {testResult.error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Copy SQL Schema Box */}
        <div className="glass-panel p-6 rounded-3xl space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-white font-heading font-bold text-base">
                <Database className="w-5 h-5 text-[#E9C349]" />
                <span>Script SQL de Déploiement</span>
              </div>
              <button
                onClick={handleCopySql}
                className="px-3 py-1.5 rounded-lg bg-[#8A2BE2]/20 hover:bg-[#8A2BE2] text-[#DCB8FF] hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? 'Copié !' : 'Copier SQL'}</span>
              </button>
            </div>

            <p className="text-xs text-gray-300 mt-3 leading-relaxed">
              Ce script prêt à l’emploi crée automatiquement les tables <strong className="text-white">profiles</strong>, <strong className="text-white">events</strong>, <strong className="text-white">tickets</strong>, <strong className="text-white">orders</strong>, <strong className="text-white">transactions</strong>, le trigger de calcul des commissions 90/10 et la fonction RPC <strong className="text-[#E9C349]">scan_ticket()</strong>.
            </p>

            <div className="mt-3 bg-[#0A0A0C] p-3 rounded-xl border border-white/5 font-mono text-[10px] text-gray-400 max-h-36 overflow-y-auto">
              <pre>{SUPABASE_SQL_SCHEMA}</pre>
            </div>
          </div>

          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-gray-400">
            <span>Région couverte : Thiès, Mbour, Saly, Dakar</span>
            <span className="text-[#DCB8FF] font-bold">100% Compatible PostgreSQL</span>
          </div>
        </div>
      </div>

      {/* Transaction History Table */}
      <section className="glass-panel p-6 rounded-3xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#8A2BE2]" />
            <h2 className="font-heading font-bold text-base text-white">
              Historique des Transactions & Répartitions ({transactions.length})
            </h2>
          </div>

          <div className="text-xs text-gray-400">
            Paiements en direct via Mobile Money
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 uppercase font-heading tracking-wider">
                <th className="pb-3 px-3">Réf / Date</th>
                <th className="pb-3 px-3">Événement & Organisateur</th>
                <th className="pb-3 px-3">Client</th>
                <th className="pb-3 px-3">Paiement</th>
                <th className="pb-3 px-3">Total (FCFA)</th>
                <th className="pb-3 px-3">Part Promoteur (90%)</th>
                <th className="pb-3 px-3">Thiesdn (10%)</th>
                <th className="pb-3 px-3 text-right">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-3.5 px-3">
                    <p className="font-mono text-white font-bold">{tx.id}</p>
                    <p className="text-[10px] text-gray-500">
                      {new Date(tx.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </td>

                  <td className="py-3.5 px-3">
                    <p className="font-semibold text-white truncate max-w-xs">{tx.eventTitle}</p>
                    <p className="text-[11px] text-[#DCB8FF]">{tx.promoterName}</p>
                  </td>

                  <td className="py-3.5 px-3">
                    <p className="text-white">{tx.customerName}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{tx.customerPhone}</p>
                  </td>

                  <td className="py-3.5 px-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        tx.paymentMethod === 'wave'
                          ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                          : tx.paymentMethod === 'om'
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {tx.paymentMethod.toUpperCase()}
                    </span>
                  </td>

                  <td className="py-3.5 px-3 font-heading font-extrabold text-white">
                    {tx.totalAmount.toLocaleString('fr-FR')} F
                  </td>

                  <td className="py-3.5 px-3 font-heading font-bold text-[#E9C349]">
                    {tx.promoterShare.toLocaleString('fr-FR')} F
                  </td>

                  <td className="py-3.5 px-3 font-heading font-bold text-[#DCB8FF]">
                    {tx.platformFee.toLocaleString('fr-FR')} F
                  </td>

                  <td className="py-3.5 px-3 text-right">
                    <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      <Check className="w-3 h-3" /> Validé
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
