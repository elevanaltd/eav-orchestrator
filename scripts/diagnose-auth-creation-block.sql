-- ============================================================================
-- DIAGNOSE WHAT'S BLOCKING AUTH.USERS CREATION
-- ============================================================================

-- 1. Check if there are any auth triggers that might be blocking
SELECT
  tgname as trigger_name,
  tgtype,
  tgenabled,
  proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE t.tgrelid = 'auth.users'::regclass
ORDER BY tgname;

-- 2. Check auth hooks that might be interfering
SELECT
  id,
  hook_table,
  hook_name,
  function_schema,
  function_name,
  enabled,
  created_at
FROM auth.schema_hooks
WHERE hook_table = 'users'
AND enabled = true;

-- 3. Check if instance_id is correct
SELECT DISTINCT
  instance_id,
  COUNT(*) as count
FROM auth.users
GROUP BY instance_id;

-- 4. Test direct insert with all required fields
DO $$
DECLARE
  test_email text := 'direct-test-' || gen_random_uuid() || '@example.com';
  test_id uuid := gen_random_uuid();
  error_msg text;
  error_detail text;
  error_state text;
BEGIN
  -- Get instance_id from existing users
  DECLARE
    existing_instance_id uuid;
  BEGIN
    SELECT instance_id INTO existing_instance_id FROM auth.users LIMIT 1;

    -- Try to insert with all fields that might be required
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      is_sso_user,
      deleted_at
    ) VALUES (
      COALESCE(existing_instance_id, '00000000-0000-0000-0000-000000000000'::uuid),
      test_id,
      'authenticated',
      'authenticated',
      test_email,
      crypt('TempPassword123!', gen_salt('bf')), -- encrypted password
      NOW(), -- email confirmed
      '', -- confirmation token
      '', -- recovery token
      '', -- email change token
      '', -- email change
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      NOW(),
      NOW(),
      false,
      NULL
    );

    -- If successful, delete it
    DELETE FROM auth.users WHERE id = test_id;
    RAISE NOTICE 'SUCCESS: Direct insert works!';

  END;
EXCEPTION
  WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      error_msg = MESSAGE_TEXT,
      error_detail = PG_EXCEPTION_DETAIL,
      error_state = RETURNED_SQLSTATE;

    RAISE NOTICE 'ERROR: %', error_msg;
    RAISE NOTICE 'DETAIL: %', error_detail;
    RAISE NOTICE 'SQLSTATE: %', error_state;
END $$;

-- 5. Check if there's a Before Insert hook blocking creation
SELECT
  'IMPORTANT' as note,
  'Check Authentication > Hooks in Dashboard' as action,
  'Look for any BEFORE INSERT hooks that might be failing' as what_to_check;

-- 6. Check auth configuration
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM auth.users WHERE email_confirmed_at IS NULL)
    THEN 'WARNING: Some users have unconfirmed emails'
    ELSE 'OK: All users have confirmed emails'
  END as email_confirmation_status;

-- 7. Check for any custom functions that might be interfering
SELECT
  p.proname as function_name,
  n.nspname as schema_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'auth'
AND p.proname LIKE '%user%'
AND p.proname NOT IN (
  'uid', 'role', 'email', 'jwt', 'user_id',
  'is_authenticated', 'session_user'
)
ORDER BY p.proname;

-- 8. Check if encrypted_password is required
SELECT
  a.attname as column_name,
  a.attnotnull as is_required,
  pg_get_expr(d.adbin, d.adrelid) as default_value
FROM pg_attribute a
LEFT JOIN pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
WHERE a.attrelid = 'auth.users'::regclass
AND a.attname = 'encrypted_password'
AND a.attnum > 0
AND NOT a.attisdropped;

-- 9. Final check - see if it's a Supabase Auth API issue
SELECT 'Dashboard Checks Required:' as category, 'Action' as details
UNION ALL
SELECT '1. Auth Logs', 'Authentication → Logs - Look for the EXACT error message'
UNION ALL
SELECT '2. Auth Hooks', 'Authentication → Hooks - Disable ALL hooks temporarily'
UNION ALL
SELECT '3. Email Settings', 'Authentication → Email Templates - Check SMTP configuration'
UNION ALL
SELECT '4. API Health', 'Home → API Status - Check if Auth API is operational';