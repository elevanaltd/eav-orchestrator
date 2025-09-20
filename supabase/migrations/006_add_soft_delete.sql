-- ============================================================================
-- Migration 004: Add Soft Delete Support to Script Components
-- Technical Architect: Implementing hybrid delete strategy per ADR-113
-- Date: 2025-09-17
-- ============================================================================

-- Add soft delete columns to script_components
ALTER TABLE script_components
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- Create index for efficient soft delete queries
-- This partial index only includes non-deleted records for optimal performance
CREATE INDEX IF NOT EXISTS idx_script_components_not_deleted
ON script_components(script_id, position)
WHERE deleted_at IS NULL;

-- Create index for finding deleted records (for admin operations)
CREATE INDEX IF NOT EXISTS idx_script_components_deleted
ON script_components(script_id, deleted_at)
WHERE deleted_at IS NOT NULL;

-- ============================================================================
-- Helper function to check if user can delete component
-- ============================================================================
CREATE OR REPLACE FUNCTION can_delete_component(
    p_user_id UUID,
    p_component_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_script_id UUID;
    v_user_role TEXT;
BEGIN
    -- Get script ID for the component
    SELECT script_id INTO v_script_id
    FROM script_components
    WHERE component_id = p_component_id;

    IF v_script_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check user role
    SELECT role_type INTO v_user_role
    FROM user_roles
    WHERE user_id = p_user_id
      AND is_active = true
    ORDER BY
        CASE role_type
            WHEN 'admin' THEN 1
            WHEN 'internal' THEN 2
            WHEN 'freelancer' THEN 3
            ELSE 4
        END
    LIMIT 1;

    -- Admin and internal can delete any component
    IF v_user_role IN ('admin', 'internal') THEN
        RETURN TRUE;
    END IF;

    -- Freelancer can delete components they created
    IF v_user_role = 'freelancer' THEN
        RETURN EXISTS (
            SELECT 1 FROM script_components
            WHERE component_id = p_component_id
              AND last_edited_by = p_user_id
        );
    END IF;

    -- Client and viewer cannot delete
    RETURN FALSE;
END;
$$;

-- ============================================================================
-- Helper function for bulk position updates (for reordering after delete)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_component_positions(
    p_updates JSONB
) RETURNS TABLE (
    component_id UUID,
    new_position DOUBLE PRECISION,
    success BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_update JSONB;
    v_component_id UUID;
    v_position DOUBLE PRECISION;
BEGIN
    -- Parse and apply each position update
    FOR v_update IN SELECT jsonb_array_elements(p_updates)
    LOOP
        v_component_id := (v_update->>'component_id')::UUID;
        v_position := (v_update->>'position')::DOUBLE PRECISION;

        BEGIN
            UPDATE script_components
            SET position = v_position,
                updated_at = NOW()
            WHERE script_components.component_id = v_component_id
              AND deleted_at IS NULL;

            RETURN QUERY SELECT v_component_id, v_position, true;
        EXCEPTION WHEN OTHERS THEN
            RETURN QUERY SELECT v_component_id, v_position, false;
        END;
    END LOOP;
END;
$$;

-- ============================================================================
-- Function to hard delete old soft-deleted records (admin only)
-- ============================================================================
CREATE OR REPLACE FUNCTION hard_delete_old_components(
    p_days_old INTEGER DEFAULT 30
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Only allow admin users to execute
    IF NOT EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = auth.uid()
          AND role_type = 'admin'
          AND is_active = true
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Admin access required';
    END IF;

    -- Delete components soft-deleted more than p_days_old days ago
    DELETE FROM script_components
    WHERE deleted_at IS NOT NULL
      AND deleted_at < NOW() - INTERVAL '1 day' * p_days_old;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN v_deleted_count;
END;
$$;

-- ============================================================================
-- Update RLS policies to respect soft delete
-- ============================================================================

-- Drop existing select policy if it exists
DROP POLICY IF EXISTS "Users can view components" ON script_components;

-- Create new select policy that respects soft delete
CREATE POLICY "Users can view non-deleted components"
    ON script_components
    FOR SELECT
    USING (
        deleted_at IS NULL
        AND EXISTS (
            SELECT 1 FROM video_scripts vs
            JOIN videos v ON v.video_id = vs.video_id
            JOIN projects p ON p.project_id = v.project_id
            WHERE vs.script_id = script_components.script_id
              AND (
                  -- Admin can see all
                  EXISTS (
                      SELECT 1 FROM user_roles ur
                      WHERE ur.user_id = auth.uid()
                        AND ur.role_type = 'admin'
                        AND ur.is_active = true
                  )
                  -- Internal and freelancer can see their projects
                  OR EXISTS (
                      SELECT 1 FROM user_roles ur
                      WHERE ur.user_id = auth.uid()
                        AND ur.role_type IN ('internal', 'freelancer')
                        AND ur.is_active = true
                  )
                  -- Client can see their client's projects
                  OR p.client_id IN (
                      SELECT c.client_id FROM clients c
                      JOIN user_roles ur ON ur.user_id = auth.uid()
                      WHERE ur.role_type = 'client'
                        AND ur.is_active = true
                  )
              )
        )
    );

-- Policy for viewing deleted components (admin only)
CREATE POLICY "Admins can view deleted components"
    ON script_components
    FOR SELECT
    USING (
        deleted_at IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid()
              AND ur.role_type = 'admin'
              AND ur.is_active = true
        )
    );

-- Update policy for soft delete operation
CREATE POLICY "Users can soft delete components"
    ON script_components
    FOR UPDATE
    USING (
        can_delete_component(auth.uid(), component_id)
    )
    WITH CHECK (
        can_delete_component(auth.uid(), component_id)
    );

-- ============================================================================
-- Create view for active components (excludes soft-deleted)
-- ============================================================================
CREATE OR REPLACE VIEW active_script_components AS
SELECT
    component_id,
    script_id,
    position,
    title,
    content_tiptap,
    content_plain,
    content_hash,
    component_type,
    yjs_document_room,
    last_edited_by,
    last_edited_at,
    created_at,
    updated_at
FROM script_components
WHERE deleted_at IS NULL
ORDER BY position;

-- Grant appropriate permissions on the view
GRANT SELECT ON active_script_components TO authenticated;

-- ============================================================================
-- Audit log for delete operations
-- ============================================================================
CREATE TABLE IF NOT EXISTS component_deletion_audit (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_id UUID NOT NULL,
    script_id UUID NOT NULL,
    deleted_by UUID NOT NULL REFERENCES auth.users(id),
    deleted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    deletion_type TEXT NOT NULL CHECK (deletion_type IN ('soft', 'hard', 'restore')),
    deletion_reason TEXT,
    component_snapshot JSONB, -- Store component state at deletion
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient audit queries
CREATE INDEX IF NOT EXISTS idx_deletion_audit_component
ON component_deletion_audit(component_id, deleted_at DESC);

-- Trigger to log deletions
CREATE OR REPLACE FUNCTION log_component_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- Log soft delete
    IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        INSERT INTO component_deletion_audit (
            component_id,
            script_id,
            deleted_by,
            deleted_at,
            deletion_type,
            deletion_reason,
            component_snapshot
        ) VALUES (
            NEW.component_id,
            NEW.script_id,
            NEW.deleted_by,
            NEW.deleted_at,
            'soft',
            NEW.deletion_reason,
            to_jsonb(OLD)
        );
    END IF;

    -- Log restore
    IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
        INSERT INTO component_deletion_audit (
            component_id,
            script_id,
            deleted_by,
            deleted_at,
            deletion_type,
            deletion_reason,
            component_snapshot
        ) VALUES (
            NEW.component_id,
            NEW.script_id,
            NEW.last_edited_by,
            NOW(),
            'restore',
            'Component restored',
            to_jsonb(OLD)
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_component_deletion_trigger
AFTER UPDATE OF deleted_at ON script_components
FOR EACH ROW
EXECUTE FUNCTION log_component_deletion();

-- Trigger for hard delete logging
CREATE OR REPLACE FUNCTION log_component_hard_deletion()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.deleted_at IS NOT NULL THEN
        INSERT INTO component_deletion_audit (
            component_id,
            script_id,
            deleted_by,
            deleted_at,
            deletion_type,
            deletion_reason,
            component_snapshot
        ) VALUES (
            OLD.component_id,
            OLD.script_id,
            COALESCE(OLD.deleted_by, auth.uid()),
            NOW(),
            'hard',
            'Permanently deleted',
            to_jsonb(OLD)
        );
    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_component_hard_deletion_trigger
BEFORE DELETE ON script_components
FOR EACH ROW
EXECUTE FUNCTION log_component_hard_deletion();

-- ============================================================================
-- Performance optimization: Update component version function to skip deleted
-- ============================================================================
CREATE OR REPLACE FUNCTION get_script_component_version(
    p_component_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_version INTEGER;
BEGIN
    SELECT version INTO v_version
    FROM script_components
    WHERE component_id = p_component_id
      AND deleted_at IS NULL; -- Skip deleted components

    RETURN COALESCE(v_version, 0);
END;
$$;

-- ============================================================================
-- Migration completion message
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Migration 004 completed successfully:';
    RAISE NOTICE '- Added soft delete columns to script_components';
    RAISE NOTICE '- Created deletion audit table';
    RAISE NOTICE '- Updated RLS policies to respect soft delete';
    RAISE NOTICE '- Created helper functions for delete operations';
    RAISE NOTICE '- Created active_script_components view';
END $$;