/**
 * Client Lifecycle & Resilience Manager
 *
 * Unified state machine for managing client lifecycle states:
 * INITIALIZING -> HEALTHY | OFFLINE | UPDATE_REQUIRED
 * OFFLINE -> SYNCING -> HEALTHY
 *
 * Handles:
 * - Version coordination with server
 * - Schema migration detection
 * - Network connectivity monitoring
 * - Observable state changes
 */

export type ClientLifecycleState =
  | 'INITIALIZING'
  | 'HEALTHY'
  | 'OFFLINE'
  | 'SYNCING'
  | 'UPDATE_REQUIRED';

export interface VersionInfo {
  version: string;
  schemaVersion: number;
}

export interface ClientLifecycleConfig {
  currentVersion: string;
  versionEndpoint: string;
  retryIntervals?: number[]; // Exponential backoff intervals
  maxRetries?: number;
}

type StateChangeListener = (state: ClientLifecycleState) => void;

export class ClientLifecycleManager {
  private currentState: ClientLifecycleState = 'INITIALIZING';
  private listeners: Set<StateChangeListener> = new Set();
  private config: ClientLifecycleConfig;
  private retryCount = 0;
  private retryTimeout: number | null = null;

  constructor(config: ClientLifecycleConfig) {
    this.config = {
      retryIntervals: [1000, 2000, 5000, 10000], // Default exponential backoff
      maxRetries: 3,
      ...config
    };
  }

  /**
   * Get current lifecycle state
   */
  getCurrentState(): ClientLifecycleState {
    return this.currentState;
  }

  /**
   * Set state and notify all subscribers
   */
  setState(newState: ClientLifecycleState): void {
    if (this.currentState !== newState) {
      this.currentState = newState;
      this.notifyListeners(newState);
    }
  }

  /**
   * Subscribe to state changes
   * Returns unsubscribe function
   */
  subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);

    // Immediately notify new subscriber of current state
    listener(this.currentState);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Initialize the client lifecycle
   * Performs version check and sets initial state
   */
  async initialize(): Promise<void> {
    try {
      const serverVersion = await this.fetchServerVersion();

      if (this.isUpdateRequired(serverVersion, this.config.currentVersion)) {
        this.setState('UPDATE_REQUIRED');
      } else {
        this.setState('HEALTHY');
        this.retryCount = 0; // Reset retry count on success
      }
    } catch (error) {
      console.warn('Failed to initialize client lifecycle:', error);
      this.setState('OFFLINE');
      this.scheduleRetry();
    }
  }

  /**
   * Check connection and attempt to come back online
   */
  async checkConnection(): Promise<void> {
    if (this.currentState === 'OFFLINE') {
      this.setState('SYNCING');

      try {
        const serverVersion = await this.fetchServerVersion();

        if (this.isUpdateRequired(serverVersion, this.config.currentVersion)) {
          this.setState('UPDATE_REQUIRED');
        } else {
          // Don't immediately go to HEALTHY - let completeSync() handle that
          this.retryCount = 0;
        }
      } catch (error) {
        console.warn('Connection check failed:', error);
        this.setState('OFFLINE');
        this.scheduleRetry();
      }
    }
  }

  /**
   * Complete synchronization process and return to healthy state
   */
  async completeSync(): Promise<void> {
    if (this.currentState === 'SYNCING') {
      this.setState('HEALTHY');
    }
  }

  /**
   * Determine if client update is required
   */
  isUpdateRequired(serverVersion: VersionInfo, clientVersion: string): boolean {
    // Check schema version first - always requires update if different
    if (serverVersion.schemaVersion !== this.getCurrentSchemaVersion()) {
      return true;
    }

    // Parse semantic versions
    const serverSemVer = this.parseVersion(serverVersion.version);
    const clientSemVer = this.parseVersion(clientVersion);

    // Major or minor version changes require update
    // Patch version differences are compatible
    return (
      serverSemVer.major > clientSemVer.major ||
      (serverSemVer.major === clientSemVer.major && serverSemVer.minor > clientSemVer.minor)
    );
  }

  /**
   * Force refresh the page (used for UPDATE_REQUIRED state)
   */
  forceRefresh(): void {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  /**
   * Cleanup timers and listeners
   */
  dispose(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    this.listeners.clear();
  }

  // Private methods

  private async fetchServerVersion(): Promise<VersionInfo> {
    const response = await fetch(this.config.versionEndpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      // Don't cache version requests
      cache: 'no-cache'
    });

    if (!response.ok) {
      throw new Error(`Version check failed: ${response.status}`);
    }

    const data = await response.json();

    // Validate response structure
    if (!data.version || typeof data.schemaVersion !== 'number') {
      throw new Error('Invalid version response format');
    }

    return data as VersionInfo;
  }

  private getCurrentSchemaVersion(): number {
    // This should be incremented whenever schema changes
    // Could be loaded from package.json or environment
    return 1;
  }

  private parseVersion(version: string): { major: number; minor: number; patch: number } {
    const parts = version.split('.').map(Number);
    return {
      major: parts[0] || 0,
      minor: parts[1] || 0,
      patch: parts[2] || 0
    };
  }

  private notifyListeners(state: ClientLifecycleState): void {
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in lifecycle state listener:', error);
      }
    });
  }

  private scheduleRetry(): void {
    if (this.retryCount >= (this.config.maxRetries || 3)) {
      return; // Max retries reached
    }

    const intervals = this.config.retryIntervals || [1000, 2000, 5000, 10000];
    const interval = intervals[Math.min(this.retryCount, intervals.length - 1)];

    this.retryTimeout = window.setTimeout(() => {
      this.retryCount++;
      this.checkConnection();
    }, interval);
  }
}
