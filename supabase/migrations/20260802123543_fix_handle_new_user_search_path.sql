/*
# Fix handle_new_user function - set search_path

## Problem
The `handle_new_user()` trigger function was missing a fixed `search_path`,
causing "Database error saving new user" on signup. Newer Supabase versions
require SECURITY DEFINER functions to have an explicit search_path.

## Changes
1. Recreate `handle_new_user()` with `SET search_path = public` clause.
2. Revoke EXECUTE from anon and authenticated roles (trigger-only function).
3. Re-attach the trigger.
*/

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();