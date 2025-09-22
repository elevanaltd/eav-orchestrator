-- ============================================================================
-- RUN EACH SECTION SEPARATELY TO SEE RESULTS
-- ============================================================================

-- ============================================================================
-- STEP 1: Does the table exist?
-- ============================================================================
SELECT
  'user_profiles table exists' as check_item,
  EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'user_profiles'
  ) as status;

-- ============================================================================
-- STEP 2: What is the table structure?
-- ============================================================================
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'user_profiles'
ORDER BY ordinal_position;

-- ============================================================================
-- STEP 3: Does the function exist?
-- ============================================================================
SELECT
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
AND p.proname = 'handle_new_user';

-- ============================================================================
-- STEP 4: Test creating a profile directly
-- ============================================================================
INSERT INTO public.user_profiles (user_id, name, email, role)
VALUES (
  '11111111-2222-3333-4444-555555555555',
  'Test User',
  'test@example.com',
  'viewer'
)
ON CONFLICT (user_id) DO UPDATE
SET email = EXCLUDED.email
RETURNING *;

-- Clean up the test
DELETE FROM public.user_profiles WHERE user_id = '11111111-2222-3333-4444-555555555555';

-- ============================================================================
-- STEP 5: Test the function if it exists
-- ============================================================================
SELECT public.handle_new_user('{
  "id": "22222222-3333-4444-5555-666666666666",
  "email": "function-test@example.com",
  "raw_user_meta_data": {"name": "Function Test"}
}'::jsonb);

-- Check if it created a profile
SELECT * FROM public.user_profiles WHERE user_id = '22222222-3333-4444-5555-666666666666';

-- Clean up
DELETE FROM public.user_profiles WHERE user_id = '22222222-3333-4444-5555-666666666666';

-- ============================================================================
-- STEP 6: Check RLS status
-- ============================================================================
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'user_profiles';

-- ============================================================================
-- STEP 7: Check who can execute the function
-- ============================================================================
SELECT
  r.rolname as role,
  has_function_privilege(r.rolname, 'public.handle_new_user(jsonb)', 'EXECUTE') as can_execute
FROM pg_roles r
WHERE r.rolname IN ('postgres', 'anon', 'authenticated', 'service_role', 'supabase_auth_admin')
ORDER BY r.rolname;