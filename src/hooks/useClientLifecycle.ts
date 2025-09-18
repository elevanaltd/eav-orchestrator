/**
 * useClientLifecycle Hook
 *
 * React hook that provides ClientLifecycleManager state subscription
 * and action methods for client lifecycle management.
 *
 * Features:
 * - Reactive state updates from lifecycle manager
 * - Stable function references for action methods
 * - Automatic cleanup on unmount
 * - Error handling for failed operations
 */

// Context7: consulted for react
import { useState, useEffect, useCallback, useRef } from 'react';
import { ClientLifecycleManager, type ClientLifecycleState, type ClientLifecycleConfig } from '../lib/lifecycle/clientLifecycleManager';

export interface UseClientLifecycleReturn {
  state: ClientLifecycleState;
  checkConnection: () => Promise<void>;
  forceRefresh: () => void;
}

/**
 * Hook for managing client lifecycle state and actions
 */
export function useClientLifecycle(config: ClientLifecycleConfig): UseClientLifecycleReturn {
  const managerRef = useRef<ClientLifecycleManager | null>(null);
  const [state, setState] = useState<ClientLifecycleState>('INITIALIZING');

  // Initialize manager only once
  useEffect(() => {
    const currentConfig = config;
    const manager = new ClientLifecycleManager(currentConfig);
    managerRef.current = manager;

    // Set initial state
    setState(manager.getCurrentState());

    // Subscribe to state changes
    const unsubscribe = manager.subscribe((newState) => {
      setState(newState);
    });

    // Initialize the manager
    manager.initialize().catch((error) => {
      console.warn('Failed to initialize client lifecycle:', error);
    });

    // Cleanup function
    return () => {
      try {
        unsubscribe();
      } catch (error) {
        console.warn('Error during unsubscribe:', error);
      }

      try {
        manager.dispose();
      } catch (error) {
        console.warn('Error disposing lifecycle manager:', error);
      }

      managerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- Manager intentionally created once

  // Stable function references using useCallback
  const checkConnection = useCallback(async (): Promise<void> => {
    if (managerRef.current) {
      try {
        await managerRef.current.checkConnection();
      } catch (error) {
        console.warn('Connection check failed:', error);
        // Don't rethrow - let the manager handle state transitions
      }
    }
  }, []);

  const forceRefresh = useCallback((): void => {
    if (managerRef.current) {
      try {
        managerRef.current.forceRefresh();
      } catch (error) {
        console.warn('Force refresh failed:', error);
      }
    }
  }, []);

  return {
    state,
    checkConnection,
    forceRefresh,
  };
}
