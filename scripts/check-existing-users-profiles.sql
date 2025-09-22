-- ============================================================================
-- CHECK IF EXISTING AUTH USERS HAVE PROFILES
-- ============================================================================

-- Check which auth.users have profiles and which don't
SELECT
  au.id,
  au.email,
  au.created_at as user_created,
  up.user_id as profile_exists,
  up.role,
  up.name,
  CASE
    WHEN up.user_id IS NULL THEN '❌ MISSING PROFILE'
    ELSE '✅ Has Profile'
  END as status
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.user_id
ORDER BY au.created_at DESC;

-- Count summary
SELECT
  COUNT(DISTINCT au.id) as total_auth_users,
  COUNT(DISTINCT up.user_id) as users_with_profiles,
  COUNT(DISTINCT au.id) - COUNT(DISTINCT up.user_id) as missing_profiles
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.user_id;

-- ============================================================================
-- CREATE MISSING PROFILES FOR EXISTING USERS
-- ============================================================================
-- This will create profiles for any auth.users that don't have them

INSERT INTO public.user_profiles (user_id, name, email, role, created_at, updated_at)
SELECT
  au.id,
  COALESCE(
    au.raw_user_meta_data->>'name',
    au.raw_user_meta_data->>'full_name',
    split_part(au.email, '@', 1)
  ) as name,
  au.email,
  CASE
    WHEN au.email LIKE '%@elevana.com' OR au.email LIKE '%@elevan.co.uk' THEN 'admin'
    WHEN au.email = 'shaun@hest.ai' OR au.email = 'shaun.buswell@elevana.com' THEN 'admin'
    WHEN au.email = 'laura.manson@elevana.com' THEN 'admin'
    WHEN au.raw_user_meta_data->>'role' IS NOT NULL
      AND au.raw_user_meta_data->>'role' IN ('admin', 'internal', 'freelancer', 'client', 'viewer')
      THEN au.raw_user_meta_data->>'role'
    ELSE 'viewer'
  END as role,
  NOW(),
  NOW()
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.user_id
WHERE up.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Show the results
SELECT
  au.id,
  au.email,
  up.role,
  up.name,
  CASE
    WHEN up.user_id IS NULL THEN '❌ Still Missing'
    ELSE '✅ Profile Created'
  END as status
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.user_id
ORDER BY au.email;