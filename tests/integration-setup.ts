/**
 * Integration Test Setup
 *
 * This setup file is specifically for integration tests that need real Y.js instances.
 * It bypasses the global Y.js mock and ensures real Y.js functionality is available.
 */

import { vi } from 'vitest';
import '@testing-library/jest-dom';
// Import fake-indexeddb for Node.js environment support
import 'fake-indexeddb/auto';

// Clear any existing Y.js mocks to ensure real Y.js is used
vi.unmock('yjs');

// Mock only the TipTap extensions that are not needed for integration tests
vi.mock('@tiptap/extension-collaboration', () => ({
  default: {
    configure: vi.fn(() => ({
      name: 'collaboration',
      addProseMirrorPlugins: () => []
    }))
  }
}));

vi.mock('@tiptap/extension-collaboration-cursor', () => ({
  default: {
    configure: vi.fn(() => ({
      name: 'collaborationCursor',
      addProseMirrorPlugins: () => []
    }))
  }
}));

vi.mock('@tiptap/starter-kit', () => ({
  default: {
    configure: vi.fn(() => ({
      name: 'starterKit',
      addProseMirrorPlugins: () => []
    }))
  }
}));