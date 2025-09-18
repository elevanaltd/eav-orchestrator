/**
 * IndexedDB Queue Implementation with Fallback Chain
 *
 * Implementation-Lead: IndexedDB queue for offline operation persistence
 * with graceful fallbacks to localStorage and memory storage
 */

export type StorageType = 'indexeddb' | 'localstorage' | 'memory';

/**
 * Queue item stored in IndexedDB
 */
interface QueueItem {
  id?: number; // Auto-increment primary key
  documentId: string;
  data: Uint8Array;
  timestamp: number;
}

/**
 * IndexedDB Queue with fallback chain for offline operation persistence
 */
export class IndexedDBQueue {
  private db: IDBDatabase | null = null;
  private documentId: string;
  private _storageType: StorageType = 'memory';
  private _isReady: boolean = false;
  private memoryQueue: Uint8Array[] = [];

  // Database configuration
  private static readonly DB_NAME = 'offline-queue-db';
  private static readonly DB_VERSION = 1;
  private static readonly STORE_NAME = 'operations';

  constructor(documentId: string) {
    this.documentId = documentId;
  }

  /**
   * Initialize the queue with IndexedDB and fallback chain
   */
  async initialize(): Promise<void> {
    try {
      // Try IndexedDB first
      await this.initializeIndexedDB();
      this._storageType = 'indexeddb';
      this._isReady = true;

      // Migrate data from localStorage if it exists
      await this.migrateFromLocalStorage();
    } catch (error) {
      console.warn('IndexedDB initialization failed, falling back to localStorage:', error);

      try {
        // Fallback to localStorage
        this.initializeLocalStorage();
        this._storageType = 'localstorage';
        this._isReady = true;
      } catch (_localStorageError) {
        console.warn('localStorage initialization failed, falling back to memory:', _localStorageError);

        // Final fallback to memory
        this.initializeMemory();
        this._storageType = 'memory';
        this._isReady = true;
      }
    }
  }

  /**
   * Initialize IndexedDB
   */
  private async initializeIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if IndexedDB is available
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = window.indexedDB.open(IndexedDBQueue.DB_NAME, IndexedDBQueue.DB_VERSION);

      request.onerror = () => {
        reject(new Error(`IndexedDB open failed: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store for queue operations
        if (!db.objectStoreNames.contains(IndexedDBQueue.STORE_NAME)) {
          const store = db.createObjectStore(IndexedDBQueue.STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true
          });

          // Index by documentId for efficient filtering
          store.createIndex('documentId', 'documentId', { unique: false });

          // Index by timestamp for ordering
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Initialize localStorage fallback
   */
  private initializeLocalStorage(): void {
    if (!window.localStorage) {
      throw new Error('localStorage not available');
    }

    // Test localStorage accessibility (can fail in private browsing)
    try {
      const testKey = '__indexeddb_queue_test__';
      window.localStorage.setItem(testKey, 'test');
      window.localStorage.removeItem(testKey);
    } catch {
      throw new Error('localStorage not accessible');
    }
  }

  /**
   * Initialize memory storage fallback
   */
  private initializeMemory(): void {
    this.memoryQueue = [];
  }

  /**
   * Migrate existing localStorage data to IndexedDB
   */
  private async migrateFromLocalStorage(): Promise<void> {
    if (this._storageType !== 'indexeddb') return;

    const legacyKey = `offline_queue_${this.documentId}`;

    try {
      const stored = window.localStorage?.getItem(legacyKey);
      if (!stored) return;

      const parsedQueue = JSON.parse(stored);
      if (Array.isArray(parsedQueue) && parsedQueue.length > 0) {
        console.log(`Migrating ${parsedQueue.length} operations from localStorage to IndexedDB`);

        // Migrate each operation
        for (const item of parsedQueue) {
          if (Array.isArray(item)) {
            const data = new Uint8Array(item);
            await this.enqueue(data);
          }
        }

        // Clear localStorage after successful migration
        window.localStorage.removeItem(legacyKey);
        console.log('Migration complete, localStorage cleared');
      }
    } catch (_error) {
      console.warn('Migration from localStorage failed:', _error);
      // Don't fail initialization due to migration errors
    }
  }

  /**
   * Enqueue operation data
   */
  async enqueue(data: Uint8Array): Promise<boolean> {
    if (!this._isReady) {
      throw new Error('Queue not initialized');
    }

    try {
      switch (this._storageType) {
        case 'indexeddb':
          return await this.enqueueIndexedDB(data);
        case 'localstorage':
          return this.enqueueLocalStorage(data);
        case 'memory':
          return this.enqueueMemory(data);
        default:
          throw new Error(`Unknown storage type: ${this._storageType}`);
      }
    } catch (error) {
      console.error('Enqueue operation failed:', error);
      return false;
    }
  }

  /**
   * Dequeue operation data (FIFO)
   */
  async dequeue(): Promise<Uint8Array | null> {
    if (!this._isReady) {
      throw new Error('Queue not initialized');
    }

    switch (this._storageType) {
      case 'indexeddb':
        return await this.dequeueIndexedDB();
      case 'localstorage':
        return this.dequeueLocalStorage();
      case 'memory':
        return this.dequeueMemory();
      default:
        throw new Error(`Unknown storage type: ${this._storageType}`);
    }
  }

  /**
   * Peek at next operation without removing it
   */
  async peek(): Promise<Uint8Array | null> {
    if (!this._isReady) {
      throw new Error('Queue not initialized');
    }

    switch (this._storageType) {
      case 'indexeddb':
        return await this.peekIndexedDB();
      case 'localstorage':
        return this.peekLocalStorage();
      case 'memory':
        return this.peekMemory();
      default:
        throw new Error(`Unknown storage type: ${this._storageType}`);
    }
  }

  /**
   * Get queue size
   */
  async size(): Promise<number> {
    if (!this._isReady) {
      throw new Error('Queue not initialized');
    }

    switch (this._storageType) {
      case 'indexeddb':
        return await this.sizeIndexedDB();
      case 'localstorage':
        return this.sizeLocalStorage();
      case 'memory':
        return this.sizeMemory();
      default:
        throw new Error(`Unknown storage type: ${this._storageType}`);
    }
  }

  /**
   * Clear all operations from queue
   */
  async clear(): Promise<void> {
    if (!this._isReady) {
      throw new Error('Queue not initialized');
    }

    switch (this._storageType) {
      case 'indexeddb':
        return await this.clearIndexedDB();
      case 'localstorage':
        return this.clearLocalStorage();
      case 'memory':
        return this.clearMemory();
      default:
        throw new Error(`Unknown storage type: ${this._storageType}`);
    }
  }

  /**
   * Close the queue and clean up resources
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this._isReady = false;
  }

  // Getters for testing and monitoring
  get storageType(): StorageType {
    return this._storageType;
  }

  get isReady(): boolean {
    return this._isReady;
  }

  // IndexedDB implementation methods
  private async enqueueIndexedDB(data: Uint8Array): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const transaction = this.db.transaction([IndexedDBQueue.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(IndexedDBQueue.STORE_NAME);

      const item: QueueItem = {
        documentId: this.documentId,
        data: data,
        timestamp: Date.now()
      };

      const request = store.add(item);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  private async dequeueIndexedDB(): Promise<Uint8Array | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const transaction = this.db.transaction([IndexedDBQueue.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(IndexedDBQueue.STORE_NAME);
      const index = store.index('documentId');

      // Get the first item for this document (oldest due to auto-increment key)
      const request = index.openCursor(IDBKeyRange.only(this.documentId));

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const item: QueueItem = cursor.value;
          cursor.delete(); // Remove from queue
          resolve(item.data);
        } else {
          resolve(null); // Queue empty
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async peekIndexedDB(): Promise<Uint8Array | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const transaction = this.db.transaction([IndexedDBQueue.STORE_NAME], 'readonly');
      const store = transaction.objectStore(IndexedDBQueue.STORE_NAME);
      const index = store.index('documentId');

      // Get the first item for this document (oldest due to auto-increment key)
      const request = index.openCursor(IDBKeyRange.only(this.documentId));

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const item: QueueItem = cursor.value;
          resolve(item.data);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  private async sizeIndexedDB(): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const transaction = this.db.transaction([IndexedDBQueue.STORE_NAME], 'readonly');
      const store = transaction.objectStore(IndexedDBQueue.STORE_NAME);
      const index = store.index('documentId');

      const request = index.count(IDBKeyRange.only(this.documentId));

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async clearIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('IndexedDB not initialized'));
        return;
      }

      const transaction = this.db.transaction([IndexedDBQueue.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(IndexedDBQueue.STORE_NAME);
      const index = store.index('documentId');

      const deletePromises: Promise<void>[] = [];
      const request = index.openCursor(IDBKeyRange.only(this.documentId));

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          deletePromises.push(
            new Promise<void>((deleteResolve, deleteReject) => {
              const deleteRequest = cursor.delete();
              deleteRequest.onsuccess = () => deleteResolve();
              deleteRequest.onerror = () => deleteReject(deleteRequest.error);
            })
          );
          cursor.continue();
        } else {
          // All cursors processed, wait for all deletes to complete
          Promise.all(deletePromises)
            .then(() => resolve())
            .catch(reject);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  // localStorage implementation methods
  private getLocalStorageKey(): string {
    return `offline_queue_${this.documentId}`;
  }

  private getLocalStorageQueue(): Uint8Array[] {
    try {
      const stored = window.localStorage.getItem(this.getLocalStorageKey());
      if (stored) {
        const parsedQueue = JSON.parse(stored);
        return parsedQueue.map((item: number[]) => new Uint8Array(item));
      }
      return [];
    } catch (error) {
      console.error('Error reading localStorage queue:', error);
      return [];
    }
  }

  private saveLocalStorageQueue(queue: Uint8Array[]): void {
    try {
      const serializedQueue = queue.map(item => Array.from(item));
      window.localStorage.setItem(this.getLocalStorageKey(), JSON.stringify(serializedQueue));
    } catch (error) {
      console.error('Error saving localStorage queue:', error);
      throw error;
    }
  }

  private enqueueLocalStorage(data: Uint8Array): boolean {
    try {
      const queue = this.getLocalStorageQueue();
      queue.push(data);
      this.saveLocalStorageQueue(queue);
      return true;
    } catch {
      return false;
    }
  }

  private dequeueLocalStorage(): Uint8Array | null {
    try {
      const queue = this.getLocalStorageQueue();
      if (queue.length === 0) return null;

      const item = queue.shift()!;
      this.saveLocalStorageQueue(queue);
      return item;
    } catch {
      return null;
    }
  }

  private peekLocalStorage(): Uint8Array | null {
    try {
      const queue = this.getLocalStorageQueue();
      return queue.length > 0 ? queue[0] : null;
    } catch {
      return null;
    }
  }

  private sizeLocalStorage(): number {
    try {
      const queue = this.getLocalStorageQueue();
      return queue.length;
    } catch {
      return 0;
    }
  }

  private clearLocalStorage(): void {
    try {
      window.localStorage.removeItem(this.getLocalStorageKey());
    } catch (error) {
      console.error('Error clearing localStorage queue:', error);
    }
  }

  // Memory implementation methods
  private enqueueMemory(data: Uint8Array): boolean {
    this.memoryQueue.push(data);
    return true;
  }

  private dequeueMemory(): Uint8Array | null {
    return this.memoryQueue.shift() || null;
  }

  private peekMemory(): Uint8Array | null {
    return this.memoryQueue.length > 0 ? this.memoryQueue[0] : null;
  }

  private sizeMemory(): number {
    return this.memoryQueue.length;
  }

  private clearMemory(): void {
    this.memoryQueue = [];
  }
}