-- ============================================================================
-- CORRECT APPROACH FOR USER PROFILE CREATION
-- ============================================================================
-- Before User Created hook is for VALIDATION, not profile creation
-- We need a different solution
-- ============================================================================

-- 1. Check what hooks are available in Supabase
SELECT 'Available Auth Hook Types:' as info
UNION ALL
SELECT '1. Before User Created - For validation/rejection (what we incorrectly used)'
UNION ALL
SELECT '2. After User Created - Would be ideal but may not exist'
UNION ALL
SELECT '3. Alternative: Handle in application code during signup'
UNION ALL
SELECT '4. Alternative: Scheduled job to sync profiles'
UNION ALL
SELECT '5. Alternative: Create profile on first login';

-- 2. Remove the incorrect Before User Created hook function
-- It shouldn't be creating profiles in a BEFORE hook
DROP FUNCTION IF EXISTS public.handle_new_user(jsonb) CASCADE;

-- 3. Create a simple function that can be called manually or from app
CREATE OR REPLACE FUNCTION public.ensure_user_has_profile(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_email text;
  user_metadata jsonb;
BEGIN
  -- Get user details
  SELECT email, raw_user_meta_data
  INTO user_email, user_metadata
  FROM auth.users
  WHERE id = user_id;

  -- Create profile if it doesn't exist
  INSERT INTO public.user_profiles (user_id, name, email, role)
  VALUES (
    user_id,
    COALESCE(
      user_metadata->>'name',
      user_metadata->>'full_name',
      split_part(user_email, '@', 1)
    ),
    user_email,
    CASE
      WHEN user_email LIKE '%@elevana.com' OR user_email LIKE '%@elevan.co.uk' THEN 'admin'
      WHEN user_email = 'shaun@hest.ai' THEN 'admin'
      ELSE COALESCE(user_metadata->>'role', 'viewer')
    END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = NOW();
END;
$$;

-- 4. Create a function to sync all missing profiles (can be run periodically)
CREATE OR REPLACE FUNCTION public.sync_user_profiles()
RETURNS TABLE(created_count int, updated_count int)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  created int := 0;
  updated int := 0;
BEGIN
  -- Create profiles for all users that don't have them
  WITH inserted AS (
    INSERT INTO public.user_profiles (user_id, name, email, role)
    SELECT
      au.id,
      COALESCE(
        au.raw_user_meta_data->>'name',
        au.raw_user_meta_data->>'full_name',
        split_part(au.email, '@', 1)
      ),
      au.email,
      CASE
        WHEN au.email LIKE '%@elevana.com' OR au.email LIKE '%@elevan.co.uk' THEN 'admin'
        WHEN au.email = 'shaun@hest.ai' THEN 'admin'
        ELSE COALESCE(au.raw_user_meta_data->>'role', 'viewer')
      END
    FROM auth.users au
    LEFT JOIN public.user_profiles up ON au.id = up.user_id
    WHERE up.user_id IS NULL
    ON CONFLICT (user_id) DO UPDATE SET
      email = EXCLUDED.email,
      updated_at = NOW()
    RETURNING user_id
  )
  SELECT COUNT(*) INTO created FROM inserted;

  RETURN QUERY SELECT created, 0;
END;
$$;

-- Grant appropriate permissions
GRANT EXECUTE ON FUNCTION public.ensure_user_has_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_user_profiles() TO authenticated, service_role;

-- 5. Run sync now to create any missing profiles
SELECT * FROM public.sync_user_profiles();

-- ============================================================================
-- RECOMMENDED APPROACH
-- ============================================================================
SELECT 'RECOMMENDATION:' as approach, 'How to implement' as details
UNION ALL
SELECT '1. Application Code', 'After successful signup/login, call ensure_user_has_profile() from your app'
UNION ALL
SELECT '2. Edge Function', 'Create a Supabase Edge Function that runs after signup'
UNION ALL
SELECT '3. Scheduled Job', 'Run sync_user_profiles() periodically (every few minutes)'
UNION ALL
SELECT '4. RLS Policy', 'Force profile creation on first data access'
UNION ALL
SELECT '5. Database Trigger', 'Use a DEFERRED trigger that runs at commit time (less likely to fail)';

-- 6. Show current status
SELECT
  COUNT(DISTINCT au.id) as total_users,
  COUNT(DISTINCT up.user_id) as users_with_profiles,
  COUNT(DISTINCT au.id) - COUNT(DISTINCT up.user_id) as missing_profiles
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.user_id;