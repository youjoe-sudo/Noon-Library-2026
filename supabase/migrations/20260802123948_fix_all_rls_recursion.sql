/*
# Fix all RLS policies with recursive profiles EXISTS

## Problem
Every admin-check policy uses `EXISTS (SELECT 1 FROM profiles p WHERE ...)`
which causes RLS recursion on the profiles table itself. This silently blocks
data access for authenticated users — the app sees empty results and acts as
if nobody is signed in.

## Changes
Replace all recursive `EXISTS (SELECT 1 FROM profiles ...)` checks with the
`public.is_admin()` SECURITY DEFINER function (created in the previous
migration), which reads profiles without being subject to RLS.

Tables affected:
- categories (admin write)
- books (admin write)
- affiliate_profiles (select, update)
- orders (select, update)
- order_items (select)
- affiliate_orders (select)
- withdrawals (select, update)
- settings (admin write)
*/

-- categories
DROP POLICY IF EXISTS "categories_admin_write" ON categories;
CREATE POLICY "categories_admin_write" ON categories FOR ALL
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- books
DROP POLICY IF EXISTS "books_admin_write" ON books;
CREATE POLICY "books_admin_write" ON books FOR ALL
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- affiliate_profiles
DROP POLICY IF EXISTS "aff_select" ON affiliate_profiles;
CREATE POLICY "aff_select" ON affiliate_profiles FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "aff_update" ON affiliate_profiles;
CREATE POLICY "aff_update" ON affiliate_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- orders
DROP POLICY IF EXISTS "orders_select" ON orders;
CREATE POLICY "orders_select" ON orders FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "orders_update_admin" ON orders;
CREATE POLICY "orders_update_admin" ON orders FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- order_items
DROP POLICY IF EXISTS "order_items_select" ON order_items;
CREATE POLICY "order_items_select" ON order_items FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.is_admin()))
  );

-- affiliate_orders
DROP POLICY IF EXISTS "affo_select" ON affiliate_orders;
CREATE POLICY "affo_select" ON affiliate_orders FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM affiliate_profiles a WHERE a.id = affiliate_id AND a.user_id = auth.uid())
    OR public.is_admin()
  );

-- withdrawals
DROP POLICY IF EXISTS "wd_select" ON withdrawals;
CREATE POLICY "wd_select" ON withdrawals FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM affiliate_profiles a WHERE a.id = affiliate_id AND a.user_id = auth.uid())
    OR public.is_admin()
  );
DROP POLICY IF EXISTS "wd_update_admin" ON withdrawals;
CREATE POLICY "wd_update_admin" ON withdrawals FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- settings
DROP POLICY IF EXISTS "settings_admin_write" ON settings;
CREATE POLICY "settings_admin_write" ON settings FOR ALL
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());