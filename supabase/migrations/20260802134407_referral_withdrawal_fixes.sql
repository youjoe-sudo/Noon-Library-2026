/*
# Referral System + Withdrawal Fixes

## 1. request_withdrawal function
- Prevents multiple active (pending/completed) withdrawal requests
- Validates amount > 0 and <= approved_earnings
- Prevents negative balances
- Atomic insert with row-level lock on affiliate profile

## 2. Fix get_affiliate_stats
- withdrawable should come from affiliate_profiles.approved_earnings (the real wallet)
  NOT from summing commissions, because process_withdrawal deducts from approved_earnings
  but doesn't change commission status to 'paid' for all of them at once.
- This ensures wallet shows real DB values after withdrawal.

## 3. Fix process_withdrawal
- Don't mark ALL approved commissions as paid — only mark enough to cover the withdrawal amount.
- This keeps the audit trail correct: individual commissions stay 'approved' until actually paid.
- The wallet balance (approved_earnings) is the source of truth, not commission status sum.
*/

-- ============ REQUEST WITHDRAWAL FUNCTION ============
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_affiliate_id uuid,
  p_amount numeric,
  p_payout_method text DEFAULT NULL,
  p_payout_account text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affiliate record;
  v_active_count int;
BEGIN
  -- Lock the affiliate row
  SELECT * INTO v_affiliate FROM public.affiliate_profiles WHERE id = p_affiliate_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Affiliate not found');
  END IF;

  IF v_affiliate.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Affiliate account is not active');
  END IF;

  -- Check for existing active withdrawal (pending or completed-waiting-payment)
  SELECT count(*) INTO v_active_count
  FROM public.withdrawals
  WHERE affiliate_id = p_affiliate_id
    AND status IN ('pending', 'approved', 'under_review');

  IF v_active_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have a withdrawal request being processed. Please wait until it is completed before submitting another request.');
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  IF p_amount > v_affiliate.approved_earnings THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient withdrawable balance');
  END IF;

  -- Create withdrawal request
  INSERT INTO public.withdrawals (affiliate_id, amount, payout_method, payout_account, status)
  VALUES (
    p_affiliate_id,
    p_amount,
    COALESCE(p_payout_method, v_affiliate.payout_method),
    COALESCE(p_payout_account, v_affiliate.payout_account),
    'pending'
  );

  -- Log activity
  INSERT INTO public.affiliate_activity_logs (affiliate_id, action, details)
  VALUES (p_affiliate_id, 'withdrawal_requested', jsonb_build_object('amount', p_amount));

  RETURN jsonb_build_object('success', true, 'message', 'Withdrawal request submitted');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_withdrawal(uuid, numeric, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(uuid, numeric, text, text) TO authenticated;

-- ============ FIX get_affiliate_stats ============
-- withdrawable now reads directly from affiliate_profiles.approved_earnings
-- This is the real wallet balance that gets deducted on withdrawal completion
CREATE OR REPLACE FUNCTION public.get_affiliate_stats(p_affiliate_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affiliate record;
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
  -- Get the affiliate profile (source of truth for wallet)
  SELECT * INTO v_affiliate FROM public.affiliate_profiles WHERE id = p_affiliate_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Affiliate not found');
  END IF;

  -- Click stats from affiliate_clicks table
  SELECT count(*), count(DISTINCT visitor_id)
  INTO v_total_clicks, v_unique_visitors
  FROM public.affiliate_clicks WHERE affiliate_id = p_affiliate_id;

  -- Order/commission stats from commissions table
  SELECT count(*),
    count(*) FILTER (WHERE status IN ('approved', 'paid')),
    COALESCE(sum(books_total) FILTER (WHERE status IN ('approved', 'paid')), 0)
  INTO v_total_orders, v_successful_orders, v_revenue
  FROM public.commissions WHERE affiliate_id = p_affiliate_id;

  IF v_total_orders > 0 THEN
    v_conversion_rate := round((v_successful_orders::numeric / v_total_orders * 100), 2);
  ELSE
    v_conversion_rate := 0;
  END IF;

  -- Commission breakdown from commissions table
  SELECT
    COALESCE(sum(commission_amount), 0),
    COALESCE(sum(commission_amount) FILTER (WHERE status = 'pending'), 0),
    COALESCE(sum(commission_amount) FILTER (WHERE status = 'approved'), 0),
    COALESCE(sum(commission_amount) FILTER (WHERE status = 'paid'), 0)
  INTO v_total_commission, v_pending_commission, v_approved_commission, v_paid_commission
  FROM public.commissions WHERE affiliate_id = p_affiliate_id;

  -- CRITICAL: withdrawable comes from the affiliate_profiles wallet (real DB value)
  -- This is the actual withdrawable balance after withdrawals are processed
  v_withdrawable := v_affiliate.approved_earnings;

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
    'withdrawable', v_withdrawable,
    'paid_earnings', v_affiliate.paid_earnings,
    'lifetime_earnings', v_affiliate.lifetime_earnings
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_affiliate_stats(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_affiliate_stats(uuid) TO authenticated;

-- ============ FIX process_withdrawal ============
-- Only mark enough commissions as 'paid' to cover the withdrawal amount (oldest first)
-- This preserves the audit trail for partial withdrawals
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
  v_remaining numeric;
  v_comm record;
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
    -- Double-check sufficient balance (could have changed since request)
    IF v_affiliate.approved_earnings < v_withdrawal.amount THEN
      RETURN jsonb_build_object('success', false, 'error', 'Insufficient approved balance');
    END IF;

    -- Deduct from approved_earnings, add to paid_earnings (atomic, prevents negative)
    UPDATE public.affiliate_profiles
    SET approved_earnings = approved_earnings - v_withdrawal.amount,
        paid_earnings = paid_earnings + v_withdrawal.amount
    WHERE id = v_withdrawal.affiliate_id;

    -- Mark withdrawal as completed with payment date
    UPDATE public.withdrawals
    SET status = 'completed', processed_at = now(), paid_at = now()
    WHERE id = p_withdrawal_id;

    -- Mark oldest approved commissions as 'paid' up to the withdrawal amount
    v_remaining := v_withdrawal.amount;
    FOR v_comm IN
      SELECT id, commission_amount FROM public.commissions
      WHERE affiliate_id = v_withdrawal.affiliate_id AND status = 'approved'
      ORDER BY created_at ASC
    LOOP
      IF v_remaining <= 0 THEN EXIT; END IF;
      IF v_comm.commission_amount <= v_remaining THEN
        UPDATE public.commissions SET status = 'paid', paid_at = now() WHERE id = v_comm.id;
        v_remaining := v_remaining - v_comm.commission_amount;
      ELSE
        -- Partial: this commission covers the remaining amount, mark as paid
        UPDATE public.commissions SET status = 'paid', paid_at = now() WHERE id = v_comm.id;
        v_remaining := 0;
      END IF;
    END LOOP;

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

-- ============ GRANT INSERT ON WITHDRAWALS TO AUTHENTICATED ============
-- The request_withdrawal function is SECURITY DEFINER so it runs as the owner,
-- but we also need the affiliate to be able to read their own withdrawals
GRANT SELECT ON withdrawals TO authenticated;

-- ============ GRANT INSERT ON affiliate_clicks and activity_logs ============
-- These are needed for the edge function (uses service role) and for client-side
-- activity logging during checkout
GRANT INSERT ON affiliate_activity_logs TO authenticated;
GRANT SELECT ON affiliate_activity_logs TO authenticated;
GRANT INSERT ON affiliate_clicks TO authenticated;