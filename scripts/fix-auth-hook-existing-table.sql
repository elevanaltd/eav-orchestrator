-- ============================================================================
-- FIX AUTH HOOK TO USE EXISTING user_profiles TABLE
-- ============================================================================
-- This updates the function to work with your EXISTING user_profiles table
-- which is already integrated throughout your application
-- ============================================================================

-- Drop the old function if it exists
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Create the function that works with your EXISTING user_profiles table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert into the EXISTING user_profiles table that your app already uses
  INSERT INTO public.user_profiles (user_id, name, email, role, created_at, updated_at)
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
      WHEN NEW.email LIKE '%@elevana.co.uk' THEN 'admin'
      -- Internal for known team members
      WHEN NEW.email = 'shaun@hest.ai' THEN 'admin'
      -- Check metadata for explicit role
      WHEN NEW.raw_user_meta_data->>'role' IS NOT NULL
        AND NEW.raw_user_meta_data->>'role' IN ('admin', 'internal', 'freelancer', 'client', 'viewer')
        THEN NEW.raw_user_meta_data->>'role'
      -- Default to viewer for everyone else
      ELSE 'viewer'
    END,
    NOW(),
    NOW()
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- ============================================================================
-- VERIFY EXISTING TABLE STRUCTURE
-- ============================================================================
SELECT
  'Checking user_profiles table structure:' as message;

SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'user_profiles'
ORDER BY ordinal_position;

-- Check existing data
SELECT
  'Existing user profiles count:' as message,
  COUNT(*) as count
FROM public.user_profiles;

-- ============================================================================
-- CLEAN UP DUPLICATE TABLE (Optional - only if you want to remove team_members)
-- ============================================================================
-- The team_members table appears to be unused. If you want to remove it:
-- WARNING: Only uncomment if you're sure team_members is not being used!

/*
-- First check if team_members has any data
SELECT
  'Data in team_members table:' as message,
  COUNT(*) as count
FROM public.team_members;

-- If empty and unused, you can drop it:
-- DROP TABLE IF EXISTS public.team_members CASCADE;
*/

-- ============================================================================
-- INSTRUCTIONS:
-- ============================================================================
-- 1. Run this SQL script in Supabase SQL Editor
-- 2. Go to Authentication > Hooks in Supabase Dashboard
-- 3. Enable "Before User Created" hook with:
--    - Hook type: Postgres
--    - Schema: public
--    - Function: handle_new_user
-- 4. Save and test by creating a new user
-- ============================================================================