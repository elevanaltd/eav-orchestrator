-- ============================================================================
-- COMPREHENSIVE USER CREATION DIAGNOSTIC
-- ============================================================================
-- Run each section to identify the exact failure point
-- ============================================================================

-- ============================================================================
-- SECTION 1: CHECK BASIC TABLE STRUCTURE
-- ============================================================================
\echo '=== CHECKING TABLE STRUCTURE ==='

-- 1.1 Check if user_profiles table exists
SELECT
  'user_profiles table exists' as check_item,
  EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'user_profiles'
  ) as status;

-- 1.2 Show user_profiles structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'user_profiles'
ORDER BY ordinal_position;

-- 1.3 Check constraints on user_profiles
SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_class cl ON cl.oid = c.conrelid
JOIN pg_namespace n ON n.oid = cl.relnamespace
WHERE n.nspname = 'public'
AND cl.relname = 'user_profiles';

-- ============================================================================
-- SECTION 2: CHECK AUTH HOOK CONFIGURATION
-- ============================================================================
\echo '=== CHECKING AUTH HOOKS ==='

-- 2.1 Check if handle_new_user function exists
SELECT
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type,
  p.prosrc as function_source
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
AND p.proname LIKE 'handle_new_user%';

-- 2.2 Check permissions on the function
SELECT
  p.proname as function_name,
  r.rolname as role,
  has_function_privilege(r.rolname, p.oid, 'EXECUTE') as has_execute
FROM pg_proc p
CROSS JOIN pg_roles r
WHERE p.proname = 'handle_new_user'
AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND r.rolname IN ('postgres', 'anon', 'authenticated', 'service_role', 'supabase_auth_admin')
ORDER BY r.rolname;

-- 2.3 Check if auth hooks are configured (this might not show in SQL)
SELECT
  'Check Dashboard > Authentication > Hooks for configuration' as manual_check;

-- ============================================================================
-- SECTION 3: CHECK RLS POLICIES
-- ============================================================================
\echo '=== CHECKING RLS POLICIES ==='

-- 3.1 Check if RLS is enabled
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'user_profiles';

-- 3.2 List all policies on user_profiles
SELECT
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'user_profiles';

-- ============================================================================
-- SECTION 4: TEST DIRECT USER PROFILE CREATION
-- ============================================================================
\echo '=== TESTING DIRECT PROFILE CREATION ==='

-- 4.1 Try to create a test profile directly (will rollback)
BEGIN;
  -- Generate test UUID
  WITH test_data AS (
    SELECT gen_random_uuid() as test_id
  )
  INSERT INTO public.user_profiles (user_id, name, email, role)
  SELECT
    test_id,
    'Direct Test User',
    'direct-test@example.com',
    'viewer'
  FROM test_data
  RETURNING *;
ROLLBACK;

-- ============================================================================
-- SECTION 5: TEST AUTH HOOK FUNCTION MANUALLY
-- ============================================================================
\echo '=== TESTING AUTH HOOK FUNCTION ==='

-- 5.1 Test the hook function with sample data
SELECT handle_new_user('{
  "id": "99999999-9999-9999-9999-999999999999",
  "email": "hook-test@example.com",
  "raw_user_meta_data": {
    "name": "Hook Test User"
  }
}'::jsonb) as function_result;

-- 5.2 Check if the test profile was created
SELECT * FROM public.user_profiles
WHERE user_id = '99999999-9999-9999-9999-999999999999';

-- 5.3 Clean up test data
DELETE FROM public.user_profiles
WHERE user_id = '99999999-9999-9999-9999-999999999999';

-- ============================================================================
-- SECTION 6: CHECK FOR CONFLICTING TRIGGERS
-- ============================================================================
\echo '=== CHECKING FOR TRIGGERS ==='

-- 6.1 Check for any triggers on auth.users
SELECT
  trigger_name,
  event_manipulation,
  event_object_schema,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
AND event_object_table = 'users';

-- 6.2 Check for any triggers on user_profiles
SELECT
  trigger_name,
  event_manipulation,
  event_object_schema,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
AND event_object_table = 'user_profiles';

-- ============================================================================
-- SECTION 7: CHECK ERROR LOGS (if accessible)
-- ============================================================================
\echo '=== RECENT ERROR LOGS ==='

-- Note: This requires appropriate permissions
-- Check if we can access postgres logs
SELECT
  'Check Supabase Dashboard > Logs > Postgres Logs for errors' as manual_check,
  'Look for errors containing: handle_new_user, user_profiles, auth.users' as search_terms;

-- ============================================================================
-- SECTION 8: VERIFY FOREIGN KEY RELATIONSHIPS
-- ============================================================================
\echo '=== CHECKING FOREIGN KEYS ==='

-- 8.1 Check foreign keys on user_profiles
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
AND tc.table_name = 'user_profiles'
AND tc.constraint_type = 'FOREIGN KEY';

-- ============================================================================
-- SECTION 9: CHECK DATABASE PERMISSIONS
-- ============================================================================
\echo '=== CHECKING PERMISSIONS ==='

-- 9.1 Check table permissions
SELECT
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
AND table_name = 'user_profiles'
ORDER BY grantee, privilege_type;

-- ============================================================================
-- SECTION 10: ATTEMPT MINIMAL USER CREATION
-- ============================================================================
\echo '=== ATTEMPTING MINIMAL USER CREATION ==='

-- 10.1 Try the absolute minimum insert
BEGIN;
  INSERT INTO public.user_profiles (user_id, email, role)
  VALUES (
    '88888888-8888-8888-8888-888888888888',
    'minimal@example.com',
    'viewer'
  );

  -- Check what was created
  SELECT * FROM public.user_profiles
  WHERE user_id = '88888888-8888-8888-8888-888888888888';

ROLLBACK;

-- ============================================================================
-- SUMMARY: Next Steps
-- ============================================================================
\echo '=== DIAGNOSTIC COMPLETE ==='
\echo 'Review the output above to identify:'
\echo '1. Any missing tables or columns'
\echo '2. Permission issues'
\echo '3. Function execution errors'
\echo '4. Constraint violations'
\echo '5. Check Supabase Dashboard > Logs for detailed error messages'