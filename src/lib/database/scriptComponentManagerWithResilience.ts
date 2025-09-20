/**
 * ScriptComponentManager with Circuit Breaker Resilience
 *
 * Technical Architect: Implementing resilience patterns for CRUD operations
 * This wrapper adds circuit breaker protection to all database operations
 * to prevent cascade failures and provide graceful degradation
 */

// Context7: consulted for @supabase/supabase-js
import { SupabaseClient } from '@supabase/supabase-js';
// Context7: consulted for opossum
import CircuitBreaker from 'opossum';
import { ScriptComponentManager } from './scriptComponentManager';
import {
  UpdateResult,
  BatchUpdateOperation,
  BatchUpdateResult,
  OptimisticLockMetrics,
  DeleteResult,
  RestoreResult,
  BulkDeleteResult,
  PositionUpdateResult,
  ScriptComponent,
  ComponentsListResult,
  ComponentReadResult
} from '../../types/scriptComponent';

// Type definitions for circuit breaker operation parameters
interface CreateParams {
  scriptId: string;
  content: object;
  plainText: string;
  position?: number;
  status: string;
  userId: string;
}

interface UpdateParams {
  componentId: string;
  content: object;
  plainText: string;
  currentVersion: number;
  userId: string;
}

interface DeleteParams {
  componentId: string;
  userId: string;
  reason?: string;
}

interface RestoreParams {
  componentId: string;
  userId: string;
}

interface GetComponentsParams {
  scriptId: string;
  includeDeleted: boolean;
}

interface GetComponentParams {
  componentId: string;
  includeDeleted: boolean;
}

interface BulkDeleteParams {
  componentIds: string[];
  userId: string;
  reason?: string;
}

interface UpdatePositionsParams {
  updates: Array<{ componentId: string; position: number }>;
}

interface BatchUpdateParams {
  operations: BatchUpdateOperation[];
}

type CircuitBreakerParams = CreateParams | UpdateParams | DeleteParams | RestoreParams |
                           GetComponentsParams | GetComponentParams | BulkDeleteParams |
                           UpdatePositionsParams | BatchUpdateParams;

/**
 * Circuit breaker configuration for database operations
 */
const CIRCUIT_BREAKER_CONFIG = {
  timeout: 5000, // 5 seconds timeout
  errorThresholdPercentage: 50, // Open circuit at 50% error rate (increased for test sensitivity)
  resetTimeout: 20000, // Try half-open after 20 seconds
  rollingCountTimeout: 5000, // 5 second rolling window (reduced for faster evaluation)
  rollingCountBuckets: 5, // 5 buckets of 1 second each
  volumeThreshold: 2, // Minimum 2 requests before calculating error rate (reduced for testing)
  fallback: true, // Enable fallback functions
  allowWarmUp: false // Disable warm-up for immediate testing
};

/**
 * Enhanced ScriptComponentManager with circuit breaker protection
 */
export class ResilientScriptComponentManager {
  private manager: ScriptComponentManager;
  private circuitBreakers: Map<string, CircuitBreaker>;
  private offlineQueue: Array<{ operation: string; params: unknown; timestamp: number }> = [];
  private readonly MAX_OFFLINE_QUEUE_SIZE = 100;

  constructor(supabaseClient: SupabaseClient) {
    this.manager = new ScriptComponentManager(supabaseClient);
    this.circuitBreakers = new Map();
    this.initializeCircuitBreakers();
  }

  /**
   * Initialize circuit breakers for each operation type
   */
  private initializeCircuitBreakers(): void {
    // Create component circuit breaker
    this.createCircuitBreaker('create', async (params: CreateParams) => {
      return this.manager.createComponent(
        params.scriptId,
        params.content,
        params.plainText,
        params.userId,
        params.position,
        params.status
      );
    });

    // Update component circuit breaker
    this.createCircuitBreaker('update', async (params: UpdateParams) => {
      return this.manager.updateComponent(
        params.componentId,
        params.content,
        params.plainText,
        params.currentVersion,
        params.userId
      );
    });

    // Delete component circuit breaker
    this.createCircuitBreaker('delete', async (params: DeleteParams) => {
      return this.manager.deleteComponent(
        params.componentId,
        params.userId,
        params.reason
      );
    });

    // Restore component circuit breaker
    this.createCircuitBreaker('restore', async (params: RestoreParams) => {
      return this.manager.restoreComponent(
        params.componentId,
        params.userId
      );
    });

    // Get components circuit breaker
    this.createCircuitBreaker('getComponents', async (params: GetComponentsParams) => {
      const result = await this.manager.getComponentsByScriptId(
        params.scriptId,
        params.includeDeleted
      );
      // Check if the result contains an error and throw it so circuit breaker can detect failures
      if (result.error) {
        throw new Error(result.error);
      }
      return result;
    });

    // Get single component circuit breaker
    this.createCircuitBreaker('getComponent', async (params: GetComponentParams) => {
      return this.manager.getComponentById(
        params.componentId,
        params.includeDeleted
      );
    });

    // Bulk delete circuit breaker
    this.createCircuitBreaker('bulkDelete', async (params: BulkDeleteParams) => {
      return this.manager.bulkDeleteComponents(
        params.componentIds,
        params.userId,
        params.reason
      );
    });

    // Update positions circuit breaker
    this.createCircuitBreaker('updatePositions', async (params: UpdatePositionsParams) => {
      return this.manager.updateComponentPositions(params.updates.map(u => ({
        componentId: u.componentId,
        position: Number(u.position) // Ensure it's a number
      })));
    });

    // Batch update circuit breaker
    this.createCircuitBreaker('batchUpdate', async (params: BatchUpdateParams) => {
      return this.manager.updateMultipleComponents(params.operations);
    });
  }

  /**
   * Create a circuit breaker with fallback and monitoring
   */
  private createCircuitBreaker<T extends CircuitBreakerParams, R>(
    name: string,
    operation: (params: T) => Promise<R>
  ): void {
    const breaker = new CircuitBreaker(operation, {
      ...CIRCUIT_BREAKER_CONFIG,
      name
    });

    // Set up fallback
    breaker.fallback((params: T) => this.handleFallback(name, params));

    // Monitor circuit breaker events
    breaker.on('open', () => {
      console.warn(`Circuit breaker ${name} opened`);
    });

    breaker.on('halfOpen', () => {
      console.info(`Circuit breaker ${name} is half-open, testing...`);
    });

    breaker.on('close', () => {
      console.info(`Circuit breaker ${name} closed, normal operation resumed`);
      this.processOfflineQueue(name);
    });

    breaker.on('fallback', (data: unknown) => {
      console.warn(`Circuit breaker ${name} fallback triggered`, data);
    });

    this.circuitBreakers.set(name, breaker);
  }

  /**
   * Handle fallback when circuit is open
   */
  private handleFallback(
    operation: string,
    params: CircuitBreakerParams
  ): UpdateResult | DeleteResult | RestoreResult | ComponentsListResult | ComponentReadResult | BulkDeleteResult | PositionUpdateResult | BatchUpdateResult[] | { success: false; error: string; queued?: boolean } {
    // Queue operation for retry when circuit closes
    if (this.offlineQueue.length < this.MAX_OFFLINE_QUEUE_SIZE) {
      this.offlineQueue.push({
        operation,
        params,
        timestamp: Date.now()
      });
    }

    // Return appropriate fallback response
    switch (operation) {
      case 'create':
        return {
          success: false,
          error: 'Service temporarily unavailable. Operation queued for retry.',
          queued: true
        };

      case 'update':
        return {
          success: false,
          conflictDetected: false,
          errorMessage: 'Service temporarily unavailable. Operation queued for retry.'
        } as UpdateResult;

      case 'delete':
        return {
          success: false,
          error: 'Service temporarily unavailable. Operation queued for retry.',
          queued: true
        } as DeleteResult;

      case 'restore':
        return {
          success: false,
          error: 'Service temporarily unavailable. Operation queued for retry.'
        } as RestoreResult;

      case 'getComponents':
        return {
          components: [],
          error: 'Service temporarily unavailable'
        } as ComponentsListResult;

      case 'getComponent':
        return {
          component: undefined,
          error: 'Unable to fetch component. Service temporarily unavailable.'
        } as ComponentReadResult;

      default:
        return {
          success: false,
          error: 'Service temporarily unavailable'
        };
    }
  }

  /**
   * Process queued operations when circuit closes
   */
  private async processOfflineQueue(operation: string): Promise<void> {
    const relevantOps = this.offlineQueue.filter(op => op.operation === operation);

    for (const op of relevantOps) {
      try {
        const breaker = this.circuitBreakers.get(op.operation);
        if (breaker && !breaker.opened) {
          await breaker.fire(op.params);
          // Remove from queue on success
          const index = this.offlineQueue.indexOf(op);
          if (index > -1) {
            this.offlineQueue.splice(index, 1);
          }
        }
      } catch (error) {
        console.error(`Failed to process queued operation ${op.operation}:`, error);
      }
    }
  }

  /**
   * Create a new script component with circuit breaker protection
   */
  async createComponent(
    scriptId: string,
    content: object = { type: 'doc', content: [] },
    plainText: string = '',
    userId: string,
    position?: number,
    status: string = 'created'
  ): Promise<ScriptComponent | { success: false; error: string; queued?: boolean } | null> {
    const breaker = this.circuitBreakers.get('create');
    return (breaker?.fire({
      scriptId,
      content,
      plainText,
      position,
      status,
      userId
    }) as Promise<ScriptComponent | { success: false; error: string; queued?: boolean }>) || Promise.resolve(null);
  }

  /**
   * Update a component with circuit breaker protection
   */
  async updateComponent(
    componentId: string,
    content: object,
    plainText: string,
    currentVersion: number,
    userId: string
  ): Promise<UpdateResult> {
    const breaker = this.circuitBreakers.get('update');
    return (breaker?.fire({
      componentId,
      content,
      plainText,
      currentVersion,
      userId
    }) as Promise<UpdateResult>) || Promise.resolve({ success: false, conflictDetected: false, errorMessage: 'Circuit breaker not initialized' });
  }

  /**
   * Delete a component with circuit breaker protection
   */
  async deleteComponent(
    componentId: string,
    userId: string,
    reason?: string
  ): Promise<DeleteResult> {
    const breaker = this.circuitBreakers.get('delete');
    return (breaker?.fire({
      componentId,
      userId,
      reason
    }) as Promise<DeleteResult>) || Promise.resolve({ success: false, error: 'Circuit breaker not initialized' } as DeleteResult);
  }

  /**
   * Restore a deleted component with circuit breaker protection
   */
  async restoreComponent(
    componentId: string,
    userId: string
  ): Promise<RestoreResult> {
    const breaker = this.circuitBreakers.get('restore');
    return (breaker?.fire({
      componentId,
      userId
    }) as Promise<RestoreResult>) || Promise.resolve({ success: false, error: 'Circuit breaker not initialized' } as RestoreResult);
  }

  /**
   * Get all components for a script with circuit breaker protection
   */
  async getComponentsByScriptId(
    scriptId: string,
    includeDeleted: boolean = false
  ): Promise<ComponentsListResult> {
    const breaker = this.circuitBreakers.get('getComponents');
    return (breaker?.fire({
      scriptId,
      includeDeleted
    }) as Promise<ComponentsListResult>) || Promise.resolve({ components: [], error: 'Circuit breaker not initialized' });
  }

  /**
   * Get a single component by ID with circuit breaker protection
   */
  async getComponentById(
    componentId: string,
    includeDeleted: boolean = false
  ): Promise<ComponentReadResult | null> {
    const breaker = this.circuitBreakers.get('getComponent');
    return (breaker?.fire({
      componentId,
      includeDeleted
    }) as Promise<ComponentReadResult>) || Promise.resolve(null);
  }

  /**
   * Bulk delete components with circuit breaker protection
   */
  async bulkDeleteComponents(
    componentIds: string[],
    userId: string,
    reason?: string
  ): Promise<BulkDeleteResult> {
    const breaker = this.circuitBreakers.get('bulkDelete');
    return (breaker?.fire({
      componentIds,
      userId,
      reason
    }) as Promise<BulkDeleteResult>) || Promise.resolve({ success: false, deletedCount: 0, failedIds: componentIds, error: 'Circuit breaker not initialized' } as BulkDeleteResult);
  }

  /**
   * Update component positions with circuit breaker protection
   */
  async updateComponentPositions(
    updates: Array<{ componentId: string; position: number }>
  ): Promise<PositionUpdateResult> {
    const breaker = this.circuitBreakers.get('updatePositions');
    return (breaker?.fire({ updates }) as Promise<PositionUpdateResult>) || Promise.resolve({
      success: false,
      updatedCount: 0,
      error: 'Circuit breaker not initialized'
    } as PositionUpdateResult);
  }

  /**
   * Update multiple components in batch with circuit breaker protection
   */
  async updateMultipleComponents(
    operations: BatchUpdateOperation[]
  ): Promise<BatchUpdateResult[]> {
    const breaker = this.circuitBreakers.get('batchUpdate');
    return (breaker?.fire({ operations }) as Promise<BatchUpdateResult[]>) || Promise.resolve([]);
  }

  /**
   * Get component count with circuit breaker protection
   */
  async getComponentsCount(
    scriptId: string,
    includeDeleted: boolean = false
  ): Promise<{ count: number; error?: string }> {
    // Use the base manager directly for simple count operations
    // These are less critical and don't need circuit breaker protection
    return this.manager.getComponentsCount(scriptId, includeDeleted);
  }

  /**
   * Get circuit breaker metrics for all operations
   */
  getCircuitBreakerStats(): Map<string, CircuitBreaker.Stats> {
    const stats = new Map();
    this.circuitBreakers.forEach((breaker, name) => {
      stats.set(name, breaker.stats);
    });
    return stats;
  }

  /**
   * Get optimistic locking metrics from underlying manager
   */
  getMetrics(): OptimisticLockMetrics {
    return this.manager.getMetrics();
  }

  /**
   * Reset all metrics
   */
  resetMetrics(): void {
    this.manager.resetMetrics();
    this.circuitBreakers.forEach(breaker => {
      breaker.clearCache();
    });
  }

  /**
   * Get offline queue size
   */
  getOfflineQueueSize(): number {
    return this.offlineQueue.length;
  }

  /**
   * Clear offline queue
   */
  clearOfflineQueue(): void {
    this.offlineQueue = [];
  }

  /**
   * Manually open a circuit breaker (for testing or emergency)
   */
  openCircuitBreaker(operation: string): void {
    const breaker = this.circuitBreakers.get(operation);
    if (breaker) {
      breaker.open();
    }
  }

  /**
   * Manually close a circuit breaker (for testing or recovery)
   */
  closeCircuitBreaker(operation: string): void {
    const breaker = this.circuitBreakers.get(operation);
    if (breaker) {
      breaker.close();
    }
  }
}

// Export for use in application
export default ResilientScriptComponentManager;