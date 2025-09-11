/**
 * Supabase Mock Utilities for Testing
 * 
 * TRACED Protocol: TEST FIRST (RED) - Mock utilities for failing tests
 * Creates comprehensive mocks for Supabase client and channel operations
 */

// Context7: consulted for vitest
// Vitest mock utilities (vi imported from vitest)
import { vi } from 'vitest';

export interface MockChannel {
  on: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
  track: ReturnType<typeof vi.fn>;
  presenceState: ReturnType<typeof vi.fn>;
}

export interface MockSupabaseClient {
  channel: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
  auth: {
    getUser: ReturnType<typeof vi.fn>;
  };
}

export function createMockChannel(): MockChannel {
  return {
    on: vi.fn().mockReturnThis(),
    send: vi.fn().mockResolvedValue({ status: 'ok' }),
    subscribe: vi.fn().mockImplementation((callback) => {
      // Simulate successful subscription
      callback('SUBSCRIBED');
      return Promise.resolve('SUBSCRIBED');
    }),
    unsubscribe: vi.fn().mockResolvedValue('ok'),
    track: vi.fn().mockResolvedValue('ok'),
    presenceState: vi.fn().mockReturnValue({})
  };
}

export function createMockSupabaseClient(mockChannel: MockChannel): MockSupabaseClient {
  const mockFrom = vi.fn().mockImplementation(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis()
  }));

  return {
    channel: vi.fn().mockReturnValue(mockChannel),
    from: mockFrom,
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      })
    }
  };
}