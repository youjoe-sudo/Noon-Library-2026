/*
# Fix profiles RLS recursion + add is_admin helper

## Problem
The `profiles` SELECT policy uses `EXISTS (SELECT 1 FROM profiles p WHERE ...)`
which recursively triggers the same RLS policy, causing the profile fetch to
fail silently. After sign-in the app sees `profile = null` and treats the user
as not logged in.

## Changes
1. Create `is_admin()` SECURITY DEFINER function that checks the current
   user's role without being subject to RLS recursion.
2. Replace the recursive EXISTS in the profiles SELECT policy with `is_admin()`.
3. Revoke EXECUTE on `is_admin()` from anon/authenticated so it can only be
   used inside policies, not called directly via the API.
*/

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, authenticated;

-- Replace the recursive SELECT policy
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR public.is_admin());