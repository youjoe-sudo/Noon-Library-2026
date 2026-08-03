/*
# Critical Backend Fixes - Withdrawal, Rejected Status, Role Management

## 1. Fix Withdrawal Processing - deduct immediately, update all balances, prevent double-processing
## 2. Add Rejected Order Status - distinct from cancelled, with timestamp and reason
## 3. Role Management Functions - promote/demote/delete/suspend affiliates and admins
## 4. Revoke client writes on sensitive columns
*/

-- ============ ADD rejected_at TO ORDERS ============
ALTER TABLE orders ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

-- ============ ADD paid_at TO WITHDRAWALS ============
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS paid_at timestamptz;

-- ============ REBUILD process_withdrawal FUNCTION ============
DROP FUNCTION IF EXISTS public.process_withdrawal(uuid, text, uuid, text);

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
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO v_withdrawal FROM public.withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal not found');
  END IF;

  -- Prevent double-processing
  IF v_withdrawal.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal already processed', 'current_status', v_withdrawal.status);
  END IF;

  SELECT * INTO v_affiliate FROM public.affiliate_profiles WHERE id = v_withdrawal.affiliate_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Affiliate not found');
  END IF;

  IF p_action = 'approve' THEN
    IF v_affiliate.approved_earnings < v_withdrawal.amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient approved balance');
    END IF;

    -- Deduct from approved, add to paid
    UPDATE public.affiliate_profiles
    SET approved_earnings = approved_earnings - v_withdrawal.amount,
        paid_earnings = paid_earnings + v_withdrawal.amount
    WHERE id = v_withdrawal.affiliate_id;

    -- Mark withdrawal as completed with payment date
    UPDATE public.withdrawals
    SET status = 'completed', processed_at = now(), paid_at = now()
    WHERE id = p_withdrawal_id;

    -- Mark related approved commissions as paid
    UPDATE public.commissions
    SET status = 'paid', paid_at = now()
    WHERE affiliate_id = v_withdrawal.affiliate_id AND status = 'approved';

    INSERT INTO public.affiliate_activity_logs (affiliate_id, action, details)
    VALUES (v_withdrawal.affiliate_id, 'commission_paid', jsonb_build_object(
      'withdrawal_id', p_withdrawal_id, 'amount', v_withdrawal.amount, 'processed_by', p_admin_id
    ));

    RETURN jsonb_build_object('success', true, 'message', 'Withdrawal completed');

  ELSIF p_action = 'reject' THEN
    UPDATE public.withdrawals
    SET status = 'rejected', processed_at = now(), reject_reason = p_reject_reason
    WHERE id = p_withdrawal_id;

    INSERT INTO public.affiliate_activity_logs (affiliate_id, action, details)
    VALUES (v_withdrawal.affiliate_id, 'withdrawal_rejected', jsonb_build_object(
      'withdrawal_id', p_withdrawal_id, 'reason', p_reject_reason, 'rejected_by', p_admin_id
    ));

    RETURN jsonb_build_object('success', true, 'message', 'Withdrawal rejected');
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid action');
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_withdrawal(uuid, text, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_withdrawal(uuid, text, uuid, text) TO authenticated;

-- ============ REJECT ORDER FUNCTION ============
CREATE OR REPLACE FUNCTION public.reject_order(
  p_order_id uuid,
  p_admin_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_msg text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.status IN ('rejected', 'cancelled', 'delivered') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order cannot be rejected from current status');
  END IF;

  UPDATE public.orders
  SET status = 'rejected', reject_reason = p_reason, rejected_at = now(), updated_at = now()
  WHERE id = p_order_id;

  PERFORM public.cancel_commission(p_order_id);

  IF v_order.user_id IS NOT NULL THEN
    v_msg := CASE
      WHEN p_reason IS NOT NULL THEN 'طلبك رقم ' || v_order.order_number || ' تم رفضه. السبب: ' || p_reason
      ELSE 'طلبك رقم ' || v_order.order_number || ' تم رفضه. يرجى التواصل معنا للمزيد من التفاصيل.'
    END;
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (v_order.user_id, 'تم رفض طلبك', v_msg, 'order');
  END IF;

  IF v_order.referred_affiliate_id IS NOT NULL THEN
    INSERT INTO public.affiliate_activity_logs (affiliate_id, order_id, action, details)
    VALUES (v_order.referred_affiliate_id, p_order_id, 'order_rejected', jsonb_build_object(
      'reason', p_reason, 'rejected_by', p_admin_id
    ));
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reject_order(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.reject_order(uuid, uuid, text) TO authenticated;

-- ============ UPDATE ORDER STATUS FUNCTION ============
CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id uuid,
  p_new_status text,
  p_admin_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_msg text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF p_new_status = 'rejected' THEN
    RETURN public.reject_order(p_order_id, p_admin_id, p_reason);
  END IF;

  UPDATE public.orders SET status = p_new_status, updated_at = now() WHERE id = p_order_id;

  IF p_new_status = 'delivered' THEN
    PERFORM public.process_commission(p_order_id);
  END IF;

  IF p_new_status = 'cancelled' THEN
    PERFORM public.cancel_commission(p_order_id);
  END IF;

  IF v_order.user_id IS NOT NULL THEN
    v_msg := 'طلبك رقم ' || v_order.order_number || ' - ' || p_new_status;
    IF p_reason IS NOT NULL AND p_new_status = 'cancelled' THEN
      v_msg := v_msg || ' - ' || p_reason;
    END IF;
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (v_order.user_id, 'تحديث حالة الطلب', v_msg, 'order');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_order_status(uuid, text, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid, text, uuid, text) TO authenticated;

-- ============ ROLE MANAGEMENT FUNCTIONS ============

CREATE OR REPLACE FUNCTION public.promote_to_affiliate(p_user_id uuid, p_admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND role = 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot promote admin to affiliate');
  END IF;

  UPDATE public.profiles SET role = 'affiliate' WHERE id = p_user_id;

  INSERT INTO public.affiliate_profiles (user_id, full_name, phone, email, payout_method, payout_account, status, referral_code)
  SELECT p_user_id, COALESCE(username, email), COALESCE(phone, ''), email, 'vodafone_cash', '', 'active', public.generate_referral_code()
  WHERE NOT EXISTS (SELECT 1 FROM public.affiliate_profiles WHERE user_id = p_user_id);

  INSERT INTO public.affiliate_activity_logs (affiliate_id, action, details)
  SELECT id, 'promoted_to_affiliate', jsonb_build_object('admin_id', p_admin_id)
  FROM public.affiliate_profiles WHERE user_id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.promote_to_affiliate(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.promote_to_affiliate(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.demote_affiliate(p_user_id uuid, p_admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  UPDATE public.profiles SET role = 'user' WHERE id = p_user_id;
  UPDATE public.affiliate_profiles SET status = 'disabled' WHERE user_id = p_user_id;

  INSERT INTO public.affiliate_activity_logs (affiliate_id, action, details)
  SELECT id, 'demoted_from_affiliate', jsonb_build_object('admin_id', p_admin_id)
  FROM public.affiliate_profiles WHERE user_id = p_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.demote_affiliate(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.demote_affiliate(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.promote_to_admin(p_user_id uuid, p_admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  UPDATE public.profiles SET role = 'admin' WHERE id = p_user_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.promote_to_admin(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.promote_to_admin(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.demote_admin(p_user_id uuid, p_admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_count int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT count(*) INTO v_admin_count FROM public.profiles WHERE role = 'admin';
  IF v_admin_count <= 1 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot remove the last admin');
  END IF;

  UPDATE public.profiles SET role = 'user' WHERE id = p_user_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.demote_admin(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.demote_admin(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_affiliate(p_affiliate_id uuid, p_admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT user_id INTO v_user_id FROM public.affiliate_profiles WHERE id = p_affiliate_id;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Affiliate not found');
  END IF;

  INSERT INTO public.affiliate_activity_logs (affiliate_id, action, details)
  VALUES (p_affiliate_id, 'affiliate_deleted', jsonb_build_object('admin_id', p_admin_id, 'user_id', v_user_id));

  DELETE FROM public.affiliate_clicks WHERE affiliate_id = p_affiliate_id;
  DELETE FROM public.commissions WHERE affiliate_id = p_affiliate_id;
  DELETE FROM public.promo_codes WHERE affiliate_id = p_affiliate_id;
  DELETE FROM public.withdrawals WHERE affiliate_id = p_affiliate_id;
  DELETE FROM public.affiliate_activity_logs WHERE affiliate_id = p_affiliate_id;
  DELETE FROM public.affiliate_profiles WHERE id = p_affiliate_id;

  UPDATE public.profiles SET role = 'user' WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_affiliate(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_affiliate(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.suspend_affiliate(p_affiliate_id uuid, p_admin_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  UPDATE public.affiliate_profiles SET status = 'disabled', reject_reason = p_reason WHERE id = p_affiliate_id;

  INSERT INTO public.affiliate_activity_logs (affiliate_id, action, details)
  VALUES (p_affiliate_id, 'affiliate_suspended', jsonb_build_object('admin_id', p_admin_id, 'reason', p_reason));

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.suspend_affiliate(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.suspend_affiliate(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.disable_user(p_user_id uuid, p_admin_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_count int;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT count(*) INTO v_admin_count FROM public.profiles WHERE role = 'admin' AND NOT is_disabled;
  IF v_admin_count <= 1 AND EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND role = 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot disable the last active admin');
  END IF;

  UPDATE public.profiles SET is_disabled = true, disable_reason = p_reason WHERE id = p_user_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.disable_user(uuid, uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.disable_user(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.enable_user(p_user_id uuid, p_admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  UPDATE public.profiles SET is_disabled = false, disable_reason = NULL WHERE id = p_user_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enable_user(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.enable_user(uuid, uuid) TO authenticated;

-- ============ REVOKE CLIENT WRITES ON SENSITIVE COLUMNS ============
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (username, phone, avatar_url) ON profiles TO authenticated;

REVOKE UPDATE ON orders FROM authenticated;
GRANT UPDATE (notes) ON orders TO authenticated;

REVOKE UPDATE ON withdrawals FROM authenticated;
GRANT UPDATE (payout_method, payout_account) ON withdrawals TO authenticated;

REVOKE UPDATE ON commissions FROM authenticated;
REVOKE INSERT ON commissions FROM authenticated;
REVOKE DELETE ON commissions FROM authenticated;

REVOKE UPDATE ON affiliate_profiles FROM authenticated;
GRANT UPDATE (full_name, phone, email, payout_method, payout_account, channel_desc) ON affiliate_profiles TO authenticated;