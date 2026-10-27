import React, { useState, useEffect, useMemo } from 'react';
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
  Minus,
  Sparkles,
  Calendar,
  MapPin,
  Clock,
  ShieldCheck,
  Percent,
  Scan,
  Check,
  CheckCheck,
  Search,
} from 'lucide-react';
import { SalesAgent, UserTicket, EventItem, UserProfile } from '../types';
import {
  getStoredSalesAgents,
  getStoredTickets,
  recordAgentSale,
  recordAgentSettlement,
  saveSalesAgents,
  lookupPhysicalTicketForSale,
  confirmSinglePhysicalTicketSale,
} from '../services/supabase';

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
  const [agents, setAgents] = useState<SalesAgent[]>(getStoredSalesAgents());
  const [tickets, setTickets] = useState<UserTicket[]>(getStoredTickets());
  const [selectedAgentId, setSelectedAgentId] = useState<string>(() => {
    if (currentAgentId) return currentAgentId;
    if (user?.assignedAgentId) return user.assignedAgentId;
    const initialAgents = getStoredSalesAgents();
    const byUserId = initialAgents.find((a) => a.userId === user?.id || (user?.phone && a.telephone.includes(user.phone)));
    if (byUserId) return byUserId.id;
    return initialAgents[0]?.id || '';
  });

  // Modale de déclaration de vente avec deux méthodes : Scan unitaire vs Déclaration manuelle
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [saleMode, setSaleMode] = useState<'scan' | 'manual'>('scan');
  const [saleQuantity, setSaleQuantity] = useState(1);
  const [manualTicketCode, setManualTicketCode] = useState('');
  const [pendingTicketForConfirm, setPendingTicketForConfirm] = useState<UserTicket | null>(null);
  const [isSubmittingSale, setIsSubmittingSale] = useState(false);
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [saleSuccessMessage, setSaleSuccessMessage] = useState<string | null>(null);
  const [saleErrorMessage, setSaleErrorMessage] = useState<string | null>(null);

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

  // Billets alloués et vendus pour cet agent
  const agentTickets = useMemo(() => {
    if (!activeAgent) return [];
    return tickets.filter((t) => t.agentId === activeAgent.id);
  }, [tickets, activeAgent]);

  const remainingTickets = useMemo(() => {
    if (!activeAgent) return 0;
    return Math.max(0, activeAgent.allocatedCount - activeAgent.soldCount);
  }, [activeAgent]);

  const estimatedTotalCash = activeAgent ? activeAgent.cashCollected : 0;
  const agentCommissionEarned = activeAgent
    ? Math.round((estimatedTotalCash * activeAgent.commissionPercent) / 100)
    : 0;
  const netDueToPromoter = activeAgent ? activeAgent.amountDue : 0;

  const handleRefresh = () => {
    setAgents(getStoredSalesAgents());
    setTickets(getStoredTickets());
  };

  // Méthode A : Scan préalable et vérification du billet
  const handleCheckTicketForSale = (code: string) => {
    setSaleErrorMessage(null);
    setSaleSuccessMessage(null);
    if (!activeAgent || !code.trim()) {
      setPendingTicketForConfirm(null);
      return;
    }

    const check = lookupPhysicalTicketForSale(activeAgent.id, code.trim());
    if (!check.found || !check.ticket) {
      setSaleErrorMessage(check.message || 'Billet introuvable.');
      setPendingTicketForConfirm(null);
      return;
    }

    if (!check.canBeSold) {
      setSaleErrorMessage(check.message || 'Ce billet ne peut pas être vendu.');
      setPendingTicketForConfirm(null);
      return;
    }

    setPendingTicketForConfirm(check.ticket);
  };

  // Confirmation explicite de la vente unitaire
  const handleConfirmSingleSale = async () => {
    if (!activeAgent || !pendingTicketForConfirm) return;
    if (!buyerName.trim() || !buyerPhone.trim()) {
      setSaleErrorMessage('Le nom et le téléphone du client sont obligatoires pour activer le billet.');
      return;
    }
    setIsSubmittingSale(true);
    setSaleErrorMessage(null);
    setSaleSuccessMessage(null);

    const res = await confirmSinglePhysicalTicketSale(activeAgent.id, pendingTicketForConfirm.qrCode, {
      name: buyerName,
      phone: buyerPhone,
    });
    setIsSubmittingSale(false);

    if (!res.success) {
      setSaleErrorMessage(res.message);
      return;
    }

    setSaleSuccessMessage(res.message);
    setPendingTicketForConfirm(null);
    setBuyerName('');
    setBuyerPhone('');
    setManualTicketCode('');
    handleRefresh();

    setTimeout(() => {
      setShowSaleModal(false);
      setSaleSuccessMessage(null);
    }, 2200);
  };

  // Méthode B : Déclaration manuelle par nombre de billets
  const handleQuickAddSale = async (qty: number) => {
    if (!activeAgent) return;
    setIsSubmittingSale(true);
    setSaleErrorMessage(null);
    setSaleSuccessMessage(null);

    const res = await recordAgentSale(activeAgent.id, qty);

    setIsSubmittingSale(false);
    if (!res.success) {
      setSaleErrorMessage(res.message);
      return;
    }

    setSaleSuccessMessage(res.message);
    setManualTicketCode('');
    setSaleQuantity(1);
    handleRefresh();

    setTimeout(() => {
      setShowSaleModal(false);
      setSaleSuccessMessage(null);
    }, 2000);
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
    <div className="max-w-4xl mx-auto space-y-6 pb-24 animate-in fade-in duration-300">
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
              onChange={(e) => setSelectedAgentId(e.target.value)}
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
            onClick={handleRefresh}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
            title="Actualiser les stocks et ventes"
          >
            <RefreshCw className="w-4 h-4 text-[#8A2BE2]" />
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
            {activeAgent.allocatedCount} <span className="text-xs text-gray-400 font-bold">billets</span>
          </h4>
          <p className="text-[10px] text-gray-400">Dépôt total confié</p>
        </div>

        {/* 2. Billets Vendus */}
        <div className="glass-panel p-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 space-y-1">
          <p className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Billets Vendus</p>
          <h4 className="font-heading text-xl sm:text-2xl font-black text-emerald-300">
            {activeAgent.soldCount} <span className="text-xs text-white font-bold">écoulés</span>
          </h4>
          <p className="text-[10px] text-emerald-400/80">
            {activeAgent.allocatedCount > 0
              ? `${Math.round((activeAgent.soldCount / activeAgent.allocatedCount) * 100)}% du lot vendu`
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
            setSaleMode('scan');
            setPendingTicketForConfirm(null);
            setManualTicketCode('');
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
            setSaleMode('manual');
            setPendingTicketForConfirm(null);
            setManualTicketCode('');
            setShowSaleModal(true);
          }}
          disabled={remainingTickets <= 0}
          className="py-4 px-4 rounded-2xl bg-[#1C1B1B] hover:bg-[#252525] border border-[#E9C349]/40 text-[#E9C349] font-heading font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md active:scale-98 disabled:opacity-50"
        >
          <Ticket className="w-4 h-4" />
          <span>Déclaration par Lot (Journée)</span>
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
                  setShowSaleModal(false);
                  setPendingTicketForConfirm(null);
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

            {/* MÉTHODE A : SCAN PAR LE COLLABORATEUR AVEC CONFIRMATION OBLIGATOIRE */}
            {saleMode === 'scan' && (
              <div className="space-y-4">
                <p className="text-xs text-gray-300 leading-relaxed">
                  Scannez ou saisissez le code QR du billet papier pour l'activer avant de le remettre au client.
                </p>

                {/* Saisie ou Scan du code */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex items-center justify-between">
                    <span>Code Billet Papier (QR Code)</span>
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
                      <Sparkles className="w-5 h-5 shrink-0" />
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
                {!pendingTicketForConfirm && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                      Billets en stock prêts pour la vente rapide :
                    </p>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                      {agentTickets
                        .filter(
                          (t) =>
                            t.status === 'printed_not_sold' ||
                            t.status === 'physical_allocated' ||
                            t.status === 'physical_printed'
                        )
                        .slice(0, 6)
                        .map((t) => (
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

            {/* MÉTHODE B : DÉCLARATION MANUELLE DU NOMBRE DE BILLETS VENDUS */}
            {saleMode === 'manual' && (
              <div className="space-y-4">
                <p className="text-xs text-amber-300 leading-relaxed p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                  Les billets sont désormais nominatifs : l'activation par lot anonyme est désactivée. Utilisez « Scan Billet Unique » et saisissez le nom et le téléphone de chaque client.
                </p>

                {/* Raccourcis de quantité */}
                <div className="space-y-2">
                  <div className="flex items-center justify-center gap-4 bg-black/40 p-3 rounded-2xl border border-white/5">
                    <button
                      type="button"
                      onClick={() => setSaleQuantity(Math.max(1, saleQuantity - 1))}
                      className="w-10 h-10 rounded-xl bg-[#2A2A2A] hover:bg-[#333] text-white flex items-center justify-center font-bold text-lg"
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    <div className="text-center">
                      <span className="font-heading font-black text-3xl text-[#E9C349] block">
                        {saleQuantity}
                      </span>
                      <span className="text-[10px] text-gray-400 font-bold uppercase">
                        billet(s) à activer
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSaleQuantity(Math.min(remainingTickets, saleQuantity + 1))}
                      className="w-10 h-10 rounded-xl bg-[#2A2A2A] hover:bg-[#333] text-white flex items-center justify-center font-bold text-lg"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex justify-center gap-2 pt-1">
                    {[1, 2, 5, 10, 20].map((q) => (
                      <button
                        key={q}
                        type="button"
                        disabled={q > remainingTickets}
                        onClick={() => setSaleQuantity(q)}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                          saleQuantity === q
                            ? 'bg-[#E9C349] text-[#241A00]'
                            : 'bg-white/5 text-gray-400 hover:text-white'
                        } disabled:opacity-30`}
                      >
                        +{q}
                      </button>
                    ))}
                  </div>

                  <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-xs flex justify-between items-center">
                    <span className="text-gray-400">Total Encaissé Estimé :</span>
                    <span className="font-heading font-black text-white text-sm">
                      {(saleQuantity * (agentTickets[0]?.price || 3500)).toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={true}
                  onClick={() => handleQuickAddSale(saleQuantity)}
                  className="w-full btn-gold-glow py-3.5 rounded-xl font-heading font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg opacity-40 cursor-not-allowed"
                >
                  <CheckCheck className="w-4 h-4 text-[#241A00]" />
                  <span>Activation par lot désactivée (billets nominatifs)</span>
                </button>
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
          <span className="text-xs font-mono text-gray-400">
            Total lot : {agentTickets.length} billet(s)
          </span>
        </div>

        {agentTickets.length === 0 ? (
          <p className="text-xs text-gray-500 py-4 text-center">
            Aucun billet n'a encore été attribué à ce guichet pour le moment.
          </p>
        ) : (
          <div className="overflow-x-auto">
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
                {agentTickets.map((t) => {
                  const isUnsold =
                    t.status === 'printed_not_sold' ||
                    t.status === 'physical_allocated' ||
                    t.status === 'physical_printed';
                  const isSoldValid = t.status === 'sold_valid' || t.status === 'physical_sold';
                  const isScanned = t.status === 'scanned' || t.status === 'used';
                  const isCancelled = t.status === 'cancelled';

                  return (
                    <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-white flex items-center gap-1.5">
                        <QrCode className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                        <span>{t.qrCode}</span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-300">{t.tierName}</td>
                      <td className="py-2.5 px-3 font-bold text-white">
                        {t.price.toLocaleString('fr-FR')} F
                      </td>
                      <td className="py-2.5 px-3">
                        {isUnsold && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Inactif (Non Vendu)
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
                              setManualTicketCode(t.qrCode);
                              handleCheckTicketForSale(t.qrCode);
                              setSaleMode('scan');
                              setShowSaleModal(true);
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
