/*
# Affiliate Code & Discount Code System Redesign

## Overview
Splits the single promo_codes system into two independent systems:
1. Affiliate Codes — link orders to affiliates for commission (no customer discount by default)
2. Discount Codes — admin-managed discount coupons with rich rules

## Changes

### 1. New columns on affiliate_profiles
- `customer_discount_percent` (numeric, default 0) — configurable customer discount per affiliate
- `admin_notes` (text, nullable) — admin-only notes per affiliate

### 2. New table: discount_codes
Admin-managed discount coupons, completely separate from affiliate codes.
- `id` uuid PK
- `code` text UNIQUE NOT NULL — the discount code string
- `discount_type` text NOT NULL — 'percentage' or 'fixed'
- `discount_value` numeric NOT NULL — percentage (0-100) or fixed amount
- `is_active` boolean default true
- `expires_at` timestamptz nullable
- `max_uses` int nullable — total usage cap
- `used_count` int default 0
- `uses_per_user` int nullable — max uses per single user
- `min_order_amount` numeric nullable — minimum subtotal required
- `applicable_book_ids` uuid[] nullable — restrict to specific books
- `applicable_category_ids` uuid[] nullable — restrict to specific categories
- `notes` text nullable — admin notes
- `total_discount_given` numeric default 0 — running total of discount provided
- `total_revenue` numeric default 0 — running total of order revenue using this code
- `created_at` timestamptz default now()
- `updated_at` timestamptz default now()

### 3. New table: discount_code_usages
Tracks each use of a discount code per user (for uses_per_user enforcement).
- `id` uuid PK
- `discount_code_id` uuid FK → discount_codes(id) ON DELETE CASCADE
- `user_id` uuid FK → auth.users(id) ON DELETE CASCADE
- `order_id` uuid FK → orders(id) ON DELETE CASCADE
- `created_at` timestamptz default now()

### 4. New columns on orders
- `discount_code_id` uuid nullable — FK to discount_codes
- `discount_code_text` text nullable — the code string used
- `affiliate_code` text nullable — the affiliate code entered (separate from referral link)
- `affiliate_discount_amount` numeric default 0 — discount given via affiliate customer discount

### 5. Functions
- `validate_affiliate_code(p_code, p_user_id)` — validates an affiliate referral code
- `validate_discount_code(p_code, p_user_id, p_subtotal, p_book_ids, p_category_ids)` — validates a discount code with all rules
- `validate_combined_codes(p_affiliate_code, p_discount_code, p_user_id, p_subtotal, p_book_ids, p_category_ids)` — validates both independently
- `update_affiliate_settings(p_affiliate_id, p_referral_code, p_commission_rate, p_customer_discount, p_status, p_notes)` — admin updates affiliate settings
- `run_admin_sql(p_sql)` — SECURITY DEFINER for admin SQL execution (SELECT only, with safeguards)

### 6. Security
- RLS enabled on discount_codes and discount_code_usages
- Admin CRUD on discount_codes
- Users can read active discount codes (for validation)
- Users can insert/read their own discount_code_usages
- run_admin_sql restricted to admin role, SELECT statements only
*/

-- ============ AFFILIATE PROFILES NEW COLUMNS ============
ALTER TABLE public.affiliate_profiles
  ADD COLUMN IF NOT EXISTS customer_discount_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_notes text;

-- ============ DISCOUNT CODES TABLE ============
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  discount_type text NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  max_uses int,
  used_count int NOT NULL DEFAULT 0,
  uses_per_user int,
  min_order_amount numeric,
  applicable_book_ids uuid[] DEFAULT '{}',
  applicable_category_ids uuid[] DEFAULT '{}',
  notes text,
  total_discount_given numeric NOT NULL DEFAULT 0,
  total_revenue numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_discount_codes" ON public.discount_codes;
CREATE POLICY "admin_all_discount_codes" ON public.discount_codes
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "user_read_active_discount_codes" ON public.discount_codes;
CREATE POLICY "user_read_active_discount_codes" ON public.discount_codes
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON public.discount_codes(upper(code));

-- ============ DISCOUNT CODE USAGES TABLE ============
CREATE TABLE IF NOT EXISTS public.discount_code_usages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id uuid NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.discount_code_usages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_usages" ON public.discount_code_usages;
CREATE POLICY "admin_all_usages" ON public.discount_code_usages
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "user_insert_own_usage" ON public.discount_code_usages;
CREATE POLICY "user_insert_own_usage" ON public.discount_code_usages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_read_own_usages" ON public.discount_code_usages;
CREATE POLICY "user_read_own_usages" ON public.discount_code_usages
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_usages_code ON public.discount_code_usages(discount_code_id);
CREATE INDEX IF NOT EXISTS idx_usages_user ON public.discount_code_usages(user_id);

-- ============ ORDERS NEW COLUMNS ============
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS discount_code_id uuid,
  ADD COLUMN IF NOT EXISTS discount_code_text text,
  ADD COLUMN IF NOT EXISTS affiliate_code text,
  ADD COLUMN IF NOT EXISTS affiliate_discount_amount numeric NOT NULL DEFAULT 0;

-- ============ VALIDATE AFFILIATE CODE FUNCTION ============
CREATE OR REPLACE FUNCTION public.validate_affiliate_code(
  p_code text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affiliate record;
BEGIN
  IF p_code IS NULL OR btrim(p_code) = '' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'لم يتم إدخال كود');
  END IF;

  SELECT * INTO v_affiliate FROM public.affiliate_profiles
  WHERE upper(referral_code) = upper(btrim(p_code));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'كود المسوق غير صحيح');
  END IF;

  IF v_affiliate.status != 'active' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'حساب المسوق غير نشط');
  END IF;

  IF v_affiliate.user_id = p_user_id THEN
    RETURN jsonb_build_object('valid', false, 'error', 'لا يمكنك استخدام كود المسوق الخاص بك');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'affiliate_id', v_affiliate.id,
    'referral_code', v_affiliate.referral_code,
    'customer_discount_percent', v_affiliate.customer_discount_percent,
    'commission_rate', COALESCE(v_affiliate.custom_commission_rate, 10.00)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_affiliate_code(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.validate_affiliate_code(text, uuid) TO authenticated;

-- ============ VALIDATE DISCOUNT CODE FUNCTION ============
CREATE OR REPLACE FUNCTION public.validate_discount_code(
  p_code text,
  p_user_id uuid,
  p_subtotal numeric DEFAULT 0,
  p_book_ids uuid[] DEFAULT '{}',
  p_category_ids uuid[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code record;
  v_user_usage_count int;
  v_discount_amount numeric;
BEGIN
  IF p_code IS NULL OR btrim(p_code) = '' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'لم يتم إدخال كود الخصم');
  END IF;

  SELECT * INTO v_code FROM public.discount_codes
  WHERE upper(code) = upper(btrim(p_code));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'كود الخصم غير صحيح');
  END IF;

  IF NOT v_code.is_active THEN
    RETURN jsonb_build_object('valid', false, 'error', 'كود الخصم غير نشط');
  END IF;

  IF v_code.expires_at IS NOT NULL AND v_code.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'انتهت صلاحية كود الخصم');
  END IF;

  IF v_code.max_uses IS NOT NULL AND v_code.used_count >= v_code.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'تم استخدام كود الخصم للحد الأقصى');
  END IF;

  IF v_code.min_order_amount IS NOT NULL AND p_subtotal < v_code.min_order_amount THEN
    RETURN jsonb_build_object('valid', false, 'error', 'الحد الأدنى للطلب ' || v_code.min_order_amount || ' ج.م');
  END IF;

  -- Check uses_per_user
  IF v_code.uses_per_user IS NOT NULL THEN
    SELECT count(*) INTO v_user_usage_count
    FROM public.discount_code_usages
    WHERE discount_code_id = v_code.id AND user_id = p_user_id;

    IF v_user_usage_count >= v_code.uses_per_user THEN
      RETURN jsonb_build_object('valid', false, 'error', 'لقد استخدمت هذا الكود الحد الأقصى المسموح');
    END IF;
  END IF;

  -- Check applicable books
  IF v_code.applicable_book_ids IS NOT NULL AND array_length(v_code.applicable_book_ids, 1) > 0 THEN
    IF NOT (p_book_ids && v_code.applicable_book_ids) THEN
      RETURN jsonb_build_object('valid', false, 'error', 'كود الخصم لا ينطبق على الكتب في السلة');
    END IF;
  END IF;

  -- Check applicable categories
  IF v_code.applicable_category_ids IS NOT NULL AND array_length(v_code.applicable_category_ids, 1) > 0 THEN
    IF NOT (p_category_ids && v_code.applicable_category_ids) THEN
      RETURN jsonb_build_object('valid', false, 'error', 'كود الخصم لا ينطبق على التصنيفات في السلة');
    END IF;
  END IF;

  -- Calculate discount amount
  IF v_code.discount_type = 'percentage' THEN
    v_discount_amount := p_subtotal * v_code.discount_value / 100;
  ELSE
    v_discount_amount := LEAST(v_code.discount_value, p_subtotal);
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'discount_code_id', v_code.id,
    'code', v_code.code,
    'discount_type', v_code.discount_type,
    'discount_value', v_code.discount_value,
    'discount_amount', v_discount_amount
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_discount_code(text, uuid, numeric, uuid[], uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.validate_discount_code(text, uuid, numeric, uuid[], uuid[]) TO authenticated;

-- ============ VALIDATE COMBINED CODES FUNCTION ============
CREATE OR REPLACE FUNCTION public.validate_combined_codes(
  p_affiliate_code text,
  p_discount_code text,
  p_user_id uuid,
  p_subtotal numeric DEFAULT 0,
  p_book_ids uuid[] DEFAULT '{}',
  p_category_ids uuid[] DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affiliate_result jsonb;
  v_discount_result jsonb;
  v_affiliate_discount numeric := 0;
  v_discount_code_discount numeric := 0;
  v_total_discount numeric := 0;
  v_affiliate_id uuid := NULL;
  v_affiliate_code_text text := NULL;
  v_discount_code_id uuid := NULL;
  v_discount_code_text text := NULL;
BEGIN
  -- Validate affiliate code if provided
  IF p_affiliate_code IS NOT NULL AND btrim(p_affiliate_code) != '' THEN
    v_affiliate_result := public.validate_affiliate_code(p_affiliate_code, p_user_id);
    IF (v_affiliate_result->>'valid')::boolean THEN
      v_affiliate_id := (v_affiliate_result->>'affiliate_id')::uuid;
      v_affiliate_code_text := v_affiliate_result->>'referral_code';
      v_affiliate_discount := p_subtotal * ((v_affiliate_result->>'customer_discount_percent')::numeric) / 100;
    ELSE
      -- Affiliate code invalid: return error but still try discount code
      v_affiliate_result := jsonb_build_object('valid', false, 'error', v_affiliate_result->>'error');
    END IF;
  END IF;

  -- Validate discount code if provided
  IF p_discount_code IS NOT NULL AND btrim(p_discount_code) != '' THEN
    v_discount_result := public.validate_discount_code(p_discount_code, p_user_id, p_subtotal, p_book_ids, p_category_ids);
    IF (v_discount_result->>'valid')::boolean THEN
      v_discount_code_id := (v_discount_result->>'discount_code_id')::uuid;
      v_discount_code_text := v_discount_result->>'code';
      v_discount_code_discount := (v_discount_result->>'discount_amount')::numeric;
    END IF;
  END IF;

  -- Total discount = affiliate customer discount + discount code discount
  -- These are independent and stack
  v_total_discount := v_affiliate_discount + v_discount_code_discount;
  -- Cap at subtotal
  v_total_discount := LEAST(v_total_discount, p_subtotal);

  RETURN jsonb_build_object(
    'affiliate', v_affiliate_result,
    'discount_code', v_discount_result,
    'affiliate_id', v_affiliate_id,
    'affiliate_code', v_affiliate_code_text,
    'affiliate_discount_amount', v_affiliate_discount,
    'discount_code_id', v_discount_code_id,
    'discount_code_text', v_discount_code_text,
    'discount_code_discount_amount', v_discount_code_discount,
    'total_discount_amount', v_total_discount,
    'final_total', p_subtotal - v_total_discount
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_combined_codes(text, text, uuid, numeric, uuid[], uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.validate_combined_codes(text, text, uuid, numeric, uuid[], uuid[]) TO authenticated;

-- ============ UPDATE AFFILIATE SETTINGS FUNCTION ============
CREATE OR REPLACE FUNCTION public.update_affiliate_settings(
  p_affiliate_id uuid,
  p_referral_code text DEFAULT NULL,
  p_commission_rate numeric DEFAULT NULL,
  p_customer_discount numeric DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_code text;
  v_code_conflict int;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Check referral code uniqueness if changing
  IF p_referral_code IS NOT NULL THEN
    SELECT referral_code INTO v_existing_code FROM public.affiliate_profiles WHERE id = p_affiliate_id;
    IF v_existing_code IS NULL OR upper(v_existing_code) != upper(btrim(p_referral_code)) THEN
      SELECT count(*) INTO v_code_conflict FROM public.affiliate_profiles
      WHERE upper(referral_code) = upper(btrim(p_referral_code)) AND id != p_affiliate_id;
      IF v_code_conflict > 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'كود المسوق مستخدم بالفعل');
      END IF;
    END IF;
  END IF;

  UPDATE public.affiliate_profiles
  SET
    referral_code = COALESCE(CASE WHEN p_referral_code IS NOT NULL THEN upper(btrim(p_referral_code)) ELSE referral_code END, referral_code),
    custom_commission_rate = COALESCE(p_commission_rate, custom_commission_rate),
    customer_discount_percent = COALESCE(p_customer_discount, customer_discount_percent),
    status = COALESCE(p_status, status),
    admin_notes = COALESCE(p_notes, admin_notes)
  WHERE id = p_affiliate_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_affiliate_settings(uuid, text, numeric, numeric, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_affiliate_settings(uuid, text, numeric, numeric, text, text) TO authenticated;

-- ============ RUN ADMIN SQL FUNCTION ============
-- Allows admin to run SELECT queries only, with safeguards
CREATE OR REPLACE FUNCTION public.run_admin_sql(p_sql text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized text;
  v_result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  IF p_sql IS NULL OR btrim(p_sql) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Empty query');
  END IF;

  -- Normalize: trim and collapse whitespace
  v_normalized := lower(btrim(p_sql));

  -- Safeguard: only allow SELECT statements
  IF v_normalized !~ '^\s*select\b' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only SELECT queries are allowed');
  END IF;

  -- Block dangerous keywords
  IF v_normalized ~ '\b(drop|delete|truncate|update|insert|alter|create|grant|revoke)\b' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Destructive keywords detected. Only SELECT is allowed');
  END IF;

  -- Execute the SELECT and return results as JSON
  BEGIN
    EXECUTE format('SELECT coalesce(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (%s) t', p_sql) INTO v_result;
    RETURN jsonb_build_object('success', true, 'data', v_result);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.run_admin_sql(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.run_admin_sql(text) TO authenticated;

-- ============ ADMIN SQL TABLE INFO FUNCTION ============
-- Returns table list with row counts and column info for the database browser
CREATE OR REPLACE FUNCTION public.get_table_info()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tables jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'table', tablename,
    'columns', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', a.attname,
        'type', pg_catalog.format_type(a.atttypid, a.atttypmod),
        'nullable', NOT a.attnotnull,
        'is_pk', EXISTS (
          SELECT 1 FROM pg_constraint c
          WHERE c.conrelid = a.attrelid AND c.contype = 'p'
            AND a.attnum = ANY(c.conkey)
        )
      )), '[]'::jsonb)
      FROM pg_attribute a
      WHERE a.attrelid = (pg_tables.schemaname || '.' || pg_tables.tablename)::regclass
        AND a.attnum > 0 AND NOT a.attisdropped
    )
  )), '[]'::jsonb)
  INTO v_tables
  FROM pg_tables
  WHERE schemaname = 'public';

  RETURN jsonb_build_object('success', true, 'tables', v_tables);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_table_info() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_table_info() TO authenticated;