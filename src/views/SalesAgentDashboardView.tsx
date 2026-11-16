import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Store,
  Ticket,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Phone,
  QrCode,
  ArrowRight,
  ArrowLeft,
  Send,
  RefreshCw,
  Plus,
  Calendar,
  MapPin,
  Clock,
  ShieldCheck,
  Percent,
  Scan,
  Camera,
  CameraOff,
  Flashlight,
  Check,
  CheckCheck,
  Search,
  ShoppingCart,
  Wifi,
  WifiOff,
  CloudUpload,
  LogOut,
  Bell,
  BellRing,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Lock,
  Upload,
  Loader2,
} from 'lucide-react';
import { SalesAgent, UserTicket, EventItem, UserProfile } from '../types';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useToast } from '../contexts/ToastContext';
import { useVisualViewport } from '../hooks/useVisualViewport';
import {
  startOptimizedScanner,
  preloadScannerEngine,
  scanTicketImageFile,
  formatFriendlyCameraError,
  OptimizedScannerHandle,
  ScannerMetrics,
} from '../utils/scannerEngine';
import {
  savePosAgentSnapshot,
  loadPosAgentSnapshot,
  recordOfflinePosSale,
  getPendingOfflinePosSales,
  getPendingOfflineQrCodes,
  syncPendingOfflinePosSales,
} from '../services/posOfflineCache';
import {
  getStoredSalesAgents,
  getStoredTickets,
  saveStoredTickets,
  recordAgentSettlement,
  saveSalesAgents,
  lookupPhysicalTicketForSale,
  verifyPosTicketForSale,
  confirmSinglePhysicalTicketSale,
  fetchSalesAgentsFromSupabase,
  fetchAllSoldTicketsFromSupabase,
  isSupabaseConfigured,
  clearLocalTicketReserveCache,
  getSupabaseClient,
  submitPosShiftHandover,
} from '../services/supabase';

const playPosFeedbackTone = (type: 'success' | 'error') => {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (type === 'success') {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880.0, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220.0, ctx.currentTime);
      osc.frequency.setValueAtTime(164.81, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch {
    // Ignore si l'audio est bloqué par le navigateur
  }
};

const extractScannedTicketCode = (rawText: string): string => {
  const trimmed = rawText.trim();
  const urlMatch = trimmed.match(/(?:\/scan\/|[?&]code=)([A-Za-z0-9\-_]+)/i);
  return (urlMatch ? urlMatch[1] : trimmed).trim().toUpperCase();
};

const isTicketUnsoldStatus = (status: UserTicket['status']): boolean =>
  status === 'printed_not_sold' || status === 'physical_allocated' || status === 'physical_printed';

const isTicketSoldStatus = (status: UserTicket['status']): boolean =>
  status === 'sold_valid' || status === 'physical_sold' || status === 'scanned' || status === 'used';

interface SalesAgentDashboardViewProps {
  currentAgentId?: string;
  promoterPhone?: string;
  events?: EventItem[];
  onOpenScanner?: () => void;
  user?: UserProfile;
  onNavigateBack?: () => void;
  onSignOut?: () => Promise<void> | void;
}

export const SalesAgentDashboardView: React.FC<SalesAgentDashboardViewProps> = ({
  currentAgentId,
  promoterPhone = '+221 77 458 74 74',
  events = [],
  onOpenScanner,
  user,
  onNavigateBack,
  onSignOut,
}) => {
  const { showToast } = useToast();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSubmittingSettlement, setIsSubmittingSettlement] = useState(false);
  const {
    isSupported: isPushSupported,
    isSubscribed: isPushSubscribed,
    isLoading: isPushLoading,
    isIosNeedsInstall: isPosIosNeedsInstall,
    error: pushError,
    statusMessage: pushStatusMessage,
    subscribe: subscribePosPush,
  } = usePushNotifications(user?.id);
  const [posPushFeedback, setPosPushFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const isConnected = isSupabaseConfigured();
  const initialOfflineSnapshot = useMemo(
    () => loadPosAgentSnapshot(currentAgentId || user?.assignedAgentId),
    [currentAgentId, user?.assignedAgentId]
  );
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [agents, setAgents] = useState<SalesAgent[]>(() => {
    if (!isConnected) return getStoredSalesAgents();
    if (initialOfflineSnapshot.agents.length > 0) return initialOfflineSnapshot.agents;
    return [];
  });
  const [tickets, setTickets] = useState<UserTicket[]>(() => {
    if (!isConnected) return getStoredTickets();
    if (initialOfflineSnapshot.tickets.length > 0) return initialOfflineSnapshot.tickets;
    return [];
  });
  const [isRefreshing, setIsRefreshing] = useState<boolean>(
    isConnected && (typeof navigator === 'undefined' || navigator.onLine)
  );
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(() =>
    getPendingOfflinePosSales(currentAgentId || user?.assignedAgentId).length
  );
  const [isSyncingOffline, setIsSyncingOffline] = useState<boolean>(false);
  const [offlineSyncBanner, setOfflineSyncBanner] = useState<string | null>(null);
  const [saleSuccessIsOffline, setSaleSuccessIsOffline] = useState<boolean>(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>(() => {
    if (currentAgentId) return currentAgentId;
    if (user?.assignedAgentId) return user.assignedAgentId;
    const initialAgents = isConnected ? [] : getStoredSalesAgents();
    const byUserId = initialAgents.find((a) => a.userId === user?.id || (user?.phone && a.telephone.includes(user.phone)));
    if (byUserId) return byUserId.id;
    return initialAgents[0]?.id || '';
  });

  // Modale de déclaration de vente avec deux méthodes : Scan unitaire vs Déclaration manuelle
  const [showSaleModal, setShowSaleModal] = useState(false);
  const saleModalViewport = useVisualViewport(showSaleModal);
  const [saleMode, setSaleMode] = useState<'scan' | 'manual'>('scan');
  const [manualTicketCode, setManualTicketCode] = useState('');
  const [selectedManualTicketCode, setSelectedManualTicketCode] = useState('');
  const [manualFilterQuery, setManualFilterQuery] = useState('');
  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'printed_not_sold' | 'sold'>('all');
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryPage, setInventoryPage] = useState(1);
  const INVENTORY_PAGE_SIZE = 25;
  const [pendingTicketForConfirm, setPendingTicketForConfirm] = useState<UserTicket | null>(null);
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [saleSuccessMessage, setSaleSuccessMessage] = useState<string | null>(null);
  const [saleErrorMessage, setSaleErrorMessage] = useState<string | null>(null);
  const [isCameraScanning, setIsCameraScanning] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [isScanningImageFile, setIsScanningImageFile] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [scannerMetrics, setScannerMetrics] = useState<ScannerMetrics | null>(null);
  const scannerHandleRef = useRef<OptimizedScannerHandle | null>(null);
  const scannerRunIdRef = useRef<number>(0);
  const isStartingCameraRef = useRef<boolean>(false);
  const qrFileInputRef = useRef<HTMLInputElement | null>(null);
  const lastScannedTimeRef = useRef<number>(0);
  const buyerNameInputRef = useRef<HTMLInputElement | null>(null);
  const pendingSaleEntryMethodRef = useRef<'camera' | 'manual'>('manual');
  const [pendingSaleIsManual, setPendingSaleIsManual] = useState<boolean>(true);

  const stopCameraScanner = useCallback(async () => {
    scannerRunIdRef.current += 1;
    isStartingCameraRef.current = false;
    const handle = scannerHandleRef.current;
    scannerHandleRef.current = null;
    if (handle) {
      try {
        await handle.stop();
      } catch {
        // Ignorer les erreurs de nettoyage caméra si le nœud DOM est déjà démonté
      }
    }
    const viewfinderEl =
      typeof document !== 'undefined' ? document.getElementById('pos-camera-viewfinder') : null;
    if (viewfinderEl) {
      viewfinderEl.innerHTML = '';
    }
    setIsCameraScanning(false);
    setIsStartingCamera(false);
    setTorchSupported(false);
    setIsTorchOn(false);
  }, []);

  const handlePosLogout = useCallback(async () => {
    if (!onSignOut || isSigningOut) return;
    setIsSigningOut(true);
    try {
      await stopCameraScanner();
      await onSignOut();
    } finally {
      setIsSigningOut(false);
    }
  }, [onSignOut, isSigningOut, stopCameraScanner]);

  const toggleTorch = useCallback(async () => {
    const handle = scannerHandleRef.current;
    if (!handle || !handle.isTorchSupported()) return;
    const next = !isTorchOn;
    const ok = await handle.setTorch(next);
    if (ok) {
      setIsTorchOn(next);
    }
  }, [isTorchOn]);

  // Modale de demande de reversement
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState<number>(0);
  const [settlementSuccessMessage, setSettlementSuccessMessage] = useState<string | null>(null);

  // Modale de Clôture de Caisse (Shift Handover)
  const [showShiftCloseModal, setShowShiftCloseModal] = useState(false);
  const [countedCashInput, setCountedCashInput] = useState('');
  const [isSubmittingShiftClose, setIsSubmittingShiftClose] = useState(false);
  const [shiftCloseError, setShiftCloseError] = useState<string | null>(null);
  const [shiftCloseSuccess, setShiftCloseSuccess] = useState<{
    countedAmount: number;
    soldCount: number;
    timestamp: string;
    syncedToServer: boolean;
  } | null>(null);

  const activeAgent = useMemo(() => {
    return agents.find((a) => a.id === selectedAgentId) || agents[0] || null;
  }, [agents, selectedAgentId]);

  const activeEvent = useMemo(() => {
    if (!activeAgent) return null;
    return events.find((e) => e.id === activeAgent.eventId) || null;
  }, [events, activeAgent]);

  const pendingOfflineQrSet = useMemo(
    () => getPendingOfflineQrCodes(activeAgent?.id),
    [activeAgent?.id, tickets, pendingOfflineCount]
  );

  // Refs synchronisées pour éviter toute closure obsolète dans les callbacks caméra
  const activeAgentRef = useRef<SalesAgent | null>(activeAgent);
  const ticketsRef = useRef<UserTicket[]>(tickets);
  const selectedAgentIdRef = useRef<string>(selectedAgentId);
  useEffect(() => {
    activeAgentRef.current = activeAgent;
  }, [activeAgent]);
  useEffect(() => {
    ticketsRef.current = tickets;
  }, [tickets]);
  useEffect(() => {
    selectedAgentIdRef.current = selectedAgentId;
  }, [selectedAgentId]);

  // Billets strictement alloués et vendus pour ce point de vente
  const agentTickets = useMemo(() => {
    if (!activeAgent) return [];
    return tickets.filter((t) => t.agentId === activeAgent.id);
  }, [tickets, activeAgent]);

  const unsoldAgentTickets = useMemo(
    () => agentTickets.filter((t) => isTicketUnsoldStatus(t.status)),
    [agentTickets]
  );

  const soldAgentTickets = useMemo(
    () => agentTickets.filter((t) => isTicketSoldStatus(t.status)),
    [agentTickets]
  );

  const manualSoldCount = useMemo(
    () => soldAgentTickets.filter((t) => Boolean(t.isManualEntry)).length,
    [soldAgentTickets]
  );

  const allocatedCountDisplay = useMemo(() => {
    if (!activeAgent) return 0;
    return agentTickets.length > 0 ? agentTickets.length : activeAgent.allocatedCount;
  }, [activeAgent, agentTickets]);

  const soldCountDisplay = useMemo(() => {
    if (!activeAgent) return 0;
    return agentTickets.length > 0 ? soldAgentTickets.length : activeAgent.soldCount;
  }, [activeAgent, agentTickets.length, soldAgentTickets.length]);

  const remainingTickets = useMemo(() => {
    if (!activeAgent) return 0;
    if (agentTickets.length > 0) return unsoldAgentTickets.length;
    return Math.max(0, activeAgent.allocatedCount - activeAgent.soldCount);
  }, [activeAgent, agentTickets.length, unsoldAgentTickets.length]);

  const estimatedTotalCash = useMemo(() => {
    if (!activeAgent) return 0;
    if (soldAgentTickets.length > 0) {
      return soldAgentTickets.reduce((sum, t) => sum + (Number(t.price) || 0), 0);
    }
    return activeAgent.cashCollected;
  }, [activeAgent, soldAgentTickets]);

  const agentCommissionEarned = activeAgent
    ? Math.round((estimatedTotalCash * activeAgent.commissionPercent) / 100)
    : 0;

  const netDueToPromoter = useMemo(() => {
    if (!activeAgent) return 0;
    if (soldAgentTickets.length > 0) {
      return Math.max(0, estimatedTotalCash - agentCommissionEarned - (activeAgent.amountPaidToPromoter || 0));
    }
    return activeAgent.amountDue;
  }, [activeAgent, soldAgentTickets.length, estimatedTotalCash, agentCommissionEarned]);

  const filteredManualUnsoldTickets = useMemo(() => {
    const q = manualFilterQuery.trim().toUpperCase();
    if (!q) return unsoldAgentTickets;
    return unsoldAgentTickets.filter(
      (t) =>
        t.qrCode.toUpperCase().includes(q) ||
        t.tierName.toUpperCase().includes(q) ||
        (t.serialNumber ? `#${t.serialNumber}`.includes(q) : false)
    );
  }, [unsoldAgentTickets, manualFilterQuery]);

  const selectedManualTicket = useMemo(
    () => unsoldAgentTickets.find((t) => t.qrCode === selectedManualTicketCode) || null,
    [unsoldAgentTickets, selectedManualTicketCode]
  );

  const sortedFilteredInventoryTickets = useMemo(() => {
    const base =
      inventoryFilter === 'printed_not_sold'
        ? unsoldAgentTickets
        : inventoryFilter === 'sold'
          ? soldAgentTickets
          : agentTickets;

    const q = inventorySearch.trim().toLowerCase();
    const filtered = q
      ? base.filter(
          (t) =>
            (t.qrCode || '').toLowerCase().includes(q) ||
            (t.tierName || '').toLowerCase().includes(q) ||
            (t.holderName || '').toLowerCase().includes(q) ||
            (t.holderPhone || '').toLowerCase().includes(q)
        )
      : base;

    const getPriority = (status: UserTicket['status']): number => {
      if (isTicketUnsoldStatus(status)) return 0;
      if (status === 'sold_valid' || status === 'physical_sold') return 1;
      if (status === 'scanned' || status === 'used') return 2;
      return 3;
    };

    return [...filtered].sort((a, b) => {
      const pDiff = getPriority(a.status) - getPriority(b.status);
      if (pDiff !== 0) return pDiff;
      if (typeof a.serialNumber === 'number' && typeof b.serialNumber === 'number') {
        return a.serialNumber - b.serialNumber;
      }
      return a.qrCode.localeCompare(b.qrCode);
    });
  }, [agentTickets, unsoldAgentTickets, soldAgentTickets, inventoryFilter, inventorySearch]);

  useEffect(() => {
    setInventoryPage(1);
  }, [inventoryFilter, inventorySearch, selectedAgentId]);

  const inventoryTotalPages = Math.max(1, Math.ceil(sortedFilteredInventoryTickets.length / INVENTORY_PAGE_SIZE));
  const safeInventoryPage = Math.min(inventoryPage, inventoryTotalPages);
  const paginatedInventoryTickets = useMemo(() => {
    const start = (safeInventoryPage - 1) * INVENTORY_PAGE_SIZE;
    return sortedFilteredInventoryTickets.slice(start, start + INVENTORY_PAGE_SIZE);
  }, [sortedFilteredInventoryTickets, safeInventoryPage]);

  useEffect(() => {
    if (currentAgentId && currentAgentId !== selectedAgentId) {
      setSelectedAgentId(currentAgentId);
    }
  }, [currentAgentId, selectedAgentId]);

  useEffect(() => {
    if (saleMode === 'manual' && unsoldAgentTickets.length > 0) {
      const stillValid = unsoldAgentTickets.some((t) => t.qrCode === selectedManualTicketCode);
      if (!stillValid) {
        setSelectedManualTicketCode(unsoldAgentTickets[0].qrCode);
      }
    }
  }, [saleMode, unsoldAgentTickets, selectedManualTicketCode]);

  const refreshPendingOfflineState = useCallback((agentId?: string) => {
    setPendingOfflineCount(getPendingOfflinePosSales(agentId).length);
  }, []);

  const handleRefresh = useCallback(async (agentOverrideId?: string) => {
    setIsRefreshing(true);
    const preferredId = agentOverrideId || currentAgentId || selectedAgentIdRef.current || user?.assignedAgentId;
    const browserOnline = typeof navigator === 'undefined' ? true : navigator.onLine;

    // Mode hors-ligne ou déconnecté : restauration immédiate depuis le cache localStorage sans bloquer le POS
    if (!isConnected || !browserOnline) {
      const snap = loadPosAgentSnapshot(preferredId);
      if (snap.agents.length > 0) {
        setAgents(snap.agents);
        setTickets(snap.tickets);
        if (snap.activeAgent && snap.activeAgent.id !== selectedAgentIdRef.current) {
          setSelectedAgentId(snap.activeAgent.id);
        }
        refreshPendingOfflineState(snap.activeAgent?.id || preferredId);
      } else if (!isConnected) {
        setAgents(getStoredSalesAgents());
        setTickets(getStoredTickets());
      }
      setIsRefreshing(false);
      return;
    }

    clearLocalTicketReserveCache();

    const explicitAgentFilter = agentOverrideId || currentAgentId || user?.assignedAgentId;
    const agentsRes = await fetchSalesAgentsFromSupabase(
      explicitAgentFilter
        ? { agentId: explicitAgentFilter }
        : user?.role === 'sales_agent' && user?.id
          ? { userId: user.id }
          : undefined
    );

    const offlineSnap = loadPosAgentSnapshot(preferredId);
    const loadedAgents = !agentsRes.error
      ? agentsRes.agents
      : offlineSnap.agents.length > 0
        ? offlineSnap.agents
        : getStoredSalesAgents();

    if (!agentsRes.error) {
      setAgents(agentsRes.agents);
      saveSalesAgents(agentsRes.agents);
    } else if (offlineSnap.agents.length > 0) {
      setAgents(offlineSnap.agents);
    } else {
      setAgents(getStoredSalesAgents());
    }

    const normalizedUserPhone = (user?.phone || '').replace(/[^0-9]/g, '');
    const targetAgent =
      loadedAgents.find((a) => preferredId && a.id === preferredId) ||
      loadedAgents.find((a) => user?.assignedAgentId && a.id === user.assignedAgentId) ||
      loadedAgents.find((a) => user?.id && a.userId === user.id) ||
      loadedAgents.find(
        (a) =>
          (normalizedUserPhone &&
            a.telephone.replace(/[^0-9]/g, '') === normalizedUserPhone) ||
          (user?.email && a.email && a.email.toLowerCase() === user.email.toLowerCase())
      ) ||
      loadedAgents[0];

    if (targetAgent && targetAgent.id !== selectedAgentIdRef.current) {
      setSelectedAgentId(targetAgent.id);
    }

    const ticketsRes = await fetchAllSoldTicketsFromSupabase(
      targetAgent
        ? {
            agentId: targetAgent.id,
            eventId: targetAgent.eventId,
          }
        : undefined
    );

    if (!ticketsRes.error) {
      const strictAgentTickets = targetAgent
        ? ticketsRes.tickets.filter((t) => t.agentId === targetAgent.id)
        : ticketsRes.tickets;

      if (targetAgent) {
        // Mettre en cache localStorage les QR codes valides + superposer les ventes hors-ligne en attente
        savePosAgentSnapshot(targetAgent, strictAgentTickets);
        const syncedView = loadPosAgentSnapshot(targetAgent.id);
        setTickets(syncedView.tickets.length > 0 ? syncedView.tickets : strictAgentTickets);
        saveStoredTickets(syncedView.tickets.length > 0 ? syncedView.tickets : strictAgentTickets);
        refreshPendingOfflineState(targetAgent.id);
      } else {
        setTickets(strictAgentTickets);
        saveStoredTickets(strictAgentTickets);
      }
    } else {
      const snapFallback = loadPosAgentSnapshot(targetAgent?.id || preferredId);
      const storedFallback = snapFallback.tickets.length > 0 ? snapFallback.tickets : getStoredTickets();
      const strictFallback = targetAgent
        ? storedFallback.filter((t) => t.agentId === targetAgent.id)
        : storedFallback;
      setTickets(strictFallback);
      refreshPendingOfflineState(targetAgent?.id || preferredId);
    }

    setIsRefreshing(false);
  }, [isConnected, currentAgentId, user?.assignedAgentId, user?.id, user?.role, user?.phone, user?.email, refreshPendingOfflineState]);

  const runOfflineQueueSync = useCallback(async (agentIdOverride?: string) => {
    const targetAgentId = agentIdOverride || activeAgentRef.current?.id || currentAgentId || user?.assignedAgentId;
    const queue = getPendingOfflinePosSales(targetAgentId);
    if (queue.length === 0) {
      refreshPendingOfflineState(targetAgentId);
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    setIsSyncingOffline(true);
    const result = await syncPendingOfflinePosSales(targetAgentId);
    setIsSyncingOffline(false);
    refreshPendingOfflineState(targetAgentId);

    if (result.syncedCount > 0) {
      setOfflineSyncBanner(
        `${result.syncedCount} vente(s) hors-ligne synchronisée(s) avec Supabase.`
      );
      void handleRefresh(targetAgentId);
      setTimeout(() => {
        setOfflineSyncBanner(null);
      }, 4500);
    }
  }, [currentAgentId, user?.assignedAgentId, handleRefresh, refreshPendingOfflineState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onNetworkOnline = () => {
      setIsOnline(true);
      void runOfflineQueueSync(activeAgentRef.current?.id);
    };

    const onNetworkOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', onNetworkOnline);
    window.addEventListener('offline', onNetworkOffline);

    if (navigator.onLine) {
      void runOfflineQueueSync(currentAgentId || user?.assignedAgentId);
    }

    return () => {
      window.removeEventListener('online', onNetworkOnline);
      window.removeEventListener('offline', onNetworkOffline);
    };
  }, [runOfflineQueueSync, currentAgentId, user?.assignedAgentId]);

  useEffect(() => {
    void handleRefresh(currentAgentId);
  }, [handleRefresh, currentAgentId]);

  // Méthode A : Scan préalable et vérification du billet
  const handleCheckTicketForSale = useCallback((code: string, fromCamera = false): boolean => {
    setSaleErrorMessage(null);
    setSaleSuccessMessage(null);
    const currentAgent = activeAgentRef.current;
    const cleanCode = extractScannedTicketCode(code);
    if (!currentAgent || !cleanCode) {
      setPendingTicketForConfirm(null);
      return false;
    }

    const check = lookupPhysicalTicketForSale(currentAgent.id, cleanCode, ticketsRef.current);
    if (!check.found || !check.ticket) {
      setSaleErrorMessage(check.message || 'Billet introuvable dans votre stock.');
      setPendingTicketForConfirm(null);
      if (fromCamera) playPosFeedbackTone('error');
      return false;
    }

    if (!check.canBeSold) {
      setSaleErrorMessage(check.message || 'Ce billet ne peut pas être vendu.');
      setPendingTicketForConfirm(null);
      if (fromCamera) playPosFeedbackTone('error');
      return false;
    }

    const isManual = !fromCamera;
    pendingSaleEntryMethodRef.current = isManual ? 'manual' : 'camera';
    setPendingSaleIsManual(isManual);

    setPendingTicketForConfirm(check.ticket);
    if (fromCamera) {
      playPosFeedbackTone('success');
    }
    const browserOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
    if (isConnected && browserOnline) {
      void verifyPosTicketForSale(currentAgent.id, cleanCode).then((srv) => {
        if (srv.verifiedByServer && !srv.canBeSold) {
          setPendingTicketForConfirm(null);
          setSaleErrorMessage(srv.message);
          playPosFeedbackTone('error');
        }
      });
    }
    setTimeout(() => {
      buyerNameInputRef.current?.focus();
    }, 150);
    return true;
  }, [isConnected]);

  const startCameraScanner = useCallback(async () => {
    if (isStartingCameraRef.current) return;
    isStartingCameraRef.current = true;

    const elementId = 'pos-camera-viewfinder';
    const el = typeof document !== 'undefined' ? document.getElementById(elementId) : null;
    if (!el) {
      isStartingCameraRef.current = false;
      setCameraError('Conteneur du viseur caméra introuvable. Fermez puis rouvrez la modale.');
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      isStartingCameraRef.current = false;
      setCameraError(formatFriendlyCameraError('Camera streaming not supported'));
      setIsCameraScanning(false);
      setIsStartingCamera(false);
      return;
    }

    setCameraError(null);
    setIsStartingCamera(true);
    setIsTorchOn(false);
    setTorchSupported(false);

    const prevHandle = scannerHandleRef.current;
    scannerHandleRef.current = null;
    if (prevHandle) {
      try {
        await prevHandle.stop();
      } catch {
        // Ignorer les erreurs d'arrêt précédent
      }
    }
    el.innerHTML = '';

    scannerRunIdRef.current += 1;
    const runId = scannerRunIdRef.current;

    try {
      const handle = await startOptimizedScanner({
        elementId,
        formats: ['QR_CODE', 'CODE_128', 'CODE_39', 'EAN_13', 'EAN_8', 'DATA_MATRIX'],
        fps: 18,
        fpsDecimation: 3,
        debounceMs: 2500,
        qrboxRatio: { widthRatio: 0.82, heightRatio: 0.72, minWidth: 160, minHeight: 150 },
        onReady: (metrics) => {
          if (runId !== scannerRunIdRef.current) return;
          setScannerMetrics(metrics);
          setTorchSupported(metrics.torchSupported);
        },
        onDecode: (decodedText) => {
          if (runId !== scannerRunIdRef.current) return;
          const now = Date.now();
          if (now - lastScannedTimeRef.current < 2500) return;
          lastScannedTimeRef.current = now;

          const clean = extractScannedTicketCode(decodedText);
          setManualTicketCode(clean);
          void stopCameraScanner();
          handleCheckTicketForSale(clean, true);
        },
      });

      if (runId === scannerRunIdRef.current) {
        scannerHandleRef.current = handle;
        setTorchSupported(handle.isTorchSupported());
        setIsCameraScanning(true);
        setIsStartingCamera(false);
      } else {
        await handle.stop();
      }
    } catch (err: unknown) {
      console.warn('Erreur activation camera POS:', err);
      if (runId === scannerRunIdRef.current) {
        setCameraError(formatFriendlyCameraError(err));
        setIsCameraScanning(false);
        setIsStartingCamera(false);
      }
    } finally {
      isStartingCameraRef.current = false;
    }
  }, [handleCheckTicketForSale, stopCameraScanner]);

  const handleUploadQrImage = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;

      setSaleErrorMessage(null);
      setCameraError(null);
      setIsScanningImageFile(true);

      try {
        await stopCameraScanner();
        const decodedText = await scanTicketImageFile(file);
        const clean = extractScannedTicketCode(decodedText);
        if (!clean) {
          throw new Error("Aucun code billet exploitable détecté dans cette image.");
        }
        setManualTicketCode(clean);
        const matched = handleCheckTicketForSale(clean, true);
        if (!matched) {
          playPosFeedbackTone('error');
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Aucun QR Code lisible détecté dans cette image. Essayez une capture plus nette ou saisissez le code manuellement.";
        setCameraError(message);
        setSaleErrorMessage(message);
        playPosFeedbackTone('error');
      } finally {
        setIsScanningImageFile(false);
      }
    },
    [handleCheckTicketForSale, stopCameraScanner]
  );

  // Préchargement silencieux du moteur caméra à l'ouverture (aucun auto-start pour respecter iOS)
  useEffect(() => {
    if (showSaleModal && saleMode === 'scan' && !pendingTicketForConfirm) {
      preloadScannerEngine();
    }
  }, [showSaleModal, saleMode, pendingTicketForConfirm]);

  // Nettoyage strict du flux vidéo lors de la fermeture, du changement d'onglet ou de confirmation
  useEffect(() => {
    if (!showSaleModal || saleMode !== 'scan' || Boolean(pendingTicketForConfirm)) {
      void stopCameraScanner();
    }
  }, [showSaleModal, saleMode, pendingTicketForConfirm, stopCameraScanner]);

  // Nettoyage strict si le composant POS est démonté lors d'un changement de page
  useEffect(() => {
    return () => {
      const handle = scannerHandleRef.current;
      scannerHandleRef.current = null;
      if (handle) {
        void handle.stop();
      }
    };
  }, []);

  // Helper partagé pour activer un billet physique nominatif (Scan Caméra ou Déclaration Manuelle)
  const submitSingleNominalSale = async (
    targetTicket: UserTicket,
    explicitIsManual?: boolean
  ) => {
    if (!activeAgent) return;
    if (!buyerName.trim() || !buyerPhone.trim()) {
      setSaleErrorMessage('Le nom et le téléphone du client sont obligatoires pour activer le billet.');
      return;
    }

    const isManualEntry =
      typeof explicitIsManual === 'boolean'
        ? explicitIsManual
        : saleMode === 'manual' || pendingSaleEntryMethodRef.current === 'manual';

    setIsSubmittingSale(true);
    setSaleErrorMessage(null);
    setSaleSuccessMessage(null);
    setSaleSuccessIsOffline(false);

    const prevAgents = [...agents];
    const prevTickets = [...tickets];
    const soldPrice = targetTicket.price || 3500;
    const trimmedName = buyerName.trim();
    const trimmedPhone = buyerPhone.trim();
    const soldNowIso = new Date().toISOString();

    const applyOptimisticSale = () => {
      setAgents((prev) =>
        prev.map((a) =>
          a.id === activeAgent.id
            ? {
                ...a,
                soldCount: a.soldCount + 1,
                cashCollected: a.cashCollected + soldPrice,
                amountDue: a.amountDue + Math.round(soldPrice * (1 - a.commissionPercent / 100)),
              }
            : a
        )
      );

      setTickets((prev) =>
        prev.map((t) =>
          t.qrCode === targetTicket.qrCode || t.id === targetTicket.id
            ? {
                ...t,
                status: 'sold_valid',
                holderName: trimmedName,
                holderPhone: trimmedPhone,
                isManualEntry,
                soldAt: soldNowIso,
              }
            : t
        )
      );
    };

    const completeOfflineSale = (): boolean => {
      const offlineRes = recordOfflinePosSale({
        agent: activeAgent,
        ticket: targetTicket,
        holderName: trimmedName,
        holderPhone: trimmedPhone,
        isManualEntry,
      });
      setIsSubmittingSale(false);

      if (!offlineRes.success) {
        setAgents(prevAgents);
        setTickets(prevTickets);
        setSaleErrorMessage(offlineRes.message);
        playPosFeedbackTone('error');
        return false;
      }

      setPendingOfflineCount(offlineRes.queuedCount);
      setSaleSuccessIsOffline(true);
      playPosFeedbackTone('success');
      showToast('Vente validée', 'success');
      setSaleSuccessMessage(offlineRes.message);
      setPendingTicketForConfirm(null);
      setBuyerName('');
      setBuyerPhone('');
      setManualTicketCode('');
      setSelectedManualTicketCode('');
      setManualFilterQuery('');

      setTimeout(() => {
        setShowSaleModal(false);
        setSaleSuccessMessage(null);
        setSaleSuccessIsOffline(false);
      }, 2800);
      return true;
    };

    applyOptimisticSale();

    // 1. Mode Hors-Ligne explicite (navigator.onLine === false) : validation locale immédiate sans blocage
    const browserOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
    if (!browserOnline || !isConnected) {
      completeOfflineSale();
      return;
    }

    // 2. En ligne : validation Supabase avec repli automatique hors-ligne en cas de coupure réseau
    const res = await confirmSinglePhysicalTicketSale(
      activeAgent.id,
      targetTicket.qrCode,
      {
        name: trimmedName,
        phone: trimmedPhone,
        isManualEntry,
      },
      prevTickets
    );

    if (!res.success) {
      const lowerMsg = (res.message || '').toLowerCase();
      const isNetworkFailure =
        (typeof navigator !== 'undefined' && navigator.onLine === false) ||
        lowerMsg.includes('failed to fetch') ||
        lowerMsg.includes('network') ||
        lowerMsg.includes('réseau') ||
        lowerMsg.includes('load failed') ||
        lowerMsg.includes('timeout');

      if (isNetworkFailure) {
        setIsOnline(false);
        completeOfflineSale();
        return;
      }

      setIsSubmittingSale(false);
      setAgents(prevAgents);
      setTickets(prevTickets);
      setSaleErrorMessage(res.message);
      playPosFeedbackTone('error');
      return;
    }

    setIsSubmittingSale(false);
    setSaleSuccessIsOffline(false);
    playPosFeedbackTone('success');
    showToast('Vente validée', 'success');
    setSaleSuccessMessage(res.message);
    setPendingTicketForConfirm(null);
    setBuyerName('');
    setBuyerPhone('');
    setManualTicketCode('');
    setSelectedManualTicketCode('');
    setManualFilterQuery('');
    void handleRefresh(activeAgent.id);

    setTimeout(() => {
      setShowSaleModal(false);
      setSaleSuccessMessage(null);
    }, 2000);
  };

  // Confirmation explicite depuis l'onglet Scan Billet Unique (ou saisie clavier)
  const handleConfirmSingleSale = async () => {
    if (!pendingTicketForConfirm) return;
    await submitSingleNominalSale(
      pendingTicketForConfirm,
      pendingSaleEntryMethodRef.current === 'manual'
    );
  };

  // Confirmation explicite depuis l'onglet Déclaration Manuelle (billet sélectionné en stock)
  const handleConfirmManualSingleSale = async () => {
    if (!selectedManualTicket) {
      setSaleErrorMessage('Veuillez sélectionner un billet disponible dans votre stock.');
      return;
    }
    await submitSingleNominalSale(selectedManualTicket, true);
  };

  // Relevé / Clôture de Caisse à l'aveugle (Shift Handover)
  const handleSubmitShiftClose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAgent || isSubmittingShiftClose) return;

    const cleanDigits = countedCashInput.replace(/[^0-9]/g, '');
    if (!cleanDigits) {
      setShiftCloseError('Veuillez saisir le montant total en espèces que vous avez en main.');
      return;
    }

    const countedAmount = Number(cleanDigits);
    const expectedAmount = Math.round(estimatedTotalCash);
    setIsSubmittingShiftClose(true);
    setShiftCloseError(null);

    try {
      const res = await submitPosShiftHandover({
        agent: activeAgent,
        soldCount: soldCountDisplay,
        manualSalesCount: manualSoldCount,
        expectedAmount,
        countedAmount,
        submittedBy: user?.id,
      });

      if (!res.matched) {
        playPosFeedbackTone('error');
        setShiftCloseSuccess(null);
        setShiftCloseError(
          'Le montant saisi ne correspond pas aux ventes déclarées. Veuillez contacter le superviseur.'
        );
        return;
      }

      playPosFeedbackTone('success');
      showToast('Clôture enregistrée', 'success');
      setShiftCloseError(null);
      setShiftCloseSuccess({
        countedAmount: res.record.countedAmount,
        soldCount: res.record.soldCount,
        timestamp: res.record.createdAt,
        syncedToServer: res.syncedToServer,
      });
    } finally {
      setIsSubmittingShiftClose(false);
    }
  };

  const handleDeclareSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAgent || settlementAmount <= 0 || isSubmittingSettlement) return;

    setIsSubmittingSettlement(true);
    try {
      const res = await recordAgentSettlement(activeAgent.id, settlementAmount);
      if (res.success) {
        setSettlementSuccessMessage(res.message);
        showToast('Reversement enregistré', 'success');
        handleRefresh();
        setTimeout(() => {
          setShowSettlementModal(false);
          setSettlementSuccessMessage(null);
        }, 1800);
      } else {
        showToast(res.message || 'Erreur lors du reversement.', 'error');
      }
    } finally {
      setIsSubmittingSettlement(false);
    }
  };

  // WhatsApp notification link to promoter for settlement
  const generateSettlementWhatsAppUrl = () => {
    if (!activeAgent) return '#';
    const cleanPromoterPhone = promoterPhone.replace(/[^0-9]/g, '');
    const message =
      `*THIÈSDN BILLETTERIE - DEMANDE DE REVERSEMENT RÉSEAU* 🇸🇳\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Point de Vente : *${activeAgent.pointDeVente}*\n` +
      `Gérant / Responsable : *${activeAgent.gerantName}*\n` +
      `Téléphone : *${activeAgent.telephone}*\n` +
      `Événement : *${activeAgent.eventTitle}*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 *Point de Vente Actuel :*\n` +
      `• Billets reçus : ${activeAgent.allocatedCount}\n` +
      `• Billets vendus : ${activeAgent.soldCount}\n` +
      `• Billets restants en caisse : ${remainingTickets}\n` +
      `💰 *Montant collecté :* ${activeAgent.cashCollected.toLocaleString('fr-FR')} FCFA\n` +
      `💵 *Montant disponible à reverser :* *${activeAgent.amountDue.toLocaleString('fr-FR')} FCFA*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Bonjour cher promoteur, les fonds sont disponibles. Pouvez-vous passer récupérer les espèces ou m'envoyer votre lien Wave ? Merci !`;

    const targetPhone = cleanPromoterPhone.length >= 9 ? cleanPromoterPhone : '';
    return targetPhone
      ? `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
  };

  if (!activeAgent) {
    if (isRefreshing) {
      return (
        <div className="max-w-2xl mx-auto p-8 text-center space-y-4 glass-panel rounded-3xl animate-in fade-in">
          <RefreshCw className="w-10 h-10 text-[#E9C349] mx-auto animate-spin" />
          <h2 className="font-heading text-lg font-bold text-white">
            Chargement de votre caisse POS...
          </h2>
          <p className="text-xs text-[#E5E2E1]">
            Synchronisation de vos stocks physiques et ventes depuis Supabase.
          </p>
        </div>
      );
    }

    return (
      <div className="max-w-2xl mx-auto p-8 text-center space-y-5 glass-panel rounded-3xl animate-in fade-in relative">
        {(onNavigateBack || onSignOut) && (
          <button
            type="button"
            onClick={() => {
              if (onNavigateBack) onNavigateBack();
              else void handlePosLogout();
            }}
            disabled={isSigningOut}
            aria-label="Quitter le mode guichet"
            title="Quitter le mode guichet"
            className="absolute top-4 left-4 w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-gray-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
          >
            {onNavigateBack ? <ArrowLeft className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
          </button>
        )}
        <Store className="w-12 h-12 text-[#E9C349] mx-auto" />
        <h2 className="font-heading text-lg font-bold text-white">
          Aucun point de vente affilié trouvé
        </h2>
        <p className="text-xs text-[#E5E2E1]">
          Votre compte n'est pas encore associé à un réseau de vente physique. Contactez votre promoteur Thièsdn pour recevoir votre lot de billets.
        </p>
        {onSignOut && (
          <div className="pt-2 flex justify-center">
            <button
              type="button"
              onClick={() => {
                void handlePosLogout();
              }}
              disabled={isSigningOut}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-950/50 hover:bg-rose-950/80 border border-rose-500/40 text-rose-200 hover:text-white text-xs font-heading font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span>{isSigningOut ? 'Déconnexion...' : 'Se déconnecter'}</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-[calc(80px+env(safe-area-inset-bottom))] animate-in fade-in duration-300">
      {/* Header Collaborateur Mobile-First */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-5 sm:p-6 rounded-3xl border border-[#E9C349]/30 relative overflow-hidden bg-gradient-to-br from-[#1C1A14] to-[#121212]">
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#E9C349]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-1.5 relative z-10">
          <div className="flex flex-wrap items-center gap-2">
            {onNavigateBack ? (
              <button
                type="button"
                onClick={onNavigateBack}
                className="w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-gray-300 hover:text-white transition-all mr-1 cursor-pointer"
                title="Quitter le mode guichet"
                aria-label="Quitter le mode guichet"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : onSignOut ? (
              <button
                type="button"
                onClick={() => {
                  void handlePosLogout();
                }}
                disabled={isSigningOut}
                className="w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-gray-300 hover:text-white transition-all mr-1 cursor-pointer disabled:opacity-50"
                title="Quitter le mode guichet"
                aria-label="Quitter le mode guichet"
              >
                {isSigningOut ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
              </button>
            ) : null}
            <span className="p-1.5 rounded-lg bg-[#E9C349]/20 text-[#E9C349] border border-[#E9C349]/30">
              <Store className="w-4 h-4" />
            </span>
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-[#E9C349] bg-[#E9C349]/10 px-2 py-0.5 rounded-full border border-[#E9C349]/20">
              Guichet Partenaire Agréé
            </span>

            {/* Indicateur de statut réseau POS (🟢 En ligne / 🔴 Hors-ligne) */}
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                isOnline
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35'
                  : 'bg-rose-500/20 text-rose-200 border-rose-500/45 animate-pulse'
              }`}
              title={
                isOnline
                  ? `Connecté à Supabase • ${unsoldAgentTickets.length} billets en cache local`
                  : 'Réseau indisponible : les scans restent enregistrés en cache local'
              }
            >
              {isOnline ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <Wifi className="w-3 h-3 text-emerald-300" />
                  <span>En ligne</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-rose-400" />
                  <WifiOff className="w-3 h-3 text-rose-300" />
                  <span>Hors-ligne</span>
                </>
              )}
            </span>

            {pendingOfflineCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (isOnline && !isSyncingOffline) {
                    void runOfflineQueueSync(activeAgent.id);
                  }
                }}
                className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/40"
                title="Ventes réalisées hors-ligne en attente de synchronisation Supabase"
              >
                <CloudUpload className={`w-3 h-3 ${isSyncingOffline ? 'animate-bounce' : ''}`} />
                <span>
                  {isSyncingOffline
                    ? 'Synchro en cours...'
                    : `${pendingOfflineCount} en attente de synchro`}
                </span>
              </button>
            )}
          </div>

          <h1 className="font-heading text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            {activeAgent.pointDeVente}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300">
            <span className="flex items-center gap-1 text-[#DCB8FF]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              {activeAgent.gerantName}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 font-mono text-gray-300">
              <Phone className="w-3.5 h-3.5 text-[#1DC3F4]" />
              {activeAgent.telephone}
            </span>
            <span>•</span>
            <span className="text-[#E9C349] font-bold">
              {activeAgent.quartier || 'Thiès'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 relative z-10 self-start sm:self-auto">
          {agents.length > 1 && (
            <select
              value={selectedAgentId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSelectedAgentId(nextId);
                void handleRefresh(nextId);
              }}
              className="bg-[#1C1B1B] border border-white/10 text-white text-xs rounded-xl px-3 py-2 outline-none font-bold"
            >
              {agents.map((ag) => (
                <option key={ag.id} value={ag.id}>
                  {ag.pointDeVente}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => {
              void (async () => {
                setPosPushFeedback(null);
                const res = await subscribePosPush();
                setPosPushFeedback({ ok: res.success, text: res.message });
              })();
            }}
            disabled={isPushLoading}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-heading font-bold uppercase tracking-wider border transition-all cursor-pointer disabled:opacity-50 ${
              isPushSubscribed
                ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/75'
                : 'bg-[#8A2BE2]/20 hover:bg-[#8A2BE2]/35 border-[#8A2BE2]/50 text-[#DCB8FF]'
            }`}
            title={
              isPosIosNeedsInstall
                ? "Installez la PWA sur l'écran d'accueil iOS pour activer les alertes"
                : !isPushSupported
                  ? 'Notifications Push non supportées sur ce navigateur'
                  : isPushSubscribed
                    ? 'Alertes Push actives sur ce guichet'
                    : 'Activer les notifications push sur ce guichet'
            }
            aria-label="Activer les notifications push"
          >
            {isPushSubscribed ? (
              <BellRing className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Bell className={`w-4 h-4 text-[#E9C349] shrink-0 ${isPushLoading ? 'animate-pulse' : ''}`} />
            )}
            <span>
              {isPushLoading
                ? 'Activation...'
                : isPushSubscribed
                  ? 'Alertes actives'
                  : 'Activer les alertes'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              void handleRefresh();
            }}
            disabled={isRefreshing}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 transition-colors disabled:opacity-60 cursor-pointer"
            title="Actualiser les stocks et ventes"
          >
            <RefreshCw className={`w-4 h-4 text-[#8A2BE2] ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>

          {onSignOut && (
            <button
              type="button"
              onClick={() => {
                void handlePosLogout();
              }}
              disabled={isSigningOut}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-950/45 hover:bg-rose-950/80 border border-rose-500/40 text-rose-200 hover:text-white text-xs font-heading font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
              title="Se déconnecter du guichet POS"
            >
              <LogOut className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{isSigningOut ? 'Déconnexion...' : 'Se déconnecter'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback activation notifications Push sur ce guichet POS */}
      {(posPushFeedback || pushError || pushStatusMessage) && (
        <div
          className={`p-3 rounded-2xl border text-xs font-medium flex items-center justify-between gap-2 animate-in fade-in ${
            posPushFeedback?.ok === false || (pushError && !posPushFeedback?.ok)
              ? 'bg-rose-950/60 border-rose-500/40 text-rose-200'
              : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
          }`}
        >
          <span>{posPushFeedback?.text || pushError || pushStatusMessage}</span>
          <button
            type="button"
            onClick={() => setPosPushFeedback(null)}
            className="text-white/70 hover:text-white text-[11px] font-bold px-2 py-0.5 rounded-lg bg-white/5 cursor-pointer"
          >
            OK
          </button>
        </div>
      )}

      {/* Bandeau confirmation synchronisation automatique après reconnexion */}
      {offlineSyncBanner && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{offlineSyncBanner}</span>
        </div>
      )}

      {/* Carte de l'Événement Assigné */}
      <div className="glass-panel p-5 rounded-3xl border border-white/10 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300 block">
              Événement en cours de vente
            </span>
            <h3 className="font-heading font-extrabold text-base sm:text-lg text-white">
              {activeAgent.eventTitle}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#E9C349] bg-[#E9C349]/15 px-3 py-1 rounded-full border border-[#E9C349]/30 flex items-center gap-1">
              <Percent className="w-3.5 h-3.5" />
              <span>Votre Commission : {activeAgent.commissionPercent}%</span>
            </span>
          </div>
        </div>

        {activeEvent && (
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-300">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#E9C349]" />
              <span>{activeEvent.date} à {activeEvent.time}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#8A2BE2]" />
              <span>{activeEvent.venue}, {activeEvent.city}</span>
            </div>
          </div>
        )}
      </div>

      {/* 4 KPIs Clés du Collaborateur */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Billets Reçus */}
        <div className="glass-panel p-4 rounded-2xl border border-white/10 space-y-1">
          <p className="text-[10px] uppercase font-bold text-gray-300 tracking-wider">Billets Reçus</p>
          <h4 className="font-heading text-xl sm:text-2xl font-black text-white">
            {allocatedCountDisplay} <span className="text-xs text-gray-300 font-bold">billets</span>
          </h4>
          <p className="text-[10px] text-gray-300">Dépôt total confié</p>
        </div>

        {/* 2. Billets Vendus */}
        <div className="glass-panel p-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 space-y-1">
          <p className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Billets Vendus</p>
          <h4 className="font-heading text-xl sm:text-2xl font-black text-emerald-300">
            {soldCountDisplay} <span className="text-xs text-white font-bold">écoulés</span>
          </h4>
          <p className="text-[10px] text-emerald-400/80">
            {allocatedCountDisplay > 0
              ? `${Math.round((soldCountDisplay / allocatedCountDisplay) * 100)}% du lot vendu`
              : 'En cours'}
          </p>
        </div>

        {/* 3. Billets Restants en Caisse */}
        <div className="glass-panel p-4 rounded-2xl border border-[#8A2BE2]/30 bg-[#1F1728]/30 space-y-1">
          <p className="text-[10px] uppercase font-bold text-[#DCB8FF] tracking-wider">Stock Restant</p>
          <h4 className="font-heading text-xl sm:text-2xl font-black text-[#DCB8FF]">
            {remainingTickets} <span className="text-xs text-white font-bold">en caisse</span>
          </h4>
          <p className="text-[10px] text-gray-300">Prêts à être vendus</p>
        </div>

        {/* 4. Montant à Reverser au Promoteur */}
        <div className="glass-panel p-4 rounded-2xl border border-[#E9C349]/40 bg-[#241A00]/40 space-y-1">
          <p className="text-[10px] uppercase font-bold text-[#E9C349] tracking-wider">À Reverser</p>
          <h4 className="font-heading text-xl sm:text-2xl font-black text-[#E9C349]">
            {netDueToPromoter.toLocaleString('fr-FR')} <span className="text-xs text-white font-bold">F</span>
          </h4>
          <p className="text-[10px] text-gray-300">
            Gain vendeur : +{agentCommissionEarned.toLocaleString('fr-FR')} F
          </p>
        </div>
      </div>

      {/* Barre d'Actions Rapides : Scan, Déclaration Manuelle, Reversement & Clôture de Caisse */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
        <button
          type="button"
          onClick={() => {
            setSaleErrorMessage(null);
            setSaleSuccessMessage(null);
            setCameraError(null);
            setSaleMode('scan');
            pendingSaleEntryMethodRef.current = 'manual';
            setPendingSaleIsManual(true);
            setPendingTicketForConfirm(null);
            setManualTicketCode('');
            setBuyerName('');
            setBuyerPhone('');
            setShowSaleModal(true);
          }}
          disabled={remainingTickets <= 0}
          className="btn-gold-glow py-4 px-4 rounded-2xl font-heading font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg active:scale-98 disabled:opacity-50"
        >
          <Scan className="w-4 h-4 text-[#241A00]" />
          <span>Scanner un Billet (Vente)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSaleErrorMessage(null);
            setSaleSuccessMessage(null);
            setCameraError(null);
            setSaleMode('manual');
            pendingSaleEntryMethodRef.current = 'manual';
            setPendingSaleIsManual(true);
            setPendingTicketForConfirm(null);
            setManualTicketCode('');
            setBuyerName('');
            setBuyerPhone('');
            setManualFilterQuery('');
            setShowSaleModal(true);
          }}
          disabled={remainingTickets <= 0}
          className="py-4 px-4 rounded-2xl bg-transparent hover:bg-white/5 border border-white/20 text-white font-heading font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
        >
          <Ticket className="w-4 h-4" />
          <span>Déclaration Manuelle</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSettlementAmount(netDueToPromoter);
            setShowSettlementModal(true);
          }}
          className="py-4 px-4 rounded-2xl bg-transparent hover:bg-white/5 border border-white/20 text-white font-heading font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
        >
          <DollarSign className="w-4 h-4" />
          <span>Déclarer Reversement</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setCountedCashInput('');
            setShiftCloseError(null);
            setShiftCloseSuccess(null);
            setShowShiftCloseModal(true);
          }}
          className="py-4 px-4 rounded-2xl bg-[#1C1B1B] hover:bg-rose-950/35 border border-rose-500/45 text-rose-200 hover:text-white font-heading font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 cursor-pointer"
        >
          <Lock className="w-4 h-4 text-rose-400" />
          <span>Clôturer ma caisse</span>
        </button>
      </div>

      {/* MODALE 1 : ACTIVATION PAR VENTE (SCAN UNITAIRE OU DÉCLARATION MANUELLE) */}
      {showSaleModal && (
        <div
          style={{
            paddingBottom:
              saleModalViewport.keyboardOffset > 0
                ? `${saleModalViewport.keyboardOffset + 8}px`
                : undefined,
          }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in"
        >
          <div
            style={{
              maxHeight: `${Math.max(320, saleModalViewport.height - 16)}px`,
            }}
            className="bg-[#1C1B1B] border border-[#E9C349]/40 w-full max-w-md rounded-3xl shadow-2xl relative flex flex-col overflow-hidden"
          >
            {/* Header Modale (Fixe en haut) */}
            <div className="shrink-0 flex items-center justify-between border-b border-white/10 px-5 sm:px-6 pt-5 pb-3 bg-[#1C1B1B]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#E9C349]" />
                <div>
                  <h3 className="font-heading font-extrabold text-base text-white">
                    Activation par Vente
                  </h3>
                  <span className="text-[10px] text-gray-300">
                    Passe le statut du billet de printed_not_sold à sold_valid
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  void stopCameraScanner();
                  setShowSaleModal(false);
                  setPendingTicketForConfirm(null);
                  setManualTicketCode('');
                  setBuyerName('');
                  setBuyerPhone('');
                }}
                className="text-gray-300 hover:text-white text-xs font-bold p-1.5 rounded-lg bg-white/5 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Corps scrollable de la Modale */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 py-4 space-y-5">

            {/* Sélecteur des 2 Méthodes demandées */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/40 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setSaleMode('scan');
                  setCameraError(null);
                  setSaleErrorMessage(null);
                  setSaleSuccessMessage(null);
                }}
                className={`py-2 rounded-lg text-xs font-heading font-bold uppercase transition-all flex items-center justify-center gap-1.5 ${
                  saleMode === 'scan'
                    ? 'bg-[#E9C349] text-[#241A00] shadow'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <Scan className="w-3.5 h-3.5" />
                <span>Scan Billet Unique</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  void stopCameraScanner();
                  setSaleMode('manual');
                  setSaleErrorMessage(null);
                  setSaleSuccessMessage(null);
                }}
                className={`py-2 rounded-lg text-xs font-heading font-bold uppercase transition-all flex items-center justify-center gap-1.5 ${
                  saleMode === 'manual'
                    ? 'bg-[#8A2BE2] text-white shadow'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                <Ticket className="w-3.5 h-3.5" />
                <span>Déclaration Manuelle</span>
              </button>
            </div>

            {/* MÉTHODE A : SCAN CAMÉRA + SAISIE MANUELLE + CONFIRMATION NOMINATIVE */}
            {saleMode === 'scan' && (
              <div className="space-y-4">
                {/* Viseur Caméra Arrière Temps Réel (démarré uniquement sur clic Scanner) */}
                {!pendingTicketForConfirm && (
                  <div className="rounded-2xl border border-[#E9C349]/30 bg-black/70 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/[0.03] gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#E9C349] min-w-0">
                        <Camera className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          {isStartingCamera
                            ? 'Activation caméra...'
                            : isCameraScanning
                              ? 'Caméra active — Visez le QR ou Code-Barres'
                              : 'Scanner Caméra en veille'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isCameraScanning && torchSupported && (
                          <button
                            type="button"
                            onClick={() => {
                              void toggleTorch();
                            }}
                            title="Allumer / Éteindre la torche"
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors ${
                              isTorchOn
                                ? 'bg-[#E9C349] text-[#241A00]'
                                : 'bg-white/10 hover:bg-white/20 text-white'
                            }`}
                          >
                            <Flashlight className="w-3 h-3" />
                            <span>{isTorchOn ? 'Torche ON' : 'Torche'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            if (isCameraScanning || isStartingCamera) {
                              void stopCameraScanner();
                            } else {
                              void startCameraScanner();
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          {isCameraScanning || isStartingCamera ? (
                            <>
                              <CameraOff className="w-3 h-3" />
                              <span>Arrêter</span>
                            </>
                          ) : (
                            <>
                              <Camera className="w-3 h-3" />
                              <span>Scanner</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="relative w-full h-64 bg-black overflow-hidden">
                      {/* Conteneur DOM exclusivement réservé à html5-qrcode : zéro enfant React à l'intérieur */}
                      <div
                        id="pos-camera-viewfinder"
                        className="w-full h-64 bg-black overflow-hidden [&>video]:!w-full [&>video]:!h-full [&>video]:object-cover [&>canvas]:max-w-full [&>canvas]:max-h-full"
                      />

                      {/* Overlay frère (hors #pos-camera-viewfinder) visible tant que le flux vidéo n'est pas actif */}
                      {!isCameraScanning && (
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/80 p-4 text-center">
                          {isStartingCamera ? (
                            <div className="flex flex-col items-center gap-2 text-[#E9C349]">
                              <RefreshCw className="w-7 h-7 animate-spin" />
                              <p className="text-xs font-bold uppercase tracking-wider">
                                Ouverture de la caméra arrière...
                              </p>
                              <p className="text-[11px] text-gray-300 max-w-xs">
                                Acceptez la demande d&apos;autorisation caméra si votre navigateur l&apos;affiche.
                              </p>
                            </div>
                          ) : cameraError ? (
                            <div className="max-w-xs space-y-2.5">
                              <CameraOff className="w-7 h-7 text-rose-400 mx-auto" />
                              <p className="text-xs font-semibold text-rose-200 leading-relaxed">
                                {cameraError}
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  void startCameraScanner();
                                }}
                                className="px-4 py-2 rounded-xl bg-[#E9C349] hover:bg-[#f1ce5d] text-[#241A00] text-xs font-heading font-extrabold uppercase tracking-wider cursor-pointer shadow-lg"
                              >
                                Réessayer la caméra
                              </button>
                            </div>
                          ) : (
                            <>
                              <Camera className="w-7 h-7 text-[#E9C349]" />
                              <button
                                type="button"
                                onClick={() => {
                                  void startCameraScanner();
                                }}
                                className="px-4 py-2.5 rounded-xl bg-[#E9C349] hover:bg-[#f1ce5d] text-[#241A00] text-xs font-heading font-extrabold uppercase tracking-wider cursor-pointer shadow-lg"
                              >
                                Démarrer la caméra
                              </button>
                              <p className="text-[11px] text-gray-300">
                                Démarre directement la caméra arrière (iOS / Android)
                              </p>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {isCameraScanning && scannerMetrics && (
                      <div className="px-3 py-1 bg-black/80 border-t border-white/10 flex items-center justify-between text-[10px] text-gray-300 font-mono">
                        <span>{scannerMetrics.engineLabel}</span>
                        <span>
                          {scannerMetrics.fps} FPS (1/{scannerMetrics.fpsDecimation}) • Prêt en {scannerMetrics.cameraStartMs} ms
                        </span>
                      </div>
                    )}

                    {/* Secours si caméra bloquée/cassée : upload d'une photo ou capture QR Code */}
                    <div className="px-3 py-2.5 bg-white/[0.03] border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                      <input
                        ref={qrFileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          void handleUploadQrImage(e);
                        }}
                        className="hidden"
                      />
                      <span className="text-[11px] text-gray-300">
                        Caméra bloquée ou hors service ?
                      </span>
                      <button
                        type="button"
                        disabled={isScanningImageFile}
                        onClick={() => qrFileInputRef.current?.click()}
                        className="px-3 py-1.5 rounded-xl bg-[#8A2BE2]/25 hover:bg-[#8A2BE2]/40 border border-[#8A2BE2]/50 text-[#DCB8FF] hover:text-white text-[11px] font-bold flex items-center gap-1.5 transition-colors disabled:opacity-60 cursor-pointer shrink-0"
                      >
                        {isScanningImageFile ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Analyse...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-3.5 h-3.5" />
                            <span>Uploader une image de QR Code</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Saisie manuelle de secours (codes abîmés / sans caméra) */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-gray-300 tracking-wider flex items-center justify-between">
                    <span>Saisie manuelle (si QR abîmé)</span>
                    <span className="text-[#E9C349] font-mono">BPT-PHY-...</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualTicketCode}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setManualTicketCode(val);
                        if (val.length >= 8) {
                          handleCheckTicketForSale(val);
                        } else {
                          setPendingTicketForConfirm(null);
                        }
                      }}
                      placeholder="Ex: BPT-PHY-THS-8B4E1"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono uppercase focus:border-[#E9C349] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleCheckTicketForSale(manualTicketCode)}
                      className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold"
                    >
                      Vérifier
                    </button>
                  </div>
                </div>

                {/* BOÎTE DE CONFIRMATION EXPLICITE : "Confirmer la vente de ce billet pour 3 500 FCFA ?" */}
                {pendingTicketForConfirm && (
                  <div className="p-4 rounded-2xl bg-[#241A00] border-2 border-[#E9C349] space-y-3 animate-in zoom-in-95 duration-200 shadow-xl">
                    <div className="flex items-center gap-2 text-[#E9C349]">
                      <AlertCircle className="w-5 h-5 shrink-0" />
                      <h4 className="font-heading font-black text-sm uppercase">
                        Confirmation Requise
                      </h4>
                    </div>

                    <p className="text-sm font-bold text-white leading-snug">
                      Confirmer la vente de ce billet pour{' '}
                      <span className="text-[#E9C349] font-black text-base">
                        {pendingTicketForConfirm.price.toLocaleString('fr-FR')} FCFA
                      </span>{' '}
                      ?
                    </p>

                    <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-300">Événement :</span>
                        <span className="font-bold text-white truncate max-w-full min-w-0">
                          {pendingTicketForConfirm.eventTitle}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-300">Catégorie :</span>
                        <span className="font-bold text-[#E9C349]">
                          {pendingTicketForConfirm.tierName}
                        </span>
                      </div>
                      <div className="flex justify-between font-mono text-[11px]">
                        <span className="text-gray-300">Code QR :</span>
                        <span className="text-white">{pendingTicketForConfirm.qrCode}</span>
                      </div>
                      <div className="flex justify-between text-[11px] pt-1 border-t border-white/5">
                        <span className="text-gray-300">Nouveau statut :</span>
                        <span className="text-emerald-400 font-extrabold uppercase">
                          sold_valid (Actif pour entrée)
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] pt-1 border-t border-white/5">
                        <span className="text-gray-300">Mode d&apos;activation :</span>
                        <span
                          className={`font-bold ${
                            pendingSaleIsManual ? 'text-amber-300' : 'text-emerald-300'
                          }`}
                        >
                          {pendingSaleIsManual
                            ? 'Déclaration manuelle (traçable)'
                            : 'Scan caméra vérifié'}
                        </span>
                      </div>
                    </div>

                    {/* Identité obligatoire de l'acheteur (billet nominatif anti-photocopie) */}
                    <div className="space-y-2">
                      <input
                        ref={buyerNameInputRef}
                        type="text"
                        autoComplete="name"
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        onFocus={(e) => e.currentTarget.scrollIntoView({ block: 'nearest', behavior: 'smooth' })}
                        placeholder="Nom complet du client *"
                        className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/15 focus:border-[#E9C349] outline-none text-base sm:text-sm text-white placeholder:text-gray-300/70"
                      />
                      <input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={buyerPhone}
                        onChange={(e) => setBuyerPhone(e.target.value.replace(/[^0-9+\s]/g, ''))}
                        onFocus={(e) => e.currentTarget.scrollIntoView({ block: 'nearest', behavior: 'smooth' })}
                        placeholder="Téléphone * (ex : 77 555 12 34)"
                        className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/15 focus:border-[#E9C349] outline-none text-base sm:text-sm text-white font-mono placeholder:text-gray-300/70"
                      />
                    </div>
                  </div>
                )}

                {/* Billets inactifs prêts à être vendus en raccourcis */}
                {!pendingTicketForConfirm && unsoldAgentTickets.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[10px] uppercase font-bold text-gray-300 tracking-wider">
                      Billets en stock prêts pour la vente rapide :
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                      {unsoldAgentTickets.slice(0, 6).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setManualTicketCode(t.qrCode);
                            handleCheckTicketForSale(t.qrCode);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-black/40 hover:bg-[#E9C349]/20 border border-white/10 hover:border-[#E9C349]/40 text-left font-mono text-[11px] text-gray-300 hover:text-white transition-colors flex items-center gap-1.5"
                        >
                          <QrCode className="w-3 h-3 text-[#E9C349]" />
                          <span>{t.qrCode.split('-').slice(-2).join('-')}</span>
                          <span className="text-[10px] text-gray-300">
                            ({t.price.toLocaleString('fr-FR')} F)
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MÉTHODE B : DÉCLARATION MANUELLE NOMINATIVE PAR SÉLECTION DU STOCK */}
            {saleMode === 'manual' && (
              <div className="space-y-4">
                <p className="text-xs text-gray-300 leading-relaxed p-3 rounded-xl bg-[#8A2BE2]/10 border border-[#8A2BE2]/30">
                  Caméra indisponible ou QR abîmé ? Sélectionnez le billet remis au client dans votre stock ci-dessous et renseignez obligatoirement son nom et son numéro de téléphone.
                </p>

                {unsoldAgentTickets.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-black/40 border border-white/10 text-center text-xs text-gray-300">
                    Aucun billet disponible en stock pour ce guichet.
                  </div>
                ) : (
                  <>
                    {/* Recherche rapide dans le stock */}
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={manualFilterQuery}
                          onChange={(e) => setManualFilterQuery(e.target.value)}
                          placeholder="Filtrer par code QR, #série ou catégorie..."
                          className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/40 border border-white/10 focus:border-[#8A2BE2] outline-none text-xs text-white placeholder:text-gray-300/75"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-gray-300 tracking-wider block">
                          Billet à activer ({filteredManualUnsoldTickets.length} disponible(s)) *
                        </label>
                        <select
                          value={selectedManualTicketCode}
                          onChange={(e) => {
                            setSelectedManualTicketCode(e.target.value);
                            setSaleErrorMessage(null);
                          }}
                          className="w-full bg-black/60 border border-white/15 focus:border-[#E9C349] rounded-xl px-3 py-2.5 text-xs text-white font-mono outline-none"
                        >
                          <option value="">
                            — Sélectionner un billet en stock —
                          </option>
                          {filteredManualUnsoldTickets.map((t) => (
                            <option key={t.id} value={t.qrCode}>
                              {t.serialNumber ? `#${t.serialNumber} • ` : ''}
                              {t.qrCode} — {t.tierName} ({t.price.toLocaleString('fr-FR')} F)
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {selectedManualTicket && (
                      <div className="p-3 rounded-xl bg-black/40 border border-[#E9C349]/30 text-xs flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono font-bold text-white truncate">
                            {selectedManualTicket.qrCode}
                          </p>
                          <p className="text-[11px] text-gray-300">
                            {selectedManualTicket.tierName} • Statut : printed_not_sold → sold_valid
                          </p>
                        </div>
                        <span className="font-heading font-black text-[#E9C349] text-sm shrink-0">
                          {selectedManualTicket.price.toLocaleString('fr-FR')} F
                        </span>
                      </div>
                    )}

                    {/* Identité obligatoire du client */}
                    <div className="space-y-2">
                      <input
                        type="text"
                        autoComplete="name"
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        onFocus={(e) => e.currentTarget.scrollIntoView({ block: 'nearest', behavior: 'smooth' })}
                        placeholder="Nom complet du client *"
                        className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/15 focus:border-[#E9C349] outline-none text-base sm:text-sm text-white placeholder:text-gray-300/70"
                      />
                      <input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={buyerPhone}
                        onChange={(e) => setBuyerPhone(e.target.value.replace(/[^0-9+\s]/g, ''))}
                        onFocus={(e) => e.currentTarget.scrollIntoView({ block: 'nearest', behavior: 'smooth' })}
                        placeholder="Téléphone * (ex : 77 555 12 34)"
                        className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/15 focus:border-[#E9C349] outline-none text-base sm:text-sm text-white font-mono placeholder:text-gray-300/70"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Messages de retour */}
            {saleSuccessMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-950/75 border border-emerald-500/60 text-emerald-200 text-xs font-bold space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                  <span>{saleSuccessMessage}</span>
                </div>
                {saleSuccessIsOffline && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-200 text-[11px] font-extrabold">
                    <CloudUpload className="w-3.5 h-3.5 text-amber-300" />
                    <span>Mode Hors-Ligne - En attente de synchronisation</span>
                  </div>
                )}
              </div>
            )}

            {saleErrorMessage && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{saleErrorMessage}</span>
              </div>
            )}
            </div>

            {/* Footer Sticky au-dessus du clavier iOS pour le bouton Confirmer */}
            {((saleMode === 'scan' && pendingTicketForConfirm) ||
              (saleMode === 'manual' && unsoldAgentTickets.length > 0)) && (
              <div className="shrink-0 sticky bottom-0 z-20 bg-[#1C1B1B]/95 backdrop-blur-md border-t border-white/10 px-5 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                {saleMode === 'scan' && pendingTicketForConfirm ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPendingTicketForConfirm(null);
                        setManualTicketCode('');
                        setBuyerName('');
                        setBuyerPhone('');
                      }}
                      className="w-1/3 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-[#E5E2E1] text-xs font-bold cursor-pointer"
                    >
                      Annuler
                    </button>

                    <button
                      type="button"
                      disabled={isSubmittingSale}
                      onClick={handleConfirmSingleSale}
                      className="flex-1 btn-gold-glow py-3 rounded-xl font-heading font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmittingSale ? (
                        <Loader2 className="w-4 h-4 animate-spin text-[#241A00]" />
                      ) : (
                        <Check className="w-4 h-4 text-[#241A00]" />
                      )}
                      <span>
                        {isSubmittingSale ? 'Activation...' : 'Oui, Confirmer la Vente'}
                      </span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={
                      isSubmittingSale ||
                      !selectedManualTicket ||
                      !buyerName.trim() ||
                      !buyerPhone.trim()
                    }
                    onClick={() => {
                      void handleConfirmManualSingleSale();
                    }}
                    className="w-full btn-gold-glow py-3.5 rounded-xl font-heading font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSubmittingSale ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#241A00]" />
                    ) : (
                      <CheckCheck className="w-4 h-4 text-[#241A00]" />
                    )}
                    <span>
                      {isSubmittingSale
                        ? 'Activation en cours...'
                        : 'Confirmer & Activer ce Billet'}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* INVENTAIRE DÉTAILLÉ DU STOCK PHYSIQUE DU COLLABORATEUR */}
      <div className="glass-panel p-4 sm:p-5 rounded-3xl border border-white/10 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-white/10 pb-3">
          <div>
            <h3 className="font-heading font-extrabold text-base text-white flex items-center gap-2">
              <Ticket className="w-4 h-4 text-[#E9C349]" />
              <span>Inventaire des Billets Physiques ({sortedFilteredInventoryTickets.length})</span>
            </h3>
            <p className="text-xs text-[#E5E2E1]">
              Liste textuelle compacte • Aucun QR code affiché ici : cliquez sur « Scanner/Vendre » pour activer un billet.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'all', label: `Tous (${agentTickets.length})` },
                { id: 'printed_not_sold', label: `En stock (${unsoldAgentTickets.length})` },
                { id: 'sold', label: `Vendus (${soldAgentTickets.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setInventoryFilter(tab.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
                  inventoryFilter === tab.id
                    ? 'bg-[#E9C349] text-[#241A00]'
                    : 'bg-white/5 text-gray-300 hover:bg-white/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Recherche rapide dans l'inventaire */}
        <div className="relative">
          <Search className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={inventorySearch}
            onChange={(e) => setInventorySearch(e.target.value)}
            placeholder="Rechercher un code billet, acheteur, catégorie..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/30 border border-white/10 text-xs sm:text-sm text-white placeholder:text-gray-300/75 focus:outline-none focus:border-[#E9C349]"
          />
        </div>

        {sortedFilteredInventoryTickets.length === 0 ? (
          <p className="text-xs text-[#E5E2E1] py-4 text-center">
            {agentTickets.length === 0
              ? "Aucun billet n'a encore été attribué à ce guichet pour le moment."
              : 'Aucun billet ne correspond à ce filtre.'}
          </p>
        ) : (
          <>
            {/* Liste textuelle ultra-simple (Code du billet, Statut, Bouton Scanner/Vendre) */}
            <div className="rounded-2xl bg-black/25 border border-white/10 divide-y divide-white/5 overflow-hidden">
              {paginatedInventoryTickets.map((t) => {
                const isUnsold = isTicketUnsoldStatus(t.status);
                const isSoldValid = t.status === 'sold_valid' || t.status === 'physical_sold';
                const isScanned = t.status === 'scanned' || t.status === 'used';
                const isCancelled = t.status === 'cancelled';
                const isPendingSync =
                  isSoldValid && pendingOfflineQrSet.has((t.qrCode || '').trim().toUpperCase());

                const statusLabel = isUnsold
                  ? 'En stock'
                  : isScanned
                    ? 'Scanné'
                    : isCancelled
                      ? 'Désactivé'
                      : isPendingSync
                        ? 'Vendu (Synchro attente)'
                        : 'Vendu';

                const statusClass = isUnsold
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  : isScanned
                    ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                    : isCancelled
                      ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                      : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';

                return (
                  <div
                    key={t.id}
                    className="px-3 py-2.5 flex items-center justify-between gap-2.5 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-mono font-bold text-xs sm:text-sm text-white truncate">
                        {t.qrCode}
                      </p>
                      <p className="text-[11px] text-gray-300 truncate">
                        {t.tierName} • {(t.price || 0).toLocaleString('fr-FR')} F
                        {!isUnsold && t.holderName && t.holderName !== 'Billet Physique Non Vendu'
                          ? ` • ${t.holderName}`
                          : ''}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusClass}`}
                    >
                      {statusLabel}
                    </span>

                    <div className="shrink-0">
                      {isUnsold ? (
                        <button
                          type="button"
                          onClick={() => {
                            setBuyerName('');
                            setBuyerPhone('');
                            setSaleMode('scan');
                            setShowSaleModal(true);
                            setManualTicketCode(t.qrCode);
                            handleCheckTicketForSale(t.qrCode);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-[11px] border border-white/20 transition-colors whitespace-nowrap cursor-pointer"
                        >
                          Scanner/Vendre
                        </button>
                      ) : (
                        <span className="inline-block px-2 py-1 text-[10px] font-medium text-gray-300">
                          Validé
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination 25 billets par page */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1 text-xs text-gray-300">
              <span>
                Affichage{' '}
                <strong className="text-white">
                  {(safeInventoryPage - 1) * INVENTORY_PAGE_SIZE + 1}
                </strong>
                –
                <strong className="text-white">
                  {Math.min(
                    safeInventoryPage * INVENTORY_PAGE_SIZE,
                    sortedFilteredInventoryTickets.length
                  )}
                </strong>{' '}
                sur <strong className="text-white">{sortedFilteredInventoryTickets.length}</strong>{' '}
                billet(s)
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safeInventoryPage <= 1}
                  onClick={() => setInventoryPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none border border-white/10 text-white font-semibold inline-flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Précédent</span>
                </button>
                <span className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white font-bold">
                  {safeInventoryPage} / {inventoryTotalPages}
                </span>
                <button
                  type="button"
                  disabled={safeInventoryPage >= inventoryTotalPages}
                  onClick={() => setInventoryPage((p) => Math.min(inventoryTotalPages, p + 1))}
                  className="px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none border border-white/10 text-white font-semibold inline-flex items-center gap-1"
                >
                  <span>Suivant</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* MODALE 2 : REVERSEMENT DES FONDS */}
      {showSettlementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <form
            onSubmit={handleDeclareSettlement}
            className="bg-[#1C1B1B] border border-emerald-500/40 w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl relative"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <h3 className="font-heading font-extrabold text-base text-white">
                  Déclarer un Reversement au Promoteur
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSettlementModal(false)}
                className="text-gray-300 hover:text-white text-xs font-bold"
              >
                Fermer
              </button>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Enregistrez le montant remis au promoteur en espèces ou par virement Wave. Le solde dû de votre point de vente sera actualisé automatiquement.
            </p>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-300 tracking-wider">
                Montant versé (FCFA)
              </label>
              <input
                type="number"
                inputMode="decimal"
                min="1000"
                step="500"
                value={settlementAmount}
                onChange={(e) => setSettlementAmount(Number(e.target.value))}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-3 text-base font-heading font-bold text-[#E9C349] focus:border-emerald-500 outline-none"
              />
              <p className="text-[10px] text-gray-300">
                Solde actuel total dû : <strong className="text-white">{netDueToPromoter.toLocaleString('fr-FR')} FCFA</strong>
              </p>
            </div>

            {settlementSuccessMessage && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{settlementSuccessMessage}</span>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSettlementModal(false)}
                className="w-1/3 py-3 rounded-xl bg-white/5 text-gray-300 hover:text-white text-xs font-bold"
              >
                Annuler
              </button>

              <button
                type="submit"
                disabled={isSubmittingSettlement || settlementAmount <= 0}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-heading font-extrabold text-xs uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSubmittingSettlement && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{isSubmittingSettlement ? 'Enregistrement...' : 'Confirmer le Versement'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODALE 3 : CLÔTURER MA CAISSE (RELEVÉ DE CAISSE / SHIFT HANDOVER) */}
      {showShiftCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <form
            onSubmit={handleSubmitShiftClose}
            className="bg-[#1C1B1B] border border-rose-500/40 w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl relative"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-rose-400" />
                <h3 className="font-heading font-extrabold text-base text-white">
                  Clôturer ma caisse (Relevé)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShiftCloseModal(false)}
                className="text-gray-300 hover:text-white text-xs font-bold cursor-pointer"
              >
                Fermer
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Point de vente :</span>
                <span className="font-bold text-white">{activeAgent.pointDeVente}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Billets déclarés vendus :</span>
                <span className="font-bold text-[#E9C349]">{soldCountDisplay} billet(s)</span>
              </div>
              {manualSoldCount > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">Dont ventes manuelles :</span>
                  <span className="font-bold text-amber-300">{manualSoldCount}</span>
                </div>
              )}
            </div>

            {!shiftCloseSuccess ? (
              <>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Comptez physiquement les billets et pièces en votre possession puis saisissez le montant exact en FCFA pour contrôler et clôturer votre service.
                </p>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-gray-300 tracking-wider block">
                    Montant total en espèces compté (FCFA) *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    value={countedCashInput}
                    onChange={(e) => {
                      setCountedCashInput(e.target.value.replace(/[^0-9]/g, ''));
                      if (shiftCloseError) setShiftCloseError(null);
                    }}
                    placeholder="Ex : 35000"
                    className="w-full bg-black/50 border border-white/15 focus:border-[#E9C349] rounded-xl px-4 py-3 text-lg font-heading font-black text-white placeholder:text-gray-300/75 outline-none"
                  />
                  {countedCashInput && (
                    <p className="text-[11px] text-[#E9C349] font-semibold">
                      Saisie : {Number(countedCashInput).toLocaleString('fr-FR')} FCFA
                    </p>
                  )}
                </div>

                {shiftCloseError && (
                  <div
                    role="alert"
                    className="p-4 rounded-2xl bg-rose-950/85 border-2 border-rose-500 text-rose-100 text-xs font-bold flex items-start gap-2.5 animate-in fade-in shadow-lg"
                  >
                    <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-rose-300 uppercase tracking-wider text-[10px] font-black">
                        Écart de caisse détecté — Clôture bloquée
                      </p>
                      <p className="leading-snug text-sm">{shiftCloseError}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowShiftCloseModal(false)}
                    className="w-1/3 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingShiftClose || !countedCashInput.trim() || Boolean(shiftCloseError)}
                    className="flex-1 py-3 rounded-xl btn-gold-glow text-[#241A00] font-heading font-extrabold text-xs uppercase tracking-wider transition-all shadow-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isSubmittingShiftClose && <Loader2 className="w-4 h-4 animate-spin text-[#241A00]" />}
                    <span>{isSubmittingShiftClose ? 'Vérification...' : 'Valider la clôture'}</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-100 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-300 font-heading font-extrabold text-sm">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>Caisse clôturée avec succès !</span>
                  </div>
                  <p className="text-xs text-emerald-100/90 leading-relaxed">
                    Le montant compté ({shiftCloseSuccess.countedAmount.toLocaleString('fr-FR')} FCFA pour {shiftCloseSuccess.soldCount} billet(s)) correspond exactement aux ventes déclarées.
                  </p>
                  <p className="text-[10px] text-emerald-300/80">
                    Horodatage : {new Date(shiftCloseSuccess.timestamp).toLocaleString('fr-FR')}
                    {!shiftCloseSuccess.syncedToServer && ' • Enregistré localement (synchro en attente)'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowShiftCloseModal(false)}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-heading font-extrabold text-xs uppercase tracking-wider cursor-pointer"
                >
                  Terminer
                </button>
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
};
