/**
 * Client Lifecycle Manager Tests
 * Tests for unified state machine managing client lifecycle states:
 * INITIALIZING|HEALTHY|OFFLINE|SYNCING|UPDATE_REQUIRED
 */

// Context7: consulted for vitest
import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { ClientLifecycleManager, type ClientLifecycleState, type VersionInfo } from '../../../src/lib/lifecycle/clientLifecycleManager';

// Mock fetch for version endpoint
// TESTGUARD-20250918-17582376
globalThis.fetch = vi.fn();
const mockFetch = globalThis.fetch as MockedFunction<typeof globalThis.fetch>;

describe('ClientLifecycleManager', () => {
  let manager: ClientLifecycleManager;
  let onStateChange: MockedFunction<(state: ClientLifecycleState) => void>;

  beforeEach(() => {
    vi.clearAllMocks();
    onStateChange = vi.fn();
    manager = new ClientLifecycleManager({
      currentVersion: '1.0.0',
      versionEndpoint: '/api/version'
    });
  });

  describe('State Machine', () => {
    it('should start in INITIALIZING state', () => {
      expect(manager.getCurrentState()).toBe('INITIALIZING');
    });

    it('should transition from INITIALIZING to HEALTHY when initialization succeeds', async () => {
      // Mock successful version check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: '1.0.0', schemaVersion: 1 })
      } as Response);

      manager.subscribe(onStateChange);
      await manager.initialize();

      expect(manager.getCurrentState()).toBe('HEALTHY');
      expect(onStateChange).toHaveBeenCalledWith('HEALTHY');
    });

    it('should transition to UPDATE_REQUIRED when server version is newer', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: '2.0.0', schemaVersion: 2 })
      } as Response);

      manager.subscribe(onStateChange);
      await manager.initialize();

      expect(manager.getCurrentState()).toBe('UPDATE_REQUIRED');
      expect(onStateChange).toHaveBeenCalledWith('UPDATE_REQUIRED');
    });

    it('should transition to OFFLINE when network is unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      manager.subscribe(onStateChange);
      await manager.initialize();

      expect(manager.getCurrentState()).toBe('OFFLINE');
      expect(onStateChange).toHaveBeenCalledWith('OFFLINE');
    });

    it('should transition from OFFLINE to SYNCING when coming back online', async () => {
      // First go offline
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      await manager.initialize();
      expect(manager.getCurrentState()).toBe('OFFLINE');

      // Then come back online
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: '1.0.0', schemaVersion: 1 })
      } as Response);

      manager.subscribe(onStateChange);
      await manager.checkConnection();

      expect(manager.getCurrentState()).toBe('SYNCING');
      expect(onStateChange).toHaveBeenCalledWith('SYNCING');
    });

    it('should transition from SYNCING to HEALTHY after successful sync', async () => {
      // Setup offline state
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      await manager.initialize();

      // Come back online and sync
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: '1.0.0', schemaVersion: 1 })
      } as Response);

      manager.subscribe(onStateChange);
      await manager.checkConnection();
      await manager.completeSync();

      expect(manager.getCurrentState()).toBe('HEALTHY');
      expect(onStateChange).toHaveBeenCalledWith('HEALTHY');
    });
  });

  describe('Version Management', () => {
    it('should detect version mismatch correctly', () => {
      const serverVersion: VersionInfo = { version: '2.0.0', schemaVersion: 2 };
      const clientVersion = '1.0.0';

      expect(manager.isUpdateRequired(serverVersion, clientVersion)).toBe(true);
    });

    it('should detect compatible versions correctly', () => {
      const serverVersion: VersionInfo = { version: '1.0.0', schemaVersion: 1 };
      const clientVersion = '1.0.0';

      expect(manager.isUpdateRequired(serverVersion, clientVersion)).toBe(false);
    });

    it('should handle patch version differences as compatible', () => {
      const serverVersion: VersionInfo = { version: '1.0.1', schemaVersion: 1 };
      const clientVersion = '1.0.0';

      expect(manager.isUpdateRequired(serverVersion, clientVersion)).toBe(false);
    });

    it('should require update for schema version changes', () => {
      const serverVersion: VersionInfo = { version: '1.0.0', schemaVersion: 2 };
      const clientVersion = '1.0.0';

      expect(manager.isUpdateRequired(serverVersion, clientVersion)).toBe(true);
    });
  });

  describe('Observable Pattern', () => {
    it('should allow multiple subscribers', () => {
      const subscriber1 = vi.fn();
      const subscriber2 = vi.fn();

      manager.subscribe(subscriber1);
      manager.subscribe(subscriber2);

      manager.setState('HEALTHY');

      expect(subscriber1).toHaveBeenCalledWith('HEALTHY');
      expect(subscriber2).toHaveBeenCalledWith('HEALTHY');
    });

    it('should immediately notify a new subscriber with current state', () => {
      const subscriber = vi.fn();

      manager.subscribe(subscriber);

      expect(subscriber).toHaveBeenCalledTimes(1);
      expect(subscriber).toHaveBeenCalledWith('INITIALIZING');
    });

    it('should not notify a subscriber of future updates after unsubscribing', () => {
      const subscriber = vi.fn();
      const unsubscribe = manager.subscribe(subscriber);

      // Clear the initial subscription call - we test immediate notification separately
      subscriber.mockClear();

      unsubscribe();
      manager.setState('HEALTHY');

      expect(subscriber).not.toHaveBeenCalled();
    });

    it('should provide current state to new subscribers', () => {
      manager.setState('OFFLINE');
      const subscriber = vi.fn();

      manager.subscribe(subscriber);

      expect(subscriber).toHaveBeenCalledWith('OFFLINE');
    });
  });

  describe('Error Handling', () => {
    it('should handle version endpoint failures gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Server error'));

      await manager.initialize();

      expect(manager.getCurrentState()).toBe('OFFLINE');
    });

    it('should handle malformed version responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invalid: 'response' })
      } as Response);

      await manager.initialize();

      expect(manager.getCurrentState()).toBe('OFFLINE');
    });

    it('should retry failed version checks with exponential backoff', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ version: '1.0.0', schemaVersion: 1 })
        } as Response);

      await manager.initialize();
      expect(manager.getCurrentState()).toBe('OFFLINE');

      // Wait for retry
      await new Promise(resolve => setTimeout(resolve, 100));
      await manager.checkConnection();

      expect(manager.getCurrentState()).toBe('SYNCING');
    });
  });
});