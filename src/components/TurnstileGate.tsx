import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { AlertCircle, RefreshCw } from 'lucide-react';

const TURNSTILE_DEV_TEST_SITE_KEY = '1x00000000000000000000AA';

const PLACEHOLDER_KEYS = new Set([
  '',
  'votre_site_key_cloudflare',
  'your-turnstile-site-key',
  'YOUR_TURNSTILE_SITE_KEY',
]);

export interface TurnstileGateHandle {
  resetToken: () => void;
}

export interface TurnstileGateProps {
  onTokenChange: (token: string | null) => void;
  className?: string;
}

export const resolveTurnstileSiteKey = (
  envObj: Record<string, any> = (import.meta as any).env || {}
): { siteKey: string | null; configError: string | null } => {
  const rawKey = typeof envObj.VITE_TURNSTILE_SITE_KEY === 'string'
    ? envObj.VITE_TURNSTILE_SITE_KEY.trim()
    : '';
  const isDev = Boolean(envObj.DEV);

  if (!PLACEHOLDER_KEYS.has(rawKey)) {
    return { siteKey: rawKey, configError: null };
  }

  if (isDev) {
    return { siteKey: TURNSTILE_DEV_TEST_SITE_KEY, configError: null };
  }

  return {
    siteKey: null,
    configError:
      'Configuration CAPTCHA manquante (VITE_TURNSTILE_SITE_KEY absente ou invalide en production).',
  };
};

export const TurnstileGate = forwardRef<TurnstileGateHandle, TurnstileGateProps>(
  ({ onTokenChange, className = '' }, ref) => {
    const turnstileRef = useRef<TurnstileInstance | null>(null);
    const [widgetError, setWidgetError] = useState<string | null>(null);
    const [retryKey, setRetryKey] = useState(0);

    const { siteKey, configError } = resolveTurnstileSiteKey();

    const resetToken = () => {
      onTokenChange(null);
      setWidgetError(null);
      try {
        turnstileRef.current?.reset();
      } catch {
        setRetryKey((prev) => prev + 1);
      }
    };

    useImperativeHandle(ref, () => ({
      resetToken,
    }));

    const handleRetry = () => {
      onTokenChange(null);
      setWidgetError(null);
      try {
        turnstileRef.current?.reset();
      } catch {
        // Ignorer si l'instance n'est pas encore montée
      }
      setRetryKey((prev) => prev + 1);
    };

    if (configError || !siteKey) {
      return (
        <div
          role="alert"
          data-testid="turnstile-config-error"
          className={`w-full max-w-full rounded-xl bg-rose-950/70 border border-rose-500/40 p-3 text-rose-200 text-xs space-y-2 ${className}`}
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{configError}</span>
          </div>
        </div>
      );
    }

    return (
      <div className={`w-full max-w-full overflow-hidden flex flex-col items-center gap-2 ${className}`}>
        <div className="w-full max-w-full overflow-hidden flex justify-center">
          <Turnstile
            key={retryKey}
            ref={turnstileRef}
            siteKey={siteKey}
            options={{
              size: 'flexible',
              appearance: 'interaction-only',
              theme: 'dark',
            }}
            onSuccess={(token) => {
              setWidgetError(null);
              onTokenChange(token);
            }}
            onExpire={() => {
              onTokenChange(null);
              try {
                turnstileRef.current?.reset();
              } catch {
                // ignore
              }
            }}
            onError={() => {
              onTokenChange(null);
              setWidgetError(
                'La vérification de sécurité (CAPTCHA) a échoué (réseau instable ou bloqueur de publicité).'
              );
            }}
            onTimeout={() => {
              onTokenChange(null);
              setWidgetError(
                'Le délai de vérification CAPTCHA a expiré. Veuillez réessayer.'
              );
            }}
          />
        </div>

        {widgetError && (
          <div
            role="alert"
            data-testid="turnstile-widget-error"
            className="w-full max-w-full rounded-xl bg-rose-950/70 border border-rose-500/40 p-3 text-rose-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
          >
            <div className="flex items-start gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span className="leading-relaxed break-words">{widgetError}</span>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              data-testid="turnstile-retry-btn"
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-900/70 hover:bg-rose-800 text-white font-heading font-bold text-[11px] uppercase tracking-wider transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Réessayer</span>
            </button>
          </div>
        )}
      </div>
    );
  }
);

TurnstileGate.displayName = 'TurnstileGate';
