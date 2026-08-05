import type { OrderStatus, AffiliateStatus, PayoutMethod, ShippingMethod, PaymentMethod } from './types';

export const EGYPT_GOVERNORATES = [
  'القاهرة',
  'الجيزة',
  'الإسكندرية',
  'الدقهلية',
  'الشرقية',
  'القليوبية',
  'الغربية',
  'المنوفية',
  'البحيرة',
  'كفر الشيخ',
  'دمياط',
  'بورسعيد',
  'الإسماعيلية',
  'السويس',
  'الفيوم',
  'بني سويف',
  'المنيا',
  'أسيوط',
  'سوهاج',
  'قنا',
  'الأقصر',
  'أسوان',
  'مطروح',
  'الوادي الجديد',
  'البحر الأحمر',
  'شمال سيناء',
  'جنوب سيناء',
] as const;

export const CAIRO_GIZA = ['القاهرة', 'الجيزة'];
export const METRO_GOVS = ['القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الشرقية', 'الدقهلية', 'الغربية', 'المنوفية', 'البحيرة', 'دمياط'];
export const LOWER_CANAL_GOVS = ['بورسعيد', 'الإسماعيلية', 'السويس', 'كفر الشيخ'];
export const UPPER_GOVS = ['الفيوم', 'بني سويف', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان'];
export const REMOTE_GOVS = ['مطروح', 'الوادي الجديد', 'البحر الأحمر', 'شمال سيناء', 'جنوب سيناء'];

export const PAYOUT_METHODS: { value: PayoutMethod; label: string }[] = [
  { value: 'vodafone_cash', label: 'فودافون كاش' },
  { value: 'instapay', label: 'إنستا باي' },
  { value: 'bank_transfer', label: 'تحويل بنكي' },
];

export const SHIPPING_METHODS: { value: ShippingMethod; label: string; desc: string }[] = [
  { value: 'express', label: 'شحن سريع', desc: 'توصيل خلال 2-3 أيام' },
  { value: 'postal', label: 'شحن بريد', desc: 'توصيل خلال 5-7 أيام' },
];

export const TICKET_STATUS_LABELS: Record<string, string> = {
  open: 'مفتوحة',
  waiting_support: 'بانتظار الدعم',
  replied: 'تم الرد',
  closed: 'مغلقة',
};

export const TICKET_STATUS_COLORS: Record<string, string> = {
  open: 'bg-accent-100 text-accent-700',
  waiting_support: 'bg-blue-100 text-blue-700',
  replied: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-ink-100 text-ink-500',
};

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; desc: string }[] = [
  { value: 'full', label: 'تحويل بنكي / محفظة إلكترونية', desc: 'حوّل المبلغ إلى فودافون كاش وأرفق الإيصال' },
];

export const PAYMENT_VODAFONE_NUMBER = '01021671068';

export const RETURN_POLICY_TEXT = 'لا تتوفر الإرجاع لأن كل عميل يحق له فحص الطلب قبل استلامه عند التوصيل. للمزيد من المعلومات، يرجى التواصل معنا على واتساب: 01021671068';

export const SOCIAL_LINKS = {
  facebook: 'https://www.facebook.com/share/19UjSNobdA/',
  instagram: 'https://www.instagram.com/noon_library123?igsh=Zzd0eDhmd3VkcnNp',
  telegram: 'https://t.me/noonlibrary23',
  email: 'noonlibrary.2026@outlook.com',
  whatsapp: '01021671068',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_review: 'بانتظار المراجعة',
  confirmed: 'تم التأكيد',
  preparing: 'قيد التجهيز',
  shipped: 'تم الشحن',
  delivered: 'تم التوصيل',
  cancelled: 'ملغي',
  rejected: 'مرفوض',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  awaiting_review: 'bg-accent-100 text-accent-700',
  confirmed: 'bg-blue-100 text-blue-700',
  preparing: 'bg-purple-100 text-purple-700',
  shipped: 'bg-cyan-100 text-cyan-700',
  delivered: 'bg-primary-100 text-primary-700',
  cancelled: 'bg-red-100 text-red-700',
  rejected: 'bg-red-200 text-red-800',
};

export const AFFILIATE_STATUS_LABELS: Record<AffiliateStatus, string> = {
  pending: 'قيد المراجعة',
  active: 'نشط',
  rejected: 'مرفوض',
  disabled: 'متوقف',
};

export const AFFILIATE_STATUS_COLORS: Record<AffiliateStatus, string> = {
  pending: 'bg-accent-100 text-accent-700',
  active: 'bg-primary-100 text-primary-700',
  rejected: 'bg-red-100 text-red-700',
  disabled: 'bg-ink-200 text-ink-600',
};

export const WITHDRAWAL_STATUS_LABELS: Record<string, string> = {
  pending: 'معلق',
  under_review: 'قيد المراجعة',
  approved: 'تم الاعتماد',
  completed: 'تم الصرف',
  rejected: 'مرفوض',
};

export const WITHDRAWAL_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-accent-100 text-accent-700',
  under_review: 'bg-blue-100 text-blue-700',
  approved: 'bg-purple-100 text-purple-700',
  completed: 'bg-primary-100 text-primary-700',
  rejected: 'bg-red-100 text-red-700',
};

export const ROLE_LABELS: Record<string, string> = {
  user: 'مستخدم',
  affiliate: 'مسوق',
  admin: 'مشرف',
};

export const ROLE_COLORS: Record<string, string> = {
  user: 'bg-ink-100 text-ink-600',
  affiliate: 'bg-accent-100 text-accent-700',
  admin: 'bg-primary-100 text-primary-700',
};

export const ORDER_STATUS_FLOW: OrderStatus[] = [
  'awaiting_review',
  'confirmed',
  'preparing',
  'shipped',
  'delivered',
];

export function formatPrice(price: number): string {
  return `${price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ج.م`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

export function getEffectivePrice(book: { price: number; discount_price: number | null }): number {
  return book.discount_price != null && book.discount_price < book.price ? book.discount_price : book.price;
}

export function getDiscountPercent(book: { price: number; discount_price: number | null }): number {
  if (!book.discount_price || book.discount_price >= book.price) return 0;
  return Math.round((1 - book.discount_price / book.price) * 100);
}

export function generateOrderNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `NL-${y}${m}${d}-${rand}`;
}

export function getShippingCost(governorate: string, method: ShippingMethod, settings: Record<string, string>, bookCount: number): number {
  if (method === 'postal') {
    let cost = parseFloat(settings.shipping_postal || '50');
    if (bookCount > 10) cost += parseFloat(settings.shipping_extra_over10 || '30');
    return cost;
  }
  let cost: number;
  if (CAIRO_GIZA.includes(governorate)) {
    cost = parseFloat(settings.shipping_cairo_giza || '60');
  } else if (METRO_GOVS.includes(governorate)) {
    cost = parseFloat(settings.shipping_metro || '50');
  } else if (LOWER_CANAL_GOVS.includes(governorate)) {
    cost = parseFloat(settings.shipping_lower_canal || '80');
  } else if (UPPER_GOVS.includes(governorate)) {
    cost = parseFloat(settings.shipping_upper || '85');
  } else if (REMOTE_GOVS.includes(governorate)) {
    cost = parseFloat(settings.shipping_remote || '120');
  } else {
    cost = parseFloat(settings.shipping_metro || '50');
  }
  if (bookCount > 10) cost += parseFloat(settings.shipping_extra_over10 || '30');
  return cost;
}

export function isFreeShipping(subtotal: number, settings: Record<string, string>): boolean {
  const threshold = parseFloat(settings.free_shipping_threshold || '500');
  return subtotal >= threshold;
}
