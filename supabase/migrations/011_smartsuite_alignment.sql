-- ============================================================================
-- SMARTSUITE SCHEMA ALIGNMENT MIGRATION
-- ============================================================================
-- Purpose: Align database schema with SmartSuite Videos table structure
-- Strategy: Store SmartSuite IDs for sync, duplicate essential fields for performance
-- Created: 2025-09-19 by Holistic Orchestrator
-- ============================================================================

-- ============================================================================
-- STEP 1: Drop existing test data and prepare for restructure
-- ============================================================================
TRUNCATE TABLE video_scripts CASCADE;
TRUNCATE TABLE videos CASCADE;
TRUNCATE TABLE projects CASCADE;
TRUNCATE TABLE clients CASCADE;

-- ============================================================================
-- STEP 2: Enhance clients table to match SmartSuite structure
-- ============================================================================
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS smartsuite_record_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS primary_contact TEXT,
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP WITH TIME ZONE;

-- Create index for SmartSuite lookups
CREATE INDEX IF NOT EXISTS idx_clients_smartsuite_id ON clients(smartsuite_record_id);

-- ============================================================================
-- STEP 3: Enhance projects table to match SmartSuite structure
-- ============================================================================
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS smartsuite_record_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS eav_code TEXT UNIQUE,  -- Critical for business logic
ADD COLUMN IF NOT EXISTS project_type TEXT,      -- Generic/Bespoke
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal', -- Urgent/High/Normal/Low
ADD COLUMN IF NOT EXISTS main_stream_status TEXT,
ADD COLUMN IF NOT EXISTS vo_stream_status TEXT,
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP WITH TIME ZONE;

-- Create indexes for lookups
CREATE INDEX IF NOT EXISTS idx_projects_smartsuite_id ON projects(smartsuite_record_id);
CREATE INDEX IF NOT EXISTS idx_projects_eav_code ON projects(eav_code);

-- ============================================================================
-- STEP 4: Restructure videos table to match SmartSuite Videos
-- ============================================================================
ALTER TABLE videos
ADD COLUMN IF NOT EXISTS smartsuite_record_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS video_name TEXT,        -- The actual name from SmartSuite
ADD COLUMN IF NOT EXISTS sequence_number INTEGER, -- Video sequence in project
ADD COLUMN IF NOT EXISTS video_type TEXT,        -- Generic/Bespoke
ADD COLUMN IF NOT EXISTS production_type TEXT,   -- New/Amendment/Reuse
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS main_stream_status TEXT,
ADD COLUMN IF NOT EXISTS vo_stream_status TEXT,
ADD COLUMN IF NOT EXISTS target_word_count INTEGER,
ADD COLUMN IF NOT EXISTS actual_word_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP WITH TIME ZONE;

-- Update video_title to be computed from sequence + name
ALTER TABLE videos
ALTER COLUMN video_title DROP NOT NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_videos_smartsuite_id ON videos(smartsuite_record_id);
CREATE INDEX IF NOT EXISTS idx_videos_project_sequence ON videos(project_id, sequence_number);

-- ============================================================================
-- STEP 5: Add SmartSuite tracking to video_scripts
-- ============================================================================
ALTER TABLE video_scripts
ADD COLUMN IF NOT EXISTS smartsuite_video_id TEXT,  -- Links to Videos table in SmartSuite
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'local_only',
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP WITH TIME ZONE;

-- Create index
CREATE INDEX IF NOT EXISTS idx_video_scripts_smartsuite_video ON video_scripts(smartsuite_video_id);

-- ============================================================================
-- STEP 6: Create sync tracking table
-- ============================================================================
CREATE TABLE IF NOT EXISTS smartsuite_sync_log (
  sync_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID,
  smartsuite_id TEXT,
  action TEXT NOT NULL, -- 'import', 'export', 'update', 'delete'
  status TEXT NOT NULL, -- 'success', 'failed', 'pending'
  error_message TEXT,
  sync_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_log_table_record ON smartsuite_sync_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_smartsuite ON smartsuite_sync_log(smartsuite_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON smartsuite_sync_log(status);

-- ============================================================================
-- STEP 7: Create function to import video from SmartSuite
-- ============================================================================
CREATE OR REPLACE FUNCTION import_video_from_smartsuite(
  p_smartsuite_id TEXT,
  p_video_name TEXT,
  p_sequence INTEGER,
  p_project_smartsuite_id TEXT,
  p_eav_code TEXT,
  p_video_type TEXT DEFAULT 'generic',
  p_production_type TEXT DEFAULT 'new',
  p_priority TEXT DEFAULT 'normal'
) RETURNS UUID AS $$
DECLARE
  v_project_id UUID;
  v_video_id UUID;
  v_script_id UUID;
BEGIN
  -- First ensure project exists
  SELECT project_id INTO v_project_id
  FROM projects
  WHERE smartsuite_record_id = p_project_smartsuite_id;

  IF v_project_id IS NULL THEN
    -- Create minimal project record
    INSERT INTO projects (
      smartsuite_record_id,
      eav_code,
      project_name,
      project_code,
      project_status,
      client_id
    ) VALUES (
      p_project_smartsuite_id,
      p_eav_code,
      p_eav_code || ' Project',
      p_eav_code,
      'collection',
      '00000000-0000-0000-0000-000000000001' -- Default client for now
    ) RETURNING project_id INTO v_project_id;
  END IF;

  -- Create or update video
  INSERT INTO videos (
    smartsuite_record_id,
    project_id,
    video_name,
    video_title,
    sequence_number,
    video_type,
    production_type,
    priority,
    video_status,
    sync_status,
    last_sync_at
  ) VALUES (
    p_smartsuite_id,
    v_project_id,
    p_video_name,
    p_sequence || '-' || p_video_name, -- Computed title
    p_sequence,
    p_video_type,
    p_production_type,
    p_priority,
    'planning',
    'synced',
    NOW()
  )
  ON CONFLICT (smartsuite_record_id) DO UPDATE
  SET
    video_name = EXCLUDED.video_name,
    video_title = EXCLUDED.video_title,
    sequence_number = EXCLUDED.sequence_number,
    video_type = EXCLUDED.video_type,
    production_type = EXCLUDED.production_type,
    priority = EXCLUDED.priority,
    sync_status = 'synced',
    last_sync_at = NOW()
  RETURNING video_id INTO v_video_id;

  -- Create script if it doesn't exist
  SELECT script_id INTO v_script_id
  FROM video_scripts
  WHERE video_id = v_video_id;

  IF v_script_id IS NULL THEN
    INSERT INTO video_scripts (
      video_id,
      title,
      description,
      script_status,
      smartsuite_video_id,
      sync_status
    ) VALUES (
      v_video_id,
      p_sequence || '-' || p_video_name,
      'Script for ' || p_video_name,
      'draft',
      p_smartsuite_id,
      'synced'
    ) RETURNING script_id INTO v_script_id;
  END IF;

  -- Log the sync
  INSERT INTO smartsuite_sync_log (
    table_name,
    record_id,
    smartsuite_id,
    action,
    status
  ) VALUES (
    'videos',
    v_video_id,
    p_smartsuite_id,
    'import',
    'success'
  );

  RETURN v_video_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 8: Import test videos from SmartSuite
-- ============================================================================
-- Create default client for development
INSERT INTO clients (client_id, client_name, contact_email)
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Client', 'dev@example.com')
ON CONFLICT (client_id) DO NOTHING;

-- Import the test videos we know about
SELECT import_video_from_smartsuite(
  '68c2c7c8108d1de06aa1b7c2', '4-Test Video 1', 4,
  '68aa9add9bedb640d0a3bc0c', 'EAV007', 'generic', 'new', 'normal'
);

SELECT import_video_from_smartsuite(
  '68c2c7c8108d1de06aa1b7c3', '16-Test Video 2', 16,
  '68aa9add9bedb640d0a3bc0c', 'EAV007', 'generic', 'new', 'normal'
);

SELECT import_video_from_smartsuite(
  '68c2c7c8108d1de06aa1b7c4', '28-Test Video 3', 28,
  '68aa9add9bedb640d0a3bc0c', 'EAV007', 'generic', 'new', 'normal'
);

SELECT import_video_from_smartsuite(
  '68c2c7c8108d1de06aa1b7c5', '9-Test Video 4', 9,
  '68aa9add9bedb640d0a3bc0c', 'EAV007', 'generic', 'new', 'normal'
);

-- ============================================================================
-- STEP 9: Update helper function for script creation
-- ============================================================================
CREATE OR REPLACE FUNCTION create_script_for_smartsuite_video(
  p_smartsuite_video_id TEXT,
  p_title TEXT,
  p_description TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_video_id UUID;
  v_script_id UUID;
BEGIN
  -- Find the video by SmartSuite ID
  SELECT video_id INTO v_video_id
  FROM videos
  WHERE smartsuite_record_id = p_smartsuite_video_id;

  IF v_video_id IS NULL THEN
    RAISE EXCEPTION 'Video with SmartSuite ID % not found. Import it first.', p_smartsuite_video_id;
  END IF;

  -- Check if script already exists
  SELECT script_id INTO v_script_id
  FROM video_scripts
  WHERE video_id = v_video_id;

  IF v_script_id IS NOT NULL THEN
    RAISE EXCEPTION 'Script already exists for this video';
  END IF;

  -- Create the script
  INSERT INTO video_scripts (
    video_id,
    title,
    description,
    script_status,
    smartsuite_video_id,
    word_count,
    estimated_duration
  ) VALUES (
    v_video_id,
    p_title,
    p_description,
    'draft',
    p_smartsuite_video_id,
    0,
    0
  ) RETURNING script_id INTO v_script_id;

  RETURN v_script_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 10: Verify setup
-- ============================================================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM videos WHERE smartsuite_record_id IS NOT NULL;
  RAISE NOTICE 'SmartSuite-aligned videos imported: %', v_count;

  SELECT COUNT(*) INTO v_count FROM video_scripts WHERE smartsuite_video_id IS NOT NULL;
  RAISE NOTICE 'Scripts linked to SmartSuite: %', v_count;

  RAISE NOTICE '';
  RAISE NOTICE 'Database now aligned with SmartSuite structure.';
  RAISE NOTICE 'Use import_video_from_smartsuite() to import videos.';
  RAISE NOTICE 'Use create_script_for_smartsuite_video() to create scripts.';
END $$;