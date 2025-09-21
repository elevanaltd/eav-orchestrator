-- ============================================================================
-- DIAGNOSE USER CREATION ISSUE
-- ============================================================================
-- Run this script in Supabase SQL Editor to diagnose the user creation problem
-- ============================================================================

-- 1. Check if user_profiles table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'user_profiles'
) as user_profiles_exists;

-- 2. Check the structure of user_profiles table
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'user_profiles'
ORDER BY ordinal_position;

-- 3. Check if the trigger function exists
SELECT EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'create_user_profile'
) as trigger_function_exists;

-- 4. Check if the trigger is attached to auth.users
SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
AND event_object_table = 'users'
AND trigger_name LIKE '%user%profile%';

-- 5. Check the current trigger function definition
SELECT
    proname as function_name,
    prosrc as function_source
FROM pg_proc
WHERE proname = 'create_user_profile';

-- 6. Check RLS policies on user_profiles
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'user_profiles';

-- 7. Test creating a user profile manually
-- This will help identify if there are any constraint violations
-- UNCOMMENT AND MODIFY TO TEST:
/*
INSERT INTO public.user_profiles (user_id, name, email, role)
VALUES (
    gen_random_uuid(),
    'Test User',
    'test@example.com',
    'viewer'
);
*/

-- 8. Check for any existing constraint violations in user_profiles
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_namespace n ON n.oid = c.connamespace
JOIN pg_class cl ON cl.oid = c.conrelid
WHERE n.nspname = 'public'
AND cl.relname = 'user_profiles';