/*
# Auto-generate coupon code for affiliates

When an affiliate is approved (status changes to 'active'), automatically create
a promo code matching their referral code if one doesn't exist yet.

This ensures every active affiliate has both a referral URL and a coupon code.
*/

CREATE OR REPLACE FUNCTION public.approve_affiliate(p_affiliate_id uuid, p_admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_affiliate record;
  v_existing_promo uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_admin_id AND role = 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT * INTO v_affiliate FROM public.affiliate_profiles WHERE id = p_affiliate_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Affiliate not found');
  END IF;

  -- Update status to active
  UPDATE public.affiliate_profiles
  SET status = 'active', reject_reason = NULL
  WHERE id = p_affiliate_id;

  -- Auto-create a promo code matching the referral code if it doesn't exist
  IF v_affiliate.referral_code IS NOT NULL THEN
    SELECT id INTO v_existing_promo FROM public.promo_codes WHERE code = v_affiliate.referral_code;
    IF v_existing_promo IS NULL THEN
      INSERT INTO public.promo_codes (affiliate_id, code, type, discount_percent, is_active)
      VALUES (p_affiliate_id, v_affiliate.referral_code, 'promo', 10, true);
    END IF;
  END IF;

  -- Log activity
  INSERT INTO public.affiliate_activity_logs (affiliate_id, action, details)
  VALUES (p_affiliate_id, 'affiliate_approved', jsonb_build_object('admin_id', p_admin_id));

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_affiliate(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_affiliate(uuid, uuid) TO authenticated;

-- Also update promote_to_affiliate to auto-create a promo code
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

  UPDATE public.profiles SET role = 'affiliate' WHERE id = p_user_id;

  INSERT INTO public.affiliate_profiles (user_id, full_name, phone, email, payout_method, payout_account, status, referral_code)
  SELECT p_user_id, COALESCE(username, email), COALESCE(phone, ''), email, 'vodafone_cash', '', 'active', public.generate_referral_code()
  WHERE NOT EXISTS (SELECT 1 FROM public.affiliate_profiles WHERE user_id = p_user_id)
  RETURNING id, referral_code INTO v_affiliate_id, v_referral_code;

  -- Auto-create promo code
  IF v_affiliate_id IS NOT NULL AND v_referral_code IS NOT NULL THEN
    SELECT id INTO v_existing_promo FROM public.promo_codes WHERE code = v_referral_code;
    IF v_existing_promo IS NULL THEN
      INSERT INTO public.promo_codes (affiliate_id, code, type, discount_percent, is_active)
      VALUES (v_affiliate_id, v_referral_code, 'promo', 10, true);
    END IF;

    INSERT INTO public.affiliate_activity_logs (affiliate_id, action, details)
    VALUES (v_affiliate_id, 'promoted_to_affiliate', jsonb_build_object('admin_id', p_admin_id));
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.promote_to_affiliate(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.promote_to_affiliate(uuid, uuid) TO authenticated;

-- Also auto-create promo code when affiliate self-registers and gets approved later
-- The handle_new_user trigger already generates a referral_code on insert
-- We just need to ensure the promo code is created on approval (covered above)