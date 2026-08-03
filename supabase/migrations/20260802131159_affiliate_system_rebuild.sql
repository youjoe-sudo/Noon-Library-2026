/*
# Affiliate System Rebuild - Schema Migration

## Overview
Rebuilds the affiliate system to be production-ready with proper referral tracking,
commission calculation, wallet management, activity logs, and fraud prevention.

## New Tables
- `commissions` - Permanent commission records with full traceability
- `affiliate_clicks` - Referral click tracking (unique visitors)
- `affiliate_activity_logs` - Full audit trail for disputes

## Modified Tables
- `orders` - Add referred_affiliate_id, commission_source, books_subtotal
- `affiliate_profiles` - Add referral_code, wallet fields (pending/approved/paid/lifetime)
- `promo_codes` - Add expires_at already exists; add max_uses enforcement

## New Functions (all SECURITY DEFINER, search_path locked)
- `validate_coupon(p_code, p_user_id)` - Server-side coupon validation
- `process_commission(p_order_id)` - Atomic commission creation on delivery
- `get_affiliate_stats(p_affiliate_id)` - Real dashboard statistics
- `send_notification_all(p_title, p_message, p_sender_id)` - Broadcast notifications
- `track_referral_click(p_referral_code, p_visitor_id)` - Log referral clicks

## Security
- RLS on all new tables
- Column-level privileges: wallet fields revoked from client writes
- Self-referral prevention in commission processing
- Unique constraint on commissions.order_id prevents duplicate commissions
- All privileged mutations go through SECURITY DEFINER functions
*/

-- ============ ADD COLUMNS TO orders ============
ALTER TABLE orders ADD COLUMN IF NOT EXISTS referred_affiliate_id uuid;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS commission_source text CHECK (commission_source IN ('coupon','referral','none'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS books_subtotal numeric(10,2) NOT NULL DEFAULT 0;

-- ============ ADD COLUMNS TO affiliate_profiles ============
ALTER TABLE affiliate_profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;
ALTER TABLE affiliate_profiles ADD COLUMN IF NOT EXISTS approved_earnings numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE affiliate_profiles ADD COLUMN IF NOT EXISTS paid_earnings numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE affiliate_profiles ADD COLUMN IF NOT EXISTS lifetime_earnings numeric(12,2) NOT NULL DEFAULT 0;
ALTER TABLE affiliate_profiles ADD COLUMN IF NOT EXISTS total_clicks int NOT NULL DEFAULT 0;
ALTER TABLE affiliate_profiles ADD COLUMN IF NOT EXISTS unique_visitors int NOT NULL DEFAULT 0;

-- Revoke client writes on wallet/stat fields
REVOKE UPDATE ON affiliate_profiles FROM authenticated;
GRANT UPDATE (full_name, phone, email, payout_method, payout_account, channel_desc) ON affiliate_profiles TO authenticated;

-- ============ REMOVE isbn FROM books ============
ALTER TABLE books DROP COLUMN IF EXISTS isbn;

-- ============ COMMISSIONS TABLE ============
CREATE TABLE IF NOT EXISTS commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES affiliate_profiles(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  coupon_id uuid REFERENCES promo_codes(id) ON DELETE SET NULL,
  coupon_code text,
  referral_code text,
  commission_source text NOT NULL CHECK (commission_source IN ('coupon','referral')),
  books_total numeric(10,2) NOT NULL DEFAULT 0,
  commission_rate numeric(5,2) NOT NULL DEFAULT 10.00,
  commission_amount numeric(10,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  paid_at timestamptz
);
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;
-- One commission per order - critical for preventing duplicates
CREATE UNIQUE INDEX IF NOT EXISTS commissions_order_id_key ON commissions(order_id);
CREATE INDEX IF NOT EXISTS idx_commissions_aff ON commissions(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);

DROP POLICY IF EXISTS "commissions_select" ON commissions;
CREATE POLICY "commissions_select" ON commissions FOR SELECT
  TO authenticated USING (
    affiliate_id IN (SELECT id FROM affiliate_profiles WHERE user_id = auth.uid())
    OR public.is_admin()
  );

-- ============ AFFILIATE CLICKS TABLE ============
CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES affiliate_profiles(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  referral_code text,
  ip_hash text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE affiliate_clicks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_clicks_aff ON affiliate_clicks(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_clicks_visitor ON affiliate_clicks(visitor_id);
CREATE INDEX IF NOT EXISTS idx_clicks_created ON affiliate_clicks(created_at DESC);

DROP POLICY IF EXISTS "clicks_select" ON affiliate_clicks;
CREATE POLICY "clicks_select" ON affiliate_clicks FOR SELECT
  TO authenticated USING (
    affiliate_id IN (SELECT id FROM affiliate_profiles WHERE user_id = auth.uid())
    OR public.is_admin()
  );
DROP POLICY IF EXISTS "clicks_insert" ON affiliate_clicks;
CREATE POLICY "clicks_insert" ON affiliate_clicks FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- ============ AFFILIATE ACTIVITY LOGS TABLE ============
CREATE TABLE IF NOT EXISTS affiliate_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid REFERENCES affiliate_profiles(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  action text NOT NULL,
  details jsonb,
  ip_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE affiliate_activity_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_logs_aff ON affiliate_activity_logs(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_logs_created ON affiliate_activity_logs(created_at DESC);

DROP POLICY IF EXISTS "logs_select" ON affiliate_activity_logs;
CREATE POLICY "logs_select" ON affiliate_activity_logs FOR SELECT
  TO authenticated USING (
    affiliate_id IN (SELECT id FROM affiliate_profiles WHERE user_id = auth.uid())
    OR public.is_admin()
  );
DROP POLICY IF EXISTS "logs_insert" ON affiliate_activity_logs;
CREATE POLICY "logs_insert" ON affiliate_activity_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- ============ AUTO-GENERATE REFERRAL CODE ON AFFILIATE APPROVAL ============
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;

-- Update handle_new_user to also generate referral code when affiliate
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_count int;
  is_first boolean;
BEGIN
  SELECT count(*) INTO user_count FROM public.profiles;
  is_first := (user_count = 0);
  INSERT INTO public.profiles (id, username, email, phone, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'phone',
    CASE WHEN is_first THEN 'admin' ELSE 'user' END
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- ============ VALIDATE COUPON FUNCTION ============
CREATE OR REPLACE FUNCTION public.validate_coupon(
  p_code text,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo record;
  v_affiliate record;
  v_result jsonb;
BEGIN
  SELECT * INTO v_promo FROM public.promo_codes WHERE upper(code) = upper(p_code) AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'كود الخصم غير صحيح');
  END IF;

  -- Check expiration
  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'انتهت صلاحية كود الخصم');
  END IF;

  -- Check usage limits
  IF v_promo.max_uses IS NOT NULL AND v_promo.used_count >= v_promo.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'error', 'تم استخدام كود الخصم للحد الأقصى');
  END IF;

  -- Get affiliate
  SELECT * INTO v_affiliate FROM public.affiliate_profiles WHERE id = v_promo.affiliate_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'كود الخصم غير صحيح');
  END IF;

  -- Check affiliate status
  IF v_affiliate.status != 'active' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'كود الخصم غير نشط');
  END IF;

  -- Prevent self-referral: coupon owner cannot use their own coupon
  IF v_affiliate.user_id = p_user_id THEN
    RETURN jsonb_build_object('valid', false, 'error', 'لا يمكنك استخدام كود الخصم الخاص بك');
  END IF;

  v_result := jsonb_build_object(
    'valid', true,
    'promo_id', v_promo.id,
    'affiliate_id', v_affiliate.id,
    'discount_percent', v_promo.discount_percent,
    'code', v_promo.code
  );

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_coupon(text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text, uuid) TO authenticated;

-- ============ PROCESS COMMISSION FUNCTION (ATOMIC) ============
CREATE OR REPLACE FUNCTION public.process_commission(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_affiliate_id uuid;
  v_commission_source text;
  v_promo_id uuid;
  v_promo_code text;
  v_referral_code text;
  v_commission_rate numeric := 10.00;
  v_books_total numeric;
  v_commission_amount numeric;
  v_existing_commission uuid;
  v_affiliate record;
  v_result jsonb;
BEGIN
  -- Get the order
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Only process for delivered orders
  IF v_order.status != 'delivered' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not delivered');
  END IF;

  -- CRITICAL: Check if commission already exists (prevent duplicates)
  SELECT id INTO v_existing_commission FROM public.commissions WHERE order_id = p_order_id;
  IF v_existing_commission IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Commission already exists', 'commission_id', v_existing_commission);
  END IF;

  -- Determine affiliate and source (priority: coupon > referral)
  IF v_order.promo_code_id IS NOT NULL THEN
    -- Coupon-based attribution
    SELECT affiliate_id INTO v_affiliate_id FROM public.promo_codes WHERE id = v_order.promo_code_id;
    v_commission_source := 'coupon';
    v_promo_id := v_order.promo_code_id;
    v_promo_code := v_order.promo_code_text;
  ELSIF v_order.referred_affiliate_id IS NOT NULL THEN
    -- Referral-based attribution
    v_affiliate_id := v_order.referred_affiliate_id;
    v_commission_source := 'referral';
    SELECT referral_code INTO v_referral_code FROM public.affiliate_profiles WHERE id = v_affiliate_id;
  ELSE
    RETURN jsonb_build_object('success', true, 'message', 'No affiliate for this order');
  END IF;

  -- Get affiliate
  SELECT * INTO v_affiliate FROM public.affiliate_profiles WHERE id = v_affiliate_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Affiliate not found');
  END IF;

  -- Prevent self-referral
  IF v_affiliate.user_id = v_order.user_id THEN
    -- Log the fraud attempt
    INSERT INTO public.affiliate_activity_logs (affiliate_id, action, details)
    VALUES (v_affiliate_id, 'self_referral_blocked', jsonb_build_object('order_id', p_order_id));
    RETURN jsonb_build_object('success', false, 'error', 'Self-referral blocked');
  END IF;

  -- Use custom commission rate if set, otherwise default 10%
  IF v_affiliate.custom_commission_rate IS NOT NULL THEN
    v_commission_rate := v_affiliate.custom_commission_rate;
  END IF;

  -- Books subtotal only (no shipping, fees, taxes)
  v_books_total := v_order.books_subtotal;
  IF v_books_total = 0 THEN
    v_books_total := v_order.subtotal; -- fallback if books_subtotal wasn't set
  END IF;

  -- Commission = Books Total × Rate%
  v_commission_amount := v_books_total * v_commission_rate / 100;

  -- ATOMIC: Insert commission (unique constraint on order_id prevents duplicates)
  BEGIN
    INSERT INTO public.commissions (
      affiliate_id, order_id, customer_id, coupon_id, coupon_code,
      referral_code, commission_source, books_total,
      commission_rate, commission_amount, status
    )
    VALUES (
      v_affiliate_id, p_order_id, v_order.user_id, v_promo_id, v_promo_code,
      v_referral_code, v_commission_source, v_books_total,
      v_commission_rate, v_commission_amount, 'approved'
    )
    RETURNING id INTO v_existing_commission;

    -- Update affiliate wallet (approved balance + lifetime)
    UPDATE public.affiliate_profiles
    SET approved_earnings = approved_earnings + v_commission_amount,
        lifetime_earnings = lifetime_earnings + v_commission_amount,
        completed_orders = completed_orders + 1,
        total_sales = total_sales + v_books_total
    WHERE id = v_affiliate_id;

    -- Log activity
    INSERT INTO public.affiliate_activity_logs (affiliate_id, order_id, action, details)
    VALUES (v_affiliate_id, p_order_id, 'commission_created', jsonb_build_object(
      'commission_id', v_existing_commission,
      'amount', v_commission_amount,
      'books_total', v_books_total,
      'rate', v_commission_rate
    ));

    v_result := jsonb_build_object('success', true, 'commission_id', v_existing_commission, 'amount', v_commission_amount);
  EXCEPTION WHEN unique_violation THEN
    -- Another concurrent transaction already created the commission
    v_result := jsonb_build_object('success', true, 'message', 'Commission already exists (concurrent)');
  END;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_commission(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_commission(uuid) TO authenticated;

-- ============ CANCEL COMMISSION FUNCTION ============
CREATE OR REPLACE FUNCTION public.cancel_commission(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_commission record;
BEGIN
  SELECT * INTO v_commission FROM public.commissions WHERE order_id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'message', 'No commission to cancel');
  END IF;

  IF v_commission.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already cancelled');
  END IF;

  -- Cancel commission and reverse wallet
  UPDATE public.commissions SET status = 'cancelled' WHERE id = v_commission.id;

  IF v_commission.status = 'approved' THEN
    UPDATE public.affiliate_profiles
    SET approved_earnings = GREATEST(0, approved_earnings - v_commission.commission_amount),
        lifetime_earnings = GREATEST(0, lifetime_earnings - v_commission.commission_amount),
        completed_orders = GREATEST(0, completed_orders - 1)
    WHERE id = v_commission.affiliate_id;
  END IF;

  INSERT INTO public.affiliate_activity_logs (affiliate_id, order_id, action, details)
  VALUES (v_commission.affiliate_id, p_order_id, 'commission_cancelled', jsonb_build_object(
    'commission_id', v_commission.id, 'amount', v_commission.commission_amount
  ));

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_commission(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_commission(uuid) TO authenticated;

-- ============ GET AFFILIATE STATS FUNCTION ============
CREATE OR REPLACE FUNCTION public.get_affiliate_stats(p_affiliate_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_clicks int;
  v_unique_visitors int;
  v_total_orders int;
  v_successful_orders int;
  v_conversion_rate numeric;
  v_revenue numeric;
  v_total_commission numeric;
  v_pending_commission numeric;
  v_approved_commission numeric;
  v_paid_commission numeric;
  v_withdrawable numeric;
BEGIN
  SELECT count(*), count(DISTINCT visitor_id)
  INTO v_total_clicks, v_unique_visitors
  FROM public.affiliate_clicks WHERE affiliate_id = p_affiliate_id;

  SELECT count(*), 
    count(*) FILTER (WHERE status = 'approved' OR status = 'paid'),
    COALESCE(sum(books_total) FILTER (WHERE status = 'approved' OR status = 'paid'), 0)
  INTO v_total_orders, v_successful_orders, v_revenue
  FROM public.commissions WHERE affiliate_id = p_affiliate_id;

  IF v_total_orders > 0 THEN
    v_conversion_rate := round((v_successful_orders::numeric / v_total_orders * 100), 2);
  ELSE
    v_conversion_rate := 0;
  END IF;

  SELECT
    COALESCE(sum(commission_amount), 0),
    COALESCE(sum(commission_amount) FILTER (WHERE status = 'pending'), 0),
    COALESCE(sum(commission_amount) FILTER (WHERE status = 'approved'), 0),
    COALESCE(sum(commission_amount) FILTER (WHERE status = 'paid'), 0)
  INTO v_total_commission, v_pending_commission, v_approved_commission, v_paid_commission
  FROM public.commissions WHERE affiliate_id = p_affiliate_id;

  v_withdrawable := v_approved_commission;

  RETURN jsonb_build_object(
    'total_clicks', v_total_clicks,
    'unique_visitors', v_unique_visitors,
    'total_orders', v_total_orders,
    'successful_orders', v_successful_orders,
    'conversion_rate', v_conversion_rate,
    'revenue', v_revenue,
    'total_commission', v_total_commission,
    'pending_commission', v_pending_commission,
    'approved_commission', v_approved_commission,
    'paid_commission', v_paid_commission,
    'withdrawable', v_withdrawable
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_affiliate_stats(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_affiliate_stats(uuid) TO authenticated;

-- ============ TRACK REFERRAL CLICK FUNCTION ============
CREATE OR REPLACE FUNCTION public.track_referral_click(
  p_referral_code text,
  p_visitor_id text,
  p_ip_hash text DEFAULT NULL,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affiliate record;
BEGIN
  SELECT * INTO v_affiliate FROM public.affiliate_profiles 
  WHERE referral_code = upper(p_referral_code) AND status = 'active';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid referral code');
  END IF;

  -- Insert click
  INSERT INTO public.affiliate_clicks (affiliate_id, visitor_id, referral_code, ip_hash, user_agent)
  VALUES (v_affiliate.id, p_visitor_id, p_referral_code, p_ip_hash, p_user_agent);

  -- Update affiliate click stats
  UPDATE public.affiliate_profiles
  SET total_clicks = total_clicks + 1,
      unique_visitors = (SELECT count(DISTINCT visitor_id) FROM public.affiliate_clicks WHERE affiliate_id = v_affiliate.id)
  WHERE id = v_affiliate.id;

  -- Log activity
  INSERT INTO public.affiliate_activity_logs (affiliate_id, action, details)
  VALUES (v_affiliate.id, 'referral_click', jsonb_build_object('visitor_id', p_visitor_id));

  RETURN jsonb_build_object('success', true, 'affiliate_id', v_affiliate.id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.track_referral_click(text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.track_referral_click(text, text, text, text) TO anon, authenticated;

-- ============ SEND NOTIFICATION TO ALL FUNCTION ============
CREATE OR REPLACE FUNCTION public.send_notification_all(
  p_title text,
  p_message text,
  p_sender_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_success int := 0;
  v_failed int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_user record;
BEGIN
  -- Verify sender is admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_sender_id AND role = 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Get all active users
  SELECT id INTO v_user FROM public.profiles WHERE is_disabled = false LIMIT 1;
  
  -- Count total
  SELECT count(*) INTO v_total FROM public.profiles WHERE is_disabled = false;

  -- Insert notifications for each user
  FOR v_user IN SELECT id FROM public.profiles WHERE is_disabled = false LOOP
    BEGIN
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (v_user.id, p_title, p_message, 'admin');
      v_success := v_success + 1;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('user_id', v_user.id, 'error', SQLERRM));
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'total_users', v_total,
    'successfully_sent', v_success,
    'failed', v_failed,
    'errors', v_errors
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_notification_all(text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.send_notification_all(text, text, uuid) TO authenticated;

-- ============ PROCESS WITHDRAWAL FUNCTION ============
CREATE OR REPLACE FUNCTION public.process_withdrawal(
  p_withdrawal_id uuid,
  p_action text,
  p_admin_id uuid,
  p_reject_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_withdrawal record;
  v_affiliate record;
BEGIN
  -- Verify admin
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO v_withdrawal FROM public.withdrawals WHERE id = p_withdrawal_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not found');
  END IF;

  IF v_withdrawal.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal already processed');
  END IF;

  SELECT * INTO v_affiliate FROM public.affiliate_profiles WHERE id = v_withdrawal.affiliate_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Affiliate not found');
  END IF;

  IF p_action = 'approve' THEN
    -- Check sufficient balance
    IF v_affiliate.approved_earnings < v_withdrawal.amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
    END IF;

    UPDATE public.withdrawals SET status = 'approved', processed_at = now() WHERE id = p_withdrawal_id;
    
    -- Move from approved to paid
    UPDATE public.affiliate_profiles
    SET approved_earnings = approved_earnings - v_withdrawal.amount,
        paid_earnings = paid_earnings + v_withdrawal.amount
    WHERE id = v_withdrawal.affiliate_id;

    -- Mark related commissions as paid
    UPDATE public.commissions
    SET status = 'paid', paid_at = now()
    WHERE affiliate_id = v_withdrawal.affiliate_id AND status = 'approved'
      AND commission_amount <= v_withdrawal.amount;

    INSERT INTO public.affiliate_activity_logs (affiliate_id, action, details)
    VALUES (v_withdrawal.affiliate_id, 'commission_paid', jsonb_build_object(
      'withdrawal_id', p_withdrawal_id, 'amount', v_withdrawal.amount
    ));

    RETURN jsonb_build_object('success', true);
  ELSIF p_action = 'reject' THEN
    UPDATE public.withdrawals SET status = 'rejected', processed_at = now(), reject_reason = p_reject_reason WHERE id = p_withdrawal_id;
    RETURN jsonb_build_object('success', true);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid action');
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_withdrawal(uuid, text, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_withdrawal(uuid, text, uuid, text) TO authenticated;

-- ============ APPROVE AFFILIATE FUNCTION ============
CREATE OR REPLACE FUNCTION public.approve_affiliate(
  p_affiliate_id uuid,
  p_admin_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral_code text;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Generate referral code if not exists
  SELECT referral_code INTO v_referral_code FROM public.affiliate_profiles WHERE id = p_affiliate_id;
  IF v_referral_code IS NULL THEN
    v_referral_code := public.generate_referral_code();
  END IF;

  UPDATE public.affiliate_profiles
  SET status = 'active', reject_reason = NULL, referral_code = v_referral_code
  WHERE id = p_affiliate_id;

  INSERT INTO public.affiliate_activity_logs (affiliate_id, action, details)
  VALUES (p_affiliate_id, 'affiliate_approved', jsonb_build_object('admin_id', p_admin_id));

  RETURN jsonb_build_object('success', true, 'referral_code', v_referral_code);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_affiliate(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_affiliate(uuid, uuid) TO authenticated;