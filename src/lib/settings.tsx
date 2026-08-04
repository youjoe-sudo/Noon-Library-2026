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
  // Theme
  site_name: 'مكتبة نون',
  site_tagline: 'متجرك الأول للكتب العربية',
  footer_text: '© 2025 مكتبة نون. جميع الحقوق محفوظة.',
  announcement_text: 'شحن مجاني للطلبات فوق 500 ج.م',
  theme_primary: '#1f7a4c',
  theme_accent: '#f59e0b',
  theme_background: '#f6f7f9',
  theme_card: '#ffffff',
  theme_text: '#1f2430',
  theme_border: '#d5d9e0',
  theme_button: '#1f7a4c',
  font_primary: 'Cairo',
  font_heading: 'Amiri',
  whatsapp_number: '01021671068',
  contact_email: 'noonlibrary.2026@outlook.com',
  facebook_url: 'https://www.facebook.com/share/19UjSNobdA/',
  instagram_url: 'https://www.instagram.com/noon_library123',
  telegram_url: 'https://t.me/noonlibrary23',
  tiktok_url: 'https://www.tiktok.com/@noonlibrary5',
  payment_instructions: 'حوّل المبلغ المطلوب إلى رقم فودافون كاش: 01021671068',
};

function applyThemeColors(settings: SettingsMap) {
  const root = document.documentElement;
  if (settings.theme_primary) root.style.setProperty('--color-primary', settings.theme_primary);
  if (settings.theme_accent) root.style.setProperty('--color-accent', settings.theme_accent);
  if (settings.theme_background) root.style.setProperty('--color-background', settings.theme_background);
  if (settings.theme_card) root.style.setProperty('--color-card', settings.theme_card);
  if (settings.theme_text) root.style.setProperty('--color-text', settings.theme_text);
  if (settings.theme_border) root.style.setProperty('--color-border', settings.theme_border);
  if (settings.theme_button) root.style.setProperty('--color-button', settings.theme_button);
}

function applyFonts(settings: SettingsMap) {
  const root = document.documentElement;
  if (settings.font_primary) root.style.setProperty('--font-primary', settings.font_primary);
  if (settings.font_heading) root.style.setProperty('--font-heading', settings.font_heading);
}

function applySiteName(settings: SettingsMap) {
  if (settings.site_name) {
    document.title = `${settings.site_name} | Noon Library`;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SettingsMap>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('settings').select('key, value');
    if (error) {
      setSettings(DEFAULT_SETTINGS);
      applyThemeColors(DEFAULT_SETTINGS);
      applyFonts(DEFAULT_SETTINGS);
      setLoading(false);
      return;
    }
    const map: SettingsMap = { ...DEFAULT_SETTINGS };
    for (const row of data ?? []) {
      map[row.key] = row.value;
    }
    setSettings(map);
    applyThemeColors(map);
    applyFonts(map);
    applySiteName(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Apply theme whenever settings change
  useEffect(() => {
    applyThemeColors(settings);
    applyFonts(settings);
    applySiteName(settings);
  }, [settings]);

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
