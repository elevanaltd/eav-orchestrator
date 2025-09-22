-- ============================================================================
-- FIX USER CREATION ISSUE
-- ============================================================================
-- Run this script in Supabase SQL Editor to fix the user creation problem
-- ============================================================================

-- 1. First, ensure the user_profiles table exists with correct structure
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'internal', 'freelancer', 'client', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Drop existing trigger if it exists (to recreate it cleanly)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Create or replace the trigger function with better error handling
CREATE OR REPLACE FUNCTION public.create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create profile if it doesn't already exist
  INSERT INTO public.user_profiles (user_id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer')
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    name = COALESCE(EXCLUDED.name, user_profiles.name),
    updated_at = NOW();

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the user creation
    RAISE WARNING 'Failed to create user profile for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_profile();

-- 5. Grant necessary permissions
GRANT ALL ON public.user_profiles TO postgres;
GRANT ALL ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;
GRANT ALL ON public.user_profiles TO anon;

-- 6. Enable RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 7. Create basic RLS policies if they don't exist
-- Users can view their own profile
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'user_profiles'
    AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile" ON public.user_profiles
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Service role can do everything
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'user_profiles'
    AND policyname = 'Service role can manage all profiles'
  ) THEN
    CREATE POLICY "Service role can manage all profiles" ON public.user_profiles
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 8. Create profiles for any existing users who don't have one
INSERT INTO public.user_profiles (user_id, name, email, role)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'name', au.email),
  au.email,
  COALESCE(au.raw_user_meta_data->>'role', 'viewer')
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.user_id
WHERE up.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- 9. Verify the fix
SELECT
  'Total auth.users' as metric,
  COUNT(*) as count
FROM auth.users
UNION ALL
SELECT
  'Total user_profiles' as metric,
  COUNT(*) as count
FROM public.user_profiles
UNION ALL
SELECT
  'Users without profiles' as metric,
  COUNT(*) as count
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.user_id
WHERE up.user_id IS NULL;

-- ============================================================================
-- MANUAL TEST: Try creating a test user to verify the fix
-- ============================================================================
-- After running this script, try creating a user through Supabase Dashboard
-- or use this test (uncomment and run):
/*
-- Create a test user directly (requires service_role key in application)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data,
  raw_app_meta_data,
  is_sso_user,
  confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'testuser@example.com',
  crypt('TestPassword123!', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '{"name": "Test User", "role": "viewer"}'::jsonb,
  '{"provider": "email", "providers": ["email"]}'::jsonb,
  false,
  encode(gen_random_bytes(32), 'hex')
)
RETURNING id, email;
*/