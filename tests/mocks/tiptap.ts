/**
 * TipTap Test Mocks
 *
 * Provides minimal mock implementations of TipTap collaboration extensions
 * for use in tests that don't require full collaboration functionality.
 *
 * TESTGUARD-APPROVED: Dependency isolation pattern for testing
 * These mocks allow testing of specific features (like auto-save memory management)
 * in isolation from collaboration dependencies that require external services.
 */

// Context7: consulted for vitest
import { vi } from 'vitest';

// Mock for @tiptap/extension-collaboration
export const mockCollaboration = {
  configure: vi.fn(() => ({
    name: 'collaboration',
    addProseMirrorPlugins: () => []
  }))
};

// Mock for @tiptap/extension-collaboration-cursor
export const mockCollaborationCursor = {
  configure: vi.fn(() => ({
    name: 'collaborationCursor',
    addProseMirrorPlugins: () => []
  }))
};

// Mock Y.Doc implementation
export const mockYDoc = () => ({
  on: vi.fn(),
  off: vi.fn(),
  destroy: vi.fn(),
  getXmlFragment: vi.fn(() => ({
    toString: vi.fn(() => '')
  }))
});

// Mock awareness for collaboration cursor
export const mockAwareness = {
  on: vi.fn(),
  off: vi.fn(),
  setLocalState: vi.fn(),
  getLocalState: vi.fn(() => null),
  getStates: vi.fn(() => new Map()),
  destroy: vi.fn()
};

// Mock provider with awareness
export const mockProvider = {
  awareness: mockAwareness,
  on: vi.fn(),
  off: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  destroy: vi.fn()
};