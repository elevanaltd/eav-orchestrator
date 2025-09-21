-- ============================================================================
-- KNOWLEDGE PLATFORM SCHEMA FOR SMARTSUITE API SHIM
-- ============================================================================
-- This creates the knowledge platform schema in the same Supabase instance
-- as the EAV Orchestrator for SmartSuite field mappings and API patterns
-- ============================================================================

-- Create dedicated schema for Knowledge Platform
CREATE SCHEMA IF NOT EXISTS knowledge_platform;

-- Grant appropriate permissions
GRANT USAGE ON SCHEMA knowledge_platform TO anon;
GRANT USAGE ON SCHEMA knowledge_platform TO authenticated;
GRANT ALL ON SCHEMA knowledge_platform TO service_role;

-- Add comment for documentation
COMMENT ON SCHEMA knowledge_platform IS 'Event-sourced knowledge management system for SmartSuite field mappings and API patterns';

-- Set search path for subsequent operations
SET search_path TO knowledge_platform, public;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Create events table for event sourcing
CREATE TABLE IF NOT EXISTS knowledge_platform.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id UUID NOT NULL,
  aggregate_type VARCHAR(100) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_version INTEGER NOT NULL,
  event_data JSONB NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,  -- Made nullable for system events
  tenant_id UUID,    -- Made nullable for shared knowledge

  -- Optimistic concurrency control
  CONSTRAINT unique_aggregate_version UNIQUE (aggregate_id, event_version)
);

-- Create snapshots table for performance optimization
CREATE TABLE IF NOT EXISTS knowledge_platform.snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id UUID NOT NULL,
  aggregate_type VARCHAR(100) NOT NULL,
  version INTEGER NOT NULL,
  state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id UUID,  -- Nullable for shared knowledge

  -- Only one snapshot per aggregate at a time
  CONSTRAINT unique_aggregate_snapshot UNIQUE (aggregate_id)
);

-- Dead letter queue for failed events
CREATE TABLE IF NOT EXISTS knowledge_platform.dead_letter_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_event_id UUID,
  event_data JSONB NOT NULL,
  error_message TEXT NOT NULL,
  error_count INTEGER DEFAULT 1,
  last_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  tenant_id UUID
);

-- Audit log table
CREATE TABLE IF NOT EXISTS knowledge_platform.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  changes JSONB,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id UUID
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_events_aggregate ON knowledge_platform.events(aggregate_id, event_version);
CREATE INDEX IF NOT EXISTS idx_events_created ON knowledge_platform.events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_type ON knowledge_platform.events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_tenant ON knowledge_platform.events(tenant_id) WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_snapshots_aggregate ON knowledge_platform.snapshots(aggregate_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_tenant ON knowledge_platform.snapshots(tenant_id) WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dlq_created ON knowledge_platform.dead_letter_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_dlq_resolved ON knowledge_platform.dead_letter_queue(resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dlq_tenant ON knowledge_platform.dead_letter_queue(tenant_id) WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_created_at ON knowledge_platform.audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON knowledge_platform.audit_log(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_entity ON knowledge_platform.audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_id ON knowledge_platform.audit_log(tenant_id) WHERE tenant_id IS NOT NULL;

-- ============================================================================
-- MATERIALIZED VIEW FOR FIELD MAPPINGS
-- ============================================================================

-- Materialized view for field mappings (refresh manually or via trigger)
CREATE MATERIALIZED VIEW IF NOT EXISTS knowledge_platform.field_mappings AS
SELECT
  aggregate_id as table_id,
  (state->>'fields')::jsonb as fields,
  version,
  created_at as last_updated,
  tenant_id
FROM knowledge_platform.snapshots
WHERE aggregate_type = 'FieldMapping';

-- Index for materialized view performance
CREATE INDEX IF NOT EXISTS idx_field_mappings_table ON knowledge_platform.field_mappings(table_id);
CREATE INDEX IF NOT EXISTS idx_field_mappings_tenant ON knowledge_platform.field_mappings(tenant_id) WHERE tenant_id IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE knowledge_platform.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_platform.snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_platform.dead_letter_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_platform.audit_log ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for backend operations)
CREATE POLICY service_role_all_events ON knowledge_platform.events
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY service_role_all_snapshots ON knowledge_platform.snapshots
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY service_role_all_dlq ON knowledge_platform.dead_letter_queue
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY service_role_all_audit ON knowledge_platform.audit_log
  FOR ALL
  USING (auth.role() = 'service_role');

-- Authenticated users can read events (shared knowledge)
CREATE POLICY authenticated_read_events ON knowledge_platform.events
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY authenticated_read_snapshots ON knowledge_platform.snapshots
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Insert policies for authenticated users
CREATE POLICY authenticated_insert_events ON knowledge_platform.events
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (created_by IS NULL OR created_by = auth.uid())
  );

CREATE POLICY authenticated_insert_audit ON knowledge_platform.audit_log
  FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated'
    AND (user_id IS NULL OR user_id = auth.uid())
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to refresh field mappings materialized view
CREATE OR REPLACE FUNCTION knowledge_platform.refresh_field_mappings()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY knowledge_platform.field_mappings;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get latest snapshot for an aggregate
CREATE OR REPLACE FUNCTION knowledge_platform.get_latest_snapshot(
  p_aggregate_id UUID,
  p_aggregate_type VARCHAR(100) DEFAULT NULL
)
RETURNS JSONB AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE knowledge_platform.events IS 'Event store for all domain events';
COMMENT ON TABLE knowledge_platform.snapshots IS 'Aggregate snapshots for performance optimization';
COMMENT ON TABLE knowledge_platform.dead_letter_queue IS 'Failed events for retry and debugging';
COMMENT ON TABLE knowledge_platform.audit_log IS 'Audit trail for compliance and debugging';
COMMENT ON MATERIALIZED VIEW knowledge_platform.field_mappings IS 'Denormalized view of SmartSuite field mappings';

-- Reset search path
RESET search_path;

-- ============================================================================
-- END OF KNOWLEDGE PLATFORM SCHEMA
-- ============================================================================