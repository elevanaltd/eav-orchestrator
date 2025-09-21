-- ============================================================================
-- FINAL FIX: ENSURE USER PROFILES ARE ALWAYS CREATED
-- ============================================================================
-- This uses BOTH auth hooks AND database triggers for redundancy
-- ============================================================================

-- ============================================================================
-- PART 1: FIX THE AUTH HOOK FUNCTION
-- ============================================================================
DROP FUNCTION IF EXISTS public.handle_new_user(jsonb) CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Create the user profile immediately
  INSERT INTO public.user_profiles (user_id, name, email, role)
  VALUES (
    (event->>'id')::uuid,
    COALESCE(
      event->'raw_user_meta_data'->>'name',
      event->'raw_user_meta_data'->>'full_name',
      split_part(event->>'email', '@', 1)
    ),
    event->>'email',
    CASE
      WHEN event->>'email' LIKE '%@elevana.com' THEN 'admin'
      WHEN event->>'email' LIKE '%@elevan.co.uk' THEN 'admin'
      WHEN event->>'email' = 'shaun@hest.ai' THEN 'admin'
      ELSE COALESCE(event->'raw_user_meta_data'->>'role', 'viewer')
    END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, user_profiles.name),
    updated_at = NOW();

  -- Return the event unchanged
  RETURN event;
EXCEPTION
  WHEN OTHERS THEN
    -- Log but don't block user creation
    RAISE WARNING 'handle_new_user error: %', SQLERRM;
    RETURN event;
END;
$$;

-- Set permissions for auth hook
GRANT EXECUTE ON FUNCTION public.handle_new_user(jsonb) TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_new_user(jsonb) TO postgres;
REVOKE EXECUTE ON FUNCTION public.handle_new_user(jsonb) FROM authenticated, anon, public;

-- ============================================================================
-- PART 2: CREATE BACKUP TRIGGER (Belt and Suspenders)
-- ============================================================================
-- This trigger will catch any users that the auth hook misses

CREATE OR REPLACE FUNCTION public.ensure_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Wait a moment to let auth hook complete first
  PERFORM pg_sleep(0.1);

  -- Create profile if it doesn't exist
  INSERT INTO public.user_profiles (user_id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    CASE
      WHEN NEW.email LIKE '%@elevana.com' THEN 'admin'
      WHEN NEW.email LIKE '%@elevan.co.uk' THEN 'admin'
      WHEN NEW.email = 'shaun@hest.ai' THEN 'admin'
      ELSE COALESCE(NEW.raw_user_meta_data->>'role', 'viewer')
    END
  )
  ON CONFLICT (user_id) DO NOTHING; -- Don't update if already exists

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Never block user creation
    RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS ensure_user_profile_exists ON auth.users;
CREATE TRIGGER ensure_user_profile_exists
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_user_profile();

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.ensure_user_profile() TO postgres;

-- ============================================================================
-- PART 3: VERIFY THE SETUP
-- ============================================================================

-- Check functions exist
SELECT 'Auth Hook Function' as function_type,
       EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user') as exists;

SELECT 'Trigger Function' as function_type,
       EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'ensure_user_profile') as exists;

-- Check trigger exists
SELECT 'Database Trigger' as trigger_type,
       EXISTS(SELECT 1 FROM pg_trigger WHERE tgname = 'ensure_user_profile_exists') as exists;

-- Check permissions
SELECT 'Auth Hook Permission' as permission_type,
       has_function_privilege('supabase_auth_admin', 'public.handle_new_user(jsonb)', 'EXECUTE') as granted;

-- ============================================================================
-- PART 4: TEST THE COMPLETE FLOW
-- ============================================================================
-- This simulates what happens when a user signs up

DO $$
DECLARE
  test_id uuid := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  test_email text := 'test-complete-flow@example.com';
BEGIN
  -- First, clean up any existing test data
  DELETE FROM public.user_profiles WHERE user_id = test_id;

  -- Test the auth hook function directly
  PERFORM public.handle_new_user(jsonb_build_object(
    'id', test_id,
    'email', test_email,
    'raw_user_meta_data', jsonb_build_object('name', 'Test Flow User')
  ));

  -- Check if profile was created
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = test_id) THEN
    RAISE NOTICE '✅ SUCCESS: Auth hook function creates profiles correctly';
    -- Clean up
    DELETE FROM public.user_profiles WHERE user_id = test_id;
  ELSE
    RAISE WARNING '⚠️  Auth hook function did not create profile';
  END IF;
END $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================
SELECT
  '✅ Setup Complete' as status,
  'Both auth hook AND trigger backup are now active' as message,
  'Try creating a user in the Dashboard now' as next_step;