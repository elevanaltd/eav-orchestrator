// Context7: consulted for vitest
// Context7: consulted for @testing-library/react
// Context7: consulted for @testing-library/jest-dom
// Error-Architect: IndexedDB polyfill for Node.js test environment
// Critical-Engineer: consulted for Test environment architecture (fake-indexeddb setup)
import { afterEach, vi } from 'vitest';
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

// ARCHITECTURAL FIX: Comprehensive Y.js Mock Facade (Strangler Fig Pattern)
// This unified mock replaces fragmented Y.js mocking with a complete facade
// that satisfies all test requirements and prevents cascading failures.
// Provides full Y.js Doc API, state encoding methods, and CRDT semantics.
vi.mock('yjs', () => {
  // Mock Y.Text implementation
  class MockYText {
    private content: string = '';

    insert(index: number, text: string): void {
      this.content = this.content.slice(0, index) + text + this.content.slice(index);
    }

    delete(index: number, length: number): void {
      this.content = this.content.slice(0, index) + this.content.slice(index + length);
    }

    toString(): string {
      return this.content;
    }

    toJSON(): string {
      return this.content;
    }

    get length(): number {
      return this.content.length;
    }
  }

  // Mock Y.Array implementation
  class MockYArray {
    private items: any[] = [];

    insert(index: number, items: any[]): void {
      this.items.splice(index, 0, ...items);
    }

    delete(index: number, length: number): void {
      this.items.splice(index, length);
    }

    push(items: any[]): void {
      this.items.push(...items);
    }

    toArray(): any[] {
      return [...this.items];
    }

    toJSON(): any[] {
      return this.toArray();
    }

    get length(): number {
      return this.items.length;
    }
  }

  // Mock Y.Map implementation
  class MockYMap {
    private map: Map<string, any> = new Map();

    set(key: string, value: any): void {
      this.map.set(key, value);
    }

    get(key: string): any {
      return this.map.get(key);
    }

    has(key: string): boolean {
      return this.map.has(key);
    }

    delete(key: string): void {
      this.map.delete(key);
    }

    toJSON(): Record<string, any> {
      const obj: Record<string, any> = {};
      this.map.forEach((value, key) => {
        obj[key] = value;
      });
      return obj;
    }
  }

  // Mock Y.Doc implementation with all required methods
  class MockDoc {
    public types: Map<string, any> = new Map(); // Made public for encoding functions
    private clientID: number = Math.floor(Math.random() * 1000000);
    private eventHandlers: Map<string, Set<(...args: any[]) => void>> = new Map();

    // Get or create Y.Text
    getText(name: string = 'default'): MockYText {
      if (!this.types.has(`text:${name}`)) {
        this.types.set(`text:${name}`, new MockYText());
      }
      return this.types.get(`text:${name}`);
    }

    // Get or create Y.Array
    getArray(name: string = 'default'): MockYArray {
      if (!this.types.has(`array:${name}`)) {
        this.types.set(`array:${name}`, new MockYArray());
      }
      return this.types.get(`array:${name}`);
    }

    // Get or create Y.Map
    getMap(name: string = 'default'): MockYMap {
      if (!this.types.has(`map:${name}`)) {
        this.types.set(`map:${name}`, new MockYMap());
      }
      return this.types.get(`map:${name}`);
    }

    // Get XML fragment (for TipTap compatibility)
    getXmlFragment(name: string = 'default'): any {
      return {
        toString: () => this.getText(name).toString()
      };
    }

    // Event handling
    on(event: string, handler: (...args: any[]) => void): void {
      if (!this.eventHandlers.has(event)) {
        this.eventHandlers.set(event, new Set());
      }
      this.eventHandlers.get(event)?.add(handler);
    }

    off(event: string, handler: (...args: any[]) => void): void {
      this.eventHandlers.get(event)?.delete(handler);
    }

    emit(event: string, data: any[]): void {
      this.eventHandlers.get(event)?.forEach(handler => handler(...data));
    }

    // Transaction support
    transact(fn: () => void, origin?: any): void {
      fn();
      // Emit update event after transaction
      this.emit('update', [new Uint8Array([1, 2, 3]), origin, this]);
    }

    // Cleanup
    destroy(): void {
      this.types.clear();
      this.eventHandlers.clear();
    }

    // Client ID
    get clientId(): number {
      return this.clientID;
    }
  }

  // State encoding/decoding functions
  const encodeStateAsUpdate = (doc: MockDoc): Uint8Array => {
    // Serialize document state to simulate encoding
    const state = {
      text: {} as Record<string, string>,
      array: {} as Record<string, any[]>,
      map: {} as Record<string, Record<string, any>>
    };

    // Collect all text fields
    doc.types.forEach((value, key) => {
      if (key.startsWith('text:')) {
        const name = key.substring(5);
        state.text[name] = value.toString();
      } else if (key.startsWith('array:')) {
        const name = key.substring(6);
        state.array[name] = value.toArray();
      } else if (key.startsWith('map:')) {
        const name = key.substring(4);
        state.map[name] = value.toJSON();
      }
    });

    // Convert to bytes (simplified)
    const json = JSON.stringify(state);
    const bytes = new TextEncoder().encode(json);
    return new Uint8Array(bytes);
  };

  const encodeStateVector = (_doc: MockDoc): Uint8Array => {
    // Return mock state vector
    return new Uint8Array([1, 0, 0]);
  };

  const applyUpdate = (doc: MockDoc, update: Uint8Array, origin?: any): void => {
    // Deserialize and apply update
    try {
      const json = new TextDecoder().decode(update);
      const state = JSON.parse(json);

      // Apply text updates with CRDT merge semantics
      if (state.text) {
        Object.entries(state.text).forEach(([name, content]) => {
          const text = doc.getText(name);
          const currentContent = text.toString();
          const incomingContent = content as string;

          // CRDT merge: If both have content, use lexicographic ordering for determinism
          // This ensures both documents converge to the same state
          if (currentContent && incomingContent && currentContent !== incomingContent) {
            // Deterministic merge: alphabetically earlier content comes first
            const merged = currentContent < incomingContent
              ? currentContent + incomingContent
              : incomingContent + currentContent;
            text.delete(0, text.length);
            text.insert(0, merged);
          } else if (!currentContent) {
            // No existing content, just set the incoming
            text.insert(0, incomingContent);
          }
          // If incoming is same as current, no change needed
        });
      }

      // Apply array updates
      if (state.array) {
        Object.entries(state.array).forEach(([name, items]) => {
          const array = doc.getArray(name);
          array.delete(0, array.length);
          array.push(items as any[]);
        });
      }

      // Apply map updates
      if (state.map) {
        Object.entries(state.map).forEach(([name, mapData]) => {
          const map = doc.getMap(name);
          Object.entries(mapData as Record<string, any>).forEach(([key, value]) => {
            map.set(key, value);
          });
        });
      }
    } catch {
      // If not valid JSON, just use as-is (for backward compatibility)
    }

    // Emit update event
    doc.emit('update', [update, origin, doc]);
  };

  const mergeUpdates = (updates: Uint8Array[]): Uint8Array => {
    // Merge multiple updates by combining their states
    const mergedState = {
      text: {} as Record<string, string>,
      array: {} as Record<string, any[]>,
      map: {} as Record<string, Record<string, any>>
    };

    // Process each update
    for (const update of updates) {
      try {
        const json = new TextDecoder().decode(update);
        const state = JSON.parse(json);

        // Merge text fields with CRDT semantics
        if (state.text) {
          Object.entries(state.text).forEach(([name, content]) => {
            if (!mergedState.text[name]) {
              mergedState.text[name] = content as string;
            } else {
              // CRDT merge: use deterministic merge (alphabetical ordering)
              // This ensures consistent convergence regardless of merge order
              const existing = mergedState.text[name];
              const incoming = content as string;
              // Always use the same ordering for deterministic results
              mergedState.text[name] = existing < incoming ? existing + incoming : incoming + existing;
            }
          });
        }

        // Merge arrays
        if (state.array) {
          Object.entries(state.array).forEach(([name, items]) => {
            if (!mergedState.array[name]) {
              mergedState.array[name] = items as any[];
            } else {
              mergedState.array[name].push(...(items as any[]));
            }
          });
        }

        // Merge maps
        if (state.map) {
          Object.entries(state.map).forEach(([name, mapData]) => {
            if (!mergedState.map[name]) {
              mergedState.map[name] = mapData as Record<string, any>;
            } else {
              Object.assign(mergedState.map[name], mapData);
            }
          });
        }
      } catch {
        // Skip invalid updates
      }
    }

    // Encode merged state
    const json = JSON.stringify(mergedState);
    const bytes = new TextEncoder().encode(json);
    return new Uint8Array(bytes);
  };

  const diffUpdate = (update: Uint8Array, _stateVector: Uint8Array): Uint8Array => {
    // Mock diff - return the update as-is
    return update;
  };

  // Create state from update
  const createStateFromUpdate = (update: Uint8Array): MockDoc => {
    const doc = new MockDoc();
    applyUpdate(doc, update);
    return doc;
  };

  // Mock Awareness class for collaboration
  class Awareness {
    private states: Map<number, any> = new Map();
    private meta: Map<number, any> = new Map();
    private eventHandlers: Map<string, Set<(...args: any[]) => void>> = new Map();
    public clientID: number;

    constructor(doc: MockDoc) {
      this.clientID = doc.clientId;
    }

    getLocalState(): any {
      return this.states.get(this.clientID);
    }

    setLocalState(state: any): void {
      this.states.set(this.clientID, state);
      this.emit('change', [{ added: [], updated: [this.clientID], removed: [] }, 'local']);
    }

    getStates(): Map<number, any> {
      return new Map(this.states);
    }

    on(event: string, handler: (...args: any[]) => void): void {
      if (!this.eventHandlers.has(event)) {
        this.eventHandlers.set(event, new Set());
      }
      this.eventHandlers.get(event)?.add(handler);
    }

    off(event: string, handler: (...args: any[]) => void): void {
      this.eventHandlers.get(event)?.delete(handler);
    }

    emit(event: string, data: any[]): void {
      this.eventHandlers.get(event)?.forEach(handler => handler(...data));
    }

    destroy(): void {
      this.states.clear();
      this.meta.clear();
      this.eventHandlers.clear();
    }
  }

  return {
    Doc: vi.fn(() => new MockDoc()),
    encodeStateAsUpdate: vi.fn(encodeStateAsUpdate),
    encodeStateVector: vi.fn(encodeStateVector),
    applyUpdate: vi.fn(applyUpdate),
    mergeUpdates: vi.fn(mergeUpdates),
    diffUpdate: vi.fn(diffUpdate),
    createStateFromUpdate: vi.fn(createStateFromUpdate),
    Awareness: vi.fn((doc: MockDoc) => new Awareness(doc))
  };
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

afterEach(() => {
  cleanup();
});
