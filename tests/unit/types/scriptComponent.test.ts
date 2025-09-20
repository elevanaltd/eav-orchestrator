/**
 * Script Component Types Unit Tests
 * 
 * TRACED Protocol: TEST FIRST (RED) - These tests MUST fail initially
 * Testing TypeScript interfaces and classes for optimistic locking
 */

// Context7: consulted for vitest
import { describe, it, expect } from 'vitest';
import { 
  ScriptComponent,
  OptimisticLockError,
  UpdateResult,
  BatchUpdateOperation,
  BatchUpdateResult,
  ConflictResolutionStrategy,
  MergeConflict,
  OptimisticLockMetrics,
  OptimisticLockConfig
} from '../../../src/types/scriptComponent';

describe('ScriptComponent Types', () => {
  describe('OptimisticLockError', () => {
    it('should create OptimisticLockError with conflict details', () => {
      const componentId = 'test-component-123';
      const expectedVersion = 5;
      const currentVersion = 7;
      const currentContent = { type: 'doc', content: [] };

      // This test MUST fail - OptimisticLockError doesn't exist yet
      const error = new OptimisticLockError(
        componentId,
        expectedVersion,
        currentVersion,
        currentContent
      );

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('OptimisticLockError');
      expect(error.componentId).toBe(componentId);
      expect(error.expectedVersion).toBe(expectedVersion);
      expect(error.currentVersion).toBe(currentVersion);
      expect(error.currentContent).toEqual(currentContent);
      expect(error.conflictType).toBe('version_mismatch');
    });

    it('should identify auto-mergeable conflicts', () => {
      const error = new OptimisticLockError(
        'test-id',
        1,
        2,
        {},
        'version_mismatch'
      );

      expect(error.isAutoMergeable()).toBe(true);
    });

    it('should identify non-auto-mergeable conflicts', () => {
      const notFoundError = new OptimisticLockError(
        'test-id',
        1,
        0,
        {},
        'not_found'
      );

      const deletedError = new OptimisticLockError(
        'test-id',
        1,
        2,
        {},
        'already_deleted'
      );

      expect(notFoundError.isAutoMergeable()).toBe(false);
      expect(deletedError.isAutoMergeable()).toBe(false);
    });

    it('should provide merge data for conflict resolution', () => {
      const error = new OptimisticLockError(
        'component-123',
        5,
        7,
        { type: 'doc', content: [{ type: 'paragraph' }] }
      );

      const mergeData = error.getMergeData();

      expect(mergeData).toEqual({
        componentId: 'component-123',
        conflictType: 'version_mismatch',
        serverContent: { type: 'doc', content: [{ type: 'paragraph' }] },
        serverVersion: 7,
        clientVersion: 5
      });
    });
  });

  describe('Type Interfaces', () => {
    it('should define ScriptComponent interface with version', () => {
      const component: ScriptComponent = {
        component_id: 'comp-123',
        script_id: 'script-456',
        content_tiptap: { type: 'doc', content: [] },
        content_plain: 'Plain text content',
        position: 1.5,
        component_type: 'main',
        component_status: 'in_edit',
        version: 3, // Critical for optimistic locking
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T12:00:00Z',
        last_edited_by: 'user-789',
        last_edited_at: '2023-01-01T12:00:00Z'
      };

      expect(component.version).toBe(3);
      expect(component.component_status).toBe('in_edit');
    });

    it('should support soft delete fields', () => {
      const deletedComponent: ScriptComponent = {
        component_id: 'comp-123',
        script_id: 'script-456',
        content_tiptap: { type: 'doc', content: [] },
        content_plain: 'Deleted content',
        position: 1.5,
        component_type: 'main',
        component_status: 'created',
        version: 2,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T12:00:00Z',
        last_edited_by: 'user-789',
        last_edited_at: '2023-01-01T11:00:00Z',
        deleted_at: '2023-01-01T12:00:00Z',
        deleted_by: 'user-789'
      };

      expect(deletedComponent.deleted_at).toBeDefined();
      expect(deletedComponent.deleted_by).toBe('user-789');
    });

    it('should define UpdateResult interface', () => {
      const successResult: UpdateResult = {
        success: true,
        newVersion: 4,
        conflictDetected: false
      };

      const conflictResult: UpdateResult = {
        success: false,
        conflictDetected: true,
        errorMessage: 'Version conflict detected'
      };

      expect(successResult.success).toBe(true);
      expect(successResult.newVersion).toBe(4);
      expect(conflictResult.conflictDetected).toBe(true);
    });

    it('should define BatchUpdateOperation interface', () => {
      const batchOp: BatchUpdateOperation = {
        component_id: 'comp-123',
        version: 2,
        position: 3.7,
        content: { type: 'doc', content: [{ type: 'text', text: 'Updated' }] }
      };

      expect(batchOp.component_id).toBe('comp-123');
      expect(batchOp.version).toBe(2);
      expect(batchOp.position).toBe(3.7);
    });

    it('should define BatchUpdateResult interface', () => {
      const result: BatchUpdateResult = {
        component_id: 'comp-123',
        success: false,
        conflict_detected: true,
        current_content: { type: 'doc', content: [] },
        current_version: 5,
        error_message: 'Version conflict detected'
      };

      expect(result.component_id).toBe('comp-123');
      expect(result.conflict_detected).toBe(true);
      expect(result.current_version).toBe(5);
    });
  });

  describe('Conflict Resolution Types', () => {
    it('should define ConflictResolutionStrategy type', () => {
      const strategies: ConflictResolutionStrategy[] = [
        'client_wins',
        'server_wins',
        'manual_merge',
        'auto_merge',
        'retry_with_latest'
      ];

      expect(strategies).toHaveLength(5);
      expect(strategies).toContain('manual_merge');
    });

    it('should define MergeConflict interface', () => {
      // TESTGUARD-APPROVED: TESTGUARD-20250911-2960822f
      const conflict: MergeConflict = {
        componentId: 'comp-123',
        clientContent: { type: 'doc', content: [{ type: 'text', text: 'Client version' }] },
        serverContent: { type: 'doc', content: [{ type: 'text', text: 'Server version' }] },
        clientVersion: 3,
        serverVersion: 4,
        conflictAreas: [{
          path: 'content.0.text',
          clientValue: { text: 'Client version' },
          serverValue: { text: 'Server version' },
          conflictType: 'text_conflict'
        }]
      };

      expect(conflict.componentId).toBe('comp-123');
      expect(conflict.conflictAreas).toHaveLength(1);
      expect(conflict.conflictAreas[0].conflictType).toBe('text_conflict');
    });
  });

  describe('Performance and Configuration Types', () => {
    it('should define OptimisticLockMetrics interface', () => {
      const metrics: OptimisticLockMetrics = {
        totalOperations: 1000,
        successfulOperations: 950,
        conflictCount: 50,
        averageLatency: 234,
        p95Latency: 456, // Must be ≤ 500ms target
        conflictResolutionTime: 1200
      };

      expect(metrics.totalOperations).toBe(1000);
      expect(metrics.p95Latency).toBeLessThanOrEqual(500); // Performance requirement
    });

    it('should define OptimisticLockConfig interface', () => {
      const config: OptimisticLockConfig = {
        maxRetryAttempts: 3,
        retryDelayMs: 100,
        enableAutoMerge: true,
        conflictResolutionTimeout: 5000,
        performanceTargetP95: 500 // Target P95 ≤ 500ms
      };

      expect(config.maxRetryAttempts).toBe(3);
      expect(config.performanceTargetP95).toBe(500);
      expect(config.enableAutoMerge).toBe(true);
    });
  });
});