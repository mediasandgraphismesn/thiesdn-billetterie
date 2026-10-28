import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary a capturé une exception React critique :', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearCacheAndReload = async () => {
    try {
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      localStorage.removeItem('thiesdn_events_cache');
    } catch (e) {
      console.warn('Erreur purge cache :', e);
    } finally {
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'Erreur d’exécution du cycle de rendu React.';

      return (
        <div className="min-h-screen bg-[#0A0A0A] text-[#E5E2E1] flex items-center justify-center p-4 selection:bg-[#8A2BE2] selection:text-white">
          <div className="max-w-lg w-full bg-[#141414] border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden text-center">
            {/* Glow décoratif Nocturnal Elegance */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#8A2BE2]/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#8A2BE2]/20 to-[#E9C349]/20 border border-[#E9C349]/40 flex items-center justify-center mx-auto shadow-lg shadow-[#8A2BE2]/20">
                <AlertTriangle className="w-8 h-8 text-[#E9C349]" />
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#E9C349] bg-[#E9C349]/10 px-3 py-1 rounded-full border border-[#E9C349]/20">
                Thièsdn Billetterie • Sécurité Résilience
              </span>
              <h1 className="font-heading text-xl sm:text-2xl font-extrabold text-white">
                Interruption Temporaire d'Affichage
              </h1>
              <p className="text-xs text-gray-400 leading-relaxed max-w-sm mx-auto">
                Une anomalie dans le cycle de rendu a été interceptée pour préserver l'application d'un écran noir.
              </p>
            </div>

            {/* Diagnostic Message */}
            <div className="bg-black/50 border border-white/5 rounded-2xl p-3.5 text-left space-y-1">
              <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Détail technique</p>
              <p className="text-xs font-mono text-rose-300 break-words line-clamp-3">
                {errorMessage}
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-[#8A2BE2] to-[#6A1BB2] hover:from-[#9D3CF2] hover:to-[#7B24CC] text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-xl shadow-[#8A2BE2]/30 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Recharger la page</span>
              </button>

              <button
                type="button"
                onClick={this.handleClearCacheAndReload}
                className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-[#E9C349]" />
                <span>Vider le cache et recharger</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
