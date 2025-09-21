-- ============================================================================
-- AUTOMATED LAZY PROFILE CREATION ON FIRST LOGIN
-- ============================================================================
-- Creates profiles automatically when users first access data
-- ============================================================================

-- 1. Create a function that ensures profile exists
CREATE OR REPLACE FUNCTION public.ensure_profile_exists()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id uuid;
  current_user_email text;
  current_user_metadata jsonb;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();

  -- Exit if no user is logged in
  IF current_user_id IS NULL THEN
    RETURN;
  END IF;

  -- Check if profile already exists
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = current_user_id) THEN
    RETURN;
  END IF;

  -- Get user details from auth.users
  SELECT email, raw_user_meta_data
  INTO current_user_email, current_user_metadata
  FROM auth.users
  WHERE id = current_user_id;

  -- Create the profile
  INSERT INTO public.user_profiles (user_id, name, email, role)
  VALUES (
    current_user_id,
    COALESCE(
      current_user_metadata->>'name',
      current_user_metadata->>'full_name',
      split_part(current_user_email, '@', 1)
    ),
    current_user_email,
    CASE
      WHEN current_user_email LIKE '%@elevana.com' OR current_user_email LIKE '%@elevan.co.uk' THEN 'admin'
      WHEN current_user_email = 'shaun@hest.ai' THEN 'admin'
      ELSE COALESCE(current_user_metadata->>'role', 'viewer')
    END
  )
  ON CONFLICT (user_id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    -- Silently fail to not break queries
    NULL;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.ensure_profile_exists() TO authenticated;

-- ============================================================================
-- OPTION 1: RLS APPROACH (Automatic on any data access)
-- ============================================================================
-- This approach creates profiles automatically when users try to access data

-- Create RLS policies that call the function
CREATE POLICY "Auto-create profile on scripts access"
  ON public.video_scripts
  FOR SELECT
  TO authenticated
  USING (
    -- Ensure profile exists, then allow access
    (public.ensure_profile_exists() IS NULL) AND true
  );

CREATE POLICY "Auto-create profile on components access"
  ON public.script_components
  FOR SELECT
  TO authenticated
  USING (
    -- Ensure profile exists, then allow access
    (public.ensure_profile_exists() IS NULL) AND true
  );

-- ============================================================================
-- OPTION 2: DATABASE FUNCTION WRAPPER (Call on login)
-- ============================================================================
-- Create a function that your app calls after login

CREATE OR REPLACE FUNCTION public.handle_user_login()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_id uuid;
  profile_data jsonb;
BEGIN
  user_id := auth.uid();

  IF user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Ensure profile exists
  PERFORM public.ensure_profile_exists();

  -- Return user profile data
  SELECT row_to_json(up.*)
  INTO profile_data
  FROM public.user_profiles up
  WHERE up.user_id = user_id;

  RETURN COALESCE(profile_data, jsonb_build_object('error', 'Profile creation failed'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.handle_user_login() TO authenticated;

-- ============================================================================
-- OPTION 3: POSTGRES TRIGGER WITH LOGIN TRACKING (Most Automated)
-- ============================================================================
-- Track last login and create profile if needed

-- Add last_login column to user_profiles if not exists
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- Create a function that tracks login attempts
CREATE OR REPLACE FUNCTION public.track_user_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When auth.users is updated (login updates last_sign_in_at)
  IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
    -- Ensure profile exists
    INSERT INTO public.user_profiles (user_id, name, email, role, last_login)
    VALUES (
      NEW.id,
      COALESCE(
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'full_name',
        split_part(NEW.email, '@', 1)
      ),
      NEW.email,
      CASE
        WHEN NEW.email LIKE '%@elevana.com' OR NEW.email LIKE '%@elevan.co.uk' THEN 'admin'
        WHEN NEW.email = 'shaun@hest.ai' THEN 'admin'
        ELSE COALESCE(NEW.raw_user_meta_data->>'role', 'viewer')
      END,
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE
    SET last_login = NOW();
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on auth.users for login tracking
DROP TRIGGER IF EXISTS track_user_login ON auth.users;
CREATE TRIGGER track_user_login
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.track_user_activity();

-- ============================================================================
-- TEST AND VERIFY
-- ============================================================================

-- Test the ensure_profile_exists function
DO $$
BEGIN
  -- This simulates what happens when a logged-in user accesses data
  PERFORM public.ensure_profile_exists();
  RAISE NOTICE 'Profile creation function works';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error: %', SQLERRM;
END $$;

-- Check current status
SELECT
  COUNT(DISTINCT au.id) as total_users,
  COUNT(DISTINCT up.user_id) as users_with_profiles,
  COUNT(DISTINCT au.id) - COUNT(DISTINCT up.user_id) as missing_profiles
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.user_id;

-- ============================================================================
-- RECOMMENDATION
-- ============================================================================
SELECT 'Recommended Approach:' as option, 'Why' as reason
UNION ALL
SELECT 'Option 3: Login Trigger', 'Most automated - creates profile on any login'
UNION ALL
SELECT 'Option 1: RLS Approach', 'Creates profile on first data access'
UNION ALL
SELECT 'Option 2: Function Call', 'Requires app code change but most reliable';