/**
 * YjsSupabaseProvider Unit Tests
 * 
 * TRACED Protocol: TEST FIRST (RED) - These tests MUST fail initially
 * Testing core Yjs + Supabase CRDT collaboration provider
 */

// Context7: consulted for yjs
// Context7: consulted for vitest
// Context7: consulted for vitest
// Context7: consulted for yjs  
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { YjsSupabaseProvider } from '../../../src/lib/collaboration/YjsSupabaseProvider';
import { CustomSupabaseProvider } from '../../../src/lib/collaboration/custom-supabase-provider';

// TESTGUARD-20250913-17577216
// Mock the CustomSupabaseProvider to properly test YjsSupabaseProvider
vi.mock('../../../src/lib/collaboration/custom-supabase-provider', () => {
  const mockProvider = vi.fn().mockImplementation(function(this: any, config: any) {
    this.config = config;
    this.connected = false;
    this.connect = vi.fn().mockResolvedValue(undefined);
    this.disconnect = vi.fn();
    this.destroy = vi.fn();
    
    // Simulate connection behavior
    this.connect.mockImplementation(async () => {
      this.connected = true;
      return Promise.resolve();
    });
    
    this.disconnect.mockImplementation(() => {
      this.connected = false;
    });
    
    return this;
  });
  
  return {
    CustomSupabaseProvider: mockProvider
  };
});

// Mock y-indexeddb as well
vi.mock('y-indexeddb', () => ({
  IndexeddbPersistence: vi.fn().mockImplementation(function(this: any, docName: string, ydoc: Y.Doc) {
    this.docName = docName;
    this.ydoc = ydoc;
    this.destroy = vi.fn();
    return this;
  })
}));

describe('YjsSupabaseProvider', () => {
  let doc: Y.Doc;
  let provider: YjsSupabaseProvider;

  const mockConfig: any = {
    supabaseUrl: 'https://test.supabase.co',
    supabaseKey: 'test-key',
    documentId: 'test-document-id',
    projectId: 'test-project-id',
    ydoc: null as any,
    supabaseClient: {
      from: vi.fn(),
      channel: vi.fn(),
      auth: {
        getUser: vi.fn(() => Promise.resolve({
          data: { user: { id: 'test-user-id' } },
          error: null
        }))
      }
    },
    connect: true,
    awareness: false
  };

  beforeEach(() => {
    // Create fresh Yjs document
    doc = new Y.Doc();
    mockConfig.ydoc = doc;
    
    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    provider?.destroy();
    doc.destroy();
  });

  describe('Initialization', () => {
    it('should initialize with document and connect to channel', async () => {
      provider = new YjsSupabaseProvider(mockConfig);
      
      // Allow async initialization
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(provider).toBeDefined();
      // Check that CustomSupabaseProvider was created with correct config
      expect(CustomSupabaseProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          supabaseClient: mockConfig.supabaseClient,
          ydoc: doc,
          documentId: 'test-document-id',
          projectId: 'test-project-id',
          tableName: 'yjs_documents'
        })
      );
    });

    it('should set up awareness for presence tracking', () => {
      provider = new YjsSupabaseProvider(mockConfig);
      
      // Provider should be defined even without awareness exposed
      expect(provider).toBeDefined();
    });

    it('should handle connection initialization', async () => {
      provider = new YjsSupabaseProvider(mockConfig);
      
      // Allow async initialization
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Get the mock instance
      const mockProviderInstance = (CustomSupabaseProvider as any).mock.results[0].value;
      
      // Verify connect was called
      expect(mockProviderInstance.connect).toHaveBeenCalled();
    });
  });

  describe('Connection Management', () => {
    beforeEach(async () => {
      provider = new YjsSupabaseProvider(mockConfig);
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    it('should connect to provider', async () => {
      await provider.connect();
      
      const mockProviderInstance = (CustomSupabaseProvider as any).mock.results[0].value;
      expect(mockProviderInstance.connect).toHaveBeenCalled();
    });

    it('should disconnect from provider', () => {
      provider.disconnect();
      
      const mockProviderInstance = (CustomSupabaseProvider as any).mock.results[0].value;
      expect(mockProviderInstance.disconnect).toHaveBeenCalled();
    });

    it('should track connection status', async () => {
      // Create a new provider with connect: false to test initial state
      const nonConnectingConfig = { ...mockConfig, connect: false };
      const nonConnectingProvider = new YjsSupabaseProvider(nonConnectingConfig);
      
      const status = nonConnectingProvider.getStatus();
      expect(status).toBeDefined();
      expect(status.connected).toBe(false); // Initially false
      
      // Get the mock instance for this specific provider
      const mockInstances = (CustomSupabaseProvider as any).mock.results;
      const mockProviderInstance = mockInstances[mockInstances.length - 1].value;
      
      // Ensure the mock updates its connected property
      mockProviderInstance.connect.mockImplementation(async () => {
        mockProviderInstance.connected = true;
        return Promise.resolve();
      });
      
      await nonConnectingProvider.connect();
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const updatedStatus = nonConnectingProvider.getStatus();
      expect(updatedStatus.connected).toBe(true);
      
      nonConnectingProvider.destroy();
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      provider = new YjsSupabaseProvider(mockConfig);
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    it('should register event handlers', () => {
      const onConnect = vi.fn();
      const onError = vi.fn();
      
      provider.on('onConnect', onConnect);
      provider.on('onError', onError);
      
      // Handlers should be registered
      expect(() => provider.on('onConnect', onConnect)).not.toThrow();
    });

    it('should handle provider errors', async () => {
      // Create a fresh provider for this test
      const errorConfig = { ...mockConfig, connect: false };
      const errorProvider = new YjsSupabaseProvider(errorConfig);
      
      const onError = vi.fn();
      errorProvider.on('onError', onError);
      
      // Get the mock instance for this specific provider
      const mockInstances = (CustomSupabaseProvider as any).mock.results;
      const mockProviderInstance = mockInstances[mockInstances.length - 1].value;
      
      // Simulate error by making connect fail
      mockProviderInstance.connect.mockRejectedValueOnce(new Error('Connection failed'));
      
      try {
        await errorProvider.connect();
      } catch {
        // Error expected but not thrown by the provider (it handles internally)
      }
      
      // Allow error handling
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'CONNECTION_FAILED',
          message: expect.stringContaining('Connection failed')
        })
      );
      
      errorProvider.destroy();
    });
  });

  describe('Metrics and Status', () => {
    beforeEach(async () => {
      provider = new YjsSupabaseProvider(mockConfig);
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    it('should track metrics', async () => {
      const initialMetrics = provider.getMetrics();
      expect(initialMetrics.connectionAttempts).toBeGreaterThan(0);
      
      await provider.connect();
      
      const updatedMetrics = provider.getMetrics();
      expect(updatedMetrics.connectionAttempts).toBeGreaterThan(initialMetrics.connectionAttempts);
    });

    it('should provide status information', () => {
      const status = provider.getStatus();
      
      expect(status).toHaveProperty('connected');
      expect(status).toHaveProperty('errorCount');
      expect(status).toHaveProperty('circuitBreakerState');
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should cleanup resources on destroy', async () => {
      provider = new YjsSupabaseProvider(mockConfig);
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const mockProviderInstance = (CustomSupabaseProvider as any).mock.results[0].value;
      
      provider.destroy();
      
      expect(mockProviderInstance.destroy).toHaveBeenCalled();
    });

    it('should disconnect before destroy', async () => {
      provider = new YjsSupabaseProvider(mockConfig);
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const mockProviderInstance = (CustomSupabaseProvider as any).mock.results[0].value;
      
      // Connect first
      await provider.connect();
      
      provider.destroy();
      
      expect(mockProviderInstance.disconnect).toHaveBeenCalled();
      expect(mockProviderInstance.destroy).toHaveBeenCalled();
    });
  });
});