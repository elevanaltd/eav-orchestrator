/**
 * CustomSupabaseProvider - Direct Supabase Integration for Y.js
 * 
 * Replaces y-supabase alpha package with production-ready implementation
 * Implementation-lead: consulted for CustomSupabaseProvider.ts integration
 * Critical-engineer: consulted for standard RLS policy integration + production blocker fixes
 * Critical-engineer: consulted for circuit breaker restoration with Opossum (2025-09-13)
 * Technical-architect: consulted for Y.js integration architecture validation
 * Error-architect: consulted for security migration implementation
 * Test-methodology-guardian: consulted for TDD discipline enforcement
 * 
 * PRODUCTION REQUIREMENTS:
 * - <200ms connection establishment
 * - 10-20 concurrent user support
 * - Conflict-free collaborative editing via Y.js CRDT
 * - Project-based RLS security with 5-role authorization
 * - Append-only updates preventing data corruption
 * - Retry mechanisms for resilience
 */

// Context7: consulted for yjs
// Context7: consulted for @supabase/supabase-js
// Context7: consulted for opossum
import * as Y from 'yjs';
import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { withRetry } from '../resilience/retryWithBackoff';
import CircuitBreaker from 'opossum';

export interface CustomSupabaseProviderConfig {
  supabaseClient: SupabaseClient;
  ydoc: Y.Doc;
  documentId: string;
  projectId: string; // CRITICAL: Required for RLS security
  tableName?: string;
  onSync?: () => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: any) => void;
}

export interface YjsDocument {
  id: string;
  content: Uint8Array;
  state_vector: Uint8Array;
  updated_at: string;
}

export class CustomSupabaseProvider {
  private supabaseClient: SupabaseClient;
  private ydoc: Y.Doc;
  private documentId: string;
  private projectId: string; // CRITICAL: Project-based security
  private tableName: string;
  private channel?: RealtimeChannel;
  private isConnected: boolean = false;
  private currentVersion: number = 1; // Optimistic locking
  
  // Circuit Breaker implementation per Critical Engineer requirements
  private loadInitialStateBreaker: CircuitBreaker;
  private setupRealtimeBreaker: CircuitBreaker;
  private persistUpdateBreaker: CircuitBreaker;
  
  // Offline queue for durable update storage
  public offlineQueue: Uint8Array[] = [];
  private readonly OFFLINE_QUEUE_KEY: string;
  
  // Event handlers for circuit breaker state changes
  private circuitBreakerStateChangeHandlers: ((state: string) => void)[] = [];
  private config: CustomSupabaseProviderConfig;

  constructor(config: CustomSupabaseProviderConfig) {
    this.config = config;
    this.supabaseClient = config.supabaseClient;
    this.ydoc = config.ydoc;
    this.documentId = config.documentId;
    this.projectId = config.projectId;
    this.tableName = config.tableName || 'yjs_documents';
    this.OFFLINE_QUEUE_KEY = `offline_queue_${this.documentId}`;
    
    // Initialize circuit breakers with Critical Engineer specified settings
    const circuitBreakerOptions = {
      timeout: 5000, // 5000ms timeout
      errorThresholdPercentage: 30, // 30% error threshold
      resetTimeout: 20000, // 20000ms reset timeout
      volumeThreshold: 5, // Minimum number of requests before considering error threshold
      name: 'CustomSupabaseProvider'
    };
    
    // Create circuit breakers for each critical operation
    this.loadInitialStateBreaker = new CircuitBreaker(this.loadInitialStateOperation.bind(this), {
      ...circuitBreakerOptions,
      name: 'loadInitialState'
    });
    
    this.setupRealtimeBreaker = new CircuitBreaker(this.setupRealtimeSubscriptionOperation.bind(this), {
      ...circuitBreakerOptions,
      name: 'setupRealtimeSubscription'
    });
    
    this.persistUpdateBreaker = new CircuitBreaker(this.persistUpdateOperation.bind(this), {
      ...circuitBreakerOptions,
      name: 'persistUpdate'
    });
    
    // Set up circuit breaker event handlers
    this.setupCircuitBreakerEvents();
    
    // Load any persisted offline queue
    this.loadOfflineQueue();
  }

  async connect(): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Load initial document state through circuit breaker
      await this.loadInitialStateBreaker.fire();
      
      // Set up real-time subscription through circuit breaker
      await this.setupRealtimeBreaker.fire();
      
      // Set up Y.js update handler
      this.setupYjsUpdateHandler();
      
      // Process any queued offline updates
      await this.drainOfflineQueue();
      
      this.isConnected = true;
      
      const connectionTime = performance.now() - startTime;
      console.log(`CustomSupabaseProvider connected in ${connectionTime.toFixed(2)}ms`);
      
    } catch (error) {
      console.error('CustomSupabaseProvider connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.channel) {
      await this.supabaseClient.removeChannel(this.channel);
    }
    this.isConnected = false;
  }

  private async loadInitialStateOperation(): Promise<void> {
    // CRITICAL FIX: Load document and apply proper CRDT replay
    try {
      // First, try to load the document (RLS will enforce access automatically)
      const { data: docData, error: docError } = await this.supabaseClient
        .from(this.tableName)
        .select('id, state_vector, version')
        .eq('id', this.documentId)
        .single();

      if (docError && docError.code !== 'PGRST116') { // PGRST116 = no rows
        throw new Error(`Failed to load document: ${docError.message}`);
      }

      if (docData) {
        this.currentVersion = docData.version || 1;

        // Load all updates for this document and replay them in order
        const { data: updatesData, error: updatesError } = await this.supabaseClient
          .rpc('get_yjs_document_updates_since', {
            p_document_id: this.documentId,
            p_since_sequence: 0 // Load all updates
          });

        if (updatesError) {
          throw new Error(`Failed to load document updates: ${updatesError.message}`);
        }

        // Apply updates in sequence order for proper CRDT state
        if (updatesData && updatesData.length > 0) {
          for (const update of updatesData) {
            if (update.update_data) {
              Y.applyUpdate(this.ydoc, new Uint8Array(update.update_data));
            }
          }
        }
      } else {
        // Document doesn't exist, will be created on first update
        console.log(`Document ${this.documentId} does not exist, will be created on first update`);
      }
    } catch (error) {
      console.error('Error loading initial state:', error);
      throw error;
    }
  }

  private async setupRealtimeSubscriptionOperation(): Promise<void> {
    // CRITICAL FIX: Listen to yjs_document_updates table for real-time collaboration
    // Use projectId for project-scoped channel naming
    this.channel = this.supabaseClient
      .channel(`yjs_updates_${this.projectId}_${this.documentId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public', 
        table: 'yjs_document_updates',
        filter: `document_id=eq.${this.documentId}`
      }, (payload) => {
        this.handleRemoteUpdate(payload);
      });

    await this.channel.subscribe();
    
    // Note: Channel subscription is asynchronous, check connection state if needed
    // The subscribe() method returns void, not a status string
  }

  private setupYjsUpdateHandler(): void {
    // CRITICAL FIX: Use update data parameter instead of encoding full state
    this.ydoc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== this) {
        // Only persist updates that didn't originate from this provider (avoid loops)
        this.persistUpdate(update);
      }
    });
  }

  public async loadInitialState(): Promise<void> {
    try {
      await this.loadInitialStateBreaker.fire();
    } catch (error) {
      console.error('Circuit breaker blocked or failed loadInitialState:', error);
      throw error;
    }
  }

  public async setupRealtimeSubscription(): Promise<void> {
    try {
      await this.setupRealtimeBreaker.fire();
    } catch (error) {
      console.error('Circuit breaker blocked or failed setupRealtimeSubscription:', error);
      throw error;
    }
  }

  public async persistUpdate(updateData: Uint8Array): Promise<void> {
    try {
      // Use circuit breaker for persist operation
      await this.persistUpdateBreaker.fire(updateData);
    } catch (error) {
      console.error('Circuit breaker blocked or failed persist operation:', error);
      // Queue update for offline processing when circuit is open
      await this.queueUpdate(updateData);
      throw error;
    }
  }

  private async persistUpdateOperation(updateData: Uint8Array): Promise<void> {
    // CRITICAL FIX: Use retry mechanism for resilience
    const persistOperation = async () => {
      const stateVector = Y.encodeStateVector(this.ydoc);

      // CRITICAL FIX: Use new append_yjs_update function with proper CRDT handling
      // projectId (this.projectId) is validated by RLS policies in database function
      const { data, error } = await this.supabaseClient.rpc('append_yjs_update', {
        p_document_id: this.documentId,
        p_update_data: Array.from(updateData), // Send incremental update, not full state
        p_new_state_vector: Array.from(stateVector),
        p_expected_version: this.currentVersion
      });

      if (error) {
        console.error('Failed to persist Y.js update:', error);
        throw error;
      }

      // Update version on success
      if (data && data[0]?.success && data[0]?.new_version) {
        this.currentVersion = data[0].new_version;
      }

      return data;
    };

    try {
      // Apply retry mechanism for resilience
      await withRetry(persistOperation, {
        maxRetries: 3,
        maxDelayMs: 1000
      });
    } catch (error) {
      console.error('Error persisting update after retries:', error);
      throw error;
    }
  }

  private handleRemoteUpdate(payload: { new?: { update_data?: number[], created_by?: string } }): void {
    if (payload.new && payload.new.update_data) {
      try {
        const remoteUpdate = new Uint8Array(payload.new.update_data);
        // Apply remote update to local Y.js document with this provider as origin
        // to prevent infinite loops
        Y.applyUpdate(this.ydoc, remoteUpdate, this);
      } catch (error) {
        console.error('Error applying remote update:', error);
      }
    }
  }

  get connected(): boolean {
    return this.isConnected;
  }

  get documentState(): Uint8Array {
    return Y.encodeStateAsUpdate(this.ydoc);
  }

  async destroy(): Promise<void> {
    await this.disconnect();
  }

  // Circuit Breaker Management Methods (required by tests)
  
  private setupCircuitBreakerEvents(): void {
    // Set up event handlers for all circuit breakers
    [this.loadInitialStateBreaker, this.setupRealtimeBreaker, this.persistUpdateBreaker].forEach(breaker => {
      breaker.on('open', () => {
        this.notifyCircuitBreakerStateChange('OPEN');
      });
      breaker.on('halfOpen', () => {
        this.notifyCircuitBreakerStateChange('HALF_OPEN');
      });
      breaker.on('close', () => {
        this.notifyCircuitBreakerStateChange('CLOSED');
      });
    });
  }

  private notifyCircuitBreakerStateChange(state: string): void {
    // Notify config callback if provided
    if (this.config.onStatusChange) {
      this.config.onStatusChange({
        circuitBreakerState: state
      });
    }
    
    // Notify additional handlers
    this.circuitBreakerStateChangeHandlers.forEach(handler => {
      try {
        handler(state);
      } catch (error) {
        console.error('Error in circuit breaker state change handler:', error);
      }
    });
  }

  public getCircuitBreakerConfig(): any {
    return {
      timeout: 5000,
      errorThresholdPercentage: 30,
      resetTimeout: 20000,
      volumeThreshold: 5,
      name: 'CustomSupabaseProvider'
    };
  }

  public getLoadInitialStateCircuitBreaker(): CircuitBreaker {
    return this.loadInitialStateBreaker;
  }

  public getSetupRealtimeCircuitBreaker(): CircuitBreaker {
    return this.setupRealtimeBreaker;
  }

  public getPersistUpdateCircuitBreaker(): CircuitBreaker {
    return this.persistUpdateBreaker;
  }

  // Getter for test compatibility - returns the primary circuit breaker (persistUpdate)
  get circuitBreaker(): any {
    const self = this;
    // Create a facade that exposes all breakers' functionality
    return {
      open: () => {
        self.loadInitialStateBreaker.open();
        self.setupRealtimeBreaker.open();
        self.persistUpdateBreaker.open();
      },
      halfOpen: () => {
        // Opossum doesn't have a halfOpen method, use fallback
        self.loadInitialStateBreaker.close();
        self.setupRealtimeBreaker.close();
        self.persistUpdateBreaker.close();
      },
      close: () => {
        self.loadInitialStateBreaker.close();
        self.setupRealtimeBreaker.close();
        self.persistUpdateBreaker.close();
      },
      fire: self.persistUpdateBreaker.fire.bind(self.persistUpdateBreaker),
      get opened() {
        return self.persistUpdateBreaker.opened;
      },
      get options() {
        return self.persistUpdateBreaker.options;
      },
      get stats() {
        return self.persistUpdateBreaker.stats;
      }
    };
  }

  public getCircuitBreakerState(): string {
    // Return the most restrictive state among all circuit breakers
    const states = [
      this.loadInitialStateBreaker.stats.state,
      this.setupRealtimeBreaker.stats.state,
      this.persistUpdateBreaker.stats.state
    ];
    
    if (states.includes('open')) return 'OPEN';
    if (states.includes('halfOpen')) return 'HALF_OPEN';
    return 'CLOSED';
  }

  public onCircuitBreakerStateChange(handler: (state: string) => void): void {
    this.circuitBreakerStateChangeHandlers.push(handler);
  }

  public getCircuitBreakerMetrics(): any {
    // Aggregate metrics from all circuit breakers
    const aggregatedMetrics = {
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      state: this.getCircuitBreakerState()
    };

    [this.loadInitialStateBreaker, this.setupRealtimeBreaker, this.persistUpdateBreaker].forEach(breaker => {
      const stats = breaker.stats;
      aggregatedMetrics.totalRequests += stats.fires;
      aggregatedMetrics.successCount += stats.successes;
      aggregatedMetrics.failureCount += stats.failures;
    });

    return aggregatedMetrics;
  }

  // Offline Queue Management Methods

  private loadOfflineQueue(): void {
    try {
      const stored = localStorage.getItem(this.OFFLINE_QUEUE_KEY);
      if (stored) {
        const parsedQueue = JSON.parse(stored);
        this.offlineQueue = parsedQueue.map((item: number[]) => new Uint8Array(item));
      }
    } catch (error) {
      console.error('Error loading offline queue from localStorage:', error);
      this.offlineQueue = [];
    }
  }

  private saveOfflineQueue(): void {
    try {
      const serializedQueue = this.offlineQueue.map(item => Array.from(item));
      localStorage.setItem(this.OFFLINE_QUEUE_KEY, JSON.stringify(serializedQueue));
    } catch (error) {
      console.error('Error saving offline queue to localStorage:', error);
    }
  }

  public async queueUpdate(updateData: Uint8Array): Promise<void> {
    this.offlineQueue.push(updateData);
    this.saveOfflineQueue();
  }

  public getOfflineQueue(): Uint8Array[] {
    return [...this.offlineQueue]; // Return copy to prevent external mutation
  }

  public getPersistedQueue(): Uint8Array[] {
    try {
      const stored = localStorage.getItem(this.OFFLINE_QUEUE_KEY);
      if (stored) {
        const parsedQueue = JSON.parse(stored);
        return parsedQueue.map((item: number[]) => new Uint8Array(item));
      }
      return [];
    } catch (error) {
      console.error('Error reading persisted queue:', error);
      return [];
    }
  }

  public async drainOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) return;

    const queueToProcess = [...this.offlineQueue];
    this.offlineQueue = [];
    this.saveOfflineQueue();

    for (const updateData of queueToProcess) {
      try {
        await this.persistUpdateOperation(updateData);
      } catch (error) {
        console.error('Error processing queued update:', error);
        // Re-queue failed updates
        await this.queueUpdate(updateData);
      }
    }
  }
}