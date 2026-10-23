import React, { useState } from 'react';
import {
  X,
  Scale,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Printer,
  Check,
} from 'lucide-react';
import { CURRENT_TERMS_VERSION } from '../types';

interface TermsOfServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
  showAcceptButton?: boolean;
  isAlreadyAccepted?: boolean;
}

export const TermsOfServiceModal: React.FC<TermsOfServiceModalProps> = ({
  isOpen,
  onClose,
  onAccept,
  showAcceptButton = false,
  isAlreadyAccepted = false,
}) => {
  const [hasAgreedInModal, setHasAgreedInModal] = useState(false);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#111111] border border-white/20 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header Modale */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#E9C349]/20 border border-[#E9C349]/30 flex items-center justify-center text-[#E9C349]">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading text-lg sm:text-xl font-black text-white">
                Conditions Générales de Vente (CGV)
              </h2>
              <p className="text-[11px] text-gray-400">
                Thièsdn Billetterie • Version {CURRENT_TERMS_VERSION} • Droit Sénégalais
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-all"
              title="Imprimer"
            >
              <Printer className="w-4 h-4 text-[#E9C349]" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Corps des CGV avec ascenseur scrollable */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-4 text-xs text-gray-300 leading-relaxed">
          <div className="p-3 rounded-xl bg-[#8A2BE2]/10 border border-[#8A2BE2]/30 text-[#DCB8FF] text-[11px] font-medium flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#E9C349] shrink-0" />
            <span>
              Contrat officiel opposable entre Thièsdn Billetterie, les Organisateurs et les Spectateurs (Lois COCC Sénégal).
            </span>
          </div>

          <section className="space-y-1">
            <h4 className="font-bold text-white text-xs uppercase tracking-wide">
              1. Rôle d'intermédiaire technologique
            </h4>
            <p>
              Thièsdn Billetterie intervient en tant que tiers de confiance et mandataire de billetterie électronique. L'organisateur assume l'entière responsabilité légale, administrative et physique de son événement.
            </p>
          </section>

          <section className="space-y-1">
            <h4 className="font-bold text-white text-xs uppercase tracking-wide">
              2. Engagements légaux de l'Organisateur
            </h4>
            <p>
              Tout promoteur ou artiste publiant un événement atteste sur l'honneur détenir les autorisations administratives nécessaires (Police, Mairie de Thiès, Préfecture) et s'engage à respecter la jauge de sécurité du lieu d'accueil.
            </p>
          </section>

          <section className="space-y-1">
            <h4 className="font-bold text-white text-xs uppercase tracking-wide">
              3. Tarification & Reversement des Recettes (Option 3)
            </h4>
            <p>
              90% du produit net des ventes numériques sont reversés au promoteur. La commission de service de Thièsdn Billetterie s'élève à 10%. Les paiements sont sécurisés via Wave et Orange Money.
            </p>
          </section>

          <section className="space-y-1">
            <h4 className="font-bold text-white text-xs uppercase tracking-wide">
              4. QR Code Infalsifiable & Contrôle Anti-Fraude
            </h4>
            <p>
              Chaque billet est certifié par un QR Code cryptographique unique. Toute tentative de réutilisation d'un même pass à l'entrée sera immédiatement refusée par les scanners de sécurité avec signalement de fraude.
            </p>
          </section>

          <section className="space-y-1">
            <h4 className="font-bold text-white text-xs uppercase tracking-wide">
              5. Annulation & Remboursements
            </h4>
            <p>
              En cas d'annulation de l'événement par l'organisateur, celui-ci s'engage formellement au remboursement intégral des acheteurs dans les conditions de la loi sénégalaise.
            </p>
          </section>

          <section className="space-y-1">
            <h4 className="font-bold text-white text-xs uppercase tracking-wide">
              6. Protection des données personnelles (Loi 2008-12)
            </h4>
            <p>
              Les données personnelles recueillies sont strictement protégées et ne font l'objet d'aucune exploitation commerciale non autorisée.
            </p>
          </section>
        </div>

        {/* Footer Modale avec validation */}
        <div className="pt-3 border-t border-white/10 shrink-0 space-y-3">
          {showAcceptButton && !isAlreadyAccepted && (
            <div className="space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-white">
                <input
                  type="checkbox"
                  checked={hasAgreedInModal}
                  onChange={(e) => setHasAgreedInModal(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-2 border-[#E9C349] bg-black text-[#8A2BE2] focus:ring-0 cursor-pointer"
                />
                <span>
                  J'ai lu et j'accepte sans réserve l'intégralité des{' '}
                  <strong className="text-[#E9C349]">Conditions Générales de Vente (CGV v1.0)</strong>.
                </span>
              </label>

              <button
                type="button"
                disabled={!hasAgreedInModal}
                onClick={() => {
                  if (onAccept) onAccept();
                  onClose();
                }}
                className={`w-full py-3 rounded-2xl font-heading font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  hasAgreedInModal
                    ? 'btn-primary-glow cursor-pointer'
                    : 'bg-white/10 text-gray-500 cursor-not-allowed opacity-60'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>Valider et Signer les CGV ({CURRENT_TERMS_VERSION})</span>
              </button>
            </div>
          )}

          {(!showAcceptButton || isAlreadyAccepted) && (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase transition-all"
            >
              Fermer la fenêtre
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
