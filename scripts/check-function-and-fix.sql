-- ============================================================================
-- CHECK FUNCTION AND COMPLETE FIX
-- ============================================================================

-- STEP 1: Check if handle_new_user function exists
SELECT
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
AND p.proname = 'handle_new_user';

-- STEP 2: Check the foreign key constraint
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_class cl ON cl.oid = c.conrelid
JOIN pg_namespace n ON n.oid = cl.relnamespace
WHERE n.nspname = 'public'
AND cl.relname = 'user_profiles'
AND c.contype = 'f'; -- Foreign key constraints

-- STEP 3: Check who can execute the function
SELECT
  r.rolname as role,
  has_function_privilege(r.rolname, 'public.handle_new_user(jsonb)', 'EXECUTE') as can_execute
FROM pg_roles r
WHERE r.rolname IN ('postgres', 'anon', 'authenticated', 'service_role', 'supabase_auth_admin')
ORDER BY r.rolname;

-- ============================================================================
-- THE COMPLETE FIX
-- ============================================================================
-- The issue is likely that the function exists but may have errors or wrong permissions
-- Let's recreate it properly

-- Drop and recreate the function with proper error handling
DROP FUNCTION IF EXISTS public.handle_new_user(jsonb);

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

  -- Log for debugging (visible in Postgres logs)
  RAISE LOG 'handle_new_user called for email: %, id: %', new_user_email, new_user_id;

  -- Determine role based on email and metadata
  IF new_user_email LIKE '%@elevana.com' OR new_user_email LIKE '%@elevan.co.uk' THEN
    assigned_role := 'admin';
  ELSIF new_user_email = 'shaun@hest.ai' THEN
    assigned_role := 'admin';
  ELSIF new_user_metadata->>'role' IS NOT NULL
    AND new_user_metadata->>'role' IN ('admin', 'internal', 'freelancer', 'client', 'viewer') THEN
    assigned_role := new_user_metadata->>'role';
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
      role = EXCLUDED.role,
      updated_at = NOW();

    RAISE LOG 'User profile created/updated successfully for %', new_user_email;

  EXCEPTION
    WHEN foreign_key_violation THEN
      -- This shouldn't happen if called by auth hook, but log it
      RAISE LOG 'Foreign key violation for user %: User does not exist in auth.users', new_user_id;
    WHEN unique_violation THEN
      -- This is handled by ON CONFLICT, but log if it somehow occurs
      RAISE LOG 'Unique violation for user %', new_user_id;
    WHEN OTHERS THEN
      -- Log any other error
      RAISE LOG 'Error creating user profile for %: % (SQLSTATE: %)', new_user_email, SQLERRM, SQLSTATE;
  END;

  -- Always return the event to allow auth to continue
  RETURN event;
END;
$$;

-- Set correct permissions for auth hook
GRANT EXECUTE ON FUNCTION public.handle_new_user(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.handle_new_user(jsonb) FROM authenticated, anon, public;

-- Verify the function was created
SELECT 'Function recreated' as status,
       has_function_privilege('supabase_auth_admin', 'public.handle_new_user(jsonb)', 'EXECUTE') as auth_admin_can_execute;

-- ============================================================================
-- TEST WITH A REAL AUTH.USERS ENTRY
-- ============================================================================
-- First, check if we have any existing users we can test with
SELECT id, email FROM auth.users LIMIT 1;

-- If you see a user above, you can test the function with their ID:
-- SELECT public.handle_new_user(jsonb_build_object(
--   'id', 'PUT-USER-ID-HERE',
--   'email', 'PUT-USER-EMAIL-HERE',
--   'raw_user_meta_data', jsonb_build_object('name', 'Test Name')
-- ));

-- ============================================================================
-- ALTERNATIVE: If auth hook still doesn't work, use a trigger
-- ============================================================================
-- Uncomment and run this section if the auth hook approach fails:

/*
-- Create a trigger function that works after user insertion
CREATE OR REPLACE FUNCTION public.create_user_profile_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      WHEN NEW.raw_user_meta_data->>'role' IN ('admin', 'internal', 'freelancer', 'client', 'viewer')
        THEN NEW.raw_user_meta_data->>'role'
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
    RAISE LOG 'Trigger failed to create user profile: %', SQLERRM;
    RETURN NEW; -- Don't block user creation
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS create_user_profile_on_signup ON auth.users;
CREATE TRIGGER create_user_profile_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_profile_after_insert();

GRANT EXECUTE ON FUNCTION public.create_user_profile_after_insert() TO postgres;

SELECT 'Trigger approach enabled as backup' as status;
*/