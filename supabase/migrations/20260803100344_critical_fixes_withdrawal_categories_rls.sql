/*
# Critical Fixes

## 1. Fix withdrawal check constraint to include 'completed' status
## 2. Fix withdrawal validation - only block on 'pending' status
## 3. Fix process_withdrawal - set status to 'completed', deduct from wallet
## 4. Category management - add is_hidden column
## 5. Receipts storage bucket
## 6. get_rls_info function for admin SQL RLS page
*/

-- ============ FIX WITHDRAWALS CHECK CONSTRAINT ============
ALTER TABLE public.withdrawals DROP CONSTRAINT IF EXISTS withdrawals_status_check;
ALTER TABLE public.withdrawals ADD CONSTRAINT withdrawals_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'under_review'));

-- Migrate any existing 'approved' withdrawals to 'completed'
UPDATE public.withdrawals SET status = 'completed', paid_at = COALESCE(paid_at, processed_at, now()) WHERE status = 'approved';

-- ============ FIX REQUEST WITHDRAWAL ============
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
  SELECT * INTO v_affiliate FROM public.affiliate_profiles WHERE id = p_affiliate_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Affiliate not found');
  END IF;

  IF v_affiliate.status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Affiliate account is not active');
  END IF;

  -- Only block if there's a pending withdrawal
  SELECT count(*) INTO v_active_count
  FROM public.withdrawals
  WHERE affiliate_id = p_affiliate_id
    AND status = 'pending';

  IF v_active_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have a withdrawal request being processed. Please wait until it is completed before submitting another request.');
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  IF p_amount > v_affiliate.approved_earnings THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient withdrawable balance');
  END IF;

  INSERT INTO public.withdrawals (affiliate_id, amount, payout_method, payout_account, status)
  VALUES (
    p_affiliate_id,
    p_amount,
    COALESCE(p_payout_method, v_affiliate.payout_method),
    COALESCE(p_payout_account, v_affiliate.payout_account),
    'pending'
  );

  INSERT INTO public.affiliate_activity_logs (affiliate_id, action, details)
  VALUES (p_affiliate_id, 'withdrawal_requested', jsonb_build_object('amount', p_amount));

  RETURN jsonb_build_object('success', true, 'message', 'Withdrawal request submitted');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_withdrawal(uuid, numeric, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(uuid, numeric, text, text) TO authenticated;

-- ============ FIX PROCESS WITHDRAWAL ============
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

    -- Deduct from approved_earnings, add to paid_earnings
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
      UPDATE public.commissions SET status = 'paid', paid_at = now() WHERE id = v_comm.id;
      v_remaining := v_remaining - v_comm.commission_amount;
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

-- ============ CATEGORY MANAGEMENT ============
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false;

-- ============ RECEIPTS STORAGE BUCKET ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "receipts_upload_own" ON storage.objects;
CREATE POLICY "receipts_upload_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts');

DROP POLICY IF EXISTS "receipts_read_all" ON storage.objects;
CREATE POLICY "receipts_read_all" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'receipts');

DROP POLICY IF EXISTS "receipts_delete_own" ON storage.objects;
CREATE POLICY "receipts_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'receipts' AND owner = auth.uid());

-- ============ GET RLS INFO FUNCTION ============
CREATE OR REPLACE FUNCTION public.get_rls_info()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tables jsonb;
  v_policies jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'table', tablename,
    'rls_enabled', rowsecurity
  )), '[]'::jsonb)
  INTO v_tables
  FROM pg_tables
  WHERE schemaname = 'public';

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'table', tablename,
    'policy', policyname,
    'permissive', permissive,
    'roles', roles,
    'cmd', cmd,
    'using', qual,
    'with_check', with_check
  )), '[]'::jsonb)
  INTO v_policies
  FROM pg_policies
  WHERE schemaname = 'public';

  RETURN jsonb_build_object(
    'tables', v_tables,
    'policies', v_policies
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_rls_info() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_rls_info() TO authenticated;