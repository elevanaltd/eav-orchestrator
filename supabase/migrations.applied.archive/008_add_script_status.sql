-- ============================================================================
-- HOLISTIC ORCHESTRATOR: Emergency Production Fix
-- ============================================================================
-- Purpose: Add missing script_status column that application code expects
-- Issue: App.tsx expects script_status but column doesn't exist in database
-- Impact: Production application failure at localhost:3000
-- Created: 2025-09-19 by Holistic Orchestrator (Emergency Response)
-- ============================================================================

-- Add script status type enum matching application expectations
DO $$ BEGIN
    CREATE TYPE script_status_enum AS ENUM (
        'draft',        -- Initial creation state
        'in_progress',  -- Active editing
        'review',       -- Under review
        'approved',     -- Ready for production
        'archived'      -- No longer active
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add missing columns to video_scripts table
ALTER TABLE video_scripts
ADD COLUMN IF NOT EXISTS script_status script_status_enum DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS estimated_duration INTEGER DEFAULT 0;

-- Update existing records to have valid status
UPDATE video_scripts
SET script_status = 'draft'
WHERE script_status IS NULL;

-- Add NOT NULL constraint after setting defaults
ALTER TABLE video_scripts
ALTER COLUMN script_status SET NOT NULL;

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_video_scripts_status
ON video_scripts(script_status);

-- Add comment for clarity
COMMENT ON COLUMN video_scripts.script_status IS 'Current workflow status of the script';
COMMENT ON COLUMN video_scripts.word_count IS 'Total word count of all script components';
COMMENT ON COLUMN video_scripts.estimated_duration IS 'Estimated duration in seconds based on word count';