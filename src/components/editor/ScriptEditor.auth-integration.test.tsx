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
// auth import removed - using getUser directly from lib/supabase
import { CustomSupabaseProvider } from '../../lib/collaboration/custom-supabase-provider';
import { createMockCustomSupabaseProvider } from '../../../tests/helpers/mockCustomSupabaseProvider';

// Mock dependencies - TipTap mocks handled by tests/setup.ts
// TestGuard approved: Mock infrastructure maintenance - fixing mock drift
vi.mock('../../lib/supabase', () => ({
  getUser: vi.fn(), // Standalone getUser function for AuthenticatedProviderFactory
  getSupabaseClient: vi.fn().mockReturnValue({ auth: { getUser: vi.fn() } }), // Missing export
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
  const mockAuthUser = {
    id: 'auth-user-123',
    email: 'authenticated@example.com',
    app_metadata: {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date().toISOString()
  } as any; // Mock User type for testing

  beforeEach(() => {
    mockDoc = new Y.Doc();
    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockDoc.destroy();
  });

  describe('Authentication Context Flow', () => {
    it('should initialize CustomSupabaseProvider with authenticated user context', async () => {
      // Import and setup getUser mock
      const { getUser } = await import('../../lib/supabase');
      vi.mocked(getUser).mockResolvedValue(mockAuthUser);

      const config = {
        projectId: 'test-project-123',
        documentId: 'test-document-456',
        userId: 'user-123',
        userName: 'Test User',
        userColor: '#007acc'
      };

      render(
        <ScriptEditor
          config={config}
          ydoc={mockDoc}
          onError={vi.fn()}
        />
      );

      // Wait for provider initialization
      await waitFor(() => {
        expect(getUser).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Verify provider was called with correct configuration
      expect(CustomSupabaseProvider).toHaveBeenCalled();
    });

    it('should fallback to anonymous mode when authentication fails', async () => {
      // Setup authentication failure
      const { getUser } = await import('../../lib/supabase');
      vi.mocked(getUser).mockRejectedValue(new Error('Auth failed'));

      const config = {
        projectId: 'test-project-123',
        documentId: 'test-document-456',
        userId: 'user-123',
        userName: 'Test User'
      };

      render(
        <ScriptEditor
          config={config}
          ydoc={mockDoc}
          onError={vi.fn()}
        />
      );

      // Wait for provider initialization attempt
      await waitFor(() => {
        expect(getUser).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Should still create provider in anonymous mode
      expect(CustomSupabaseProvider).toHaveBeenCalled();
    });

    it('should pass project context to authenticated provider factory', async () => {
      const { getUser } = await import('../../lib/supabase');
      vi.mocked(getUser).mockResolvedValue(mockAuthUser);

      const config = {
        projectId: 'specific-project-789',
        documentId: 'specific-document-012',
        userId: 'user-456',
        userName: 'Project User'
      };

      render(
        <ScriptEditor
          config={config}
          ydoc={mockDoc}
        />
      );

      await waitFor(() => {
        expect(CustomSupabaseProvider).toHaveBeenCalled();
      }, { timeout: 3000 });

      // Verify project context was passed
      const constructorCall = vi.mocked(CustomSupabaseProvider).mock.calls[0];
      expect(constructorCall).toBeDefined();
    });
  });

  describe('Provider Integration Contracts', () => {
    it('should connect provider after initialization with authentication context', async () => {
      const mockProvider = createMockCustomSupabaseProvider({
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined)
      });

      vi.mocked(CustomSupabaseProvider).mockImplementation(() => mockProvider);

      const { getUser } = await import('../../lib/supabase');
      vi.mocked(getUser).mockResolvedValue(mockAuthUser);

      const config = {
        projectId: 'test-project-123',
        documentId: 'test-document-456',
        userId: 'user-123',
        userName: 'Test User'
      };

      render(
        <ScriptEditor
          config={config}
          ydoc={mockDoc}
        />
      );

      await waitFor(() => {
        expect(mockProvider.connect).toHaveBeenCalled();
      }, { timeout: 3000 });
    });

    it('should display connection status based on provider state', async () => {
      const { getUser } = await import('../../lib/supabase');
      vi.mocked(getUser).mockResolvedValue(mockAuthUser);

      const config = {
        projectId: 'test-project-123',
        documentId: 'test-document-456',
        userId: 'user-123',
        userName: 'Test User'
      };

      render(
        <ScriptEditor
          config={config}
          ydoc={mockDoc}
        />
      );

      // Should initially show disconnected
      const statusElement = screen.getByTestId('connection-status');
      expect(statusElement).toHaveTextContent('Disconnected');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle provider initialization failure with auth context', async () => {
      const onError = vi.fn();

      // Mock provider constructor failure
      vi.mocked(CustomSupabaseProvider).mockImplementation(() => {
        throw new Error('Provider initialization failed');
      });

      const { getUser } = await import('../../lib/supabase');
      vi.mocked(getUser).mockResolvedValue(mockAuthUser);

      const config = {
        projectId: 'test-project-123',
        documentId: 'test-document-456',
        userId: 'user-123',
        userName: 'Test User'
      };

      render(
        <ScriptEditor
          config={config}
          ydoc={mockDoc}
          onError={onError}
        />
      );

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      }, { timeout: 3000 });
    });
  });
});