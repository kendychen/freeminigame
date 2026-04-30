-- 0021_fix_handle_new_user.sql — make profile auto-creation resilient
-- Two issues with the original trigger:
--   1. No SET search_path → can resolve 'profiles' against an unexpected
--      schema in some auth contexts.
--   2. Any error inside the function aborts the parent auth.users INSERT,
--      which surfaces as 'Database error saving new user' on Google OAuth.
-- Fix: pin search_path, qualify the table, and swallow non-critical errors
-- so signup still succeeds. The app re-upserts the profile on first action.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1),
      'User'
    ),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Don't block auth signup on a profile glitch — app re-upserts later.
    RAISE WARNING 'handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Ensure trigger is bound (idempotent)
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
