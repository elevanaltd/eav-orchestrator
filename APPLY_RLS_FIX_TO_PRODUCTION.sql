-- ============================================================================
-- PRODUCTION EMERGENCY FIX: RLS Policies
-- ============================================================================
-- TO APPLY THIS FIX:
-- 1. Go to: https://supabase.com/dashboard/project/vbcfaegexbygqgsstoig/sql/new
-- 2. Copy and paste this entire SQL script
-- 3. Click "Run" to execute
-- ============================================================================
-- CRITICAL: This unblocks the application by adding temporary development policies
-- TODO: Replace with proper auth-based policies before production launch
-- ============================================================================

-- Drop any existing policies first (clean slate)
DROP POLICY IF EXISTS "video_scripts_temp_select" ON video_scripts;
DROP POLICY IF EXISTS "video_scripts_temp_insert" ON video_scripts;
DROP POLICY IF EXISTS "video_scripts_temp_update" ON video_scripts;
DROP POLICY IF EXISTS "video_scripts_temp_delete" ON video_scripts;

DROP POLICY IF EXISTS "script_components_temp_select" ON script_components;
DROP POLICY IF EXISTS "script_components_temp_insert" ON script_components;
DROP POLICY IF EXISTS "script_components_temp_update" ON script_components;
DROP POLICY IF EXISTS "script_components_temp_delete" ON script_components;

DROP POLICY IF EXISTS "videos_temp_select" ON videos;
DROP POLICY IF EXISTS "videos_temp_insert" ON videos;
DROP POLICY IF EXISTS "videos_temp_update" ON videos;

DROP POLICY IF EXISTS "projects_temp_select" ON projects;
DROP POLICY IF EXISTS "projects_temp_insert" ON projects;

DROP POLICY IF EXISTS "clients_temp_select" ON clients;
DROP POLICY IF EXISTS "clients_temp_insert" ON clients;

-- Video Scripts - Allow all operations for development
CREATE POLICY "video_scripts_temp_select" ON video_scripts
  FOR SELECT USING (true);

CREATE POLICY "video_scripts_temp_insert" ON video_scripts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "video_scripts_temp_update" ON video_scripts
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "video_scripts_temp_delete" ON video_scripts
  FOR DELETE USING (true);

-- Script Components - Allow all operations
CREATE POLICY "script_components_temp_select" ON script_components
  FOR SELECT USING (true);

CREATE POLICY "script_components_temp_insert" ON script_components
  FOR INSERT WITH CHECK (true);

CREATE POLICY "script_components_temp_update" ON script_components
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "script_components_temp_delete" ON script_components
  FOR DELETE USING (true);

-- Videos - Allow read and insert (needed for foreign keys)
CREATE POLICY "videos_temp_select" ON videos
  FOR SELECT USING (true);

CREATE POLICY "videos_temp_insert" ON videos
  FOR INSERT WITH CHECK (true);

CREATE POLICY "videos_temp_update" ON videos
  FOR UPDATE USING (true) WITH CHECK (true);

-- Projects - Allow read and insert
CREATE POLICY "projects_temp_select" ON projects
  FOR SELECT USING (true);

CREATE POLICY "projects_temp_insert" ON projects
  FOR INSERT WITH CHECK (true);

-- Clients - Allow read and insert
CREATE POLICY "clients_temp_select" ON clients
  FOR SELECT USING (true);

CREATE POLICY "clients_temp_insert" ON clients
  FOR INSERT WITH CHECK (true);

-- Verify the fix worked
SELECT
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN ('video_scripts', 'script_components', 'videos', 'projects', 'clients')
GROUP BY tablename
ORDER BY tablename;