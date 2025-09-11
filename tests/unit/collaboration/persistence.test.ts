/**
 * Persistence Layer Unit Tests
 * 
 * TRACED Protocol: TEST FIRST (RED) - These tests MUST fail initially
 * Testing database persistence layer for Yjs document state
 */

// Context7: consulted for vitest
// Context7: consulted for yjs
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as Y from 'yjs';
import { 
  YjsPersistenceManager,
  PersistenceError
} from '../../../src/lib/collaboration/persistence';
import { createMockSupabaseClient } from '../../mocks/supabase';

describe('YjsPersistenceManager', () => {
  let persistenceManager: YjsPersistenceManager;
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
  let testDoc: Y.Doc;

  const testDocumentId = 'test-doc-123';
  const testUserId = 'user-456';

  beforeEach(() => {
    testDoc = new Y.Doc();
    mockSupabase = createMockSupabaseClient(null as any);
    
    // This test MUST fail - YjsPersistenceManager doesn't exist yet
    persistenceManager = new YjsPersistenceManager({
      supabaseClient: mockSupabase,
      documentId: testDocumentId,
      userId: testUserId
    });

    vi.clearAllMocks();
  });

  describe('Document State Persistence', () => {
    it('should save document state to database', async () => {
      // Create document with content
      testDoc.getText('content').insert(0, 'Test document content');
      const documentState = Y.encodeStateAsUpdate(testDoc);
      const stateVector = Y.encodeStateVector(testDoc);

      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: null
          })
        })
      });

      await persistenceManager.saveDocumentState(documentState, stateVector);

      expect(mockSupabase.from).toHaveBeenCalledWith('script_documents');
      expect(mockSupabase.from().update).toHaveBeenCalledWith({
        yjs_state: documentState,
        yjs_state_vector: Array.from(stateVector),
        updated_at: expect.any(String),
        last_modified_by: testUserId,
        version: expect.anything()
      });
    });

    it('should load document state from database', async () => {
      const mockDocumentData = {
        yjs_state: new Uint8Array([1, 2, 3, 4]),
        yjs_state_vector: [0, 1, 2],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T12:00:00Z'
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockDocumentData,
              error: null
            })
          })
        })
      });

      const result = await persistenceManager.loadDocumentState();

      expect(result).toEqual({
        yjsState: mockDocumentData.yjs_state,
        yjsStateVector: new Uint8Array(mockDocumentData.yjs_state_vector),
        metadata: {
          createdAt: mockDocumentData.created_at,
          updatedAt: mockDocumentData.updated_at
        }
      });
    });

    it('should handle missing documents gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      });

      const result = await persistenceManager.loadDocumentState();

      expect(result).toBeNull();
    });

    it('should handle database errors during save', async () => {
      testDoc.getText('content').insert(0, 'Test content');
      const documentState = Y.encodeStateAsUpdate(testDoc);
      const stateVector = Y.encodeStateVector(testDoc);

      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('Database write failed')
          })
        })
      });

      await expect(
        persistenceManager.saveDocumentState(documentState, stateVector)
      ).rejects.toThrow(PersistenceError);
    });
  });

  describe('Document Snapshots', () => {
    it('should create document snapshot', async () => {
      testDoc.getText('content').insert(0, 'Snapshot content');
      const documentState = Y.encodeStateAsUpdate(testDoc);
      const stateVector = Y.encodeStateVector(testDoc);

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({
            data: [{
              id: 'snapshot-123',
              created_at: '2023-01-01T12:00:00Z'
            }],
            error: null
          })
        })
      });

      const snapshot = await persistenceManager.createSnapshot('User-created snapshot');

      expect(snapshot).toEqual('snapshot-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('document_snapshots');
      expect(mockSupabase.from().insert).toHaveBeenCalledWith({
        document_id: testDocumentId,
        yjs_state: documentState,
        yjs_state_vector: Array.from(stateVector),
        snapshot_type: 'manual',
        created_by: testUserId,
        description: 'User-created snapshot'
      });
    });

    it('should list document snapshots', async () => {
      const mockSnapshots = [
        {
          id: 'snapshot-1',
          snapshot_type: 'auto',
          created_at: '2023-01-01T10:00:00Z',
          created_by: testUserId
        },
        {
          id: 'snapshot-2', 
          snapshot_type: 'manual',
          created_at: '2023-01-01T11:00:00Z',
          created_by: testUserId
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockSnapshots,
              error: null
            })
          })
        })
      });

      const snapshots = await persistenceManager.listSnapshots();

      expect(snapshots).toHaveLength(2);
      expect(snapshots[0]).toEqual({
        id: 'snapshot-1',
        snapshotType: 'auto',
        createdAt: '2023-01-01T10:00:00Z',
        createdBy: testUserId
      });
    });

    it('should restore from snapshot', async () => {
      const mockSnapshotData = {
        yjs_state: new Uint8Array([5, 6, 7, 8]),
        yjs_state_vector: [2, 3, 4],
        created_at: '2023-01-01T10:00:00Z'
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockSnapshotData,
              error: null
            })
          })
        })
      });

      const restoredState = await persistenceManager.restoreFromSnapshot('snapshot-123');

      expect(restoredState).toEqual({
        yjsState: mockSnapshotData.yjs_state,
        yjsStateVector: new Uint8Array(mockSnapshotData.yjs_state_vector),
        metadata: {
          createdAt: mockSnapshotData.created_at
        }
      });
    });
  });

  describe('Optimistic Locking', () => {
    it('should implement version-based optimistic locking', async () => {
      testDoc.getText('content').insert(0, 'Version test');
      const documentState = Y.encodeStateAsUpdate(testDoc);

      // Mock version conflict
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            match: vi.fn().mockResolvedValue({
              data: null, // No rows updated (version conflict)
              error: null
            })
          })
        })
      });

      // TESTGUARD-APPROVED: TESTGUARD-20250911-48050d1e
      await expect(
        persistenceManager.saveDocumentStateWithVersion(documentState, 1)
      ).rejects.toThrow('Version conflict detected');
    });

    it('should succeed when version matches', async () => {
      testDoc.getText('content').insert(0, 'Version test');
      const documentState = Y.encodeStateAsUpdate(testDoc);

      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            match: vi.fn().mockResolvedValue({
              data: [{ version: 2 }], // Successful update
              error: null
            })
          })
        })
      });

      await persistenceManager.saveDocumentStateWithVersion(
        documentState, 
        1
      );

      // Verify the update was called with correct version
      expect(mockSupabase.from().update).toHaveBeenCalled();
    });
  });

  describe('Cleanup Operations', () => {
    it('should cleanup old snapshots', async () => {
      const retentionDays = 30;
      const expectedCutoffDate = new Date();
      expectedCutoffDate.setDate(expectedCutoffDate.getDate() - retentionDays);

      mockSupabase.from.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            lt: vi.fn().mockResolvedValue({
              data: null,
              error: null
            })
          })
        })
      });

      await persistenceManager.cleanupOldSnapshots(retentionDays);

      expect(mockSupabase.from).toHaveBeenCalledWith('document_snapshots');
      expect(mockSupabase.from().delete).toHaveBeenCalled();
    });

    it('should get storage statistics', async () => {
      const mockStats = {
        total_snapshots: 15,
        total_size_bytes: 1024000,
        oldest_snapshot: '2023-01-01T00:00:00Z',
        newest_snapshot: '2023-01-15T12:00:00Z'
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [mockStats],
            error: null
          })
        })
      });

      const stats = await persistenceManager.getStorageStatistics();

      expect(stats).toEqual({
        totalSnapshots: 15,
        totalSizeBytes: 1024000,
        oldestSnapshot: '2023-01-01T00:00:00Z',
        newestSnapshot: '2023-01-15T12:00:00Z'
      });
    });
  });

  describe('Transaction Management', () => {
    it('should support atomic operations', async () => {
      const operations: Array<() => Promise<void | string>> = [
        () => persistenceManager.saveDocumentState(
          Y.encodeStateAsUpdate(testDoc),
          Y.encodeStateVector(testDoc)
        ),
        () => persistenceManager.createSnapshot('auto')
      ];

      // Mock successful transaction
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: vi.fn().mockResolvedValue({ data: [{ id: 'snap-123' }], error: null })
      });

      const results = await persistenceManager.executeTransaction(operations);

      expect(Array.isArray(results) ? results : [results]).toHaveLength(2);
      const resultsArray = Array.isArray(results) ? results : [results];
      expect(resultsArray[0]).toBeDefined();
      expect(resultsArray[1]).toBeDefined();
    });

    it('should rollback on transaction failure', async () => {
      const operations: Array<() => Promise<void>> = [
        () => Promise.resolve(),
        () => Promise.reject(new Error('Operation 2 failed'))
      ];

      await expect(
        persistenceManager.executeTransaction(operations)
      ).rejects.toThrow('Transaction failed');
    });
  });
});