import { useState, useEffect, useCallback } from 'react';

export type AdminDensity = 'compact' | 'normal' | 'spacious';

export type AdminDashboardSectionId =
  | 'kpis'
  | 'senegal_map'
  | 'audience_analytics'
  | 'audit_logs'
  | 'quick_modules'
  | 'orders_table'
  | 'sold_tickets'
  | 'pending_moderation';

export const DEFAULT_ADMIN_CARD_ORDER: AdminDashboardSectionId[] = [
  'kpis',
  'senegal_map',
  'audience_analytics',
  'audit_logs',
  'quick_modules',
  'orders_table',
  'sold_tickets',
  'pending_moderation',
];

const STORAGE_ORDER_KEY = 'thiesdn_admin_dashboard_order_v1';
const STORAGE_DENSITY_KEY = 'thiesdn_admin_density_v1';
const STORAGE_CONTRAST_KEY = 'thiesdn_admin_high_contrast_v1';
const PREFS_SYNC_EVENT = 'thiesdn-admin-prefs-updated';

export interface DensityClasses {
  cardPadding: string;
  sectionGap: string;
  gridGap: string;
  kpiPadding: string;
}

export const getDensityClasses = (density: AdminDensity): DensityClasses => {
  switch (density) {
    case 'compact':
      return {
        cardPadding: 'p-2 sm:p-3',
        sectionGap: 'space-y-3',
        gridGap: 'gap-2',
        kpiPadding: 'p-2.5',
      };
    case 'spacious':
      return {
        cardPadding: 'p-6 sm:p-8',
        sectionGap: 'space-y-10',
        gridGap: 'gap-6',
        kpiPadding: 'p-6',
      };
    case 'normal':
    default:
      return {
        cardPadding: 'p-4 sm:p-5',
        sectionGap: 'space-y-6',
        gridGap: 'gap-4',
        kpiPadding: 'p-4',
      };
  }
};

const readStoredOrder = (): AdminDashboardSectionId[] => {
  if (typeof window === 'undefined') return DEFAULT_ADMIN_CARD_ORDER;
  try {
    const raw = localStorage.getItem(STORAGE_ORDER_KEY);
    if (!raw) return DEFAULT_ADMIN_CARD_ORDER;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_ADMIN_CARD_ORDER;
    const valid = parsed.filter((id): id is AdminDashboardSectionId =>
      typeof id === 'string' && DEFAULT_ADMIN_CARD_ORDER.includes(id as AdminDashboardSectionId)
    );
    const missing = DEFAULT_ADMIN_CARD_ORDER.filter((id) => !valid.includes(id));
    return [...valid, ...missing];
  } catch {
    return DEFAULT_ADMIN_CARD_ORDER;
  }
};

const readStoredDensity = (): AdminDensity => {
  if (typeof window === 'undefined') return 'normal';
  try {
    const val = localStorage.getItem(STORAGE_DENSITY_KEY);
    if (val === 'compact' || val === 'normal' || val === 'spacious') return val;
  } catch {}
  return 'normal';
};

const readStoredHighContrast = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_CONTRAST_KEY) === 'true';
  } catch {
    return false;
  }
};

export const useAdminPreferences = (applyContrastToDocument: boolean = false) => {
  const [cardOrder, setCardOrderState] = useState<AdminDashboardSectionId[]>(readStoredOrder);
  const [density, setDensityState] = useState<AdminDensity>(readStoredDensity);
  const [highContrast, setHighContrastState] = useState<boolean>(readStoredHighContrast);

  const syncFromStorage = useCallback(() => {
    setCardOrderState(readStoredOrder());
    setDensityState(readStoredDensity());
    setHighContrastState(readStoredHighContrast());
  }, []);

  useEffect(() => {
    const handler = () => syncFromStorage();
    window.addEventListener(PREFS_SYNC_EVENT, handler);
    return () => window.removeEventListener(PREFS_SYNC_EVENT, handler);
  }, [syncFromStorage]);

  useEffect(() => {
    if (!applyContrastToDocument || typeof document === 'undefined') return;
    if (highContrast) {
      document.documentElement.classList.add('high-contrast');
    } else {
      document.documentElement.classList.remove('high-contrast');
    }
    return () => {
      document.documentElement.classList.remove('high-contrast');
    };
  }, [highContrast, applyContrastToDocument]);

  const setCardOrder = useCallback((next: AdminDashboardSectionId[]) => {
    setCardOrderState(next);
    try {
      localStorage.setItem(STORAGE_ORDER_KEY, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent(PREFS_SYNC_EVENT));
    } catch {}
  }, []);

  const resetCardOrder = useCallback(() => {
    setCardOrder(DEFAULT_ADMIN_CARD_ORDER);
  }, [setCardOrder]);

  const setDensity = useCallback((next: AdminDensity) => {
    setDensityState(next);
    try {
      localStorage.setItem(STORAGE_DENSITY_KEY, next);
      window.dispatchEvent(new CustomEvent(PREFS_SYNC_EVENT));
    } catch {}
  }, []);

  const setHighContrast = useCallback((next: boolean) => {
    setHighContrastState(next);
    try {
      localStorage.setItem(STORAGE_CONTRAST_KEY, String(next));
      window.dispatchEvent(new CustomEvent(PREFS_SYNC_EVENT));
    } catch {}
  }, []);

  return {
    cardOrder,
    setCardOrder,
    resetCardOrder,
    density,
    setDensity,
    densityClasses: getDensityClasses(density),
    highContrast,
    setHighContrast,
  };
};
