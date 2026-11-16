import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant, durationMs?: number) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const existing = timersRef.current.get(id);
    if (existing !== undefined) {
      window.clearTimeout(existing);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'success', durationMs = 3500) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-2), { id, message, variant }]);

      const timerId = window.setTimeout(() => {
        timersRef.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, durationMs);
      timersRef.current.set(id, timerId);
    },
    []
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          aria-atomic="true"
          className="fixed top-[calc(12px+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-[10000] w-[calc(100%-24px)] max-w-md flex flex-col items-center gap-2 pointer-events-none"
        >
          {toasts.map((toast) => {
            const borderClass =
              toast.variant === 'error'
                ? 'border-rose-500/60 shadow-rose-950/50'
                : toast.variant === 'info'
                  ? 'border-[#8A2BE2]/60 shadow-[#8A2BE2]/25'
                  : 'border-emerald-500/60 shadow-emerald-950/50';

            return (
              <div
                key={toast.id}
                role="status"
                className={`pointer-events-auto w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-[#121118]/95 backdrop-blur-2xl border ${borderClass} shadow-2xl text-[#E5E2E1] animate-in slide-in-from-top-4 fade-in duration-200`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {toast.variant === 'error' ? (
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  ) : toast.variant === 'info' ? (
                    <Info className="w-5 h-5 text-[#DCB8FF] shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  )}
                  <span className="text-sm font-heading font-bold text-white leading-snug truncate">
                    {toast.message}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => dismissToast(toast.id)}
                  aria-label="Fermer la notification"
                  className="p-1 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      showToast: () => {},
      dismissToast: () => {},
    };
  }
  return ctx;
};
