/**
 * ScriptComponentManager Unit Tests
 * 
 * TRACED Protocol: TEST FIRST (RED) - These tests MUST fail initially
 * Testing database manager with optimistic locking implementation
 */

// Context7: consulted for vitest
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  ScriptComponentManager,
  OptimisticLockError
} from '../../../src/lib/database/scriptComponentManager';
import { createMockSupabaseClient } from '../../mocks/supabase';

describe('ScriptComponentManager', () => {
  let manager: ScriptComponentManager;
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient(null as any);
    
    // This test MUST fail - ScriptComponentManager doesn't exist yet
    manager = new ScriptComponentManager(mockSupabase);
    
    vi.clearAllMocks();
  });

  describe('Single Component Updates with Optimistic Locking', () => {
    it('should update component successfully when version matches', async () => {
      const componentId = 'comp-123';
      const content = { type: 'doc', content: [{ type: 'text', text: 'Updated content' }] };
      const currentVersion = 2;
      const userId = 'user-456';

      // Mock successful database function call
      mockSupabase.rpc.mockResolvedValue({
        data: [{
          success: true,
          new_version: 3,
          conflict_detected: false,
          current_content: null,
          current_version: null,
          error_message: null
        }],
        error: null
      });

      const result = await manager.updateComponent(
        componentId,
        content,
        'Updated content plain text',
        currentVersion,
        userId
      );

      expect(result.success).toBe(true);
      expect(result.newVersion).toBe(3);
      expect(result.conflictDetected).toBe(false);

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'update_script_component_with_lock',
        {
          p_component_id: componentId,
          p_content: content,
          p_plain_text: 'Updated content plain text',
          p_current_version: currentVersion,
          p_user_id: userId
        }
      );
    });

    it('should throw OptimisticLockError when version conflict detected', async () => {
      const componentId = 'comp-123';
      const content = { type: 'doc', content: [] };
      const staleVersion = 1;
      const currentServerVersion = 3;
      const serverContent = { type: 'doc', content: [{ type: 'text', text: 'Server content' }] };

      // Mock version conflict response
      mockSupabase.rpc.mockResolvedValue({
        data: [{
          success: false,
          new_version: null,
          conflict_detected: true,
          current_content: serverContent,
          current_version: currentServerVersion,
          error_message: 'Version conflict detected'
        }],
        error: null
      });

      await expect(
        manager.updateComponent(componentId, content, 'text', staleVersion, 'user-456')
      ).rejects.toThrow(OptimisticLockError);

      try {
        await manager.updateComponent(componentId, content, 'text', staleVersion, 'user-456');
      } catch (error) {
        expect(error).toBeInstanceOf(OptimisticLockError);
        expect((error as OptimisticLockError).componentId).toBe(componentId);
        expect((error as OptimisticLockError).expectedVersion).toBe(staleVersion);
        expect((error as OptimisticLockError).currentVersion).toBe(currentServerVersion);
        expect((error as OptimisticLockError).currentContent).toEqual(serverContent);
      }
    });

    it('should handle component not found error', async () => {
      const componentId = 'non-existent-comp';

      mockSupabase.rpc.mockResolvedValue({
        data: [{
          success: false,
          new_version: null,
          conflict_detected: false,
          current_content: null,
          current_version: null,
          error_message: 'Component not found'
        }],
        error: null
      });

      await expect(
        manager.updateComponent(componentId, {}, 'text', 1, 'user-456')
      ).rejects.toThrow('Component not found');
    });
  });

  describe('Batch Updates with Transaction Semantics', () => {
    it('should update multiple components successfully', async () => {
      const batchOperations = [
        { component_id: 'comp-1', version: 1, position_index: 1.5 },
        { component_id: 'comp-2', version: 2, position_index: 2.5 }
      ];

      // Mock successful batch update
      mockSupabase.rpc.mockResolvedValue({
        data: [
          { success: true, component_id: 'comp-1', new_version: 2, conflict_detected: false },
          { success: true, component_id: 'comp-2', new_version: 3, conflict_detected: false }
        ],
        error: null
      });

      const results = await manager.updateMultipleComponents(batchOperations);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[0].component_id).toBe('comp-1');
      expect(results[0].new_version).toBe(2);
      
      expect(results[1].success).toBe(true);
      expect(results[1].component_id).toBe('comp-2');
      expect(results[1].new_version).toBe(3);
    });

    it('should rollback entire batch on first conflict', async () => {
      const batchOperations = [
        { component_id: 'comp-1', version: 1, position_index: 1.5 },
        { component_id: 'comp-2', version: 2, position_index: 2.5 }
      ];

      const conflictContent = { type: 'doc', content: [{ type: 'text', text: 'Conflicted' }] };

      // Mock batch conflict (first component fails, rollback entire transaction)
      mockSupabase.rpc.mockResolvedValue({
        data: [{
          success: false,
          component_id: 'comp-1',
          new_version: null,
          conflict_detected: true,
          current_content: conflictContent,
          current_version: 3,
          error_message: 'Version conflict detected'
        }],
        error: null
      });

      await expect(
        manager.updateMultipleComponents(batchOperations)
      ).rejects.toThrow(OptimisticLockError);

      try {
        await manager.updateMultipleComponents(batchOperations);
      } catch (error) {
        expect(error).toBeInstanceOf(OptimisticLockError);
        expect((error as OptimisticLockError).componentId).toBe('comp-1');
        expect((error as OptimisticLockError).currentContent).toEqual(conflictContent);
      }
    });
  });

  describe('Version Management', () => {
    it('should get current component version', async () => {
      const componentId = 'comp-123';
      const currentVersion = 5;

      mockSupabase.rpc.mockResolvedValue({
        data: currentVersion,
        error: null
      });

      const version = await manager.getCurrentVersion(componentId);

      expect(version).toBe(currentVersion);
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'get_script_component_version',
        { p_component_id: componentId }
      );
    });

    it('should return 0 for non-existent component version', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 0,
        error: null
      });

      const version = await manager.getCurrentVersion('non-existent');
      expect(version).toBe(0);
    });
  });

  describe('Performance Metrics', () => {
    it('should track operation latency', async () => {
      const startTime = Date.now();
      
      mockSupabase.rpc.mockResolvedValue({
        data: [{ success: true, new_version: 2, conflict_detected: false }],
        error: null
      });

      await manager.updateComponent('comp-123', {}, 'text', 1, 'user-456');

      const metrics = manager.getMetrics();
      
      expect(metrics.totalOperations).toBe(1);
      expect(metrics.successfulOperations).toBe(1);
      expect(metrics.conflictCount).toBe(0);
      expect(metrics.averageLatency).toBeGreaterThan(0);
    });

    it('should track conflict metrics', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{
          success: false,
          conflict_detected: true,
          current_content: {},
          current_version: 2,
          error_message: 'Version conflict detected'
        }],
        error: null
      });

      try {
        await manager.updateComponent('comp-123', {}, 'text', 1, 'user-456');
      } catch (error) {
        // Expected OptimisticLockError
      }

      const metrics = manager.getMetrics();
      
      expect(metrics.totalOperations).toBe(1);
      expect(metrics.successfulOperations).toBe(0);
      expect(metrics.conflictCount).toBe(1);
    });

    it('should meet P95 latency target of 500ms', async () => {
      // Simulate multiple operations
      mockSupabase.rpc.mockResolvedValue({
        data: [{ success: true, new_version: 2, conflict_detected: false }],
        error: null
      });

      // Run 20 operations to get meaningful P95
      const operations = Array.from({ length: 20 }, (_, i) => 
        manager.updateComponent(`comp-${i}`, {}, 'text', 1, 'user-456')
      );

      await Promise.all(operations);

      const metrics = manager.getMetrics();
      
      expect(metrics.p95Latency).toBeLessThanOrEqual(500); // Critical performance requirement
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: new Error('Database connection failed')
      });

      await expect(
        manager.updateComponent('comp-123', {}, 'text', 1, 'user-456')
      ).rejects.toThrow('Database connection failed');
    });

    it('should validate input parameters', async () => {
      await expect(
        manager.updateComponent('', {}, 'text', 1, 'user-456')
      ).rejects.toThrow('Component ID is required');

      await expect(
        manager.updateComponent('comp-123', {}, 'text', 0, 'user-456')
      ).rejects.toThrow('Valid version number is required');

      await expect(
        manager.updateComponent('comp-123', {}, 'text', 1, '')
      ).rejects.toThrow('User ID is required');
    });
  });
});