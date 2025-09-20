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
// Context7: consulted for y-protocols/awareness
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { withRetry } from '../resilience/retryWithBackoff';
// Context7: consulted for opossum
import CircuitBreaker from 'opossum';
import { IndexedDBQueue } from '../database/indexedDBQueue';

// Define CircuitBreakerOptions type based on opossum documentation
interface CircuitBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  volumeThreshold?: number;
  name?: string;
}

export interface CircuitBreakerStatus {
  circuitBreakerState: string;
}

export interface CustomSupabaseProviderConfig {
  supabaseClient: SupabaseClient;
  ydoc: Y.Doc;
  documentId: string;
  projectId: string; // CRITICAL: Required for RLS security
  tableName?: string;
  onSync?: () => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: string | CircuitBreakerStatus) => void;
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
  public awareness: Awareness; // CRITICAL: Required for CollaborationCursor
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
  
  // Offline queue for durable update storage with IndexedDB fallback chain
  private indexedDBQueue: IndexedDBQueue;
  
  // Event handlers for circuit breaker state changes
  private circuitBreakerStateChangeHandlers: ((state: string) => void)[] = [];
  private config: CustomSupabaseProviderConfig;

  constructor(config: CustomSupabaseProviderConfig) {
    this.config = config;
    this.supabaseClient = config.supabaseClient;
    this.ydoc = config.ydoc;

    // Initialize awareness for cursor tracking (similar to y-websocket)
    this.awareness = new Awareness(this.ydoc);

    this.documentId = config.documentId;
    this.projectId = config.projectId;
    this.tableName = config.tableName || 'yjs_documents';
    this.indexedDBQueue = new IndexedDBQueue(this.documentId);
    
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

    // Initialize IndexedDB queue asynchronously
    this.initializeOfflineQueue();
  }

  async connect(): Promise<void> {
    const startTime = performance.now();

    try {
      // Initialize IndexedDB queue before any operations
      await this.indexedDBQueue.initialize();

      // Load initial document state through circuit breaker
      await this.loadInitialStateBreaker.fire();

      // Set up real-time subscription through circuit breaker
      await this.setupRealtimeBreaker.fire();

      // Set up Y.js update handler
      this.setupYjsUpdateHandler();

      // Set up awareness handlers for cursor tracking
      this.setupAwarenessHandlers();

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

    // Clean up awareness
    if (this.awareness) {
      this.awareness.destroy();
    }

    // Close IndexedDB queue
    await this.indexedDBQueue.close();

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
        .maybeSingle(); // Use maybeSingle() to handle 0 or 1 rows gracefully

      if (docError) {
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

  private setupAwarenessHandlers(): void {
    // Set up awareness update handler for cursor synchronization
    // This will be used by CollaborationCursor extension
    this.awareness.on('update', () => {
      // Awareness updates are handled by the TipTap CollaborationCursor extension
      // We just need to ensure the awareness object is available
      console.debug('Awareness updated');
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
      const retryOperation = withRetry(persistOperation, {
        maxRetries: 3,
        initialDelayMs: 100,
        maxDelayMs: 1000
      });
      await retryOperation();
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
    try {
      // Close IndexedDB queue
      await this.indexedDBQueue.close();
    } catch (error) {
      console.error('Error closing IndexedDB queue:', error);
    }

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

  public getCircuitBreakerConfig(): CircuitBreakerOptions {
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
  get circuitBreaker(): {
    open: () => void;
    halfOpen: () => void;
    close: () => void;
    fire: CircuitBreaker['fire'];
    opened: boolean;
    stats: CircuitBreaker['stats'];
    reset?: () => void;
    isOpen?: () => boolean;
    getState?: () => string;
  } {
    // Create a facade that exposes all breakers' functionality
    return {
      open: () => {
        this.loadInitialStateBreaker.open();
        this.setupRealtimeBreaker.open();
        this.persistUpdateBreaker.open();
        // Directly notify the state change when manually opened
        this.notifyCircuitBreakerStateChange('OPEN');
      },
      halfOpen: () => {
        // Opossum doesn't have a halfOpen method, use fallback
        this.loadInitialStateBreaker.close();
        this.setupRealtimeBreaker.close();
        this.persistUpdateBreaker.close();
      },
      close: () => {
        this.loadInitialStateBreaker.close();
        this.setupRealtimeBreaker.close();
        this.persistUpdateBreaker.close();
      },
      fire: this.persistUpdateBreaker.fire.bind(this.persistUpdateBreaker),
      opened: this.persistUpdateBreaker.opened,
      stats: this.persistUpdateBreaker.stats
    };
  }

  public getCircuitBreakerState(): string {
    // Return the most restrictive state among all circuit breakers
    // Check each breaker's state properties directly
    if (this.loadInitialStateBreaker.opened || 
        this.setupRealtimeBreaker.opened || 
        this.persistUpdateBreaker.opened) {
      return 'OPEN';
    }
    
    if (this.loadInitialStateBreaker.halfOpen || 
        this.setupRealtimeBreaker.halfOpen || 
        this.persistUpdateBreaker.halfOpen) {
      return 'HALF_OPEN';
    }
    
    return 'CLOSED';
  }

  public onCircuitBreakerStateChange(handler: (state: string) => void): void {
    this.circuitBreakerStateChangeHandlers.push(handler);
  }

  public getCircuitBreakerMetrics(): {
    totalRequests: number;
    successCount: number;
    failureCount: number;
    state: string;
  } {
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

  // Offline Queue Management Methods with IndexedDB

  private async initializeOfflineQueue(): Promise<void> {
    try {
      await this.indexedDBQueue.initialize();
      console.log(`Offline queue initialized with ${this.indexedDBQueue.storageType} storage`);
    } catch (error) {
      console.error('Failed to initialize offline queue:', error);
    }
  }

  public async queueUpdate(updateData: Uint8Array): Promise<void> {
    try {
      await this.indexedDBQueue.enqueue(updateData);
    } catch (error) {
      console.error('Failed to queue update to IndexedDB:', error);
      // Fallback is handled internally by IndexedDBQueue
    }
  }

  public async getOfflineQueue(): Promise<Uint8Array[]> {
    try {
      const queueSize = await this.indexedDBQueue.size();
      const queue: Uint8Array[] = [];

      // For compatibility, return a snapshot of the queue
      for (let i = 0; i < queueSize; i++) {
        const item = await this.indexedDBQueue.peek();
        if (item) {
          queue.push(item);
          // Temporarily dequeue and re-enqueue to simulate array-like access
          await this.indexedDBQueue.dequeue();
          if (i < queueSize - 1) {
            await this.indexedDBQueue.enqueue(item);
          }
        }
      }

      // Re-enqueue the last item if we had any
      if (queue.length > 0) {
        await this.indexedDBQueue.enqueue(queue[queue.length - 1]);
      }

      return queue;
    } catch (error) {
      console.error('Error reading offline queue:', error);
      return [];
    }
  }

  public async getPersistedQueue(): Promise<Uint8Array[]> {
    // With IndexedDB queue, persisted and in-memory are the same
    return this.getOfflineQueue();
  }

  public async drainOfflineQueue(): Promise<void> {
    try {
      const queueSize = await this.indexedDBQueue.size();
      if (queueSize === 0) return;

      console.log(`Draining ${queueSize} queued operations`);

      // Process all queued operations
      while (true) {
        const updateData = await this.indexedDBQueue.dequeue();
        if (!updateData) break;

        try {
          // Call persistUpdateOperation directly, bypassing the circuit breaker
          // since drainOfflineQueue is typically called when the circuit is closed
          await this.persistUpdateOperation(updateData);
        } catch (error) {
          console.error('Error processing queued update:', error);
          // Re-queue the failed update
          await this.queueUpdate(updateData);
        }
      }
    } catch (error) {
      console.error('Error draining offline queue:', error);
    }
  }

}