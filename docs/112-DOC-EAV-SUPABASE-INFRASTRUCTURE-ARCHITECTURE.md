# EAV Orchestrator - Supabase Infrastructure Architecture

**Document:** 112-DOC-EAV-SUPABASE-INFRASTRUCTURE-ARCHITECTURE  
**Created:** 2025-09-11  
**Status:** Technical Architecture Review Complete  
**Purpose:** Document Supabase tier requirements, infrastructure configuration, and production architecture

## Executive Summary

This document provides the comprehensive technical architecture for EAV Orchestrator's Supabase infrastructure, including explicit tier requirements, connection pooling strategies, and production configuration. Based on architectural review of the existing implementation, **Supabase PRO tier is REQUIRED** for production deployment.

## Tier Requirements Analysis

### Supabase PRO Tier (REQUIRED)

**Rationale:** The EAV Orchestrator requires Supabase PRO tier based on the following technical requirements:

#### 1. Connection Pooling Requirements
```yaml
Requirement: Supavisor Connection Pooler
Scale: 10-20 concurrent users with real-time collaboration
Implementation: Singleton pattern with connection reuse

Evidence_From_Code:
  - supabaseClient.ts: Uses Supavisor pooling configuration
  - x-connection-pool header for connection management
  - Session mode (5432) for migrations and long operations
  - Transaction mode (6543) for API/BFF connections
```

#### 2. Real-time Collaboration Features
```yaml
Requirement: Yjs CRDT Synchronization
Latency_Target: <200ms comment sync
Implementation: Broadcast channels with presence tracking

Evidence_From_Code:
  - YjsSupabaseProvider.ts: Real-time broadcast implementation
  - Events per second limit: 10 (configured)
  - Presence state tracking for cursor positions
  - Binary update broadcasting via base64 encoding
```

#### 3. Database Features
```yaml
PostgreSQL_17: Latest major version for performance
JSONB_Storage: Rich text content from TipTap editor
RLS_Policies: 5-role security system enforcement
Optimistic_Locking: Concurrent edit conflict resolution
UUID_Primary_Keys: Distributed ID generation
```

#### 4. Production Requirements
```yaml
Uptime_SLA: 99.5% availability requirement
Point_in_Time_Recovery: Data protection capability
Database_Branching: Safe migration testing
Connection_Monitoring: Performance alerting
```

## Connection Architecture

### Backend Service Architecture

```typescript
// Singleton Pattern Implementation
Connection_Strategy: {
  Pattern: "Singleton with lazy initialization",
  Benefits: [
    "Connection pooling across all service instances",
    "HTTP keep-alive for persistent connections",
    "Reduced connection overhead"
  ],
  Configuration: {
    autoRefreshToken: false,  // Service role doesn't need refresh
    persistSession: false,    // No session storage needed
    keepalive: true,         // HTTP persistent connections
    "x-connection-pool": "script-module"  // Pooler identification
  }
}
```

### Connection URLs and Ports

```yaml
Production_URLs:
  Shared_Pooler: 
    URL: aws-1-eu-west-2.pooler.supabase.com
    Port: 6543
    Mode: Transaction (pgBouncer)
    Use_Case: API/BFF/Serverless functions
    IPv4: Compatible
    
  Session_Pooler:
    URL: aws-1-eu-west-2.pooler.supabase.com  
    Port: 5432
    Mode: Session (Supavisor)
    Use_Case: Migrations, pg-boss, long operations
    Prepared_Statements: Supported
    
  Future_Dedicated_Pooler:
    Note: "Requires IPv6 or paid IPv4 add-on"
    Benefits: "Lower latency, dedicated resources"
    Decision: "Deferred until scale justifies cost"
```

## Real-time Collaboration Infrastructure

### Yjs + Supabase Integration

```yaml
Architecture:
  Provider: y-supabase (alpha package)
  Fallback: IndexedDB for offline resilience
  Pattern: Circuit breaker for failure handling
  
Performance_Optimizations:
  Debounced_Saves: 1 second delay
  Binary_Encoding: Base64 for CRDT updates
  Event_Limiting: 10 events per second max
  Batch_Processing: Combined state updates
  
Resilience_Features:
  Offline_Support: IndexedDB persistence
  Reconnection: Automatic with exponential backoff
  State_Recovery: Full document reconstruction
  Conflict_Resolution: CRDT automatic merging
```

### Database Schema Optimizations

```sql
-- Optimistic Locking Support
CREATE OR REPLACE FUNCTION check_version_and_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.version != NEW.version - 1 THEN
    RAISE EXCEPTION 'Optimistic lock violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- JSONB Indexing for Performance
CREATE INDEX idx_script_content_gin 
ON script_components 
USING gin (content_json);

-- Partial Index for Active Components
CREATE INDEX idx_active_components 
ON script_components (project_id, status) 
WHERE status != 'approved';
```

## Security Architecture

### Row Level Security (RLS) Implementation

```yaml
Five_Role_System:
  admin: Full system access, all operations
  internal: Production work, all features
  freelancer: Assigned projects only
  client: Review and approval only
  viewer: Read-only access

Policy_Enforcement:
  - Service role bypasses RLS for backend operations
  - Frontend uses anon key with RLS enforcement
  - JWT claims include role information
  - Policies cascade through foreign keys
```

### Connection Security

```yaml
Authentication:
  Backend: Service role key (full access)
  Frontend: Anonymous key (RLS enforced)
  
Transport_Security:
  - TLS 1.3 for all connections
  - Certificate pinning in production
  - Key rotation every 90 days
  
Access_Control:
  - API key stored in environment variables
  - Never exposed to client-side code
  - Audit logging for all operations
```

## Performance Configuration

### Connection Pool Tuning

```yaml
Pooler_Settings:
  pool_mode: transaction  # Optimal for short queries
  default_pool_size: 20   # Per user/database pair
  max_client_conn: 100    # Total connection limit
  
Connection_Lifecycle:
  idle_timeout: 600s      # 10 minutes
  max_lifetime: 3600s     # 1 hour
  statement_timeout: 30s  # Query timeout
```

### Query Optimization

```yaml
Strategies:
  - Prepared statements via session mode
  - Connection reuse via singleton pattern
  - Batch operations where possible
  - Materialized views for complex queries
  
Monitoring:
  - pg_stat_statements for query analysis
  - Connection pool metrics
  - Real-time performance dashboard
  - Alert thresholds for latency
```

## Migration Strategy

### From Development to Production

```yaml
Phase_1_Local_Development:
  - Supabase CLI for local testing
  - Docker-based PostgreSQL 17
  - Migrations via session mode connection
  
Phase_2_Staging_Deployment:
  - Supabase Free tier acceptable
  - Limited concurrent users
  - Feature validation focus
  
Phase_3_Production_Deployment:
  - Upgrade to Supabase PRO required
  - Enable all pooling features
  - Configure monitoring and alerts
  - Implement backup strategy
```

## Cost Analysis

### Supabase PRO Tier Pricing

```yaml
Monthly_Cost: $25/month
Included_Features:
  - Unlimited API requests
  - 500GB bandwidth
  - 8GB database
  - 100GB storage
  - Point-in-time recovery
  - Database branching
  
Additional_Costs:
  - Dedicated IPv4: $4/month (if needed)
  - Extra storage: $0.125/GB/month
  - Extra bandwidth: $0.09/GB
  
ROI_Justification:
  - Supports £2.5M+ business growth
  - Reduces script-to-scene: 1-2 days → 2-3 hours
  - Enables 10-20 concurrent users
  - Critical for collaboration features
```

## Monitoring and Observability

### Key Metrics

```yaml
Connection_Metrics:
  - Active connections count
  - Connection pool utilization
  - Connection wait time
  - Failed connection attempts
  
Query_Performance:
  - P95 query latency
  - Slow query log analysis
  - Index hit ratios
  - Table scan frequencies
  
Real_time_Metrics:
  - Message delivery latency
  - Broadcast success rate
  - Presence update frequency
  - Channel subscription count
```

### Alert Thresholds

```yaml
Critical_Alerts:
  - Connection pool > 80% utilized
  - Query latency P95 > 500ms
  - Real-time latency > 200ms
  - Database CPU > 80%
  
Warning_Alerts:
  - Connection pool > 60% utilized
  - Slow queries > 10/minute
  - Failed broadcasts > 1%
  - Storage > 70% capacity
```

## Disaster Recovery

### Backup Strategy

```yaml
Automated_Backups:
  - Daily automated backups (PRO tier)
  - 7-day retention minimum
  - Point-in-time recovery to any second
  
Manual_Backups:
  - Before major migrations
  - Weekly full backup to external storage
  - Schema versioning in git
  
Recovery_Procedures:
  - RTO: 4 hours
  - RPO: 1 hour
  - Tested quarterly
```

## Recommendations

### Immediate Actions
1. **Confirm Supabase PRO tier** is provisioned for production
2. **Validate connection pooling** configuration matches this spec
3. **Implement monitoring** for all key metrics
4. **Test failover procedures** before go-live

### Future Optimizations
1. **Consider dedicated pooler** when user count exceeds 50
2. **Evaluate read replicas** for reporting workloads
3. **Implement caching layer** if latency becomes issue
4. **Review index usage** quarterly for optimization

## Conclusion

The Supabase PRO tier is **mandatory** for the EAV Orchestrator production deployment. The architecture leverages Supabase's connection pooling, real-time features, and enterprise capabilities to deliver the required performance and reliability for collaborative video production workflows.

**Technical Architect Approval:** Infrastructure architecture validated and approved for implementation.

---

**Next Steps:**
1. Update environment configuration with production URLs
2. Implement monitoring dashboard for key metrics
3. Document runbook for operational procedures
4. Schedule load testing for connection pool validation