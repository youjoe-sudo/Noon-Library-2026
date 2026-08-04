/*
# Affiliate Auto-Code System + Settings System Upgrade

## 1. Affiliate Code Auto-Generation
- Update approve_affiliate to auto-generate a unique NOON-XXXXXX code on approval
- Format: NOON- + 6 alphanumeric chars (uppercase)
- Code is permanent once assigned
- Backfill: generate codes for existing active affiliates who don't have one

## 2. Settings Table Upgrade
- Add updated_at, updated_by, type columns to settings table
- Add update_setting SECURITY DEFINER function (admin only, records who/when)
- Add default theme/font/content settings

## 3. Default Settings Seeds
- site_name, tagline, footer_text, announcement_text
- theme_primary, theme_accent, theme_background, theme_card, theme_text, theme_border, theme_button
- font_primary, font_heading
- whatsapp_number, contact_email, facebook_url, instagram_url, telegram_url
- payment_instructions
*/

-- ============ UPDATE APPROVE AFFILIATE FUNCTION ============
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
  v_existing_code text;
  v_attempts int := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  -- Check if affiliate already has a valid code
  SELECT referral_code INTO v_existing_code FROM public.affiliate_profiles WHERE id = p_affiliate_id;
  
  IF v_existing_code IS NOT NULL AND v_existing_code != '' THEN
    v_referral_code := v_existing_code;
  ELSE
    -- Generate unique code: NOON-XXXXXX
    LOOP
      v_referral_code := 'NOON-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      v_attempts := v_attempts + 1;
      
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.affiliate_profiles 
        WHERE referral_code = v_referral_code AND id != p_affiliate_id
      ) OR v_attempts > 10;
    END LOOP;
  END IF;

  UPDATE public.affiliate_profiles
  SET status = 'active', reject_reason = NULL, referral_code = v_referral_code
  WHERE id = p_affiliate_id;

  INSERT INTO public.affiliate_activity_logs (affiliate_id, action, details)
  VALUES (p_affiliate_id, 'affiliate_approved', jsonb_build_object('admin_id', p_admin_id, 'referral_code', v_referral_code));

  RETURN jsonb_build_object('success', true, 'referral_code', v_referral_code);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.approve_affiliate(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_affiliate(uuid, uuid) TO authenticated;

-- ============ BACKFILL: Generate codes for existing active affiliates ============
DO $$
DECLARE
  v_aff record;
  v_code text;
  v_attempts int;
BEGIN
  FOR v_aff IN 
    SELECT id FROM public.affiliate_profiles 
    WHERE status = 'active' 
      AND (referral_code IS NULL OR referral_code = '')
  LOOP
    v_attempts := 0;
    LOOP
      v_code := 'NOON-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
      v_attempts := v_attempts + 1;
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.affiliate_profiles 
        WHERE referral_code = v_code AND id != v_aff.id
      ) OR v_attempts > 10;
    END LOOP;
    
    UPDATE public.affiliate_profiles SET referral_code = v_code WHERE id = v_aff.id;
  END LOOP;
END $$;

-- ============ SETTINGS TABLE UPGRADE ============
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS updated_by uuid;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS type text DEFAULT 'string';

-- ============ UPDATE SETTING FUNCTION ============
CREATE OR REPLACE FUNCTION public.update_setting(
  p_key text,
  p_value text,
  p_type text DEFAULT 'string'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  INSERT INTO public.settings (key, value, type, updated_at, updated_by)
  VALUES (p_key, p_value, p_type, now(), auth.uid())
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value, type = EXCLUDED.type, updated_at = now(), updated_by = auth.uid();

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_setting(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_setting(text, text, text) TO authenticated;

-- ============ SEED DEFAULT SETTINGS ============
INSERT INTO public.settings (key, value, type) VALUES
  ('site_name', 'مكتبة نون', 'string'),
  ('site_tagline', 'متجرك الأول للكتب العربية', 'string'),
  ('footer_text', '© 2025 مكتبة نون. جميع الحقوق محفوظة.', 'string'),
  ('announcement_text', 'شحن مجاني للطلبات فوق 500 ج.م', 'string'),
  ('theme_primary', '#1f7a4c', 'color'),
  ('theme_accent', '#f59e0b', 'color'),
  ('theme_background', '#f6f7f9', 'color'),
  ('theme_card', '#ffffff', 'color'),
  ('theme_text', '#1f2430', 'color'),
  ('theme_border', '#d5d9e0', 'color'),
  ('theme_button', '#1f7a4c', 'color'),
  ('font_primary', 'Cairo', 'string'),
  ('font_heading', 'Amiri', 'string'),
  ('whatsapp_number', '01021671068', 'string'),
  ('contact_email', 'noonlibrary.2026@outlook.com', 'string'),
  ('facebook_url', 'https://www.facebook.com/share/19UjSNobdA/', 'string'),
  ('instagram_url', 'https://www.instagram.com/noon_library123', 'string'),
  ('telegram_url', 'https://t.me/noonlibrary23', 'string'),
  ('payment_instructions', 'حوّل المبلغ المطلوب إلى رقم فودافون كاش: 01021671068', 'string')
ON CONFLICT (key) DO NOTHING;

-- ============ GRANT SETTINGS ACCESS ============
GRANT SELECT ON public.settings TO authenticated;