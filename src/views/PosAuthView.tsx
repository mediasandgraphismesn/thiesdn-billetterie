import React, { useState, useRef } from 'react';
import { Store, Lock, Mail, Eye, EyeOff, ArrowRight, ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react';
import { signInWithSupabase, fetchUserProfile, isSupabaseConfigured } from '../services/supabase';
import { TurnstileGate, type TurnstileGateHandle } from '../components/TurnstileGate';

interface PosAuthViewProps {
  onLoginSuccess: (role: 'sales_agent' | 'admin' | string) => void;
  onNavigateHome: () => void;
}

export const PosAuthView: React.FC<PosAuthViewProps> = ({ onLoginSuccess, onNavigateHome }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileGateHandle | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Veuillez renseigner votre email et mot de passe vendeur.');
      return;
    }

    const isTestKey = !import.meta.env.VITE_TURNSTILE_SITE_KEY || String(import.meta.env.VITE_TURNSTILE_SITE_KEY).includes('00000000000000000000AA');
    if (!captchaToken && !isTestKey) {
      setError('Veuillez valider le test de sécurité (CAPTCHA) ci-dessous.');
      return;
    }

    setLoading(true);

    if (isSupabaseConfigured()) {
      try {
        const res = await signInWithSupabase(cleanEmail, password, captchaToken);
        if (res.user?.id) {
          const profile = await fetchUserProfile(res.user.id, res.user);
          const role = profile?.role || res.user.user_metadata?.role || 'user';

          if (role === 'sales_agent' || role === 'admin') {
            onLoginSuccess(role);
          } else {
            setError(
              'Ce compte est actuellement configuré comme ' +
                (role === 'promoter' ? 'Promoteur' : 'Client') +
                ". Vous devez utiliser un compte vendeur ('sales_agent') pour accéder au terminal de caisse."
            );
          }
        } else {
          setError('Identifiants incorrects.');
        }
      } catch (err: any) {
        const msg = err?.message || '';
        if (msg.includes('Invalid login credentials') || msg.includes('invalid_grant')) {
          setError('Email ou mot de passe incorrect.');
        } else {
          setError(msg || 'Erreur lors de la connexion.');
        }
      } finally {
        turnstileRef.current?.resetToken();
        setLoading(false);
      }
    } else {
      // Mode hors-ligne / fallback
      setTimeout(() => {
        setLoading(false);
        onLoginSuccess('sales_agent');
      }, 400);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0a0a0a] flex items-center justify-center p-4 overflow-y-auto">
      {/* Halo lumineux d'ambiance Nocturnal Elegance */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#8A2BE2]/15 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-md p-6 sm:p-8 rounded-3xl bg-[#121118]/95 border border-[#8A2BE2]/40 shadow-2xl shadow-[#8A2BE2]/20 space-y-6 backdrop-blur-2xl animate-in zoom-in-95 duration-200">
        {/* En-tête Terminal POS */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3.5 rounded-2xl bg-[#8A2BE2]/20 border border-[#8A2BE2]/40 text-[#DCB8FF] mb-1 shadow-lg shadow-[#8A2BE2]/25">
            <Store className="w-8 h-8 text-[#E9C349]" />
          </div>
          <div className="inline-block">
            <span className="bg-[#241A00] text-[#E9C349] border border-[#E9C349]/40 text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
              Terminal POS Vendeur
            </span>
          </div>
          <h2 className="font-heading font-extrabold text-2xl text-white tracking-tight">
            Guichet Point de Vente
          </h2>
          <p className="text-xs text-gray-300 max-w-xs mx-auto leading-relaxed">
            Connectez-vous pour accéder à votre caisse mobile, déclarer vos ventes physiques et suivre vos commissions.
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-red-950/60 border border-red-500/50 text-red-200 text-xs flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Formulaire de connexion sécurisé */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5 text-left">
            <label className="text-[11px] uppercase font-bold text-gray-300 tracking-wider">
              Email Vendeur / Collaborateur
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vendeur@thiesdn.site"
                className="w-full bg-black/60 border border-white/15 rounded-2xl pl-10 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:border-[#E9C349] focus:ring-1 focus:ring-[#E9C349] outline-none transition-all font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5 text-left">
            <label className="text-[11px] uppercase font-bold text-gray-300 tracking-wider">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-black/60 border border-white/15 rounded-2xl pl-10 pr-11 py-3 text-sm text-white placeholder-gray-500 focus:border-[#E9C349] focus:ring-1 focus:ring-[#E9C349] outline-none transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Widget Cloudflare Turnstile CAPTCHA */}
          <div className="py-1 w-full flex justify-center overflow-hidden">
            <TurnstileGate
              ref={turnstileRef}
              onTokenChange={setCaptchaToken}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-[#8A2BE2] to-[#6A1BB2] hover:from-[#9B3BF2] hover:to-[#7B24C2] text-white font-heading font-extrabold text-sm uppercase tracking-wider shadow-lg shadow-[#8A2BE2]/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100 cursor-pointer"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-[#E9C349]" />
                <span>Ouvrir ma Caisse</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Bouton retour site public */}
        <div className="pt-2 border-t border-white/10 text-center">
          <button
            type="button"
            onClick={onNavigateHome}
            className="text-xs text-gray-300 hover:text-white inline-flex items-center gap-1.5 transition-colors font-medium cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Retourner à la billetterie publique</span>
          </button>
        </div>
      </div>
    </div>
  );
};
