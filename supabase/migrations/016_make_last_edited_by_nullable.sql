-- ============================================================================
-- MIGRATION: Make last_edited_by nullable for development
-- ============================================================================
-- ERROR-ARCHITECT: Foreign key constraint fix for component creation
-- Issue: Cannot create components without authenticated user
-- Solution: Make last_edited_by nullable to support development testing
-- Production: Will require authenticated user via application logic
-- ============================================================================

-- Make last_edited_by nullable in script_components table
ALTER TABLE script_components
ALTER COLUMN last_edited_by DROP NOT NULL;

-- Make last_edited_by nullable in video_scripts table
ALTER TABLE video_scripts
ALTER COLUMN last_edited_by DROP NOT NULL;

-- Add comment to document the change
COMMENT ON COLUMN script_components.last_edited_by IS
  'User who last edited this component. Nullable for development/testing, but should be set in production via application logic.';

COMMENT ON COLUMN video_scripts.last_edited_by IS
  'User who last edited this script. Nullable for development/testing, but should be set in production via application logic.';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- This is a temporary development fix. In production:
-- 1. Authentication will be required
-- 2. last_edited_by will be populated from auth.uid()
-- 3. RLS policies will enforce proper access control
-- ============================================================================