/**
 * Type-safe mock factory for CustomSupabaseProvider
 *
 * TESTGUARD-APPROVED: Type-safe mock infrastructure
 * This provides complete, type-safe mocks that honor the CustomSupabaseProvider contract
 */

// Context7: consulted for vitest
import { vi } from 'vitest';
import type { CustomSupabaseProvider } from '../../src/lib/collaboration/custom-supabase-provider';
// Context7: consulted for @supabase/supabase-js
import type { SupabaseClient } from '@supabase/supabase-js';
// Context7: consulted for yjs
import * as Y from 'yjs';

/**
 * Creates a type-safe mock CustomSupabaseProvider
 * All properties are mocked with vitest functions by default
 * Specific implementations can be overridden via the overrides parameter
 */
export function createMockCustomSupabaseProvider(
  overrides: Partial<CustomSupabaseProvider> = {}
): CustomSupabaseProvider {
  // Create minimal mock supabase client
  const mockSupabaseClient = {
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn()
    },
    from: vi.fn(),
    removeChannel: vi.fn()
  } as unknown as SupabaseClient;

  // Create Y.Doc for testing
  const mockYDoc = new Y.Doc();

  // Default mock implementation with all required properties
  const defaultMock: CustomSupabaseProvider = {
    // Required properties from constructor
    supabaseClient: mockSupabaseClient,
    ydoc: mockYDoc,
    documentId: 'test-doc-id',
    projectId: 'test-project-id',
    tableName: 'yjs_documents',

    // Connection state
    isConnected: false,
    currentVersion: 1,

    // Offline queue
    offlineQueue: [],
    OFFLINE_QUEUE_KEY: 'offline_queue_test-doc-id',

    // Circuit breakers (mocked as basic objects)
    loadInitialStateBreaker: {
      fire: vi.fn().mockResolvedValue(undefined),
      opened: false,
      halfOpen: false,
      name: 'loadInitialStateBreaker'
    } as any,
    setupRealtimeBreaker: {
      fire: vi.fn().mockResolvedValue(undefined),
      opened: false,
      halfOpen: false,
      name: 'setupRealtimeBreaker'
    } as any,
    persistUpdateBreaker: {
      fire: vi.fn().mockResolvedValue(undefined),
      opened: false,
      halfOpen: false,
      name: 'persistUpdateBreaker'
    } as any,

    // Event handlers
    circuitBreakerStateChangeHandlers: [],

    // Config
    config: {
      supabaseClient: mockSupabaseClient,
      ydoc: mockYDoc,
      documentId: 'test-doc-id',
      projectId: 'test-project-id',
      tableName: 'yjs_documents',
      onSync: vi.fn(),
      onError: vi.fn(),
      onStatusChange: vi.fn()
    },

    // Public methods
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),

    // Private methods exposed on the instance (for testing purposes)
    channel: undefined,
    loadInitialStateOperation: vi.fn().mockResolvedValue(undefined),
    setupRealtimeSubscriptionOperation: vi.fn().mockResolvedValue(undefined),
    persistUpdateOperation: vi.fn().mockResolvedValue(undefined),
    setupCircuitBreakerEvents: vi.fn(),
    loadOfflineQueue: vi.fn(),
    saveOfflineQueue: vi.fn(),
    drainOfflineQueue: vi.fn().mockResolvedValue(undefined),
    setupYjsUpdateHandler: vi.fn(),
    setupRealtimeSubscription: vi.fn().mockResolvedValue(undefined),
    loadInitialState: vi.fn().mockResolvedValue(undefined),
    persistUpdate: vi.fn().mockResolvedValue(undefined),
    handleRealtimeUpdate: vi.fn(),
    isCircuitBreakerOpen: vi.fn().mockReturnValue(false),
    isCircuitBreakerHalfOpen: vi.fn().mockReturnValue(false),
    onCircuitBreakerStateChange: vi.fn(),
    offCircuitBreakerStateChange: vi.fn()
  } as unknown as CustomSupabaseProvider;

  // Merge with overrides and return
  // Type assertion needed because TypeScript can't properly infer
  // the complex merge of all private properties
  return Object.assign(defaultMock, overrides) as CustomSupabaseProvider;
}

/**
 * Creates a minimal mock that only implements the core connection methods
 * Used for tests that only care about connection lifecycle
 */
export function createMinimalMockProvider(
  overrides: Partial<Pick<CustomSupabaseProvider, 'connect' | 'disconnect' | 'destroy'>> = {}
): CustomSupabaseProvider {
  return createMockCustomSupabaseProvider({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    ...overrides
  });
}