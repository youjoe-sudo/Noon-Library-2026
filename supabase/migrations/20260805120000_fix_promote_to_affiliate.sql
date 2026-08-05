-- ============ FIX PROMOTE TO AFFILIATE FUNCTION ============
-- This migration fixes the promote_to_affiliate function to correctly bind columns
-- when there is no existing affiliate profile, and safely activates existing profiles
-- (such as pending or rejected applications) without creating duplicate records.

CREATE OR REPLACE FUNCTION public.promote_to_affiliate(p_user_id uuid, p_admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affiliate_id uuid;
  v_referral_code text;
  v_existing_promo uuid;
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

  -- 1. Update user role to affiliate in public.profiles
  UPDATE public.profiles SET role = 'affiliate' WHERE id = p_user_id;

  -- 2. Check if affiliate profile already exists
  SELECT id, referral_code INTO v_affiliate_id, v_referral_code
  FROM public.affiliate_profiles
  WHERE user_id = p_user_id;

  IF v_affiliate_id IS NOT NULL THEN
    -- If affiliate profile exists (e.g. they submitted an application previously),
    -- activate it, clear reject reason, and make sure referral code is generated.
    IF v_referral_code IS NULL THEN
      v_referral_code := public.generate_referral_code();
    END IF;

    UPDATE public.affiliate_profiles
    SET status = 'active',
        reject_reason = NULL,
        referral_code = v_referral_code
    WHERE id = v_affiliate_id;
  ELSE
    -- If no affiliate profile exists, generate code and insert a new active record
    v_referral_code := public.generate_referral_code();

    INSERT INTO public.affiliate_profiles (
      user_id, full_name, phone, email, payout_method, payout_account, status, referral_code
    )
    SELECT
      p_user_id,
      COALESCE(p.username, p.email),
      COALESCE(p.phone, ''),
      p.email,
      'vodafone_cash',
      '',
      'active',
      v_referral_code
    FROM public.profiles p
    WHERE p.id = p_user_id
    RETURNING id INTO v_affiliate_id;
  END IF;

  -- 3. Auto-create matching promo code in public.promo_codes if it doesn't exist
  IF v_affiliate_id IS NOT NULL AND v_referral_code IS NOT NULL THEN
    SELECT id INTO v_existing_promo FROM public.promo_codes WHERE code = v_referral_code;
    IF v_existing_promo IS NULL THEN
      INSERT INTO public.promo_codes (affiliate_id, code, type, discount_percent, is_active)
      VALUES (v_affiliate_id, v_referral_code, 'promo', 10, true);
    END IF;

    -- 4. Log the activity in affiliate_activity_logs
    INSERT INTO public.affiliate_activity_logs (affiliate_id, action, details)
    VALUES (v_affiliate_id, 'promoted_to_affiliate', jsonb_build_object('admin_id', p_admin_id));
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.promote_to_affiliate(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.promote_to_affiliate(uuid, uuid) TO authenticated;
