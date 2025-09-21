-- ============================================================================
-- CREATE AUTH HOOK FUNCTION FOR USER PROFILE CREATION
-- ============================================================================
-- This function will be called by Supabase Auth Hook system
-- Run this in SQL Editor first, then configure the hook in Dashboard
-- ============================================================================

-- Create the function that the Auth Hook will call
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Create user profile with smart role assignment
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
      -- Admin for Elevana team
      WHEN NEW.email LIKE '%@elevana.com' THEN 'admin'
      WHEN NEW.email LIKE '%@elevan.co.uk' THEN 'admin'
      -- Internal for known team members
      WHEN NEW.email = 'shaun@hest.ai' THEN 'admin'
      -- Check metadata for explicit role
      WHEN NEW.raw_user_meta_data->>'role' IS NOT NULL THEN
        NEW.raw_user_meta_data->>'role'
      -- Default to viewer for everyone else
      ELSE 'viewer'
    END
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, user_profiles.name),
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error details for debugging
    RAISE LOG 'Error creating user profile for %: %', NEW.email, SQLERRM;
    -- Still return NEW to allow user creation to proceed
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to the auth system
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- ============================================================================
-- INSTRUCTIONS TO COMPLETE SETUP:
-- ============================================================================
-- 1. Run this SQL script in Supabase SQL Editor
-- 2. Go to Authentication > Hooks in Supabase Dashboard
-- 3. Click "Add hook" or "Enable a Before User Created hook"
-- 4. Configure as follows:
--    - Hook type: Postgres
--    - Schema: public
--    - Function: handle_new_user
-- 5. Save the hook configuration
-- 6. Test by creating a new user
-- ============================================================================

-- Verify the function was created
SELECT
  proname as function_name,
  proargnames as argument_names,
  prorettype::regtype as return_type
FROM pg_proc
WHERE proname = 'handle_new_user'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Check if user_profiles table exists and has correct structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'user_profiles'
ORDER BY ordinal_position;