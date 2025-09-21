/**
 * AuthenticatedProviderFactory.test.ts
 *
 * TDD RED Phase: Failing tests for authenticated provider factory
 * Test-methodology-guardian: consulted for TDD discipline enforcement
 */

// Context7: consulted for vitest
// Context7: consulted for yjs
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import { AuthenticatedProviderFactory } from './AuthenticatedProviderFactory';
import { CustomSupabaseProvider } from './custom-supabase-provider';

// TESTGUARD-APPROVED: Fixing test harness to match actual module exports
// Mock supabase module with complete interface
vi.mock('../supabase', async () => {
  const actualSupabaseModule = await vi.importActual<typeof import('../supabase')>('../supabase');
  return {
    ...actualSupabaseModule, // Keep all original exports
    getUser: vi.fn(), // Explicitly mock the functions we need to control
    getSupabase: vi.fn().mockReturnValue({
      from: vi.fn(),
      auth: { getUser: vi.fn() }
    }),
    getSupabaseClient: vi.fn().mockReturnValue({
      from: vi.fn(),
      auth: { getUser: vi.fn() }
    })
  };
});

// Mock CustomSupabaseProvider with proper prototype chain for instanceof checks
vi.mock('./custom-supabase-provider', async () => {
  const actualProviderModule = await vi.importActual('./custom-supabase-provider');
  const OriginalCustomSupabaseProvider = (actualProviderModule as any).CustomSupabaseProvider;

  // Create a spy that returns instances with correct prototype
  const MockedCustomSupabaseProvider = vi.fn().mockImplementation((config: any) => {
    // Create an instance that extends the original for instanceof checks
    const instance = Object.create(OriginalCustomSupabaseProvider.prototype);

    // Set constructor properties
    instance.constructor = OriginalCustomSupabaseProvider;

    // Add mocked methods
    instance.connect = vi.fn().mockResolvedValue(undefined);
    instance.disconnect = vi.fn().mockResolvedValue(undefined);
    instance.destroy = vi.fn().mockResolvedValue(undefined);

    // Store config for test verification
    instance._config = config;

    return instance;
  });

  return {
    CustomSupabaseProvider: MockedCustomSupabaseProvider
  };
});

// Mock createClient from Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    from: vi.fn(),
    auth: { getUser: vi.fn() }
  })
}));
describe('AuthenticatedProviderFactory', () => {
  let ydoc: Y.Doc;
  const mockConfig = {
    projectId: 'test-project-123',
    documentId: 'test-document-456',
    ydoc: null as any, // Will be set in beforeEach
    onSync: vi.fn(),
    onError: vi.fn(),
    onStatusChange: vi.fn()
  };

  beforeEach(() => {
    ydoc = new Y.Doc();
    mockConfig.ydoc = ydoc;
    vi.clearAllMocks();
  });

  afterEach(() => {
    ydoc?.destroy();
    vi.clearAllMocks();
    // Reset CustomSupabaseProvider mock to default behavior
    vi.mocked(CustomSupabaseProvider).mockImplementation((config: any) => {
      const instance = Object.create(CustomSupabaseProvider.prototype);
      instance.constructor = CustomSupabaseProvider;
      instance.connect = vi.fn().mockResolvedValue(undefined);
      instance.disconnect = vi.fn().mockResolvedValue(undefined);
      instance.destroy = vi.fn().mockResolvedValue(undefined);
      instance._config = config;
      return instance;
    });
  });

  describe('create method', () => {
    it('should create provider with authenticated user context', async () => {
      // Arrange: Mock successful authentication
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      };

      const { getUser } = await import('../supabase');
      vi.mocked(getUser).mockResolvedValue(mockUser as any);

      // Act: Create authenticated provider
      const provider = await AuthenticatedProviderFactory.create(mockConfig);

      // Assert: Provider should be created with auth context - check against constructor name
      expect(provider.constructor.name).toBe('CustomSupabaseProvider');

      const authContext = AuthenticatedProviderFactory.getAuthContext(provider);
      expect(authContext).toEqual({
        userId: 'user-123',
        isAuthenticated: true,
        email: 'test@example.com'
      });
    });

    it('should fallback to anonymous mode when authentication fails', async () => {
      // Arrange: Mock authentication failure
      const { getUser } = await import('../supabase');
      vi.mocked(getUser).mockRejectedValue(new Error('Auth failed'));

      // Act: Create provider with auth failure
      const provider = await AuthenticatedProviderFactory.create(mockConfig);

      // Assert: Provider should be created with anonymous context
      expect(provider).toBeInstanceOf(CustomSupabaseProvider);

      const authContext = AuthenticatedProviderFactory.getAuthContext(provider);
      expect(authContext).toEqual({
        userId: 'anonymous',
        isAuthenticated: false,
        email: null
      });
    });

    it('should fallback to anonymous mode when getUser returns null', async () => {
      // Arrange: Mock null user response
      const { getUser } = await import('../supabase');
      vi.mocked(getUser).mockResolvedValue(null as any);

      // Act: Create provider with null user
      const provider = await AuthenticatedProviderFactory.create(mockConfig);

      // Assert: Provider should be created with anonymous context
      expect(provider).toBeInstanceOf(CustomSupabaseProvider);

      const authContext = AuthenticatedProviderFactory.getAuthContext(provider);
      expect(authContext).toEqual({
        userId: 'anonymous',
        isAuthenticated: false,
        email: null
      });
    });

    it('should pass through all configuration options to CustomSupabaseProvider', async () => {
      // Arrange: Mock successful authentication
      const { getUser } = await import('../supabase');
      vi.mocked(getUser).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com'
      } as any);

      // Act: Create provider
      await AuthenticatedProviderFactory.create(mockConfig);

      // Assert: CustomSupabaseProvider should be called with correct config
      expect(CustomSupabaseProvider).toHaveBeenCalledWith({
        supabaseClient: expect.any(Object),
        ydoc: ydoc,
        documentId: 'test-document-456',
        projectId: 'test-project-123',
        tableName: 'yjs_documents',
        onSync: mockConfig.onSync,
        onError: mockConfig.onError,
        onStatusChange: mockConfig.onStatusChange
      });
    });

    it('should throw error when provider creation fails', async () => {
      // Arrange: Mock provider construction failure
      const { getUser } = await import('../supabase');
      vi.mocked(getUser).mockResolvedValue({ id: 'user-123' } as any);

      vi.mocked(CustomSupabaseProvider).mockImplementation(() => {
        throw new Error('Provider construction failed');
      });

      // Act & Assert: Should throw error
      await expect(
        AuthenticatedProviderFactory.create(mockConfig)
      ).rejects.toThrow('Failed to create authenticated provider: Provider construction failed');
    });
  });

  describe('getAuthContext method', () => {
    it('should return null for provider without auth context', () => {
      // Arrange: Create mock provider without auth context
      const mockProvider = {
        constructor: { name: 'CustomSupabaseProvider' },
        connect: vi.fn(),
        disconnect: vi.fn(),
        destroy: vi.fn()
      };

      // Act: Get auth context
      const authContext = AuthenticatedProviderFactory.getAuthContext(mockProvider as any);

      // Assert: Should return null
      expect(authContext).toBeNull();
    });

    it('should return auth context for provider with context', async () => {
      // Arrange: Create authenticated provider
      const { getUser } = await import('../supabase');
      vi.mocked(getUser).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com'
      } as any);

      const provider = await AuthenticatedProviderFactory.create(mockConfig);

      // Act: Get auth context
      const authContext = AuthenticatedProviderFactory.getAuthContext(provider);

      // Assert: Should return correct context
      expect(authContext).toEqual({
        userId: 'user-123',
        isAuthenticated: true,
        email: 'test@example.com'
      });
    });
  });
});