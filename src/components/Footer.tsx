import React, { useState } from 'react';
import {
  Mail,
  Phone,
  Globe,
  Facebook,
  Instagram,
  Youtube,
  FileText,
  MapPin,
  X,
} from 'lucide-react';
import { TermsOfServiceModal } from './TermsOfServiceModal';

const TikTokIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .58.04.85.12V9.4a6.33 6.33 0 0 0-.85-.06A6.34 6.34 0 0 0 3.1 15.68a6.34 6.34 0 0 0 10.82 4.48 6.27 6.27 0 0 0 1.9-4.48V8.9a8.18 8.18 0 0 0 4.77 1.52V6.97a4.85 4.85 0 0 1-1-.28z" />
  </svg>
);

const SnapchatIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12.03 2.05c-3.14 0-5.46 2.27-5.46 5.37 0 .58.09 1.13.23 1.63-.44.09-.9.2-1.35.34-.37.12-.57.34-.52.61.05.28.32.48.67.57.54.14 1.11.23 1.67.28-.05.39-.08.79-.08 1.19 0 .52.05 1.02.14 1.51-.76.31-1.63.73-2.31 1.34-.33.29-.39.6-.17.84.22.24.62.33 1.05.26.83-.14 1.71-.43 2.52-.86.32.55.77 1.01 1.31 1.34-.41.48-.96.9-1.57 1.25-.33.19-.44.45-.31.68.13.23.47.33.87.27.87-.13 1.79-.49 2.59-1.05.33.14.68.22 1.05.22.37 0 .72-.08 1.05-.22.8.56 1.72.92 2.59 1.05.4.06.74-.04.87-.27.13-.23.02-.49-.31-.68-.61-.35-1.16-.77-1.57-1.25.54-.33.99-.79 1.31-1.34.81.43 1.69.72 2.52.86.43.07.83-.02 1.05-.26.22-.24.16-.55-.17-.84-.68-.61-1.55-1.03-2.31-1.34.09-.49.14-.99.14-1.51 0-.4-.03-.8-.08-1.19.56-.05 1.13-.14 1.67-.28.35-.09.62-.29.67-.57.05-.27-.15-.49-.52-.61-.45-.14-.91-.25-1.35-.34.14-.5.23-1.05.23-1.63 0-3.1-2.32-5.37-5.46-5.37z" />
  </svg>
);

interface FooterProps {
  onNavigateAdmin?: () => void;
  onNavigateCGV?: () => void;
  onNavigatePath?: (path: string) => void;
}

type LegalTab = 'cgv' | 'confidentialite' | 'faq';

export const Footer: React.FC<FooterProps> = ({ onNavigateCGV, onNavigatePath }) => {
  const [legalTab, setLegalTab] = useState<LegalTab | null>(null);
  const [isCGVModalOpen, setIsCGVModalOpen] = useState(false);

  const socialLinks = [
    { name: 'Facebook', url: 'https://www.facebook.com/Thiesdn', icon: Facebook },
    { name: 'Instagram', url: 'https://www.instagram.com/thies_dn', icon: Instagram },
    { name: 'TikTok', url: 'https://tiktok.com/@thiesdn', icon: TikTokIcon },
    { name: 'Snapchat', url: 'https://snapchat.com/add/thiesdn', icon: SnapchatIcon },
    { name: 'YouTube', url: 'https://youtube.com/@thiesdn', icon: Youtube },
  ];

  return (
    <>
      <footer className="mt-auto border-t border-white/10 bg-[#0A0A0A] text-gray-300 pb-[calc(var(--nav-h,72px)+env(safe-area-inset-bottom))] md:pb-0">
        <div className="max-w-7xl mx-auto">
          {/* Ligne principale ultra-compacte */}
          <div className="flex flex-col md:flex-row justify-between items-center py-6 px-4 md:py-8 gap-2">
            {/* Identité & Titre */}
            <span className="font-heading font-black text-sm tracking-tight text-white">
              Thièsdn <span className="text-[#E9C349]">Billetterie</span>
            </span>

            {/* Liens rapides icônes + Mentions légales */}
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
              <a
                href="https://maps.app.goo.gl/NmftZjQ1fEU3eFZk9"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Localisation Google Maps"
                title="Localisation Google Maps"
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-[#E9C349] transition-colors"
              >
                <MapPin className="w-3.5 h-3.5" />
              </a>

              <a
                href="https://wa.me/221774587474?text=Bonjour%20Thi%C3%A8sdn%20Billetterie"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                title="Contacter sur WhatsApp"
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-emerald-400 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
              </a>

              <a
                href="mailto:contact@mgartswork.site"
                aria-label="Email"
                title="contact@mgartswork.site"
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-[#DCB8FF] transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
              </a>

              <button
                type="button"
                onClick={() => setLegalTab('cgv')}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-gray-200 hover:text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-[#DCB8FF]" />
                <span>Mentions légales</span>
              </button>
            </div>

            {/* Réseaux Sociaux compacts */}
            <div className="flex items-center gap-2">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.name}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.name}
                    title={social.name}
                    className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Barre de Copyright ultra-fine */}
          <div className="px-4 py-3 border-t border-white/10 text-[10px] text-gray-400 flex flex-col md:flex-row justify-between items-center gap-1 text-center">
            <span>© 2026 Thièsdn Billetterie — Tous droits réservés.</span>
            <a
              href="https://mgartswork.site"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#E9C349] hover:text-[#DCB8FF] transition-colors inline-flex items-center gap-1 font-semibold"
            >
              <span>Conçu par DAW Digital Arts Work by MG</span>
              <Globe className="w-3 h-3" />
            </a>
          </div>
        </div>
      </footer>

      {/* MODALE MENTIONS LÉGALES (CGV, CONFIDENTIALITÉ, FAQ & GUIDES VILLES) */}
      {legalTab && (
        <div
          onClick={() => setLegalTab(null)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full sm:max-w-lg bg-[#181818] border-t sm:border border-white/10 rounded-t-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl text-left space-y-4 max-h-[85vh] overflow-y-auto pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-heading font-bold text-sm text-white">
                Mentions légales &amp; Informations
              </h3>
              <button
                type="button"
                onClick={() => setLegalTab(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Onglets CGV / Confidentialité / FAQ */}
            <div className="grid grid-cols-3 gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
              {(
                [
                  { id: 'cgv', label: 'CGV' },
                  { id: 'confidentialite', label: 'Confidentialité' },
                  { id: 'faq', label: 'FAQ' },
                ] as ReadonlyArray<{ id: LegalTab; label: string }>
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setLegalTab(tab.id)}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    legalTab === tab.id
                      ? 'bg-[#8A2BE2] text-white'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="text-xs text-gray-300 space-y-3 leading-relaxed max-h-[50vh] overflow-y-auto pr-1">
              {legalTab === 'cgv' && (
                <>
                  <p>
                    <strong>1. Émission des billets :</strong> Tout achat effectué sur Thièsdn Billetterie donne lieu à la délivrance d&apos;un pass électronique doté d&apos;un QR Code unique.
                  </p>
                  <p>
                    <strong>2. Validation des règlements :</strong> Les paiements sont effectués via Wave Sénégal et Orange Money et activés après confirmation.
                  </p>
                  <p>
                    <strong>3. Non-remboursement :</strong> Les billets achetés ne sont ni échangeables ni remboursables, sauf annulation de l&apos;événement.
                  </p>
                  <p>
                    <strong>4. Contrôle d&apos;accès :</strong> Chaque QR Code est à usage unique à l&apos;entrée.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setLegalTab(null);
                      if (onNavigateCGV) onNavigateCGV();
                      else setIsCGVModalOpen(true);
                    }}
                    className="text-[#E9C349] hover:underline font-bold cursor-pointer"
                  >
                    Lire les CGV complètes →
                  </button>
                </>
              )}

              {legalTab === 'confidentialite' && (
                <>
                  <p>
                    <strong>Collecte des données :</strong> Thièsdn Billetterie recueille uniquement les données nécessaires à l&apos;émission et au contrôle des billets (nom, téléphone Wave/OM, email).
                  </p>
                  <p>
                    <strong>Protection :</strong> Aucune donnée bancaire n&apos;est stockée. Vos données ne sont jamais vendues à des tiers.
                  </p>
                  <p>
                    Conforme à la loi sénégalaise n° 2008-12 sur la protection des données personnelles.
                  </p>
                </>
              )}

              {legalTab === 'faq' && (
                <>
                  <div>
                    <h5 className="font-bold text-white mb-1">Comment payer avec Wave ?</h5>
                    <p className="text-[#E5E2E1]">
                      Sélectionnez votre formule puis cliquez sur &quot;Payer avec Wave&quot;. Dès confirmation, votre pass QR apparaît dans Mes Billets.
                    </p>
                  </div>
                  <div>
                    <h5 className="font-bold text-white mb-1">Où retrouver mon billet ?</h5>
                    <p className="text-[#E5E2E1]">
                      Dans l&apos;onglet &quot;Mes Billets &amp; Pass VIP&quot;.
                    </p>
                  </div>
                  <div>
                    <h5 className="font-bold text-white mb-1">Support WhatsApp</h5>
                    <p className="text-[#E5E2E1]">
                      Contactez le +221 77 458 74 74 avec votre référence de commande.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Raccourcis villes */}
            <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
              {[
                { label: 'Thiès', path: '/evenements/thies' },
                { label: 'Dakar', path: '/evenements/dakar' },
                { label: 'Saly', path: '/evenements/saly' },
                { label: 'Mbour', path: '/evenements/mbour' },
                { label: 'Explorer', path: '/explorer' },
              ].map((item) => (
                <a
                  key={item.path}
                  href={item.path}
                  onClick={(e) => {
                    if (onNavigatePath) {
                      e.preventDefault();
                      setLegalTab(null);
                      onNavigatePath(item.path);
                    }
                  }}
                  className="text-gray-300 hover:text-[#E9C349] font-semibold"
                >
                  {item.label}
                </a>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setLegalTab(null)}
              className="w-full py-2.5 rounded-xl bg-[#8A2BE2] hover:bg-[#7b24c9] text-white font-bold text-xs uppercase cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      <TermsOfServiceModal
        isOpen={isCGVModalOpen}
        onClose={() => setIsCGVModalOpen(false)}
      />
    </>
  );
};
