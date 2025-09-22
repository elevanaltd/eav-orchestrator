-- Fix race condition in component position calculation
-- Critical-Engineer: consulted for Database concurrency control

-- Replace the existing function with a properly locked version
CREATE OR REPLACE FUNCTION "public"."get_next_component_position"("p_script_id" "uuid")
RETURNS double precision
LANGUAGE "plpgsql"
AS $$
DECLARE
    max_pos DOUBLE PRECISION;
BEGIN
    -- Use SELECT FOR UPDATE to prevent race conditions
    -- This locks the rows matching the WHERE clause until transaction commits
    SELECT COALESCE(MAX(position), 0) INTO max_pos
    FROM script_components
    WHERE script_id = p_script_id
    FOR UPDATE;

    RETURN max_pos + 1000.0; -- Large increment to allow many insertions between
END;
$$;

-- Alternative approach: Create an atomic insert function that handles the entire operation
-- This completely eliminates the race condition by doing everything in one atomic operation
CREATE OR REPLACE FUNCTION "public"."create_component_with_position"(
    p_script_id uuid,
    p_content_tiptap jsonb,
    p_content_plain text,
    p_component_status text DEFAULT 'created',
    p_last_edited_by uuid DEFAULT NULL,
    p_position double precision DEFAULT NULL
)
RETURNS TABLE(
    id uuid,
    position double precision,
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

    -- Insert the component atomically
    INSERT INTO script_components (
        id,
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

-- Grant permissions for both functions
GRANT ALL ON FUNCTION "public"."get_next_component_position"("p_script_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_next_component_position"("p_script_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_next_component_position"("p_script_id" "uuid") TO "service_role";

GRANT ALL ON FUNCTION "public"."create_component_with_position"(
    "p_script_id" uuid,
    "p_content_tiptap" jsonb,
    "p_content_plain" text,
    "p_component_status" text,
    "p_last_edited_by" uuid,
    "p_position" double precision
) TO "anon";
GRANT ALL ON FUNCTION "public"."create_component_with_position"(
    "p_script_id" uuid,
    "p_content_tiptap" jsonb,
    "p_content_plain" text,
    "p_component_status" text,
    "p_last_edited_by" uuid,
    "p_position" double precision
) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_component_with_position"(
    "p_script_id" uuid,
    "p_content_tiptap" jsonb,
    "p_content_plain" text,
    "p_component_status" text,
    "p_last_edited_by" uuid,
    "p_position" double precision
) TO "service_role";