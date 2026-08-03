/*
# Noon Library - Core Schema

## Overview
Full database schema for Noon Library bookstore with affiliate marketing.

## Tables (in dependency order)
- profiles, categories, books, cart_items, wishlist_items, addresses
- promo_codes (before orders), affiliate_profiles (before promo_codes)
- orders, order_items, affiliate_orders, withdrawals, notifications, settings

## Security
- RLS on all tables. Profiles: owner + admin. Books/categories/settings: public read, admin write.
- Cart/wishlist/addresses: owner-scoped. Orders: owner read/insert, admin read+update.
- Affiliate: owner + admin. Withdrawals: owner read/insert, admin update. Notifications: owner-scoped.
*/

-- ============ PROFILES ============
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text,
  email text,
  phone text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user','affiliate')),
  avatar_url text,
  is_disabled boolean NOT NULL DEFAULT false,
  disable_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- ============ CATEGORIES ============
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_ar text NOT NULL,
  name_en text,
  slug text NOT NULL UNIQUE,
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "categories_read" ON categories;
CREATE POLICY "categories_read" ON categories FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "categories_admin_write" ON categories;
CREATE POLICY "categories_admin_write" ON categories FOR ALL
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ============ BOOKS ============
CREATE TABLE IF NOT EXISTS books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text,
  publisher text,
  isbn text,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  discount_price numeric(10,2),
  stock int NOT NULL DEFAULT 0,
  stock_threshold int NOT NULL DEFAULT 5,
  cover_url text,
  description text,
  commission_rate numeric(5,2) DEFAULT 10.00,
  is_bestseller boolean NOT NULL DEFAULT false,
  is_recommended boolean NOT NULL DEFAULT false,
  is_new_release boolean NOT NULL DEFAULT false,
  is_high_commission boolean NOT NULL DEFAULT false,
  sales_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_books_category ON books(category_id);
CREATE INDEX IF NOT EXISTS idx_books_created ON books(created_at DESC);
DROP POLICY IF EXISTS "books_read" ON books;
CREATE POLICY "books_read" ON books FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "books_admin_write" ON books;
CREATE POLICY "books_admin_write" ON books FOR ALL
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ============ CART ITEMS ============
CREATE TABLE IF NOT EXISTS cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, book_id)
);
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cart_select_own" ON cart_items;
CREATE POLICY "cart_select_own" ON cart_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "cart_insert_own" ON cart_items;
CREATE POLICY "cart_insert_own" ON cart_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "cart_update_own" ON cart_items;
CREATE POLICY "cart_update_own" ON cart_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "cart_delete_own" ON cart_items;
CREATE POLICY "cart_delete_own" ON cart_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ WISHLIST ITEMS ============
CREATE TABLE IF NOT EXISTS wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, book_id)
);
ALTER TABLE wishlist_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wishlist_select_own" ON wishlist_items;
CREATE POLICY "wishlist_select_own" ON wishlist_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "wishlist_insert_own" ON wishlist_items;
CREATE POLICY "wishlist_insert_own" ON wishlist_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "wishlist_delete_own" ON wishlist_items;
CREATE POLICY "wishlist_delete_own" ON wishlist_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ ADDRESSES ============
CREATE TABLE IF NOT EXISTS addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  governorate text NOT NULL,
  city text,
  area text,
  address_detail text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "addr_select_own" ON addresses;
CREATE POLICY "addr_select_own" ON addresses FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "addr_insert_own" ON addresses;
CREATE POLICY "addr_insert_own" ON addresses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "addr_update_own" ON addresses;
CREATE POLICY "addr_update_own" ON addresses FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "addr_delete_own" ON addresses;
CREATE POLICY "addr_delete_own" ON addresses FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ AFFILIATE PROFILES (before promo_codes) ============
CREATE TABLE IF NOT EXISTS affiliate_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  payout_method text NOT NULL CHECK (payout_method IN ('vodafone_cash','instapay','bank_transfer')),
  payout_account text NOT NULL,
  channel_desc text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','rejected','disabled')),
  reject_reason text,
  custom_commission_rate numeric(5,2),
  total_sales numeric(12,2) NOT NULL DEFAULT 0,
  total_earnings numeric(12,2) NOT NULL DEFAULT 0,
  pending_earnings numeric(12,2) NOT NULL DEFAULT 0,
  completed_orders int NOT NULL DEFAULT 0,
  pending_orders int NOT NULL DEFAULT 0,
  cancelled_orders int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE affiliate_profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_aff_user ON affiliate_profiles(user_id);
DROP POLICY IF EXISTS "aff_select" ON affiliate_profiles;
CREATE POLICY "aff_select" ON affiliate_profiles FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "aff_insert_own" ON affiliate_profiles;
CREATE POLICY "aff_insert_own" ON affiliate_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "aff_update" ON affiliate_profiles;
CREATE POLICY "aff_update" ON affiliate_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (true);

-- ============ PROMO CODES (before orders) ============
CREATE TABLE IF NOT EXISTS promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES affiliate_profiles(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  type text NOT NULL DEFAULT 'promo' CHECK (type IN ('promo','link')),
  discount_percent numeric(5,2) NOT NULL DEFAULT 10.00,
  max_uses int,
  used_count int NOT NULL DEFAULT 0,
  click_count int NOT NULL DEFAULT 0,
  order_count int NOT NULL DEFAULT 0,
  total_sales numeric(12,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_promo_code ON promo_codes(code);
DROP POLICY IF EXISTS "promo_select" ON promo_codes;
CREATE POLICY "promo_select" ON promo_codes FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "promo_insert_own" ON promo_codes;
CREATE POLICY "promo_insert_own" ON promo_codes FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM affiliate_profiles a WHERE a.id = affiliate_id AND a.user_id = auth.uid())
);
DROP POLICY IF EXISTS "promo_update_own" ON promo_codes;
CREATE POLICY "promo_update_own" ON promo_codes FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM affiliate_profiles a WHERE a.id = affiliate_id AND a.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM affiliate_profiles a WHERE a.id = affiliate_id AND a.user_id = auth.uid()));

-- ============ ORDERS ============
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'awaiting_review' CHECK (status IN ('awaiting_review','confirmed','preparing','shipped','delivered','cancelled')),
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  shipping_cost numeric(10,2) NOT NULL DEFAULT 0,
  discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  governorate text,
  shipping_method text DEFAULT 'express' CHECK (shipping_method IN ('express','postal')),
  payment_method text DEFAULT 'deposit' CHECK (payment_method IN ('deposit','full')),
  address_full_name text,
  address_phone text,
  address_detail text,
  promo_code_id uuid REFERENCES promo_codes(id) ON DELETE SET NULL,
  promo_code_text text,
  payment_sender_phone text,
  payment_receipt_number text,
  payment_screenshot_url text,
  reject_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
DROP POLICY IF EXISTS "orders_select" ON orders;
CREATE POLICY "orders_select" ON orders FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "orders_insert_own" ON orders;
CREATE POLICY "orders_insert_own" ON orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "orders_update_admin" ON orders;
CREATE POLICY "orders_update_admin" ON orders FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (true);

-- ============ ORDER ITEMS ============
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  book_id uuid REFERENCES books(id) ON DELETE SET NULL,
  book_title text NOT NULL,
  book_author text,
  quantity int NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  cover_url text
);
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
DROP POLICY IF EXISTS "order_items_select" ON order_items;
CREATE POLICY "order_items_select" ON order_items FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')))
  );
DROP POLICY IF EXISTS "order_items_insert_own" ON order_items;
CREATE POLICY "order_items_insert_own" ON order_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.user_id = auth.uid())
);

-- ============ AFFILIATE ORDERS ============
CREATE TABLE IF NOT EXISTS affiliate_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES affiliate_profiles(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  promo_code_id uuid REFERENCES promo_codes(id) ON DELETE SET NULL,
  commission_amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','settled','cancelled')),
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE affiliate_orders ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_affo_aff ON affiliate_orders(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_affo_order ON affiliate_orders(order_id);
DROP POLICY IF EXISTS "affo_select" ON affiliate_orders;
CREATE POLICY "affo_select" ON affiliate_orders FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM affiliate_profiles a WHERE a.id = affiliate_id AND a.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============ WITHDRAWALS ============
CREATE TABLE IF NOT EXISTS withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES affiliate_profiles(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  payout_method text,
  payout_account text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reject_reason text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wd_select" ON withdrawals;
CREATE POLICY "wd_select" ON withdrawals FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM affiliate_profiles a WHERE a.id = affiliate_id AND a.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
DROP POLICY IF EXISTS "wd_insert_own" ON withdrawals;
CREATE POLICY "wd_insert_own" ON withdrawals FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM affiliate_profiles a WHERE a.id = affiliate_id AND a.user_id = auth.uid())
);
DROP POLICY IF EXISTS "wd_update_admin" ON withdrawals;
CREATE POLICY "wd_update_admin" ON withdrawals FOR UPDATE
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (true);

-- ============ NOTIFICATIONS ============
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'general',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);
DROP POLICY IF EXISTS "notif_select_own" ON notifications;
CREATE POLICY "notif_select_own" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "notif_insert_own" ON notifications;
CREATE POLICY "notif_insert_own" ON notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "notif_update_own" ON notifications;
CREATE POLICY "notif_update_own" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ SETTINGS ============
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_read" ON settings;
CREATE POLICY "settings_read" ON settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "settings_admin_write" ON settings;
CREATE POLICY "settings_admin_write" ON settings FOR ALL
  TO authenticated USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ============ AUTO-CREATE PROFILE ON SIGNUP; FIRST USER = ADMIN ============
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_count int;
  is_first boolean;
BEGIN
  SELECT count(*) INTO user_count FROM profiles;
  is_first := (user_count = 0);
  INSERT INTO profiles (id, username, email, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    CASE WHEN is_first THEN 'admin' ELSE 'user' END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();