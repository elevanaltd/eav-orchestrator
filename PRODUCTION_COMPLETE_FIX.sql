-- ============================================================================
-- PRODUCTION COMPLETE FIX - ALL MIGRATIONS COMBINED
-- ============================================================================
-- RUN THIS ENTIRE SCRIPT in Supabase SQL Editor at:
-- https://supabase.com/dashboard/project/vbcfaegexbygqgsstoig/sql/new
-- ============================================================================
-- This combines all necessary fixes from migrations 008-012
-- ============================================================================

-- ============================================================================
-- PART 1: Add missing columns to video_scripts table
-- ============================================================================
ALTER TABLE video_scripts
ADD COLUMN IF NOT EXISTS script_status TEXT DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS estimated_duration INTEGER DEFAULT 0;

-- ============================================================================
-- PART 2: Fix RLS policies (development mode)
-- ============================================================================
-- Clean up any existing policies
DROP POLICY IF EXISTS "video_scripts_temp_select" ON video_scripts;
DROP POLICY IF EXISTS "video_scripts_temp_insert" ON video_scripts;
DROP POLICY IF EXISTS "video_scripts_temp_update" ON video_scripts;
DROP POLICY IF EXISTS "video_scripts_temp_delete" ON video_scripts;
DROP POLICY IF EXISTS "video_scripts_select_dev" ON video_scripts;
DROP POLICY IF EXISTS "video_scripts_insert_dev" ON video_scripts;
DROP POLICY IF EXISTS "video_scripts_update_dev" ON video_scripts;
DROP POLICY IF EXISTS "video_scripts_delete_dev" ON video_scripts;

-- Create development policies for video_scripts
CREATE POLICY "video_scripts_select_dev" ON video_scripts FOR SELECT USING (true);
CREATE POLICY "video_scripts_insert_dev" ON video_scripts FOR INSERT WITH CHECK (true);
CREATE POLICY "video_scripts_update_dev" ON video_scripts FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "video_scripts_delete_dev" ON video_scripts FOR DELETE USING (true);

-- Clean up and create policies for script_components
DROP POLICY IF EXISTS "script_components_temp_select" ON script_components;
DROP POLICY IF EXISTS "script_components_temp_insert" ON script_components;
DROP POLICY IF EXISTS "script_components_temp_update" ON script_components;
DROP POLICY IF EXISTS "script_components_temp_delete" ON script_components;
DROP POLICY IF EXISTS "script_components_select_dev" ON script_components;
DROP POLICY IF EXISTS "script_components_insert_dev" ON script_components;
DROP POLICY IF EXISTS "script_components_update_dev" ON script_components;
DROP POLICY IF EXISTS "script_components_delete_dev" ON script_components;

CREATE POLICY "script_components_select_dev" ON script_components FOR SELECT USING (true);
CREATE POLICY "script_components_insert_dev" ON script_components FOR INSERT WITH CHECK (true);
CREATE POLICY "script_components_update_dev" ON script_components FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "script_components_delete_dev" ON script_components FOR DELETE USING (true);

-- Ensure other tables have policies
DROP POLICY IF EXISTS "videos_select_dev" ON videos;
DROP POLICY IF EXISTS "videos_insert_dev" ON videos;
CREATE POLICY "videos_select_dev" ON videos FOR SELECT USING (true);
CREATE POLICY "videos_insert_dev" ON videos FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "projects_select_dev" ON projects;
CREATE POLICY "projects_select_dev" ON projects FOR SELECT USING (true);

DROP POLICY IF EXISTS "clients_select_dev" ON clients;
CREATE POLICY "clients_select_dev" ON clients FOR SELECT USING (true);

-- ============================================================================
-- PART 3: Add system default flags to tables
-- ============================================================================
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS is_system_default BOOLEAN DEFAULT false;

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS is_system_default BOOLEAN DEFAULT false;

ALTER TABLE videos
ADD COLUMN IF NOT EXISTS is_system_default BOOLEAN DEFAULT false;

-- Create indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_clients_system_default
ON clients(is_system_default) WHERE is_system_default = true;

CREATE INDEX IF NOT EXISTS idx_projects_system_default
ON projects(is_system_default) WHERE is_system_default = true;

CREATE INDEX IF NOT EXISTS idx_videos_system_default
ON videos(is_system_default) WHERE is_system_default = true;

-- ============================================================================
-- PART 4: Create system default hierarchy
-- ============================================================================

-- System default client
INSERT INTO clients (
  client_id,
  client_name,
  contact_email,
  is_system_default
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'System Default Client',
  'system@eav-orchestrator.local',
  true
) ON CONFLICT (client_id) DO UPDATE
  SET is_system_default = true;

-- System default project
INSERT INTO projects (
  project_id,
  client_id,
  project_name,
  project_code,
  project_status,
  is_system_default
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'Uncategorized Scripts',
  'UNCATEGORIZED',
  'setup',
  true
) ON CONFLICT (project_id) DO UPDATE
  SET is_system_default = true,
      client_id = '00000000-0000-0000-0000-000000000000';

-- System default video
INSERT INTO videos (
  video_id,
  project_id,
  video_title,
  video_description,
  video_status,
  is_system_default
) VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'Uncategorized Video Scripts',
  'Default container for scripts created without a project context',
  'planning',
  true
) ON CONFLICT (video_id) DO UPDATE
  SET is_system_default = true,
      project_id = '00000000-0000-0000-0000-000000000001';

-- ============================================================================
-- PART 5: Create functions for default video management
-- ============================================================================
CREATE OR REPLACE FUNCTION get_default_video_id()
RETURNS UUID AS $$
DECLARE
  v_video_id UUID;
BEGIN
  -- Find the system default video
  SELECT video_id INTO v_video_id
  FROM videos
  WHERE is_system_default = true
  LIMIT 1;

  IF v_video_id IS NULL THEN
    RAISE EXCEPTION 'System default video not found. Database initialization error.';
  END IF;

  RETURN v_video_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create RPC endpoint for getting default video
CREATE OR REPLACE FUNCTION rpc_get_default_video_id()
RETURNS UUID AS $$
  SELECT get_default_video_id();
$$ LANGUAGE sql STABLE;

-- Grant access to the RPC function
GRANT EXECUTE ON FUNCTION rpc_get_default_video_id() TO anon, authenticated;

-- ============================================================================
-- PART 6: Verify everything worked
-- ============================================================================
DO $$
DECLARE
  v_default_id UUID;
  v_policy_count INTEGER;
  v_column_count INTEGER;
BEGIN
  -- Check default video exists
  v_default_id := get_default_video_id();
  RAISE NOTICE 'System default video ID: %', v_default_id;

  -- Check RLS policies exist
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE tablename IN ('video_scripts', 'script_components');
  RAISE NOTICE 'RLS policies created: %', v_policy_count;

  -- Check columns exist
  SELECT COUNT(*) INTO v_column_count
  FROM information_schema.columns
  WHERE table_name = 'video_scripts'
  AND column_name IN ('script_status', 'word_count', 'estimated_duration');
  RAISE NOTICE 'Required columns exist: %', v_column_count;

  IF v_column_count = 3 AND v_policy_count >= 8 AND v_default_id IS NOT NULL THEN
    RAISE NOTICE '';
    RAISE NOTICE '✅ PRODUCTION FIX COMPLETE!';
    RAISE NOTICE 'The application should now work correctly.';
    RAISE NOTICE 'Test by clicking "Create First Script" at localhost:3000';
  ELSE
    RAISE EXCEPTION 'Something went wrong. Please check the error messages above.';
  END IF;
END $$;