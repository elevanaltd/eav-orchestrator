-- ============================================================================
-- EAV ORCHESTRATOR PRODUCTION BASELINE
-- ============================================================================
-- Source: Production database dump (2025-09-21)
-- Technical-Architect: Single source-of-truth migration baseline
-- Replaces: 14 accumulated migration files (003-021)
-- Status: Production-verified schema with all features
-- ============================================================================
--
-- This file represents the complete production database schema as of 2025-09-21.
-- All previous migrations (003-021) have been consolidated into this baseline.
--
-- Includes:
-- - Core EAV Orchestrator schema (14 tables)
-- - Y.js collaborative editing infrastructure
-- - Authentication and user management
-- - RLS security policies (26 policies)
-- - Optimistic locking and circuit breaker patterns
-- - SmartSuite integration foundations
--
-- Future migrations will be incremental changes from this baseline.
-- ============================================================================



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "knowledge_platform";


ALTER SCHEMA "knowledge_platform" OWNER TO "postgres";


COMMENT ON SCHEMA "knowledge_platform" IS 'Event-sourced knowledge management system for SmartSuite field mappings and API patterns';



COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."component_type_enum" AS ENUM (
    'intro',
    'main',
    'transition',
    'conclusion'
);


ALTER TYPE "public"."component_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."project_status_enum" AS ENUM (
    'setup',
    'collection',
    'scripting',
    'review',
    'production',
    'delivery',
    'complete'
);


ALTER TYPE "public"."project_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."user_role_enum" AS ENUM (
    'admin',
    'internal',
    'freelancer',
    'client',
    'viewer'
);


ALTER TYPE "public"."user_role_enum" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "knowledge_platform"."get_latest_snapshot"("p_aggregate_id" "uuid", "p_aggregate_type" character varying DEFAULT NULL::character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT state INTO v_result
  FROM knowledge_platform.snapshots
  WHERE aggregate_id = p_aggregate_id
    AND (p_aggregate_type IS NULL OR aggregate_type = p_aggregate_type)
  LIMIT 1;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "knowledge_platform"."get_latest_snapshot"("p_aggregate_id" "uuid", "p_aggregate_type" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "knowledge_platform"."refresh_field_mappings"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY knowledge_platform.field_mappings;
END;
$$;


ALTER FUNCTION "knowledge_platform"."refresh_field_mappings"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "knowledge_platform"."refresh_materialized_view"("view_name" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  -- Validate the view name to prevent SQL injection
  IF view_name NOT IN ('field_mappings') THEN
    RAISE EXCEPTION 'Invalid view name: %', view_name;
  END IF;

  -- Refresh the materialized view
  EXECUTE format('REFRESH MATERIALIZED VIEW knowledge_platform.%I', view_name);
END;
$$;


ALTER FUNCTION "knowledge_platform"."refresh_materialized_view"("view_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "knowledge_platform"."refresh_materialized_view"("view_name" "text") IS 'Safely refresh materialized views in the knowledge_platform schema';



CREATE OR REPLACE FUNCTION "public"."append_yjs_update"("p_document_id" "uuid", "p_update_data" "bytea", "p_expected_version" integer, "p_new_state_vector" "bytea" DEFAULT NULL::"bytea") RETURNS TABLE("success" boolean, "sequence_number" bigint, "new_version" integer, "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_sequence BIGINT;
    v_new_version INTEGER;
    v_rows_updated INTEGER;
BEGIN
    -- Input validation
    IF p_document_id IS NULL OR p_update_data IS NULL OR p_expected_version IS NULL THEN
        RETURN QUERY SELECT FALSE, NULL::BIGINT, NULL::INTEGER, 
                           'Document ID, update data, and expected version required'::TEXT;
        RETURN;
    END IF;
    
    -- Append update to log (RLS enforces write permissions)
    INSERT INTO yjs_document_updates (document_id, update_data, created_by)
    VALUES (p_document_id, p_update_data, auth.uid())
    RETURNING sequence_number INTO v_sequence;
    
    -- Update state vector with OPTIMISTIC LOCKING
    IF p_new_state_vector IS NOT NULL THEN
        UPDATE yjs_documents 
        SET 
            state_vector = p_new_state_vector,
            updated_at = NOW(),
            last_edited_by = auth.uid(),
            version = version + 1,
            update_count = update_count + 1
        WHERE id = p_document_id
        AND version = p_expected_version -- CRITICAL: Prevent concurrent overwrites
        RETURNING version INTO v_new_version;
        
        -- Check if update succeeded
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        
        IF v_rows_updated = 0 THEN
            -- Version mismatch - another client updated concurrently
            -- Rollback the insert (transaction will handle this)
            RAISE EXCEPTION 'Optimistic locking failed: document version mismatch';
        END IF;
    ELSE
        -- Just increment update count without changing version
        UPDATE yjs_documents
        SET update_count = update_count + 1
        WHERE id = p_document_id;
        
        SELECT version INTO v_new_version FROM yjs_documents WHERE id = p_document_id;
    END IF;
    
    RETURN QUERY SELECT TRUE, v_sequence, v_new_version, NULL::TEXT;
    
EXCEPTION 
    WHEN OTHERS THEN
        -- Return the conflict error for client retry
        RETURN QUERY SELECT FALSE, NULL::BIGINT, NULL::INTEGER, SQLERRM;
END;
$$;


ALTER FUNCTION "public"."append_yjs_update"("p_document_id" "uuid", "p_update_data" "bytea", "p_expected_version" integer, "p_new_state_vector" "bytea") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_delete_component"("p_user_id" "uuid", "p_component_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."can_delete_component"("p_user_id" "uuid", "p_component_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_read_project"("p_project_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM project_members pm
        WHERE pm.project_id = p_project_id
        AND pm.user_id = auth.uid()
        AND pm.status = 'active'
    );
END;
$$;


ALTER FUNCTION "public"."can_read_project"("p_project_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_snapshot_needed"("p_document_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_update_count INTEGER;
    v_last_snapshot TIMESTAMPTZ;
BEGIN
    SELECT update_count, last_snapshot_at 
    INTO v_update_count, v_last_snapshot
    FROM yjs_documents 
    WHERE id = p_document_id;
    
    -- Snapshot needed if:
    -- 1. More than 1000 updates since last snapshot
    -- 2. OR last snapshot was more than 24 hours ago
    -- 3. OR never snapshotted
    RETURN (
        v_update_count > 1000 OR
        v_last_snapshot IS NULL OR
        v_last_snapshot < NOW() - INTERVAL '24 hours'
    );
END;
$$;


ALTER FUNCTION "public"."check_snapshot_needed"("p_document_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_user_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO user_profiles (user_id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    CASE
      WHEN NEW.email LIKE '%@elevana.com' THEN 'admin'
      ELSE 'viewer'
    END
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_user_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_yjs_snapshot"("p_document_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- TODO: Implement actual Y.js merge logic
    -- 1. Lock document
    -- 2. Fetch all updates since last snapshot
    -- 3. Merge updates into new state using Y.js
    -- 4. Store merged state
    -- 5. Delete merged updates
    -- 6. Update last_snapshot_at and reset update_count
    
    -- For now, just mark intention
    UPDATE yjs_documents 
    SET last_snapshot_at = NOW()
    WHERE id = p_document_id;
    
    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."create_yjs_snapshot"("p_document_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_default_video_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE
    AS $$
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
$$;


ALTER FUNCTION "public"."get_default_video_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_insert_position"("p_script_id" "uuid", "p_after_position" double precision) RETURNS double precision
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    next_pos DOUBLE PRECISION;
    new_pos DOUBLE PRECISION;
BEGIN
    -- Find the next position after the specified position
    SELECT MIN(position) INTO next_pos
    FROM script_components
    WHERE script_id = p_script_id AND position > p_after_position;

    IF next_pos IS NULL THEN
        -- No component after this position, append
        RETURN p_after_position + 1000.0;
    ELSE
        -- Insert between positions
        new_pos := (p_after_position + next_pos) / 2.0;

        -- Ensure we have enough precision (avoid infinitely small differences)
        IF (next_pos - p_after_position) < 0.000001 THEN
            -- Need to rebalance positions - this is rare but handles edge cases
            PERFORM rebalance_component_positions(p_script_id);
            -- After rebalancing, try again
            RETURN get_insert_position(p_script_id, p_after_position);
        END IF;

        RETURN new_pos;
    END IF;
END;
$$;


ALTER FUNCTION "public"."get_insert_position"("p_script_id" "uuid", "p_after_position" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_next_component_position"("p_script_id" "uuid") RETURNS double precision
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    max_pos DOUBLE PRECISION;
BEGIN
    SELECT COALESCE(MAX(position), 0) INTO max_pos
    FROM script_components
    WHERE script_id = p_script_id;

    RETURN max_pos + 1000.0; -- Large increment to allow many insertions
END;
$$;


ALTER FUNCTION "public"."get_next_component_position"("p_script_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_script_component_version"("p_component_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."get_script_component_version"("p_component_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_yjs_document_for_edit"("p_document_id" "uuid") RETURNS TABLE("id" "uuid", "project_id" "uuid", "document_type" "text", "state_vector" "bytea", "version" integer, "update_count" integer, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT d.id, d.project_id, d.document_type, d.state_vector, 
           d.version, d.update_count, d.updated_at
    FROM yjs_documents d
    WHERE d.id = p_document_id
    AND is_project_editor(d.project_id); -- Must have edit permission
END;
$$;


ALTER FUNCTION "public"."get_yjs_document_for_edit"("p_document_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_yjs_document_updates_since"("p_document_id" "uuid", "p_since_sequence" bigint DEFAULT 0) RETURNS TABLE("sequence_number" bigint, "update_data" "bytea", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- RLS automatically enforces read permissions
    RETURN QUERY
    SELECT u.sequence_number, u.update_data, u.created_at
    FROM yjs_document_updates u
    WHERE u.document_id = p_document_id
    AND u.sequence_number > p_since_sequence
    ORDER BY u.sequence_number ASC;
END;
$$;


ALTER FUNCTION "public"."get_yjs_document_updates_since"("p_document_id" "uuid", "p_since_sequence" bigint) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hard_delete_old_components"("p_days_old" integer DEFAULT 30) RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
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


ALTER FUNCTION "public"."hard_delete_old_components"("p_days_old" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_project_editor"("p_project_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM project_members pm
        WHERE pm.project_id = p_project_id
        AND pm.user_id = auth.uid()
        AND pm.status = 'active'
        AND pm.role_name IN ('admin', 'internal', 'freelancer')
    );
END;
$$;


ALTER FUNCTION "public"."is_project_editor"("p_project_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_component_deletion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."log_component_deletion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_component_hard_deletion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."log_component_hard_deletion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."maintain_yjs_update_project_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Populate project_id from parent document
    SELECT project_id INTO NEW.project_id
    FROM yjs_documents
    WHERE id = NEW.document_id;
    
    IF NEW.project_id IS NULL THEN
        RAISE EXCEPTION 'Document not found: %', NEW.document_id;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."maintain_yjs_update_project_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rebalance_component_positions"("p_script_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    component_rec RECORD;
    new_position DOUBLE PRECISION := 1000.0;
BEGIN
    -- Get all components in order and reassign positions with large gaps
    FOR component_rec IN
        SELECT component_id FROM script_components
        WHERE script_id = p_script_id
        ORDER BY position
    LOOP
        UPDATE script_components
        SET position = new_position
        WHERE component_id = component_rec.component_id;

        new_position := new_position + 1000.0;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."rebalance_component_positions"("p_script_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_get_default_video_id"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  SELECT get_default_video_id();
$$;


ALTER FUNCTION "public"."rpc_get_default_video_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_content_plain"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.content_plain := tiptap_to_plain_text(NEW.content_tiptap);
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_content_plain"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tiptap_to_plain_text"("tiptap_content" "jsonb") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    plain_text TEXT := '';
    content_item JSONB;
    text_item JSONB;
BEGIN
    -- Handle null or empty content
    IF tiptap_content IS NULL OR tiptap_content = 'null'::JSONB THEN
        RETURN '';
    END IF;

    -- Extract text from TipTap document structure
    -- TipTap format: {"type": "doc", "content": [...]}
    IF tiptap_content ? 'content' THEN
        FOR content_item IN SELECT jsonb_array_elements(tiptap_content->'content')
        LOOP
            -- Handle paragraph nodes
            IF content_item->>'type' = 'paragraph' AND content_item ? 'content' THEN
                FOR text_item IN SELECT jsonb_array_elements(content_item->'content')
                LOOP
                    IF text_item->>'type' = 'text' AND text_item ? 'text' THEN
                        plain_text := plain_text || (text_item->>'text');
                    END IF;
                END LOOP;
                plain_text := plain_text || E'\n'; -- Add newline after paragraph
            END IF;
        END LOOP;
    END IF;

    -- Clean up extra whitespace and return
    RETURN TRIM(plain_text);
END;
$$;


ALTER FUNCTION "public"."tiptap_to_plain_text"("tiptap_content" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_component_positions"("p_updates" "jsonb") RETURNS TABLE("component_id" "uuid", "new_position" double precision, "success" boolean)
    LANGUAGE "plpgsql"
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


ALTER FUNCTION "public"."update_component_positions"("p_updates" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_script_component_with_lock"("p_component_id" "uuid", "p_content" "jsonb", "p_plain_text" "text", "p_current_version" integer, "p_user_id" "uuid") RETURNS TABLE("success" boolean, "new_version" integer, "conflict_detected" boolean, "current_content" "jsonb", "current_version" integer, "error_message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."update_script_component_with_lock"("p_component_id" "uuid", "p_content" "jsonb", "p_plain_text" "text", "p_current_version" integer, "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "knowledge_platform"."audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "entity_type" character varying(100) NOT NULL,
    "entity_id" "uuid" NOT NULL,
    "action" character varying(50) NOT NULL,
    "changes" "jsonb",
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid"
);


ALTER TABLE "knowledge_platform"."audit_log" OWNER TO "postgres";


COMMENT ON TABLE "knowledge_platform"."audit_log" IS 'Audit trail for compliance and debugging';



CREATE TABLE IF NOT EXISTS "knowledge_platform"."dead_letter_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "original_event_id" "uuid",
    "event_data" "jsonb" NOT NULL,
    "error_message" "text" NOT NULL,
    "error_count" integer DEFAULT 1,
    "last_retry_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolution_notes" "text",
    "tenant_id" "uuid"
);


ALTER TABLE "knowledge_platform"."dead_letter_queue" OWNER TO "postgres";


COMMENT ON TABLE "knowledge_platform"."dead_letter_queue" IS 'Failed events for retry and debugging';



CREATE TABLE IF NOT EXISTS "knowledge_platform"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "aggregate_id" "uuid" NOT NULL,
    "aggregate_type" character varying(100) NOT NULL,
    "event_type" character varying(100) NOT NULL,
    "event_version" integer NOT NULL,
    "event_data" "jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "tenant_id" "uuid"
);


ALTER TABLE "knowledge_platform"."events" OWNER TO "postgres";


COMMENT ON TABLE "knowledge_platform"."events" IS 'Event store for all domain events';



CREATE TABLE IF NOT EXISTS "knowledge_platform"."snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "aggregate_id" "uuid" NOT NULL,
    "aggregate_type" character varying(100) NOT NULL,
    "version" integer NOT NULL,
    "state" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid"
);


ALTER TABLE "knowledge_platform"."snapshots" OWNER TO "postgres";


COMMENT ON TABLE "knowledge_platform"."snapshots" IS 'Aggregate snapshots for performance optimization';



CREATE MATERIALIZED VIEW "knowledge_platform"."field_mappings" AS
 SELECT "aggregate_id" AS "table_id",
    (("state" ->> 'fields'::"text"))::"jsonb" AS "fields",
    "version",
    "created_at" AS "last_updated",
    "tenant_id"
   FROM "knowledge_platform"."snapshots"
  WHERE (("aggregate_type")::"text" = 'FieldMapping'::"text")
  WITH NO DATA;


ALTER MATERIALIZED VIEW "knowledge_platform"."field_mappings" OWNER TO "postgres";


COMMENT ON MATERIALIZED VIEW "knowledge_platform"."field_mappings" IS 'Denormalized view of SmartSuite field mappings';



CREATE TABLE IF NOT EXISTS "public"."script_components" (
    "component_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "script_id" "uuid" NOT NULL,
    "position" double precision NOT NULL,
    "title" "text",
    "content_tiptap" "jsonb" NOT NULL,
    "content_plain" "text" NOT NULL,
    "content_hash" "text" GENERATED ALWAYS AS ("md5"(("content_tiptap")::"text")) STORED,
    "component_type" "public"."component_type_enum" DEFAULT 'main'::"public"."component_type_enum",
    "yjs_document_room" "text",
    "last_edited_by" "uuid",
    "last_edited_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "version" integer DEFAULT 1 NOT NULL,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "deletion_reason" "text",
    "component_status" "text" DEFAULT 'created'::"text",
    CONSTRAINT "script_components_content_plain_not_empty" CHECK (("char_length"("content_plain") >= 0)),
    CONSTRAINT "script_components_content_tiptap_valid" CHECK (("jsonb_typeof"("content_tiptap") = 'object'::"text")),
    CONSTRAINT "script_components_position_positive" CHECK (("position" > (0)::double precision)),
    CONSTRAINT "script_components_status_valid" CHECK (("component_status" = ANY (ARRAY['created'::"text", 'in_edit'::"text", 'approved'::"text", 'deleted'::"text"])))
);


ALTER TABLE "public"."script_components" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."active_script_components" AS
 SELECT "component_id",
    "script_id",
    "position",
    "title",
    "content_tiptap",
    "content_plain",
    "content_hash",
    "component_type",
    "yjs_document_room",
    "last_edited_by",
    "last_edited_at",
    "created_at",
    "updated_at"
   FROM "public"."script_components"
  WHERE ("deleted_at" IS NULL)
  ORDER BY "position";


ALTER VIEW "public"."active_script_components" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clients" (
    "client_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_name" "text" NOT NULL,
    "contact_email" "text",
    "contact_phone" "text",
    "company_name" "text",
    "billing_address" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_system_default" boolean DEFAULT false
);


ALTER TABLE "public"."clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."component_deletion_audit" (
    "audit_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "component_id" "uuid" NOT NULL,
    "script_id" "uuid" NOT NULL,
    "deleted_by" "uuid" NOT NULL,
    "deleted_at" timestamp with time zone NOT NULL,
    "deletion_type" "text" NOT NULL,
    "deletion_reason" "text",
    "component_snapshot" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "component_deletion_audit_deletion_type_check" CHECK (("deletion_type" = ANY (ARRAY['soft'::"text", 'hard'::"text", 'restore'::"text"])))
);


ALTER TABLE "public"."component_deletion_audit" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role_name" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "project_members_role_name_check" CHECK (("role_name" = ANY (ARRAY['admin'::"text", 'internal'::"text", 'freelancer'::"text", 'client'::"text", 'viewer'::"text"]))),
    CONSTRAINT "project_members_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'removed'::"text"])))
);


ALTER TABLE "public"."project_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "project_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_id" "uuid" NOT NULL,
    "project_code" "text" NOT NULL,
    "project_name" "text" NOT NULL,
    "project_description" "text",
    "project_status" "public"."project_status_enum" DEFAULT 'setup'::"public"."project_status_enum" NOT NULL,
    "start_date" "date",
    "deadline" "date",
    "budget_amount" numeric(10,2),
    "budget_currency" "text" DEFAULT 'GBP'::"text",
    "project_manager_id" "uuid",
    "project_settings" "jsonb" DEFAULT '{}'::"jsonb",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_system_default" boolean DEFAULT false
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."script_comments" (
    "comment_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "component_id" "uuid" NOT NULL,
    "parent_comment_id" "uuid",
    "author_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "comment_type" "text" DEFAULT 'general'::"text",
    "status" "text" DEFAULT 'open'::"text",
    "text_selection_start" integer,
    "text_selection_end" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "resolved_at" timestamp with time zone,
    "resolved_by" "uuid",
    CONSTRAINT "script_comments_content_length" CHECK ((("char_length"("content") > 0) AND ("char_length"("content") <= 5000)))
);


ALTER TABLE "public"."script_comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "member_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text",
    "job_title" "text",
    "department" "text",
    "bio" "text",
    "profile_image_url" "text",
    "timezone" "text" DEFAULT 'UTC'::"text",
    "preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "skills" "text"[],
    "availability_status" "text" DEFAULT 'available'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."team_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "user_id" "uuid" NOT NULL,
    "name" "text",
    "email" "text",
    "role" "text" DEFAULT 'viewer'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "user_profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'internal'::"text", 'freelancer'::"text", 'client'::"text", 'viewer'::"text"])))
);


ALTER TABLE "public"."user_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "role_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role_type" "public"."user_role_enum" NOT NULL,
    "assigned_by" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone,
    "is_active" boolean DEFAULT true,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."video_scripts" (
    "script_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "video_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "target_word_count" integer,
    "current_word_count" integer DEFAULT 0,
    "yjs_document_room" "text",
    "last_edited_by" "uuid",
    "last_edited_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "script_status" "text" DEFAULT 'draft'::"text",
    "word_count" integer DEFAULT 0,
    "estimated_duration" integer DEFAULT 0
);


ALTER TABLE "public"."video_scripts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."videos" (
    "video_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "video_title" "text" NOT NULL,
    "video_description" "text",
    "target_duration_seconds" integer,
    "video_status" "text" DEFAULT 'planning'::"text",
    "video_settings" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_system_default" boolean DEFAULT false
);


ALTER TABLE "public"."videos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."yjs_document_updates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "update_data" "bytea" NOT NULL,
    "sequence_number" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."yjs_document_updates" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."yjs_document_updates_sequence_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."yjs_document_updates_sequence_number_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."yjs_document_updates_sequence_number_seq" OWNED BY "public"."yjs_document_updates"."sequence_number";



CREATE TABLE IF NOT EXISTS "public"."yjs_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "document_type" "text" DEFAULT 'script'::"text" NOT NULL,
    "state_vector" "bytea" DEFAULT '\x00'::"bytea" NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "last_snapshot_at" timestamp with time zone,
    "update_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "last_edited_by" "uuid"
);


ALTER TABLE "public"."yjs_documents" OWNER TO "postgres";


ALTER TABLE ONLY "public"."yjs_document_updates" ALTER COLUMN "sequence_number" SET DEFAULT "nextval"('"public"."yjs_document_updates_sequence_number_seq"'::"regclass");



ALTER TABLE ONLY "knowledge_platform"."audit_log"
    ADD CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "knowledge_platform"."dead_letter_queue"
    ADD CONSTRAINT "dead_letter_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "knowledge_platform"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "knowledge_platform"."snapshots"
    ADD CONSTRAINT "snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "knowledge_platform"."snapshots"
    ADD CONSTRAINT "unique_aggregate_snapshot" UNIQUE ("aggregate_id");



ALTER TABLE ONLY "knowledge_platform"."events"
    ADD CONSTRAINT "unique_aggregate_version" UNIQUE ("aggregate_id", "event_version");



ALTER TABLE ONLY "public"."clients"
    ADD CONSTRAINT "clients_pkey" PRIMARY KEY ("client_id");



ALTER TABLE ONLY "public"."component_deletion_audit"
    ADD CONSTRAINT "component_deletion_audit_pkey" PRIMARY KEY ("audit_id");



ALTER TABLE ONLY "public"."project_members"
    ADD CONSTRAINT "project_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_members"
    ADD CONSTRAINT "project_members_unique" UNIQUE ("project_id", "user_id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("project_id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_project_code_key" UNIQUE ("project_code");



ALTER TABLE ONLY "public"."script_comments"
    ADD CONSTRAINT "script_comments_pkey" PRIMARY KEY ("comment_id");



ALTER TABLE ONLY "public"."script_components"
    ADD CONSTRAINT "script_components_pkey" PRIMARY KEY ("component_id");



ALTER TABLE ONLY "public"."script_components"
    ADD CONSTRAINT "script_components_script_id_position_key" UNIQUE ("script_id", "position");



ALTER TABLE ONLY "public"."script_components"
    ADD CONSTRAINT "script_components_yjs_document_room_key" UNIQUE ("yjs_document_room");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("member_id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("role_id");



ALTER TABLE ONLY "public"."video_scripts"
    ADD CONSTRAINT "video_scripts_pkey" PRIMARY KEY ("script_id");



ALTER TABLE ONLY "public"."video_scripts"
    ADD CONSTRAINT "video_scripts_video_id_key" UNIQUE ("video_id");



ALTER TABLE ONLY "public"."video_scripts"
    ADD CONSTRAINT "video_scripts_yjs_document_room_key" UNIQUE ("yjs_document_room");



ALTER TABLE ONLY "public"."videos"
    ADD CONSTRAINT "videos_pkey" PRIMARY KEY ("video_id");



ALTER TABLE ONLY "public"."yjs_document_updates"
    ADD CONSTRAINT "yjs_document_updates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."yjs_documents"
    ADD CONSTRAINT "yjs_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."yjs_documents"
    ADD CONSTRAINT "yjs_documents_project_type_unique" UNIQUE ("project_id", "document_type");



CREATE INDEX "idx_audit_created_at" ON "knowledge_platform"."audit_log" USING "btree" ("created_at");



CREATE INDEX "idx_audit_entity" ON "knowledge_platform"."audit_log" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_audit_tenant_id" ON "knowledge_platform"."audit_log" USING "btree" ("tenant_id") WHERE ("tenant_id" IS NOT NULL);



CREATE INDEX "idx_audit_user_id" ON "knowledge_platform"."audit_log" USING "btree" ("user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_dlq_created" ON "knowledge_platform"."dead_letter_queue" USING "btree" ("created_at");



CREATE INDEX "idx_dlq_resolved" ON "knowledge_platform"."dead_letter_queue" USING "btree" ("resolved_at") WHERE ("resolved_at" IS NULL);



CREATE INDEX "idx_dlq_tenant" ON "knowledge_platform"."dead_letter_queue" USING "btree" ("tenant_id") WHERE ("tenant_id" IS NOT NULL);



CREATE INDEX "idx_events_aggregate" ON "knowledge_platform"."events" USING "btree" ("aggregate_id", "event_version");



CREATE INDEX "idx_events_created" ON "knowledge_platform"."events" USING "btree" ("created_at");



CREATE INDEX "idx_events_tenant" ON "knowledge_platform"."events" USING "btree" ("tenant_id") WHERE ("tenant_id" IS NOT NULL);



CREATE INDEX "idx_events_type" ON "knowledge_platform"."events" USING "btree" ("event_type");



CREATE INDEX "idx_field_mappings_table" ON "knowledge_platform"."field_mappings" USING "btree" ("table_id");



CREATE INDEX "idx_field_mappings_tenant" ON "knowledge_platform"."field_mappings" USING "btree" ("tenant_id") WHERE ("tenant_id" IS NOT NULL);



CREATE INDEX "idx_snapshots_aggregate" ON "knowledge_platform"."snapshots" USING "btree" ("aggregate_id");



CREATE INDEX "idx_snapshots_tenant" ON "knowledge_platform"."snapshots" USING "btree" ("tenant_id") WHERE ("tenant_id" IS NOT NULL);



CREATE INDEX "idx_clients_system_default" ON "public"."clients" USING "btree" ("is_system_default") WHERE ("is_system_default" = true);



CREATE INDEX "idx_deletion_audit_component" ON "public"."component_deletion_audit" USING "btree" ("component_id", "deleted_at" DESC);



CREATE INDEX "idx_project_members_lookup" ON "public"."project_members" USING "btree" ("project_id", "user_id", "status", "role_name");



CREATE INDEX "idx_projects_client_id" ON "public"."projects" USING "btree" ("client_id");



CREATE INDEX "idx_projects_code" ON "public"."projects" USING "btree" ("project_code");



CREATE INDEX "idx_projects_status" ON "public"."projects" USING "btree" ("project_status");



CREATE INDEX "idx_projects_system_default" ON "public"."projects" USING "btree" ("is_system_default") WHERE ("is_system_default" = true);



CREATE INDEX "idx_script_comments_author" ON "public"."script_comments" USING "btree" ("author_id");



CREATE INDEX "idx_script_comments_component_id" ON "public"."script_comments" USING "btree" ("component_id");



CREATE INDEX "idx_script_comments_status" ON "public"."script_comments" USING "btree" ("status");



CREATE INDEX "idx_script_components_deleted" ON "public"."script_components" USING "btree" ("script_id", "deleted_at") WHERE ("deleted_at" IS NOT NULL);



CREATE INDEX "idx_script_components_id_version" ON "public"."script_components" USING "btree" ("component_id", "version");



CREATE INDEX "idx_script_components_not_deleted" ON "public"."script_components" USING "btree" ("script_id", "position") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_script_components_position" ON "public"."script_components" USING "btree" ("script_id", "position");



CREATE INDEX "idx_script_components_script_id" ON "public"."script_components" USING "btree" ("script_id");



CREATE INDEX "idx_script_components_status" ON "public"."script_components" USING "btree" ("component_status");



CREATE INDEX "idx_script_components_version" ON "public"."script_components" USING "btree" ("component_id", "version");



CREATE INDEX "idx_script_components_yjs_room" ON "public"."script_components" USING "btree" ("yjs_document_room");



CREATE INDEX "idx_team_members_user_id" ON "public"."team_members" USING "btree" ("user_id");



CREATE INDEX "idx_user_roles_type" ON "public"."user_roles" USING "btree" ("role_type");



CREATE INDEX "idx_user_roles_user_id" ON "public"."user_roles" USING "btree" ("user_id");



CREATE INDEX "idx_video_scripts_status" ON "public"."video_scripts" USING "btree" ("script_status");



CREATE INDEX "idx_video_scripts_video_id" ON "public"."video_scripts" USING "btree" ("video_id");



CREATE INDEX "idx_video_scripts_yjs_room" ON "public"."video_scripts" USING "btree" ("yjs_document_room");



CREATE INDEX "idx_videos_system_default" ON "public"."videos" USING "btree" ("is_system_default") WHERE ("is_system_default" = true);



CREATE INDEX "idx_yjs_documents_project_id" ON "public"."yjs_documents" USING "btree" ("project_id");



CREATE INDEX "idx_yjs_updates_doc_sequence" ON "public"."yjs_document_updates" USING "btree" ("document_id", "sequence_number");



CREATE INDEX "idx_yjs_updates_project_id" ON "public"."yjs_document_updates" USING "btree" ("project_id");



CREATE OR REPLACE TRIGGER "log_component_deletion_trigger" AFTER UPDATE OF "deleted_at" ON "public"."script_components" FOR EACH ROW EXECUTE FUNCTION "public"."log_component_deletion"();



CREATE OR REPLACE TRIGGER "log_component_hard_deletion_trigger" BEFORE DELETE ON "public"."script_components" FOR EACH ROW EXECUTE FUNCTION "public"."log_component_hard_deletion"();



CREATE OR REPLACE TRIGGER "sync_content_plain_from_tiptap" BEFORE INSERT OR UPDATE OF "content_tiptap" ON "public"."script_components" FOR EACH ROW EXECUTE FUNCTION "public"."sync_content_plain"();



CREATE OR REPLACE TRIGGER "update_clients_updated_at" BEFORE UPDATE ON "public"."clients" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_projects_updated_at" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_script_comments_updated_at" BEFORE UPDATE ON "public"."script_comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_script_components_updated_at" BEFORE UPDATE ON "public"."script_components" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_team_members_updated_at" BEFORE UPDATE ON "public"."team_members" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_video_scripts_updated_at" BEFORE UPDATE ON "public"."video_scripts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_videos_updated_at" BEFORE UPDATE ON "public"."videos" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "yjs_update_project_id_trigger" BEFORE INSERT ON "public"."yjs_document_updates" FOR EACH ROW EXECUTE FUNCTION "public"."maintain_yjs_update_project_id"();



ALTER TABLE ONLY "public"."component_deletion_audit"
    ADD CONSTRAINT "component_deletion_audit_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."project_members"
    ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_members"
    ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("client_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."script_comments"
    ADD CONSTRAINT "script_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."script_comments"
    ADD CONSTRAINT "script_comments_component_id_fkey" FOREIGN KEY ("component_id") REFERENCES "public"."script_components"("component_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."script_comments"
    ADD CONSTRAINT "script_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."script_comments"("comment_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."script_comments"
    ADD CONSTRAINT "script_comments_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."script_components"
    ADD CONSTRAINT "script_components_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."script_components"
    ADD CONSTRAINT "script_components_last_edited_by_fkey" FOREIGN KEY ("last_edited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."script_components"
    ADD CONSTRAINT "script_components_script_id_fkey" FOREIGN KEY ("script_id") REFERENCES "public"."video_scripts"("script_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_profiles"
    ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."video_scripts"
    ADD CONSTRAINT "video_scripts_last_edited_by_fkey" FOREIGN KEY ("last_edited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."video_scripts"
    ADD CONSTRAINT "video_scripts_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("video_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."videos"
    ADD CONSTRAINT "videos_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."yjs_document_updates"
    ADD CONSTRAINT "yjs_document_updates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."yjs_document_updates"
    ADD CONSTRAINT "yjs_document_updates_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."yjs_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."yjs_documents"
    ADD CONSTRAINT "yjs_documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."yjs_documents"
    ADD CONSTRAINT "yjs_documents_last_edited_by_fkey" FOREIGN KEY ("last_edited_by") REFERENCES "auth"."users"("id");



CREATE POLICY "Service role has full access to audit_log" ON "knowledge_platform"."audit_log" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to dead_letter_queue" ON "knowledge_platform"."dead_letter_queue" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to events" ON "knowledge_platform"."events" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to snapshots" ON "knowledge_platform"."snapshots" USING (true) WITH CHECK (true);



ALTER TABLE "knowledge_platform"."audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "knowledge_platform"."dead_letter_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "knowledge_platform"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "knowledge_platform"."snapshots" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Admins can view deleted components" ON "public"."script_components" FOR SELECT USING ((("deleted_at" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role_type" = 'admin'::"public"."user_role_enum") AND ("ur"."is_active" = true))))));



CREATE POLICY "Users can soft delete components" ON "public"."script_components" FOR UPDATE USING ("public"."can_delete_component"("auth"."uid"(), "component_id")) WITH CHECK ("public"."can_delete_component"("auth"."uid"(), "component_id"));



CREATE POLICY "Users can view non-deleted components" ON "public"."script_components" FOR SELECT USING ((("deleted_at" IS NULL) AND (EXISTS ( SELECT 1
   FROM (("public"."video_scripts" "vs"
     JOIN "public"."videos" "v" ON (("v"."video_id" = "vs"."video_id")))
     JOIN "public"."projects" "p" ON (("p"."project_id" = "v"."project_id")))
  WHERE (("vs"."script_id" = "script_components"."script_id") AND ((EXISTS ( SELECT 1
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role_type" = 'admin'::"public"."user_role_enum") AND ("ur"."is_active" = true)))) OR (EXISTS ( SELECT 1
           FROM "public"."user_roles" "ur"
          WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role_type" = ANY (ARRAY['internal'::"public"."user_role_enum", 'freelancer'::"public"."user_role_enum"])) AND ("ur"."is_active" = true)))) OR ("p"."client_id" IN ( SELECT "c"."client_id"
           FROM ("public"."clients" "c"
             JOIN "public"."user_roles" "ur" ON (("ur"."user_id" = "auth"."uid"())))
          WHERE (("ur"."role_type" = 'client'::"public"."user_role_enum") AND ("ur"."is_active" = true))))))))));



ALTER TABLE "public"."clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clients_select_dev" ON "public"."clients" FOR SELECT USING (true);



CREATE POLICY "clients_temp_insert" ON "public"."clients" FOR INSERT WITH CHECK (true);



CREATE POLICY "clients_temp_select" ON "public"."clients" FOR SELECT USING (true);



ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "projects_select_dev" ON "public"."projects" FOR SELECT USING (true);



CREATE POLICY "projects_temp_insert" ON "public"."projects" FOR INSERT WITH CHECK (true);



CREATE POLICY "projects_temp_select" ON "public"."projects" FOR SELECT USING (true);



ALTER TABLE "public"."script_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."script_components" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "script_components_delete_dev" ON "public"."script_components" FOR DELETE USING (true);



CREATE POLICY "script_components_insert_dev" ON "public"."script_components" FOR INSERT WITH CHECK (true);



CREATE POLICY "script_components_select_dev" ON "public"."script_components" FOR SELECT USING (true);



CREATE POLICY "script_components_update_dev" ON "public"."script_components" FOR UPDATE USING (true) WITH CHECK (true);



ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."video_scripts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "video_scripts_delete_dev" ON "public"."video_scripts" FOR DELETE USING (true);



CREATE POLICY "video_scripts_insert_dev" ON "public"."video_scripts" FOR INSERT WITH CHECK (true);



CREATE POLICY "video_scripts_select_dev" ON "public"."video_scripts" FOR SELECT USING (true);



CREATE POLICY "video_scripts_update_dev" ON "public"."video_scripts" FOR UPDATE USING (true) WITH CHECK (true);



ALTER TABLE "public"."videos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "videos_insert_dev" ON "public"."videos" FOR INSERT WITH CHECK (true);



CREATE POLICY "videos_select_dev" ON "public"."videos" FOR SELECT USING (true);



CREATE POLICY "videos_temp_insert" ON "public"."videos" FOR INSERT WITH CHECK (true);



CREATE POLICY "videos_temp_select" ON "public"."videos" FOR SELECT USING (true);



CREATE POLICY "videos_temp_update" ON "public"."videos" FOR UPDATE USING (true) WITH CHECK (true);



ALTER TABLE "public"."yjs_document_updates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."yjs_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "yjs_documents_read" ON "public"."yjs_documents" FOR SELECT USING ("public"."can_read_project"("project_id"));



CREATE POLICY "yjs_documents_write" ON "public"."yjs_documents" USING ("public"."is_project_editor"("project_id")) WITH CHECK ("public"."is_project_editor"("project_id"));



CREATE POLICY "yjs_updates_insert" ON "public"."yjs_document_updates" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."yjs_documents"
  WHERE (("yjs_documents"."id" = "yjs_document_updates"."document_id") AND "public"."is_project_editor"("yjs_documents"."project_id")))));



CREATE POLICY "yjs_updates_read" ON "public"."yjs_document_updates" FOR SELECT USING ("public"."can_read_project"("project_id"));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "knowledge_platform" TO "anon";
GRANT USAGE ON SCHEMA "knowledge_platform" TO "authenticated";
GRANT ALL ON SCHEMA "knowledge_platform" TO "service_role";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "knowledge_platform"."get_latest_snapshot"("p_aggregate_id" "uuid", "p_aggregate_type" character varying) TO "service_role";



GRANT ALL ON FUNCTION "knowledge_platform"."refresh_field_mappings"() TO "service_role";



GRANT ALL ON FUNCTION "knowledge_platform"."refresh_materialized_view"("view_name" "text") TO "anon";
GRANT ALL ON FUNCTION "knowledge_platform"."refresh_materialized_view"("view_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "knowledge_platform"."refresh_materialized_view"("view_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."append_yjs_update"("p_document_id" "uuid", "p_update_data" "bytea", "p_expected_version" integer, "p_new_state_vector" "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."append_yjs_update"("p_document_id" "uuid", "p_update_data" "bytea", "p_expected_version" integer, "p_new_state_vector" "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."append_yjs_update"("p_document_id" "uuid", "p_update_data" "bytea", "p_expected_version" integer, "p_new_state_vector" "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_delete_component"("p_user_id" "uuid", "p_component_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_delete_component"("p_user_id" "uuid", "p_component_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_delete_component"("p_user_id" "uuid", "p_component_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_read_project"("p_project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_read_project"("p_project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_read_project"("p_project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_snapshot_needed"("p_document_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_snapshot_needed"("p_document_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_snapshot_needed"("p_document_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_user_profile"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_profile"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_profile"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_yjs_snapshot"("p_document_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_yjs_snapshot"("p_document_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_yjs_snapshot"("p_document_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_default_video_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_default_video_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_default_video_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_insert_position"("p_script_id" "uuid", "p_after_position" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."get_insert_position"("p_script_id" "uuid", "p_after_position" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_insert_position"("p_script_id" "uuid", "p_after_position" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_next_component_position"("p_script_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_next_component_position"("p_script_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_next_component_position"("p_script_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_script_component_version"("p_component_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_script_component_version"("p_component_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_script_component_version"("p_component_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_yjs_document_for_edit"("p_document_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_yjs_document_for_edit"("p_document_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_yjs_document_for_edit"("p_document_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_yjs_document_updates_since"("p_document_id" "uuid", "p_since_sequence" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."get_yjs_document_updates_since"("p_document_id" "uuid", "p_since_sequence" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_yjs_document_updates_since"("p_document_id" "uuid", "p_since_sequence" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."hard_delete_old_components"("p_days_old" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."hard_delete_old_components"("p_days_old" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hard_delete_old_components"("p_days_old" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."is_project_editor"("p_project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_project_editor"("p_project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_project_editor"("p_project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_component_deletion"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_component_deletion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_component_deletion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_component_hard_deletion"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_component_hard_deletion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_component_hard_deletion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."maintain_yjs_update_project_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."maintain_yjs_update_project_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."maintain_yjs_update_project_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rebalance_component_positions"("p_script_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."rebalance_component_positions"("p_script_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."rebalance_component_positions"("p_script_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_get_default_video_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_get_default_video_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_get_default_video_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_content_plain"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_content_plain"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_content_plain"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tiptap_to_plain_text"("tiptap_content" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."tiptap_to_plain_text"("tiptap_content" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."tiptap_to_plain_text"("tiptap_content" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_component_positions"("p_updates" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_component_positions"("p_updates" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_component_positions"("p_updates" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_script_component_with_lock"("p_component_id" "uuid", "p_content" "jsonb", "p_plain_text" "text", "p_current_version" integer, "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_script_component_with_lock"("p_component_id" "uuid", "p_content" "jsonb", "p_plain_text" "text", "p_current_version" integer, "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_script_component_with_lock"("p_component_id" "uuid", "p_content" "jsonb", "p_plain_text" "text", "p_current_version" integer, "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";


















GRANT ALL ON TABLE "knowledge_platform"."audit_log" TO "service_role";



GRANT ALL ON TABLE "knowledge_platform"."dead_letter_queue" TO "service_role";



GRANT ALL ON TABLE "knowledge_platform"."events" TO "service_role";



GRANT ALL ON TABLE "knowledge_platform"."snapshots" TO "service_role";



GRANT ALL ON TABLE "knowledge_platform"."field_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."script_components" TO "anon";
GRANT ALL ON TABLE "public"."script_components" TO "authenticated";
GRANT ALL ON TABLE "public"."script_components" TO "service_role";



GRANT ALL ON TABLE "public"."active_script_components" TO "anon";
GRANT ALL ON TABLE "public"."active_script_components" TO "authenticated";
GRANT ALL ON TABLE "public"."active_script_components" TO "service_role";



GRANT ALL ON TABLE "public"."clients" TO "anon";
GRANT ALL ON TABLE "public"."clients" TO "authenticated";
GRANT ALL ON TABLE "public"."clients" TO "service_role";



GRANT ALL ON TABLE "public"."component_deletion_audit" TO "anon";
GRANT ALL ON TABLE "public"."component_deletion_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."component_deletion_audit" TO "service_role";



GRANT ALL ON TABLE "public"."project_members" TO "anon";
GRANT ALL ON TABLE "public"."project_members" TO "authenticated";
GRANT ALL ON TABLE "public"."project_members" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."script_comments" TO "anon";
GRANT ALL ON TABLE "public"."script_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."script_comments" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "anon";
GRANT ALL ON TABLE "public"."team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_members" TO "service_role";



GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";



GRANT ALL ON TABLE "public"."video_scripts" TO "anon";
GRANT ALL ON TABLE "public"."video_scripts" TO "authenticated";
GRANT ALL ON TABLE "public"."video_scripts" TO "service_role";



GRANT ALL ON TABLE "public"."videos" TO "anon";
GRANT ALL ON TABLE "public"."videos" TO "authenticated";
GRANT ALL ON TABLE "public"."videos" TO "service_role";



GRANT ALL ON TABLE "public"."yjs_document_updates" TO "anon";
GRANT ALL ON TABLE "public"."yjs_document_updates" TO "authenticated";
GRANT ALL ON TABLE "public"."yjs_document_updates" TO "service_role";



GRANT ALL ON SEQUENCE "public"."yjs_document_updates_sequence_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."yjs_document_updates_sequence_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."yjs_document_updates_sequence_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."yjs_documents" TO "anon";
GRANT ALL ON TABLE "public"."yjs_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."yjs_documents" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "knowledge_platform" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "knowledge_platform" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "knowledge_platform" GRANT ALL ON TABLES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































RESET ALL;
