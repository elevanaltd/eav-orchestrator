-- ============================================================================
-- SYSTEM DEFAULT HIERARCHY MIGRATION
-- ============================================================================
-- Purpose: Create system-owned default entities for first-time user experience
-- Pattern: System-Owned Default Hierarchy (Technical Architect Approved)
-- Created: 2025-09-19 by Holistic Orchestrator
-- ============================================================================

-- ============================================================================
-- STEP 1: Add system default flags to tables
-- ============================================================================
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS is_system_default BOOLEAN DEFAULT false;

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS is_system_default BOOLEAN DEFAULT false;

ALTER TABLE videos
ADD COLUMN IF NOT EXISTS is_system_default BOOLEAN DEFAULT false;

-- Create indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_clients_system_default ON clients(is_system_default) WHERE is_system_default = true;
CREATE INDEX IF NOT EXISTS idx_projects_system_default ON projects(is_system_default) WHERE is_system_default = true;
CREATE INDEX IF NOT EXISTS idx_videos_system_default ON videos(is_system_default) WHERE is_system_default = true;

-- ============================================================================
-- STEP 2: Create system default hierarchy
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
  SET is_system_default = true;

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
  SET is_system_default = true;

-- ============================================================================
-- STEP 3: Create function to get default video ID
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

-- ============================================================================
-- STEP 4: Create function to ensure defaults exist
-- ============================================================================
CREATE OR REPLACE FUNCTION ensure_system_defaults()
RETURNS VOID AS $$
BEGIN
  -- This function can be called on app startup to ensure defaults exist
  IF NOT EXISTS (SELECT 1 FROM clients WHERE is_system_default = true) THEN
    INSERT INTO clients (client_name, contact_email, is_system_default)
    VALUES ('System Default Client', 'system@eav-orchestrator.local', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM projects WHERE is_system_default = true) THEN
    INSERT INTO projects (
      client_id,
      project_name,
      project_code,
      project_status,
      is_system_default
    )
    SELECT
      client_id,
      'Uncategorized Scripts',
      'UNCATEGORIZED',
      'setup',
      true
    FROM clients
    WHERE is_system_default = true
    LIMIT 1;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM videos WHERE is_system_default = true) THEN
    INSERT INTO videos (
      project_id,
      video_title,
      video_description,
      video_status,
      is_system_default
    )
    SELECT
      project_id,
      'Uncategorized Video Scripts',
      'Default container for scripts created without a project context',
      'planning',
      true
    FROM projects
    WHERE is_system_default = true
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 5: Create RPC endpoint for getting default video
-- ============================================================================
CREATE OR REPLACE FUNCTION rpc_get_default_video_id()
RETURNS UUID AS $$
  SELECT get_default_video_id();
$$ LANGUAGE sql STABLE;

-- Grant access to the RPC function
GRANT EXECUTE ON FUNCTION rpc_get_default_video_id() TO anon, authenticated;

-- ============================================================================
-- STEP 6: Verify setup
-- ============================================================================
DO $$
DECLARE
  v_default_id UUID;
BEGIN
  v_default_id := get_default_video_id();
  RAISE NOTICE 'System default video ID: %', v_default_id;
  RAISE NOTICE 'System defaults created successfully.';
  RAISE NOTICE 'Apps should call get_default_video_id() to get the default video for new scripts.';
END $$;