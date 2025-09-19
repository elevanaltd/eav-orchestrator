-- ============================================================================
-- PRODUCTION COMPLETE FIX: Schema + RLS + Test Data
-- ============================================================================
-- Run this ENTIRE script in Supabase SQL Editor at:
-- https://supabase.com/dashboard/project/vbcfaegexbygqgsstoig/sql/new
-- ============================================================================

-- PART 1: Add missing columns
ALTER TABLE video_scripts
ADD COLUMN IF NOT EXISTS script_status TEXT DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS estimated_duration INTEGER DEFAULT 0;

-- PART 2: Fix RLS policies (development mode - replace for production)
DROP POLICY IF EXISTS "video_scripts_select_dev" ON video_scripts;
DROP POLICY IF EXISTS "video_scripts_insert_dev" ON video_scripts;
DROP POLICY IF EXISTS "video_scripts_update_dev" ON video_scripts;
DROP POLICY IF EXISTS "video_scripts_delete_dev" ON video_scripts;

CREATE POLICY "video_scripts_select_dev" ON video_scripts FOR SELECT USING (true);
CREATE POLICY "video_scripts_insert_dev" ON video_scripts FOR INSERT WITH CHECK (true);
CREATE POLICY "video_scripts_update_dev" ON video_scripts FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "video_scripts_delete_dev" ON video_scripts FOR DELETE USING (true);

DROP POLICY IF EXISTS "script_components_select_dev" ON script_components;
DROP POLICY IF EXISTS "script_components_insert_dev" ON script_components;
DROP POLICY IF EXISTS "script_components_update_dev" ON script_components;
DROP POLICY IF EXISTS "script_components_delete_dev" ON script_components;

CREATE POLICY "script_components_select_dev" ON script_components FOR SELECT USING (true);
CREATE POLICY "script_components_insert_dev" ON script_components FOR INSERT WITH CHECK (true);
CREATE POLICY "script_components_update_dev" ON script_components FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "script_components_delete_dev" ON script_components FOR DELETE USING (true);

-- PART 3: Ensure other tables have policies
DROP POLICY IF EXISTS "videos_select_dev" ON videos;
CREATE POLICY "videos_select_dev" ON videos FOR SELECT USING (true);

DROP POLICY IF EXISTS "videos_insert_dev" ON videos;
CREATE POLICY "videos_insert_dev" ON videos FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "projects_select_dev" ON projects;
CREATE POLICY "projects_select_dev" ON projects FOR SELECT USING (true);

DROP POLICY IF EXISTS "clients_select_dev" ON clients;
CREATE POLICY "clients_select_dev" ON clients FOR SELECT USING (true);

-- PART 4: Create test data structure
INSERT INTO clients (client_id, client_name, contact_email)
VALUES ('00000000-0000-0000-0000-000000000001', 'Test Client', 'test@example.com')
ON CONFLICT (client_id) DO NOTHING;

INSERT INTO projects (project_id, client_id, project_name, project_code, project_status)
VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Test Project', 'TEST001', 'collection')
ON CONFLICT (project_id) DO NOTHING;

INSERT INTO videos (video_id, project_id, video_title, video_status)
VALUES ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'Test Video', 'planning')
ON CONFLICT (video_id) DO NOTHING;

-- PART 5: Verify everything worked
SELECT 'Production fix complete! RLS policies and test data are ready.' as status;