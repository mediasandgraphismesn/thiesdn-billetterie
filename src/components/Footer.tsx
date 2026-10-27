import React, { useState } from 'react';
import {
  Mail,
  Phone,
  Globe,
  ExternalLink,
  ShieldCheck,
  Facebook,
  Instagram,
  Youtube,
  FileText,
  HelpCircle,
  X,
  Sparkles,
} from 'lucide-react';

// Icônes vectorielles légères pour TikTok et Snapchat
const TikTokIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.29 0 .58.04.85.12V9.4a6.33 6.33 0 0 0-.85-.06A6.34 6.34 0 0 0 3.1 15.68a6.34 6.34 0 0 0 10.82 4.48 6.27 6.27 0 0 0 1.9-4.48V8.9a8.18 8.18 0 0 0 4.77 1.52V6.97a4.85 4.85 0 0 1-1-.28z" />
  </svg>
);

const SnapchatIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.03 2.05c-3.14 0-5.46 2.27-5.46 5.37 0 .58.09 1.13.23 1.63-.44.09-.9.2-1.35.34-.37.12-.57.34-.52.61.05.28.32.48.67.57.54.14 1.11.23 1.67.28-.05.39-.08.79-.08 1.19 0 .52.05 1.02.14 1.51-.76.31-1.63.73-2.31 1.34-.33.29-.39.6-.17.84.22.24.62.33 1.05.26.83-.14 1.71-.43 2.52-.86.32.55.77 1.01 1.31 1.34-.41.48-.96.9-1.57 1.25-.33.19-.44.45-.31.68.13.23.47.33.87.27.87-.13 1.79-.49 2.59-1.05.33.14.68.22 1.05.22.37 0 .72-.08 1.05-.22.8.56 1.72.92 2.59 1.05.4.06.74-.04.87-.27.13-.23.02-.49-.31-.68-.61-.35-1.16-.77-1.57-1.25.54-.33.99-.79 1.31-1.34.81.43 1.69.72 2.52.86.43.07.83-.02 1.05-.26.22-.24.16-.55-.17-.84-.68-.61-1.55-1.03-2.31-1.34.09-.49.14-.99.14-1.51 0-.4-.03-.8-.08-1.19.56-.05 1.13-.14 1.67-.28.35-.09.62-.29.67-.57.05-.27-.15-.49-.52-.61-.45-.14-.91-.25-1.35-.34.14-.5.23-1.05.23-1.63 0-3.1-2.32-5.37-5.46-5.37z" />
  </svg>
);

import { TermsOfServiceModal } from './TermsOfServiceModal';

interface FooterProps {
  onNavigateAdmin?: () => void;
  onNavigateCGV?: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigateAdmin, onNavigateCGV }) => {
  const [legalModal, setLegalModal] = useState<'confidentialite' | 'faq' | null>(null);
  const [isCGVModalOpen, setIsCGVModalOpen] = useState(false);

  // Liste des réseaux sociaux épurés sans gros blocs noirs
  const socialLinks = [
    {
      name: 'Facebook',
      url: 'https://facebook.com/thiesdn',
      icon: Facebook,
      hoverColor: 'hover:text-[#8A2BE2] hover:border-[#8A2BE2]/50 hover:bg-[#8A2BE2]/10',
    },
    {
      name: 'Instagram',
      url: 'https://instagram.com/thiesdn',
      icon: Instagram,
      hoverColor: 'hover:text-[#E9C349] hover:border-[#E9C349]/50 hover:bg-[#E9C349]/10',
    },
    {
      name: 'TikTok',
      url: 'https://tiktok.com/@thiesdn',
      icon: TikTokIcon,
      hoverColor: 'hover:text-[#8A2BE2] hover:border-[#8A2BE2]/50 hover:bg-[#8A2BE2]/10',
    },
    {
      name: 'Snapchat',
      url: 'https://snapchat.com/add/thiesdn',
      icon: SnapchatIcon,
      hoverColor: 'hover:text-[#E9C349] hover:border-[#E9C349]/50 hover:bg-[#E9C349]/10',
    },
    {
      name: 'YouTube',
      url: 'https://youtube.com/@thiesdn',
      icon: Youtube,
      hoverColor: 'hover:text-[#8A2BE2] hover:border-[#8A2BE2]/50 hover:bg-[#8A2BE2]/10',
    },
  ];

  return (
    <>
      <footer className="mt-auto border-t border-white/5 bg-[#0A0A0A]/95 text-gray-400 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 pb-24 md:pb-6">
          {/* Grille principale responsive : flex vertical sur mobile, colonnes sur desktop */}
          <div className="flex flex-col gap-4 sm:grid sm:grid-cols-3 sm:gap-8 mb-4 items-start">
            
            {/* COLONNE 1 : IDENTITÉ */}
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="h-8 px-2 py-1 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shadow-sm">
                  <img
                    src="/logo-tight.png"
                    alt="Thièsdn Logo"
                    className="h-4 w-auto object-contain"
                  />
                </div>
                <div>
                  <span className="font-heading font-extrabold text-sm text-white block leading-tight tracking-tight">
                    Thièsdn <span className="text-[#E9C349]">Billetterie</span>
                  </span>
                </div>
              </div>

              <p className="text-xs text-gray-400 leading-snug max-w-xs">
                Thièsdn Billetterie, la billetterie officielle des événements de prestige à Thiès, Saly, Mbour et Dakar.
              </p>

              <div className="flex items-center gap-1.5 text-[11px] text-[#DCB8FF]/90">
                <ShieldCheck className="w-3.5 h-3.5 text-[#E9C349] shrink-0" />
                <span>Pass QR certifié • Paiements sécurisés via Wave & Orange Money</span>
              </div>
            </div>

            {/* COLONNE 2 : CONTACT RAPIDE & RÉSEAUX SOCIAUX */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                <a
                  href="mailto:contact@mgartswork.site"
                  className="flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors"
                >
                  <Mail className="w-3.5 h-3.5 text-[#DCB8FF]" />
                  <span>contact@mgartswork.site</span>
                </a>

                <a
                  href="https://wa.me/221774587474?text=Bonjour%20Thi%C3%A8sdn%20Billetterie"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-gray-400 hover:text-emerald-400 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>+221 77 458 74 74</span>
                </a>

                <a
                  href="https://thiesdn.mgartswork.site/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-gray-400 hover:text-[#E9C349] transition-colors"
                >
                  <Globe className="w-3.5 h-3.5 text-[#E9C349]" />
                  <span>thiesdn.mgartswork.site</span>
                  <ExternalLink className="w-2.5 h-2.5 text-gray-600" />
                </a>
              </div>

              {/* Icônes Réseaux Sociaux alignées horizontalement */}
              <div className="flex items-center gap-3 pt-0.5">
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
                      className={`text-gray-400 transition-all duration-200 hover:scale-110 ${social.hoverColor.replace(/hover:bg-[^\s]+|hover:border-[^\s]+/g, '')}`}
                    >
                      <Icon className="w-4 h-4" />
                    </a>
                  );
                })}
                <span className="text-[11px] text-gray-500 ml-1">@thiesdn</span>
              </div>
            </div>

            {/* COLONNE 3 : LIENS UTILES (ACCORDÉON SUR MOBILE / COLONNE SUR DESKTOP) */}
            <div className="w-full md:justify-self-end">
              {/* Version Mobile : Accordéon <details> compact */}
              <details className="sm:hidden w-full bg-white/5 rounded-xl p-3 border border-white/5 group">
                <summary className="text-xs font-bold text-gray-300 cursor-pointer flex items-center justify-between list-none">
                  <span>Informations Légales & Espace Admin</span>
                  <span className="text-gray-500 group-open:rotate-180 transition-transform">▾</span>
                </summary>
                <div className="pt-3 space-y-2 text-xs border-t border-white/5 mt-2">
                  <button
                    onClick={() => {
                      if (onNavigateCGV) onNavigateCGV();
                      else setIsCGVModalOpen(true);
                    }}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors py-0.5 text-left w-full"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#DCB8FF]" />
                    <span>Conditions Générales de Vente (CGV)</span>
                  </button>

                  <button
                    onClick={() => setLegalModal('confidentialite')}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors py-0.5 text-left w-full"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Politique de Confidentialité</span>
                  </button>

                  <button
                    onClick={() => setLegalModal('faq')}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors py-0.5 text-left w-full"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-[#E9C349]" />
                    <span>Foire Aux Questions (FAQ)</span>
                  </button>

                  <button
                    onClick={() => {
                      if (onNavigateAdmin) onNavigateAdmin();
                      else window.location.href = '/admin';
                    }}
                    className="flex items-center gap-2 text-gray-400 hover:text-[#E9C349] transition-colors py-0.5 text-left font-medium w-full"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-[#8A2BE2]" />
                    <span>Accès Administration</span>
                  </button>
                </div>
              </details>

              {/* Version Desktop : Liste normale */}
              <div className="hidden sm:flex sm:flex-col space-y-1 text-xs">
                <button
                  onClick={() => {
                    if (onNavigateCGV) {
                      onNavigateCGV();
                    } else {
                      setIsCGVModalOpen(true);
                    }
                  }}
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors py-0.5 text-left"
                >
                  <FileText className="w-3.5 h-3.5 text-[#DCB8FF]" />
                  <span>Conditions Générales de Vente (CGV)</span>
                </button>

                <button
                  onClick={() => setLegalModal('confidentialite')}
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors py-0.5 text-left"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Politique de Confidentialité</span>
                </button>

                <button
                  onClick={() => setLegalModal('faq')}
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors py-0.5 text-left"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-[#E9C349]" />
                  <span>Foire Aux Questions (FAQ)</span>
                </button>

                <button
                  onClick={() => {
                    if (onNavigateAdmin) {
                      onNavigateAdmin();
                    } else {
                      window.location.href = '/admin';
                    }
                  }}
                  className="flex items-center gap-2 text-gray-400 hover:text-[#E9C349] transition-colors py-0.5 text-left font-medium group"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#8A2BE2] group-hover:text-[#E9C349] transition-colors" />
                  <span>Accès Administration (Super Admin)</span>
                </button>
              </div>
            </div>

          </div>

          {/* BARRE INFÉRIEURE SUR UNE SEULE LIGNE (flex justify-between) */}
          <div className="pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500">
            <p>© 2026 Thièsdn Billetterie. Tous droits réservés.</p>

            <div className="flex items-center gap-1 text-[#E9C349]">
              <span className="text-gray-500">Conçu & Développé par</span>
              <a
                href="https://mgartswork.site"
                target="_blank"
                rel="noopener noreferrer"
                className="font-heading font-bold text-[#E9C349] hover:text-[#DCB8FF] transition-colors inline-flex items-center gap-1"
              >
                <span>DAW Digital Arts Work by MG</span>
                <Sparkles className="w-3 h-3 text-[#E9C349]" />
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* MODALE INFORMATIVE DES LIENS UTILES */}
      {legalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in">
          <div className="relative w-full max-w-lg bg-[#181818] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl text-left space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-heading font-bold text-base text-white">
                {legalModal === 'cgv' && 'Conditions Générales de Vente (CGV)'}
                {legalModal === 'confidentialite' && 'Politique de Confidentialité'}
                {legalModal === 'faq' && 'Foire Aux Questions (FAQ)'}
              </h3>
              <button
                onClick={() => setLegalModal(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-gray-300 space-y-3 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
              {legalModal === 'cgv' && (
                <>
                  <p>
                    <strong>1. Émission des billets :</strong> Tout achat effectué sur Thièsdn Billetterie donne lieu à la délivrance d'un pass électronique doté d'un QR Code unique et infalsifiable.
                  </p>
                  <p>
                    <strong>2. Validation des règlements :</strong> Les paiements sont effectués directement via Wave Sénégal et Orange Money. Les billets sont activés dès confirmation de la réception du transfert.
                  </p>
                  <p>
                    <strong>3. Non-remboursement :</strong> Les billets achetés ne sont ni échangeables ni remboursables, sauf en cas d'annulation totale de l'événement par l'organisateur.
                  </p>
                  <p>
                    <strong>4. Contrôle d'accès :</strong> Chaque QR Code est à usage unique. Toute tentative de double validation à l'entrée sera immédiatement rejetée par le système de scanner.
                  </p>
                </>
              )}

              {legalModal === 'confidentialite' && (
                <>
                  <p>
                    <strong>Collecte des données :</strong> Thièsdn Billetterie recueille uniquement les données nécessaires à l'émission et au contrôle d'accès des billets (nom complet, numéro de téléphone Wave/OM, adresse e-mail).
                  </p>
                  <p>
                    <strong>Protection & Sécurité :</strong> Aucune donnée bancaire ou financière n'est stockée sur nos serveurs. Vos informations personnelles ne sont jamais cédées ni vendues à des tiers.
                  </p>
                  <p>
                    Conforme aux dispositions de la loi sénégalaise n° 2008-12 sur la protection des données à caractère personnel.
                  </p>
                </>
              )}

              {legalModal === 'faq' && (
                <>
                  <div>
                    <h5 className="font-bold text-white mb-1">Comment payer mon billet avec Wave ?</h5>
                    <p className="text-gray-400">
                      Sélectionnez votre formule puis cliquez sur "Payer avec Wave". Votre application Wave s'ouvre avec le montant exact prérempli. Dès votre validation, notre équipe émet votre pass.
                    </p>
                  </div>
                  <div>
                    <h5 className="font-bold text-white mb-1">Où retrouver mon billet acheté ?</h5>
                    <p className="text-gray-400">
                      Rendez-vous dans l'onglet "Mes Billets & Pass VIP" depuis votre espace client. Vous pouvez afficher et télécharger votre QR Code certifié à tout moment.
                    </p>
                  </div>
                  <div>
                    <h5 className="font-bold text-white mb-1">Que faire en cas de problème de validation ?</h5>
                    <p className="text-gray-400">
                      Contactez directement notre service support via WhatsApp au +221 77 458 74 74 avec votre référence de commande CMD-XXXX.
                    </p>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setLegalModal(null)}
              className="w-full py-3 rounded-xl bg-[#8A2BE2] hover:bg-[#7b24c9] text-white font-bold text-xs uppercase"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
      {/* Modale Officielle Complète des Conditions Générales de Vente (CGV) */}
      <TermsOfServiceModal
        isOpen={isCGVModalOpen}
        onClose={() => setIsCGVModalOpen(false)}
      />
    </>
  );
};
