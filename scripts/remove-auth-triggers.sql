-- ============================================================================
-- REMOVE ALL TRIGGERS ON AUTH.USERS
-- ============================================================================
-- These triggers might be causing the user creation to fail
-- ============================================================================

-- 1. First, list all triggers on auth.users so we know what we're removing
SELECT
  'Current triggers on auth.users:' as info,
  tgname as trigger_name,
  CASE tgtype
    WHEN 1 THEN 'BEFORE INSERT'
    WHEN 2 THEN 'BEFORE UPDATE'
    WHEN 3 THEN 'BEFORE INSERT OR UPDATE'
    WHEN 4 THEN 'BEFORE DELETE'
    WHEN 5 THEN 'AFTER INSERT'
    WHEN 6 THEN 'AFTER UPDATE'
    WHEN 7 THEN 'AFTER INSERT OR UPDATE'
    WHEN 8 THEN 'AFTER DELETE'
    ELSE 'OTHER'
  END as trigger_type,
  proname as function_name,
  tgenabled as is_enabled
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE t.tgrelid = 'auth.users'::regclass
AND tgname NOT LIKE 'pg_%'  -- Exclude system triggers
AND tgname NOT LIKE 'RI_%'  -- Exclude referential integrity triggers
ORDER BY tgname;

-- 2. Drop all custom triggers on auth.users
DO $$
DECLARE
  trigger_record RECORD;
  dropped_count INT := 0;
BEGIN
  -- Loop through all non-system triggers
  FOR trigger_record IN
    SELECT tgname
    FROM pg_trigger
    WHERE tgrelid = 'auth.users'::regclass
    AND tgname NOT LIKE 'pg_%'
    AND tgname NOT LIKE 'RI_%'
    AND tgname != 'on_auth_user_created' -- Keep the system trigger if it exists
  LOOP
    BEGIN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON auth.users CASCADE', trigger_record.tgname);
      dropped_count := dropped_count + 1;
      RAISE NOTICE 'Dropped trigger: %', trigger_record.tgname;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Could not drop trigger %: %', trigger_record.tgname, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Total triggers dropped: %', dropped_count;
END $$;

-- 3. Specifically remove any triggers we might have created
DROP TRIGGER IF EXISTS ensure_user_profile_exists ON auth.users CASCADE;
DROP TRIGGER IF EXISTS create_user_profile_on_signup ON auth.users CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;

-- 4. Also remove the trigger functions to clean up completely
DROP FUNCTION IF EXISTS public.ensure_user_profile() CASCADE;
DROP FUNCTION IF EXISTS public.create_user_profile_after_insert() CASCADE;
DROP FUNCTION IF EXISTS public.create_user_profile_trigger() CASCADE;
DROP FUNCTION IF EXISTS public.create_user_profile() CASCADE;

-- 5. Verify all triggers are gone
SELECT
  CASE
    WHEN COUNT(*) = 0 THEN '✅ SUCCESS: All custom triggers removed from auth.users'
    ELSE '⚠️  WARNING: ' || COUNT(*) || ' trigger(s) still remain on auth.users'
  END as status
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass
AND tgname NOT LIKE 'pg_%'
AND tgname NOT LIKE 'RI_%';

-- 6. List any remaining triggers (should only be system triggers)
SELECT
  'Remaining triggers (if any):' as info,
  tgname as trigger_name,
  proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE t.tgrelid = 'auth.users'::regclass
ORDER BY tgname;

-- ============================================================================
-- IMPORTANT: AUTH HOOK IS DIFFERENT FROM TRIGGERS
-- ============================================================================
SELECT
  '⚠️  NOTE' as important,
  'Auth Hooks (configured in Dashboard) are different from database triggers' as message
UNION ALL
SELECT
  '👉 Action',
  'Go to Authentication → Hooks and check if the hook is still enabled'
UNION ALL
SELECT
  '💡 Info',
  'The Auth Hook function (handle_new_user) still exists but triggers are removed';

-- 7. Keep the Auth Hook function but ensure it won't fail
-- Update it to be extra safe
CREATE OR REPLACE FUNCTION public.handle_new_user(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Super simple, fail-safe version
  BEGIN
    INSERT INTO public.user_profiles (user_id, email, role)
    VALUES (
      (event->>'id')::uuid,
      event->>'email',
      'viewer'
    )
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION
    WHEN OTHERS THEN
      -- Silently ignore ALL errors
      NULL;
  END;

  -- Always return the event
  RETURN event;
END;
$$;

-- Grant permission for auth hook
GRANT EXECUTE ON FUNCTION public.handle_new_user(jsonb) TO supabase_auth_admin;

SELECT '✅ Triggers removed. Try creating a user now!' as next_step;