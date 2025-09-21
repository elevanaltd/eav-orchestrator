-- ============================================================================
-- HOLISTIC ORCHESTRATOR: Emergency RLS Policy Fix
-- ============================================================================
-- Purpose: Add missing RLS policies that are blocking all database operations
-- Issue: RLS is enabled but no policies exist, causing complete lockout
-- Impact: Users cannot create, read, update, or delete any data
-- Created: 2025-09-19 by Holistic Orchestrator (Emergency Response)
-- ============================================================================

-- ============================================================================
-- TEMPORARY DEVELOPMENT POLICIES - Replace with proper auth in production
-- ============================================================================
-- WARNING: These policies allow all operations for development
-- Must be replaced with proper user-based policies before production

-- Video Scripts Policies
CREATE POLICY "video_scripts_temp_select" ON video_scripts
  FOR SELECT
  USING (true);  -- Allow all reads during development

CREATE POLICY "video_scripts_temp_insert" ON video_scripts
  FOR INSERT
  WITH CHECK (true);  -- Allow all inserts during development

CREATE POLICY "video_scripts_temp_update" ON video_scripts
  FOR UPDATE
  USING (true)
  WITH CHECK (true);  -- Allow all updates during development

CREATE POLICY "video_scripts_temp_delete" ON video_scripts
  FOR DELETE
  USING (true);  -- Allow all deletes during development

-- Script Components Policies
CREATE POLICY "script_components_temp_select" ON script_components
  FOR SELECT
  USING (true);

CREATE POLICY "script_components_temp_insert" ON script_components
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "script_components_temp_update" ON script_components
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "script_components_temp_delete" ON script_components
  FOR DELETE
  USING (true);

-- Videos Policies (needed for foreign key relationships)
CREATE POLICY "videos_temp_select" ON videos
  FOR SELECT
  USING (true);

CREATE POLICY "videos_temp_insert" ON videos
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "videos_temp_update" ON videos
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Projects Policies (needed for relationships)
CREATE POLICY "projects_temp_select" ON projects
  FOR SELECT
  USING (true);

CREATE POLICY "projects_temp_insert" ON projects
  FOR INSERT
  WITH CHECK (true);

-- Clients Policies (needed for relationships)
CREATE POLICY "clients_temp_select" ON clients
  FOR SELECT
  USING (true);

CREATE POLICY "clients_temp_insert" ON clients
  FOR INSERT
  WITH CHECK (true);

-- Script Comments Policies
CREATE POLICY "script_comments_temp_select" ON script_comments
  FOR SELECT
  USING (true);

CREATE POLICY "script_comments_temp_insert" ON script_comments
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "script_comments_temp_update" ON script_comments
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "script_comments_temp_delete" ON script_comments
  FOR DELETE
  USING (true);

-- ============================================================================
-- TODO: PRODUCTION POLICIES
-- ============================================================================
-- Before production deployment, replace these with proper policies:
-- 1. Authenticated users only (auth.uid() IS NOT NULL)
-- 2. Role-based access (admin, internal, freelancer, client, viewer)
-- 3. Project-based isolation (users see only their projects)
-- 4. Proper create/update permissions based on roles
-- ============================================================================

-- Verify policies are created
SELECT
  schemaname,
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE tablename IN ('video_scripts', 'script_components', 'videos', 'projects', 'clients')
ORDER BY tablename, policyname;