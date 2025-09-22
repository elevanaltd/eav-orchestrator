// Context7: consulted for vitest
// Context7: consulted for @testing-library/react
// Context7: consulted for @testing-library/jest-dom
// Error-Architect: IndexedDB polyfill for Node.js test environment
// Critical-Engineer: consulted for Test environment architecture (fake-indexeddb setup)
import { afterEach, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
// CRITICAL FIX: Use vitest-specific fake-indexeddb import to prevent hanging
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

// CONSTITUTIONAL FIX: Mock TipTap StarterKit for test environment
// Context7: consulted for @tiptap/starter-kit
vi.mock('@tiptap/starter-kit', () => ({
  default: {
    configure: vi.fn(() => ({
      name: 'starterKit',
      addProseMirrorPlugins: () => []
    }))
  }
}));

// TESTGUARD MEMORY FIX: Use lightweight Y.js mock to prevent memory exhaustion
// The previous 433-line inline mock was causing memory leaks during test runs.
// This imports a simplified mock that creates single instances without vi.fn() wrapping.
import { createYjsMock } from './mocks/yjs.mock';

// Apply the lightweight Y.js mock
vi.mock('yjs', () => {
  // Return the lightweight mock without creating new instances
  return createYjsMock();
});

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

// Mock DataTransfer for drag and drop tests
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'DataTransfer', {
    value: class DataTransfer {
      private data: Record<string, string> = {};

      setData(format: string, data: string): void {
        this.data[format] = data;
      }

      getData(format: string): string {
        return this.data[format] || '';
      }

      clearData(): void {
        this.data = {};
      }
    },
    writable: true,
    configurable: true
  });
}

// Mock for fireEvent drag and drop in global scope
if (typeof global !== 'undefined') {
  Object.defineProperty(global, 'DataTransfer', {
    value: class DataTransfer {
      private data: Record<string, string> = {};

      setData(format: string, data: string): void {
        this.data[format] = data;
      }

      getData(format: string): string {
        return this.data[format] || '';
      }

      clearData(): void {
        this.data = {};
      }
    },
    writable: true,
    configurable: true
  });
}

// CONSTITUTIONAL FIX: Mock fetch for API endpoint tests
// Mock the global fetch to prevent network requests in tests
// This is critical for API version endpoint tests
vi.stubGlobal('fetch', vi.fn(async (url: string) => {
  // Mock /api/version endpoint
  if (url.includes('/api/version')) {
    return {
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'application/json'
      }),
      json: async () => ({
        version: '1.0.0',
        schemaVersion: 1,
        timestamp: new Date().toISOString(),
        build: 'B2-Build'
      })
    } as Response;
  }

  // Default response for other endpoints
  return {
    ok: false,
    status: 404,
    headers: new Headers(),
    json: async () => ({ error: 'Not found' })
  } as Response;
}));

// MEMORY LEAK FIX: Enhanced cleanup hooks
afterEach(() => {
  // TESTGUARD MEMORY FIX: Comprehensive cleanup
  // 1. Clean up React components
  cleanup();

  // 2. Restore all mocks to prevent accumulation
  vi.restoreAllMocks();

  // 3. Clear all mock call history
  vi.clearAllMocks();

  // 4. Clear any timers
  vi.clearAllTimers();
  vi.useRealTimers(); // Reset to real timers after each test

  // 5. Clear mock editor reference if it exists
  if (typeof window !== 'undefined' && (window as any).__testEditor) {
    (window as any).__testEditor = null;
    (window as any).__triggerEditorUpdate = null;
  }

  // 6. MEMORY FIX: Clear IndexedDB connections
  if (typeof window !== 'undefined' && window.indexedDB) {
    // Close all open IndexedDB connections
    const databases = window.indexedDB.databases ? window.indexedDB.databases() : Promise.resolve([]);
    databases.then((dbs: any[]) => {
      dbs.forEach(db => {
        if (db.name) {
          window.indexedDB.deleteDatabase(db.name);
        }
      });
    }).catch(() => {
      // Ignore errors in cleanup
    });
  }

  // 7. MEMORY FIX: Force garbage collection hint (Node.js specific)
  if (global.gc) {
    global.gc();
  }
});

// MEMORY LEAK FIX: Global teardown after all tests
afterAll(() => {
  // Final cleanup of any remaining resources
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.restoreAllMocks();

  // Clear all global references
  if (typeof window !== 'undefined') {
    // Clear any window properties we added
    const windowAny = window as any;
    Object.keys(windowAny).forEach(key => {
      if (key.startsWith('__test')) {
        delete windowAny[key];
      }
    });
  }

  // Force final garbage collection if available
  if (global.gc) {
    global.gc();
  }
});
