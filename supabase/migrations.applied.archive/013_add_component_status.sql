-- ============================================================================
-- PURPOSE: Add missing component_status column to script_components table
-- ISSUE: Code expects component_status but column doesn't exist in schema
-- VISUAL-ARCHITECT-APPROVED: Database schema alignment
-- ============================================================================
-- Created: 2025-09-20 (Visual Architect - Critical Database Schema Fix)
-- TRACED Protocol: Database Schema Fix → Component Status Workflow Implementation

-- Add component_status column for workflow state management
-- Status values: 'created', 'in_edit', 'approved', 'deleted'
DO $$ BEGIN
    -- Check if column already exists to prevent errors
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'script_components'
        AND column_name = 'component_status'
    ) THEN
        ALTER TABLE script_components
        ADD COLUMN component_status TEXT DEFAULT 'created';

        -- Add constraint to ensure valid status values
        ALTER TABLE script_components
        ADD CONSTRAINT script_components_status_valid
        CHECK (component_status IN ('created', 'in_edit', 'approved', 'deleted'));

        -- Add index for status queries
        CREATE INDEX IF NOT EXISTS idx_script_components_status
        ON script_components(component_status);

        -- Update any existing components to have 'created' status
        UPDATE script_components
        SET component_status = 'created'
        WHERE component_status IS NULL;

        RAISE NOTICE 'Added component_status column to script_components table';
    ELSE
        RAISE NOTICE 'component_status column already exists in script_components table';
    END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE - Component Status Column Added
-- ============================================================================
-- FUNCTIONALITY ENABLED:
--   ✅ Workflow state management ('created', 'in_edit', 'approved', 'deleted')
--   ✅ Status validation constraint
--   ✅ Performance index for status queries
--   ✅ Backward compatibility with existing data
-- UNBLOCKS: + Add Component functionality and workflow management
-- ============================================================================