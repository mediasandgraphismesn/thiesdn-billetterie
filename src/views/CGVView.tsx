import React, { useState } from 'react';
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Printer,
  ArrowLeft,
  Lock,
  Scale,
  Calendar,
  Check,
} from 'lucide-react';
import { UserProfile, CURRENT_TERMS_VERSION } from '../types';
import { acceptTermsOfServiceInSupabase } from '../services/supabase';

interface CGVViewProps {
  user?: UserProfile;
  onAcceptSuccess?: (updatedUser: UserProfile) => void;
  onBack?: () => void;
}

export const CGVView: React.FC<CGVViewProps> = ({
  user,
  onAcceptSuccess,
  onBack,
}) => {
  const [hasChecked, setHasChecked] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const isAccepted = Boolean(user?.termsAccepted && user?.termsVersion === CURRENT_TERMS_VERSION);

  const handleAcceptTerms = async () => {
    if (!user || !hasChecked || isAccepting) return;
    setIsAccepting(true);

    const res = await acceptTermsOfServiceInSupabase(user.id, CURRENT_TERMS_VERSION);
    setIsAccepting(false);

    if (res.success) {
      setSuccessToast(`Conditions Générales acceptées et horodatées avec succès (${CURRENT_TERMS_VERSION}).`);
      const updatedUser: UserProfile = {
        ...user,
        termsAccepted: true,
        termsAcceptedAt: res.timestamp,
        termsVersion: CURRENT_TERMS_VERSION,
      };
      if (onAcceptSuccess) {
        onAcceptSuccess(updatedUser);
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24 animate-in fade-in duration-300">
      {/* HEADER DE NAVIGATION & TITRE */}
      <div className="glass-panel p-6 rounded-3xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 mr-1 transition-all"
                title="Retour"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#E9C349]/20 text-[#E9C349] border border-[#E9C349]/40 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5" />
              Contrat Officiel • {CURRENT_TERMS_VERSION}
            </span>
            <span className="text-xs text-gray-400">• Droit Sénégalais</span>
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-black text-white tracking-tight">
            Conditions Générales de Vente (CGV)
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Réglementation de la billetterie électronique, des organisateurs et des spectateurs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-300 flex items-center gap-2 transition-all"
          >
            <Printer className="w-4 h-4 text-[#E9C349]" />
            <span>Imprimer le contrat</span>
          </button>
        </div>
      </div>

      {/* STATUT DE SIGNATURE ACTUEL DE L'UTILISATEUR */}
      {user && (
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
            isAccepted
              ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
              : 'bg-amber-950/50 border-amber-500/40 text-amber-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {isAccepted ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-6 h-6 text-amber-400 shrink-0" />
            )}
            <div className="text-xs">
              <p className="font-bold text-white">
                {isAccepted
                  ? `Contrat Numérique Signé & Validé (${user.termsVersion || CURRENT_TERMS_VERSION})`
                  : 'Action Requise : Acceptation Obligatoire'}
              </p>
              <p className="opacity-80">
                {isAccepted
                  ? `Vous avez formellement accepté les CGV le ${new Date(user.termsAcceptedAt || '').toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}.`
                  : 'Pour publier ou gérer un événement sur Thièsdn Billetterie, l\'acceptation de ce contrat est juridiquement requise.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TOAST DE SUCCÈS */}
      {successToast && (
        <div className="p-4 rounded-2xl bg-emerald-900/90 border border-emerald-400 text-white text-xs font-bold flex items-center gap-2 shadow-xl animate-in zoom-in-95">
          <Check className="w-4 h-4 text-emerald-300 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* CORPS DES CGV (CONTRAT JURIDIQUE COMPLET) */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 space-y-6 text-gray-300 text-xs sm:text-sm leading-relaxed">
        {/* Préambule */}
        <section className="space-y-2 border-b border-white/10 pb-5">
          <h2 className="font-heading font-extrabold text-base text-[#E9C349] uppercase tracking-wider flex items-center gap-2">
            <span>Préambule & Mentions Légales</span>
          </h2>
          <p>
            La plateforme <strong>Thièsdn Billetterie</strong> (éditée par la SARL Médias & Graphisme Sénégal / Thièsdn, immatriculée au RCCM de Thiès) est une solution technologique de billetterie électronique, de contrôle d’accès automatisé et de gestion événementielle.
          </p>
          <p>
            Les présentes Conditions Générales de Vente et d’Utilisation (ci-après <em>"les CGV"</em>) régissent de plein droit l’ensemble des relations contractuelles entre la plateforme Thièsdn Billetterie, les Organisateurs d'événements (promoteurs, artistes, producteurs, gérants de discothèques ou de salles) et les Acheteurs/Spectateurs.
          </p>
          <p className="font-semibold text-white">
            Toute utilisation des services, inscription ou publication d'un événement emporte adhésion pleine, entière et irrévocable aux présentes conditions.
          </p>
        </section>

        {/* Article 1 : Rôle d'intermédiaire */}
        <section className="space-y-2 border-b border-white/10 pb-5">
          <h3 className="font-heading font-bold text-sm text-white uppercase tracking-wider">
            Article 1 — Rôle de la Plateforme (Mandataire Technologique)
          </h3>
          <p>
            Thièsdn Billetterie agit exclusivement en qualité de mandataire technique et d'intermédiaire de paiement. La plateforme n'est ni propriétaire ni organisatrice directe des événements répertoriés, sauf mention expresse contraire.
          </p>
          <p>
            En conséquence, la responsabilité civile, administrative, pénale et sécuritaire de l'événement incombe exclusivement à l'Organisateur enregistré.
          </p>
        </section>

        {/* Article 2 : Engagements du Promoteur */}
        <section className="space-y-2 border-b border-white/10 pb-5">
          <h3 className="font-heading font-bold text-sm text-white uppercase tracking-wider">
            Article 2 — Engagements & Déclarations de l'Organisateur
          </h3>
          <p>Tout Organisateur (promoteur ou artiste) publiant un événement s'engage formellement à :</p>
          <ul className="list-disc pl-5 space-y-1 text-gray-400">
            <li>Détenir l'ensemble des autorisations administratives sénégalaises requises (déclaration préfectorale, autorisations municipales de la Ville de Thiès, conformité aux exigences des sapeurs-pompiers et de la Police Nationale).</li>
            <li>Fournir des informations exactes, sincères et vérifiées sur la date, le lieu, la programmation artistique et les tarifs applicables.</li>
            <li>Assurer le respect strict de la jauge maximale autorisée du lieu d'accueil afin de garantir la sécurité physique du public.</li>
            <li>Garantir la délivrance des prestations promises aux spectateurs (accès effectif selon la catégorie de billet : Standard, Prévente, VIP Prestige).</li>
          </ul>
        </section>

        {/* Article 3 : Conditions Financières */}
        <section className="space-y-2 border-b border-white/10 pb-5">
          <h3 className="font-heading font-bold text-sm text-white uppercase tracking-wider">
            Article 3 — Tarification, Frais de Plateforme & Reversements (Formule Option 3)
          </h3>
          <p>
            Conformément à la formule tarifaire officielle de Thièsdn Billetterie (Règle Option 3) :
          </p>
          <ul className="list-disc pl-5 space-y-1 text-gray-400">
            <li><strong>Part Promoteur :</strong> 90% du montant brut des ventes numériques encaissées sont intégralement reversés à l'Organisateur.</li>
            <li><strong>Frais de Plateforme Thièsdn :</strong> Une commission forfaitaire de 10% est perçue par Thièsdn Billetterie pour la mise à disposition de la technologie, la sécurisation des encaissements et la maintenance des serveurs.</li>
            <li><strong>Règlements Mobiles :</strong> Les paiements s'effectuent par Wave Sénégal et Orange Money (OM). Les billets ne sont émis qu'après confirmation bancaire ou validation administrative du paiement.</li>
          </ul>
        </section>

        {/* Article 4 : QR Code & Contrôle d'accès */}
        <section className="space-y-2 border-b border-white/10 pb-5">
          <h3 className="font-heading font-bold text-sm text-white uppercase tracking-wider">
            Article 4 — Émission des Billets, QR Code Infalsifiable & Anti-Fraude
          </h3>
          <p>
            Chaque billet émis est porteur d'un <strong>QR Code cryptographique unique et à usage unique</strong>.
          </p>
          <p>
            Le contrôle d'accès aux portes est opéré en temps réel via l'application scanner de Thièsdn Billetterie. Dès qu'un code est scanné avec succès, son statut passe irrémédiablement à <em>"utilisé"</em>.
          </p>
          <p className="text-red-300 font-semibold">
            Toute seconde présentation d'un billet identique (photocopie, capture d'écran dupliquée ou tentative de double entrée) déclenche une alerte rouge immédiate "Billet déjà scanné" et entraîne le refus absolu d'accès au porteur, sans préjudice de poursuites pénales pour tentative d'escroquerie.
          </p>
        </section>

        {/* Article 5 : Annulation & Remboursements */}
        <section className="space-y-2 border-b border-white/10 pb-5">
          <h3 className="font-heading font-bold text-sm text-white uppercase tracking-wider">
            Article 5 — Annulation, Report & Obligations de Remboursement
          </h3>
          <p>
            Les billets achetés par les spectateurs ne sont ni échangeables ni remboursables, sauf dans l'hypothèse où l'événement est purement et simplement annulé ou reporté sans date de repli agréée par l'Organisateur.
          </p>
          <p>
            En cas d'annulation imputable à l'Organisateur, celui-ci s'engage irrévocablement à rembourser l'intégralité des spectateurs. Les fonds sous séquestre détenus par Thièsdn Billetterie seront prioritairement affectés à la rétrocession aux acheteurs.
          </p>
        </section>

        {/* Article 6 : Réseau physique */}
        <section className="space-y-2 border-b border-white/10 pb-5">
          <h3 className="font-heading font-bold text-sm text-white uppercase tracking-wider">
            Article 6 — Réseau Partenaire & Billets Physiques à Souche
          </h3>
          <p>
            Lorsque l'Organisateur édite des lots de billets papier via le module d'impression sécurisée, les points de vente partenaires et vendeurs de rue sont placés sous la responsabilité comptable du promoteur. Tout billet physique scanné à l'entrée est certifié conforme et décompté du stock officiel.
          </p>
        </section>

        {/* Article 7 : Données Personnelles */}
        <section className="space-y-2 border-b border-white/10 pb-5">
          <h3 className="font-heading font-bold text-sm text-white uppercase tracking-wider">
            Article 7 — Protection des Données Personnelles (Loi n° 2008-12)
          </h3>
          <p>
            Thièsdn Billetterie traite les données des utilisateurs conformément aux dispositions de la loi sénégalaise n° 2008-12 du 25 janvier 2008 relative à la protection des données à caractère personnel.
          </p>
          <p>
            Les données recueillies (nom, numéro de téléphone, quartier) sont strictement limitées à l'émission des pass, à l'acheminement des notifications d'événements et à la traçabilité des entrées. Elles ne font l'objet d'aucune revente commerciale à des tiers.
          </p>
        </section>

        {/* Article 8 : Droit applicable */}
        <section className="space-y-2">
          <h3 className="font-heading font-bold text-sm text-white uppercase tracking-wider">
            Article 8 — Droit Applicable & Règlement des Litiges
          </h3>
          <p>
            Les présentes CGV sont soumises à la loi sénégalaise et au Code des Obligations Civiles et Commerciales (COCC).
          </p>
          <p>
            En cas de différend ou de litige né de l'interprétation ou de l'exécution du présent contrat, les parties privilégieront une conciliation amiable. À défaut d'accord sous 15 jours, compétence expresse et exclusive est attribuée aux tribunaux compétents du ressort du <strong>Tribunal de Grande Instance de Thiès (Sénégal)</strong>.
          </p>
        </section>
      </div>

      {/* BANDEAU D'ACCEPTATION EN BAS DE PAGE (VISIBLE SI UTILISATEUR CONNECTÉ N'A PAS ENCORE ACCEPTÉ) */}
      {user && !isAccepted && (
        <div className="sticky bottom-6 z-30 glass-panel p-5 sm:p-6 rounded-3xl border-2 border-[#E9C349] bg-[#111111]/95 backdrop-blur-md shadow-2xl space-y-4 animate-in slide-in-from-bottom-6">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="cgv-bottom-checkbox"
              checked={hasChecked}
              onChange={(e) => setHasChecked(e.target.checked)}
              className="mt-1 w-5 h-5 rounded-lg border-2 border-[#E9C349] bg-black text-[#8A2BE2] focus:ring-0 focus:outline-none cursor-pointer"
            />
            <label
              htmlFor="cgv-bottom-checkbox"
              className="text-xs sm:text-sm text-white font-medium cursor-pointer select-none leading-relaxed"
            >
              Je reconnais expressément avoir pris connaissance de l’intégralité des{' '}
              <strong className="text-[#E9C349]">
                Conditions Générales de Vente et d’Utilisation (Version {CURRENT_TERMS_VERSION})
              </strong>{' '}
              de Thièsdn Billetterie, et je les accepte sans réserve. Cette signature numérique a valeur de contrat bilatéral opposable.
            </label>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <span className="text-[11px] text-gray-400 font-mono">
              Signataire : <strong>{user.name}</strong> ({user.role.toUpperCase()}) • Horodaté en temps réel
            </span>

            <button
              onClick={handleAcceptTerms}
              disabled={!hasChecked || isAccepting}
              className={`w-full sm:w-auto px-6 py-3 rounded-2xl font-heading font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg ${
                hasChecked && !isAccepting
                  ? 'btn-primary-glow cursor-pointer'
                  : 'bg-white/10 text-gray-500 cursor-not-allowed opacity-60'
              }`}
            >
              {isAccepting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Horodatage et Signature...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-[#E9C349]" />
                  <span>J'accepte et je signe les CGV ({CURRENT_TERMS_VERSION})</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
