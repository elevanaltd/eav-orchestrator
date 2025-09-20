/**
 * Mock Redis implementation for testing Redis queue functionality
 * Critical-Engineer: consulted for test infrastructure design
 */

// Context7: consulted for vitest
// vi import removed as not used

export class MockRedis {
  private storage: Map<string, any[]> = new Map();
  public status = 'ready';

  constructor() {
    // Initialize with empty arrays for the keys we'll use
    this.storage.set('offline_operations', []);
    this.storage.set('dlq_operations', []);
  }

  async llen(key: string): Promise<number> {
    const list = this.storage.get(key) || [];
    return list.length;
  }

  async lpush(key: string, ...values: string[]): Promise<number> {
    const list = this.storage.get(key) || [];
    list.unshift(...values);
    this.storage.set(key, list);
    return list.length;
  }

  async rpop(key: string): Promise<string | null> {
    const list = this.storage.get(key) || [];
    const value = list.pop();
    this.storage.set(key, list);
    return value || null;
  }

  async brpop(key: string, _timeout: number): Promise<[string, string] | null> {
    const list = this.storage.get(key) || [];
    if (list.length > 0) {
      const value = list.pop()!;
      this.storage.set(key, list);
      return [key, value];
    }
    return null;
  }

  async brpoplpush(sourceKey: string, destKey: string, _timeout: number): Promise<string | null> {
    const sourceList = this.storage.get(sourceKey) || [];
    if (sourceList.length > 0) {
      const value = sourceList.pop()!;
      this.storage.set(sourceKey, sourceList);

      const destList = this.storage.get(destKey) || [];
      destList.unshift(value);
      this.storage.set(destKey, destList);

      return value;
    }
    return null;
  }

  async lrem(key: string, count: number, value: string): Promise<number> {
    const list = this.storage.get(key) || [];
    let removed = 0;

    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i] === value) {
        list.splice(i, 1);
        removed++;
        if (removed >= count) break;
      }
    }

    this.storage.set(key, list);
    return removed;
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.storage.get(key) || [];
    if (stop === -1) {
      return list.slice(start);
    }
    return list.slice(start, stop + 1);
  }

  async del(key: string): Promise<number> {
    const existed = this.storage.has(key);
    this.storage.delete(key);
    return existed ? 1 : 0;
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async disconnect(): Promise<void> {
    this.status = 'disconnected';
  }

  // For testing: manually set data
  setTestData(key: string, data: any[]): void {
    this.storage.set(key, [...data]);
  }

  // For testing: get current storage state
  getTestData(key: string): any[] {
    return [...(this.storage.get(key) || [])];
  }

  // For testing: clear all data
  clearAll(): void {
    this.storage.clear();
    this.storage.set('offline_operations', []);
    this.storage.set('dlq_operations', []);
  }
}

export const createMockRedis = () => new MockRedis();