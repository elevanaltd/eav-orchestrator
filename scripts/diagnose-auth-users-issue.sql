-- ============================================================================
-- DIAGNOSE AUTH.USERS CREATION ISSUE
-- ============================================================================
-- The problem is creating users in auth.users, not profiles
-- ============================================================================

-- 1. Check current user count and any limits
SELECT
  COUNT(*) as current_user_count,
  'Check Supabase Dashboard → Settings → Billing for user limits' as check_limits
FROM auth.users;

-- 2. Check if auth.users table has any constraints or issues
SELECT
  schemaname,
  tablename,
  tableowner,
  hasindexes,
  hasrules,
  hastriggers
FROM pg_tables
WHERE schemaname = 'auth'
AND tablename = 'users';

-- 3. Check for any unique constraints that might be blocking
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'auth'
AND tc.table_name = 'users'
AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
ORDER BY tc.constraint_type, kcu.ordinal_position;

-- 4. Check if there are any failed user creation attempts in identities table
SELECT
  COUNT(*) as identity_count,
  COUNT(DISTINCT user_id) as unique_users
FROM auth.identities;

-- 5. Check auth schema permissions
SELECT
  nspname as schema_name,
  rolname as role,
  has_schema_privilege(rolname, nspname, 'USAGE') as has_usage,
  has_schema_privilege(rolname, nspname, 'CREATE') as has_create
FROM pg_namespace
CROSS JOIN pg_roles
WHERE nspname = 'auth'
AND rolname IN ('postgres', 'authenticator', 'authenticated', 'anon', 'service_role', 'supabase_auth_admin')
ORDER BY rolname;

-- 6. Check if auth.users allows inserts
SELECT
  has_table_privilege('supabase_auth_admin', 'auth.users', 'INSERT') as auth_admin_can_insert,
  has_table_privilege('postgres', 'auth.users', 'INSERT') as postgres_can_insert,
  has_table_privilege('service_role', 'auth.users', 'INSERT') as service_role_can_insert;

-- 7. Try to identify specific error by attempting minimal insert
-- This will fail but show us the actual error
DO $$
DECLARE
  test_id uuid := gen_random_uuid();
  error_message text;
  error_detail text;
  error_hint text;
BEGIN
  -- Try the most minimal insert possible
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    created_at,
    updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    test_id,
    'authenticated',
    'authenticated',
    'test-' || test_id::text || '@example.com',
    NOW(),
    NOW()
  );

  -- If we get here, it worked (shouldn't happen)
  DELETE FROM auth.users WHERE id = test_id;
  RAISE NOTICE 'SUCCESS: Can create users directly';

EXCEPTION
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      error_message = MESSAGE_TEXT,
      error_detail = PG_EXCEPTION_DETAIL,
      error_hint = PG_EXCEPTION_HINT;

    RAISE NOTICE 'ERROR: %', error_message;
    RAISE NOTICE 'DETAIL: %', error_detail;
    RAISE NOTICE 'HINT: %', error_hint;
    RAISE NOTICE 'SQLSTATE: %', SQLSTATE;
END $$;

-- 8. Check for any auth-related extensions
SELECT
  extname,
  extversion
FROM pg_extension
WHERE extname LIKE '%auth%' OR extname LIKE '%jwt%' OR extname = 'supabase_vault'
ORDER BY extname;

-- 9. Check if there are any blocking RLS policies on auth schema tables
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  permissive
FROM pg_policies
WHERE schemaname = 'auth'
ORDER BY tablename, policyname;

-- 10. Check system settings that might affect user creation
SHOW max_connections;
SHOW shared_buffers;

-- ============================================================================
-- IMPORTANT MANUAL CHECKS
-- ============================================================================
SELECT 'MANUAL CHECK 1:' as action, 'Go to Supabase Dashboard → Settings → Billing' as location, 'Check if you have hit any user limits on free tier' as what_to_check
UNION ALL
SELECT 'MANUAL CHECK 2:', 'Go to Supabase Dashboard → Logs → Postgres Logs', 'Look for any errors when trying to create users'
UNION ALL
SELECT 'MANUAL CHECK 3:', 'Go to Supabase Dashboard → Authentication → Logs', 'Check Auth Logs for detailed error messages'
UNION ALL
SELECT 'MANUAL CHECK 4:', 'Go to Supabase Dashboard → Settings → API', 'Verify service_role key is enabled and valid';