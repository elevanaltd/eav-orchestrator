-- ============================================================================
-- SIMPLE FIX FOR USER CREATION ISSUE
-- ============================================================================
-- This recreates the handle_new_user function to ensure it works correctly
-- ============================================================================

-- First, drop the existing function to recreate it cleanly
DROP FUNCTION IF EXISTS public.handle_new_user(jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Create the correct function for Auth Hooks
CREATE OR REPLACE FUNCTION public.handle_new_user(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_id uuid;
  new_user_email text;
  new_user_metadata jsonb;
  assigned_role text;
BEGIN
  -- Extract user information from the event
  new_user_id := (event->>'id')::uuid;
  new_user_email := event->>'email';
  new_user_metadata := COALESCE(event->'raw_user_meta_data', '{}'::jsonb);

  -- Determine role based on email and metadata
  IF new_user_email LIKE '%@elevana.com' OR new_user_email LIKE '%@elevan.co.uk' THEN
    assigned_role := 'admin';
  ELSIF new_user_email = 'shaun@hest.ai' THEN
    assigned_role := 'admin';
  ELSIF new_user_metadata->>'role' IS NOT NULL THEN
    -- Validate the role is valid
    IF new_user_metadata->>'role' IN ('admin', 'internal', 'freelancer', 'client', 'viewer') THEN
      assigned_role := new_user_metadata->>'role';
    ELSE
      assigned_role := 'viewer';
    END IF;
  ELSE
    assigned_role := 'viewer';
  END IF;

  -- Create the user profile
  BEGIN
    INSERT INTO public.user_profiles (
      user_id,
      name,
      email,
      role,
      created_at,
      updated_at
    ) VALUES (
      new_user_id,
      COALESCE(
        new_user_metadata->>'name',
        new_user_metadata->>'full_name',
        split_part(new_user_email, '@', 1)
      ),
      new_user_email,
      assigned_role,
      NOW(),
      NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      email = EXCLUDED.email,
      name = COALESCE(EXCLUDED.name, user_profiles.name),
      role = COALESCE(EXCLUDED.role, user_profiles.role),
      updated_at = NOW();

    -- Log success for debugging
    RAISE LOG 'User profile created successfully for %', new_user_email;

  EXCEPTION
    WHEN OTHERS THEN
      -- Log the actual error for debugging
      RAISE LOG 'Failed to create user profile for %: % - %', new_user_email, SQLERRM, SQLSTATE;
      -- Don't re-raise to allow user creation to continue
  END;

  -- Always return the event to allow auth to continue
  RETURN event;
END;
$$;

-- Grant appropriate permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.handle_new_user(jsonb) FROM authenticated, anon, public;

-- ============================================================================
-- VERIFY THE SETUP
-- ============================================================================

-- Check the function exists with correct signature
SELECT
  'Function exists' as check_item,
  EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
    AND p.proname = 'handle_new_user'
    AND pg_get_function_arguments(p.oid) = 'event jsonb'
  ) as status;

-- Check permissions are correct
SELECT
  'Permissions correct' as check_item,
  has_function_privilege('supabase_auth_admin', 'public.handle_new_user(jsonb)', 'EXECUTE') as auth_admin_can_execute,
  NOT has_function_privilege('anon', 'public.handle_new_user(jsonb)', 'EXECUTE') as anon_cannot_execute,
  NOT has_function_privilege('authenticated', 'public.handle_new_user(jsonb)', 'EXECUTE') as authenticated_cannot_execute;

-- ============================================================================
-- TEST THE FUNCTION
-- ============================================================================

-- Test with a sample event
DO $$
DECLARE
  test_result jsonb;
  test_user_id uuid := '77777777-7777-7777-7777-777777777777';
BEGIN
  -- Call the function
  test_result := public.handle_new_user(jsonb_build_object(
    'id', test_user_id,
    'email', 'test-function@example.com',
    'raw_user_meta_data', jsonb_build_object('name', 'Test Function User')
  ));

  -- Check if profile was created
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE user_id = test_user_id) THEN
    RAISE NOTICE 'SUCCESS: Function created user profile correctly';
    -- Clean up
    DELETE FROM public.user_profiles WHERE user_id = test_user_id;
  ELSE
    RAISE WARNING 'PROBLEM: Function did not create user profile';
  END IF;
END $$;

-- ============================================================================
-- IF STILL FAILING: Alternative Approach Without Hook
-- ============================================================================
-- If the auth hook still doesn't work, uncomment and run this trigger approach:

/*
-- Create a traditional trigger (backup approach)
CREATE OR REPLACE FUNCTION public.create_user_profile_trigger()
RETURNS TRIGGER AS $$
BEGIN
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
      WHEN NEW.email LIKE '%@elevana.com' OR NEW.email LIKE '%@elevan.co.uk' THEN 'admin'
      WHEN NEW.email = 'shaun@hest.ai' THEN 'admin'
      ELSE 'viewer'
    END
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, user_profiles.name),
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Failed to create user profile via trigger: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_profile_trigger();

RAISE NOTICE 'Traditional trigger approach enabled as backup';
*/

-- ============================================================================
-- INSTRUCTIONS
-- ============================================================================
-- 1. Run this entire script in Supabase SQL Editor
-- 2. Check the output for any errors or warnings
-- 3. The auth hook should now be working
-- 4. If still failing, uncomment the trigger approach section and run it
-- ============================================================================