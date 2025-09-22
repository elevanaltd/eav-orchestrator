-- ============================================================================
-- CHECK SUPABASE FREE TIER LIMITS AND COMMON ISSUES
-- ============================================================================

-- 1. Current usage statistics
SELECT 'Current Auth Users' as metric, COUNT(*) as count FROM auth.users
UNION ALL
SELECT 'User Profiles' as metric, COUNT(*) as count FROM public.user_profiles
UNION ALL
SELECT 'Total Tables' as metric, COUNT(*) as count FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
UNION ALL
SELECT 'Total Functions' as metric, COUNT(*) as count FROM pg_proc WHERE pronamespace NOT IN (SELECT oid FROM pg_namespace WHERE nspname IN ('pg_catalog', 'information_schema'));

-- 2. Check for duplicate emails (common cause of failures)
SELECT
  email,
  COUNT(*) as count
FROM auth.users
GROUP BY email
HAVING COUNT(*) > 1;

-- 3. Check if email confirmation is required but not set
SELECT
  key,
  value
FROM auth.flow_state
WHERE key IN ('email_confirmation_required', 'phone_confirmation_required')
LIMIT 10;

-- 4. Check instance ID (should be consistent)
SELECT DISTINCT
  instance_id,
  COUNT(*) as user_count
FROM auth.users
GROUP BY instance_id;

-- 5. Check for any auth.users without required fields
SELECT
  id,
  email,
  CASE
    WHEN email IS NULL THEN 'Missing email'
    WHEN instance_id IS NULL THEN 'Missing instance_id'
    WHEN aud IS NULL THEN 'Missing aud'
    WHEN role IS NULL THEN 'Missing role'
    ELSE 'OK'
  END as issue
FROM auth.users
WHERE email IS NULL
   OR instance_id IS NULL
   OR aud IS NULL
   OR role IS NULL;

-- 6. Test if we can at least update existing users
DO $$
DECLARE
  existing_user_id uuid;
BEGIN
  -- Get an existing user
  SELECT id INTO existing_user_id FROM auth.users LIMIT 1;

  IF existing_user_id IS NOT NULL THEN
    -- Try to update
    UPDATE auth.users
    SET updated_at = NOW()
    WHERE id = existing_user_id;

    RAISE NOTICE 'SUCCESS: Can update existing users';
  ELSE
    RAISE NOTICE 'No existing users to test update';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ERROR updating user: %', SQLERRM;
END $$;

-- 7. Check Auth configuration settings (if accessible)
SELECT 'Check these in Dashboard:' as reminder
UNION ALL
SELECT '1. Authentication → Settings → User Signups (should be enabled)'
UNION ALL
SELECT '2. Authentication → Providers → Email (should be enabled)'
UNION ALL
SELECT '3. Authentication → Settings → Confirm email (try disabling if enabled)'
UNION ALL
SELECT '4. Project Settings → Database → Connection Pooling (should be enabled)'
UNION ALL
SELECT '5. Project Settings → API → Service role key (should be visible)';

-- ============================================================================
-- COMMON FREE TIER LIMITS (as of 2024)
-- ============================================================================
SELECT 'Free Tier Limits:' as category, 'Limit' as value
UNION ALL
SELECT 'Total Users', '50,000 MAUs (Monthly Active Users)'
UNION ALL
SELECT 'Database Size', '500 MB'
UNION ALL
SELECT 'File Storage', '1 GB'
UNION ALL
SELECT 'Bandwidth', '2 GB'
UNION ALL
SELECT 'Edge Functions', '500,000 invocations'
UNION ALL
SELECT 'Note', 'User creation should NOT be limited on free tier';

-- 8. Alternative test: Try creating via a different method
SELECT 'Alternative Creation Methods:' as approach
UNION ALL
SELECT '1. Try using Supabase JS client from your app'
UNION ALL
SELECT '2. Try using Auth API directly with curl'
UNION ALL
SELECT '3. Try inviting a user instead of creating directly'
UNION ALL
SELECT '4. Try using Magic Link signup';

-- 9. Check for any custom auth hooks that might be interfering
SELECT
  hook_name,
  enabled,
  created_at
FROM auth.hooks
WHERE enabled = true;