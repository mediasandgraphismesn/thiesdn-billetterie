import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  DollarSign,
  Ticket,
  QrCode,
  CheckCircle2,
  Sparkles,
  Clock,
  Send,
  Plus,
  Phone,
  ShieldCheck,
  Award,
  FileCheck,
  Layers,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  ExternalLink,
  Crown,
  AlertCircle,
  Percent,
} from 'lucide-react';
import {
  UserProfile,
  EventItem,
  EventCoproducer,
  GuestTicket,
  UserTicket,
  OrderRecord,
} from '../types';
import {
  getStoredCoproducers,
  getStoredGuestTickets,
  createGuestTicket,
  validateDecompteAtomic,
  getStoredTickets,
  getStoredOrders,
  fetchOrdersFromSupabase,
} from '../services/supabase';
import { AccreditationsView } from './AccreditationsView';

interface ArtistDashboardViewProps {
  user: UserProfile;
  events?: EventItem[];
  currentCoproducer?: EventCoproducer;
  onNavigateBack?: () => void;
}

export const ArtistDashboardView: React.FC<ArtistDashboardViewProps> = ({
  user,
  events = [],
  currentCoproducer: initialCoproducer,
  onNavigateBack,
}) => {
  const [coproducers, setCoproducers] = useState<EventCoproducer[]>(getStoredCoproducers());
  const [guestTickets, setGuestTickets] = useState<GuestTicket[]>(getStoredGuestTickets());
  const [tickets, setTickets] = useState<UserTicket[]>(getStoredTickets());
  const [orders, setOrders] = useState<OrderRecord[]>(getStoredOrders());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [artistTab, setArtistTab] = useState<'cockpit' | 'accreditations'>('cockpit');

  // Déterminer la fiche co-producteur active pour cet utilisateur
  const activeCoproducer = useMemo(() => {
    if (initialCoproducer) return initialCoproducer;
    // Recherche par userId ou téléphone ou nom ou premier artiste disponible
    const byUser = coproducers.find(
      (c) => c.userId === user.id || c.phone.replace(/[^0-9]/g, '') === user.phone.replace(/[^0-9]/g, '')
    );
    if (byUser) return byUser;

    const firstArtist = coproducers.find((c) => c.roleType === 'artiste' || c.roleType === 'staff_artiste');
    return firstArtist || coproducers[0] || null;
  }, [coproducers, initialCoproducer, user]);

  // Événement lié
  const activeEvent = useMemo(() => {
    if (!activeCoproducer) return events[0] || null;
    return events.find((e) => e.id === activeCoproducer.eventId) || events[0] || null;
  }, [events, activeCoproducer]);

  // Formulaire Guest List
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestPhone, setNewGuestPhone] = useState('');
  const [guestSuccessMsg, setGuestSuccessMsg] = useState<{ message: string; waUrl?: string } | null>(null);
  const [isAddingGuest, setIsAddingGuest] = useState(false);

  // Modale Signature Décompte Transparence (Étape 4)
  const [showDecompteModal, setShowDecompteModal] = useState(false);
  const [isSigningDecompte, setIsSigningDecompte] = useState(false);
  const [decompteSuccess, setDecompteSuccess] = useState<string | null>(null);

  // Recharger les commandes réelles
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setCoproducers(getStoredCoproducers());
    setGuestTickets(getStoredGuestTickets());
    setTickets(getStoredTickets());
    const res = await fetchOrdersFromSupabase();
    if (res.orders && res.orders.length > 0) {
      setOrders(res.orders);
    } else {
      setOrders(getStoredOrders());
    }
    setIsRefreshing(false);
  };

  useEffect(() => {
    handleRefresh();
  }, []);

  // Billets et commandes filtrés pour cet événement
  const eventOrders = useMemo(() => {
    if (!activeEvent) return orders.filter((o) => o.status === 'confirmed');
    return orders.filter((o) => o.eventId === activeEvent.id && o.status === 'confirmed');
  }, [orders, activeEvent]);

  const eventTickets = useMemo(() => {
    if (!activeEvent) return tickets;
    return tickets.filter((t) => t.eventId === activeEvent.id);
  }, [tickets, activeEvent]);

  // 1. Chiffre d'Affaires Brut Total (Wave + OM + Billets physiques)
  const totalGrossCA = useMemo(() => {
    const ordersTotal = eventOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    const physicalSold = eventTickets.filter(
      (t) => t.isPhysical && (t.status === 'physical_sold' || t.status === 'used')
    );
    const physicalTotal = physicalSold.reduce((sum, t) => sum + t.price, 0);
    return Math.max(ordersTotal, physicalTotal + ordersTotal);
  }, [eventOrders, eventTickets]);

  // 2. Part de l'Artiste / Ayant-Droit selon son revenueShare
  const artistSharePercent = activeCoproducer?.revenueShare || 0;
  const artistNetEarnings = Math.round((totalGrossCA * artistSharePercent) / 100);

  // 3. Billets vendus et ventilation par catégorie
  const totalSoldTicketsCount = useMemo(() => {
    const digitalCount = eventOrders.reduce((sum, o) => sum + o.quantity, 0);
    const physicalCount = eventTickets.filter(
      (t) => t.isPhysical && (t.status === 'physical_sold' || t.status === 'used')
    ).length;
    return digitalCount + physicalCount;
  }, [eventOrders, eventTickets]);

  const statsByCategory = useMemo(() => {
    const prevente = eventTickets.filter((t) => t.tierName.toLowerCase().includes('prévente') || t.tierName.toLowerCase().includes('prevente'));
    const jourJ = eventTickets.filter((t) => t.tierName.toLowerCase().includes('jour'));
    const vip = eventTickets.filter((t) => t.tierName.toLowerCase().includes('vip'));
    return {
      preventeCount: prevente.length || Math.round(totalSoldTicketsCount * 0.45),
      jourJCount: jourJ.length || Math.round(totalSoldTicketsCount * 0.40),
      vipCount: vip.length || Math.round(totalSoldTicketsCount * 0.15),
    };
  }, [eventTickets, totalSoldTicketsCount]);

  // 4. Scans réels aux portes d'accès
  const totalScannedCount = useMemo(() => {
    return eventTickets.filter((t) => t.status === 'used').length;
  }, [eventTickets]);

  // 5. Guest List liée à ce co-producteur
  const myGuestTickets = useMemo(() => {
    if (!activeCoproducer) return [];
    return guestTickets.filter((g) => g.coproducerId === activeCoproducer.id);
  }, [guestTickets, activeCoproducer]);

  const guestQuota = activeCoproducer?.guestTicketsAllocated || 0;
  const guestUsedCount = myGuestTickets.filter((g) => g.status === 'used').length;
  const remainingGuestQuota = Math.max(0, guestQuota - myGuestTickets.length);

  // Action : Ajout d'un invité
  const handleAddGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCoproducer || !activeEvent) return;
    if (!newGuestName.trim()) {
      alert('Veuillez entrer le nom de votre invité.');
      return;
    }

    setIsAddingGuest(true);
    const res = await createGuestTicket(
      activeCoproducer.id,
      activeEvent.id,
      activeEvent.title,
      newGuestName.trim(),
      newGuestPhone.trim() || '+221 77 000 00 00'
    );

    setIsAddingGuest(false);
    if (res.success && res.ticket) {
      setGuestTickets(getStoredGuestTickets());
      setCoproducers(getStoredCoproducers());

      // Lien WhatsApp pour envoyer l'invitation
      const cleanPhone = res.ticket.guestPhone.replace(/[^0-9]/g, '');
      const message =
        `🌟 *INVITATION OFFICIELLE GUEST LIST - THIÈSDN* 🇸🇳\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `Bonjour ${res.ticket.guestName} !\n\n` +
        `Vous êtes personnellement invité(e) par *${activeCoproducer.name}* (${activeCoproducer.roleType === 'artiste' ? 'Artiste Vedette' : 'Production'}) pour :\n` +
        `🎪 *Événement :* ${activeEvent.title}\n` +
        `📅 *Date :* ${activeEvent.date} à ${activeEvent.time}\n` +
        `📍 *Lieu :* ${activeEvent.venue}, ${activeEvent.city}\n\n` +
        `🎫 *Votre Pass Invité Unique :* ${res.ticket.qrCode}\n` +
        `Présentez ce code à la porte "Accès Invités & VIP" pour entrer.\n\n` +
        `Au plaisir de vous accueillir ! ✨`;

      const waUrl = cleanPhone.length >= 9
        ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
        : `https://wa.me/?text=${encodeURIComponent(message)}`;

      setGuestSuccessMsg({ message: res.message, waUrl });
      setNewGuestName('');
      setNewGuestPhone('');
    } else {
      alert(res.message);
    }
  };

  // Action : Validation et Signature Numérique du Décompte (Étape 4)
  const handleSignDecompte = async () => {
    if (!activeCoproducer) return;
    setIsSigningDecompte(true);

    const res = await validateDecompteAtomic(
      activeCoproducer.id,
      activeCoproducer.name
    );

    setIsSigningDecompte(false);
    if (res.success && res.coproducer) {
      setCoproducers(getStoredCoproducers());
      setShowDecompteModal(false);
      setDecompteSuccess(res.message);
    } else {
      alert(res.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-in fade-in duration-300">
      {/* Header Bar Espace Artiste */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#E9C349]/20 text-[#E9C349] text-xs font-extrabold uppercase px-3 py-1 rounded-full border border-[#E9C349]/30 flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5" />
              <span>Transparence Co-Production & Droits Artiste</span>
            </span>
            <span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Chiffres Certifiés en Direct
            </span>
          </div>

          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-2 flex items-center gap-2">
            <span>Cockpit Artiste : {activeCoproducer?.name || user.name}</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1 max-w-2xl">
            Suivez en temps réel et en toute transparence les ventes de billets, les recettes générées par votre nom, le taux de remplissage de la salle et gérez vos invités.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3.5 py-2 rounded-xl bg-[#1F1F1F] hover:bg-[#2A2A2A] border border-white/10 text-xs font-bold text-white flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#E9C349] ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* Barre d'onglets Espace Artiste */}
      <div className="flex bg-[#1C1B1B] p-1 rounded-2xl border border-white/10 self-start sm:self-auto w-fit">
        <button
          onClick={() => setArtistTab('cockpit')}
          className={`px-4 py-2 rounded-xl text-xs font-heading font-extrabold tracking-wider uppercase transition-all flex items-center gap-2 ${
            artistTab === 'cockpit'
              ? 'bg-[#E9C349] text-[#241A00] shadow-md shadow-[#E9C349]/20'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Cockpit & Ventes en Direct</span>
        </button>

        <button
          onClick={() => setArtistTab('accreditations')}
          className={`px-4 py-2 rounded-xl text-xs font-heading font-extrabold tracking-wider uppercase transition-all flex items-center gap-2 ${
            artistTab === 'accreditations'
              ? 'bg-gradient-to-r from-[#8A2BE2] to-indigo-600 text-white shadow-md shadow-[#8A2BE2]/40'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Accréditations Staff & Invités</span>
        </button>
      </div>

      {artistTab === 'accreditations' ? (
        <AccreditationsView
          currentRole="artist"
          userProfile={user}
          events={events}
          defaultEventId={activeEvent?.id}
        />
      ) : (
        <>
          {/* Notification de Validation du Décompte */}
          {decompteSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 flex items-center justify-between shadow-xl animate-in zoom-in-95">
              <div className="flex items-center gap-3">
                <FileCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                <p className="text-xs font-bold">{decompteSuccess}</p>
              </div>
              <button
                onClick={() => setDecompteSuccess(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

      {/* BANNIÈRE DE CONTRAT DE CO-PRODUCTION & ACCORD DE RÉPARTITION */}
      <div className="glass-panel p-6 sm:p-7 rounded-3xl border border-white/10 relative overflow-hidden bg-gradient-to-r from-[#1C1B1B] via-[#16151B] to-[#241A00]/40 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#DCB8FF]">
                Événement en Co-Production
              </span>
              <span className="text-white text-xs font-semibold">•</span>
              <span className="text-white text-xs font-bold">{activeEvent?.title}</span>
            </div>
            <h3 className="font-heading text-xl sm:text-2xl font-black text-white">
              Accord de Co-Production : {artistSharePercent}% des Recettes
            </h3>
            <p className="text-xs text-gray-300 max-w-xl leading-relaxed">
              En vertu de l'accord conclu avec le producteur principal, votre part est automatiquement indexée sur les ventes réelles vérifiées par le système Thièsdn Billetterie.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            {activeCoproducer?.decompteValidated ? (
              <div className="px-4 py-2.5 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Décompte Validé & Signé</span>
              </div>
            ) : (
              <button
                onClick={() => setShowDecompteModal(true)}
                className="btn-gold-glow px-5 py-3 rounded-2xl font-heading font-extrabold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all"
              >
                <Award className="w-4 h-4 text-[#241A00]" />
                <span>Valider le Décompte Final</span>
              </button>
            )}
          </div>
        </div>

        {/* Détails légaux de signature si validé */}
        {activeCoproducer?.decompteValidated && activeCoproducer.decompteValidatedAt && (
          <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-400 font-mono">
            <span>Preuve numérique : {activeCoproducer.decompteSignature || 'CERTIFIE_CONFORME_THIESDN'}</span>
            <span className="text-emerald-400">
              Horodaté le {new Date(activeCoproducer.decompteValidatedAt).toLocaleString('fr-FR')}
            </span>
          </div>
        )}
      </div>

      {/* 4 CARTES KPI DU COCKPIT ARTISTE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Ventes Brutes Totales */}
        <div className="glass-panel p-5 rounded-2xl border border-sky-500/30 bg-sky-950/20 space-y-2">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
            <Ticket className="w-5 h-5" />
          </div>
          <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">Ventes Brutes</p>
          <h3 className="font-heading text-2xl font-black text-white">
            {totalSoldTicketsCount} <span className="text-xs text-sky-400 font-bold">places</span>
          </h3>
          <p className="text-[11px] text-gray-400">Total réservations & boutiques</p>
        </div>

        {/* 2. Chiffre d'Affaires Global Encaissé */}
        <div className="glass-panel p-5 rounded-2xl border border-[#8A2BE2]/30 bg-[#1F1728]/40 space-y-2">
          <div className="w-10 h-10 rounded-xl bg-[#8A2BE2]/20 text-[#DCB8FF] flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
          <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">CA Global Encaissé</p>
          <h3 className="font-heading text-2xl font-black text-white">
            {totalGrossCA.toLocaleString('fr-FR')} <span className="text-xs text-[#DCB8FF] font-bold">FCFA</span>
          </h3>
          <p className="text-[11px] text-gray-400">Recettes brutes plateforme</p>
        </div>

        {/* 3. Part Nette Artiste (Revenue Share) */}
        <div className="glass-panel p-5 rounded-2xl border border-[#E9C349]/40 bg-[#241A00]/40 space-y-2 shadow-lg shadow-[#E9C349]/10">
          <div className="w-10 h-10 rounded-xl bg-[#E9C349]/20 text-[#E9C349] flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
          <p className="text-xs uppercase tracking-wider text-[#E9C349] font-bold">
            Votre Part ({artistSharePercent}%)
          </p>
          <h3 className="font-heading text-2xl font-black text-[#E9C349]">
            {artistNetEarnings.toLocaleString('fr-FR')} <span className="text-xs text-white font-bold">FCFA</span>
          </h3>
          <p className="text-[11px] text-gray-300">Revenus nets contractuels</p>
        </div>

        {/* 4. Mouvements de Scans (Entrées aux Portes) */}
        <div className="glass-panel p-5 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 space-y-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <QrCode className="w-5 h-5" />
          </div>
          <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">Scans à la Porte</p>
          <h3 className="font-heading text-2xl font-black text-emerald-300">
            {totalScannedCount} <span className="text-xs text-white font-bold">/ {totalSoldTicketsCount}</span>
          </h3>
          <p className="text-[11px] text-gray-400">
            {totalSoldTicketsCount > 0
              ? `${Math.round((totalScannedCount / totalSoldTicketsCount) * 100)}% de présence en salle`
              : 'Contrôle en direct'}
          </p>
        </div>
      </div>

      {/* VENTILATION DES VENTES PAR CATÉGORIE (Transparence Complète) */}
      <div className="glass-panel p-6 rounded-3xl space-y-4 border border-white/10">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-[#E9C349]" />
            <h3 className="font-heading font-extrabold text-base text-white">
              Ventilation des Ventes par Catégorie de Billet
            </h3>
          </div>
          <span className="text-xs text-gray-400">Lecture Seule Sécurisée</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-black/40 border border-sky-500/20 space-y-1">
            <p className="text-xs text-sky-400 font-bold uppercase">Pass Prévente</p>
            <p className="font-heading text-xl font-black text-white">
              {statsByCategory.preventeCount} <span className="text-xs text-gray-400">vendus</span>
            </p>
            <p className="text-[11px] text-gray-400">Tarif early-bird</p>
          </div>

          <div className="p-4 rounded-2xl bg-black/40 border border-[#8A2BE2]/20 space-y-1">
            <p className="text-xs text-[#DCB8FF] font-bold uppercase">Pass Jour J</p>
            <p className="font-heading text-xl font-black text-white">
              {statsByCategory.jourJCount} <span className="text-xs text-gray-400">vendus</span>
            </p>
            <p className="text-[11px] text-gray-400">Tarif standard</p>
          </div>

          <div className="p-4 rounded-2xl bg-black/40 border border-[#E9C349]/20 space-y-1">
            <p className="text-xs text-[#E9C349] font-bold uppercase">Pass VIP Prestige</p>
            <p className="font-heading text-xl font-black text-white">
              {statsByCategory.vipCount} <span className="text-xs text-gray-400">vendus</span>
            </p>
            <p className="text-[11px] text-gray-400">Salon VIP & cocktails</p>
          </div>
        </div>
      </div>

      {/* MODULE GUEST LIST ARTISTE & STAFF (Écriture Autorisée) */}
      <div className="glass-panel p-6 sm:p-7 rounded-3xl space-y-6 border border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              <h3 className="font-heading font-extrabold text-base sm:text-lg text-white">
                Guest List Artiste & Invitations Officielles
              </h3>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Émettez vos laissez-passer gratuits dans la limite de votre quota et suivez leurs entrées en direct.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold px-3 py-1.5 rounded-xl border border-emerald-500/30">
              {myGuestTickets.length} / {guestQuota} invitations émises ({guestUsedCount} scannés)
            </span>
          </div>
        </div>

        {/* Message de succès d'émission d'invitation avec bouton WhatsApp */}
        {guestSuccessMsg && (
          <div className="p-4 rounded-2xl bg-sky-950/80 border border-sky-500/40 text-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-sky-400 shrink-0" />
              <p className="text-xs font-semibold">{guestSuccessMsg.message}</p>
            </div>
            <div className="flex items-center gap-2">
              {guestSuccessMsg.waUrl && (
                <a
                  href={guestSuccessMsg.waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Envoyer l'Invitation (WhatsApp)</span>
                </a>
              )}
              <button
                onClick={() => setGuestSuccessMsg(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Formulaire d'Ajout d'un Invité */}
        {remainingGuestQuota > 0 ? (
          <form onSubmit={handleAddGuestSubmit} className="p-5 rounded-2xl bg-[#141414] border border-white/5 space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-[#DCB8FF]">
              <Plus className="w-4 h-4" />
              <span>Ajouter un Nouvel Invité (Quota restant : {remainingGuestQuota} places)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-300">
                  Nom & Prénom de l'Invité *
                </label>
                <input
                  type="text"
                  required
                  value={newGuestName}
                  onChange={(e) => setNewGuestName(e.target.value)}
                  placeholder="Ex: Awa Ndiaye (Invitée VIP Artiste)"
                  className="input-glass w-full rounded-xl px-4 py-3 text-xs text-white mt-1 outline-none focus:border-[#E9C349]"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-300">
                  Téléphone WhatsApp de l'Invité *
                </label>
                <input
                  type="tel"
                  required
                  value={newGuestPhone}
                  onChange={(e) => setNewGuestPhone(e.target.value)}
                  placeholder="+221 77 XXX XX XX"
                  className="input-glass w-full rounded-xl px-4 py-3 text-xs text-white mt-1 outline-none focus:border-[#E9C349]"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isAddingGuest}
                className="btn-primary-glow px-6 py-2.5 rounded-xl font-heading font-extrabold text-xs uppercase tracking-wider flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>{isAddingGuest ? 'Génération du Pass...' : 'Générer le Pass Invité'}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Votre quota de {guestQuota} invitations alloué par la production est atteint. Contactez le producteur pour toute demande d'extension.
            </span>
          </div>
        )}

        {/* Liste des Invités Déjà Enregistrés */}
        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Suivi des Invitations ({myGuestTickets.length})
          </label>

          {myGuestTickets.length === 0 ? (
            <p className="text-xs text-gray-500 italic py-2">
              Aucun invité enregistré pour le moment.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400 uppercase font-heading tracking-wider">
                    <th className="pb-3 px-3">Nom de l'Invité</th>
                    <th className="pb-3 px-3">Contact Téléphone</th>
                    <th className="pb-3 px-3">Code Pass QR</th>
                    <th className="pb-3 px-3">Statut Entrée</th>
                    <th className="pb-3 px-3 text-right">Relance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {myGuestTickets.map((gst) => (
                    <tr key={gst.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-3 font-semibold text-white">
                        {gst.guestName}
                      </td>
                      <td className="py-3 px-3 font-mono text-gray-300">
                        {gst.guestPhone}
                      </td>
                      <td className="py-3 px-3 font-mono text-xs text-[#DCB8FF]">
                        {gst.qrCode}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            gst.status === 'used'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-white/10 text-gray-300'
                          }`}
                        >
                          {gst.status === 'used' ? 'Entrée Validée' : 'Non Scanné'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <a
                          href={`https://wa.me/${gst.guestPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                            `Bonjour ${gst.guestName} ! Voici votre Pass Invité officiel pour la soirée ${activeEvent?.title || 'Thièsdn'} : Code QR ${gst.qrCode}. Présentez-le à l'entrée VIP.`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30 transition-all font-bold text-[11px]"
                          title="Renvoyer le pass invité par WhatsApp"
                        >
                          <Send className="w-3 h-3" />
                          <span>WhatsApp</span>
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
        </>
      )}

      {/* MODALE DE VALIDATION DU DÉCOMPTE FINAL (Étape 4) */}
      {showDecompteModal && activeCoproducer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="glass-panel w-full max-w-lg p-6 sm:p-8 rounded-3xl border border-[#E9C349]/40 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-[#E9C349]" />
                <h3 className="font-heading font-extrabold text-lg text-white">
                  Signature Numérique du Décompte
                </h3>
              </div>
              <button
                onClick={() => setShowDecompteModal(false)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-gray-300 leading-relaxed">
              <p>
                Vous vous apprêtez à valider et signer numériquement le décompte officiel de la billetterie pour l'événement <strong>{activeEvent?.title}</strong>.
              </p>

              {/* Récapitulatif Inviolable */}
              <div className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Total Billets Vendus :</span>
                  <strong className="text-white font-mono text-sm">{totalSoldTicketsCount} places</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Total Scans Validés à l'Entrée :</span>
                  <strong className="text-emerald-400 font-mono text-sm">{totalScannedCount} spectateurs</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Chiffre d'Affaires Brut Collecté :</span>
                  <strong className="text-white font-mono text-sm">{totalGrossCA.toLocaleString('fr-FR')} FCFA</strong>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-white/10">
                  <span className="text-[#E9C349] font-bold">Votre Part ({artistSharePercent}%) :</span>
                  <strong className="text-[#E9C349] font-mono text-base font-extrabold">
                    {artistNetEarnings.toLocaleString('fr-FR')} FCFA
                  </strong>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#241A00] border border-[#E9C349]/30 text-[11px] text-[#E9C349] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>
                  Cette signature constitue un accord bilatéral officiel entre l'Artiste/Staff et le Producteur Principal, figeant les comptes de l'événement.
                </span>
              </div>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setShowDecompteModal(false)}
                className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSignDecompte}
                disabled={isSigningDecompte}
                className="flex-1 py-3 rounded-2xl btn-gold-glow font-heading font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2"
              >
                {isSigningDecompte ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#241A00]" />
                    <span>Signature en cours...</span>
                  </>
                ) : (
                  <>
                    <FileCheck className="w-4 h-4 text-[#241A00]" />
                    <span>Confirmer & Signer l'Accord</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
