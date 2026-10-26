import React, { useState, useEffect } from 'react';
import {
  X,
  Printer,
  QrCode,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Download,
  Loader2,
  Sparkles,
  Layers,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { EventItem, TicketTier } from '../types';
import { generatePhysicalTicketsPdf } from '../services/pdfTicketGenerator';
import { generatePhysicalTicketBatch, getStoredTickets } from '../services/supabase';

interface PhysicalTicketsModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: EventItem | null;
}

export const PhysicalTicketsModal: React.FC<PhysicalTicketsModalProps> = ({
  isOpen,
  onClose,
  event,
}) => {
  const [selectedTierId, setSelectedTierId] = useState<string>('');
  const [ticketCount, setTicketCount] = useState<number>(50);
  const [pointOfSale, setPointOfSale] = useState<string>('Agence Thies Can');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialisation du tier par défaut dès que l'événement est injecté
  useEffect(() => {
    if (event?.tiers && event.tiers.length > 0) {
      setSelectedTierId(event.tiers[0].id);
    } else {
      setSelectedTierId('tier-default');
    }
    setSuccessMessage(null);
    setErrorMessage(null);
    setProgress(null);
  }, [event, isOpen]);

  if (!isOpen || !event) return null;

  const currentTier: TicketTier =
    event.tiers?.find((t) => t.id === selectedTierId) ||
    event.tiers?.[0] || {
      id: 'tier-standard',
      name: 'Standard',
      price: event.price || 5000,
      available: 500,
      total: 500,
    };

  const quickCounts = [5, 20, 50, 100, 250];

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ticketCount <= 0 || ticketCount > 1000) {
      setErrorMessage('Veuillez sélectionner un nombre de billets entre 1 et 1 000.');
      return;
    }

    setIsGenerating(true);
    setProgress({ current: 0, total: ticketCount });
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      // 1. Création du lot sécurisé en base / mémoire
      const res = await generatePhysicalTicketBatch(
        event,
        currentTier,
        ticketCount,
        event.promoter?.id || 'admin'
      );

      // Attribution du point de vente aux billets générés si renseigné
      const ticketsWithAgent = res.tickets.map((t) => ({
        ...t,
        agentName: pointOfSale || t.agentName || 'Agence Thies Can',
      }));

      // 2. Génération de la planche PDF A4 avec affiche en fond et repères de coupe
      const pdfBlob = await generatePhysicalTicketsPdf(event, currentTier, ticketsWithAgent, {
        batchName: res.tickets[0]?.batchNumber,
        onProgress: (current, total) => setProgress({ current, total }),
      });

      // 3. Déclenchement automatique du téléchargement
      const blobUrl = URL.createObjectURL(pdfBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      const cleanTitle = event.title.replace(/[^a-zA-Z0-9]/g, '_');
      const cleanTier = currentTier.name.replace(/[^a-zA-Z0-9]/g, '_');
      downloadLink.download = `Planche_A4_Billets_Physiques_${cleanTitle}_${cleanTier}_${ticketCount}pcs.pdf`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(blobUrl);

      setSuccessMessage(
        `Lot de ${res.tickets.length} billets physiques généré avec succès ! Le document PDF A4 prêt pour l'impression est téléchargé.`
      );
    } catch (err: any) {
      console.error('Erreur génération billets physiques:', err);
      setErrorMessage(
        err?.message || "Une erreur est survenue lors de la création de la planche PDF d'impression."
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-3xl bg-[#0D0C12] border border-[#8A2BE2]/40 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* En-tête de la Modale */}
        <div className="p-5 bg-[#14131A] border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#8A2BE2] to-[#A855F7] flex items-center justify-center text-white shadow-lg shadow-[#8A2BE2]/30">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-heading font-extrabold uppercase tracking-widest text-[#E9C349] block">
                Atelier Print & Guichet
              </span>
              <h3 className="font-heading font-extrabold text-base sm:text-lg text-white">
                Génération des Billets Physiques
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corps de la Modale */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Événement ciblé */}
          <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center gap-3.5">
            {event.posterUrl && (
              <img
                src={event.posterUrl}
                alt={event.title}
                className="w-14 h-14 rounded-xl object-cover shrink-0 border border-white/10"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Événement sélectionné
              </p>
              <h4 className="text-sm font-bold text-white truncate">{event.title}</h4>
              <p className="text-xs text-[#DCB8FF] flex items-center gap-1.5 mt-0.5">
                <span>{event.date}</span>
                <span>•</span>
                <span>{event.venue}</span>
              </p>
            </div>
          </div>

          {/* Formulaire de configuration */}
          <form onSubmit={handleGenerate} className="space-y-4">
            {/* 1. Sélection de la Formule / Catégorie */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#E9C349]" />
                <span>Formule / Catégorie de Billet *</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(event.tiers && event.tiers.length > 0
                  ? event.tiers
                  : [
                      {
                        id: 'tier-default',
                        name: 'Pass Standard',
                        price: event.price || 5000,
                        available: 100,
                        total: 100,
                      },
                    ]
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTierId(t.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedTierId === t.id
                        ? 'bg-[#8A2BE2]/20 border-[#8A2BE2] text-white shadow-md shadow-[#8A2BE2]/20'
                        : 'bg-black/30 border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs">{t.name}</span>
                      <span className="text-xs text-[#E9C349] font-black">
                        {t.price.toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Quantité de billets à imprimer */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                <QrCode className="w-3.5 h-3.5 text-[#E9C349]" />
                <span>Nombre de Billets à Générer *</span>
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {quickCounts.map((qty) => (
                  <button
                    key={qty}
                    type="button"
                    onClick={() => setTicketCount(qty)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      ticketCount === qty
                        ? 'bg-[#E9C349] text-[#241A00]'
                        : 'bg-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {qty} billets
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="1"
                max="1000"
                value={ticketCount}
                onChange={(e) => setTicketCount(parseInt(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white font-bold text-sm focus:outline-none focus:border-[#8A2BE2]"
              />
              <p className="text-[10px] text-gray-400">
                Imposition : 5 billets par page A4 (ex: {ticketCount} billets = {Math.ceil(ticketCount / 5)} page(s) A4)
              </p>
            </div>

            {/* 3. Point de Vente / Réseau Partenaire */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#E9C349]" />
                <span>Point de Vente / Mention Guichet</span>
              </label>
              <input
                type="text"
                value={pointOfSale}
                onChange={(e) => setPointOfSale(e.target.value)}
                placeholder="Ex: Agence Thies Can, Guichet Stade Lat Dior..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white text-xs focus:outline-none focus:border-[#8A2BE2]"
              />
            </div>

            {/* Messages de feedback */}
            {errorMessage && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Barre de progression pendant la génération */}
            {isGenerating && progress && (
              <div className="p-4 rounded-2xl bg-[#14131A] border border-[#8A2BE2]/40 space-y-2">
                <div className="flex items-center justify-between text-xs text-gray-300 font-bold">
                  <span className="flex items-center gap-2 text-[#DCB8FF]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8A2BE2]" />
                    Génération haute résolution en cours...
                  </span>
                  <span className="text-[#E9C349]">
                    {progress.current} / {progress.total}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#8A2BE2] to-[#E9C349] transition-all duration-150"
                    style={{
                      width: `${Math.round((progress.current / progress.total) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Bouton de soumission */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isGenerating || ticketCount <= 0}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#8A2BE2] via-[#9d4edd] to-[#E9C349] text-white font-heading font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-[#8A2BE2]/25 hover:opacity-95 transition-all disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Création du PDF A4 en cours...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Générer et Télécharger la Planche PDF</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#14131A] border-t border-white/10 flex items-center justify-between text-xs text-gray-400 shrink-0">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Format vectoriel offset 5 billets / page A4</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
