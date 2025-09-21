-- ============================================================================
-- CREATE AUTH HOOK FUNCTION WITH CORRECT SIGNATURE
-- ============================================================================
-- Supabase Auth Hooks require functions with jsonb input/output
-- ============================================================================

-- Drop the old trigger-style function if it exists
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Create the function with the correct signature for Auth Hooks
CREATE OR REPLACE FUNCTION public.handle_new_user(event jsonb)
RETURNS jsonb AS $$
DECLARE
  user_id uuid;
  user_email text;
  user_metadata jsonb;
BEGIN
  -- Extract data from the event
  user_id := (event->>'id')::uuid;
  user_email := event->>'email';
  user_metadata := event->'raw_user_meta_data';

  -- Create user profile with smart role assignment
  INSERT INTO public.user_profiles (user_id, name, email, role)
  VALUES (
    user_id,
    COALESCE(
      user_metadata->>'name',
      user_metadata->>'full_name',
      split_part(user_email, '@', 1)
    ),
    user_email,
    CASE
      -- Admin for Elevana team
      WHEN user_email LIKE '%@elevana.com' THEN 'admin'
      WHEN user_email LIKE '%@elevana.co.uk' THEN 'admin'
      -- Internal for known team members
      WHEN user_email = 'shaun@hest.ai' THEN 'admin'
      -- Check metadata for explicit role
      WHEN user_metadata->>'role' IS NOT NULL
        AND user_metadata->>'role' IN ('admin', 'internal', 'freelancer', 'client', 'viewer')
        THEN user_metadata->>'role'
      -- Default to viewer for everyone else
      ELSE 'viewer'
    END
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, user_profiles.name),
    updated_at = NOW();

  -- Return the event unchanged (required by Auth Hooks)
  RETURN event;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block user creation
    RAISE WARNING 'Error creating user profile for %: %', user_email, SQLERRM;
    -- Return the event to allow user creation to continue
    RETURN event;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.handle_new_user(jsonb) TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_new_user(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user(jsonb) TO authenticated;

-- ============================================================================
-- VERIFY THE FUNCTION
-- ============================================================================
SELECT
  proname as function_name,
  proargtypes::regtype[] as argument_types,
  prorettype::regtype as return_type
FROM pg_proc
WHERE proname = 'handle_new_user'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- ============================================================================
-- TEST THE FUNCTION (Optional)
-- ============================================================================
-- You can test the function with sample data:
/*
SELECT handle_new_user('{
  "id": "12345678-1234-1234-1234-123456789012",
  "email": "test@example.com",
  "raw_user_meta_data": {
    "name": "Test User"
  }
}'::jsonb);
*/

-- ============================================================================
-- INSTRUCTIONS:
-- ============================================================================
-- 1. Run this script in Supabase SQL Editor
-- 2. Go to Authentication > Hooks
-- 3. Click "Enable a Before User Created hook"
-- 4. You should now see "handle_new_user" in the function dropdown
-- 5. Select it and save the hook
-- ============================================================================