import { supabase } from './supabase';

const STORAGE_KEY = 'noon_referral';
const VISITOR_KEY = 'noon_visitor_id';
const EXPIRY_DAYS = 30;

export function getVisitorId(): string {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

interface ReferralData {
  affiliateId: string;
  referralCode: string;
  expiresAt: number;
}

export function getStoredReferral(): ReferralData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data: ReferralData = JSON.parse(raw);
    if (Date.now() > data.expiresAt) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function storeReferral(affiliateId: string, referralCode: string): void {
  const data: ReferralData = {
    affiliateId,
    referralCode,
    expiresAt: Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearReferral(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export async function trackReferralClick(referralCode: string): Promise<void> {
  const visitorId = getVisitorId();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  try {
    await fetch(
      `${supabaseUrl}/functions/v1/track-referral?code=${encodeURIComponent(referralCode)}&visitor_id=${encodeURIComponent(visitorId)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${anonKey}` },
      },
    );
  } catch {
    // Silently fail — tracking is best-effort
  }
}

export async function processReferralLink(): Promise<void> {
  const hash = window.location.hash;
  const url = new URL(window.location.href);

  let referralCode: string | null = null;

  // Pattern: ?ref=CODE (top-level query param)
  referralCode = url.searchParams.get('ref');

  // Pattern: #/?ref=CODE (hash-based route with query)
  if (!referralCode && hash.includes('ref=')) {
    const hashParams = new URLSearchParams(hash.split('?')[1] || '');
    referralCode = hashParams.get('ref');
  }

  // Pattern: #/ref/CODE (path-based)
  if (!referralCode) {
    const refMatch = hash.match(/#?\/ref\/([^?/]+)/);
    if (refMatch) referralCode = refMatch[1];
  }

  if (referralCode) {
    referralCode = referralCode.toUpperCase();

    const { data } = await supabase
      .from('affiliate_profiles')
      .select('id, referral_code, status')
      .eq('referral_code', referralCode)
      .eq('status', 'active')
      .maybeSingle();

    if (data) {
      storeReferral(data.id, data.referral_code);
      await trackReferralClick(referralCode);

      // Clean the URL
      if (url.searchParams.has('ref')) {
        url.searchParams.delete('ref');
        window.history.replaceState(null, '', url.toString());
      }
      if (hash.includes('/ref/')) {
        const cleanHash = hash.replace(/\/ref\/[^?/]+/, '');
        window.history.replaceState(null, '', window.location.pathname + cleanHash);
      } else if (hash.includes('ref=')) {
        const cleanHash = hash.replace(/([?&])ref=[^&]*/, '$1').replace(/[?&]$/, '').replace(/^\?$/, '');
        window.history.replaceState(null, '', window.location.pathname + cleanHash);
      }
    }
  }
}
