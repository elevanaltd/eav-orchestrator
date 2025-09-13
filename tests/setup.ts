// Context7: consulted for vitest
// Context7: consulted for @testing-library/react
// Context7: consulted for @testing-library/jest-dom
// Error-Architect: IndexedDB polyfill for Node.js test environment
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';

// CONSTITUTIONAL FIX: IndexedDB Test Environment Support
// The y-indexeddb package requires IndexedDB API which is not available
// in Node.js test environment. fake-indexeddb provides a complete
// implementation for testing without modifying production code.
// This preserves architectural integrity while enabling test validation.

// CONSTITUTIONAL FIX: TipTap Collaboration Test Environment Support
// Mock TipTap collaboration extensions to prevent awareness null errors in tests.
// These mocks provide minimal implementations for tests that don't require
// actual collaboration functionality (like memory leak tests).
// This preserves test isolation while enabling component testing.

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

// Mock Y.js with minimal implementation
vi.mock('yjs', () => ({
  Doc: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(),
    getXmlFragment: vi.fn(() => ({
      toString: vi.fn(() => '')
    }))
  }))
}));

// Mock TipTap React editor hook
let mockEditorUpdateCallback: ((data: { editor: any }) => void) | null = null;

vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn((config) => {
    // Store the onUpdate callback if provided
    mockEditorUpdateCallback = config?.onUpdate || null;

    const mockEditor = {
      getJSON: vi.fn(() => ({ type: 'doc', content: [] })),
      can: vi.fn(() => ({
        undo: vi.fn(() => false),
        redo: vi.fn(() => false)
      })),
      isActive: vi.fn(() => false),
      getAttributes: vi.fn(() => ({})),
      chain: vi.fn(() => ({
        focus: vi.fn(() => ({
          toggleBold: vi.fn(() => ({ run: vi.fn() })),
          toggleItalic: vi.fn(() => ({ run: vi.fn() })),
          toggleBulletList: vi.fn(() => ({ run: vi.fn() })),
          toggleHeading: vi.fn(() => ({ run: vi.fn() })),
          setParagraph: vi.fn(() => ({ run: vi.fn() }))
        }))
      })),
      state: {
        selection: { from: 0, to: 0 },
        doc: {
          textBetween: vi.fn(() => '')
        }
      },
      storage: {
        characterCount: {
          words: vi.fn(() => 0),
          characters: vi.fn(() => 0)
        }
      }
    };

    // Store editor globally for test access
    if (typeof window !== 'undefined') {
      (window as any).__testEditor = mockEditor;
      (window as any).__triggerEditorUpdate = () => {
        if (mockEditorUpdateCallback) {
          mockEditorUpdateCallback({ editor: mockEditor });
        }
      };
    }

    return mockEditor;
  }),
  EditorContent: vi.fn(() => {
    // Context7: consulted for react
    // Using require for dynamic import in test setup - not production code
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'editor-content' }, 'Mock Editor Content');
  })
}));

afterEach(() => {
  cleanup();
});
