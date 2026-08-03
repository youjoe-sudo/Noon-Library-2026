export type UserRole = 'admin' | 'user' | 'affiliate';

export type OrderStatus =
  | 'awaiting_review'
  | 'confirmed'
  | 'preparing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'rejected';

export type AffiliateStatus = 'pending' | 'active' | 'rejected' | 'disabled';

export type ShippingMethod = 'express' | 'postal';
export type PaymentMethod = 'deposit' | 'full';
export type PayoutMethod = 'vodafone_cash' | 'instapay' | 'bank_transfer';

export interface Profile {
  id: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  is_disabled: boolean;
  disable_reason: string | null;
  created_at: string;
}

export interface Category {
  id: string;
  name_ar: string;
  name_en: string | null;
  slug: string;
  icon: string | null;
  sort_order: number;
  is_hidden: boolean;
  created_at: string;
}

export interface Book {
  id: string;
  title: string;
  author: string | null;
  publisher: string | null;
  category_id: string | null;
  price: number;
  discount_price: number | null;
  stock: number;
  stock_threshold: number;
  cover_url: string | null;
  description: string | null;
  commission_rate: number;
  is_bestseller: boolean;
  is_recommended: boolean;
  is_new_release: boolean;
  is_high_commission: boolean;
  sales_count: number;
  created_at: string;
  category?: Category | null;
}

export interface CartItem {
  id: string;
  user_id: string;
  book_id: string;
  quantity: number;
  created_at: string;
  book?: Book | null;
}

export interface WishlistItem {
  id: string;
  user_id: string;
  book_id: string;
  created_at: string;
  book?: Book | null;
}

export interface Address {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  governorate: string;
  city: string | null;
  area: string | null;
  address_detail: string | null;
  is_default: boolean;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string | null;
  status: OrderStatus;
  subtotal: number;
  shipping_cost: number;
  discount_amount: number;
  total: number;
  governorate: string | null;
  shipping_method: ShippingMethod;
  payment_method: PaymentMethod;
  address_full_name: string | null;
  address_phone: string | null;
  address_detail: string | null;
  promo_code_id: string | null;
  promo_code_text: string | null;
  referred_affiliate_id: string | null;
  commission_source: 'coupon' | 'referral' | 'none' | null;
  books_subtotal: number;
  payment_sender_phone: string | null;
  payment_receipt_number: string | null;
  payment_screenshot_url: string | null;
  reject_reason: string | null;
  notes: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  book_id: string | null;
  book_title: string;
  book_author: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  cover_url: string | null;
}

export interface AffiliateProfile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  payout_method: PayoutMethod;
  payout_account: string;
  channel_desc: string | null;
  status: AffiliateStatus;
  reject_reason: string | null;
  custom_commission_rate: number | null;
  customer_discount_percent: number;
  admin_notes: string | null;
  referral_code: string | null;
  total_sales: number;
  total_earnings: number;
  pending_earnings: number;
  approved_earnings: number;
  paid_earnings: number;
  lifetime_earnings: number;
  total_clicks: number;
  unique_visitors: number;
  completed_orders: number;
  pending_orders: number;
  cancelled_orders: number;
  created_at: string;
}

export interface PromoCode {
  id: string;
  affiliate_id: string;
  code: string;
  type: 'promo' | 'link';
  discount_percent: number;
  max_uses: number | null;
  used_count: number;
  click_count: number;
  order_count: number;
  total_sales: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export interface AffiliateOrder {
  id: string;
  affiliate_id: string;
  order_id: string;
  promo_code_id: string | null;
  commission_amount: number;
  status: 'pending' | 'settled' | 'cancelled';
  settled_at: string | null;
  created_at: string;
  order?: Order | null;
}

export interface Withdrawal {
  id: string;
  affiliate_id: string;
  amount: number;
  payout_method: string | null;
  payout_account: string | null;
  status: 'pending' | 'under_review' | 'approved' | 'completed' | 'rejected';
  reject_reason: string | null;
  processed_at: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export interface Setting {
  key: string;
  value: string;
}

export type SettingsMap = Record<string, string>;

export interface Commission {
  id: string;
  affiliate_id: string;
  order_id: string;
  customer_id: string | null;
  coupon_id: string | null;
  coupon_code: string | null;
  referral_code: string | null;
  commission_source: 'coupon' | 'referral';
  books_total: number;
  commission_rate: number;
  commission_amount: number;
  status: 'pending' | 'approved' | 'paid' | 'cancelled';
  created_at: string;
  approved_at: string | null;
  paid_at: string | null;
  order?: Order | null;
}

export interface AffiliateClick {
  id: string;
  affiliate_id: string;
  visitor_id: string;
  referral_code: string | null;
  ip_hash: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AffiliateActivityLog {
  id: string;
  affiliate_id: string | null;
  order_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  ip_hash: string | null;
  created_at: string;
}

export interface CouponValidationResult {
  valid: boolean;
  error?: string;
  promo_id?: string;
  affiliate_id?: string;
  discount_percent?: number;
  code?: string;
}

export interface AffiliateCodeResult {
  valid: boolean;
  error?: string;
  affiliate_id?: string;
  referral_code?: string;
  customer_discount_percent?: number;
  commission_rate?: number;
}

export interface DiscountCodeResult {
  valid: boolean;
  error?: string;
  discount_code_id?: string;
  code?: string;
  discount_type?: 'percentage' | 'fixed';
  discount_value?: number;
  discount_amount?: number;
}

export interface CombinedCodesResult {
  affiliate: AffiliateCodeResult | null;
  discount_code: DiscountCodeResult | null;
  affiliate_id: string | null;
  affiliate_code: string | null;
  affiliate_discount_amount: number;
  discount_code_id: string | null;
  discount_code_text: string | null;
  discount_code_discount_amount: number;
  total_discount_amount: number;
  final_total: number;
}

export interface DiscountCode {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  is_active: boolean;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
  uses_per_user: number | null;
  min_order_amount: number | null;
  applicable_book_ids: string[];
  applicable_category_ids: string[];
  notes: string | null;
  total_discount_given: number;
  total_revenue: number;
  created_at: string;
  updated_at: string;
}

export interface AffiliateStats {
  total_clicks: number;
  unique_visitors: number;
  total_orders: number;
  successful_orders: number;
  conversion_rate: number;
  revenue: number;
  total_commission: number;
  pending_commission: number;
  approved_commission: number;
  paid_commission: number;
  withdrawable: number;
}

export interface NotificationReport {
  success: boolean;
  total_users: number;
  successfully_sent: number;
  failed: number;
  errors: Array<{ user_id: string; error: string }>;
}

export type TicketStatus = 'open' | 'waiting_support' | 'replied' | 'closed';

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  status: TicketStatus;
  customer_name: string | null;
  customer_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_type: 'customer' | 'admin';
  body: string;
  created_at: string;
}
