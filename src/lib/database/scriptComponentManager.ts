// Critical-Engineer: consulted for Architecture pattern selection
// ScriptComponentManager: Database operations with optimistic locking
// TRACED Protocol: T (RED) → GREEN implementation phase

// Context7: consulted for supabase
import { SupabaseClient } from '@supabase/supabase-js';
import { 
  OptimisticLockError,
  UpdateResult,
  BatchUpdateOperation,
  BatchUpdateResult,
  OptimisticLockMetrics,
  DatabaseUpdateResponse,
  DatabaseBatchResponse
} from '../../types/scriptComponent';

/**
 * Database manager for script components with optimistic locking
 * Implements version-based conflict detection and resolution
 */
export class ScriptComponentManager {
  private supabase: SupabaseClient;
  private metrics: OptimisticLockMetrics;
  private operationTimes: number[] = [];

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      conflictCount: 0,
      averageLatency: 0,
      p95Latency: 0,
      conflictResolutionTime: 0
    };
  }

  /**
   * Update a single script component with optimistic locking
   */
  async updateComponent(
    componentId: string,
    content: object,
    plainText: string,
    currentVersion: number,
    userId: string
  ): Promise<UpdateResult> {
    const startTime = Date.now();
    
    // Input validation
    if (!componentId) {
      throw new Error('Component ID is required');
    }
    if (currentVersion <= 0) {
      throw new Error('Valid version number is required');
    }
    if (!userId) {
      throw new Error('User ID is required');
    }

    this.metrics.totalOperations++;

    try {
      const { data, error } = await this.supabase.rpc(
        'update_script_component_with_lock',
        {
          p_component_id: componentId,
          p_content: content,
          p_plain_text: plainText,
          p_current_version: currentVersion,
          p_user_id: userId
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      const result = data[0] as DatabaseUpdateResponse;

      if (!result.success) {
        if (result.conflict_detected) {
          // Version conflict - throw OptimisticLockError with merge data
          this.metrics.conflictCount++;
          throw new OptimisticLockError(
            componentId,
            currentVersion,
            result.current_version || 0,
            result.current_content || {},
            'version_mismatch'
          );
        } else {
          // Other error (component not found, etc.)
          throw new Error(result.error_message || 'Update failed');
        }
      }

      // Success
      this.metrics.successfulOperations++;
      this.recordOperationTime(Date.now() - startTime);

      return {
        success: true,
        newVersion: result.new_version || undefined,
        conflictDetected: false
      };

    } catch (error) {
      this.recordOperationTime(Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Update multiple components in a single transaction
   * Fails fast on first conflict and rolls back entire operation
   */
  async updateMultipleComponents(
    operations: BatchUpdateOperation[]
  ): Promise<BatchUpdateResult[]> {
    const startTime = Date.now();
    this.metrics.totalOperations++;

    try {
      const { data, error } = await this.supabase.rpc(
        'update_multiple_components_with_lock',
        {
          p_updates: JSON.stringify(operations)
        }
      );

      if (error) {
        throw new Error(error.message);
      }

      const results = data as DatabaseBatchResponse[];
      
      // Check for conflicts (should only be one result on conflict due to rollback)
      const conflictResult = results.find(r => r.conflict_detected);
      if (conflictResult) {
        this.metrics.conflictCount++;
        throw new OptimisticLockError(
          conflictResult.component_id || '',
          0, // Client version not available in batch context
          conflictResult.current_version || 0,
          conflictResult.current_content || {},
          'version_mismatch'
        );
      }

      // Check for other errors
      const errorResult = results.find(r => !r.success && !r.conflict_detected);
      if (errorResult) {
        throw new Error(errorResult.error_message || 'Batch update failed');
      }

      // All operations succeeded
      this.metrics.successfulOperations++;
      this.recordOperationTime(Date.now() - startTime);

      return results.map(r => ({
        component_id: r.component_id || '',
        success: r.success,
        new_version: r.new_version || undefined,
        conflict_detected: r.conflict_detected,
        current_content: r.current_content || undefined,
        current_version: r.current_version || undefined,
        error_message: r.error_message || undefined
      }));

    } catch (error) {
      this.recordOperationTime(Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Get current version of a component
   */
  async getCurrentVersion(componentId: string): Promise<number> {
    const { data, error } = await this.supabase.rpc(
      'get_script_component_version',
      { p_component_id: componentId }
    );

    if (error) {
      throw new Error(error.message);
    }

    return data || 0;
  }

  /**
   * Get performance metrics for optimistic locking operations
   */
  getMetrics(): OptimisticLockMetrics {
    return {
      ...this.metrics,
      averageLatency: this.calculateAverageLatency(),
      p95Latency: this.calculateP95Latency()
    };
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      conflictCount: 0,
      averageLatency: 0,
      p95Latency: 0,
      conflictResolutionTime: 0
    };
    this.operationTimes = [];
  }

  /**
   * Record operation timing for performance tracking
   */
  private recordOperationTime(durationMs: number): void {
    this.operationTimes.push(durationMs);
    
    // Keep only last 1000 operations to prevent memory growth
    if (this.operationTimes.length > 1000) {
      this.operationTimes = this.operationTimes.slice(-1000);
    }
  }

  /**
   * Calculate average latency from recorded operation times
   */
  private calculateAverageLatency(): number {
    if (this.operationTimes.length === 0) return 0;
    
    const sum = this.operationTimes.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.operationTimes.length);
  }

  /**
   * Calculate P95 latency from recorded operation times
   */
  private calculateP95Latency(): number {
    if (this.operationTimes.length === 0) return 0;
    
    const sorted = [...this.operationTimes].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    
    return sorted[p95Index] || 0;
  }
}

// Re-export OptimisticLockError for convenience
export { OptimisticLockError };
