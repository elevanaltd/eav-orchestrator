/**
 * TESTGUARD MEMORY FIX: Lightweight Y.js mock for test environment
 *
 * This replaces the heavyweight mock in setup.ts that was causing memory exhaustion.
 * Key optimizations:
 * 1. Single instance creation (no vi.fn() wrapping of constructors)
 * 2. Minimal memory footprint
 * 3. Proper cleanup methods
 * 4. No accumulating state between tests
 * 5. No vitest imports to avoid circular dependencies
 */

// Lightweight Y.Text mock
export class MockYText {
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

// Lightweight Y.Doc mock with cleanup
export class MockDoc {
  private types: Map<string, any> = new Map();
  private clientID: number = Math.floor(Math.random() * 1000000);
  private eventHandlers: Map<string, Set<(...args: any[]) => void>> = new Map();

  getText(name: string = 'default'): MockYText {
    if (!this.types.has(`text:${name}`)) {
      this.types.set(`text:${name}`, new MockYText());
    }
    return this.types.get(`text:${name}`);
  }

  getXmlFragment(name: string = 'default'): any {
    return {
      toString: () => this.getText(name).toString()
    };
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

  transact(fn: () => void, origin?: any): void {
    fn();
    this.emit('update', [new Uint8Array([1, 2, 3]), origin, this]);
  }

  destroy(): void {
    // CRITICAL: Clear all references to prevent memory leaks
    this.types.clear();
    this.eventHandlers.clear();
  }

  get clientId(): number {
    return this.clientID;
  }
}

// Lightweight Awareness mock
export class MockAwareness {
  private states: Map<number, any> = new Map();
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
    this.eventHandlers.clear();
  }
}

// Simple encoding functions (not wrapped in vi.fn())
export const encodeStateAsUpdate = (_doc: MockDoc): Uint8Array => {
  // TESTGUARD FIX: Return a valid Y.js update structure (minimum 4 bytes)
  // This satisfies our validateBinaryUpdate function's requirements
  // without implementing full Y.js binary protocol
  return new Uint8Array([0, 1, 1, 0, 0, 0, 0, 0]);
};

export const encodeStateVector = (_doc: MockDoc): Uint8Array => {
  return new Uint8Array([1, 0, 0]);
};

export const applyUpdate = (doc: MockDoc, update: Uint8Array, origin?: any): void => {
  doc.emit('update', [update, origin, doc]);
};

export const mergeUpdates = (_updates: Uint8Array[]): Uint8Array => {
  return new Uint8Array([1, 2, 3]);
};

export const diffUpdate = (update: Uint8Array, _stateVector: Uint8Array): Uint8Array => {
  return update;
};

// Create the mock export without any vitest dependencies
export const createYjsMock = () => ({
  Doc: MockDoc,
  Awareness: MockAwareness,
  encodeStateAsUpdate,
  encodeStateVector,
  applyUpdate,
  mergeUpdates,
  diffUpdate
});