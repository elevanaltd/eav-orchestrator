# ADR-103: Component Delete Strategy

**Status:** Accepted
**Date:** 2025-09-17
**Author:** Technical Architect
**Registry Token:** TECHNICAL-ARCHITECT-APPROVED: [pending-registry-integration]

## Context

The ScriptComponentManager requires complete CRUD operations, with deletion being architecturally significant due to:
- Cascade effects on related entities (comments, scenes)
- Data integrity and audit trail requirements
- Position reordering after deletion
- Collaborative editing implications
- Performance considerations for bulk operations

## Decision

We will implement a **HYBRID DELETION STRATEGY** with the following architectural principles:

### 1. Soft Delete for Standard Operations
- Components are marked as deleted with `deleted_at` timestamp
- Preserves audit trail and enables recovery
- Maintains referential integrity for historical analysis
- Supports "undo" operations within session

### 2. Hard Delete for Administrative Actions
- Physical removal from database after soft delete grace period
- Triggered by explicit admin action or scheduled cleanup
- Cascades to orphaned comments and references
- Requires elevated permissions (admin role)

### 3. Position Reordering Strategy
- Use DOUBLE PRECISION positioning (already in schema)
- No immediate reordering on delete (positions remain sparse)
- Batch reordering during maintenance windows
- O(1) insertions maintained between remaining components

## Implementation Details

### Database Schema Changes
```sql
-- Add soft delete columns to script_components
ALTER TABLE script_components
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN deleted_by UUID REFERENCES auth.users(id);

-- Create index for efficient soft delete queries
CREATE INDEX idx_script_components_deleted
ON script_components(script_id, deleted_at)
WHERE deleted_at IS NULL;
```

### Delete Operations Interface
```typescript
interface DeleteOperations {
  // Soft delete with audit trail
  softDeleteComponent(
    componentId: string,
    userId: string,
    reason?: string
  ): Promise<DeleteResult>

  // Restore soft-deleted component
  restoreComponent(
    componentId: string,
    userId: string
  ): Promise<RestoreResult>

  // Hard delete (admin only)
  hardDeleteComponent(
    componentId: string,
    userId: string,
    force: boolean
  ): Promise<HardDeleteResult>

  // Bulk soft delete
  bulkSoftDelete(
    componentIds: string[],
    userId: string
  ): Promise<BulkDeleteResult>
}
```

### Cascade Handling
```yaml
ON_COMPONENT_DELETE:
  Comments:
    - Soft Delete: Preserve with reference to deleted component
    - Hard Delete: CASCADE delete all associated comments

  Y.js Documents:
    - Soft Delete: Mark room as archived
    - Hard Delete: Clean up Y.js document store

  Position Indexes:
    - Soft Delete: Keep positions unchanged (sparse array)
    - Hard Delete: Optional reorder if gap > threshold

  Audit Trail:
    - Always preserved in separate audit log table
    - Never cascaded regardless of delete type
```

### Authorization Requirements
```typescript
enum DeletePermission {
  SOFT_DELETE = 'component.soft_delete',  // Owner, Admin, Internal
  RESTORE = 'component.restore',          // Owner, Admin, Internal
  HARD_DELETE = 'component.hard_delete',  // Admin only
  BULK_DELETE = 'component.bulk_delete'   // Admin, Internal with limits
}
```

## Consequences

### Positive
- **Data Recovery:** Soft deletes enable recovery from accidental deletions
- **Audit Compliance:** Complete trail of all modifications
- **Performance:** No immediate reordering reduces delete latency
- **Flexibility:** Hybrid approach balances safety with cleanup needs
- **User Experience:** Undo capability within session

### Negative
- **Storage Overhead:** Soft-deleted records consume space
- **Query Complexity:** Must filter deleted_at IS NULL in most queries
- **Maintenance Required:** Periodic cleanup of old soft-deleted records
- **Position Gaps:** Sparse positioning may accumulate over time

### Mitigations
- Scheduled cleanup job for records deleted > 30 days
- Periodic position compaction during low-activity periods
- Database views that automatically filter soft-deleted records
- Monitoring alerts for excessive soft-deleted record accumulation

## Performance Targets
- Single delete: < 50ms (soft), < 100ms (hard with cascades)
- Bulk delete (100 components): < 500ms
- Restore operation: < 50ms
- Position reordering (when needed): < 200ms for 100 components

## Security Considerations
- Rate limiting on delete operations (max 10/minute per user)
- Audit log entries for all delete/restore operations
- Two-factor confirmation for hard delete operations
- IP logging for administrative deletions

## Alternative Approaches Considered

1. **Hard Delete Only**
   - Rejected: No recovery mechanism, poor audit trail

2. **Soft Delete Only**
   - Rejected: Accumulation of deleted records affects performance

3. **Versioned Components**
   - Rejected: Overly complex for current requirements

4. **Event Sourcing**
   - Rejected: Excessive complexity for 10-20 concurrent users

## References
- Database Schema: `/supabase/migrations/003_core_schema.sql`
- Optimistic Locking: `ADR-102-OPTIMISTIC-LOCKING.md`
- Circuit Breaker Pattern: `/src/lib/resilience/circuitBreaker.ts`
