-- CRITICAL-ENGINEER-APPROVED: CRITICAL-ENGINEER-20250911-17575666
-- Critical-Engineer: consulted for Architecture pattern selection
-- CRITICAL DATA LOSS PREVENTION: Optimistic Locking Implementation
-- ============================================================================
-- PURPOSE: Add optimistic locking to prevent concurrent edit data corruption
-- ISSUE: Two users dragging components simultaneously causes last-write-wins data loss
-- SOLUTION: Version-based optimistic locking with atomic database operations
-- ============================================================================
-- Created: 2025-09-11 (Implementation Lead)
-- TRACED Protocol: T (RED) → GREEN implementation phase

-- ============================================================================
-- 1. ADD VERSION COLUMN TO script_components
-- ============================================================================

-- Add version column for optimistic locking
ALTER TABLE script_components 
ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Create performance index on version
CREATE INDEX IF NOT EXISTS idx_script_components_version 
ON script_components(component_id, version);

-- Create compound index for WHERE id = ? AND version = ? queries
CREATE INDEX IF NOT EXISTS idx_script_components_id_version 
ON script_components(component_id, version);

-- ============================================================================
-- 2. ATOMIC UPDATE FUNCTION WITH OPTIMISTIC LOCKING
-- ============================================================================

CREATE OR REPLACE FUNCTION update_script_component_with_lock(
    p_component_id UUID,
    p_content JSONB,
    p_plain_text TEXT,
    p_current_version INTEGER,
    p_user_id UUID
) RETURNS TABLE (
    success BOOLEAN,
    new_version INTEGER,
    conflict_detected BOOLEAN,
    current_content JSONB,
    current_version INTEGER,
    error_message TEXT
) AS $$
DECLARE
    v_rows_affected INTEGER;
    v_current_version INTEGER;
    v_current_content JSONB;
    v_new_version INTEGER;
BEGIN
    -- Input validation
    IF p_component_id IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::INTEGER, FALSE, NULL::JSONB, NULL::INTEGER, 'Component ID is required'::TEXT;
        RETURN;
    END IF;
    
    IF p_current_version IS NULL OR p_current_version < 1 THEN
        RETURN QUERY SELECT FALSE, NULL::INTEGER, FALSE, NULL::JSONB, NULL::INTEGER, 'Valid version number is required'::TEXT;
        RETURN;
    END IF;
    
    -- ATOMIC UPDATE: Critical section - check version and update in single statement
    -- This prevents race conditions between concurrent edits
    UPDATE script_components
    SET 
        content_tiptap = p_content,
        content_plain = p_plain_text,
        version = version + 1,
        last_edited_by = p_user_id,
        last_edited_at = NOW(),
        updated_at = NOW()
    WHERE 
        component_id = p_component_id 
        AND version = p_current_version;
    
    -- Check how many rows were affected
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    
    IF v_rows_affected = 0 THEN
        -- No rows updated - either component doesn't exist or version conflict
        -- CRITICAL ENGINEER REQUIREMENT: Return full current state for merge resolution
        SELECT version, content_tiptap 
        INTO v_current_version, v_current_content
        FROM script_components
        WHERE component_id = p_component_id;
        
        IF v_current_version IS NULL THEN
            -- Component not found
            RETURN QUERY SELECT FALSE, NULL::INTEGER, FALSE, NULL::JSONB, NULL::INTEGER, 'Component not found'::TEXT;
        ELSE
            -- Version conflict detected - return current state for merge resolution
            RETURN QUERY SELECT FALSE, NULL::INTEGER, TRUE, v_current_content, v_current_version, 'Version conflict detected'::TEXT;
        END IF;
    ELSE
        -- Success - return new version
        SELECT version INTO v_new_version
        FROM script_components
        WHERE component_id = p_component_id;
        
        RETURN QUERY SELECT TRUE, v_new_version, FALSE, NULL::JSONB, NULL::INTEGER, NULL::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- MIGRATION COMPLETE - Data Loss Prevention Active
-- ============================================================================
