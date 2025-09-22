-- ============================================================================
-- SAFE VERSION: CREATE AUTH HOOK FUNCTION WITH CORRECT SIGNATURE
-- ============================================================================
-- This version checks before dropping and provides a non-destructive option
-- ============================================================================

-- First, check if the old function exists
SELECT
  'Old trigger function exists: ' ||
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_proc
      WHERE proname = 'handle_new_user'
      AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND prorettype = 'trigger'::regtype
    ) THEN 'YES - needs to be replaced'
    ELSE 'NO - safe to proceed'
  END as status;

-- ============================================================================
-- OPTION 1: NON-DESTRUCTIVE (Create with different name)
-- ============================================================================
-- If you want to keep the old function, use this version with a different name:

CREATE OR REPLACE FUNCTION public.handle_new_user_hook(event jsonb)
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
GRANT EXECUTE ON FUNCTION public.handle_new_user_hook(jsonb) TO postgres;
GRANT EXECUTE ON FUNCTION public.handle_new_user_hook(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user_hook(jsonb) TO anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user_hook(jsonb) TO authenticated;

-- ============================================================================
-- VERIFY THE NEW FUNCTION
-- ============================================================================
SELECT
  proname as function_name,
  proargtypes::regtype[] as argument_types,
  prorettype::regtype as return_type
FROM pg_proc
WHERE proname IN ('handle_new_user', 'handle_new_user_hook')
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY proname;

-- ============================================================================
-- TEST THE FUNCTION
-- ============================================================================
-- Test with sample data to ensure it works:
SELECT handle_new_user_hook('{
  "id": "12345678-1234-1234-1234-123456789012",
  "email": "test@example.com",
  "raw_user_meta_data": {
    "name": "Test User"
  }
}'::jsonb) as test_result;

-- Check if test profile was created (then clean it up)
SELECT * FROM public.user_profiles WHERE user_id = '12345678-1234-1234-1234-123456789012';
DELETE FROM public.user_profiles WHERE user_id = '12345678-1234-1234-1234-123456789012';

-- ============================================================================
-- INSTRUCTIONS:
-- ============================================================================
-- 1. Run this script in Supabase SQL Editor
-- 2. Go to Authentication > Hooks
-- 3. Click "Enable a Before User Created hook"
-- 4. Look for "handle_new_user_hook" in the function dropdown
-- 5. Select it and save the hook
--
-- Note: Using "handle_new_user_hook" to avoid conflict with existing function
-- ============================================================================