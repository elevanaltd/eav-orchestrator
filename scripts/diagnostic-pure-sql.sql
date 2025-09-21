-- ============================================================================
-- COMPREHENSIVE USER CREATION DIAGNOSTIC (PURE SQL)
-- ============================================================================
-- Run each section separately to identify the exact failure point
-- ============================================================================

-- ============================================================================
-- SECTION 1: CHECK BASIC TABLE STRUCTURE
-- ============================================================================

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
-- SECTION 2: CHECK AUTH HOOK FUNCTION
-- ============================================================================

-- 2.1 Check if handle_new_user function exists and show its definition
SELECT
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type,
  LENGTH(p.prosrc) as source_length,
  SUBSTRING(p.prosrc, 1, 200) as first_200_chars
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

-- ============================================================================
-- SECTION 3: CHECK RLS POLICIES
-- ============================================================================

-- 3.1 Check if RLS is enabled
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'user_profiles';

-- 3.2 List all policies on user_profiles
SELECT
  policyname,
  permissive as is_permissive,
  roles,
  cmd as operation,
  SUBSTRING(qual::text, 1, 100) as using_clause,
  SUBSTRING(with_check::text, 1, 100) as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'user_profiles';

-- ============================================================================
-- SECTION 4: TEST DIRECT USER PROFILE CREATION
-- ============================================================================

-- 4.1 Try to create a test profile directly
DO $$
DECLARE
  test_id uuid := gen_random_uuid();
BEGIN
  -- Try to insert
  INSERT INTO public.user_profiles (user_id, name, email, role)
  VALUES (test_id, 'Direct Test', 'direct@test.com', 'viewer');

  -- If successful, clean up
  DELETE FROM public.user_profiles WHERE user_id = test_id;

  RAISE NOTICE 'SUCCESS: Direct insert works';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ERROR in direct insert: % - %', SQLERRM, SQLSTATE;
END $$;

-- ============================================================================
-- SECTION 5: TEST AUTH HOOK FUNCTION
-- ============================================================================

-- 5.1 Test the hook function with sample data
DO $$
DECLARE
  test_result jsonb;
  test_id uuid := '66666666-6666-6666-6666-666666666666';
BEGIN
  -- Check if function exists with correct signature
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
    AND p.proname = 'handle_new_user'
    AND pg_get_function_arguments(p.oid) = 'event jsonb'
  ) THEN
    -- Call the function
    test_result := public.handle_new_user(jsonb_build_object(
      'id', test_id,
      'email', 'hooktest@example.com',
      'raw_user_meta_data', jsonb_build_object('name', 'Hook Test')
    ));

    -- Check if profile was created
    IF EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = test_id) THEN
      RAISE NOTICE 'SUCCESS: Hook function works';
      -- Clean up
      DELETE FROM public.user_profiles WHERE user_id = test_id;
    ELSE
      RAISE NOTICE 'WARNING: Hook function ran but no profile created';
    END IF;
  ELSE
    RAISE NOTICE 'ERROR: handle_new_user(jsonb) function not found';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ERROR calling hook function: % - %', SQLERRM, SQLSTATE;
END $$;

-- ============================================================================
-- SECTION 6: CHECK FOR TRIGGERS
-- ============================================================================

-- 6.1 Check for triggers on auth.users
SELECT
  trigger_name,
  event_manipulation,
  event_object_schema,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
AND event_object_table = 'users';

-- 6.2 Check for triggers on user_profiles
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
-- SECTION 7: CHECK FOREIGN KEY RELATIONSHIPS
-- ============================================================================

-- 7.1 Check foreign keys on user_profiles
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
-- SECTION 8: CHECK PERMISSIONS
-- ============================================================================

-- 8.1 Check table permissions on user_profiles
SELECT
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
AND table_name = 'user_profiles'
ORDER BY grantee, privilege_type;

-- ============================================================================
-- SECTION 9: CHECK IF WE CAN SEE AUTH.USERS
-- ============================================================================

-- 9.1 Check if we can query auth.users (might fail due to permissions)
DO $$
BEGIN
  PERFORM COUNT(*) FROM auth.users;
  RAISE NOTICE 'Can access auth.users table';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Cannot access auth.users: %', SQLERRM;
END $$;

-- ============================================================================
-- SECTION 10: FINAL SUMMARY
-- ============================================================================

SELECT 'DIAGNOSTIC COMPLETE - Review notices above for errors' as status;