/**
 * YjsSupabaseProvider Unit Tests
 * 
 * TRACED Protocol: TEST FIRST (RED) - These tests MUST fail initially
 * Testing core Yjs + Supabase CRDT collaboration provider
 */

// Context7: consulted for yjs
// Context7: consulted for vitest
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { YjsSupabaseProvider } from '../../../src/lib/collaboration/YjsSupabaseProvider';
import { createMockSupabaseClient, createMockChannel } from '../../mocks/supabase';

describe('YjsSupabaseProvider', () => {
  let doc: Y.Doc;
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
  let mockChannel: ReturnType<typeof createMockChannel>;
  let provider: YjsSupabaseProvider;

  const mockConfig = {
    supabaseClient: null as any,
    documentId: 'test-document-id',
    userId: 'test-user-id',
    onSync: vi.fn(),
    onError: vi.fn()
  };

  beforeEach(() => {
    // Create fresh Yjs document
    doc = new Y.Doc();
    
    // Create mock Supabase client and channel
    mockChannel = createMockChannel();
    mockSupabase = createMockSupabaseClient(mockChannel);
    mockConfig.supabaseClient = mockSupabase;
    
    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    provider?.destroy();
    doc.destroy();
  });

  describe('Initialization', () => {
    it('should initialize with document and connect to channel', async () => {
      // This test MUST fail - YjsSupabaseProvider doesn't exist yet
      provider = new YjsSupabaseProvider(doc, mockConfig);
      
      expect(provider).toBeDefined();
      expect(mockSupabase.channel).toHaveBeenCalledWith('document:test-document-id');
      expect(mockChannel.on).toHaveBeenCalledWith(
        'broadcast', 
        { event: 'yjs-update' }, 
        expect.any(Function)
      );
    });

    it('should set up awareness for presence tracking', () => {
      provider = new YjsSupabaseProvider(doc, mockConfig);
      
      expect(provider.awareness).toBeDefined();
      expect(provider.awareness.doc).toBe(doc);
    });

    it('should load initial document state from database', async () => {
      const mockDocumentData = {
        yjs_state: new Uint8Array([1, 2, 3, 4]),
        yjs_state_vector: [0, 1, 2]
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

      provider = new YjsSupabaseProvider(doc, mockConfig);
      
      await new Promise(resolve => setTimeout(resolve, 100)); // Allow async init
      
      expect(mockSupabase.from).toHaveBeenCalledWith('script_documents');
      expect(mockConfig.onSync).toHaveBeenCalledWith();
    });
  });

  describe('Binary Update Broadcasting', () => {
    beforeEach(() => {
      provider = new YjsSupabaseProvider(doc, mockConfig);
    });

    it('should broadcast local document updates as base64 binary', async () => {
      // Make a local change to the document
      const text = doc.getText('content');
      text.insert(0, 'Hello World');

      // Allow event processing
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'yjs-update',
        payload: {
          update: expect.any(String), // base64 encoded binary
          userId: 'test-user-id',
          timestamp: expect.any(Number)
        }
      });
    });

    it('should not rebroadcast updates that came from remote', async () => {
      const remoteDoc = new Y.Doc();
      remoteDoc.getText('content').insert(0, 'Remote content');
      const remoteUpdate = Y.encodeStateAsUpdate(remoteDoc);
      
      // Simulate receiving remote update
      const base64Update = btoa(String.fromCharCode(...remoteUpdate));
      const mockPayload = {
        update: base64Update,
        userId: 'remote-user-id',
        timestamp: Date.now()
      };

      provider.handleRemoteUpdate(mockPayload);

      // Should not trigger rebroadcast
      expect(mockChannel.send).not.toHaveBeenCalled();
    });

    it('should apply remote updates to local document', () => {
      const remoteDoc = new Y.Doc();
      remoteDoc.getText('content').insert(0, 'Remote content');
      const remoteUpdate = Y.encodeStateAsUpdate(remoteDoc);
      
      const base64Update = btoa(String.fromCharCode(...remoteUpdate));
      const mockPayload = {
        update: base64Update,
        userId: 'remote-user-id',
        timestamp: Date.now()
      };

      provider.handleRemoteUpdate(mockPayload);

      expect(doc.getText('content').toString()).toBe('Remote content');
    });
  });

  describe('Database Persistence', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      provider = new YjsSupabaseProvider(doc, mockConfig);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should debounce database saves', async () => {
      const text = doc.getText('content');
      
      // Make multiple rapid changes
      text.insert(0, 'H');
      text.insert(1, 'e');
      text.insert(2, 'l');
      text.insert(3, 'l');
      text.insert(4, 'o');

      // Verify save not called immediately
      expect(mockSupabase.from).not.toHaveBeenCalled();

      // Fast-forward debounce timer (1 second)
      vi.advanceTimersByTime(1000);

      // Verify save called once with combined state
      expect(mockSupabase.from).toHaveBeenCalledWith('script_documents');
      expect(mockSupabase.from().update).toHaveBeenCalledWith({
        yjs_state: expect.any(Uint8Array),
        yjs_state_vector: expect.any(Array),
        updated_at: expect.any(String),
        last_modified_by: 'test-user-id',
        version: expect.anything()
      });
    });

    it('should handle database save errors gracefully', async () => {
      const text = doc.getText('content');
      
      // Mock database error
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: new Error('Database connection failed')
          })
        })
      });

      text.insert(0, 'Test');
      vi.advanceTimersByTime(1000);

      expect(mockConfig.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Database connection failed'
        })
      );
    });
  });

  describe('Connection Management', () => {
    beforeEach(() => {
      provider = new YjsSupabaseProvider(doc, mockConfig);
    });

    it('should handle channel subscription success', () => {
      const subscribeCallback = mockChannel.subscribe.mock.calls[0][0];
      
      subscribeCallback('SUBSCRIBED');

      expect(mockChannel.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'broadcast',
          event: 'yjs-update'
        })
      );
    });

    it('should track presence and update user cursors', () => {
      const presenceState = {
        'user1': [{
          userId: 'user1',
          cursor: { line: 1, ch: 5 },
          selection: { from: 5, to: 10 },
          timestamp: Date.now()
        }]
      };

      mockChannel.presenceState.mockReturnValue(presenceState);

      provider.handlePresenceSync();

      expect(provider.awareness.getStates().has('user1')).toBe(true);
    });
  });

  describe('Error Handling and Recovery', () => {
    beforeEach(() => {
      provider = new YjsSupabaseProvider(doc, mockConfig);
    });

    it('should handle malformed binary updates', () => {
      const invalidPayload = {
        update: 'invalid-base64-content',
        userId: 'remote-user',
        timestamp: Date.now()
      };

      expect(() => {
        provider.handleRemoteUpdate(invalidPayload);
      }).not.toThrow();
      
      expect(mockConfig.onError).toHaveBeenCalled();
    });

    it('should recover from channel disconnection', async () => {
      // Simulate disconnection
      mockChannel.subscribe.mockResolvedValueOnce('CHANNEL_ERROR');

      const reconnectSpy = vi.spyOn(provider, 'reconnect');
      
      // Trigger reconnection logic
      provider.handleConnectionError();

      expect(reconnectSpy).toHaveBeenCalled();
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should cleanup resources on destroy', () => {
      provider = new YjsSupabaseProvider(doc, mockConfig);
      
      const awarenessDestroySpy = vi.spyOn(provider.awareness, 'destroy');
      
      provider.destroy();

      expect(mockChannel.unsubscribe).toHaveBeenCalled();
      expect(awarenessDestroySpy).toHaveBeenCalled();
    });

    it('should save final state before destroy', async () => {
      provider = new YjsSupabaseProvider(doc, mockConfig);
      
      // Make changes
      doc.getText('content').insert(0, 'Final content');
      
      provider.destroy();

      expect(mockSupabase.from).toHaveBeenCalledWith('script_documents');
    });
  });
});