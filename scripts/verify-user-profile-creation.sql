-- ============================================================================
-- VERIFY USER PROFILE CREATION IS WORKING
-- ============================================================================

-- 1. Check if new users have profiles
SELECT
  au.id,
  au.email,
  au.created_at as user_created,
  up.user_id as has_profile,
  up.role,
  CASE
    WHEN up.user_id IS NOT NULL THEN '✅ Profile exists'
    ELSE '❌ MISSING PROFILE - Need to create'
  END as status
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.user_id
WHERE au.created_at > NOW() - INTERVAL '1 hour'  -- Recent users
ORDER BY au.created_at DESC;

-- 2. Create profiles for any users missing them
INSERT INTO public.user_profiles (user_id, name, email, role, created_at, updated_at)
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
  END,
  NOW(),
  NOW()
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.user_id
WHERE up.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- 3. Verify the Auth Hook is still working
SELECT
  'Auth Hook Status' as check_item,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_proc
      WHERE proname = 'handle_new_user'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN '✅ Function exists'
    ELSE '❌ Function missing'
  END as status;

-- 4. Final count
SELECT
  'Total auth.users' as metric,
  COUNT(*) as count
FROM auth.users
UNION ALL
SELECT
  'Total user_profiles' as metric,
  COUNT(*) as count
FROM public.user_profiles
UNION ALL
SELECT
  'Users missing profiles' as metric,
  COUNT(*) as count
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.user_id
WHERE up.user_id IS NULL;

-- ============================================================================
-- REMINDER
-- ============================================================================
SELECT 'Next Steps:' as action
UNION ALL
SELECT '1. Verify the Auth Hook is enabled in Dashboard → Authentication → Hooks'
UNION ALL
SELECT '2. New users should automatically get profiles via the hook'
UNION ALL
SELECT '3. Test by creating another user and checking if profile is created';