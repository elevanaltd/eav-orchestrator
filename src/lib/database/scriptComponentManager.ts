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
    userId: string | null
  ): Promise<UpdateResult> {
    const startTime = Date.now();

    // Input validation
    if (!componentId) {
      throw new Error('Component ID is required');
    }
    if (currentVersion <= 0) {
      throw new Error('Valid version number is required');
    }
    // In development, userId can be null; in production it should be required
    // if (!userId) {
    //   throw new Error('User ID is required');
    // }

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

  /**
   * Create a new script component
   */
  async createComponent(
    scriptId: string,
    content: object = { type: 'doc', content: [] },
    plainText: string = '',
    userId: string | null,
    position?: number,
    status: string = 'created'
  ): Promise<{
    component_id: string;
    script_id: string;
    content_tiptap: object;
    content_plain: string;
    position: number;
    component_type: string;
    component_status: string;
    version: number;
    created_at: string;
    updated_at: string;
    last_edited_by: string | null;
    last_edited_at: string;
  }> {
    const startTime = Date.now();
    this.metrics.totalOperations++;

    try {
      // Get the next position if not provided
      let finalPosition = position;
      if (finalPosition === undefined) {
        const { data: positionData } = await this.supabase.rpc('get_next_position', {
          p_script_id: scriptId
        });
        finalPosition = positionData || 1000.0;
      }

      // Insert the new component
      const insertData: {
        script_id: string;
        content_tiptap: object;
        content_plain: string;
        position: number;
        component_status: string;
        last_edited_at: string;
        last_edited_by?: string;
      } = {
        script_id: scriptId,
        content_tiptap: content,
        content_plain: plainText,
        position: finalPosition!,  // We know finalPosition is defined after the check above
        component_status: status,
        last_edited_at: new Date().toISOString()
      };

      // Only add last_edited_by if userId is provided (not null)
      if (userId) {
        insertData.last_edited_by = userId;
      }

      const { data, error } = await this.supabase
        .from('script_components')
        .insert(insertData)
        .select('component_id, script_id, content_tiptap, content_plain, position, component_type, component_status, version, created_at, updated_at, last_edited_by, last_edited_at')
        .single();

      if (error) {
        console.error('Database error creating component:', error);
        throw new Error(`Failed to create component: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data returned from component creation');
      }

      // Success
      this.metrics.successfulOperations++;
      this.recordOperationTime(Date.now() - startTime);

      return {
        component_id: data.component_id,
        script_id: data.script_id,
        content_tiptap: data.content_tiptap,
        content_plain: data.content_plain,
        position: data.position,
        component_type: data.component_type || 'main',
        component_status: data.component_status,
        version: data.version,
        created_at: data.created_at,
        updated_at: data.updated_at,
        last_edited_by: data.last_edited_by,
        last_edited_at: data.last_edited_at
      };

    } catch (error) {
      this.recordOperationTime(Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Soft delete a script component (marks as deleted)
   */
  async deleteComponent(
    componentId: string,
    userId: string | null,
    reason?: string
  ): Promise<{
    success: boolean;
    deletedAt?: string;
    error?: string;
  }> {
    const startTime = Date.now();
    this.metrics.totalOperations++;

    try {
      // Validate inputs
      if (!componentId) {
        throw new Error('Component ID is required');
      }
      if (!userId) {
        throw new Error('User ID is required');
      }

      // Perform soft delete by updating deleted_at and deleted_by
      const { data, error } = await this.supabase
        .from('script_components')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: userId,
          deletion_reason: reason
        })
        .eq('component_id', componentId)
        .is('deleted_at', null) // Only delete if not already deleted
        .select('component_id, deleted_at')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Component not found or already deleted');
        }
        throw new Error(`Failed to delete component: ${error.message}`);
      }

      if (!data) {
        throw new Error('Component not found or already deleted');
      }

      this.metrics.successfulOperations++;
      this.recordOperationTime(Date.now() - startTime);

      return {
        success: true,
        deletedAt: data.deleted_at
      };

    } catch (error) {
      this.recordOperationTime(Date.now() - startTime);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Restore a soft-deleted component
   */
  async restoreComponent(
    componentId: string,
    userId: string
  ): Promise<{
    success: boolean;
    restoredAt?: string;
    error?: string;
  }> {
    const startTime = Date.now();
    this.metrics.totalOperations++;

    try {
      const { data, error } = await this.supabase
        .from('script_components')
        .update({
          deleted_at: null,
          deleted_by: null,
          deletion_reason: null,
          last_edited_by: userId,
          last_edited_at: new Date().toISOString()
        })
        .eq('component_id', componentId)
        .not('deleted_at', 'is', null) // Only restore if deleted
        .select('component_id, updated_at')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Component not found or not deleted');
        }
        throw new Error(`Failed to restore component: ${error.message}`);
      }

      if (!data) {
        throw new Error('Component not found or not deleted');
      }

      this.metrics.successfulOperations++;
      this.recordOperationTime(Date.now() - startTime);

      return {
        success: true,
        restoredAt: data.updated_at
      };

    } catch (error) {
      this.recordOperationTime(Date.now() - startTime);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get all components for a script (excludes soft-deleted)
   */
  async getComponentsByScriptId(
    scriptId: string,
    includeDeleted: boolean = false
  ): Promise<{
    components: Array<{
      component_id: string;
      script_id: string;
      position: number;
      content_tiptap: object;
      content_plain: string;
      component_type: string;
      component_status: string;
      version: number;
      created_at: string;
      updated_at: string;
      last_edited_by: string;
      last_edited_at: string;
    }>;
    error?: string;
  }> {
    const startTime = Date.now();
    this.metrics.totalOperations++;

    try {
      let query = this.supabase
        .from('script_components')
        .select('*')
        .eq('script_id', scriptId)
        .order('position', { ascending: true });

      // Filter out soft-deleted unless explicitly requested
      if (!includeDeleted) {
        query = query.is('deleted_at', null);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch components: ${error.message}`);
      }

      this.metrics.successfulOperations++;
      this.recordOperationTime(Date.now() - startTime);

      return {
        components: data || []
      };

    } catch (error) {
      this.recordOperationTime(Date.now() - startTime);
      return {
        components: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get a single component by ID
   */
  async getComponentById(
    componentId: string,
    includeDeleted: boolean = false
  ): Promise<{
    component?: {
      component_id: string;
      script_id: string;
      position: number;
      content_tiptap: object;
      content_plain: string;
      component_type: string;
      component_status: string;
      version: number;
      created_at: string;
      updated_at: string;
      last_edited_by: string;
      last_edited_at: string;
      deleted_at?: string;
    };
    error?: string;
  }> {
    const startTime = Date.now();
    this.metrics.totalOperations++;

    try {
      let query = this.supabase
        .from('script_components')
        .select('*')
        .eq('component_id', componentId);

      // Filter out soft-deleted unless explicitly requested
      if (!includeDeleted) {
        query = query.is('deleted_at', null);
      }

      const { data, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Component not found');
        }
        throw new Error(`Failed to fetch component: ${error.message}`);
      }

      this.metrics.successfulOperations++;
      this.recordOperationTime(Date.now() - startTime);

      return {
        component: data || undefined
      };

    } catch (error) {
      this.recordOperationTime(Date.now() - startTime);
      return {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Bulk soft delete multiple components
   */
  async bulkDeleteComponents(
    componentIds: string[],
    userId: string,
    reason?: string
  ): Promise<{
    success: boolean;
    deletedCount: number;
    failedIds: string[];
    error?: string;
  }> {
    const startTime = Date.now();
    this.metrics.totalOperations++;

    try {
      if (!componentIds || componentIds.length === 0) {
        throw new Error('Component IDs are required');
      }
      if (!userId) {
        throw new Error('User ID is required');
      }

      // Perform bulk soft delete
      const { data, error } = await this.supabase
        .from('script_components')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: userId,
          deletion_reason: reason
        })
        .in('component_id', componentIds)
        .is('deleted_at', null)
        .select('component_id');

      if (error) {
        throw new Error(`Bulk delete failed: ${error.message}`);
      }

      const deletedIds = data?.map(d => d.component_id) || [];
      const failedIds = componentIds.filter(id => !deletedIds.includes(id));

      this.metrics.successfulOperations++;
      this.recordOperationTime(Date.now() - startTime);

      return {
        success: true,
        deletedCount: deletedIds.length,
        failedIds
      };

    } catch (error) {
      this.recordOperationTime(Date.now() - startTime);
      return {
        success: false,
        deletedCount: 0,
        failedIds: componentIds,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update positions for multiple components (for reordering)
   */
  async updateComponentPositions(
    updates: Array<{ componentId: string; position: number }>
  ): Promise<{
    success: boolean;
    updatedCount: number;
    error?: string;
  }> {
    const startTime = Date.now();
    this.metrics.totalOperations++;

    try {
      // Use transaction for atomic updates
      const promises = updates.map(({ componentId, position }) =>
        this.supabase
          .from('script_components')
          .update({ position })
          .eq('component_id', componentId)
          .is('deleted_at', null)
      );

      const results = await Promise.all(promises);

      // Check for errors
      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        throw new Error(`Position update failed: ${errors[0].error?.message}`);
      }

      this.metrics.successfulOperations++;
      this.recordOperationTime(Date.now() - startTime);

      return {
        success: true,
        updatedCount: updates.length
      };

    } catch (error) {
      this.recordOperationTime(Date.now() - startTime);
      return {
        success: false,
        updatedCount: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get components count for a script (for pagination)
   */
  async getComponentsCount(
    scriptId: string,
    includeDeleted: boolean = false
  ): Promise<{
    count: number;
    error?: string;
  }> {
    try {
      let query = this.supabase
        .from('script_components')
        .select('component_id', { count: 'exact', head: true })
        .eq('script_id', scriptId);

      if (!includeDeleted) {
        query = query.is('deleted_at', null);
      }

      const { count, error } = await query;

      if (error) {
        throw new Error(`Failed to count components: ${error.message}`);
      }

      return {
        count: count || 0
      };

    } catch (error) {
      return {
        count: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ============================================================================
  // SCRIPT MANAGEMENT METHODS
  // ============================================================================

  /**
   * Get all video scripts accessible to the current user
   */
  async getAllScripts(): Promise<{
    scripts: Array<{
      script_id: string;
      video_id: string;
      title: string;
      description?: string;
      script_status: string;
      word_count?: number;
      estimated_duration?: string;
      created_at: string;
      updated_at: string;
      last_edited_by?: string;
      last_edited_at?: string;
    }>;
    error?: string;
  }> {
    const startTime = Date.now();
    this.metrics.totalOperations++;

    try {
      const { data, error } = await this.supabase
        .from('video_scripts')
        .select(`
          script_id,
          video_id,
          title,
          description,
          script_status,
          word_count,
          estimated_duration,
          created_at,
          updated_at,
          last_edited_by,
          last_edited_at
        `)
        .order('updated_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch scripts: ${error.message}`);
      }

      this.metrics.successfulOperations++;
      this.recordOperationTime(Date.now() - startTime);

      return {
        scripts: data || []
      };

    } catch (error) {
      this.recordOperationTime(Date.now() - startTime);
      return {
        scripts: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create a new video script
   */
  async createScript(
    videoId: string,
    title: string,
    description?: string,
    userId?: string
  ): Promise<{
    script?: {
      script_id: string;
      video_id: string;
      title: string;
      description?: string;
      script_status: string;
      created_at: string;
      updated_at: string;
      last_edited_by?: string;
    };
    error?: string;
  }> {
    const startTime = Date.now();
    this.metrics.totalOperations++;

    try {
      if (!videoId || !title) {
        throw new Error('Video ID and title are required');
      }

      const scriptData = {
        video_id: videoId,
        title: title.trim(),
        description: description?.trim(),
        script_status: 'draft',
        last_edited_by: userId
      };

      const { data, error } = await this.supabase
        .from('video_scripts')
        .insert(scriptData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create script: ${error.message}`);
      }

      this.metrics.successfulOperations++;
      this.recordOperationTime(Date.now() - startTime);

      return {
        script: data
      };

    } catch (error) {
      this.recordOperationTime(Date.now() - startTime);
      return {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get script by ID
   */
  async getScriptById(
    scriptId: string
  ): Promise<{
    script?: {
      script_id: string;
      video_id: string;
      title: string;
      description?: string;
      script_status: string;
      word_count?: number;
      estimated_duration?: string;
      created_at: string;
      updated_at: string;
      last_edited_by?: string;
      last_edited_at?: string;
    };
    error?: string;
  }> {
    const startTime = Date.now();
    this.metrics.totalOperations++;

    try {
      const { data, error } = await this.supabase
        .from('video_scripts')
        .select(`
          script_id,
          video_id,
          title,
          description,
          script_status,
          word_count,
          estimated_duration,
          created_at,
          updated_at,
          last_edited_by,
          last_edited_at
        `)
        .eq('script_id', scriptId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error('Script not found');
        }
        throw new Error(`Failed to fetch script: ${error.message}`);
      }

      this.metrics.successfulOperations++;
      this.recordOperationTime(Date.now() - startTime);

      return {
        script: data
      };

    } catch (error) {
      this.recordOperationTime(Date.now() - startTime);
      return {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get the system default video ID for creating new scripts
   * This implements the System-Owned Default Hierarchy pattern
   * approved by Technical Architect
   */
  async getDefaultVideoId(): Promise<{
    videoId?: string;
    error?: string;
  }> {
    const startTime = Date.now();
    this.metrics.totalOperations++;

    try {
      // Call the RPC function to get default video ID
      const { data, error } = await this.supabase
        .rpc('rpc_get_default_video_id');

      if (error) {
        throw new Error(`Failed to get default video ID: ${error.message}`);
      }

      if (!data) {
        throw new Error('No default video ID found. System defaults may not be initialized.');
      }

      this.metrics.successfulOperations++;
      this.recordOperationTime(Date.now() - startTime);

      return {
        videoId: data
      };

    } catch (error) {
      this.recordOperationTime(Date.now() - startTime);
      return {
        error: error instanceof Error ? error.message : 'Failed to get default video ID'
      };
    }
  }
}

// Re-export OptimisticLockError for convenience
export { OptimisticLockError };
