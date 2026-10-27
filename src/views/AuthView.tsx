import React, { useState } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  User,
  Phone,
  AlertCircle,
  CheckCircle2,
  Inbox,
  RefreshCw,
  Send,
  ShieldCheck,
  MapPin,
  Navigation,
} from 'lucide-react';
import {
  signInWithSupabase,
  signUpWithSupabase,
  resendConfirmationEmail,
  resetPasswordWithSupabase,
  isSupabaseConfigured,
  fetchUserProfile,
} from '../services/supabase';
import Turnstile from 'react-turnstile';
import { THIES_33_QUARTIERS } from '../data/thiesQuartiers';
import { TermsOfServiceModal } from '../components/TermsOfServiceModal';
import { CURRENT_TERMS_VERSION } from '../types';

interface AuthViewProps {
  onLoginSuccess: (role?: 'user' | 'promoter' | 'admin' | 'sales_agent' | 'artist') => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState<'Thiès' | 'Dakar' | 'Mbour' | 'Saly' | 'Autre'>('Thiès');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  // État de confirmation d'email requis
  const [emailConfirmationSent, setEmailConfirmationSent] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthNotice(null);
    setResendMessage(null);

    if (!captchaToken) {
      setAuthError('Veuillez valider le CAPTCHA.');
      return;
    }

    // Validation stricte des champs obligatoires Ville & Quartier & CGV
    if (isRegister && !isForgotPassword) {
      if (!city || !city.trim() || !address || !address.trim()) {
        setAuthError('Veuillez renseigner votre ville et votre quartier.');
        return;
      }
      if (!acceptedTerms) {
        setAuthError('Vous devez accepter les Conditions Générales de Vente pour créer votre compte.');
        return;
      }
    }

    setLoading(true);
    const hasSupabase = isSupabaseConfigured();
    const cleanEmail = email.trim().toLowerCase();

    if (hasSupabase) {
      try {
        if (isForgotPassword) {
          await resetPasswordWithSupabase(cleanEmail, captchaToken);
          setAuthNotice('Un email de réinitialisation de mot de passe vous a été envoyé.');
          setIsForgotPassword(false);
        } else if (isRegister) {
          await signUpWithSupabase(
            cleanEmail,
            password,
            {
              name: name.trim() || 'Client Thièsdn',
              phone: phone.trim(),
              city: city,
              address: address.trim(),
              quartier: address.trim(),
              role: 'user', // Enregistrement public obligatoirement au rôle 'user'
              termsAccepted: true,
              termsAcceptedAt: new Date().toISOString(),
              termsVersion: CURRENT_TERMS_VERSION,
            },
            captchaToken
          );

          // Écran de confirmation par email
          setRegisteredEmail(cleanEmail);
          setEmailConfirmationSent(true);
        } else {
          const res = await signInWithSupabase(cleanEmail, password, captchaToken);
          // Attribution du rôle authentique selon la table `profiles`
          let userRole: 'user' | 'promoter' | 'admin' | 'sales_agent' | 'artist' = 'user';
          if (res.user?.id) {
            const profile = await fetchUserProfile(res.user.id, res.user);
            if (profile?.role) {
              userRole = profile.role;
            } else if (res.user?.user_metadata?.role) {
              userRole = res.user.user_metadata.role;
            }
          }
          onLoginSuccess(userRole);
        }
      } catch (err: any) {
        const rawMsg = err.message || '';
        let userFriendlyMsg = 'Erreur lors de l\'authentification.';

        if (rawMsg.includes('Email not confirmed') || rawMsg.includes('email_not_confirmed')) {
          userFriendlyMsg = 'Votre adresse email n\'a pas encore été confirmée. Veuillez vérifier votre boîte de réception ou vos spams.';
        } else if (rawMsg.includes('Invalid login credentials') || rawMsg.includes('invalid_grant')) {
          userFriendlyMsg = 'Adresse email ou mot de passe incorrect. Veuillez vérifier vos identifiants.';
        } else if (rawMsg.includes('User already registered') || rawMsg.includes('user_already_exists')) {
          userFriendlyMsg = 'Un compte existe déjà avec cette adresse email. Veuillez vous connecter.';
        } else if (rawMsg.includes('Password should be at least')) {
          userFriendlyMsg = 'Le mot de passe doit comporter au moins 6 caractères.';
        } else if (rawMsg) {
          userFriendlyMsg = rawMsg;
        }

        setAuthError(userFriendlyMsg);
      } finally {
        setLoading(false);
      }
    } else {
      // Fallback local sécurisé
      setTimeout(() => {
        setLoading(false);
        onLoginSuccess('user');
      }, 500);
    }
  };

  const handleResend = async () => {
    const targetEmail = (registeredEmail || email).trim().toLowerCase();
    if (!targetEmail) return;

    setIsResending(true);
    setResendMessage(null);
    try {
      await resendConfirmationEmail(targetEmail, captchaToken || undefined);
      setResendMessage('Un nouvel email de confirmation vous a été envoyé.');
    } catch (err: any) {
      setResendMessage(err.message || 'Impossible de renvoyer l\'email pour l\'instant.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#0A0A0A]">
      {/* Motif élégant "Nocturnal Elegance" en arrière-plan */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `radial-gradient(#8A2BE2 1px, transparent 1px), radial-gradient(#E9C349 1px, #0A0A0A 1px)`,
          backgroundSize: '32px 32px',
          backgroundPosition: '0 0, 16px 16px',
        }}
      />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#8A2BE2]/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 flex flex-col items-center">
        {/* Logo Officiel Thièsdn */}
        <div className="w-32 h-32 sm:w-36 sm:h-36 rounded-3xl bg-white flex items-center justify-center p-5 shadow-2xl shadow-[#8A2BE2]/30 mb-5 transform hover:scale-105 transition-transform border border-white/20">
          <img
            src="/logo-tight.png"
            alt="Thièsdn Logo"
            className="w-full h-auto object-contain"
          />
        </div>

        {/* Titre Principal */}
        <div className="text-center mb-6">
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold text-[#E9C349] tracking-wider uppercase">
            THIESDN <span className="text-white font-normal text-xl sm:text-2xl">BILLETTERIE</span>
          </h1>
          <p className="text-xs text-gray-300 font-semibold tracking-widest uppercase mt-0.5">
            Accès Exclusif & Billetterie Officielle
          </p>
        </div>

        {/* CONDITION 1 : ÉCRAN APRÈS INSCRIPTION — "Vérifiez votre boîte de réception" */}
        {emailConfirmationSent ? (
          <div className="w-full bg-[#181818]/95 backdrop-blur-2xl border border-[#8A2BE2]/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-200 text-center">
            <div className="relative mx-auto w-20 h-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-[#8A2BE2]/20 animate-ping" />
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-[#8A2BE2] to-[#DCB8FF] text-[#131313] flex items-center justify-center shadow-xl shadow-[#8A2BE2]/30">
                <Inbox className="w-8 h-8 text-white stroke-[2]" />
              </div>
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#8A2BE2]/15 text-[#DCB8FF] border border-[#8A2BE2]/30">
                <ShieldCheck className="w-3.5 h-3.5 text-[#E9C349]" />
                Vérification Obligatoire du Compte
              </span>
              <h2 className="font-heading text-xl sm:text-2xl font-extrabold text-white">
                Vérifiez votre boîte mail
              </h2>
              <p className="text-xs text-gray-300 max-w-sm mx-auto leading-relaxed">
                Un email de confirmation vous a été envoyé à :
              </p>
              <p className="font-mono text-sm font-bold text-[#E9C349] bg-black/40 py-2 px-3 rounded-xl border border-white/5 break-all">
                {registeredEmail || email}
              </p>
              <p className="text-xs text-emerald-400 font-medium">
                Cliquez sur le lien contenu dans l'email pour activer votre compte.
              </p>
            </div>

            {/* Conseils boîte mail */}
            <div className="p-4 rounded-2xl bg-[#141414] border border-white/5 text-left text-xs text-gray-400 space-y-2">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>Vérifiez également votre dossier <strong>Spam / Courrier indésirable</strong>.</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#E9C349] shrink-0 mt-0.5" />
                <span>La validation s'effectue en 1 clic et débloque immédiatement vos achats et créations d'événements.</span>
              </div>
            </div>

            {resendMessage && (
              <div className="p-3 rounded-xl bg-[#8A2BE2]/10 border border-[#8A2BE2]/30 text-xs text-[#DCB8FF]">
                {resendMessage}
              </div>
            )}

            {/* Actions : Renvoyer ou Aller à la connexion */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending}
                className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-heading font-bold text-xs flex items-center justify-center gap-2 border border-white/10 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isResending ? 'animate-spin' : ''}`} />
                <span>{isResending ? 'Envoi en cours...' : 'Renvoyer l\'email de confirmation'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmailConfirmationSent(false);
                  setIsRegister(false);
                }}
                className="w-full btn-primary-glow py-3.5 rounded-xl font-heading font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <span>J'ai confirmé mon email, se connecter</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* CONDITION 2 : FORMULAIRE STANDARD CONNEXION / INSCRIPTION */
          <div className="w-full bg-[#181818]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
            {authError && (
              <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs space-y-2">
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span className="font-semibold">{authError}</span>
                </div>
                {authError.toLowerCase().includes('confirm') && (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isResending}
                    className="w-full mt-1 py-1.5 px-3 rounded-lg bg-rose-900/60 hover:bg-rose-900 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Send className="w-3 h-3" />
                    <span>{isResending ? 'Envoi...' : 'Renvoyer l\'email d\'activation'}</span>
                  </button>
                )}
              </div>
            )}

            {resendMessage && (
              <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{resendMessage}</span>
              </div>
            )}

            {authNotice && (
              <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2.5">
                <span>{authNotice}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Champs Nom & Téléphone (Inscription) */}
              {isRegister && !isForgotPassword && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      NOM COMPLET <span className="text-[#E9C349]">*</span>
                    </label>
                    <div className="input-glass rounded-xl px-4 py-3.5 flex items-center gap-3">
                      <User className="w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="ex: Mamadou Ndiaye"
                        className="bg-transparent border-none outline-none text-white text-sm w-full p-0 focus:ring-0 placeholder-gray-600"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      TÉLÉPHONE (WAVE / ORANGE MONEY) <span className="text-[#E9C349]">*</span>
                    </label>
                    <div className="input-glass rounded-xl px-4 py-3.5 flex items-center gap-3">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+221 77 000 00 00"
                        className="bg-transparent border-none outline-none text-white text-sm w-full p-0 focus:ring-0 placeholder-gray-600"
                      />
                    </div>
                  </div>

                  {/* Nouveaux Champs Obligatoires : Ville et Quartier / Adresse */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Menu déroulant Ville */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        VILLE <span className="text-[#E9C349]">*</span>
                      </label>
                      <div className="input-glass rounded-xl px-4 py-3.5 flex items-center gap-2.5">
                        <MapPin className="w-4 h-4 text-[#E9C349] shrink-0" />
                        <select
                          required
                          value={city}
                          onChange={(e) => setCity(e.target.value as any)}
                          className="bg-transparent border-none outline-none text-white text-sm w-full p-0 focus:ring-0 cursor-pointer [&>option]:bg-[#1C1B1B] [&>option]:text-white"
                        >
                          <option value="Thiès">Thiès</option>
                          <option value="Dakar">Dakar</option>
                          <option value="Mbour">Mbour</option>
                          <option value="Saly">Saly</option>
                          <option value="Autre">Autre</option>
                        </select>
                      </div>
                    </div>

                    {/* Champ texte Quartier / Adresse */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        QUARTIER / ADRESSE <span className="text-[#E9C349]">*</span>
                      </label>
                      <div className="input-glass rounded-xl px-4 py-3.5 flex items-center gap-2.5">
                        <Navigation className="w-4 h-4 text-[#8A2BE2] shrink-0" />
                        <input
                          type="text"
                          required
                          list="thies-quartiers-options"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder={city === 'Thiès' ? 'ex: Grand Standing' : 'ex: Almadies, Somone...'}
                          className="bg-transparent border-none outline-none text-white text-sm w-full p-0 focus:ring-0 placeholder-gray-600"
                        />
                        {/* Liste d'autocomplétion des 33 quartiers de Thiès */}
                        <datalist id="thies-quartiers-options">
                          {THIES_33_QUARTIERS.map((q) => (
                            <option key={q.name} value={q.name} />
                          ))}
                        </datalist>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Champ Email */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                    EMAIL <span className="text-[#E9C349]">*</span>
                  </label>
                  {isForgotPassword && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(false);
                        setAuthError(null);
                        setAuthNotice(null);
                      }}
                      className="text-[11px] font-semibold text-[#DCB8FF] hover:underline"
                    >
                      Retour à la connexion
                    </button>
                  )}
                </div>
                <div className="input-glass rounded-xl px-4 py-3.5 flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    className="bg-transparent border-none outline-none text-white text-sm w-full p-0 focus:ring-0 placeholder-gray-600"
                  />
                </div>
              </div>

              {/* Champ Mot de Passe */}
              {!isForgotPassword && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      MOT DE PASSE <span className="text-[#E9C349]">*</span>
                    </label>
                    {!isRegister && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsForgotPassword(true);
                          setAuthError(null);
                          setAuthNotice(null);
                        }}
                        className="text-[11px] font-semibold text-[#DCB8FF] hover:underline"
                      >
                        Oublié?
                      </button>
                    )}
                  </div>
                  <div className="input-glass rounded-xl px-4 py-3.5 flex items-center gap-3">
                    <Lock className="w-4 h-4 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-transparent border-none outline-none text-white text-sm w-full p-0 focus:ring-0 placeholder-gray-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-gray-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Case à cocher OBLIGATOIRE des CGV (Inscription uniquement) */}
              {isRegister && !isForgotPassword && (
                <div className="pt-2 pb-1 animate-in fade-in">
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-gray-300 select-none">
                    <input
                      type="checkbox"
                      required
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border border-white/20 bg-black/60 text-[#8A2BE2] focus:ring-0 focus:outline-none accent-[#8A2BE2] cursor-pointer shrink-0"
                    />
                    <span className="leading-relaxed">
                      J'ai lu et j'accepte les{' '}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowTermsModal(true);
                        }}
                        className="text-[#E9C349] hover:underline font-bold"
                      >
                        Conditions Générales de Vente (CGV)
                      </button>{' '}
                      et la Politique de Confidentialité de Thièsdn Billetterie.
                    </span>
                  </label>
                </div>
              )}

              {/* Widget Cloudflare Turnstile CAPTCHA */}
              <div className="flex justify-center pt-1 overflow-x-auto">
                <Turnstile
                  sitekey={(import.meta as any).env?.VITE_TURNSTILE_SITE_KEY || ''}
                  onSuccess={(token) => setCaptchaToken(token)}
                  onExpire={() => setCaptchaToken(null)}
                  theme="dark"
                />
              </div>

              {/* Bouton Principal de Soumission */}
              <button
                type="submit"
                disabled={loading || (isRegister && !isForgotPassword && !acceptedTerms)}
                className={`w-full py-3.5 rounded-2xl font-heading font-bold text-sm tracking-wider flex items-center justify-center gap-2 transition-all mt-3 ${
                  loading || (isRegister && !isForgotPassword && !acceptedTerms)
                    ? 'bg-white/10 text-gray-500 cursor-not-allowed opacity-60'
                    : 'btn-primary-glow cursor-pointer'
                }`}
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>
                      {isForgotPassword
                        ? 'Envoyer le lien de réinitialisation'
                        : isRegister
                        ? 'Créer mon compte'
                        : 'Se connecter'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Note de Sécurité Officielle (Zéro bouton démo) */}
            <div className="pt-2 text-center">
              <span className="text-[10px] text-gray-500 font-medium inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Connexion sécurisée par chiffrement Supabase Auth (TLS 1.3)
              </span>
            </div>
          </div>
        )}

        {/* Bascule Connexion / Inscription */}
        {!emailConfirmationSent && (
          <div className="mt-6 text-center text-xs text-gray-400">
            <span>{isRegister ? 'Déjà un compte ?' : 'Nouveau sur Thiesdn ?'} </span>
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setIsForgotPassword(false);
                setAuthError(null);
                setAuthNotice(null);
              }}
              className="font-bold text-[#E9C349] hover:underline ml-1"
            >
              {isRegister ? 'Se connecter' : "S'inscrire"}
            </button>
          </div>
        )}
      </div>

      {/* Modale des Conditions Générales de Vente */}
      <TermsOfServiceModal
        isOpen={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        showAcceptButton={true}
        onAccept={() => setAcceptedTerms(true)}
      />
    </div>
  );
};
