-- Fix the create_component_with_position function to use correct column names
-- Critical-Engineer: Identified incorrect column name causing schema cache issue

-- Drop and recreate the function with correct column names
DROP FUNCTION IF EXISTS "public"."create_component_with_position"(uuid, jsonb, text, text, uuid, double precision);

CREATE OR REPLACE FUNCTION "public"."create_component_with_position"(
    p_script_id uuid,
    p_content_tiptap jsonb,
    p_content_plain text,
    p_component_status text DEFAULT 'created',
    p_last_edited_by uuid DEFAULT NULL,
    p_position double precision DEFAULT NULL
)
RETURNS TABLE(
    component_id uuid,
    component_position double precision,
    created_at timestamptz
)
LANGUAGE "plpgsql"
AS $$
DECLARE
    final_position DOUBLE PRECISION;
    new_id uuid;
    new_created_at timestamptz;
BEGIN
    -- If position not provided, calculate it atomically
    IF p_position IS NULL THEN
        -- Lock and get max position for this script
        SELECT COALESCE(MAX(sc.position), 0) + 1000.0 INTO final_position
        FROM script_components sc
        WHERE sc.script_id = p_script_id
        FOR UPDATE;
    ELSE
        final_position := p_position;
    END IF;

    -- Generate new UUID and timestamp
    new_id := gen_random_uuid();
    new_created_at := now();

    -- Insert the component atomically with CORRECT column name
    INSERT INTO script_components (
        component_id,  -- FIXED: was 'id', now 'component_id'
        script_id,
        content_tiptap,
        content_plain,
        position,
        component_status,
        last_edited_at,
        last_edited_by,
        created_at,
        updated_at,
        version
    ) VALUES (
        new_id,
        p_script_id,
        p_content_tiptap,
        p_content_plain,
        final_position,
        p_component_status,
        new_created_at,
        p_last_edited_by,
        new_created_at,
        new_created_at,
        1
    );

    -- Return the new component details
    RETURN QUERY SELECT new_id, final_position, new_created_at;
END;
$$;

-- Grant permissions for the function
GRANT EXECUTE ON FUNCTION "public"."create_component_with_position"(
    uuid, jsonb, text, text, uuid, double precision
) TO "anon";
GRANT EXECUTE ON FUNCTION "public"."create_component_with_position"(
    uuid, jsonb, text, text, uuid, double precision
) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."create_component_with_position"(
    uuid, jsonb, text, text, uuid, double precision
) TO "service_role";

-- Force schema cache refresh by creating a dummy comment
COMMENT ON FUNCTION "public"."create_component_with_position"(uuid, jsonb, text, text, uuid, double precision)
IS 'Atomic component creation with automatic position calculation - fixed column names';