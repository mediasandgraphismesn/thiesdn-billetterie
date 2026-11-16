import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Wallet,
  Filter,
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
  Calendar,
  MapPin,
  Send,
  Ticket,
  ChevronRight,
  ArrowRight,
  Printer,
  Store,
  History,
  Plus,
  X,
  FileText,
  CheckCheck,
  Truck,
  Scissors,
  Crown,
  Award,
  ChevronDown,
  SlidersHorizontal,
  Trash2,
  MoreVertical,
  MessageCircle,
  KeyRound,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
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
  fetchAllSoldTicketsFromSupabase,
  getStoredSalesAgents,
  fetchSalesAgentsFromSupabase,
  createSalesAgent,
  buildFallbackPosEmail,
  provisionSalesAgentAuthAccount,
  resetSalesAgentPasswordAccount,
  TicketAllocation,
  generatePhysicalTicketBatch,
  assignTicketsToAgent,
  getStoredTicketAllocations,
  fetchTicketAllocationsFromSupabase,
  recordAgentSettlement,
  deactivateUnsoldPhysicalTickets,
  getStoredCoproducers,
  createCoproducer,
  clearTestPhysicalTickets,
  clearLocalTicketReserveCache,
  fetchPosShiftHandovers,
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
  PosShiftHandoverRecord,
} from '../types';
import { generatePhysicalTicketsPdf } from '../services/pdfTicketGenerator';
import { THIES_33_QUARTIERS } from '../data/thiesQuartiers';
import { SalesAgentDashboardView } from './SalesAgentDashboardView';
import { ArtistDashboardView } from './ArtistDashboardView';
import { AccreditationsView } from './AccreditationsView';
import { ScanStationsView } from './ScanStationsView';
import { AssignPhysicalTicketsModal } from '../components/AssignPhysicalTicketsModal';
import { SoldTicketsSection } from '../components/admin/SoldTicketsSection';
import { TicketDetailModal } from '../components/TicketDetailModal';

interface FinancesViewProps {
  currentRole: 'user' | 'promoter' | 'admin';
  events?: EventItem[];
  promoterName?: string;
  initialTab?: 'stats' | 'finances' | 'network' | 'unsold' | 'coprod' | 'accreditations' | 'stations';
}

export const FinancesView: React.FC<FinancesViewProps> = ({
  currentRole,
  events = [],
  promoterName,
  initialTab,
}) => {
  const { showToast } = useToast();
  const isConnected = isSupabaseConfigured();
  const [transactions, setTransactions] = useState<TransactionRecord[]>(() =>
    isConnected ? [] : getStoredTransactions()
  );
  const [orders, setOrders] = useState<OrderRecord[]>(() =>
    isConnected ? [] : getStoredOrders()
  );
  const [tickets, setTickets] = useState<UserTicket[]>(() =>
    isConnected ? [] : getStoredTickets()
  );
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

  // Pour le promoteur ou admin : choix entre "compta", "stats", "finances", "network", "unsold", "coprod", "accreditations" et "stations"
  const [promoterTab, setPromoterTab] = useState<'compta' | 'stats' | 'finances' | 'network' | 'unsold' | 'coprod' | 'accreditations' | 'stations'>(
    initialTab || (currentRole === 'admin' ? 'compta' : 'stats')
  );

  useEffect(() => {
    if (initialTab) {
      setPromoterTab(initialTab);
    }
  }, [initialTab]);
  const [selectedEventId, setSelectedEventId] = useState<string>('all');

  // ====================================================================
  // ÉTATS GESTION DU RÉSEAU & BILLETS PHYSIQUES
  // ====================================================================
  const [agents, setAgents] = useState<SalesAgent[]>(() =>
    isConnected ? [] : getStoredSalesAgents()
  );
  const [coproducers, setCoproducers] = useState<EventCoproducer[]>(getStoredCoproducers());
  const [allocations, setAllocations] = useState<TicketAllocation[]>(() =>
    isConnected ? [] : getStoredTicketAllocations()
  );
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
  const [batchAgentFilter, setBatchAgentFilter] = useState<string>('all');
  const [batchSuccessMessage, setBatchSuccessMessage] = useState<string | null>(null);

  // Modale d'ajout d'un point de vente / collaborateur
  const [showAddAgentModal, setShowAddAgentModal] = useState(false);
  const [newAgentShop, setNewAgentShop] = useState('');
  const [newAgentManager, setNewAgentManager] = useState('');
  const [newAgentPhone, setNewAgentPhone] = useState('');
  const [newAgentEmail, setNewAgentEmail] = useState('');
  const [newAgentQuartier, setNewAgentQuartier] = useState('Escale Sud (Centre-Ville)');
  const [newAgentCommission, setNewAgentCommission] = useState(10);
  const [isSavingAgent, setIsSavingAgent] = useState(false);
  const [provisioningAgentId, setProvisioningAgentId] = useState<string | null>(null);
  const [agentCredentialsById, setAgentCredentialsById] = useState<
    Record<string, { email: string; tempPassword: string }>
  >({});
  const [agentAccessBanner, setAgentAccessBanner] = useState<{
    agent: SalesAgent;
    email: string;
    tempPassword?: string;
    waUrl: string;
    warning?: string;
  } | null>(null);

  // Modale d'attribution de billets physiques
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedAgentForAssign, setSelectedAgentForAssign] = useState<SalesAgent | null>(null);
  const [assignTierName, setAssignTierName] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState<boolean>(false);
  const [assignNotification, setAssignNotification] = useState<{ message: string; waUrl?: string } | null>(null);

  // Modale d'enregistrement de versement d'espèces
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [selectedAgentForSettlement, setSelectedAgentForSettlement] = useState<SalesAgent | null>(null);
  const [settlementAmountInput, setSettlementAmountInput] = useState<number>(0);
  const [isSubmittingSettlement, setIsSubmittingSettlement] = useState<boolean>(false);

  // Aperçu du Guichet Vendeur Mobile
  const [previewAgent, setPreviewAgent] = useState<SalesAgent | null>(null);
  // Inspection modale d'un billet vendu (mode promoteur/admin)
  const [selectedTicketForModal, setSelectedTicketForModal] = useState<UserTicket | null>(null);
  // Historique des relevés et blocages de caisse POS
  const [shiftHandovers, setShiftHandovers] = useState<PosShiftHandoverRecord[]>([]);

  // Menu Options Avancées
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const optionsMenuRef = useRef<HTMLDivElement>(null);

  // Fermeture du menu Options au clic extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (optionsMenuRef.current && !optionsMenuRef.current.contains(event.target as Node)) {
        setShowOptionsMenu(false);
      }
    };
    if (showOptionsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showOptionsMenu]);

  // Menu MoreVertical actif pour les points de vente (Règle 2 boutons max)
  const [activeAgentMenuId, setActiveAgentMenuId] = useState<string | null>(null);

  // ====================================================================
  // CALCULS DU COCKPIT PROMOTEUR (Déclarés avant les hooks de chargement pour éviter tout TDZ)
  // ====================================================================
  const safeEvents = useMemo(() => (Array.isArray(events) ? events.filter(Boolean) : []), [events]);

  const promoterEvents = useMemo(() => {
    if (safeEvents.length === 0) return [];
    if (currentRole === 'admin') return safeEvents;
    if (!promoterName) return safeEvents;
    const filtered = safeEvents.filter((e) =>
      e.promoter?.name?.toLowerCase().includes(promoterName.toLowerCase())
    );
    return filtered.length > 0 ? filtered : safeEvents;
  }, [safeEvents, promoterName, currentRole]);

  const activeEvent = useMemo(() => {
    if (selectedEventId === 'all') return promoterEvents[0] || null;
    return promoterEvents.find((e) => e.id === selectedEventId) || promoterEvents[0] || null;
  }, [promoterEvents, selectedEventId]);

  const loadCockpitData = async (targetEventId?: string): Promise<void> => {
    if (!isConnected) {
      setTransactions(getStoredTransactions());
      setAgents(getStoredSalesAgents());
      setCoproducers(getStoredCoproducers());
      setOrders(getStoredOrders());
      setTickets(getStoredTickets());
      setAllocations(getStoredTicketAllocations());
      const localShifts = await fetchPosShiftHandovers({ eventId: targetEventId });
      setShiftHandovers(localShifts.handovers);
      return;
    }

    const [agentsRes, allocRes, ordersRes, ticketsRes, shiftRes] = await Promise.all([
      fetchSalesAgentsFromSupabase(),
      fetchTicketAllocationsFromSupabase(targetEventId),
      fetchOrdersFromSupabase(),
      fetchAllSoldTicketsFromSupabase({ eventId: targetEventId }),
      fetchPosShiftHandovers({ eventId: targetEventId }),
    ]);

    if (!agentsRes.error) {
      setAgents(agentsRes.agents);
    }
    if (!allocRes.error) {
      setAllocations(allocRes.allocations);
    }
    if (!ordersRes.error) {
      setOrders(ordersRes.orders);
    }
    if (!ticketsRes.error) {
      setTickets(ticketsRes.tickets);
    }
    if (!shiftRes.error) {
      setShiftHandovers(shiftRes.handovers);
    }
  };

  useEffect(() => {
    const targetEventId = selectedEventId === 'all' ? (activeEvent?.id || undefined) : selectedEventId;
    setCoproducers(getStoredCoproducers());

    let isMounted = true;
    Promise.all([
      fetchSalesAgentsFromSupabase(),
      fetchTicketAllocationsFromSupabase(targetEventId),
      fetchOrdersFromSupabase(),
      fetchAllSoldTicketsFromSupabase({ eventId: targetEventId }),
      fetchPosShiftHandovers({ eventId: targetEventId }),
    ]).then(([agentsRes, allocRes, ordersRes, ticketsRes, shiftRes]) => {
      if (!isMounted) return;
      if (!agentsRes.error) {
        setAgents(agentsRes.agents);
      }
      if (!allocRes.error) {
        setAllocations(allocRes.allocations);
      }
      if (!ordersRes.error) {
        setOrders(ordersRes.orders);
      }
      if (!ticketsRes.error) {
        setTickets(ticketsRes.tickets);
      }
      if (!shiftRes.error) {
        setShiftHandovers(shiftRes.handovers);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedEventId, activeEvent?.id]);

  const handleRefresh = async () => {
    const targetEventId = selectedEventId === 'all' ? (activeEvent?.id || undefined) : selectedEventId;
    setCoproducers(getStoredCoproducers());
    await loadCockpitData(targetEventId);
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



  // ID de l'événement actif à cibler strictement
  const currentEventId = selectedEventId !== 'all' ? selectedEventId : activeEvent?.id;

  // Commandes filtrées strictement pour l'événement actif
  const filteredOrders = useMemo(() => {
    if (!currentEventId) return orders;
    return orders.filter((o) => o.eventId === currentEventId);
  }, [orders, currentEventId]);

  const confirmedOrders = useMemo(() => {
    return filteredOrders.filter((o) => o.status === 'confirmed');
  }, [filteredOrders]);

  // Billets correspondants (strictement bornés à l'événement actif)
  const filteredTickets = useMemo(() => {
    if (!currentEventId) return tickets;
    return tickets.filter((t) => t.eventId === currentEventId);
  }, [tickets, currentEventId]);

  // ====================================================================
  // CALCULS DU RÉSEAU DE VENTE & BILLETS PHYSIQUES
  // ====================================================================
  const networkAgents = useMemo(() => {
    if (!activeEvent) return agents;
    return agents.filter((a) => !a.eventId || a.eventId === activeEvent.id);
  }, [agents, activeEvent]);

  // Billets physiques de l'événement actif UNIQUEMENT
  const eventPhysicalTickets = useMemo(() => {
    return filteredTickets.filter((t) => Boolean(t.isPhysical));
  }, [filteredTickets]);

  const isSoldTicketStatus = (status: UserTicket['status']): boolean =>
    status === 'sold_valid' ||
    status === 'physical_sold' ||
    status === 'scanned' ||
    status === 'used' ||
    status === 'valid';

  const promoterSoldTickets = useMemo(
    () => filteredTickets.filter((t) => isSoldTicketStatus(t.status)),
    [filteredTickets]
  );

  // Billets digitaux vendus ou scannés de l'événement actif UNIQUEMENT
  const digitalSoldTickets = useMemo(() => {
    return filteredTickets.filter((t) => !t.isPhysical && isSoldTicketStatus(t.status));
  }, [filteredTickets]);

  // Billets imprimés en stock promoteur non encore alloués
  const unassignedPhysicalTickets = useMemo(() => {
    return eventPhysicalTickets.filter(
      (t) => (t.status === 'printed_not_sold' || t.status === 'physical_printed') && !t.agentId
    );
  }, [eventPhysicalTickets]);

  // Billets alloués aux points de vente (statut printed_not_sold ou physical_allocated avec agentId)
  const allocatedPhysicalTickets = useMemo(() => {
    return eventPhysicalTickets.filter(
      (t) => (t.status === 'printed_not_sold' || t.status === 'physical_allocated') && Boolean(t.agentId)
    );
  }, [eventPhysicalTickets]);

  // Billets physiques vendus ou scannés (ne diminue jamais lors du scan à l'entrée)
  const soldPhysicalTickets = useMemo(() => {
    return eventPhysicalTickets.filter((t) => isSoldTicketStatus(t.status));
  }, [eventPhysicalTickets]);

  // Total consolidé des billets distribués au réseau (source réelle = tickets Supabase)
  const totalPhysicalDistributed = useMemo(() => {
    const fromTickets = allocatedPhysicalTickets.length + soldPhysicalTickets.length;
    if (isConnected || eventPhysicalTickets.length > 0) return fromTickets;
    return networkAgents.reduce((sum, a) => sum + (a.allocatedCount || 0), 0);
  }, [allocatedPhysicalTickets, soldPhysicalTickets, networkAgents, isConnected, eventPhysicalTickets.length]);

  // Total consolidé des billets physiques vendus et déclarés
  const totalPhysicalSold = useMemo(() => {
    const fromTickets = soldPhysicalTickets.length;
    if (isConnected || eventPhysicalTickets.length > 0) return fromTickets;
    return networkAgents.reduce((sum, a) => sum + (a.soldCount || 0), 0);
  }, [soldPhysicalTickets, networkAgents, isConnected, eventPhysicalTickets.length]);

  // Billets physiques non vendus (réserve promoteur + en circulation non vendus)
  const totalUnsoldTickets = useMemo(() => {
    return unassignedPhysicalTickets.length + Math.max(0, totalPhysicalDistributed - totalPhysicalSold);
  }, [unassignedPhysicalTickets, totalPhysicalDistributed, totalPhysicalSold]);

  // Statistiques détaillées des Billets Physiques Non Vendus par Collaborateur
  const physicalTicketsByAgent = useMemo(() => {
    return networkAgents.map((ag) => {
      const allocated = eventPhysicalTickets.filter((t) => t.agentId === ag.id);
      const useRealTickets = isConnected || allocated.length > 0;
      const printedCount = useRealTickets
        ? allocated.filter((t) => t.status !== 'cancelled').length
        : ag.allocatedCount;
      const soldCount = useRealTickets
        ? allocated.filter((t) => isSoldTicketStatus(t.status)).length
        : ag.soldCount;
      const unsoldCount = useRealTickets
        ? allocated.filter(
            (t) =>
              t.status === 'printed_not_sold' ||
              t.status === 'physical_allocated' ||
              t.status === 'physical_printed'
          ).length
        : Math.max(0, printedCount - ag.soldCount);
      const cancelledCount = allocated.filter((t) => t.status === 'cancelled').length;

      const manualCount = allocated.filter(
        (t) => isSoldTicketStatus(t.status) && Boolean(t.isManualEntry)
      ).length;

      return {
        agent: ag,
        printedCount,
        soldCount,
        unsoldCount,
        cancelledCount,
        manualCount,
      };
    });
  }, [networkAgents, eventPhysicalTickets, isConnected]);

  // Alerte Ventes Manuelles & Écarts de Caisse POS pour le Cockpit Promoteur
  const manualSalesByAgent = useMemo(() => {
    return networkAgents
      .map((ag) => {
        const agentSold = soldPhysicalTickets.filter((t) => t.agentId === ag.id);
        const manualTickets = agentSold.filter((t) => Boolean(t.isManualEntry));
        const manualCount = manualTickets.length;
        const totalSold = agentSold.length || ag.soldCount || 0;
        const manualAmount = manualTickets.reduce((sum, t) => sum + (Number(t.price) || 0), 0);
        const ratioPercent = totalSold > 0 ? Math.round((manualCount / totalSold) * 100) : 0;
        return {
          agent: ag,
          manualCount,
          totalSold,
          manualAmount,
          ratioPercent,
        };
      })
      .sort((a, b) => b.manualCount - a.manualCount || b.totalSold - a.totalSold);
  }, [networkAgents, soldPhysicalTickets]);

  const totalManualSalesCount = useMemo(
    () => manualSalesByAgent.reduce((sum, row) => sum + row.manualCount, 0),
    [manualSalesByAgent]
  );

  const blockedShiftHandovers = useMemo(() => {
    const allowedAgentIds = new Set(networkAgents.map((a) => a.id));
    return shiftHandovers.filter(
      (s) =>
        s.status === 'mismatch_blocked' &&
        (allowedAgentIds.size === 0 || allowedAgentIds.has(s.agentId))
    );
  }, [shiftHandovers, networkAgents]);

  // Totaux financiers du réseau physique
  const networkTotalGrossCollected = useMemo(() => {
    if (isConnected) {
      return soldPhysicalTickets.reduce((sum, t) => sum + (Number(t.price) || 0), 0);
    }
    return networkAgents.reduce((sum, a) => sum + (a.cashCollected || 0), 0);
  }, [networkAgents, soldPhysicalTickets, isConnected]);

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

  // ====================================================================
  // CALCULS OFFICIELS CONSOLIDÉS (Source réelle Supabase uniquement)
  // ====================================================================
  // 1. Billets vendus en ligne (Web) : priorité aux billets digitaux (valid, used, scanned), repli commandes confirmées
  const webTicketsSold = useMemo(() => {
    if (digitalSoldTickets.length > 0) {
      return digitalSoldTickets.length;
    }
    return confirmedOrders.reduce((acc, o) => acc + o.quantity, 0);
  }, [digitalSoldTickets, confirmedOrders]);

  const webGrossCA = useMemo(() => {
    if (confirmedOrders.length > 0) {
      return confirmedOrders.reduce((acc, o) => acc + o.totalAmount, 0);
    }
    return digitalSoldTickets.reduce((acc, t) => acc + (Number(t.price) || 0), 0);
  }, [confirmedOrders, digitalSoldTickets]);

  // 2. Billets physiques vendus
  const physicalTicketsSold = totalPhysicalSold;
  const physicalGrossCA = networkTotalGrossCollected;

  // 3. Billets scannés à l'entrée (physiques + digitaux)
  const scannedTicketsCount = useMemo(() => {
    return filteredTickets.filter((t) => t.status === 'used' || t.status === 'scanned').length;
  }, [filteredTickets]);

  // 4. TOTAL BILLETS VENDUS : sold_valid + physical_sold + scanned + used + valid (physique et digital)
  const totalTicketsSold = useMemo(() => {
    return webTicketsSold + physicalTicketsSold;
  }, [webTicketsSold, physicalTicketsSold]);

  // 5. CHIFFRE D'AFFAIRES BRUT CONSOLIDÉ (Web + Physique Réel)
  const totalGrossCA = useMemo(() => {
    return webGrossCA + physicalGrossCA;
  }, [webGrossCA, physicalGrossCA]);

  const promoterNetShare = Math.round(totalGrossCA * 0.9);
  const platformFeeShare = Math.round(totalGrossCA * 0.1);

  // Ventilation par Catégories (Prévente, Jour J, VIP) — 100% Web + Physique réels
  const statsByCategory = useMemo(() => {
    const matchCategory = (tierName: string, cat: 'prevente' | 'jourJ' | 'vip'): boolean => {
      const n = (tierName || '').toLowerCase();
      if (cat === 'prevente') return n.includes('prévente') || n.includes('prevente');
      if (cat === 'jourJ') return n.includes('jour') || n.includes('standard');
      return n.includes('vip');
    };

    const computeCategoryStats = (cat: 'prevente' | 'jourJ' | 'vip') => {
      const physMatched = soldPhysicalTickets.filter((t) => matchCategory(t.tierName, cat));
      const physSold = physMatched.length;
      const physCA = physMatched.reduce((sum, t) => sum + (Number(t.price) || 0), 0);

      let webSold = 0;
      let webCA = 0;
      if (digitalSoldTickets.length > 0) {
        const webMatched = digitalSoldTickets.filter((t) => matchCategory(t.tierName, cat));
        webSold = webMatched.length;
        webCA = webMatched.reduce((sum, t) => sum + (Number(t.price) || 0), 0);
      } else {
        const ordMatched = confirmedOrders.filter((o) => matchCategory(o.tierName, cat));
        webSold = ordMatched.reduce((acc, o) => acc + o.quantity, 0);
        webCA = ordMatched.reduce((acc, o) => acc + o.totalAmount, 0);
      }

      const tierConfig = activeEvent?.tiers?.find((t) => {
        if (cat === 'prevente') return t.id === 't-prev' || matchCategory(t.name, 'prevente');
        if (cat === 'jourJ') return t.id === 't-jour' || matchCategory(t.name, 'jourJ');
        return t.id === 't-vip' || matchCategory(t.name, 'vip');
      });

      return {
        sold: webSold + physSold,
        quota: tierConfig?.available ?? 0,
        ca: webCA + physCA,
      };
    };

    return {
      prevente: computeCategoryStats('prevente'),
      jourJ: computeCategoryStats('jourJ'),
      vip: computeCategoryStats('vip'),
    };
  }, [confirmedOrders, digitalSoldTickets, soldPhysicalTickets, activeEvent]);

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
      `🏛️ *Production & Thièsdn Billetterie*`;

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

  // Action : Purger les billets de test locaux
  const handleClearLocalTestTickets = () => {
    const eventTitle = activeEvent ? activeEvent.title : 'cet événement';
    const msg = `⚠️ NETTOYAGE DU CACHE LOCAL (BILLETS DE TEST)\n\n` +
      `Voulez-vous purger les billets physiques de test stockés dans le navigateur pour "${eventTitle}" ?\n\n` +
      `Cette action supprime les billets imprimés en phase de test non vendus (qui faussaient les compteurs) ` +
      `et remet à zéro les allocations locales de test.\n\n` +
      `Aucune commande réelle ne sera supprimée.`;

    if (!window.confirm(msg)) return;

    const res = clearTestPhysicalTickets(activeEvent?.id);
    clearLocalTicketReserveCache();
    void handleRefresh();
    setShowOptionsMenu(false);
    alert(`✅ Cache local nettoyé avec succès : ${res.count} billets de test purgés.`);
  };

  // Action : Impression nominative des billets d'un vendeur (Source de vérité : Supabase)
  const handlePrintAgentTickets = async (agent: SalesAgent) => {
    if (!activeEvent) return;

    setIsGeneratingPdf(true);
    setBatchSuccessMessage(null);

    try {
      let agentTickets: UserTicket[] = [];

      // 1. Requête prioritaire en base PostgreSQL Supabase avec jointure sales_agents
      const client = getSupabaseClient();
      if (client) {
        try {
          const isValidUuid = (id?: string) =>
            Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));

          let query = client
            .from('tickets')
            .select('*, sales_agents:agent_id(point_de_vente, gerant_name)')
            .eq('is_physical', true);

          if (isValidUuid(activeEvent.id)) {
            query = query.eq('event_id', activeEvent.id);
          }
          if (isValidUuid(agent.id)) {
            query = query.eq('agent_id', agent.id);
          } else {
            query = query.or(`agent_name.ilike.%${agent.pointDeVente}%,agent_id.eq.${agent.id}`);
          }

          const { data: dbTickets, error } = await query.order('serial_number', { ascending: true });

          if (!error && dbTickets && dbTickets.length > 0) {
            agentTickets = dbTickets.map((row: any) => ({
              id: row.id,
              eventId: row.event_id,
              eventTitle: row.event_title || activeEvent.title,
              eventPoster: row.event_poster || activeEvent.posterUrl,
              eventDate: row.event_date || activeEvent.date,
              eventTime: row.event_time || activeEvent.time,
              eventVenue: row.event_venue || activeEvent.venue,
              tierName: row.tier_name || 'Standard',
              price: Number(row.price) || 3000,
              qrCode: row.qr_code,
              seatNumber: row.seat_number,
              holderName: row.holder_name,
              purchasedAt: row.purchased_at || row.created_at,
              status: row.status,
              isPhysical: true,
              agentId: agent.id,
              agentName: agent.pointDeVente,
              sales_agents: row.sales_agents || {
                point_de_vente: agent.pointDeVente,
                gerant_name: agent.gerantName,
              },
              batchNumber: row.batch_number,
              serialNumber: row.serial_number,
            }));
          }
        } catch (dbErr) {
          console.warn('Erreur lecture Supabase billets agent:', dbErr);
        }
      }

      // 2. Repli mémoire / localStorage si Supabase est hors ligne ou n'a pas encore synchronisé
      if (agentTickets.length === 0) {
        agentTickets = eventPhysicalTickets.filter((t) => t.agentId === agent.id);
      }

      // 3. Vérification du stock attribué
      if (agentTickets.length === 0) {
        alert(
          `Aucun billet physique n'est actuellement attribué à "${agent.pointDeVente}".\n\nVeuillez d'abord lui attribuer un stock via le bouton "Attribuer des billets".`
        );
        setIsGeneratingPdf(false);
        setPdfProgress(null);
        return;
      }

      // 4. Garantir que le nom officiel du point de vente figure sur chaque billet
      const formattedTickets = agentTickets.map((t) => ({
        ...t,
        agentId: agent.id,
        agentName: agent.pointDeVente,
        sales_agents: {
          point_de_vente: agent.pointDeVente,
          gerant_name: agent.gerantName,
        },
      }));

      const tier =
        activeEvent.tiers?.find((t) => t.name === formattedTickets[0]?.tierName) ||
        activeEvent.tiers?.[0];
      if (!tier) throw new Error('Formule de billet introuvable.');

      setPdfProgress({ current: 0, total: formattedTickets.length });

      // 5. Générer le document PDF haute définition
      const pdfBlob = await generatePhysicalTicketsPdf(activeEvent, tier, formattedTickets, {
        batchName: `LOT-${agent.pointDeVente.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`,
        onProgress: (current, total) => setPdfProgress({ current, total }),
      });

      // 6. Téléchargement immédiat du PDF nominatif
      const blobUrl = URL.createObjectURL(pdfBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      const cleanTitle = activeEvent.title.replace(/[^a-zA-Z0-9]/g, '_');
      const cleanAgent = agent.pointDeVente.replace(/[^a-zA-Z0-9]/g, '_');
      downloadLink.download = `Billets_${cleanTitle}_${cleanAgent}_${formattedTickets.length}pcs.pdf`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(blobUrl);

      setBatchSuccessMessage(
        `🎉 PDF de ${formattedTickets.length} billets pour "${agent.pointDeVente}" généré avec succès ! Le nom "${agent.pointDeVente}" est imprimé sur chaque billet.`
      );
    } catch (err: any) {
      console.error('Erreur génération billets agent:', err);
      alert(`Erreur lors de la génération du PDF pour ${agent.pointDeVente}: ${err.message}`);
    } finally {
      setIsGeneratingPdf(false);
      setPdfProgress(null);
    }
  };

  // Génération du message WhatsApp officiel avec les accès guichet /pos
  const buildAgentAccessWhatsAppUrl = (
    agent: SalesAgent,
    email: string,
    tempPassword?: string
  ): string => {
    const digitsOnly = agent.telephone.replace(/[^0-9]/g, '');
    const waPhone =
      digitsOnly.length === 9 ? `221${digitsOnly}` : digitsOnly;
    const eventTitle = activeEvent ? activeEvent.title : agent.eventTitle || 'Événement Thièsdn';

    const lines = [
      `🎟️ *ACCÈS GUICHET VENDEUR OFFICIEL — THIÈSDN* 🇸🇳`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `Bonjour *${agent.gerantName}* (*${agent.pointDeVente}*) !`,
      ``,
      `Votre terminal de vente physique pour *${eventTitle}* est prêt. Connectez-vous pour scanner et activer nominativement vos billets :`,
      ``,
      `🔗 *Lien du Guichet Mobile :*`,
      `https://billetterie.thiesdn.site/pos`,
      ``,
      `🔐 *Vos Identifiants de Connexion :*`,
      `• *E-mail :* ${email}`,
      tempPassword
        ? `• *Mot de passe temporaire :* ${tempPassword}`
        : `• *Mot de passe :* utilisez votre mot de passe guichet habituel`,
      ``,
      `⚠️ *Consigne anti-fraude :* chaque billet papier doit être activé avec le *nom complet + téléphone* de l'acheteur avant l'entrée.`,
      ``,
      `Bonnes ventes ! — Équipe Thièsdn`,
    ];

    const message = lines.join('\n');
    return waPhone.length >= 9
      ? `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
  };

  // Provisioning / envoi des accès WhatsApp (email de secours + mot de passe généré)
  const handleSendAgentAccessWhatsApp = async (agent: SalesAgent) => {
    setActiveAgentMenuId(null);

    const fallbackEmail = agent.email?.trim() || buildFallbackPosEmail(agent.telephone, agent.id);
    const cachedCreds = agentCredentialsById[agent.id];

    // Si des identifiants viennent déjà d'être générés dans cette session et que l'agent a un userId, on réutilise sans écraser
    if (agent.userId && cachedCreds?.tempPassword) {
      const resolvedEmail = cachedCreds.email || fallbackEmail;
      const waUrl = buildAgentAccessWhatsAppUrl(agent, resolvedEmail, cachedCreds.tempPassword);
      setAgentAccessBanner({
        agent,
        email: resolvedEmail,
        tempPassword: cachedCreds.tempPassword,
        waUrl,
      });
      window.open(waUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    setProvisioningAgentId(agent.id);
    const provisionRes = await provisionSalesAgentAuthAccount({
      agentId: agent.id,
      action: 'provision',
      email: fallbackEmail,
      pointDeVente: agent.pointDeVente,
      gerantName: agent.gerantName,
      telephone: agent.telephone,
      eventId: agent.eventId || activeEvent?.id,
      regeneratePassword: true,
    });
    setProvisioningAgentId(null);

    const resolvedPassword = provisionRes.tempPassword || provisionRes.password;
    if (provisionRes.success && resolvedPassword) {
      const resolvedEmail = provisionRes.email || fallbackEmail;
      setAgentCredentialsById((prev) => ({
        ...prev,
        [agent.id]: { email: resolvedEmail, tempPassword: resolvedPassword },
      }));
      const waUrl = buildAgentAccessWhatsAppUrl(agent, resolvedEmail, resolvedPassword);
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agent.id
            ? { ...a, userId: provisionRes.userId || a.userId, email: resolvedEmail }
            : a
        )
      );
      setAgentAccessBanner({
        agent: { ...agent, userId: provisionRes.userId || agent.userId, email: resolvedEmail },
        email: resolvedEmail,
        tempPassword: resolvedPassword,
        waUrl,
      });
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } else if (provisionRes.success) {
      const resolvedEmail = provisionRes.email || fallbackEmail;
      const waUrl = buildAgentAccessWhatsAppUrl(agent, resolvedEmail);
      setAgentAccessBanner({
        agent: { ...agent, userId: provisionRes.userId || agent.userId, email: resolvedEmail },
        email: resolvedEmail,
        waUrl,
      });
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } else {
      const waUrl = buildAgentAccessWhatsAppUrl(agent, fallbackEmail);
      setAgentAccessBanner({
        agent,
        email: fallbackEmail,
        waUrl,
        warning:
          `${provisionRes.error || 'Edge Function indisponible.'} ` +
          `Vérifiez le déploiement de l'Edge Function create-sales-agent-account.`,
      });
    }
  };

  // Réinitialisation forcée du mot de passe vendeur via /reset-password + envoi WhatsApp
  const handleResetAgentPassword = async (agent: SalesAgent) => {
    setActiveAgentMenuId(null);
    setProvisioningAgentId(agent.id);

    const fallbackEmail = agent.email?.trim() || buildFallbackPosEmail(agent.telephone, agent.id);
    const resetRes = await resetSalesAgentPasswordAccount({
      agentId: agent.id,
      email: fallbackEmail,
      pointDeVente: agent.pointDeVente,
      gerantName: agent.gerantName,
      telephone: agent.telephone,
      eventId: agent.eventId || activeEvent?.id,
    });

    setProvisioningAgentId(null);

    const resolvedPassword = resetRes.tempPassword || resetRes.password;
    if (resetRes.success && resolvedPassword) {
      const resolvedEmail = resetRes.email || fallbackEmail;
      setAgentCredentialsById((prev) => ({
        ...prev,
        [agent.id]: { email: resolvedEmail, tempPassword: resolvedPassword },
      }));
      const waUrl = buildAgentAccessWhatsAppUrl(agent, resolvedEmail, resolvedPassword);
      setAgents((prev) =>
        prev.map((a) =>
          a.id === agent.id
            ? { ...a, userId: resetRes.userId || a.userId, email: resolvedEmail }
            : a
        )
      );
      setAgentAccessBanner({
        agent: { ...agent, userId: resetRes.userId || agent.userId, email: resolvedEmail },
        email: resolvedEmail,
        tempPassword: resolvedPassword,
        waUrl,
      });
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    } else {
      const waUrl = buildAgentAccessWhatsAppUrl(agent, fallbackEmail);
      setAgentAccessBanner({
        agent,
        email: fallbackEmail,
        waUrl,
        warning:
          resetRes.error ||
          "Impossible de réinitialiser le mot de passe pour ce point de vente.",
      });
    }
  };

  // Action : Génération du lot de billets physiques + Téléchargement PDF A4
  const handleGeneratePhysicalBatch = async () => {
    if (!activeEvent) return;

    // Si un point de vente spécifique est sélectionné dans le menu déroulant
    if (batchAgentFilter !== 'all') {
      const selectedAgent = networkAgents.find((a) => a.id === batchAgentFilter);
      if (selectedAgent) {
        await handlePrintAgentTickets(selectedAgent);
        return;
      }
    }

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
      downloadLink.download = `Billets_A4_${cleanTitle}_${cleanTier}_${batchCount}pcs_StockGlobal.pdf`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(blobUrl);

      // 4. Mettre à jour l'interface depuis la base
      await loadCockpitData(activeEvent.id);
      setBatchSuccessMessage(
        `🎉 Lot de ${res.tickets.length} billets en stock global généré avec succès ! Le PDF A4 prêt pour impression a été téléchargé.`
      );
    } catch (err: any) {
      console.error('Erreur génération lot physique:', err);
      alert("Erreur lors de la génération du PDF d'impression.");
    } finally {
      setIsGeneratingPdf(false);
      setPdfProgress(null);
    }
  };

  // Action : Création d'un collaborateur + compte Auth /pos automatique
  const handleCreateSalesAgentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgentShop.trim() || !newAgentManager.trim() || !newAgentPhone.trim()) {
      alert('Veuillez renseigner tous les champs obligatoires.');
      return;
    }

    setIsSavingAgent(true);
    try {
      const res = await createSalesAgent({
        eventId: activeEvent?.id || '',
        eventTitle: activeEvent?.title || 'Événement Thièsdn',
        promoterId: activeEvent?.promoter.id || '',
        pointDeVente: newAgentShop.trim(),
        gerantName: newAgentManager.trim(),
        telephone: newAgentPhone.trim(),
        email: newAgentEmail.trim() || undefined,
        quartier: newAgentQuartier,
        commissionPercent: Number(newAgentCommission) || 10,
      });

      if (res.success && res.agent) {
        await loadCockpitData(activeEvent?.id);
        const accessEmail =
          res.credentials?.email ||
          res.agent.email ||
          buildFallbackPosEmail(res.agent.telephone, res.agent.id);
        const generatedPassword = res.credentials?.tempPassword;
        if (generatedPassword) {
          setAgentCredentialsById((prev) => ({
            ...prev,
            [res.agent!.id]: { email: accessEmail, tempPassword: generatedPassword },
          }));
        }
        const waUrl = buildAgentAccessWhatsAppUrl(
          res.agent,
          accessEmail,
          generatedPassword
        );
        setAgentAccessBanner({
          agent: res.agent,
          email: accessEmail,
          tempPassword: generatedPassword,
          waUrl,
          warning: res.provisioningError,
        });
        setShowAddAgentModal(false);
        setNewAgentShop('');
        setNewAgentManager('');
        setNewAgentPhone('');
        setNewAgentEmail('');
        setNewAgentCommission(10);
      } else if (res.error) {
        alert(`Impossible de créer le point de vente : ${res.error}`);
      }
    } catch (err) {
      console.error('Erreur création collaborateur:', err);
    } finally {
      setIsSavingAgent(false);
    }
  };

  // Action : Ouvrir la modale d'attribution pour un agent donné
  const handleOpenAssignModal = (agent?: SalesAgent | null) => {
    const targetAgent = agent || networkAgents[0] || agents[0] || null;
    setSelectedAgentForAssign(targetAgent);
    const tierWithStock = activeEvent?.tiers?.find((t) =>
      unassignedPhysicalTickets.some((tk) => (tk.tierName || '').trim().toLowerCase() === t.name.trim().toLowerCase())
    );
    const firstReserveTier = unassignedPhysicalTickets[0]?.tierName;
    const initialTier = tierWithStock?.name || firstReserveTier || activeEvent?.tiers?.[0]?.name || 'Pass Prévente Thiès';
    setAssignTierName(initialTier);
    setShowAssignModal(true);
  };

  // Action : Attribution de billets
  const handleAssignTicketsSubmit = async (quantity: number) => {
    if (!selectedAgentForAssign) return;

    const count = Number(quantity);
    if (isNaN(count) || count <= 0) {
      alert('Veuillez saisir un nombre valide de billets.');
      return;
    }

    setIsAssigning(true);
    try {
      const selectedTier = assignTierName || activeEvent?.tiers?.[0]?.name || 'Standard';
      const res = await assignTicketsToAgent(selectedAgentForAssign.id, count, {
        ticketType: selectedTier,
        allocatedBy: promoterName || 'Promoteur',
        event: activeEvent || undefined,
      });

      if (res.success) {
        // 1. Mise à jour synchrone immédiate du state local
        setTickets(getStoredTickets());
        setAgents(getStoredSalesAgents());

        // 2. Synchronisation et rechargement complet depuis Supabase
        const targetEventId = selectedEventId === 'all' ? (activeEvent?.id || undefined) : selectedEventId;
        const [agentsRes, ticketsRes, allocRes] = await Promise.all([
          fetchSalesAgentsFromSupabase(),
          fetchAllSoldTicketsFromSupabase({ eventId: targetEventId }),
          fetchTicketAllocationsFromSupabase(targetEventId),
        ]);

        if (!agentsRes.error) setAgents(agentsRes.agents);
        if (!ticketsRes.error) setTickets(ticketsRes.tickets);
        if (!allocRes.error) setAllocations(allocRes.allocations);

        // 3. Lien WhatsApp de notification commerçant
        const cleanPhone = selectedAgentForAssign.telephone.replace(/[^0-9]/g, '');
        const eventTitle = activeEvent ? activeEvent.title : 'Événement Thièsdn';
        const message =
          `🎟️ *NOUVEAU STOCK DE BILLETS PHYSIQUES - THIÈSDN* 🇸🇳\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `Bonjour ${selectedAgentForAssign.gerantName} (${selectedAgentForAssign.pointDeVente}) !\n\n` +
          `Nous venons de vous confier un nouveau lot de *${res.assignedCount} billets physiques* (${selectedTier}) pour :\n` +
          `🎪 *Événement :* ${eventTitle}\n` +
          `📍 *Lieu :* ${activeEvent ? activeEvent.venue : 'Thiès'}\n` +
          `💰 *Votre commission commerçant :* ${selectedAgentForAssign.commissionPercent}%\n\n` +
          `📱 Retrouvez votre guichet et déclarez vos ventes en temps réel :\n` +
          `https://billetterie.thiesdn.site/\n\n` +
          `Bonnes ventes à ${selectedAgentForAssign.quartier} !`;

        const waUrl = cleanPhone.length >= 9
          ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
          : `https://wa.me/?text=${encodeURIComponent(message)}`;

        setAssignNotification({ message: res.message, waUrl });
        showToast('Billets attribués', 'success');
        setShowAssignModal(false);
      } else {
        alert(res.message);
      }
    } catch (err: any) {
      console.error('Erreur attribution billets:', err);
      alert('Une erreur est survenue lors de l’attribution.');
    } finally {
      setIsAssigning(false);
    }
  };

  // Action : Enregistrement de versement
  const handleRecordSettlementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentForSettlement || isSubmittingSettlement) return;
    const amount = Number(settlementAmountInput);
    if (isNaN(amount) || amount <= 0) {
      alert('Veuillez saisir un montant valide.');
      return;
    }

    setIsSubmittingSettlement(true);
    try {
      const res = await recordAgentSettlement(selectedAgentForSettlement.id, amount);
      if (res.success) {
        setAgents(getStoredSalesAgents());
        showToast('Versement encaissé', 'success');
        setShowSettlementModal(false);
        setSettlementAmountInput(0);
        setSelectedAgentForSettlement(null);
      } else {
        showToast(res.message || 'Erreur lors de l’encaissement.', 'error');
      }
    } finally {
      setIsSubmittingSettlement(false);
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
  // CALCULS GLOBAUX PLATEFORME (ADMIN) & SÉCURITÉ COMPTABLE
  // ====================================================================
  // Consolidation des transactions avec les commandes confirmées de Supabase
  const consolidatedTransactions = useMemo(() => {
    const list: TransactionRecord[] = [...transactions];
    const confirmedOrders = orders.filter((o) => o.status === 'confirmed');

    confirmedOrders.forEach((co) => {
      const exists = list.some((t) => t.orderId === co.id || t.id === co.id);
      if (!exists) {
        list.push({
          id: `tx-${co.id.slice(-6)}`,
          orderId: co.id,
          eventId: co.eventId,
          eventTitle: co.eventTitle || 'Événement Thièsdn',
          promoterId: (co as any).promoterId || co.organizerName || 'promoter-thiesdn',
          promoterName: co.organizerName || 'Promoteur Thièsdn',
          customerName: co.customerName,
          customerPhone: co.customerPhone,
          paymentMethod: co.paymentMethod,
          totalAmount: co.totalAmount,
          promoterShare: Math.round(co.totalAmount * 0.9),
          platformFee: Math.round(co.totalAmount * 0.1),
          operatorFee: 0,
          status: 'completed',
          createdAt: co.confirmedAt || co.createdAt,
        });
      }
    });

    return list;
  }, [transactions, orders]);

  // Filtrage des transactions pour l'administrateur
  const adminTransactions = useMemo(() => {
    if (selectedEventId === 'all') return consolidatedTransactions;
    return consolidatedTransactions.filter((t) => t.eventId === selectedEventId);
  }, [consolidatedTransactions, selectedEventId]);

  const totalVolumeConfirmed = useMemo(() => {
    return adminTransactions.reduce((acc, t) => acc + t.totalAmount, 0);
  }, [adminTransactions]);

  const totalPromoterShare = useMemo(() => {
    return adminTransactions.reduce((acc, t) => acc + t.promoterShare, 0);
  }, [adminTransactions]);

  const totalPlatformFee = useMemo(() => {
    return adminTransactions.reduce((acc, t) => acc + t.platformFee, 0);
  }, [adminTransactions]);

  const adminFilteredOrders = useMemo(() => {
    if (selectedEventId === 'all') return orders;
    return orders.filter((o) => o.eventId === selectedEventId);
  }, [orders, selectedEventId]);

  const signaledOrders = useMemo(() => {
    return adminFilteredOrders.filter((o) => o.status === 'payment_signaled');
  }, [adminFilteredOrders]);

  const signaledVolume = useMemo(() => {
    return signaledOrders.reduce((acc, o) => acc + o.totalAmount, 0);
  }, [signaledOrders]);

  const agentLiveStatsById = useMemo(() => {
    const statsMap = new Map<
      string,
      { printedCount: number; soldCount: number; unsoldCount: number; manualCount: number }
    >();
    physicalTicketsByAgent.forEach((entry) => {
      statsMap.set(entry.agent.id, {
        printedCount: entry.printedCount,
        soldCount: entry.soldCount,
        unsoldCount: entry.unsoldCount,
        manualCount: entry.manualCount,
      });
    });
    return statsMap;
  }, [physicalTicketsByAgent]);

  const renderAgentMoreMenu = (agent: SalesAgent, placement: 'up' | 'down') => {
    const positionClasses =
      placement === 'up'
        ? 'right-0 bottom-full mb-2'
        : 'right-0 top-full mt-1 text-left';
    const isProvisioningThis = provisioningAgentId === agent.id;

    return (
      <div
        className={`absolute ${positionClasses} w-64 rounded-2xl bg-[#121118] border border-white/15 p-2 shadow-2xl z-30 space-y-1 animate-in fade-in zoom-in-95`}
      >
        <button
          type="button"
          disabled={isProvisioningThis}
          onClick={() => void handleSendAgentAccessWhatsApp(agent)}
          className="w-full text-left px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-xs text-emerald-300 font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
        >
          <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            {isProvisioningThis ? 'Préparation des accès...' : 'Envoyer les accès WhatsApp'}
          </span>
        </button>
        <button
          type="button"
          disabled={isProvisioningThis}
          onClick={() => void handleResetAgentPassword(agent)}
          className="w-full text-left px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-xs text-amber-300 font-bold flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
        >
          <KeyRound className="w-4 h-4 text-[#E9C349] shrink-0" />
          <span>
            {isProvisioningThis ? 'Réinitialisation...' : 'Réinitialiser mot de passe'}
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveAgentMenuId(null);
            setSelectedAgentForSettlement(agent);
            setSettlementAmountInput(agent.amountDue);
            setShowSettlementModal(true);
          }}
          className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 text-xs text-gray-200 flex items-center gap-2 transition-colors cursor-pointer"
        >
          <DollarSign className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Encaisser versement</span>
        </button>
        <a
          href={`https://wa.me/${agent.telephone.replace(/[^0-9]/g, '')}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setActiveAgentMenuId(null)}
          className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 text-xs text-gray-200 flex items-center gap-2 transition-colors cursor-pointer"
        >
          <Phone className="w-4 h-4 text-[#E9C349] shrink-0" />
          <span>Contacter sur WhatsApp</span>
        </a>
        <a
          href={generateAgentWhatsAppReportUrl(agent)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setActiveAgentMenuId(null)}
          className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 text-xs text-gray-200 flex items-center gap-2 transition-colors cursor-pointer"
        >
          <Send className="w-4 h-4 text-sky-400 shrink-0" />
          <span>Envoyer bilan WhatsApp</span>
        </a>
        <button
          type="button"
          onClick={() => {
            setActiveAgentMenuId(null);
            setPreviewAgent(agent);
          }}
          className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 text-xs text-gray-200 flex items-center gap-2 transition-colors cursor-pointer"
        >
          <Store className="w-4 h-4 text-[#DCB8FF] shrink-0" />
          <span>Tester Guichet Mobile</span>
        </button>
      </div>
    );
  };

  // ====================================================================
  // 1. VUE PROMOTEUR & GESTION RÉSEAU / BILLETS PHYSIQUES (ADMIN & PROMOTEUR)
  // ====================================================================
  if (currentRole === 'promoter' || promoterTab !== 'compta') {
    return (
      <div className="w-full max-w-6xl mx-auto space-y-8 pb-[calc(80px+env(safe-area-inset-bottom))] animate-in fade-in duration-300">
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
            <p className="text-sm text-[#E5E2E1] mt-1">
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

        {/* Barre d'onglets simplifiée : 3 ONGLETS DIRECTS À GAUCHE + OPTIONS & SÉLECTEUR À DROITE */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          {/* Onglets principaux collés sans espace superflu */}
          <div className="flex items-center overflow-x-auto flex-nowrap scrollbar-none max-w-full bg-[#1C1B1B] p-1 rounded-2xl border border-white/10 gap-1 shrink-0 self-start sm:self-auto">
            {/* 1. VUE D'ENSEMBLE */}
            <button
              type="button"
              onClick={() => {
                setPromoterTab('stats');
                setShowOptionsMenu(false);
              }}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-heading font-extrabold tracking-wider uppercase transition-all flex items-center gap-2 shrink-0 ${
                promoterTab === 'stats'
                  ? 'bg-[#E9C349] text-[#241A00] shadow-md shadow-[#E9C349]/20'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Vue d'ensemble</span>
            </button>

            {/* 2. BILLETS */}
            <button
              type="button"
              onClick={() => {
                setPromoterTab('network');
                setShowOptionsMenu(false);
              }}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-heading font-extrabold tracking-wider uppercase transition-all flex items-center gap-2 shrink-0 ${
                promoterTab === 'network'
                  ? 'bg-gradient-to-r from-[#8A2BE2] to-[#E9C349] text-white shadow-md shadow-[#8A2BE2]/40'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <Ticket className="w-4 h-4" />
              <span>Billets</span>
              <span className="bg-white/20 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                {totalPhysicalDistributed > 0 ? totalPhysicalDistributed : networkAgents.length}
              </span>
            </button>

            {/* 3. FINANCES */}
            <button
              type="button"
              onClick={() => {
                setPromoterTab('finances');
                setShowOptionsMenu(false);
              }}
              className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs font-heading font-extrabold tracking-wider uppercase transition-all flex items-center gap-2 shrink-0 ${
                promoterTab === 'finances'
                  ? 'bg-[#8A2BE2] text-white shadow-md shadow-[#8A2BE2]/30'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <Wallet className="w-4 h-4" />
              <span>Finances</span>
            </button>
          </div>

          {/* Groupe Droit : Menu Options + Sélecteur d'Événement (Alignés à droite) */}
          <div className="flex items-center gap-2.5 sm:ml-auto w-full sm:w-auto justify-between sm:justify-end">
            {/* BOUTON OPTIONS DÉROULANT : ICÔNE RÉGLAGES ULTRA-COMPACTE */}
            <div ref={optionsMenuRef} className="relative shrink-0 z-50">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowOptionsMenu((prev) => !prev);
                }}
                className={`p-2 sm:p-2.5 rounded-xl transition-all flex items-center justify-center border cursor-pointer select-none ${
                  ['unsold', 'coprod', 'accreditations', 'stations', 'compta'].includes(promoterTab)
                    ? 'bg-[#E9C349]/20 text-[#E9C349] border-[#E9C349]/40 shadow-sm'
                    : 'bg-[#1C1B1B] text-gray-300 hover:text-white border-white/10 hover:border-white/20'
                }`}
                title="Modules spécialisés & réglages"
                aria-label="Options et réglages"
              >
                <Settings className={`w-4 h-4 text-[#E9C349] transition-transform duration-300 ${showOptionsMenu ? 'rotate-90 text-white' : ''}`} />
              </button>

              {showOptionsMenu && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-[#171717] border border-white/15 rounded-2xl shadow-2xl z-[100] p-2 space-y-1 animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-gray-300 border-b border-white/5">
                    Modules Spécialisés
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setPromoterTab('unsold');
                      setShowOptionsMenu(false);
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between text-left transition-colors ${
                      promoterTab === 'unsold'
                        ? 'bg-[#E9C349]/20 text-[#E9C349] font-bold'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                      <span>Billets Non Vendus & Rapatriement</span>
                    </div>
                    <span className="text-[10px] font-mono bg-white/10 px-1.5 py-0.5 rounded-full text-gray-300">
                      {totalUnsoldTickets}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPromoterTab('coprod');
                      setShowOptionsMenu(false);
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center justify-between text-left transition-colors ${
                      promoterTab === 'coprod'
                        ? 'bg-[#E9C349]/20 text-[#E9C349] font-bold'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Crown className="w-4 h-4 text-[#E9C349]" />
                      <span>Co-Production & Artiste</span>
                    </div>
                    <span className="text-[10px] font-mono bg-white/10 px-1.5 py-0.5 rounded-full text-gray-300">
                      {coproducers.filter((c) => !activeEvent || c.eventId === activeEvent.id).length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPromoterTab('accreditations');
                      setShowOptionsMenu(false);
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 text-left transition-colors ${
                      promoterTab === 'accreditations'
                        ? 'bg-[#8A2BE2]/20 text-[#DCB8FF] font-bold'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 text-[#8A2BE2]" />
                    <span>Accréditations Staff & Presse</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPromoterTab('stations');
                      setShowOptionsMenu(false);
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 text-left transition-colors ${
                      promoterTab === 'stations'
                        ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                        : 'text-gray-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <span>Postes de Contrôle QR</span>
                  </button>

                  {currentRole === 'admin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setPromoterTab('compta');
                        setShowOptionsMenu(false);
                      }}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 text-left transition-colors ${
                        promoterTab === 'compta'
                          ? 'bg-[#8A2BE2] text-white font-bold'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Wallet className="w-4 h-4 text-[#8A2BE2]" />
                      <span>Comptabilité Plateforme (Admin)</span>
                    </button>
                  )}

                  <div className="border-t border-white/10 my-1 pt-1">
                    <button
                      type="button"
                      onClick={handleClearLocalTestTickets}
                      className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-rose-300 hover:bg-rose-950/40 hover:text-rose-200 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>Purger les billets de test locaux</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Sélecteur d'Événement pour filtrer les statistiques (Poussé à droite) */}
            {promoterEvents.length > 0 && (
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-gray-300 font-bold hidden md:inline shrink-0">Événement :</span>
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="bg-[#1C1B1B] border border-white/10 text-white text-xs rounded-xl px-3 py-2 outline-none focus:border-[#E9C349] font-medium max-w-[180px] sm:max-w-xs truncate cursor-pointer"
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
        </div>

        {/* Bannière de retour vers la vue d'ensemble si un sous-onglet est actif */}
        {['unsold', 'coprod', 'accreditations', 'stations'].includes(promoterTab) && (
          <div className="flex items-center gap-2 -mt-4">
            <button
              type="button"
              onClick={() => setPromoterTab('stats')}
              className="text-xs text-gray-300 hover:text-[#E9C349] font-bold flex items-center gap-1 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5 rotate-180" />
              <span>Retour à la Vue d'ensemble</span>
            </button>
          </div>
        )}

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

            {/* 4 Cartes KPI Temps Réel du Cockpit (Design Liquid Glass Épuré) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* 1. Billets Vendus Totaux */}
              <div className="p-6 rounded-2xl bg-white/5 backdrop-blur-lg border border-white/10 space-y-3 relative overflow-hidden hover:border-[#8A2BE2]/40 transition-all shadow-xl group">
                <div className="w-12 h-12 rounded-xl bg-[#8A2BE2]/20 text-[#DCB8FF] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Ticket className="w-6 h-6" />
                </div>
                <p className="text-xs uppercase tracking-wider text-gray-300 font-bold">Billets Vendus</p>
                <h3 className="font-heading text-3xl font-black text-white">
                  {totalTicketsSold} <span className="text-xs text-[#DCB8FF] font-bold">places</span>
                </h3>
                <p className="text-xs text-[#E5E2E1]">
                  {webTicketsSold} en ligne • {physicalTicketsSold} en boutique
                </p>
              </div>

              {/* 2. Chiffre d'Affaires Brut */}
              <div className="p-6 rounded-2xl bg-white/5 backdrop-blur-lg border border-white/10 space-y-3 relative overflow-hidden hover:border-[#E9C349]/40 transition-all shadow-xl group">
                <div className="w-12 h-12 rounded-xl bg-[#E9C349]/20 text-[#E9C349] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <DollarSign className="w-6 h-6" />
                </div>
                <p className="text-xs uppercase tracking-wider text-gray-300 font-bold">CA Brut Consolidé</p>
                <h3 className="font-heading text-3xl font-black text-[#E9C349]">
                  {totalGrossCA.toLocaleString('fr-FR')} <span className="text-xs text-white font-bold">FCFA</span>
                </h3>
                <p className="text-xs text-[#E5E2E1]">
                  {webGrossCA > 0 ? `${webGrossCA.toLocaleString('fr-FR')} F Web` : '0 F Web'} • {physicalGrossCA > 0 ? `${physicalGrossCA.toLocaleString('fr-FR')} F Réseau` : '0 F Réseau'}
                </p>
              </div>

              {/* 3. Reversement Net Promoteur (90%) */}
              <div className="p-6 rounded-2xl bg-white/5 backdrop-blur-lg border border-white/10 space-y-3 relative overflow-hidden hover:border-[#E9C349]/40 transition-all shadow-xl group">
                <div className="w-12 h-12 rounded-xl bg-[#E9C349]/20 text-[#E9C349] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <p className="text-xs uppercase tracking-wider text-gray-300 font-bold">Net Promoteur (90%)</p>
                <h3 className="font-heading text-3xl font-black text-[#E9C349]">
                  {promoterNetShare.toLocaleString('fr-FR')} <span className="text-xs text-white font-bold">FCFA</span>
                </h3>
                <p className="text-xs text-[#E5E2E1]">Reversement garanti sous 24h</p>
              </div>

              {/* 4. Billets Scannés à l'Entrée */}
              <div className="p-6 rounded-2xl bg-white/5 backdrop-blur-lg border border-white/10 space-y-3 relative overflow-hidden hover:border-[#8A2BE2]/40 transition-all shadow-xl group">
                <div className="w-12 h-12 rounded-xl bg-[#8A2BE2]/20 text-[#DCB8FF] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <QrCode className="w-6 h-6" />
                </div>
                <p className="text-xs uppercase tracking-wider text-gray-300 font-bold">Billets Scannés</p>
                <h3 className="font-heading text-3xl font-black text-white">
                  {scannedTicketsCount} <span className="text-xs text-gray-300 font-bold">/ {totalTicketsSold}</span>
                </h3>
                <p className="text-xs text-[#E5E2E1]">
                  {totalTicketsSold > 0
                    ? `${Math.round((scannedTicketsCount / totalTicketsSold) * 100)}% de taux de présence`
                    : 'Contrôle laser le jour J'}
                </p>
              </div>
            </div>

            {/* Alerte Promoteur : Ventes Manuelles par Vendeur & Écarts de Caisse POS */}
            <div
              className={`p-5 sm:p-6 rounded-3xl border space-y-4 shadow-xl transition-all ${
                totalManualSalesCount > 0 || blockedShiftHandovers.length > 0
                  ? 'bg-gradient-to-br from-amber-950/35 via-[#1C1B1B] to-rose-950/20 border-amber-500/40'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3.5">
                <div className="flex items-start sm:items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      totalManualSalesCount > 0
                        ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                        : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
                    }`}
                  >
                    {totalManualSalesCount > 0 ? (
                      <AlertTriangle className="w-5 h-5" />
                    ) : (
                      <ShieldCheck className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-heading font-extrabold text-base sm:text-lg text-white">
                        Alerte Sécurité : Ventes Manuelles
                      </h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${
                          totalManualSalesCount > 0
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        {totalManualSalesCount} billet(s) manuel(s)
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 mt-0.5">
                      {totalManualSalesCount > 0
                        ? 'Ces billets ont été activés sans scan caméra (déclaration manuelle ou saisie du code). Vérifiez les vendeurs concernés.'
                        : 'Aucune vente manuelle détectée : 100 % des billets physiques vendus ont été scannés par caméra.'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPromoterTab('network')}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-bold text-white inline-flex items-center gap-1.5 self-start sm:self-auto shrink-0 cursor-pointer"
                >
                  <Store className="w-3.5 h-3.5 text-[#E9C349]" />
                  <span>Gérer les vendeurs</span>
                </button>
              </div>

              {manualSalesByAgent.length === 0 ? (
                <p className="text-xs text-[#E5E2E1]">
                  Aucun point de vente physique n&apos;est encore rattaché à cet événement.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {manualSalesByAgent.map(({ agent, manualCount, totalSold, manualAmount, ratioPercent }) => (
                    <div
                      key={agent.id}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                        manualCount > 0
                          ? 'bg-amber-950/30 border-amber-500/40'
                          : 'bg-black/25 border-white/10'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-heading font-bold text-sm text-white truncate">
                          {agent.pointDeVente}
                        </p>
                        <p className="text-[11px] text-gray-300 truncate">
                          {agent.gerantName} • {totalSold} vendu(s) au total
                        </p>
                        {manualCount > 0 && (
                          <p className="text-[11px] text-amber-300/90 font-semibold mt-0.5">
                            {manualAmount.toLocaleString('fr-FR')} F ({ratioPercent}% des ventes)
                          </p>
                        )}
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-xl text-xs font-black border ${
                            manualCount > 0
                              ? 'bg-amber-500/20 text-amber-200 border-amber-400/50'
                              : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          }`}
                        >
                          {manualCount} manuel{manualCount > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {blockedShiftHandovers.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-500/45 space-y-2">
                  <div className="flex items-center gap-2 text-rose-300 text-xs font-extrabold uppercase tracking-wider">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>
                      Alertes Clôture de Caisse Bloquée ({blockedShiftHandovers.length})
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {blockedShiftHandovers.slice(0, 5).map((shift) => (
                      <div
                        key={shift.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-xs text-rose-100 bg-black/30 px-3 py-2 rounded-xl border border-rose-500/20"
                      >
                        <span className="font-bold">
                          {shift.agentName || 'Guichet POS'}
                        </span>
                        <span>
                          Saisi : <strong>{shift.countedAmount.toLocaleString('fr-FR')} F</strong> vs Attendu :{' '}
                          <strong>{shift.expectedAmount.toLocaleString('fr-FR')} F</strong> (Écart :{' '}
                          <strong className="text-rose-300">
                            {shift.discrepancyAmount > 0 ? '+' : ''}
                            {shift.discrepancyAmount.toLocaleString('fr-FR')} F
                          </strong>
                          )
                        </span>
                        <span className="text-[10px] text-gray-300">
                          {new Date(shift.createdAt).toLocaleString('fr-FR')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Ventilation par Catégorie de Billets (Liquid Glass & Jauges Épurées) */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white/5 backdrop-blur-lg border border-white/10 space-y-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <Layers className="w-5 h-5 text-[#E9C349]" />
                  <h3 className="font-heading font-extrabold text-base sm:text-lg text-white">
                    Ventes par Catégorie de Billet (Jauges en Direct)
                  </h3>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/5 text-gray-300 border border-white/10">Temps Réel</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 1. Pass Prévente */}
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4 hover:border-[#8A2BE2]/40 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#DCB8FF] uppercase tracking-wider">
                      Pass Prévente
                    </span>
                    <span className="text-xs font-bold text-white font-heading">
                      {statsByCategory.prevente.sold} vendus
                    </span>
                  </div>

                  {/* Barre de progression */}
                  <div className="w-full bg-[#1F1F1F] rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-[#8A2BE2] h-2.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(
                          100,
                          (statsByCategory.prevente.sold / (statsByCategory.prevente.quota || 1)) * 100
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-xs text-gray-300 pt-1">
                    <span>Quota restant : {Math.max(0, statsByCategory.prevente.quota - statsByCategory.prevente.sold)}</span>
                    <span className="font-extrabold text-[#E9C349] font-mono">
                      {statsByCategory.prevente.ca.toLocaleString('fr-FR')} F
                    </span>
                  </div>
                </div>

                {/* 2. Pass Jour J */}
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4 hover:border-[#8A2BE2]/40 transition-all">
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

                  <div className="flex justify-between items-center text-xs text-gray-300 pt-1">
                    <span>Quota restant : {Math.max(0, statsByCategory.jourJ.quota - statsByCategory.jourJ.sold)}</span>
                    <span className="font-extrabold text-[#E9C349] font-mono">
                      {statsByCategory.jourJ.ca.toLocaleString('fr-FR')} F
                    </span>
                  </div>
                </div>

                {/* 3. Pass VIP Prestige */}
                <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-4 hover:border-[#E9C349]/40 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#E9C349] uppercase tracking-wider flex items-center gap-1.5">
                      <Crown className="w-4 h-4" />
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

                  <div className="flex justify-between items-center text-xs text-gray-300 pt-1">
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
                <span className="text-xs text-gray-300">
                  Cliquez sur l'icône WhatsApp pour envoyer un rappel personnalisé
                </span>
              </div>

              {filteredOrders.length === 0 ? (
                <div className="p-8 rounded-2xl bg-[#141414] text-center space-y-2 border border-white/5">
                  <Ticket className="w-8 h-8 text-gray-300 mx-auto" />
                  <p className="text-xs text-[#E5E2E1]">
                    Aucune réservation enregistrée pour le moment.
                  </p>
                </div>
              ) : (
                <>
                  {/* VUE CARTES MOBILES (< 768px - Festivaliers & Commandes) */}
                  <div className="flex flex-col gap-3 md:hidden">
                    {filteredOrders.map((order) => (
                      <div
                        key={`mob-order-${order.id}`}
                        className="p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 space-y-3 shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-2">
                          <div>
                            <h4 className="font-heading font-extrabold text-white text-sm">
                              {order.customerName}
                            </h4>
                            <p className="font-mono text-xs text-gray-300 mt-0.5">
                              📱 {order.customerPhone}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              order.status === 'confirmed'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : order.status === 'payment_signaled'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-white/10 text-gray-300'
                            }`}
                          >
                            {order.status === 'confirmed'
                              ? 'Confirmé'
                              : order.status === 'payment_signaled'
                              ? 'À valider'
                              : 'En attente'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-black/40 border border-white/5">
                          <div>
                            <span className="text-[10px] text-gray-300 uppercase font-bold block">Formule</span>
                            <span className="font-semibold text-white">{order.tierName} • {order.quantity} pl.</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-gray-300 uppercase font-bold block">Montant</span>
                            <span className="font-heading font-black text-sm text-[#E9C349]">
                              {order.totalAmount.toLocaleString('fr-FR')} FCFA
                            </span>
                          </div>
                        </div>

                        <a
                          href={generateClientWhatsAppUrl(order)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full min-h-[44px] rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                          <MessageSquare className="w-4 h-4 fill-current" />
                          <span>Envoyer Rappel WhatsApp</span>
                        </a>
                      </div>
                    ))}
                  </div>

                  {/* VUE TABLEAU DESKTOP (>= 768px) */}
                  <div className="overflow-x-auto hidden md:block">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-gray-300 uppercase font-heading tracking-wider">
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
                                  : 'bg-white/10 text-gray-300'
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
              </>
            )}
            </div>
          </div>
        )}

        {/* SOUS-VUE 2 : MES VENTES & REVERSEMENTS (90%) */}
        {promoterTab === 'finances' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="glass-panel p-5 rounded-2xl border border-[#E9C349]/30 bg-[#241A00]/30 space-y-2">
                <p className="text-xs uppercase tracking-wider text-gray-300 font-bold">Total Encaissé</p>
                <h3 className="font-heading text-2xl font-black text-white">
                  {totalGrossCA.toLocaleString('fr-FR')} <span className="text-xs text-[#E9C349]">FCFA</span>
                </h3>
                <p className="text-[11px] text-gray-300">Paiements validés pour vos soirées</p>
              </div>

              <div className="glass-panel p-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 space-y-2">
                <p className="text-xs uppercase tracking-wider text-gray-300 font-bold">Votre Part Nette (90%)</p>
                <h3 className="font-heading text-2xl font-black text-emerald-400">
                  {promoterNetShare.toLocaleString('fr-FR')} <span className="text-xs text-white">FCFA</span>
                </h3>
                <p className="text-[11px] text-gray-300">À virer directement sur votre Wave Business</p>
              </div>

              <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-2">
                <p className="text-xs uppercase tracking-wider text-gray-300 font-bold">Commission Thièsdn (10%)</p>
                <h3 className="font-heading text-2xl font-black text-[#DCB8FF]">
                  {platformFeeShare.toLocaleString('fr-FR')} <span className="text-xs text-white">FCFA</span>
                </h3>
                <p className="text-[11px] text-gray-300">Frais de plateforme et hébergement</p>
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
                  className="text-xs font-bold text-gray-300 hover:text-white px-2 py-1"
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
                  <p className="text-xs text-[#E5E2E1] mt-1 max-w-2xl leading-relaxed">
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
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* 1. Destination des Billets (Stock Global vs Vendeur Spécifique) */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-300">
                    Destination des Billets
                  </label>
                  <select
                    value={batchAgentFilter}
                    onChange={(e) => setBatchAgentFilter(e.target.value)}
                    className="w-full bg-[#141414] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-[#E9C349] font-medium"
                  >
                    <option value="all">🌐 Tous les billets (Stock Global)</option>
                    {networkAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        📍 {agent.pointDeVente} ({agent.allocatedCount} billets attribués)
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Choix de la formule / Tier */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-300">
                    Formule & Catégorie
                  </label>
                  <select
                    value={batchTierId || activeEvent?.tiers?.[0]?.id || ''}
                    onChange={(e) => setBatchTierId(e.target.value)}
                    disabled={batchAgentFilter !== 'all'}
                    className="w-full bg-[#141414] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-[#E9C349] font-medium disabled:opacity-50"
                  >
                    {activeEvent?.tiers?.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} — {t.price.toLocaleString('fr-FR')} FCFA
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Volume de billets à générer */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-300 flex justify-between">
                    <span>Nombre de Billets</span>
                    <span className="text-[#E9C349] font-mono">
                      {batchAgentFilter === 'all'
                        ? `${batchCount} pièces`
                        : `${networkAgents.find((a) => a.id === batchAgentFilter)?.allocatedCount || 0} pièces`}
                    </span>
                  </label>
                  {batchAgentFilter === 'all' ? (
                    <div className="flex gap-1.5">
                      {[20, 50, 100, 200, 300, 500].map((qty) => (
                        <button
                          key={qty}
                          type="button"
                          onClick={() => setBatchCount(qty)}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border ${
                            batchCount === qty
                              ? 'bg-[#E9C349] text-[#241A00] border-[#E9C349] shadow-md font-extrabold'
                              : 'bg-[#141414] text-gray-300 border-white/10 hover:text-white'
                          }`}
                        >
                          {qty}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="py-2.5 px-3 rounded-xl bg-black/40 border border-white/5 text-xs text-gray-300 flex items-center justify-between">
                      <span>Billets déjà attribués</span>
                      <span className="text-sky-300 font-bold font-mono">
                        {networkAgents.find((a) => a.id === batchAgentFilter)?.allocatedCount || 0} pass
                      </span>
                    </div>
                  )}
                </div>

                {/* 4. Synthèse & Bouton de Téléchargement */}
                <div className="space-y-2 md:self-end">
                  <button
                    onClick={handleGeneratePhysicalBatch}
                    disabled={
                      isGeneratingPdf ||
                      !activeEvent ||
                      (batchAgentFilter !== 'all' &&
                        (networkAgents.find((a) => a.id === batchAgentFilter)?.allocatedCount || 0) === 0)
                    }
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#8A2BE2] via-[#A855F7] to-[#E9C349] text-white font-heading font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-[#8A2BE2]/40 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
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
                        <Printer className="w-4 h-4 text-white" />
                        <span>
                          {batchAgentFilter === 'all'
                            ? `Télécharger Stock Global (${Math.ceil(batchCount / 4)} p.)`
                            : `🖨️ Imprimer les Billets (${networkAgents.find((a) => a.id === batchAgentFilter)?.allocatedCount || 0} p.)`}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Bandeau d'astuce d'impression */}
              <div className="p-4 rounded-2xl bg-[#0F0F12] border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-300 gap-3">
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

            {/* SECTION 2 : 4 CARTES KPI DU RÉSEAU DE VENTE PHYSIQUE (Liquid Glass) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* 1. Billets Imprimés en Réserve */}
              <div className="p-6 rounded-2xl bg-white/5 backdrop-blur-lg border border-white/10 space-y-3 hover:border-[#8A2BE2]/40 transition-all shadow-xl group">
                <div className="w-12 h-12 rounded-xl bg-[#8A2BE2]/20 text-[#DCB8FF] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <FileText className="w-6 h-6" />
                </div>
                <p className="text-xs uppercase tracking-wider text-gray-300 font-bold">En Réserve Promoteur</p>
                <h3 className="font-heading text-3xl font-black text-white">
                  {unassignedPhysicalTickets.length} <span className="text-xs text-[#DCB8FF] font-bold">billets</span>
                </h3>
                <p className="text-xs text-[#E5E2E1]">Imprimés, prêts à être alloués</p>
                {unassignedPhysicalTickets.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleOpenAssignModal()}
                    className="w-full mt-2 py-2 px-3 rounded-xl bg-[#8A2BE2]/20 hover:bg-[#8A2BE2]/30 text-[#DCB8FF] border border-[#8A2BE2]/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Truck className="w-4 h-4" />
                    <span>Distribuer le stock →</span>
                  </button>
                )}
              </div>

              {/* 2. Billets Distribués au Réseau */}
              <div className="p-6 rounded-2xl bg-white/5 backdrop-blur-lg border border-white/10 space-y-3 hover:border-[#E9C349]/40 transition-all shadow-xl group">
                <div className="w-12 h-12 rounded-xl bg-[#E9C349]/20 text-[#E9C349] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Store className="w-6 h-6" />
                </div>
                <p className="text-xs uppercase tracking-wider text-gray-300 font-bold">Distribués en Boutique</p>
                <h3 className="font-heading text-3xl font-black text-[#E9C349]">
                  {totalPhysicalDistributed} <span className="text-xs text-white font-bold">billets</span>
                </h3>
                <p className="text-xs text-[#E5E2E1]">Confier à {networkAgents.length} partenaires</p>
              </div>

              {/* 3. Billets Physiques Vendus */}
              <div className="p-6 rounded-2xl bg-white/5 backdrop-blur-lg border border-white/10 space-y-3 hover:border-[#8A2BE2]/40 transition-all shadow-xl group">
                <div className="w-12 h-12 rounded-xl bg-[#8A2BE2]/20 text-[#DCB8FF] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <CheckCheck className="w-6 h-6" />
                </div>
                <p className="text-xs uppercase tracking-wider text-gray-300 font-bold">Vendus & Déclarés</p>
                <h3 className="font-heading text-3xl font-black text-white">
                  {totalPhysicalSold} <span className="text-xs text-[#DCB8FF] font-bold">billets</span>
                </h3>
                <p className="text-xs text-[#E5E2E1]">
                  CA Réseau : {networkTotalGrossCollected.toLocaleString('fr-FR')} FCFA
                </p>
              </div>

              {/* 4. Cash Restant à Récupérer */}
              <div className="p-6 rounded-2xl bg-white/5 backdrop-blur-lg border border-white/10 space-y-3 hover:border-[#E9C349]/40 transition-all shadow-xl group">
                <div className="w-12 h-12 rounded-xl bg-[#E9C349]/20 text-[#E9C349] flex items-center justify-center group-hover:scale-105 transition-transform">
                  <DollarSign className="w-6 h-6" />
                </div>
                <p className="text-xs uppercase tracking-wider text-gray-300 font-bold">Cash Net à Récupérer</p>
                <h3 className="font-heading text-3xl font-black text-[#E9C349]">
                  {networkTotalAmountDue.toLocaleString('fr-FR')} <span className="text-xs text-white font-bold">FCFA</span>
                </h3>
                <p className="text-xs text-[#E5E2E1]">
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
                  <p className="text-xs text-[#E5E2E1] mt-0.5">
                    Suivi des stocks confiés, commissions commerçants (10%) et encaissement des espèces.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenAssignModal()}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-[#8A2BE2] hover:from-sky-400 hover:to-[#9B3BF2] text-white text-xs font-heading font-extrabold flex items-center gap-2 transition-all shadow-md shadow-[#8A2BE2]/30 cursor-pointer"
                  >
                    <Truck className="w-4 h-4" />
                    <span>Attribuer des Billets</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAddAgentModal(true)}
                    className="px-4 py-2.5 rounded-xl bg-[#1C1B1B] hover:bg-[#2A2A2A] border border-white/10 text-white text-xs font-heading font-bold flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Ajouter un Point de Vente</span>
                  </button>
                </div>
              </div>

              {agentAccessBanner && (
                <div className="p-4 sm:p-5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 space-y-3 animate-in fade-in">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <MessageCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div>
                        <h4 className="font-heading font-extrabold text-sm text-white">
                          Accès Guichet /pos — {agentAccessBanner.agent.pointDeVente}
                        </h4>
                        <p className="text-xs text-gray-300 mt-0.5">
                          URL : <span className="font-mono text-[#E9C349]">https://billetterie.thiesdn.site/pos</span> • E-mail :{' '}
                          <span className="font-mono text-white">{agentAccessBanner.email}</span>
                          {agentAccessBanner.tempPassword && (
                            <>
                              {' '}• Mot de passe temporaire :{' '}
                              <span className="font-mono font-bold text-emerald-300">{agentAccessBanner.tempPassword}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAgentAccessBanner(null)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {agentAccessBanner.warning && (
                    <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
                      ⚠️ {agentAccessBanner.warning}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={agentAccessBanner.waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-heading font-extrabold flex items-center gap-2 transition-colors shadow-md"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Envoyer les accès sur WhatsApp</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        const txt = [
                          `Lien Guichet : https://billetterie.thiesdn.site/pos`,
                          `E-mail : ${agentAccessBanner.email}`,
                          agentAccessBanner.tempPassword ? `Mot de passe : ${agentAccessBanner.tempPassword}` : '',
                        ]
                          .filter(Boolean)
                          .join('\n');
                        void navigator.clipboard.writeText(txt);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-[#E9C349]" />
                      <span>Copier</span>
                    </button>
                  </div>
                </div>
              )}

              {networkAgents.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-[#141414] border border-white/5 space-y-3">
                  <Store className="w-10 h-10 text-gray-300 mx-auto" />
                  <h4 className="font-heading font-bold text-sm text-white">
                    Aucun collaborateur enregistré
                  </h4>
                  <p className="text-xs text-[#E5E2E1] max-w-sm mx-auto">
                    Ajoutez vos points de vente partenaires à Thiès (boutiques, kiosques, stations-service) pour leur confier des stocks de billets.
                  </p>
                </div>
              ) : (
                <>
                  {/* VUE MOBILE / CARTES DES POINTS DE VENTE (Liquid Glass & Règle des 2 Boutons Max) */}
                  <div className="block md:hidden space-y-4">
                    {networkAgents.map((agent) => {
                      const liveStats = agentLiveStatsById.get(agent.id);
                      const allocatedDisplay = liveStats ? liveStats.printedCount : agent.allocatedCount;
                      const soldDisplay = liveStats ? liveStats.soldCount : agent.soldCount;
                      const remaining = liveStats
                        ? liveStats.unsoldCount
                        : Math.max(0, agent.allocatedCount - agent.soldCount);
                      const isMenuOpen = activeAgentMenuId === agent.id;
                      return (
                        <div
                          key={`card-${agent.id}`}
                          className="p-5 rounded-2xl bg-white/5 backdrop-blur-lg border border-white/10 space-y-4 relative shadow-lg"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-heading font-extrabold text-white text-base">
                                  {agent.pointDeVente}
                                </h4>
                                <span className="bg-white/10 text-gray-300 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-white/10">
                                  📍 {agent.quartier}
                                </span>
                                {(liveStats?.manualCount || 0) > 0 && (
                                  <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/40">
                                    <AlertTriangle className="w-3 h-3" />
                                    {liveStats?.manualCount} manuel{(liveStats?.manualCount || 0) > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[#E5E2E1] mt-1">
                                Gérant : <strong className="text-gray-200">{agent.gerantName}</strong>
                              </p>
                            </div>
                            <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-[#8A2BE2]/20 text-[#DCB8FF] border border-[#8A2BE2]/30 font-bold">
                              {allocatedDisplay} confiés
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 text-xs pt-1 border-t border-white/5">
                            <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                              <span className="text-gray-300 text-[10px] uppercase font-bold">Vendus :</span>
                              <p className="font-mono font-bold text-emerald-400 text-sm mt-0.5">{soldDisplay} billets</p>
                            </div>
                            <div className="p-3 rounded-xl bg-black/40 border border-white/5">
                              <span className="text-gray-300 text-[10px] uppercase font-bold">En stock boutique :</span>
                              <p className="font-mono font-bold text-[#E9C349] text-sm mt-0.5">{remaining} billets</p>
                            </div>
                          </div>

                          {/* Actions : Maximum 2 boutons visibles + 1 bouton MoreVertical pour le reste */}
                          <div className="pt-2 flex items-center gap-2 relative">
                            {/* Bouton 1 : Attribuer (Violet) */}
                            <button
                              type="button"
                              onClick={() => handleOpenAssignModal(agent)}
                              className="flex-1 py-2.5 px-3 rounded-xl bg-[#8A2BE2] hover:bg-[#9B3BF2] text-white text-xs font-heading font-extrabold flex items-center justify-center gap-1.5 shadow-md shadow-[#8A2BE2]/30 transition-all cursor-pointer"
                            >
                              <Truck className="w-4 h-4" />
                              <span>Attribuer</span>
                            </button>

                            {/* Bouton 2 : Imprimer ses billets (Doré / Liquid) */}
                            <button
                              type="button"
                              onClick={() => handlePrintAgentTickets(agent)}
                              disabled={isGeneratingPdf || allocatedDisplay === 0}
                              className="flex-1 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed text-xs font-heading font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer hover:border-[#E9C349]/50"
                              title={
                                allocatedDisplay === 0
                                  ? 'Aucun billet attribué à ce vendeur'
                                  : `Imprimer les ${allocatedDisplay} billets de ${agent.pointDeVente}`
                              }
                            >
                              <Printer className="w-4 h-4 text-[#E9C349]" />
                              <span>🖨️ Imprimer ({allocatedDisplay})</span>
                            </button>

                            {/* Menu MoreVertical : Actions secondaires cachées */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setActiveAgentMenuId(isMenuOpen ? null : agent.id)}
                                className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-all cursor-pointer"
                                title="Plus d'actions"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {isMenuOpen && renderAgentMoreMenu(agent, 'up')}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* TABLEAU DES POINTS DE VENTE (Desktop / Tablette) */}
                  <div className="overflow-x-auto hidden md:block">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/10 text-gray-300 uppercase font-heading tracking-wider">
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
                          const liveStats = agentLiveStatsById.get(agent.id);
                          const allocatedDisplay = liveStats ? liveStats.printedCount : agent.allocatedCount;
                          const soldDisplay = liveStats ? liveStats.soldCount : agent.soldCount;
                          const remaining = liveStats
                            ? liveStats.unsoldCount
                            : Math.max(0, agent.allocatedCount - agent.soldCount);
                          const progressPercent = allocatedDisplay > 0
                            ? Math.round((soldDisplay / allocatedDisplay) * 100)
                            : 0;

                          return (
                            <tr key={agent.id} className="hover:bg-white/5 transition-colors">
                              <td className="py-4 px-3">
                                <div className="font-heading font-bold text-white text-sm">
                                  {agent.pointDeVente}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAssignModal(agent)}
                                    className="px-2.5 py-1 rounded-lg bg-sky-500/25 hover:bg-sky-500/40 text-sky-200 border border-sky-400/50 text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-sm hover:scale-[1.02] active:scale-95 cursor-pointer"
                                    title={`Attribuer des billets physiques à ${agent.pointDeVente}`}
                                  >
                                    <Truck className="w-3.5 h-3.5 text-sky-400" />
                                    <span>Attribuer</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handlePrintAgentTickets(agent)}
                                    disabled={isGeneratingPdf || allocatedDisplay === 0}
                                    className="px-2.5 py-1 rounded-lg bg-[#8A2BE2]/25 hover:bg-[#8A2BE2]/40 text-[#DCB8FF] border border-[#8A2BE2]/50 disabled:opacity-40 disabled:cursor-not-allowed text-[11px] font-bold flex items-center gap-1.5 transition-all shadow-sm hover:scale-[1.02] active:scale-95 cursor-pointer"
                                    title={
                                      allocatedDisplay === 0
                                        ? 'Aucun billet attribué à ce vendeur'
                                        : `Imprimer les ${allocatedDisplay} billets de ${agent.pointDeVente}`
                                    }
                                  >
                                    <Printer className="w-3.5 h-3.5 text-[#E9C349]" />
                                    <span>🖨️ Imprimer ({allocatedDisplay})</span>
                                  </button>

                                  <span className="inline-block bg-white/10 text-gray-300 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-white/10">
                                    📍 {agent.quartier}
                                  </span>

                                  {(liveStats?.manualCount || 0) > 0 && (
                                    <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/40">
                                      <AlertTriangle className="w-3 h-3" />
                                      {liveStats?.manualCount} manuel{(liveStats?.manualCount || 0) > 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
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
                                  <span className="text-emerald-400">{soldDisplay} vendus</span>
                                  <span className="text-gray-300">/ {allocatedDisplay}</span>
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
                                <div className="text-[10px] text-gray-300">
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
                                <div className="flex items-center justify-end gap-2 relative">
                                  {/* Bouton 1 : Attribuer (Violet) */}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAssignModal(agent)}
                                    className="px-3 py-2 rounded-xl bg-[#8A2BE2] hover:bg-[#9B3BF2] text-white text-xs font-heading font-extrabold flex items-center gap-1.5 shadow-md shadow-[#8A2BE2]/20 transition-all cursor-pointer"
                                    title={`Attribuer un lot de billets à ${agent.pointDeVente}`}
                                  >
                                    <Truck className="w-3.5 h-3.5" />
                                    <span>Attribuer</span>
                                  </button>

                                  {/* Bouton 2 : Imprimer nominatif */}
                                  <button
                                    type="button"
                                    onClick={() => handlePrintAgentTickets(agent)}
                                    disabled={isGeneratingPdf || allocatedDisplay === 0}
                                    className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed text-xs font-heading font-extrabold flex items-center gap-1.5 transition-all cursor-pointer hover:border-[#E9C349]/50"
                                    title={
                                      allocatedDisplay === 0
                                        ? 'Aucun billet attribué à imprimer'
                                        : `Imprimer les ${allocatedDisplay} billets de ${agent.pointDeVente}`
                                    }
                                  >
                                    <Printer className="w-3.5 h-3.5 text-[#E9C349]" />
                                    <span>🖨️ Imprimer ({allocatedDisplay})</span>
                                  </button>

                                  {/* Menu MoreVertical : Actions secondaires cachées */}
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={() => setActiveAgentMenuId(activeAgentMenuId === agent.id ? null : agent.id)}
                                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-all cursor-pointer"
                                      title="Plus d'actions"
                                    >
                                      <MoreVertical className="w-4 h-4" />
                                    </button>

                                    {activeAgentMenuId === agent.id && renderAgentMoreMenu(agent, 'down')}
                                  </div>
                                </div>
                              </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
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
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white"
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
                          inputMode="tel"
                          required
                          value={newAgentPhone}
                          onChange={(e) => setNewAgentPhone(e.target.value)}
                          placeholder="Ex: +221 77 123 45 67"
                          className="input-glass w-full rounded-2xl px-4 py-3 text-sm text-white mt-1 outline-none focus:border-[#E9C349]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-gray-300">
                        E-mail de connexion /pos (optionnel)
                      </label>
                      <input
                        type="email"
                        value={newAgentEmail}
                        onChange={(e) => setNewAgentEmail(e.target.value)}
                        placeholder="Sinon généré auto : <téléphone>@pos.thiesdn.site"
                        className="input-glass w-full rounded-2xl px-4 py-3 text-sm text-white mt-1 outline-none focus:border-[#E9C349]"
                      />
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
                        className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-[#8A2BE2] to-[#E9C349] text-white font-heading font-extrabold text-xs uppercase tracking-wider shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isSavingAgent && <Loader2 className="w-4 h-4 animate-spin" />}
                        <span>{isSavingAgent ? 'Enregistrement...' : 'Créer le Partenaire'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* MODALE : ATTRIBUER DES BILLETS PHYSIQUES */}
            <AssignPhysicalTicketsModal
              isOpen={showAssignModal}
              onClose={() => setShowAssignModal(false)}
              agents={networkAgents.length > 0 ? networkAgents : agents}
              selectedAgent={selectedAgentForAssign}
              onSelectAgent={setSelectedAgentForAssign}
              events={safeEvents}
              selectedEventId={selectedEventId}
              onSelectEventId={setSelectedEventId}
              activeEvent={activeEvent}
              assignTierName={assignTierName}
              onChangeTierName={setAssignTierName}
              unassignedPhysicalTickets={unassignedPhysicalTickets}
              onSubmit={handleAssignTicketsSubmit}
              isAssigning={isAssigning}
            />

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
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleRecordSettlementSubmit} className="space-y-4">
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1">
                      <p className="text-xs text-gray-300 uppercase font-bold">Collaborateur</p>
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
                        inputMode="decimal"
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
                        disabled={isSubmittingSettlement}
                        className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-heading font-extrabold text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                      >
                        {isSubmittingSettlement && <Loader2 className="w-4 h-4 animate-spin" />}
                        <span>{isSubmittingSettlement ? 'Encaissement...' : 'Enregistrer la Remise'}</span>
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
                      username: previewAgent.gerantName.toLowerCase().replace(/\s+/g, '.'),
                      email: previewAgent.email || 'agent@thiesdn.sn',
                      phone: previewAgent.telephone,
                      city: 'Thiès',
                      address: previewAgent.quartier || 'Thiès',
                      quartier: previewAgent.quartier || '',
                      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
                      isVip: false,
                      role: 'sales_agent',
                      isEmailConfirmed: true,
                      termsAccepted: true,
                      connectedAccounts: { facebook: false, instagram: false, tiktok: false },
                      privacySettings: { publicProfile: false, biometricLogin: false, emailNotifications: true },
                    }}
                    onNavigateBack={() => setPreviewAgent(null)}
                  />
                </div>
              </div>
            )}

            {/* Registre compact des billets vendus + Modale QR à la demande */}
            <div className="pt-4 border-t border-white/10">
              <SoldTicketsSection
                tickets={promoterSoldTickets}
                events={promoterEvents}
                onOpenTicketModal={(tkt) => setSelectedTicketForModal(tkt)}
              />
            </div>

            <TicketDetailModal
              ticket={selectedTicketForModal}
              isOpen={selectedTicketForModal !== null}
              onClose={() => setSelectedTicketForModal(null)}
              mode="admin"
            />
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
                  className="text-xs font-bold text-gray-300 hover:text-white px-2 py-1"
                >
                  ✕
                </button>
              </div>
            )}

            {/* 4 KPIs de Traçabilité */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass-panel p-5 rounded-3xl border border-white/10 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-300">
                  Billets Imprimés
                </p>
                <h4 className="font-heading text-2xl font-black text-white">
                  {unassignedPhysicalTickets.length + totalPhysicalDistributed}{' '}
                  <span className="text-xs font-bold text-gray-300">billets</span>
                </h4>
                <p className="text-[10px] text-gray-300">Total lots physiques générés</p>
              </div>

              <div className="glass-panel p-5 rounded-3xl border border-emerald-500/30 bg-emerald-950/20 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  Déclarés Vendus
                </p>
                <h4 className="font-heading text-2xl font-black text-emerald-300">
                  {totalPhysicalSold}{' '}
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
                <p className="text-[10px] text-gray-300">Protection anti-vols active</p>
              </div>
            </div>

            {/* Tableau Récapitulatif par Collaborateur : "X imprimés, Y vendus, Z non vendus" */}
            <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
                <div>
                  <h4 className="font-heading font-black text-base text-white">
                    État des Stocks par Collaborateur du Réseau
                  </h4>
                  <p className="text-xs text-[#E5E2E1]">
                    Suivi précis des billets confiés et bouton de désactivation préventive des invendus avant l'événement.
                  </p>
                </div>
              </div>

              {physicalTicketsByAgent.length === 0 ? (
                <p className="text-xs text-[#E5E2E1] py-6 text-center">
                  Aucun collaborateur n'a encore été rattaché à cet événement.
                </p>
              ) : (
                <>
                  {/* VUE CARTES MOBILES (< 768px - Rapatriement Invendus) */}
                  <div className="flex flex-col gap-3 md:hidden">
                    {physicalTicketsByAgent.map((item) => (
                      <div
                        key={`mob-unsold-${item.agent.id}`}
                        className="p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 space-y-3 shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-2">
                          <div>
                            <h4 className="font-heading font-extrabold text-white text-sm">
                              {item.agent.pointDeVente}
                            </h4>
                            <p className="text-xs text-[#E5E2E1] mt-0.5">
                              Responsable : <strong className="text-gray-200">{item.agent.gerantName}</strong>
                            </p>
                            <p className="font-mono text-[11px] text-[#DCB8FF] mt-0.5">
                              📱 {item.agent.telephone}
                            </p>
                          </div>
                          <div>
                            {item.unsoldCount > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                                Inactifs
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                                Lot épuisé
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Synthèse Chiffres X/Y/Z */}
                        <div className="grid grid-cols-3 gap-2 text-center text-xs p-2.5 rounded-xl bg-black/40 border border-white/5">
                          <div>
                            <span className="text-[10px] text-gray-300 uppercase font-bold block">Imprimés</span>
                            <span className="font-heading font-bold text-white text-sm">{item.printedCount}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-300 uppercase font-bold block">Vendus</span>
                            <span className="font-heading font-bold text-emerald-400 text-sm">{item.soldCount}</span>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-300 uppercase font-bold block">Invendus</span>
                            <span className="font-heading font-bold text-amber-300 text-sm">{item.unsoldCount}</span>
                          </div>
                        </div>

                        {item.unsoldCount > 0 && (
                          <button
                            type="button"
                            disabled={isDeactivating}
                            onClick={() => handleDeactivateUnsoldTickets(item.agent.id)}
                            className="w-full min-h-[44px] rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                          >
                            <span>Désactiver les {item.unsoldCount} invendus</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* VUE TABLEAU DESKTOP (>= 768px) */}
                  <div className="overflow-x-auto hidden md:block">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/5 text-gray-300 uppercase font-heading text-[10px]">
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
                            <span className="text-[11px] text-gray-300 flex items-center gap-1">
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
                              <span className="text-[11px] text-gray-300 italic">Aucun invendu</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
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
                <p className="text-xs uppercase tracking-wider text-gray-300 font-bold">CA Total Événement</p>
                <h3 className="font-heading text-2xl font-black text-white">
                  {totalGrossCA.toLocaleString('fr-FR')} <span className="text-xs text-[#E9C349]">FCFA</span>
                </h3>
                <p className="text-[11px] text-gray-300">Base de calcul pour tous les ayants-droit</p>
              </div>

              <div className="glass-panel p-5 rounded-2xl border border-[#E9C349]/30 bg-[#241A00]/20 space-y-2">
                <p className="text-xs uppercase tracking-wider text-gray-300 font-bold">Total Parts Co-Producteurs</p>
                <h3 className="font-heading text-2xl font-black text-[#E9C349]">
                  {coproducers
                    .filter((c) => !activeEvent || c.eventId === activeEvent.id)
                    .reduce((sum, c) => sum + c.revenueShare, 0)}% <span className="text-xs text-white">du CA</span>
                </h3>
                <p className="text-[11px] text-gray-300">
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
                <p className="text-xs uppercase tracking-wider text-gray-300 font-bold">Part Nette Producteur Principal</p>
                <h3 className="font-heading text-2xl font-black text-emerald-400">
                  {Math.max(
                    0,
                    100 -
                      coproducers
                        .filter((c) => !activeEvent || c.eventId === activeEvent.id)
                        .reduce((sum, c) => sum + c.revenueShare, 0)
                  )}% <span className="text-xs text-white">du CA</span>
                </h3>
                <p className="text-[11px] text-gray-300">
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
                  <p className="text-xs text-[#E5E2E1] mt-0.5">
                    Chaque ayant-droit dispose d’un accès dédié en direct pour vérifier ses chiffres et sa guest list.
                  </p>
                </div>
              </div>

              {/* VUE CARTES MOBILES (< 768px - Ayants-Droit & Co-Production) */}
              <div className="flex flex-col gap-3 md:hidden">
                {coproducers
                  .filter((c) => !activeEvent || c.eventId === activeEvent.id)
                  .map((coprod) => {
                    const netAmount = Math.round((totalGrossCA * coprod.revenueShare) / 100);
                    return (
                      <div
                        key={`mob-coprod-${coprod.id}`}
                        className="p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 space-y-3 shadow-md"
                      >
                        <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-2">
                          <div>
                            <h4 className="font-heading font-extrabold text-white text-sm">
                              {coprod.name}
                            </h4>
                            <span className="inline-block mt-0.5 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase border bg-[#8A2BE2]/20 text-[#DCB8FF] border-[#8A2BE2]/40">
                              {coprod.roleType === 'artiste'
                                ? 'Artiste Vedette'
                                : coprod.roleType === 'staff_artiste'
                                ? 'Staff Artiste'
                                : coprod.roleType === 'gerant_lieu'
                                ? 'Gérant du Lieu'
                                : 'Co-Producteur'}
                            </span>
                            <p className="font-mono text-xs text-gray-300 mt-1">
                              📱 {coprod.phone}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-heading font-black text-lg text-[#E9C349] block">
                              {coprod.revenueShare}%
                            </span>
                            <span className="text-[10px] text-gray-300">part brute</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs p-2.5 rounded-xl bg-black/40 border border-white/5">
                          <div>
                            <span className="text-[10px] text-gray-300 uppercase font-bold block">Montant Net</span>
                            <span className="font-heading font-bold text-white text-sm">
                              {netAmount.toLocaleString('fr-FR')} FCFA
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-gray-300 uppercase font-bold block">Guest List</span>
                            <span className="font-heading font-bold text-[#DCB8FF] text-xs">
                              {coprod.guestTicketsUsed} / {coprod.guestTicketsAllocated} places
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setPreviewCoproducer(coprod)}
                            className="min-h-[44px] rounded-xl bg-[#E9C349]/20 hover:bg-[#E9C349]/30 text-[#E9C349] text-xs font-bold border border-[#E9C349]/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Crown className="w-3.5 h-3.5" />
                            <span>Aperçu Cockpit</span>
                          </button>
                          <a
                            href={`https://wa.me/${coprod.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                              `Bonjour ${coprod.name} ! Voici le point en temps réel pour *${activeEvent?.title || 'votre événement'}* sur Thièsdn Billetterie :\n• Chiffre d'affaires brut : ${totalGrossCA.toLocaleString('fr-FR')} FCFA\n• Votre part (${coprod.revenueShare}%) : ${netAmount.toLocaleString('fr-FR')} FCFA\n• Accédez à votre Cockpit Artiste officiel : https://thiesdn.mgartswork.site/`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="min-h-[44px] rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </a>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* VUE TABLEAU DESKTOP (>= 768px) */}
              <div className="overflow-x-auto hidden md:block">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-gray-300 uppercase font-heading tracking-wider">
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
                              <div className="text-[10px] text-gray-300">Revenus nets</div>
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
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white"
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
                          inputMode="tel"
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
                        className="flex-1 py-3 rounded-2xl btn-gold-glow font-heading font-extrabold text-xs uppercase tracking-wider shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isSavingCoprod && <Loader2 className="w-4 h-4 animate-spin text-[#241A00]" />}
                        <span>{isSavingCoprod ? 'Enregistrement...' : 'Enregistrer cet Ayant-Droit'}</span>
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
    <div className="max-w-6xl mx-auto space-y-8 pb-[calc(80px+env(safe-area-inset-bottom))] animate-in fade-in duration-300">
      {/* Navigation par Onglets Administrateur */}
      <div className="flex bg-[#1C1B1B] p-1 rounded-2xl border border-white/10 overflow-x-auto max-w-full">
        <button
          type="button"
          onClick={() => setPromoterTab('compta')}
          className={`px-4 py-2 rounded-xl text-xs font-heading font-extrabold tracking-wider uppercase transition-all flex items-center gap-2 ${
            promoterTab === 'compta'
              ? 'bg-[#8A2BE2] text-white shadow-md shadow-[#8A2BE2]/40'
              : 'text-gray-300 hover:text-white'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>Comptabilité Plateforme (Option 3)</span>
        </button>

        <button
          type="button"
          onClick={() => setPromoterTab('network')}
          className="px-4 py-2 rounded-xl text-xs font-heading font-extrabold tracking-wider uppercase transition-all flex items-center gap-2 text-gray-300 hover:text-white cursor-pointer"
        >
          <Store className="w-4 h-4 text-[#E9C349]" />
          <span>Réseau & Billets Physiques</span>
          <span className="bg-[#E9C349]/20 text-[#E9C349] text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
            {networkAgents.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setPromoterTab('unsold')}
          className="px-4 py-2 rounded-xl text-xs font-heading font-extrabold tracking-wider uppercase transition-all flex items-center gap-2 text-gray-300 hover:text-white cursor-pointer"
        >
          <AlertCircle className="w-4 h-4 text-rose-400" />
          <span>Billets Non Vendus</span>
        </button>

        <button
          type="button"
          onClick={() => setPromoterTab('stats')}
          className="px-4 py-2 rounded-xl text-xs font-heading font-extrabold tracking-wider uppercase transition-all flex items-center gap-2 text-gray-300 hover:text-white cursor-pointer"
        >
          <BarChart3 className="w-4 h-4 text-sky-400" />
          <span>Cockpit Organisateur</span>
        </button>
      </div>

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
          <p className="text-sm text-[#E5E2E1] mt-1">
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

      {/* Filtre Déroulant Multi-Événements (Admin Finances) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#141414] p-4 sm:p-5 rounded-3xl border border-white/10 shadow-xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-300 font-extrabold">
            <Filter className="w-4 h-4 text-[#8A2BE2]" />
            <span>Filtrer les Transactions :</span>
          </div>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="bg-[#1C1B1B] border border-white/15 text-white text-xs rounded-xl px-4 py-2.5 outline-none focus:border-[#E9C349] font-bold cursor-pointer"
          >
            <option value="all">Tous les événements</option>
            {safeEvents.map((evt) => {
              if (!evt) return null;
              const statusStr = String(evt.status || '').toLowerCase();
              const isArchived = statusStr === 'archived' || Boolean(evt.isDeleted) || Boolean(evt.deletedAt);
              return (
                <option key={evt.id} value={evt.id}>
                  {isArchived ? `📦 [Archivé] ${evt.title || 'Sans titre'}` : `🎟️ ${evt.title || 'Sans titre'}`}
                </option>
              );
            })}
          </select>
        </div>

        {selectedEventId !== 'all' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#E9C349] font-extrabold bg-[#E9C349]/10 px-3 py-1 rounded-xl border border-[#E9C349]/30">
              {adminTransactions.length} transaction(s) rattachée(s)
            </span>
            {(() => {
              const cur = safeEvents.find((e) => e && e.id === selectedEventId);
              const statusStr = String(cur?.status || '').toLowerCase();
              const isArchived = statusStr === 'archived' || Boolean(cur?.isDeleted) || Boolean(cur?.deletedAt);
              return isArchived ? (
                <span className="text-[11px] bg-slate-700/60 text-slate-300 font-bold px-2.5 py-0.5 rounded-full border border-slate-600">
                  📦 Événement Archivé
                </span>
              ) : null;
            })()}
          </div>
        )}
      </div>

      {/* KPI Cards : État des Flux Financiers */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Confirmé Encaissé */}
        <div className="glass-panel p-5 rounded-2xl border border-emerald-500/30 space-y-2 relative overflow-hidden bg-emerald-950/20">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
          <p className="text-xs uppercase tracking-wider text-gray-300 font-bold">Encaissé Confirmé</p>
          <h3 className="font-heading text-2xl font-black text-white">
            {totalVolumeConfirmed.toLocaleString('fr-FR')} <span className="text-xs text-emerald-400 font-bold">FCFA</span>
          </h3>
          <p className="text-[11px] text-gray-300">Paiements validés & billets émis</p>
        </div>

        {/* Signalé en Attente de Vérification */}
        <div className="glass-panel p-5 rounded-2xl border border-amber-500/30 space-y-2 relative overflow-hidden bg-amber-950/20">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <p className="text-xs uppercase tracking-wider text-gray-300 font-bold">Signalé (À Vérifier)</p>
          <h3 className="font-heading text-2xl font-black text-amber-300">
            {signaledVolume.toLocaleString('fr-FR')} <span className="text-xs text-white font-bold">FCFA</span>
          </h3>
          <p className="text-[11px] text-gray-300">{signaledOrders.length} virement(s) à confirmer dans Modération</p>
        </div>

        {/* Part Promoteurs (90%) */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-2 relative overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-[#E9C349]/20 text-[#E9C349] flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
          <p className="text-xs uppercase tracking-wider text-gray-300 font-bold">Part Promoteurs (90%)</p>
          <h3 className="font-heading text-2xl font-black text-[#E9C349]">
            {totalPromoterShare.toLocaleString('fr-FR')} <span className="text-xs text-white font-bold">FCFA</span>
          </h3>
          <p className="text-[11px] text-gray-300">À reverser aux organisateurs</p>
        </div>

        {/* Commission Thièsdn (10%) */}
        <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-2 relative overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-[#DCB8FF]/20 text-[#DCB8FF] flex items-center justify-center">
            <Percent className="w-5 h-5" />
          </div>
          <p className="text-xs uppercase tracking-wider text-gray-300 font-bold">Commission Thièsdn (10%)</p>
          <h3 className="font-heading text-2xl font-black text-[#DCB8FF]">
            {totalPlatformFee.toLocaleString('fr-FR')} <span className="text-xs text-white font-bold">FCFA</span>
          </h3>
          <p className="text-[11px] text-gray-300">Revenu net plateforme</p>
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
              <label className="text-[10px] font-bold text-gray-300 uppercase tracking-wider block mb-1">
                Numéro Wave Récepteur
              </label>
              <input
                type="tel"
                inputMode="tel"
                value={paymentSettings.waveNumber}
                onChange={(e) =>
                  setLocalPaymentSettings({ ...paymentSettings, waveNumber: e.target.value })
                }
                placeholder="+221 77 000 00 00"
                className="input-glass w-full rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-300 uppercase tracking-wider block mb-1">
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
              <label className="text-[10px] font-bold text-gray-300 uppercase tracking-wider block mb-1">
                Numéro Orange Money Récepteur
              </label>
              <input
                type="tel"
                inputMode="tel"
                value={paymentSettings.omNumber}
                onChange={(e) =>
                  setLocalPaymentSettings({ ...paymentSettings, omNumber: e.target.value })
                }
                placeholder="+221 78 000 00 00"
                className="input-glass w-full rounded-xl px-3 py-2 text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-300 uppercase tracking-wider block mb-1">
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
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300 block mb-1">
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
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300 block mb-1">
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

            <div className="mt-3 bg-[#0A0A0C] p-3 rounded-xl border border-white/5 font-mono text-[10px] text-gray-300 max-h-36 overflow-y-auto">
              <pre>{SUPABASE_SQL_SCHEMA}</pre>
            </div>
          </div>

          <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-gray-300">
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
              Historique des Transactions & Répartitions ({adminTransactions.length})
            </h2>
          </div>

          <div className="text-xs text-gray-300">
            Paiements en direct via Mobile Money
          </div>
        </div>

        {/* Mobile View: Transaction Cards */}
        <div className="block md:hidden space-y-3">
          {adminTransactions.length === 0 ? (
            <p className="text-center py-6 text-[#E5E2E1] text-xs">Aucune transaction enregistrée.</p>
          ) : (
            adminTransactions.map((tx) => {
              const cur = safeEvents.find((e) => e && e.id === tx.eventId);
              const statusStr = String(cur?.status || '').toLowerCase();
              const isArchived = statusStr === 'archived' || Boolean(cur?.isDeleted) || Boolean(cur?.deletedAt);
              return (
                <div key={tx.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-mono text-white font-bold text-xs truncate max-w-[140px]">{tx.id}</span>
                    <div className="flex items-center gap-1.5">
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
                      <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        <Check className="w-3 h-3" /> Validé
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-white text-sm line-clamp-2">{tx.eventTitle}</p>
                      {isArchived && (
                        <span className="text-[9px] bg-slate-700/60 text-slate-300 font-bold px-1.5 py-0.2 rounded-full border border-slate-600">
                          📦 Archivé
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#DCB8FF] truncate">{tx.promoterName}</p>
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-300 bg-black/30 p-2.5 rounded-xl border border-white/5">
                    <div>
                      <p className="font-medium text-white truncate max-w-[150px]">{tx.customerName}</p>
                      <p className="text-[10px] text-gray-300 font-mono">{tx.customerPhone}</p>
                    </div>
                    <span className="text-[10px] text-gray-300 text-right">
                      {new Date(tx.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-gray-300 uppercase tracking-wider">Total Encaissé</p>
                      <p className="text-base font-heading font-extrabold text-white">{tx.totalAmount.toLocaleString('fr-FR')} F</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-[#E9C349]">Promoteur: <span className="font-bold font-mono">{tx.promoterShare.toLocaleString('fr-FR')} F</span></p>
                      <p className="text-[10px] text-[#DCB8FF]">Thiesdn (10%): <span className="font-bold font-mono">{tx.platformFee.toLocaleString('fr-FR')} F</span></p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-gray-300 uppercase font-heading tracking-wider">
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
              {adminTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-3.5 px-3">
                    <p className="font-mono text-white font-bold">{tx.id}</p>
                    <p className="text-[10px] text-gray-300">
                      {new Date(tx.createdAt).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </td>

                  <td className="py-3.5 px-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-semibold text-white truncate max-w-xs">{tx.eventTitle}</p>
                      {(() => {
                        const cur = safeEvents.find((e) => e && e.id === tx.eventId);
                        const statusStr = String(cur?.status || '').toLowerCase();
                        const isArchived = statusStr === 'archived' || Boolean(cur?.isDeleted) || Boolean(cur?.deletedAt);
                        return isArchived ? (
                          <span className="text-[9px] bg-slate-700/60 text-slate-300 font-bold px-1.5 py-0.2 rounded-full border border-slate-600">
                            📦 Archivé
                          </span>
                        ) : null;
                      })()}
                    </div>
                    <p className="text-[11px] text-[#DCB8FF]">{tx.promoterName}</p>
                  </td>

                  <td className="py-3.5 px-3">
                    <p className="text-white">{tx.customerName}</p>
                    <p className="text-[10px] text-gray-300 font-mono">{tx.customerPhone}</p>
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
