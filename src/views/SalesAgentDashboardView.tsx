import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
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
  Check,
  CheckCheck,
  Search,
  ShoppingCart,
} from 'lucide-react';
import { SalesAgent, UserTicket, EventItem, UserProfile } from '../types';
import {
  getStoredSalesAgents,
  getStoredTickets,
  saveStoredTickets,
  recordAgentSettlement,
  saveSalesAgents,
  lookupPhysicalTicketForSale,
  confirmSinglePhysicalTicketSale,
  fetchSalesAgentsFromSupabase,
  fetchAllSoldTicketsFromSupabase,
  isSupabaseConfigured,
  clearLocalTicketReserveCache,
  getSupabaseClient,
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
}

export const SalesAgentDashboardView: React.FC<SalesAgentDashboardViewProps> = ({
  currentAgentId,
  promoterPhone = '+221 77 458 74 74',
  events = [],
  onOpenScanner,
  user,
  onNavigateBack,
}) => {
  const isConnected = isSupabaseConfigured();
  const [agents, setAgents] = useState<SalesAgent[]>(() => (isConnected ? [] : getStoredSalesAgents()));
  const [tickets, setTickets] = useState<UserTicket[]>(() => (isConnected ? [] : getStoredTickets()));
  const [isRefreshing, setIsRefreshing] = useState<boolean>(isConnected);
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
  const [saleMode, setSaleMode] = useState<'scan' | 'manual'>('scan');
  const [manualTicketCode, setManualTicketCode] = useState('');
  const [selectedManualTicketCode, setSelectedManualTicketCode] = useState('');
  const [manualFilterQuery, setManualFilterQuery] = useState('');
  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'printed_not_sold' | 'sold'>('all');
  const [pendingTicketForConfirm, setPendingTicketForConfirm] = useState<UserTicket | null>(null);
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [saleSuccessMessage, setSaleSuccessMessage] = useState<string | null>(null);
  const [saleErrorMessage, setSaleErrorMessage] = useState<string | null>(null);
  const [isCameraScanning, setIsCameraScanning] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerRunIdRef = useRef<number>(0);
  const lastScannedTimeRef = useRef<number>(0);
  const buyerNameInputRef = useRef<HTMLInputElement | null>(null);

  const stopCameraScanner = useCallback(async () => {
    scannerRunIdRef.current += 1;
    const instance = scannerRef.current;
    scannerRef.current = null;
    if (instance) {
      try {
        if (instance.isScanning) {
          await instance.stop();
        }
        instance.clear();
      } catch {
        // Ignorer les erreurs de nettoyage caméra si le nœud DOM est déjà démonté
      }
    }
    setIsCameraScanning(false);
    setIsStartingCamera(false);
  }, []);

  // Modale de demande de reversement
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState<number>(0);
  const [settlementSuccessMessage, setSettlementSuccessMessage] = useState<string | null>(null);

  const activeAgent = useMemo(() => {
    return agents.find((a) => a.id === selectedAgentId) || agents[0] || null;
  }, [agents, selectedAgentId]);

  const activeEvent = useMemo(() => {
    if (!activeAgent) return null;
    return events.find((e) => e.id === activeAgent.eventId) || null;
  }, [events, activeAgent]);

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

    const getPriority = (status: UserTicket['status']): number => {
      if (isTicketUnsoldStatus(status)) return 0;
      if (status === 'sold_valid' || status === 'physical_sold') return 1;
      if (status === 'scanned' || status === 'used') return 2;
      return 3;
    };

    return [...base].sort((a, b) => {
      const pDiff = getPriority(a.status) - getPriority(b.status);
      if (pDiff !== 0) return pDiff;
      if (typeof a.serialNumber === 'number' && typeof b.serialNumber === 'number') {
        return a.serialNumber - b.serialNumber;
      }
      return a.qrCode.localeCompare(b.qrCode);
    });
  }, [agentTickets, unsoldAgentTickets, soldAgentTickets, inventoryFilter]);

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

  const handleRefresh = useCallback(async (agentOverrideId?: string) => {
    setIsRefreshing(true);
    clearLocalTicketReserveCache();

    if (isConnected) {
      const agentsRes = await fetchSalesAgentsFromSupabase();
      const loadedAgents = !agentsRes.error ? agentsRes.agents : getStoredSalesAgents();
      if (!agentsRes.error) {
        setAgents(agentsRes.agents);
        saveSalesAgents(agentsRes.agents);
      } else {
        setAgents(getStoredSalesAgents());
      }

      const preferredId = agentOverrideId || currentAgentId || selectedAgentIdRef.current;
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
        setTickets(strictAgentTickets);
        saveStoredTickets(strictAgentTickets);
      } else {
        const storedFallback = getStoredTickets();
        const strictFallback = targetAgent
          ? storedFallback.filter((t) => t.agentId === targetAgent.id)
          : storedFallback;
        setTickets(strictFallback);
      }
    } else {
      setAgents(getStoredSalesAgents());
      setTickets(getStoredTickets());
    }

    setIsRefreshing(false);
  }, [isConnected, currentAgentId, user?.assignedAgentId, user?.id, user?.phone, user?.email]);

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

    setPendingTicketForConfirm(check.ticket);
    if (fromCamera) {
      playPosFeedbackTone('success');
    }
    setTimeout(() => {
      buyerNameInputRef.current?.focus();
    }, 150);
    return true;
  }, []);

  const startCameraScanner = useCallback(async () => {
    await stopCameraScanner();
    const runId = scannerRunIdRef.current;
    setCameraError(null);
    setIsStartingCamera(true);

    await new Promise((resolve) => setTimeout(resolve, 180));
    if (runId !== scannerRunIdRef.current) {
      setIsStartingCamera(false);
      return;
    }

    const elementId = 'pos-camera-viewfinder';
    const el = document.getElementById(elementId);
    if (!el) {
      setIsStartingCamera(false);
      return;
    }

    try {
      const html5Qr = new Html5Qrcode(elementId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
        ],
        verbose: false,
      });
      scannerRef.current = html5Qr;

      await html5Qr.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const boxW = Math.max(180, Math.floor(viewfinderWidth * 0.84));
            const boxH = Math.max(150, Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.72));
            return { width: boxW, height: boxH };
          },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          if (runId !== scannerRunIdRef.current) return;
          const now = Date.now();
          if (now - lastScannedTimeRef.current < 2500) return;
          lastScannedTimeRef.current = now;

          const clean = extractScannedTicketCode(decodedText);
          setManualTicketCode(clean);
          void stopCameraScanner();
          handleCheckTicketForSale(clean, true);
        },
        () => {
          // Frames vides ignorées pendant la recherche
        }
      );

      if (runId === scannerRunIdRef.current) {
        setIsCameraScanning(true);
        setIsStartingCamera(false);
      } else {
        await stopCameraScanner();
      }
    } catch (err: unknown) {
      console.warn('Erreur activation camera POS:', err);
      if (runId === scannerRunIdRef.current) {
        setCameraError(
          "Impossible d'activer l'appareil photo. Vérifiez les permissions caméra ou saisissez le code ci-dessous."
        );
        setIsCameraScanning(false);
        setIsStartingCamera(false);
      }
    }
  }, [handleCheckTicketForSale, stopCameraScanner]);

  useEffect(() => {
    if (showSaleModal && saleMode === 'scan' && !pendingTicketForConfirm) {
      void startCameraScanner();
    } else {
      void stopCameraScanner();
    }
    return () => {
      void stopCameraScanner();
    };
  }, [showSaleModal, saleMode, pendingTicketForConfirm, startCameraScanner, stopCameraScanner]);

  // Helper partagé pour activer un billet physique nominatif (Scan Caméra ou Déclaration Manuelle)
  const submitSingleNominalSale = async (targetTicket: UserTicket) => {
    if (!activeAgent) return;
    if (!buyerName.trim() || !buyerPhone.trim()) {
      setSaleErrorMessage('Le nom et le téléphone du client sont obligatoires pour activer le billet.');
      return;
    }

    setIsSubmittingSale(true);
    setSaleErrorMessage(null);
    setSaleSuccessMessage(null);

    const prevAgents = [...agents];
    const prevTickets = [...tickets];
    const soldPrice = targetTicket.price || 3500;
    const trimmedName = buyerName.trim();
    const trimmedPhone = buyerPhone.trim();

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
              soldAt: new Date().toISOString(),
            }
          : t
      )
    );

    const res = await confirmSinglePhysicalTicketSale(
      activeAgent.id,
      targetTicket.qrCode,
      {
        name: trimmedName,
        phone: trimmedPhone,
      },
      prevTickets
    );
    setIsSubmittingSale(false);

    if (!res.success) {
      setAgents(prevAgents);
      setTickets(prevTickets);
      setSaleErrorMessage(res.message);
      playPosFeedbackTone('error');
      return;
    }

    playPosFeedbackTone('success');
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

  // Confirmation explicite depuis l'onglet Scan Billet Unique
  const handleConfirmSingleSale = async () => {
    if (!pendingTicketForConfirm) return;
    await submitSingleNominalSale(pendingTicketForConfirm);
  };

  // Confirmation explicite depuis l'onglet Déclaration Manuelle (billet sélectionné en stock)
  const handleConfirmManualSingleSale = async () => {
    if (!selectedManualTicket) {
      setSaleErrorMessage('Veuillez sélectionner un billet disponible dans votre stock.');
      return;
    }
    await submitSingleNominalSale(selectedManualTicket);
  };

  const handleDeclareSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAgent || settlementAmount <= 0) return;

    const res = await recordAgentSettlement(activeAgent.id, settlementAmount);
    if (res.success) {
      setSettlementSuccessMessage(res.message);
      handleRefresh();
      setTimeout(() => {
        setShowSettlementModal(false);
        setSettlementSuccessMessage(null);
      }, 1800);
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
          <p className="text-xs text-gray-400">
            Synchronisation de vos stocks physiques et ventes depuis Supabase.
          </p>
        </div>
      );
    }

    return (
      <div className="max-w-2xl mx-auto p-8 text-center space-y-4 glass-panel rounded-3xl animate-in fade-in">
        <Store className="w-12 h-12 text-[#E9C349] mx-auto" />
        <h2 className="font-heading text-lg font-bold text-white">
          Aucun point de vente affilié trouvé
        </h2>
        <p className="text-xs text-gray-400">
          Votre compte n'est pas encore associé à un réseau de vente physique. Contactez votre promoteur Thièsdn pour recevoir votre lot de billets.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pb-24 animate-in fade-in duration-300">
      {/* Header Collaborateur Mobile-First */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-5 sm:p-6 rounded-3xl border border-[#E9C349]/30 relative overflow-hidden bg-gradient-to-br from-[#1C1A14] to-[#121212]">
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#E9C349]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-1.5 relative z-10">
          <div className="flex items-center gap-2">
            {onNavigateBack && (
              <button
                type="button"
                onClick={onNavigateBack}
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all mr-1"
                title="Retour"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <span className="p-1.5 rounded-lg bg-[#E9C349]/20 text-[#E9C349] border border-[#E9C349]/30">
              <Store className="w-4 h-4" />
            </span>
            <span className="text-[10px] uppercase font-extrabold tracking-wider text-[#E9C349] bg-[#E9C349]/10 px-2 py-0.5 rounded-full border border-[#E9C349]/20">
              Guichet Partenaire Agréé
            </span>
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
            <span className="flex items-center gap-1 font-mono text-gray-400">
              <Phone className="w-3.5 h-3.5 text-[#1DC3F4]" />
              {activeAgent.telephone}
            </span>
            <span>•</span>
            <span className="text-[#E9C349] font-bold">
              {activeAgent.quartier || 'Thiès'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 relative z-10 self-start sm:self-auto">
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
            onClick={() => {
              void handleRefresh();
            }}
            disabled={isRefreshing}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 transition-colors disabled:opacity-60"
            title="Actualiser les stocks et ventes"
          >
            <RefreshCw className={`w-4 h-4 text-[#8A2BE2] ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Carte de l'Événement Assigné */}
      <div className="glass-panel p-5 rounded-3xl border border-white/10 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
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
          <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Billets Reçus</p>
          <h4 className="font-heading text-xl sm:text-2xl font-black text-white">
            {allocatedCountDisplay} <span className="text-xs text-gray-400 font-bold">billets</span>
          </h4>
          <p className="text-[10px] text-gray-400">Dépôt total confié</p>
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
          <p className="text-[10px] text-gray-400">Prêts à être vendus</p>
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

      {/* Barre d'Actions Rapides : "Méthode Scan" & "Déclaration Manuelle" & "Reversement" */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <button
          type="button"
          onClick={() => {
            setSaleErrorMessage(null);
            setSaleSuccessMessage(null);
            setCameraError(null);
            setSaleMode('scan');
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
            setPendingTicketForConfirm(null);
            setManualTicketCode('');
            setBuyerName('');
            setBuyerPhone('');
            setManualFilterQuery('');
            setShowSaleModal(true);
          }}
          disabled={remainingTickets <= 0}
          className="py-4 px-4 rounded-2xl bg-[#1C1B1B] hover:bg-[#252525] border border-[#E9C349]/40 text-[#E9C349] font-heading font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 disabled:opacity-50"
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
          className="btn-primary-glow py-4 px-4 rounded-2xl font-heading font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg active:scale-98"
        >
          <DollarSign className="w-4 h-4" />
          <span>Déclarer Reversement</span>
        </button>
      </div>

      {/* MODALE 1 : ACTIVATION PAR VENTE (SCAN UNITAIRE OU DÉCLARATION MANUELLE) */}
      {showSaleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#1C1B1B] border border-[#E9C349]/40 w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {/* Header Modale */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#E9C349]" />
                <div>
                  <h3 className="font-heading font-extrabold text-base text-white">
                    Activation par Vente
                  </h3>
                  <span className="text-[10px] text-gray-400">
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
                className="text-gray-400 hover:text-white text-xs font-bold p-1 rounded-lg bg-white/5"
              >
                ✕
              </button>
            </div>

            {/* Sélecteur des 2 Méthodes demandées */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/40 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setSaleMode('scan');
                  setSaleErrorMessage(null);
                  setSaleSuccessMessage(null);
                }}
                className={`py-2 rounded-lg text-xs font-heading font-bold uppercase transition-all flex items-center justify-center gap-1.5 ${
                  saleMode === 'scan'
                    ? 'bg-[#E9C349] text-[#241A00] shadow'
                    : 'text-gray-400 hover:text-white'
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
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Ticket className="w-3.5 h-3.5" />
                <span>Déclaration Manuelle</span>
              </button>
            </div>

            {/* MÉTHODE A : SCAN CAMÉRA + SAISIE MANUELLE + CONFIRMATION NOMINATIVE */}
            {saleMode === 'scan' && (
              <div className="space-y-4">
                {/* Viseur Caméra Arrière Temps Réel (auto-démarré si aucun billet en attente) */}
                {!pendingTicketForConfirm && (
                  <div className="rounded-2xl border border-[#E9C349]/30 bg-black/70 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/[0.03]">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#E9C349]">
                        <Camera className="w-3.5 h-3.5" />
                        <span>
                          {isStartingCamera
                            ? 'Activation caméra...'
                            : isCameraScanning
                              ? 'Caméra active — Visez le QR ou Code-Barres'
                              : 'Scanner Caméra'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (isCameraScanning || isStartingCamera) {
                            void stopCameraScanner();
                          } else {
                            void startCameraScanner();
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-white flex items-center gap-1 transition-colors"
                      >
                        {isCameraScanning || isStartingCamera ? (
                          <>
                            <CameraOff className="w-3 h-3" />
                            <span>Arrêter</span>
                          </>
                        ) : (
                          <>
                            <Camera className="w-3 h-3" />
                            <span>Activer</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="relative">
                      <div id="pos-camera-viewfinder" className="w-full min-h-[210px] bg-black" />
                      {cameraError && (
                        <div className="p-3 bg-rose-950/70 border-t border-rose-500/30 text-[11px] text-rose-200 flex items-center justify-between gap-2">
                          <span>{cameraError}</span>
                          <button
                            type="button"
                            onClick={() => {
                              void startCameraScanner();
                            }}
                            className="shrink-0 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-white font-bold"
                          >
                            Réessayer
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Saisie manuelle de secours (codes abîmés / sans caméra) */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex items-center justify-between">
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
                        <span className="text-gray-400">Événement :</span>
                        <span className="font-bold text-white truncate max-w-full min-w-0">
                          {pendingTicketForConfirm.eventTitle}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Catégorie :</span>
                        <span className="font-bold text-[#E9C349]">
                          {pendingTicketForConfirm.tierName}
                        </span>
                      </div>
                      <div className="flex justify-between font-mono text-[11px]">
                        <span className="text-gray-400">Code QR :</span>
                        <span className="text-white">{pendingTicketForConfirm.qrCode}</span>
                      </div>
                      <div className="flex justify-between text-[11px] pt-1 border-t border-white/5">
                        <span className="text-gray-400">Nouveau statut :</span>
                        <span className="text-emerald-400 font-extrabold uppercase">
                          sold_valid (Actif pour entrée)
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
                        placeholder="Nom complet du client *"
                        className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/15 focus:border-[#E9C349] outline-none text-sm text-white placeholder:text-gray-500"
                      />
                      <input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={buyerPhone}
                        onChange={(e) => setBuyerPhone(e.target.value.replace(/[^0-9+\s]/g, ''))}
                        placeholder="Téléphone * (ex : 77 555 12 34)"
                        className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/15 focus:border-[#E9C349] outline-none text-sm text-white font-mono placeholder:text-gray-500"
                      />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setPendingTicketForConfirm(null);
                          setManualTicketCode('');
                          setBuyerName('');
                          setBuyerPhone('');
                        }}
                        className="w-1/3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-gray-300 text-xs font-bold"
                      >
                        Annuler
                      </button>

                      <button
                        type="button"
                        disabled={isSubmittingSale}
                        onClick={handleConfirmSingleSale}
                        className="flex-1 btn-gold-glow py-2.5 rounded-xl font-heading font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg"
                      >
                        <Check className="w-4 h-4 text-[#241A00]" />
                        <span>
                          {isSubmittingSale ? 'Activation...' : 'Oui, Confirmer la Vente'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Billets inactifs prêts à être vendus en raccourcis */}
                {!pendingTicketForConfirm && unsoldAgentTickets.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
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
                          <span className="text-[10px] text-gray-500">
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
                  <div className="p-4 rounded-2xl bg-black/40 border border-white/10 text-center text-xs text-gray-400">
                    Aucun billet disponible en stock pour ce guichet.
                  </div>
                ) : (
                  <>
                    {/* Recherche rapide dans le stock */}
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={manualFilterQuery}
                          onChange={(e) => setManualFilterQuery(e.target.value)}
                          placeholder="Filtrer par code QR, #série ou catégorie..."
                          className="w-full pl-9 pr-3 py-2 rounded-xl bg-black/40 border border-white/10 focus:border-[#8A2BE2] outline-none text-xs text-white placeholder:text-gray-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">
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
                          <p className="text-[11px] text-gray-400">
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
                        placeholder="Nom complet du client *"
                        className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/15 focus:border-[#E9C349] outline-none text-sm text-white placeholder:text-gray-500"
                      />
                      <input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={buyerPhone}
                        onChange={(e) => setBuyerPhone(e.target.value.replace(/[^0-9+\s]/g, ''))}
                        placeholder="Téléphone * (ex : 77 555 12 34)"
                        className="w-full px-3 py-2.5 rounded-xl bg-black/60 border border-white/15 focus:border-[#E9C349] outline-none text-sm text-white font-mono placeholder:text-gray-500"
                      />
                    </div>

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
                      className="w-full btn-gold-glow py-3.5 rounded-xl font-heading font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <CheckCheck className="w-4 h-4 text-[#241A00]" />
                      <span>
                        {isSubmittingSale
                          ? 'Activation en cours...'
                          : 'Activer ce Billet Nominatif'}
                      </span>
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Messages de retour */}
            {saleSuccessMessage && (
              <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{saleSuccessMessage}</span>
              </div>
            )}

            {saleErrorMessage && (
              <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{saleErrorMessage}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* INVENTAIRE DÉTAILLÉ DU STOCK PHYSIQUE DU COLLABORATEUR */}
      <div className="glass-panel p-5 rounded-3xl border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div>
            <h3 className="font-heading font-extrabold text-base text-white flex items-center gap-2">
              <Ticket className="w-4 h-4 text-[#E9C349]" />
              <span>Inventaire des Billets Physiques du Guichet</span>
            </h3>
            <p className="text-xs text-gray-400">
              Suivi unitaire de chaque code QR : inactif tant que non vendu.
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

        {sortedFilteredInventoryTickets.length === 0 ? (
          <p className="text-xs text-gray-500 py-4 text-center">
            {agentTickets.length === 0
              ? "Aucun billet n'a encore été attribué à ce guichet pour le moment."
              : 'Aucun billet ne correspond à ce filtre.'}
          </p>
        ) : (
          <>
            {/* Vue Cartes Mobile (< 768px) */}
            <div className="block md:hidden space-y-3">
              {sortedFilteredInventoryTickets.map((t) => {
                const isUnsold = isTicketUnsoldStatus(t.status);
                const isSoldValid = t.status === 'sold_valid' || t.status === 'physical_sold';
                const isScanned = t.status === 'scanned' || t.status === 'used';
                const isCancelled = t.status === 'cancelled';

                return (
                  <div key={t.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-mono font-bold text-white text-xs truncate">
                        <QrCode className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">{t.qrCode}</span>
                      </div>
                      <div>
                        {isUnsold && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            En stock
                          </span>
                        )}
                        {isSoldValid && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Vendu
                          </span>
                        )}
                        {isScanned && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold">
                            <Check className="w-3 h-3 text-indigo-400" />
                            Scanné
                          </span>
                        )}
                        {isCancelled && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[10px] font-bold">
                            <AlertCircle className="w-3 h-3 text-rose-400" />
                            Désactivé
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs bg-black/30 p-2.5 rounded-xl border border-white/5">
                      <span className="text-gray-300 font-medium truncate">
                        {t.tierName}
                        {!isUnsold && t.holderName && t.holderName !== 'Billet Physique Non Vendu'
                          ? ` • ${t.holderName}`
                          : ''}
                      </span>
                      <span className="font-heading font-extrabold text-[#E9C349] text-sm">
                        {t.price.toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>

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
                        className="w-full min-h-[44px] rounded-xl bg-gradient-to-r from-[#E9C349]/20 to-[#E9C349]/30 hover:from-[#E9C349]/30 hover:to-[#E9C349]/40 text-[#E9C349] font-heading font-bold text-xs border border-[#E9C349]/40 flex items-center justify-center gap-2 transition-all cursor-pointer"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        <span>Activer la Vente Nominative</span>
                      </button>
                    ) : (
                      <div className="w-full py-2 rounded-xl bg-white/5 text-center text-xs text-gray-400">
                        {t.holderPhone ? `Client : ${t.holderName} (${t.holderPhone})` : 'Billet déjà validé et sécurisé'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Vue Tableau Desktop (>= 768px) */}
            <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/5 text-gray-400 uppercase font-heading text-[10px]">
                  <th className="py-2.5 px-3">Numéro / Code</th>
                  <th className="py-2.5 px-3">Catégorie</th>
                  <th className="py-2.5 px-3">Prix</th>
                  <th className="py-2.5 px-3">Statut Sécurité</th>
                  <th className="py-2.5 px-3 text-right">Action Vente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedFilteredInventoryTickets.map((t) => {
                  const isUnsold = isTicketUnsoldStatus(t.status);
                  const isSoldValid = t.status === 'sold_valid' || t.status === 'physical_sold';
                  const isScanned = t.status === 'scanned' || t.status === 'used';
                  const isCancelled = t.status === 'cancelled';

                  return (
                    <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-white flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                        <span>{t.qrCode}</span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-300">
                        <span>{t.tierName}</span>
                        {!isUnsold && t.holderName && t.holderName !== 'Billet Physique Non Vendu' && (
                          <span className="block text-[10px] text-gray-400">
                            {t.holderName} {t.holderPhone ? `• ${t.holderPhone}` : ''}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-white">
                        {t.price.toLocaleString('fr-FR')} F
                      </td>
                      <td className="py-2.5 px-3">
                        {isUnsold && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            En stock (printed_not_sold)
                          </span>
                        )}
                        {isSoldValid && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Vendu (sold_valid)
                          </span>
                        )}
                        {isScanned && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold">
                            <Check className="w-3 h-3 text-indigo-400" />
                            Scanné à l'Entrée
                          </span>
                        )}
                        {isCancelled && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[10px] font-bold">
                            <AlertCircle className="w-3 h-3 text-rose-400" />
                            Désactivé
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
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
                            className="px-2.5 py-1 rounded-lg bg-[#E9C349]/20 hover:bg-[#E9C349]/30 text-[#E9C349] font-bold text-[10px] border border-[#E9C349]/40 transition-all"
                          >
                            Activer la Vente
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-500 italic">Validé</span>
                        )}
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
                className="text-gray-400 hover:text-white text-xs font-bold"
              >
                Fermer
              </button>
            </div>

            <p className="text-xs text-gray-300 leading-relaxed">
              Enregistrez le montant remis au promoteur en espèces ou par virement Wave. Le solde dû de votre point de vente sera actualisé automatiquement.
            </p>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                Montant versé (FCFA)
              </label>
              <input
                type="number"
                min="1000"
                step="500"
                value={settlementAmount}
                onChange={(e) => setSettlementAmount(Number(e.target.value))}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-3 text-base font-heading font-bold text-[#E9C349] focus:border-emerald-500 outline-none"
              />
              <p className="text-[10px] text-gray-400">
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
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-heading font-extrabold text-xs uppercase tracking-wider transition-all shadow-lg"
              >
                Confirmer le Versement
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
