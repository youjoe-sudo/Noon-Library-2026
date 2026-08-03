/*
# Discount Code Usage Increment Function
- Increments used_count, total_discount_given, total_revenue for a discount code
- Called after order creation when a discount code is used
*/

CREATE OR REPLACE FUNCTION public.increment_discount_code_usage(
  p_code_id uuid,
  p_discount_amount numeric,
  p_revenue numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.discount_codes
  SET
    used_count = used_count + 1,
    total_discount_given = total_discount_given + p_discount_amount,
    total_revenue = total_revenue + p_revenue,
    updated_at = now()
  WHERE id = p_code_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_discount_code_usage(uuid, numeric, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.increment_discount_code_usage(uuid, numeric, numeric) TO authenticated;

-- ============ GRANT ADMIN CRUD ON DISCOUNT CODES ============
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discount_codes TO authenticated;
GRANT SELECT, INSERT ON public.discount_code_usages TO authenticated;