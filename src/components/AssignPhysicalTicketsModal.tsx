import React, { useState, useEffect, useMemo } from 'react';
import { Truck, X, AlertCircle, Loader2 } from 'lucide-react';
import { EventItem, SalesAgent, UserTicket } from '../types';

export interface AssignPhysicalTicketsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: SalesAgent[];
  selectedAgent: SalesAgent | null;
  onSelectAgent: (agent: SalesAgent | null) => void;
  events: EventItem[];
  selectedEventId: string;
  onSelectEventId: (eventId: string) => void;
  activeEvent: EventItem | null;
  assignTierName: string;
  onChangeTierName: (tierName: string) => void;
  unassignedPhysicalTickets: UserTicket[];
  onSubmit: (quantity: number) => Promise<void>;
  isAssigning: boolean;
}

export const AssignPhysicalTicketsModal: React.FC<AssignPhysicalTicketsModalProps> = ({
  isOpen,
  onClose,
  agents,
  selectedAgent,
  onSelectAgent,
  events,
  selectedEventId,
  onSelectEventId,
  activeEvent,
  assignTierName,
  onChangeTierName,
  unassignedPhysicalTickets,
  onSubmit,
  isAssigning,
}) => {
  // État numérique de la quantité saisie (valeur par défaut : 50)
  const [quantity, setQuantity] = useState<number>(50);

  // Liste consolidée de tous les types de billets disponibles
  const availableTiers = useMemo(() => {
    const tierMap = new Map<string, { name: string; price: number; inStock: number }>();

    // 1. Paliers configurés sur l'événement actif
    if (activeEvent?.tiers && activeEvent.tiers.length > 0) {
      for (const t of activeEvent.tiers) {
        const inStock = unassignedPhysicalTickets.filter(
          (tk) => (tk.tierName || '').trim().toLowerCase() === t.name.trim().toLowerCase()
        ).length;
        tierMap.set(t.name.trim().toLowerCase(), { name: t.name, price: t.price, inStock });
      }
    }

    // 2. Paliers présents dans les billets physiques en réserve
    for (const tk of unassignedPhysicalTickets) {
      const name = tk.tierName || 'Pass Prévente Thiès';
      const key = name.trim().toLowerCase();
      if (!tierMap.has(key)) {
        const inStock = unassignedPhysicalTickets.filter(
          (t) => (t.tierName || '').trim().toLowerCase() === key
        ).length;
        tierMap.set(key, { name, price: tk.price || 3000, inStock });
      }
    }

    // Fallback par défaut si vide
    if (tierMap.size === 0) {
      tierMap.set('standard', { name: 'Pass Prévente Thiès', price: 3000, inStock: unassignedPhysicalTickets.length });
    }

    return Array.from(tierMap.values());
  }, [activeEvent, unassignedPhysicalTickets]);

  // Stock disponible en réserve pour le palier sélectionné
  const stockDisponible = useMemo(() => {
    if (!assignTierName) {
      return unassignedPhysicalTickets.length;
    }
    const cleanAssign = assignTierName.trim().toLowerCase();
    const count = unassignedPhysicalTickets.filter((t) => {
      const cleanT = (t.tierName || '').trim().toLowerCase();
      return cleanT === cleanAssign;
    }).length;

    // Si aucun billet ne correspond exactement au nom mais qu'il n'y a qu'un palier unique dans la réserve
    if (count === 0 && unassignedPhysicalTickets.length > 0 && availableTiers.length === 1) {
      return unassignedPhysicalTickets.length;
    }

    return count;
  }, [unassignedPhysicalTickets, assignTierName, availableTiers]);

  // Auto-sélection intelligente du premier palier disposant de stock à l'ouverture
  useEffect(() => {
    if (isOpen && availableTiers.length > 0) {
      const currentTierHasStock = availableTiers.some(
        (t) => t.name.trim().toLowerCase() === (assignTierName || '').trim().toLowerCase() && t.inStock > 0
      );
      if (!currentTierHasStock) {
        const tierWithStock = availableTiers.find((t) => t.inStock > 0);
        if (tierWithStock) {
          onChangeTierName(tierWithStock.name);
        } else if (!assignTierName) {
          onChangeTierName(availableTiers[0].name);
        }
      }
    }
  }, [isOpen, availableTiers, assignTierName, onChangeTierName]);

  // Réinitialiser la quantité à 50 (ou au stock disponible si inférieur) à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setQuantity(50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Gestion du changement de valeur : parseInt(e.target.value) || 0
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    if (rawVal === '') {
      setQuantity(0);
      return;
    }
    const val = parseInt(rawVal, 10);
    setQuantity(isNaN(val) ? 0 : Math.max(0, val));
  };

  // Validation dynamique à chaque modification
  const validationError = useMemo(() => {
    if (quantity <= 0) {
      return 'Veuillez saisir une quantité valide (au moins 1 billet).';
    }
    if (stockDisponible <= 0) {
      return 'Aucun billet physique disponible en réserve pour ce palier. Veuillez d’abord générer des billets physiques.';
    }
    if (quantity > stockDisponible) {
      return `La quantité demandée (${quantity}) dépasse le stock disponible en réserve (${stockDisponible} billets).`;
    }
    return null;
  }, [quantity, stockDisponible]);

  // État de validité du formulaire
  const isFormValid = Boolean(
    selectedAgent &&
    quantity > 0 &&
    stockDisponible > 0 &&
    quantity <= stockDisponible &&
    !isAssigning
  );

  // Soumission du formulaire
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAgent) {
      return;
    }

    if (quantity <= 0) {
      return;
    }

    if (stockDisponible <= 0 || quantity > stockDisponible) {
      return;
    }

    await onSubmit(quantity);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="glass-panel w-full max-w-md p-6 sm:p-8 rounded-3xl border border-white/20 shadow-2xl space-y-5 bg-[#0a0a0a]">
        {/* En-tête de la modale */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-sky-400" />
            <h3 className="font-heading font-extrabold text-lg text-white">
              Attribuer des Billets Physiques
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Choix de l'Agent / Point de Vente */}
          {agents.length === 0 ? (
            <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>Aucun point de vente n'est encore enregistré. Veuillez d'abord ajouter un point de vente.</span>
            </div>
          ) : (
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-300 block mb-1">
                Point de Vente Destinataire
              </label>
              <select
                value={selectedAgent?.id || ''}
                onChange={(e) => {
                  const ag = agents.find((a) => a.id === e.target.value) || null;
                  onSelectAgent(ag);
                }}
                className="w-full bg-[#1A1A1A] border border-white/15 rounded-2xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[#E9C349] cursor-pointer"
              >
                <option value="" disabled>-- Choisir le point de vente --</option>
                {agents.map((ag) => (
                  <option key={ag.id} value={ag.id} className="bg-[#1C1B1B] text-white">
                    🏪 {ag.pointDeVente} ({ag.gerantName} - {ag.quartier})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Choix du Type de Billet (Palier) */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-300 flex justify-between mb-1">
              <span>Type de Billet à Distribuer</span>
              <span className={`font-mono text-[11px] font-bold ${stockDisponible > 0 ? 'text-sky-400' : 'text-amber-400'}`}>
                {stockDisponible} en réserve
              </span>
            </label>
            <select
              value={assignTierName}
              onChange={(e) => onChangeTierName(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-white/15 rounded-2xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-[#E9C349] cursor-pointer"
            >
              {availableTiers.map((t) => (
                <option key={t.name} value={t.name} className="bg-[#1C1B1B] text-white">
                  🎫 {t.name} — {t.price.toLocaleString('fr-FR')} FCFA ({t.inStock} en réserve)
                </option>
              ))}
            </select>
          </div>

          {/* Choix de l'Événement */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-gray-300 block mb-1">
              Événement Concerné
            </label>
            <select
              value={selectedEventId}
              onChange={(e) => onSelectEventId(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-white/15 rounded-2xl px-4 py-2 text-xs font-medium text-white outline-none focus:border-[#E9C349] cursor-pointer"
            >
              {events.map((evt) => (
                <option key={evt.id} value={evt.id} className="bg-[#1C1B1B] text-white">
                  🎟️ {evt.title} ({evt.city})
                </option>
              ))}
            </select>
          </div>

          {/* Formulaire d'attribution avec noValidate pour gérer la validation en React */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-300 flex justify-between">
                <span>Quantité à attribuer</span>
                <span className="text-[#E9C349] font-mono font-bold text-sm">
                  {quantity > 0 ? quantity : 0} billets
                </span>
              </label>

              <input
                type="number"
                min="1"
                max={stockDisponible}
                value={quantity === 0 ? '' : quantity}
                onChange={handleQuantityChange}
                placeholder="Ex: 50"
                className={`input-glass w-full rounded-2xl px-4 py-3 text-lg font-mono font-bold text-white mt-1 outline-none transition-colors ${
                  validationError ? 'border-red-500/60 focus:border-red-500' : 'focus:border-[#E9C349]'
                }`}
              />

              {/* Message d'erreur de validation clair */}
              {validationError && (
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-rose-400 font-medium">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Boutons de sélection rapide */}
              <div className="flex gap-2 mt-2">
                {[25, 50, 100].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setQuantity(n)}
                    className={`flex-1 py-1.5 rounded-xl border text-xs font-mono transition-colors cursor-pointer ${
                      quantity === n
                        ? 'bg-[#E9C349]/20 border-[#E9C349] text-[#E9C349] font-bold'
                        : 'bg-white/5 border-white/5 text-gray-300 hover:bg-white/10'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                {stockDisponible > 0 && (
                  <button
                    type="button"
                    onClick={() => setQuantity(stockDisponible)}
                    className={`flex-1 py-1.5 rounded-xl border text-xs font-mono transition-colors cursor-pointer ${
                      quantity === stockDisponible
                        ? 'bg-sky-500/25 border-sky-400 text-sky-200 font-bold'
                        : 'bg-white/5 border-white/5 text-sky-300 hover:bg-white/10'
                    }`}
                  >
                    Tout ({stockDisponible})
                  </button>
                )}
              </div>
            </div>

            {/* ENCART RÉCAPITULATIF MIS À JOUR EN TEMPS RÉEL À CHAQUE FRAPPE */}
            <div className="p-3.5 rounded-2xl bg-[#121212] border border-white/10 space-y-2 text-xs">
              <div className="flex items-center justify-between text-gray-300">
                <span>Vendeur partenaire :</span>
                <span className="font-bold text-white">
                  🏪 {selectedAgent?.pointDeVente || 'Non sélectionné'}
                </span>
              </div>
              <div className="flex items-center justify-between text-gray-300">
                <span>Type de billet :</span>
                <span className="font-bold text-[#E9C349]">
                  🎫 {assignTierName || 'Standard'}
                </span>
              </div>
              <div className="flex items-center justify-between text-gray-300 border-t border-white/5 pt-1.5">
                <span>Stock actuel en réserve :</span>
                <span className="font-mono text-white">{stockDisponible} billets</span>
              </div>
              <div className="flex items-center justify-between text-sky-400 font-bold">
                <span>Quantité à transférer :</span>
                <span className="font-mono">-{quantity > 0 ? quantity : 0} billets</span>
              </div>
              <div className="flex items-center justify-between text-gray-300 border-t border-white/5 pt-1.5">
                <span>Nouveau solde en réserve :</span>
                <span className="font-mono font-bold text-emerald-400">
                  {Math.max(0, stockDisponible - (quantity > 0 ? quantity : 0))} billets
                </span>
              </div>
              <div className="flex items-center justify-between text-gray-300">
                <span>Nouveau total boutique {selectedAgent?.pointDeVente || ''} :</span>
                <span className="font-mono font-bold text-amber-300">
                  {(selectedAgent?.allocatedCount || 0) + (quantity > 0 ? quantity : 0)} billets
                </span>
              </div>
            </div>

            {/* Boutons d'action */}
            <div className="pt-1 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase cursor-pointer transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={!isFormValid}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-sky-600 to-[#8A2BE2] hover:from-sky-500 hover:to-[#9B3BF2] text-white font-heading font-extrabold text-xs uppercase tracking-wider shadow-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 transition-all"
              >
                {isAssigning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Attribution en cours...</span>
                  </>
                ) : (
                  <span>Confirmer ({quantity > 0 ? quantity : 0})</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
