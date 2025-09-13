/**
 * Supabase Client Configuration Tests - UPDATED FOR FAIL-CLOSED SECURITY
 *
 * TRACED Protocol: Updated test contract to match Critical Engineer approved implementation
 * TestGuard: Approved test contract realignment with fail-closed security architecture
 * Tests authentication with fail-closed error handling (null returns instead of VIEWER fallback)
 */

// Context7: consulted for vitest
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Context7: consulted for @supabase/supabase-js
import { createClient } from '@supabase/supabase-js';
import { auth, getUserRole, roles, type UserRole, getSupabase, resetSupabaseClient } from './supabase';

// Mock environment variables
vi.mock('import.meta', () => ({
  env: {
    VITE_SUPABASE_URL: 'https://test.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'test-anon-key',
  },
}));

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

describe('Supabase Client Configuration', () => {
  let mockSupabaseClient: any;

  beforeEach(() => {
    // Reset mocks and client state
    vi.clearAllMocks();
    resetSupabaseClient();

    // Create mock Supabase client
    mockSupabaseClient = {
      auth: {
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
        getUser: vi.fn(),
        getSession: vi.fn(),
        onAuthStateChange: vi.fn(),
      },
      from: vi.fn(),
    };

    (createClient as any).mockReturnValue(mockSupabaseClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetSupabaseClient();
  });

  describe('Client Initialization', () => {
    it('should create Supabase client with correct configuration', () => {
      // Trigger client creation
      const client = getSupabase();

      expect(client).toBeTruthy();
      expect(createClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-anon-key',
        expect.objectContaining({
          auth: expect.objectContaining({
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            storageKey: 'eav-orchestrator-auth',
          }),
          realtime: expect.objectContaining({
            params: expect.objectContaining({
              eventsPerSecond: 10,
            }),
          }),
        })
      );
    });

    it('should return null if environment variables are missing', () => {
      // Mock missing environment variables
      vi.doMock('import.meta', () => ({
        env: {},
      }));

      // Reset client to force re-initialization
      resetSupabaseClient();

      const client = getSupabase();
      expect(client).toBeNull();
    });

    it('should cache initialization errors', () => {
      // Mock missing environment variables
      vi.doMock('import.meta', () => ({
        env: {},
      }));

      resetSupabaseClient();

      // First call should return null
      const client1 = getSupabase();
      expect(client1).toBeNull();

      // Second call should also return null (cached error)
      const client2 = getSupabase();
      expect(client2).toBeNull();
    });
  });

  describe('Authentication Functions', () => {
    describe('signIn', () => {
      it('should sign in user with email and password', async () => {
        const mockUser = { id: 'user-123', email: 'test@example.com' };
        const mockSession = { access_token: 'token-123' };

        mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
          data: { user: mockUser, session: mockSession },
          error: null,
        });

        const result = await auth.signIn('test@example.com', 'password123');

        expect(mockSupabaseClient.auth.signInWithPassword).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
        expect(result).toEqual({ user: mockUser, session: mockSession });
      });

      it('should throw error on sign in failure', async () => {
        const mockError = new Error('Invalid credentials');
        mockSupabaseClient.auth.signInWithPassword.mockResolvedValue({
          data: null,
          error: mockError,
        });

        await expect(auth.signIn('test@example.com', 'wrong')).rejects.toThrow('Invalid credentials');
      });

      it('should throw error if client not available', async () => {
        // Force client to return null
        resetSupabaseClient();
        vi.doMock('import.meta', () => ({ env: {} }));

        await expect(auth.signIn('test@example.com', 'password')).rejects.toThrow('Supabase client not available');
      });
    });

    describe('signUp', () => {
      it('should sign up new user with metadata', async () => {
        const mockUser = { id: 'user-456', email: 'new@example.com' };
        mockSupabaseClient.auth.signUp.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        const result = await auth.signUp('new@example.com', 'password123', {
          name: 'Test User',
          role: 'freelancer',
        });

        expect(mockSupabaseClient.auth.signUp).toHaveBeenCalledWith({
          email: 'new@example.com',
          password: 'password123',
          options: {
            data: {
              name: 'Test User',
              role: 'freelancer',
            },
          },
        });
        expect(result).toEqual({ user: mockUser });
      });
    });

    describe('signOut', () => {
      it('should sign out current user', async () => {
        mockSupabaseClient.auth.signOut.mockResolvedValue({
          error: null,
        });

        await auth.signOut();
        expect(mockSupabaseClient.auth.signOut).toHaveBeenCalled();
      });
    });

    describe('getUser', () => {
      it('should return current user', async () => {
        const mockUser = { id: 'user-789', email: 'current@example.com' };
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: mockUser },
          error: null,
        });

        const user = await auth.getUser();
        expect(user).toEqual(mockUser);
      });
    });

    describe('getSession', () => {
      it('should return current session', async () => {
        const mockSession = { access_token: 'session-token' };
        mockSupabaseClient.auth.getSession.mockResolvedValue({
          data: { session: mockSession },
          error: null,
        });

        const session = await auth.getSession();
        expect(session).toEqual(mockSession);
      });
    });

    describe('onAuthStateChange', () => {
      it('should register auth state change listener', () => {
        const callback = vi.fn();
        const unsubscribe = vi.fn();
        mockSupabaseClient.auth.onAuthStateChange.mockReturnValue({ unsubscribe });

        const result = auth.onAuthStateChange(callback);

        expect(mockSupabaseClient.auth.onAuthStateChange).toHaveBeenCalledWith(callback);
        expect(result).toEqual({ unsubscribe });
      });
    });
  });

  describe('User Role Management - FAIL-CLOSED SECURITY', () => {
    describe('getUserRole', () => {
      it('should fetch user role from database', async () => {
        const mockFrom = vi.fn().mockReturnThis();
        const mockSelect = vi.fn().mockReturnThis();
        const mockEq = vi.fn().mockReturnThis();
        const mockSingle = vi.fn().mockResolvedValue({
          data: { role: 'admin' },
          error: null,
        });

        mockSupabaseClient.from = mockFrom;
        mockFrom.mockReturnValue({
          select: mockSelect,
        });
        mockSelect.mockReturnValue({
          eq: mockEq,
        });
        mockEq.mockReturnValue({
          single: mockSingle,
        });

        const role = await getUserRole('user-123');

        expect(mockFrom).toHaveBeenCalledWith('user_profiles');
        expect(mockSelect).toHaveBeenCalledWith('role');
        expect(mockEq).toHaveBeenCalledWith('user_id', 'user-123');
        expect(role).toBe('admin');
      });

      it('should return null on database error (FAIL-CLOSED)', async () => {
        mockSupabaseClient.from = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: new Error('User not found'),
              }),
            }),
          }),
        });

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const role = await getUserRole('unknown-user');

        // CRITICAL: Fail-closed security - return null, not VIEWER
        expect(role).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(
          'Critical: User role fetch failed - forcing unauthenticated state:',
          expect.any(Error)
        );

        consoleSpy.mockRestore();
      });

      it('should return null if no role in data (FAIL-CLOSED)', async () => {
        mockSupabaseClient.from = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { role: null },
                error: null,
              }),
            }),
          }),
        });

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const role = await getUserRole('user-no-role');

        // CRITICAL: Fail-closed security - return null, not VIEWER
        expect(role).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(
          'Critical: Invalid user role detected - forcing unauthenticated state:',
          null
        );

        consoleSpy.mockRestore();
      });

      it('should return null if invalid role detected (FAIL-CLOSED)', async () => {
        mockSupabaseClient.from = vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { role: 'invalid-role' },
                error: null,
              }),
            }),
          }),
        });

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const role = await getUserRole('user-invalid-role');

        // CRITICAL: Fail-closed security - return null for invalid roles
        expect(role).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(
          'Critical: Invalid user role detected - forcing unauthenticated state:',
          'invalid-role'
        );

        consoleSpy.mockRestore();
      });

      it('should return null if client not available (FAIL-CLOSED)', async () => {
        // Force client to return null
        resetSupabaseClient();
        vi.doMock('import.meta', () => ({ env: {} }));

        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const role = await getUserRole('user-123');

        // CRITICAL: Fail-closed security - no client = unauthenticated
        expect(role).toBeNull();
        expect(consoleSpy).toHaveBeenCalledWith(
          'Critical: Cannot fetch user role - Supabase client not available'
        );

        consoleSpy.mockRestore();
      });
    });

    describe('Role Constants', () => {
      it('should define all 5 user roles', () => {
        expect(roles.ADMIN).toBe('admin');
        expect(roles.INTERNAL).toBe('internal');
        expect(roles.FREELANCER).toBe('freelancer');
        expect(roles.CLIENT).toBe('client');
        expect(roles.VIEWER).toBe('viewer');
      });

      it('should export UserRole type', () => {
        // Type checking - this will be validated at compile time
        const testRole: UserRole = 'admin';
        expect(testRole).toBe('admin');
      });
    });
  });
});