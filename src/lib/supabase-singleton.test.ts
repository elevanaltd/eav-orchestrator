/**
 * Supabase Singleton Isolation Test
 *
 * ERROR-ARCHITECT: Test validates lazy singleton pattern for proper test isolation
 * Ensures that mocks can properly intercept createClient calls
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Mock createClient before importing supabase module
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

describe('Supabase Singleton Lazy Initialization', () => {
  beforeEach(() => {
    // Clear all mocks and module cache
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should allow mocking createClient before first use', async () => {
    // Setup mock BEFORE importing the module
    const mockClient = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({ data: { user: {} }, error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      },
      from: vi.fn(),
    };

    (createClient as any).mockReturnValue(mockClient);

    // Import module AFTER mock is setup
    const { getSupabase, resetSupabaseClient } = await import('./supabase');

    // First call should create client with mock
    const client = getSupabase();

    expect(createClient).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        auth: expect.objectContaining({
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'eav-orchestrator-auth',
        }),
      })
    );

    expect(client).toBe(mockClient);

    // Clean up for next test
    resetSupabaseClient();
  });

  it('should cache the singleton after first creation', async () => {
    const mockClient = { auth: {}, from: vi.fn() };
    (createClient as any).mockReturnValue(mockClient);

    const { getSupabase, resetSupabaseClient } = await import('./supabase');

    // First call creates client
    const client1 = getSupabase();
    expect(createClient).toHaveBeenCalledTimes(1);

    // Second call returns cached instance
    const client2 = getSupabase();
    expect(createClient).toHaveBeenCalledTimes(1); // Still only called once
    expect(client2).toBe(client1);

    // Clean up for next test
    resetSupabaseClient();
  });

  it('should properly reset singleton state for test isolation', async () => {
    const mockClient1 = { id: 'client1', auth: {}, from: vi.fn() };
    const mockClient2 = { id: 'client2', auth: {}, from: vi.fn() };

    (createClient as any).mockReturnValueOnce(mockClient1);

    const { getSupabase, resetSupabaseClient } = await import('./supabase');

    // First test creates client1
    const client1 = getSupabase();
    expect(client1).toHaveProperty('id', 'client1');

    // Reset for next test
    resetSupabaseClient();
    (createClient as any).mockReturnValueOnce(mockClient2);

    // Next test gets fresh client2
    const client2 = getSupabase();
    expect(client2).toHaveProperty('id', 'client2');
    expect(createClient).toHaveBeenCalledTimes(2);
  });

  it('should handle missing environment variables gracefully in tests', async () => {
    // Mock environment to have missing variables
    const originalUrl = import.meta.env.VITE_SUPABASE_URL;
    const originalKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    // Use vi.stubEnv to safely mock environment variables
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    // Re-import with cleared cache
    vi.resetModules();
    const { getSupabase } = await import('./supabase');

    // Should return null instead of throwing in test environment
    const client = getSupabase();
    expect(client).toBeNull();

    // Restore environment
    vi.stubEnv('VITE_SUPABASE_URL', originalUrl);
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', originalKey);
  });
});