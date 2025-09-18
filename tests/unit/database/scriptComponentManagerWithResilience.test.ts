/**
 * Tests for ScriptComponentManager with Circuit Breaker Resilience
 *
 * TRACED Protocol: TEST FIRST (RED) - These tests MUST fail initially
 * Technical Architect: Testing resilience patterns for CRUD operations
 */

// Context7: consulted for vitest
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Context7: consulted for @supabase/supabase-js
import { SupabaseClient } from '@supabase/supabase-js';
import { ResilientScriptComponentManager } from '../../../src/lib/database/scriptComponentManagerWithResilience';
import { createMockSupabaseClient, createMockChannel } from '../../mocks/supabase';

describe('ResilientScriptComponentManager', () => {
  let manager: ResilientScriptComponentManager;
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    const mockChannel = createMockChannel();
    mockSupabase = createMockSupabaseClient(mockChannel);
    manager = new ResilientScriptComponentManager(mockSupabase as unknown as SupabaseClient);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Circuit Breaker Protection', () => {
    it('should handle database failures gracefully', async () => {
      // Simulate database error
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockRejectedValue(new Error('Database connection failed'))
              })
            })
          })
        })
      });

      const result = await manager.deleteComponent('component-123', 'user-456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Database connection failed');
    });

    it('should open circuit after threshold failures', async () => {
      // Mock repeated failures to trigger circuit opening
      const failureError = new Error('Connection timeout');

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              is: vi.fn().mockRejectedValue(failureError)
            })
          })
        })
      });

      // Trigger multiple failures
      for (let i = 0; i < 6; i++) {
        await manager.getComponentsByScriptId('script-123');
      }

      // Next call should return fallback immediately (circuit open)
      const start = Date.now();
      const result = await manager.getComponentsByScriptId('script-123');
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // Should be instant fallback
      expect(result.error).toContain('Service temporarily unavailable');
    });

    it('should queue operations when circuit is open', async () => {
      // Force circuit to open
      manager.openCircuitBreaker('delete');

      const result = await manager.deleteComponent('component-123', 'user-456');

      expect(result.success).toBe(false);
      expect((result as any).queued).toBe(true);
      expect(manager.getOfflineQueueSize()).toBeGreaterThan(0);
    });

    it('should process queued operations when circuit closes', async () => {
      // Queue an operation
      manager.openCircuitBreaker('create');
      await manager.createComponent('script-123', {}, '', 'user-456', undefined, 'created');

      expect(manager.getOfflineQueueSize()).toBe(1);

      // Mock successful operation
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { component_id: 'new-component' },
              error: null
            })
          })
        })
      });

      // Close circuit and wait for queue processing
      manager.closeCircuitBreaker('create');
      await new Promise(resolve => setTimeout(resolve, 100));

      // Queue should be processed
      expect(manager.getOfflineQueueSize()).toBe(0);
    });
  });

  describe('CRUD Operations', () => {
    describe('deleteComponent', () => {
      it('should soft delete a component successfully', async () => {
        const mockDeletedAt = new Date().toISOString();

        mockSupabase.from.mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      component_id: 'component-123',
                      deleted_at: mockDeletedAt
                    },
                    error: null
                  })
                })
              })
            })
          })
        });

        const result = await manager.deleteComponent('component-123', 'user-456', 'No longer needed');

        expect(result.success).toBe(true);
        expect(result.deletedAt).toBe(mockDeletedAt);
        expect(result.error).toBeUndefined();
      });

      it('should handle deletion of non-existent component', async () => {
        mockSupabase.from.mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'PGRST116', message: 'Not found' }
                  })
                })
              })
            })
          })
        });

        const result = await manager.deleteComponent('non-existent', 'user-456');

        expect(result.success).toBe(false);
        expect(result.error).toContain('not found');
      });
    });

    describe('restoreComponent', () => {
      it('should restore a soft-deleted component', async () => {
        mockSupabase.from.mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              not: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      component_id: 'component-123',
                      updated_at: new Date().toISOString()
                    },
                    error: null
                  })
                })
              })
            })
          })
        });

        const result = await manager.restoreComponent('component-123', 'user-456');

        expect(result.success).toBe(true);
        expect(result.restoredAt).toBeDefined();
      });
    });

    describe('getComponentsByScriptId', () => {
      it('should fetch all components for a script', async () => {
        const mockComponents = [
          { component_id: 'comp-1', position: 1000 },
          { component_id: 'comp-2', position: 2000 }
        ];

        mockSupabase.from.mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({
                  data: mockComponents,
                  error: null
                })
              })
            })
          })
        });

        const result = await manager.getComponentsByScriptId('script-123');

        expect(result.components).toHaveLength(2);
        expect(result.components[0].component_id).toBe('comp-1');
        expect(result.error).toBeUndefined();
      });

      it('should include deleted components when requested', async () => {
        const mockComponents = [
          { component_id: 'comp-1', deleted_at: null },
          { component_id: 'comp-2', deleted_at: '2025-09-17' }
        ];

        mockSupabase.from.mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockComponents,
                error: null
              })
            })
          })
        });

        const result = await manager.getComponentsByScriptId('script-123', true);

        expect(result.components).toHaveLength(2);
      });
    });

    describe('getComponentById', () => {
      it('should fetch a single component by ID', async () => {
        const mockComponent = {
          component_id: 'comp-123',
          content_tiptap: { type: 'doc', content: [] },
          position: 1000
        };

        mockSupabase.from.mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockComponent,
                  error: null
                })
              })
            })
          })
        });

        const result = await manager.getComponentById('comp-123');

        expect(result).not.toBeNull();
        expect(result?.component).toBeDefined();
        expect(result?.component?.component_id).toBe('comp-123');
      });
    });

    describe('bulkDeleteComponents', () => {
      it('should delete multiple components', async () => {
        const componentIds = ['comp-1', 'comp-2', 'comp-3'];

        mockSupabase.from.mockReturnValue({
          update: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                select: vi.fn().mockResolvedValue({
                  data: [
                    { component_id: 'comp-1' },
                    { component_id: 'comp-2' }
                  ],
                  error: null
                })
              })
            })
          })
        });

        const result = await manager.bulkDeleteComponents(componentIds, 'user-456');

        expect(result.success).toBe(true);
        expect(result.deletedCount).toBe(2);
        expect(result.failedIds).toContain('comp-3');
      });
    });

    describe('updateComponentPositions', () => {
      it('should update positions for reordering', async () => {
        const updates = [
          { componentId: 'comp-1', position: 500 },
          { componentId: 'comp-2', position: 1500 }
        ];

        mockSupabase.from.mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({
                data: {},
                error: null
              })
            })
          })
        });

        const result = await manager.updateComponentPositions(updates);

        expect(result.success).toBe(true);
        expect(result.updatedCount).toBe(2);
      });
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should track circuit breaker statistics', () => {
      const stats = manager.getCircuitBreakerStats();

      expect(stats).toBeInstanceOf(Map);
      expect(stats.has('create')).toBe(true);
      expect(stats.has('update')).toBe(true);
      expect(stats.has('delete')).toBe(true);
    });

    it('should get optimistic locking metrics', () => {
      const metrics = manager.getMetrics();

      expect(metrics).toHaveProperty('totalOperations');
      expect(metrics).toHaveProperty('successfulOperations');
      expect(metrics).toHaveProperty('conflictCount');
      expect(metrics).toHaveProperty('averageLatency');
    });

    it('should reset all metrics', () => {
      manager.resetMetrics();
      const metrics = manager.getMetrics();

      expect(metrics.totalOperations).toBe(0);
      expect(metrics.successfulOperations).toBe(0);
      expect(metrics.conflictCount).toBe(0);
    });
  });

  describe('Offline Queue Management', () => {
    it('should limit offline queue size', async () => {
      manager.openCircuitBreaker('create');

      // Try to queue more than MAX_OFFLINE_QUEUE_SIZE operations
      for (let i = 0; i < 150; i++) {
        await manager.createComponent(`script-${i}`, {}, '', 'user-456', undefined, 'created');
      }

      expect(manager.getOfflineQueueSize()).toBeLessThanOrEqual(100);
    });

    it('should clear offline queue on demand', async () => {
      manager.openCircuitBreaker('delete');

      await manager.deleteComponent('comp-1', 'user-456');
      await manager.deleteComponent('comp-2', 'user-456');

      expect(manager.getOfflineQueueSize()).toBeGreaterThan(0);

      manager.clearOfflineQueue();

      expect(manager.getOfflineQueueSize()).toBe(0);
    });
  });
});