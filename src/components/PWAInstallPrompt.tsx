import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone, Sparkles } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const STORAGE_KEY = 'thiesdn_pwa_dismissed';

export const PWAInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState<boolean>(false);

  useEffect(() => {
    // 1. Ne rien faire si déjà fermé durant cette session
    try {
      if (typeof window !== 'undefined' && sessionStorage.getItem(STORAGE_KEY) === '1') {
        return;
      }
    } catch {
      // Ignorer si sessionStorage indisponible
    }

    // 2. Détecter si l'application est déjà lancée en mode autonome (PWA installée)
    const isStandalone =
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true);

    if (isStandalone) {
      return;
    }

    // 3. Écouter l'événement standard beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      // Empêcher la mini-infobar native par défaut
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    const handleAppInstalled = () => {
      setIsVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        try {
          sessionStorage.setItem(STORAGE_KEY, '1');
        } catch {}
        setIsVisible(false);
      }
    } catch (err) {
      console.warn('Erreur déclenchement PWA install prompt:', err);
    }
  };

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
    } catch {}
    setIsVisible(false);
  };

  if (!isVisible || !deferredPrompt) {
    return null;
  }

  return (
    // STRICTEMENT MASQUÉ SUR DESKTOP (md:hidden) — Réservé exclusivement au mobile
    <aside
      aria-label="Installation de l'application Thièsdn"
      className="md:hidden fixed bottom-[calc(var(--nav-h,72px)+env(safe-area-inset-bottom)+12px)] inset-x-3 max-w-md mx-auto z-40 animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto"
    >
      <div className="relative overflow-hidden rounded-2xl bg-[#121118]/95 backdrop-blur-xl border border-[#E9C349]/35 p-3.5 shadow-2xl shadow-black/80">
        {/* Glow discret */}
        <div className="absolute -top-12 -right-12 w-28 h-28 bg-[#8A2BE2]/20 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center gap-3">
          {/* Logo App Icon */}
          <div className="w-11 h-11 rounded-xl bg-[#1D1B24] border border-[#E9C349]/40 p-1.5 flex items-center justify-center flex-shrink-0 shadow-md">
            <img
              src="/logo-tight.png"
              alt="Thièsdn Logo"
              className="w-full h-full object-contain"
              loading="eager"
            />
          </div>

          {/* Textes */}
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center gap-1.5">
              <span className="font-heading text-xs font-black text-white tracking-tight truncate">
                Thièsdn Billetterie
              </span>
              <span className="bg-[#E9C349] text-[#241A00] text-[9px] font-extrabold px-1.5 py-0.2 rounded uppercase">
                App
              </span>
            </div>
            <p className="text-[11px] text-gray-300 line-clamp-1 mt-0.5">
              📲 Installez l'application sur votre mobile
            </p>
          </div>

          {/* Bouton Fermer "✕" */}
          <button
            onClick={handleDismiss}
            aria-label="Fermer la bannière"
            className="p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Barre d'action */}
        <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-end gap-2">
          <button
            onClick={handleDismiss}
            className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white transition-colors"
          >
            Plus tard
          </button>
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 bg-[#E9C349] hover:bg-[#d4b03e] text-[#121118] px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-[#E9C349]/20"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Installer</span>
          </button>
        </div>
      </div>
    </aside>
  );
};

export default PWAInstallPrompt;
