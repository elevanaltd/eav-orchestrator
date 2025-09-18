// Critical-Engineer: consulted for Architecture pattern selection  
// TypeScript interfaces for optimistic locking implementation
// TRACED Protocol: T (RED) → GREEN implementation phase

/**
 * Core script component interface with optimistic locking support
 */
export interface ScriptComponent {
  component_id: string;
  script_id: string;
  content_tiptap: object; // TipTap JSON document
  content_plain: string;
  position_index: number;
  component_status: ComponentStatus;
  version: number; // CRITICAL: Optimistic locking version
  created_at: string;
  updated_at: string;
  last_edited_by: string;
  last_edited_at: string;
  deleted_at?: string; // Soft delete support
  deleted_by?: string;
}

/**
 * Component status enumeration
 */
export type ComponentStatus = 'created' | 'in_edit' | 'approved';

/**
 * Optimistic lock conflict error with merge resolution data
 */
export class OptimisticLockError extends Error {
  readonly componentId: string;
  readonly expectedVersion: number;
  readonly currentVersion: number;
  readonly currentContent: object;
  readonly conflictType: 'version_mismatch' | 'not_found' | 'already_deleted';

  constructor(
    componentId: string,
    expectedVersion: number,
    currentVersion: number,
    currentContent: object,
    conflictType: 'version_mismatch' | 'not_found' | 'already_deleted' = 'version_mismatch'
  ) {
    const message = `Optimistic lock conflict for component ${componentId}: expected version ${expectedVersion}, got ${currentVersion}`;
    super(message);
    this.name = 'OptimisticLockError';
    this.componentId = componentId;
    this.expectedVersion = expectedVersion;
    this.currentVersion = currentVersion;
    this.currentContent = currentContent;
    this.conflictType = conflictType;
  }

  /**
   * Check if this error can be resolved through automatic merge
   */
  isAutoMergeable(): boolean {
    // Only version mismatches can potentially be auto-merged
    // Not found or deleted components require user intervention
    return this.conflictType === 'version_mismatch';
  }

  /**
   * Get data needed for 3-way merge resolution
   */
  getMergeData() {
    return {
      componentId: this.componentId,
      conflictType: this.conflictType,
      serverContent: this.currentContent,
      serverVersion: this.currentVersion,
      clientVersion: this.expectedVersion
    };
  }
}

/**
 * Update operation result with version tracking
 */
export interface UpdateResult {
  success: boolean;
  newVersion?: number;
  conflictDetected: boolean;
  errorMessage?: string;
}

/**
 * Batch update operation for component reordering
 */
export interface BatchUpdateOperation {
  component_id: string;
  version: number;
  position_index?: number;
  content?: object;
}

/**
 * Batch update result for specific component
 */
export interface BatchUpdateResult {
  component_id: string;
  success: boolean;
  new_version?: number;
  conflict_detected: boolean;
  current_content?: object;
  current_version?: number;
  error_message?: string;
}

/**
 * Database function response for single component update
 */
export interface DatabaseUpdateResponse {
  success: boolean;
  new_version: number | null;
  conflict_detected: boolean;
  current_content: object | null;
  current_version: number | null;
  error_message: string | null;
}

/**
 * Database function response for batch updates
 */
export interface DatabaseBatchResponse {
  success: boolean;
  component_id: string | null;
  new_version: number | null;
  conflict_detected: boolean;
  current_content: object | null;
  current_version: number | null;
  error_message: string | null;
}

/**
 * Conflict resolution strategy for handling version conflicts
 */
export type ConflictResolutionStrategy = 
  | 'client_wins'      // Force client version (data loss risk)
  | 'server_wins'      // Accept server version (discard client changes)
  | 'manual_merge'     // Present merge UI to user
  | 'auto_merge'       // Attempt automatic merge
  | 'retry_with_latest'; // Refresh and retry operation

/**
 * Merge conflict resolution data
 */
export interface MergeConflict {
  componentId: string;
  clientContent: object;
  serverContent: object;
  baseContent?: object; // Common ancestor for 3-way merge
  clientVersion: number;
  serverVersion: number;
  conflictAreas: ConflictArea[];
}

/**
 * Specific area of conflict within content
 */
export interface ConflictArea {
  path: string; // JSON path to conflicted field
  clientValue: Record<string, unknown>;
  serverValue: Record<string, unknown>;
  baseValue?: Record<string, unknown>;
  conflictType: 'text_conflict' | 'structural_conflict' | 'deletion_conflict';
}

/**
 * Performance metrics for optimistic locking operations
 */
export interface OptimisticLockMetrics {
  totalOperations: number;
  successfulOperations: number;
  conflictCount: number;
  averageLatency: number;
  p95Latency: number;
  conflictResolutionTime: number;
}

/**
 * Configuration for optimistic locking behavior
 */
export interface OptimisticLockConfig {
  maxRetryAttempts: number;
  retryDelayMs: number;
  enableAutoMerge: boolean;
  conflictResolutionTimeout: number;
  performanceTargetP95: number; // Target: ≤ 500ms
}

/**
 * Delete operation result
 */
export interface DeleteResult {
  success: boolean;
  deletedAt?: string;
  error?: string;
}

/**
 * Restore operation result
 */
export interface RestoreResult {
  success: boolean;
  restoredAt?: string;
  error?: string;
}

/**
 * Bulk delete operation result
 */
export interface BulkDeleteResult {
  success: boolean;
  deletedCount: number;
  failedIds: string[];
  error?: string;
}

/**
 * Component read result
 */
export interface ComponentReadResult {
  component?: ScriptComponent;
  error?: string;
}

/**
 * Components list result
 */
export interface ComponentsListResult {
  components: ScriptComponent[];
  error?: string;
}

/**
 * Component count result
 */
export interface ComponentCountResult {
  count: number;
  error?: string;
}

/**
 * Position update entry for reordering
 */
export interface PositionUpdate {
  componentId: string;
  position: number;
}

/**
 * Position update result
 */
export interface PositionUpdateResult {
  success: boolean;
  updatedCount: number;
  error?: string;
}
