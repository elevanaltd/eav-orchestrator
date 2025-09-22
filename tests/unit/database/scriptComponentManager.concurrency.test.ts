/**
 * Concurrency tests for ScriptComponentManager to verify race condition fixes
 * Tests multiple concurrent component creation scenarios
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScriptComponentManager } from '../../../src/lib/database/scriptComponentManager';

describe('ScriptComponentManager - Concurrency Tests', () => {
  let manager: ScriptComponentManager;
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      rpc: vi.fn(),
      from: vi.fn()
    };
    manager = new ScriptComponentManager(mockSupabase);
  });

  describe('Concurrent Component Creation', () => {
    it('should handle multiple simultaneous component creation without position conflicts', async () => {
      // Critical-Engineer: consulted for Database concurrency control - testing race condition fix
      const scriptId = 'script-123';

      // Create separate mock functions that capture unique data for each call
      const mockRpcData = [
        { id: 'comp-1', position: 2000.0, created_at: '2025-09-22T10:00:01.000Z' },
        { id: 'comp-2', position: 3000.0, created_at: '2025-09-22T10:00:02.000Z' },
        { id: 'comp-3', position: 4000.0, created_at: '2025-09-22T10:00:03.000Z' },
        { id: 'comp-4', position: 5000.0, created_at: '2025-09-22T10:00:04.000Z' },
        { id: 'comp-5', position: 6000.0, created_at: '2025-09-22T10:00:05.000Z' }
      ];

      let callIndex = 0;

      // Mock the atomic RPC to return unique positions
      mockSupabase.rpc.mockImplementation((funcName: string) => {
        if (funcName === 'create_component_with_position') {
          const data = mockRpcData[callIndex];
          callIndex++;
          return Promise.resolve({
            data: [data],
            error: null
          });
        }
        return { data: null, error: null };
      });

      let fetchCallIndex = 0;

      // Mock the subsequent fetch calls
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => {
              const data = mockRpcData[fetchCallIndex];
              fetchCallIndex++;
              return Promise.resolve({
                data: {
                  component_id: data.id,
                  script_id: scriptId,
                  content_tiptap: { type: 'doc', content: [] },
                  content_plain: '',
                  position: data.position,
                  component_type: 'main',
                  component_status: 'created',
                  version: 1,
                  created_at: data.created_at,
                  updated_at: data.created_at,
                  last_edited_by: 'user-123',
                  last_edited_at: data.created_at
                },
                error: null
              });
            })
          })
        })
      }));

      // Act - Create multiple components simultaneously
      const promises = Array.from({ length: 5 }, (_, index) =>
        manager.createComponent(
          scriptId,
          { type: 'doc', content: [{ type: 'text', text: `Component ${index + 1}` }] },
          `Component ${index + 1}`,
          'user-123'
        )
      );

      // Wait for all promises to complete
      const results = await Promise.all(promises);

      // Assert - All components should be created successfully
      expect(results).toHaveLength(5);

      // Each component should have a unique position
      const positions = results.map(r => r.position);
      const uniquePositions = new Set(positions);
      expect(uniquePositions.size).toBe(5); // All positions should be unique

      // Verify the atomic RPC was called for each component
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(5);

      // Each call should be to the atomic function
      for (let i = 1; i <= 5; i++) {
        expect(mockSupabase.rpc).toHaveBeenNthCalledWith(i, 'create_component_with_position', {
          p_script_id: scriptId,
          p_content_tiptap: { type: 'doc', content: [{ type: 'text', text: `Component ${i}` }] },
          p_content_plain: `Component ${i}`,
          p_component_status: 'created',
          p_last_edited_by: 'user-123',
          p_position: null
        });
      }
    });

    it('should handle RPC errors gracefully during concurrent creation', async () => {
      const scriptId = 'script-123';

      // Mock RPC to fail
      mockSupabase.rpc.mockImplementation(() => ({
        data: null,
        error: { message: 'Database connection failed' }
      }));

      // Act & Assert
      await expect(
        manager.createComponent(
          scriptId,
          { type: 'doc', content: [] },
          '',
          'user-123'
        )
      ).rejects.toThrow('Failed to create component: Database connection failed');
    });

    it('should fall back to positioned insert when explicit position provided', async () => {
      const scriptId = 'script-123';
      const explicitPosition = 500.0;

      // Mock traditional insert for positioned components
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                component_id: 'comp-positioned',
                script_id: scriptId,
                content_tiptap: { type: 'doc', content: [] },
                content_plain: '',
                position: explicitPosition,
                component_type: 'main',
                component_status: 'created',
                version: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                last_edited_by: 'user-123',
                last_edited_at: new Date().toISOString()
              },
              error: null
            })
          })
        })
      });

      // Act
      const result = await manager.createComponent(
        scriptId,
        { type: 'doc', content: [] },
        '',
        'user-123',
        explicitPosition, // Explicit position provided
        'created'
      );

      // Assert - Should use traditional insert, not atomic RPC
      expect(mockSupabase.rpc).not.toHaveBeenCalled();
      expect(result.position).toBe(explicitPosition);
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain performance with many concurrent operations', async () => {
      const scriptId = 'script-load-test';
      const operationCount = 10; // Reduced for test reliability

      // Generate mock data for load test
      const mockLoadTestData = Array.from({ length: operationCount }, (_, index) => ({
        id: `comp-load-${index + 1}`,
        position: (index + 1) * 1000,
        created_at: new Date(Date.now() + index * 100).toISOString()
      }));

      let rpcCallIndex = 0;
      let fetchCallIndex = 0;

      // Mock fast atomic responses
      mockSupabase.rpc.mockImplementation((funcName: string) => {
        if (funcName === 'create_component_with_position') {
          const data = mockLoadTestData[rpcCallIndex];
          rpcCallIndex++;
          return Promise.resolve({
            data: [data],
            error: null
          });
        }
        return { data: null, error: null };
      });

      // Mock fast fetch responses
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => {
              const data = mockLoadTestData[fetchCallIndex];
              fetchCallIndex++;
              return Promise.resolve({
                data: {
                  component_id: data.id,
                  script_id: scriptId,
                  content_tiptap: { type: 'doc', content: [] },
                  content_plain: '',
                  position: data.position,
                  component_type: 'main',
                  component_status: 'created',
                  version: 1,
                  created_at: data.created_at,
                  updated_at: data.created_at,
                  last_edited_by: 'user-123',
                  last_edited_at: data.created_at
                },
                error: null
              });
            })
          })
        })
      }));

      // Act - Measure execution time
      const startTime = Date.now();

      const promises = Array.from({ length: operationCount }, (_, index) =>
        manager.createComponent(
          scriptId,
          { type: 'doc', content: [] },
          `Load test component ${index}`,
          'user-123'
        )
      );

      const results = await Promise.all(promises);
      const executionTime = Date.now() - startTime;

      // Assert - All operations should complete successfully
      expect(results).toHaveLength(operationCount);
      expect(executionTime).toBeLessThan(5000); // Should complete in under 5 seconds

      // All positions should be unique
      const positions = results.map(r => r.position);
      const uniquePositions = new Set(positions);
      expect(uniquePositions.size).toBe(operationCount);

      console.log(`✅ Concurrent operations completed in ${executionTime}ms`);
    });
  });
});