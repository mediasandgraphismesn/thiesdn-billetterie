import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldCheck,
  Smartphone,
  Plus,
  Copy,
  Check,
  Send,
  ExternalLink,
  Power,
  Trash2,
  RefreshCw,
  QrCode,
  Users,
  Building,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { ScanStation, EventItem, OrderRecord, UserTicket } from '../types';
import {
  getStoredScanStations,
  fetchScanStationsFromSupabase,
  createScanStation,
  toggleScanStationStatus,
  deleteScanStation,
  getStoredOrders,
  getStoredTickets,
} from '../services/supabase';

interface ScanStationsViewProps {
  events?: EventItem[];
  defaultEventId?: string;
  promoterId?: string;
  promoterName?: string;
}

export const ScanStationsView: React.FC<ScanStationsViewProps> = ({
  events = [],
  defaultEventId,
  promoterId = 'prom-thiesdn',
  promoterName = 'Lat Dior Productions',
}) => {
  const [stations, setStations] = useState<ScanStation[]>(getStoredScanStations());
  const [selectedEventId, setSelectedEventId] = useState<string>(
    defaultEventId || (events[0]?.id ?? 'all')
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Formulaire d'ajout de poste
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStationName, setNewStationName] = useState('');
  const [newEventId, setNewEventId] = useState<string>(
    defaultEventId || (events[0]?.id ?? 'evt-soiree-prestige')
  );
  const [newStationNotes, setNewStationNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Données de ventes réelles pour calculer le ratio d'entrées
  const [orders] = useState<OrderRecord[]>(getStoredOrders());
  const [tickets] = useState<UserTicket[]>(getStoredTickets());

  const reloadStations = async () => {
    setIsRefreshing(true);
    const filterId = selectedEventId === 'all' ? undefined : selectedEventId;
    const res = await fetchScanStationsFromSupabase(filterId);
    if (res.stations && res.stations.length > 0) {
      setStations(res.stations);
    } else {
      setStations(getStoredScanStations());
    }
    setIsRefreshing(false);
  };

  useEffect(() => {
    reloadStations();
  }, [selectedEventId]);

  // Événement sélectionné
  const currentEvent = useMemo(() => {
    if (selectedEventId === 'all') return null;
    return events.find((e) => e.id === selectedEventId) || null;
  }, [events, selectedEventId]);

  // Filtrage des postes
  const filteredStations = useMemo(() => {
    if (selectedEventId === 'all') return stations;
    return stations.filter((s) => s.eventId === selectedEventId);
  }, [stations, selectedEventId]);

  // Statistiques globales consolidées (Étape 5)
  const stats = useMemo(() => {
    const list = filteredStations;
    const activeCount = list.filter((s) => s.isActive).length;
    const totalScans = list.reduce((sum, s) => sum + s.scansCount, 0);

    // Calcul du total des billets vendus pour cet événement ou globalement
    const relevantTickets = selectedEventId === 'all'
      ? tickets
      : tickets.filter((t) => t.eventId === selectedEventId);
    const totalSold = relevantTickets.length || 500;

    const fillRate = totalSold > 0 ? Math.min(100, Math.round((totalScans / totalSold) * 100)) : 0;

    return {
      totalStations: list.length,
      activeCount,
      totalScans,
      totalSold,
      fillRate,
    };
  }, [filteredStations, selectedEventId, tickets]);

  // Génération du lien de scan complet
  const getScanUrl = (accessCode: string) => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      return `${origin}/scan/${accessCode}`;
    }
    return `https://thiesdn-billetterie.vercel.app/scan/${accessCode}`;
  };

  // Copier le lien
  const handleCopyLink = (station: ScanStation) => {
    const url = getScanUrl(station.accessCode);
    navigator.clipboard.writeText(url);
    setCopiedCode(station.id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Envoi WhatsApp direct à l'agent de sécurité (wa.me)
  const handleSendWhatsApp = (station: ScanStation) => {
    const url = getScanUrl(station.accessCode);
    const message =
      `🛡️ *POSTE DE CONTRÔLE SÉCURITÉ — THIÈSDN BILLETTERIE*\n\n` +
      `Bonjour agent,\n` +
      `Voici votre lien d'accès exclusif pour scanner les billets et pass à votre poste :\n\n` +
      `📍 *Poste assigné :* ${station.name}\n` +
      `🎪 *Événement :* ${station.eventTitle}\n` +
      `🔑 *Code Poste :* ${station.accessCode}\n\n` +
      `🔗 *Lien direct de scan (aucun mot de passe requis) :*\n` +
      `${url}\n\n` +
      `📌 *Instructions :*\n` +
      `1. Ouvrez ce lien sur votre téléphone\n` +
      `2. Pointez l'appareil photo vers les QR codes des visiteurs\n` +
      `3. Validez les écrans verts. Refusez toute personne avec écran rouge (billet déjà scanné).\n\n` +
      `Bon service !`;

    const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  // Basculer l'état Actif / Inactif
  const handleToggleActive = async (station: ScanStation) => {
    const nextState = !station.isActive;
    await toggleScanStationStatus(station.id, nextState);
    setStations((prev) =>
      prev.map((s) => (s.id === station.id ? { ...s, isActive: nextState } : s))
    );
  };

  // Supprimer un poste
  const handleDeleteStation = async (station: ScanStation) => {
    if (confirm(`Voulez-vous vraiment supprimer le poste "${station.name}" ?`)) {
      await deleteScanStation(station.id);
      setStations((prev) => prev.filter((s) => s.id !== station.id));
    }
  };

  // Création d'un nouveau poste
  const handleCreateStation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStationName.trim()) return;

    setIsSubmitting(true);
    const targetEvent = events.find((ev) => ev.id === newEventId) || events[0];

    const res = await createScanStation({
      name: newStationName.trim(),
      eventId: targetEvent ? targetEvent.id : 'evt-soiree-prestige',
      eventTitle: targetEvent ? targetEvent.title : 'Nuit du Baobab Prestige',
      notes: newStationNotes.trim() || undefined,
      createdBy: promoterId,
      createdByName: promoterName,
    });

    setIsSubmitting(false);

    if (res.success && res.station) {
      setSuccessMessage(res.message);
      setStations((prev) => [res.station!, ...prev]);
      setNewStationName('');
      setNewStationNotes('');
      setTimeout(() => {
        setSuccessMessage(null);
        setShowAddModal(false);
      }, 1500);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      {/* HEADER COCKPIT POSTES DE CONTRÔLE */}
      <div className="glass-panel p-5 sm:p-6 rounded-3xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase bg-[#8A2BE2]/20 text-[#DCB8FF] border border-[#8A2BE2]/30 flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-[#E9C349]" />
              Scanners Multi-Entrées
            </span>
            <span className="text-xs text-gray-400">• Anti-Files d'Attente</span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-black text-white tracking-tight">
            Postes de Contrôle & Scanners Mobiles
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Générez des liens sécurisés par poste pour votre équipe de sécurité (sans compte admin)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {events.length > 0 && (
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="bg-[#1C1B1B] border border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-[#8A2BE2]"
            >
              <option value="all">Tous les événements</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.title}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={reloadStations}
            disabled={isRefreshing}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 transition-all flex items-center gap-1 text-xs"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#8A2BE2]' : ''}`} />
          </button>
        </div>
      </div>

      {/* 4 KPIS EN TEMPS RÉEL (CONSOLIDATION GLOBALE - ÉTAPE 5) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Postes Actifs */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-white/10 relative overflow-hidden">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Postes Configurés</span>
            <div className="p-2 rounded-xl bg-[#8A2BE2]/20 text-[#DCB8FF]">
              <Smartphone className="w-4 h-4" />
            </div>
          </div>
          <p className="font-heading text-2xl sm:text-3xl font-black text-white">
            {stats.activeCount} <span className="text-xs text-gray-400 font-normal">/ {stats.totalStations} actifs</span>
          </p>
          <p className="text-[11px] text-gray-400 mt-1">
            Agents en service aux portes
          </p>
        </div>

        {/* Total Entrées Validées */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-emerald-500/20 bg-emerald-950/10 relative overflow-hidden">
          <div className="flex items-center justify-between text-emerald-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Entrées Validées</span>
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="font-heading text-2xl sm:text-3xl font-black text-emerald-300">
            {stats.totalScans}
          </p>
          <p className="text-[11px] text-emerald-400/80 font-semibold mt-1">
            {stats.totalScans} entrées validées sur {stats.totalSold} billets
          </p>
        </div>

        {/* Taux de Remplissage Salle */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-[#E9C349]/30 bg-[#E9C349]/5 relative overflow-hidden">
          <div className="flex items-center justify-between text-[#E9C349] mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Taux de Remplissage</span>
            <div className="p-2 rounded-xl bg-[#E9C349]/20 text-[#E9C349]">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="font-heading text-2xl sm:text-3xl font-black text-[#E9C349]">
            {stats.fillRate}%
          </p>
          <p className="text-[11px] text-gray-400 mt-1">
            Spectateurs déjà à l'intérieur
          </p>
        </div>

        {/* Action Rapide Nouveau Poste */}
        <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-purple-500/20 bg-purple-950/10 relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-purple-300 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Déployer un Poste</span>
              <Plus className="w-4 h-4 text-[#8A2BE2]" />
            </div>
            <p className="text-xs text-gray-300 mt-1">
              Ajoutez un vigile ou un bénévole en 10 secondes
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-3 w-full py-2 px-3 rounded-xl btn-primary-glow font-heading font-extrabold text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Nouveau Poste
          </button>
        </div>
      </div>

      {/* LISTE DES POSTES DE CONTRÔLE */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-extrabold text-lg text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#8A2BE2]" />
            <span>Postes de Contrôle Déployés ({filteredStations.length})</span>
          </h2>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-1.5 rounded-xl bg-[#1C1B1B] hover:bg-[#252525] border border-white/10 text-white font-heading font-extrabold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-3.5 h-3.5 text-[#E9C349]" />
            Ajouter un Poste
          </button>
        </div>

        {filteredStations.length === 0 ? (
          <div className="glass-panel p-10 rounded-3xl border border-white/10 text-center space-y-4">
            <Smartphone className="w-12 h-12 text-gray-500 mx-auto" />
            <div>
              <h3 className="text-base font-bold text-white">Aucun poste de contrôle pour le moment</h3>
              <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                Créez votre première entrée pour donner à vos agents un lien de scan autonome.
              </p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary-glow px-4 py-2 rounded-xl text-xs font-bold uppercase"
            >
              Créer un premier poste
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStations.map((sta) => {
              const scanUrl = getScanUrl(sta.accessCode);
              return (
                <div
                  key={sta.id}
                  className={`glass-panel p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 shadow-xl ${
                    sta.isActive
                      ? 'border-white/10 hover:border-white/20'
                      : 'border-red-500/20 bg-red-950/5 opacity-75'
                  }`}
                >
                  {/* Haut de Carte : Nom & Statut */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              sta.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'
                            }`}
                          />
                          <span
                            className={`text-[10px] font-black uppercase tracking-wider ${
                              sta.isActive ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {sta.isActive ? 'Poste Actif' : 'Poste Désactivé'}
                          </span>
                        </div>
                        <h3 className="font-heading font-black text-lg text-white">
                          {sta.name}
                        </h3>
                        <p className="text-xs text-gray-400 font-medium">
                          {sta.eventTitle}
                        </p>
                      </div>

                      {/* Compteur Scans du Poste */}
                      <div className="text-right bg-black/40 px-3 py-1.5 rounded-xl border border-white/10">
                        <span className="text-[9px] uppercase font-bold text-gray-400 block">
                          Scans
                        </span>
                        <span className="font-mono text-xl font-black text-[#E9C349]">
                          {sta.scansCount}
                        </span>
                      </div>
                    </div>

                    {/* Code d'accès court */}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[10px] text-gray-400 uppercase font-bold">Code :</span>
                      <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 font-mono text-xs text-purple-300 font-bold">
                        {sta.accessCode}
                      </span>
                    </div>

                    {sta.notes && (
                      <p className="text-[11px] text-gray-400 italic">
                        {sta.notes}
                      </p>
                    )}
                  </div>

                  {/* Lien unique de scan */}
                  <div className="p-2.5 rounded-xl bg-black/50 border border-white/5 space-y-1.5">
                    <span className="text-[9px] uppercase font-bold text-gray-400 block">
                      Lien Mobile Unique :
                    </span>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] text-gray-300 truncate select-all">
                        {scanUrl}
                      </span>
                      <button
                        onClick={() => handleCopyLink(sta)}
                        className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-all shrink-0"
                        title="Copier le lien"
                      >
                        {copiedCode === sta.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Actions Rapides sur le Poste */}
                  <div className="space-y-2 pt-2 border-t border-white/10">
                    <div className="grid grid-cols-2 gap-2">
                      {/* Bouton WhatsApp direct */}
                      <button
                        onClick={() => handleSendWhatsApp(sta)}
                        className="py-2 px-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Send className="w-3.5 h-3.5" />
                        WhatsApp
                      </button>

                      {/* Bouton Ouvrir le Scanner */}
                      <a
                        href={`/scan/${sta.accessCode}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 px-3 rounded-xl bg-[#8A2BE2]/20 hover:bg-[#8A2BE2]/30 text-[#DCB8FF] border border-[#8A2BE2]/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-all text-center"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Ouvrir
                      </a>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      {/* Toggle Activer / Désactiver */}
                      <button
                        onClick={() => handleToggleActive(sta)}
                        className={`text-xs font-bold flex items-center gap-1.5 transition-all ${
                          sta.isActive
                            ? 'text-amber-400 hover:text-amber-300'
                            : 'text-emerald-400 hover:text-emerald-300'
                        }`}
                      >
                        <Power className="w-3.5 h-3.5" />
                        {sta.isActive ? 'Désactiver le poste' : 'Réactiver le poste'}
                      </button>

                      {/* Supprimer */}
                      <button
                        onClick={() => handleDeleteStation(sta)}
                        className="p-1 rounded-lg text-gray-500 hover:text-red-400 transition-all"
                        title="Supprimer ce poste"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* MODALE DE CRÉATION D'UN NOUVEAU POSTE DE CONTRÔLE                   */}
      {/* ==================================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-[#111111] border border-white/20 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 right-5 p-2 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 transition-all"
            >
              ✕
            </button>

            <div>
              <span className="text-[11px] font-black uppercase text-[#E9C349] tracking-wider">
                Sécurité & Accès
              </span>
              <h2 className="font-heading text-2xl font-black text-white mt-0.5">
                Nouveau Poste de Contrôle
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Génère un lien unique pour permettre à un agent de scanner sans login
              </p>
            </div>

            {successMessage && (
              <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-500 text-emerald-200 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                {successMessage}
              </div>
            )}

            <form onSubmit={handleCreateStation} className="space-y-4">
              {/* Choix Événement */}
              {events.length > 0 && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                    Événement concerné
                  </label>
                  <select
                    value={newEventId}
                    onChange={(e) => setNewEventId(e.target.value)}
                    className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#8A2BE2]"
                  >
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.title} ({ev.city})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Nom du Poste */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Nom du Poste de Contrôle *
                </label>
                <input
                  type="text"
                  required
                  value={newStationName}
                  onChange={(e) => setNewStationName(e.target.value)}
                  placeholder="Ex: Entrée Principale, Porte VIP, Tribune Ouest..."
                  className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#8A2BE2]"
                />
              </div>

              {/* Suggestions rapides de nom */}
              <div className="flex flex-wrap gap-1.5">
                {['Entrée Principale', 'Porte VIP & Loges', 'Entrée Presse & Staff', 'Tribune Sud'].map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setNewStationName(sug)}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-[10px] font-semibold border border-white/5"
                  >
                    + {sug}
                  </button>
                ))}
              </div>

              {/* Consignes ou Notes pour l'agent */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Consignes pour l'agent (Optionnel)
                </label>
                <input
                  type="text"
                  value={newStationNotes}
                  onChange={(e) => setNewStationNotes(e.target.value)}
                  placeholder="Ex: Vérifier le bracelet rouge après le scan"
                  className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#8A2BE2]"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 text-xs font-bold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-2/3 btn-primary-glow py-2.5 rounded-xl font-heading font-extrabold text-xs uppercase tracking-wider text-white flex items-center justify-center gap-2"
                >
                  {isSubmitting ? 'Création...' : 'Générer le Poste & Lien'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
