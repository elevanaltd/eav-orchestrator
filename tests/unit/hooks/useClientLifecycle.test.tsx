/**
 * useClientLifecycle Hook Tests
 * Tests for React hook that provides ClientLifecycleManager state subscription
 */

// Context7: consulted for vitest
// Context7: consulted for @testing-library/react
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClientLifecycle } from '../../../src/hooks/useClientLifecycle';
import { ClientLifecycleManager, type ClientLifecycleState } from '../../../src/lib/lifecycle/clientLifecycleManager';

// Mock the ClientLifecycleManager
vi.mock('../../../src/lib/lifecycle/clientLifecycleManager', () => {
  const MockClientLifecycleManager = vi.fn();
  MockClientLifecycleManager.prototype.getCurrentState = vi.fn();
  MockClientLifecycleManager.prototype.subscribe = vi.fn();
  MockClientLifecycleManager.prototype.initialize = vi.fn();
  MockClientLifecycleManager.prototype.checkConnection = vi.fn();
  MockClientLifecycleManager.prototype.forceRefresh = vi.fn();
  MockClientLifecycleManager.prototype.dispose = vi.fn();

  return {
    ClientLifecycleManager: MockClientLifecycleManager,
  };
});

describe('useClientLifecycle', () => {
  let mockManager: any;
  let mockSubscribe: any;
  let mockUnsubscribe: any;

  beforeEach(() => {
    mockUnsubscribe = vi.fn();
    mockSubscribe = vi.fn().mockReturnValue(mockUnsubscribe);

    mockManager = {
      getCurrentState: vi.fn().mockReturnValue('INITIALIZING'),
      subscribe: mockSubscribe,
      initialize: vi.fn().mockResolvedValue(undefined),
      checkConnection: vi.fn().mockResolvedValue(undefined),
      forceRefresh: vi.fn(),
      dispose: vi.fn(),
    };

    (ClientLifecycleManager as any).mockImplementation(() => mockManager);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Hook Initialization', () => {
    it('should create manager instance with correct config', () => {
      const config = {
        currentVersion: '1.0.0',
        versionEndpoint: '/api/version'
      };

      renderHook(() => useClientLifecycle(config));

      expect(ClientLifecycleManager).toHaveBeenCalledWith(config);
    });

    it('should initialize state with current manager state', () => {
      mockManager.getCurrentState.mockReturnValue('HEALTHY');

      const { result } = renderHook(() => useClientLifecycle({
        currentVersion: '1.0.0',
        versionEndpoint: '/api/version'
      }));

      expect(result.current.state).toBe('HEALTHY');
    });

    it('should subscribe to state changes on mount', () => {
      renderHook(() => useClientLifecycle({
        currentVersion: '1.0.0',
        versionEndpoint: '/api/version'
      }));

      expect(mockManager.subscribe).toHaveBeenCalledTimes(1);
      expect(typeof mockManager.subscribe.mock.calls[0][0]).toBe('function');
    });

    it('should call initialize on mount', () => {
      renderHook(() => useClientLifecycle({
        currentVersion: '1.0.0',
        versionEndpoint: '/api/version'
      }));

      expect(mockManager.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('State Updates', () => {
    it('should update state when manager notifies of changes', () => {
      const { result } = renderHook(() => useClientLifecycle({
        currentVersion: '1.0.0',
        versionEndpoint: '/api/version'
      }));

      // Get the callback function passed to subscribe
      const stateChangeCallback = mockManager.subscribe.mock.calls[0][0];

      // Simulate state change
      act(() => {
        stateChangeCallback('OFFLINE');
      });

      expect(result.current.state).toBe('OFFLINE');
    });

    it('should handle multiple state transitions', () => {
      const { result } = renderHook(() => useClientLifecycle({
        currentVersion: '1.0.0',
        versionEndpoint: '/api/version'
      }));

      const stateChangeCallback = mockManager.subscribe.mock.calls[0][0];

      // Multiple state transitions
      act(() => {
        stateChangeCallback('SYNCING');
      });
      expect(result.current.state).toBe('SYNCING');

      act(() => {
        stateChangeCallback('HEALTHY');
      });
      expect(result.current.state).toBe('HEALTHY');

      act(() => {
        stateChangeCallback('UPDATE_REQUIRED');
      });
      expect(result.current.state).toBe('UPDATE_REQUIRED');
    });
  });

  describe('Action Methods', () => {
    it('should expose checkConnection method', async () => {
      const { result } = renderHook(() => useClientLifecycle({
        currentVersion: '1.0.0',
        versionEndpoint: '/api/version'
      }));

      await act(async () => {
        await result.current.checkConnection();
      });

      expect(mockManager.checkConnection).toHaveBeenCalledTimes(1);
    });

    it('should expose forceRefresh method', () => {
      const { result } = renderHook(() => useClientLifecycle({
        currentVersion: '1.0.0',
        versionEndpoint: '/api/version'
      }));

      act(() => {
        result.current.forceRefresh();
      });

      expect(mockManager.forceRefresh).toHaveBeenCalledTimes(1);
    });

    it('should handle checkConnection errors gracefully', async () => {
      const error = new Error('Connection failed');
      mockManager.checkConnection.mockRejectedValue(error);

      const { result } = renderHook(() => useClientLifecycle({
        currentVersion: '1.0.0',
        versionEndpoint: '/api/version'
      }));

      // Should not throw
      await act(async () => {
        await result.current.checkConnection();
      });

      expect(mockManager.checkConnection).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe from manager on unmount', () => {
      const { unmount } = renderHook(() => useClientLifecycle({
        currentVersion: '1.0.0',
        versionEndpoint: '/api/version'
      }));

      unmount();

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it('should dispose manager on unmount', () => {
      const { unmount } = renderHook(() => useClientLifecycle({
        currentVersion: '1.0.0',
        versionEndpoint: '/api/version'
      }));

      unmount();

      expect(mockManager.dispose).toHaveBeenCalledTimes(1);
    });

    it('should handle cleanup even if unsubscribe fails', () => {
      mockUnsubscribe.mockImplementation(() => {
        throw new Error('Unsubscribe failed');
      });

      const { unmount } = renderHook(() => useClientLifecycle({
        currentVersion: '1.0.0',
        versionEndpoint: '/api/version'
      }));

      // Should not throw
      expect(() => unmount()).not.toThrow();
      expect(mockManager.dispose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Return Value', () => {
    it('should return current state and action methods', () => {
      const { result } = renderHook(() => useClientLifecycle({
        currentVersion: '1.0.0',
        versionEndpoint: '/api/version'
      }));

      expect(result.current).toEqual({
        state: 'INITIALIZING',
        checkConnection: expect.any(Function),
        forceRefresh: expect.any(Function),
      });
    });

    it('should maintain stable function references across renders', () => {
      const { result, rerender } = renderHook(() => useClientLifecycle({
        currentVersion: '1.0.0',
        versionEndpoint: '/api/version'
      }));

      const firstCheckConnection = result.current.checkConnection;
      const firstForceRefresh = result.current.forceRefresh;

      rerender();

      expect(result.current.checkConnection).toBe(firstCheckConnection);
      expect(result.current.forceRefresh).toBe(firstForceRefresh);
    });
  });

  describe('Edge Cases', () => {
    it('should handle manager initialization failure', () => {
      mockManager.initialize.mockRejectedValue(new Error('Init failed'));

      // Should not throw during hook initialization
      expect(() => {
        renderHook(() => useClientLifecycle({
          currentVersion: '1.0.0',
          versionEndpoint: '/api/version'
        }));
      }).not.toThrow();
    });

    it('should work with different config parameters', () => {
      const config = {
        currentVersion: '2.1.5',
        versionEndpoint: '/custom/version',
        maxRetries: 5,
        retryIntervals: [500, 1000, 2000]
      };

      renderHook(() => useClientLifecycle(config));

      expect(ClientLifecycleManager).toHaveBeenCalledWith(config);
    });
  });
});