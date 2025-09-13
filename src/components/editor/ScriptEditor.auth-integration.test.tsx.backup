/**
 * ScriptEditor Authentication Integration Tests
 *
 * TRACED Protocol: TEST FIRST (RED STATE) - These tests MUST fail initially
 * Testing authentication context integration with Y.js CustomSupabaseProvider
 *
 * FAILURE CONTRACT: Tests verify auth → provider initialization flow that doesn't exist yet
 * INTEGRATION SCOPE: Connect auth.getUser() to CustomSupabaseProvider constructor
 */

// Context7: consulted for vitest
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// Context7: consulted for @testing-library/react
import { render, screen, waitFor } from '@testing-library/react';
// Context7: consulted for yjs
import * as Y from 'yjs';
import { ScriptEditor } from './ScriptEditor';
import { auth } from '../../lib/supabase';
import { CustomSupabaseProvider } from '../../lib/collaboration/custom-supabase-provider';

// Mock dependencies - TipTap mocks handled by tests/setup.ts
vi.mock('../../lib/supabase', () => ({
  auth: {
    getUser: vi.fn()
  },
  getSupabase: vi.fn().mockReturnValue({
    auth: {
      getUser: vi.fn()
    }
  })
}));

vi.mock('../../lib/collaboration/custom-supabase-provider');
vi.mock('../../lib/collaboration/YjsSupabaseProvider');

describe('ScriptEditor Authentication Integration', () => {
  let mockDoc: Y.Doc;
  let mockSupabaseClient: any;
  const mockAuthUser = {
    id: 'auth-user-123',
    email: 'authenticated@example.com'
  };

  beforeEach(() => {
    mockDoc = new Y.Doc();

    mockSupabaseClient = {
      auth: {
        getUser: vi.fn()
      },
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      channel: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn()
      })
    };

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockDoc.destroy();
    vi.clearAllMocks();
  });

  describe('Authentication Context Flow', () => {
    it('should initialize CustomSupabaseProvider with authenticated user context', async () => {
      // RED STATE: This test MUST fail - auth integration not implemented yet

      // Mock successful authentication
      const mockGetUser = vi.mocked(auth.getUser);
      mockGetUser.mockResolvedValue(mockAuthUser);

      const mockConfig = {
        documentId: 'doc-123',
        userId: 'auth-user-123', // Should come from auth.getUser()
        userName: 'Authenticated User',
        projectId: 'project-456'
      };

      // FAILING EXPECTATION: ScriptEditor should call auth.getUser() to get user context
      render(<ScriptEditor config={mockConfig} />);

      await waitFor(() => {
        // CRITICAL FAILURE POINT: auth.getUser() should be called during initialization
        expect(auth.getUser).toHaveBeenCalled();
      });

      // CRITICAL FAILURE POINT: CustomSupabaseProvider should be constructed with auth context
      expect(CustomSupabaseProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          // Provider should receive authenticated user ID
          userId: mockAuthUser.id,
          documentId: mockConfig.documentId,
          projectId: mockConfig.projectId,
          supabaseClient: expect.any(Object)
        })
      );
    });

    it('should handle unauthenticated user with anonymous fallback', async () => {
      // RED STATE: This test MUST fail - auth fallback not implemented yet

      // Mock authentication failure
      const mockGetUser = vi.mocked(auth.getUser);
      mockGetUser.mockRejectedValue(new Error('Authentication failed'));

      const mockConfig = {
        documentId: 'doc-123',
        userId: 'fallback-user',
        userName: 'Anonymous User',
        projectId: 'project-456'
      };

      // FAILING EXPECTATION: ScriptEditor should handle auth failure gracefully
      render(<ScriptEditor config={mockConfig} />);

      await waitFor(() => {
        // CRITICAL FAILURE POINT: Should attempt authentication first
        expect(auth.getUser).toHaveBeenCalled();
      });

      // CRITICAL FAILURE POINT: Should fall back to anonymous mode on auth failure
      expect(CustomSupabaseProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          // Provider should receive fallback user ID
          userId: mockConfig.userId, // Fallback to config.userId
          documentId: mockConfig.documentId,
          projectId: mockConfig.projectId,
          isAnonymous: true
        })
      );
    });

    it('should pass correct projectId for document scoping', async () => {
      // RED STATE: This test MUST fail - projectId scoping not implemented yet

      // Mock successful authentication
      const mockGetUser = vi.mocked(auth.getUser);
      mockGetUser.mockResolvedValue(mockAuthUser);

      const mockConfig = {
        documentId: 'doc-123',
        userId: 'auth-user-123',
        userName: 'Authenticated User',
        projectId: 'project-456'
      };

      // FAILING EXPECTATION: Provider should receive projectId for proper scoping
      render(<ScriptEditor config={mockConfig} />);

      await waitFor(() => {
        expect(auth.getUser).toHaveBeenCalled();
      });

      // CRITICAL FAILURE POINT: CustomSupabaseProvider should use projectId for scoping
      expect(CustomSupabaseProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'project-456', // Project-scoped collaboration
          documentId: 'doc-123',
          userId: mockAuthUser.id,
          // Should include Supabase client for RLS policy enforcement
          supabaseClient: expect.any(Object)
        })
      );
    });

    it('should connect provider after successful initialization', async () => {
      // RED STATE: This test MUST fail - provider.connect() not called yet

      // Mock successful authentication
      const mockGetUser = vi.mocked(auth.getUser);
      mockGetUser.mockResolvedValue(mockAuthUser);

      // Mock provider instance
      const mockProviderInstance = {
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn(),
        getCircuitBreakerState: vi.fn().mockReturnValue('CLOSED')
      };

      const MockedCustomSupabaseProvider = vi.mocked(CustomSupabaseProvider);
      MockedCustomSupabaseProvider.mockImplementation(() => mockProviderInstance as any);

      const mockConfig = {
        documentId: 'doc-123',
        userId: 'auth-user-123',
        userName: 'Authenticated User',
        projectId: 'project-456'
      };

      // FAILING EXPECTATION: Provider should be connected after initialization
      render(<ScriptEditor config={mockConfig} />);

      await waitFor(() => {
        expect(auth.getUser).toHaveBeenCalled();
        expect(CustomSupabaseProvider).toHaveBeenCalled();
      });

      // CRITICAL FAILURE POINT: Provider.connect() should be called
      expect(mockProviderInstance.connect).toHaveBeenCalled();
    });
  });

  describe('Circuit Breaker Integration with Auth', () => {
    it('should handle auth failure during circuit breaker open state', async () => {
      // RED STATE: This test MUST fail - circuit breaker auth integration not implemented

      // Mock authentication failure
      const mockGetUser = vi.mocked(auth.getUser);
      mockGetUser.mockRejectedValue(new Error('Auth service unavailable'));

      const mockConfig = {
        documentId: 'doc-123',
        userId: 'fallback-user',
        userName: 'Anonymous User',
        projectId: 'project-456'
      };

      // FAILING EXPECTATION: Should handle auth failure during circuit breaker scenarios
      render(<ScriptEditor config={mockConfig} />);

      await waitFor(() => {
        // CRITICAL FAILURE POINT: Should attempt auth even during circuit breaker scenarios
        expect(auth.getUser).toHaveBeenCalled();
      });

      // CRITICAL FAILURE POINT: Should initialize provider in degraded mode
      expect(CustomSupabaseProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockConfig.userId, // Fallback ID
          documentId: mockConfig.documentId,
          projectId: mockConfig.projectId,
          degradedMode: true // Circuit breaker fallback
        })
      );
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle provider initialization failure with auth context', async () => {
      // RED STATE: This test MUST fail - error handling integration not implemented

      // Mock successful authentication
      const mockGetUser = vi.mocked(auth.getUser);
      mockGetUser.mockResolvedValue(mockAuthUser);

      // Mock provider constructor failure
      const MockedCustomSupabaseProvider = vi.mocked(CustomSupabaseProvider);
      MockedCustomSupabaseProvider.mockImplementation(() => {
        throw new Error('Provider initialization failed');
      });

      const mockConfig = {
        documentId: 'doc-123',
        userId: 'auth-user-123',
        userName: 'Authenticated User',
        projectId: 'project-456'
      };

      // FAILING EXPECTATION: Should handle provider failure gracefully
      render(<ScriptEditor config={mockConfig} />);

      await waitFor(() => {
        expect(auth.getUser).toHaveBeenCalled();
      });

      // CRITICAL FAILURE POINT: Should display error state when provider fails
      expect(screen.getByTestId('collaboration-error')).toBeInTheDocument();
      expect(screen.getByText(/collaboration unavailable/i)).toBeInTheDocument();
    });
  });
});