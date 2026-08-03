import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from './supabase';
import type { SettingsMap } from './types';

interface SettingsContextValue {
  settings: SettingsMap;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

const DEFAULT_SETTINGS: SettingsMap = {
  shipping_cairo_giza: '60',
  shipping_metro: '50',
  shipping_lower_canal: '80',
  shipping_upper: '85',
  shipping_remote: '120',
  shipping_postal: '50',
  shipping_extra_over10: '30',
  free_shipping_threshold: '500',
  default_commission_rate: '10',
  bonus_10_orders_boost: '5',
  bonus_50_orders_boost: '10',
  withdrawal_threshold: '100',
  payment_account_vodafone: '01021671068',
  payment_account_instapay: '01021671068',
  payment_account_bank: '01021671068',
  payment_bank_name: 'Vodafone Cash',
  payment_account_holder: 'مكتبة نون',
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsMap>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('settings').select('key, value');
    if (error) {
      setSettings(DEFAULT_SETTINGS);
      setLoading(false);
      return;
    }
    const map: SettingsMap = { ...DEFAULT_SETTINGS };
    for (const row of data ?? []) {
      map[row.key] = row.value;
    }
    setSettings(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <SettingsContext.Provider value={{ settings, loading, refresh }}>
      {children}
    </SettingsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
