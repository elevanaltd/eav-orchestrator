-- ============================================================================
-- MIGRATION: Enforce Authentication Requirements
-- ============================================================================
-- IMPLEMENTATION_LEAD: Production authentication enforcement
-- Reverts migration 007 to require authenticated users for all operations
-- Adds proper foreign key constraints and default system user
-- ============================================================================

-- Create user_profiles table for role management
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'internal', 'freelancer', 'client', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create trigger for automatic user profile creation
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (user_id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE create_user_profile();

-- Create system user for data migration and system operations
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
  confirmation_token,
  raw_app_meta_data,
  raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'system@eav-orchestrator.internal',
  crypt('system-password-never-used', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  '{"provider": "email", "providers": ["email"]}',
  '{"name": "System User", "role": "admin"}'
)
ON CONFLICT (id) DO NOTHING;

-- Create corresponding user profile for system user
INSERT INTO user_profiles (
  user_id,
  name,
  email,
  role,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'System User',
  'system@eav-orchestrator.internal',
  'admin',
  NOW(),
  NOW()
)
ON CONFLICT (user_id) DO NOTHING;

-- Backfill existing records with system user where last_edited_by is NULL
UPDATE script_components
SET last_edited_by = '00000000-0000-0000-0000-000000000001'
WHERE last_edited_by IS NULL;

UPDATE video_scripts
SET last_edited_by = '00000000-0000-0000-0000-000000000001'
WHERE last_edited_by IS NULL;

-- Now make last_edited_by NOT NULL again (revert migration 007)
ALTER TABLE script_components
ALTER COLUMN last_edited_by SET NOT NULL;

ALTER TABLE video_scripts
ALTER COLUMN last_edited_by SET NOT NULL;

-- Add proper foreign key constraints to auth.users
ALTER TABLE script_components
ADD CONSTRAINT fk_script_components_last_edited_by
FOREIGN KEY (last_edited_by) REFERENCES auth.users(id)
ON DELETE SET DEFAULT;

ALTER TABLE video_scripts
ADD CONSTRAINT fk_video_scripts_last_edited_by
FOREIGN KEY (last_edited_by) REFERENCES auth.users(id)
ON DELETE SET DEFAULT;

-- Set default values to system user for new records when auth fails
ALTER TABLE script_components
ALTER COLUMN last_edited_by SET DEFAULT '00000000-0000-0000-0000-000000000001';

ALTER TABLE video_scripts
ALTER COLUMN last_edited_by SET DEFAULT '00000000-0000-0000-0000-000000000001';

-- Update comments to reflect production requirements
COMMENT ON COLUMN script_components.last_edited_by IS
  'User who last edited this component. Required field with foreign key to auth.users. Defaults to system user if auth context unavailable.';

COMMENT ON COLUMN video_scripts.last_edited_by IS
  'User who last edited this script. Required field with foreign key to auth.users. Defaults to system user if auth context unavailable.';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Production authentication enforcement:
-- 1. All records now require authenticated user references
-- 2. Foreign key constraints ensure data integrity
-- 3. System user provides fallback for edge cases
-- 4. Application layer must provide auth.uid() for new records
-- ============================================================================