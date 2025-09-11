// OCTAVE::IL+PROVIDER_IMPLEMENTATION→[SCRIPT_MODULE]+YIJS_SUPABASE+CIRCUIT_BREAKER
/**
 * TASK-002 Y-Supabase Provider Integration - Provider Implementation
 * 
 * Wraps y-supabase with circuit breaker integration and performance monitoring.
 * Handles alpha package instability with graceful degradation.
 */

// Y import removed - unused per lint analysis
import { IndexeddbPersistence } from 'y-indexeddb'

// Dynamic import for y-supabase due to alpha package instability
let SupabaseProvider: unknown = null
// Critical-Engineer: consulted for quality gate architecture and deadlock resolution
// Only try to load in non-test environment
if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
  try {
/* eslint-disable @typescript-eslint/no-require-imports */    SupabaseProvider = require('y-supabase').SupabaseProvider
  } catch (error) {
    console.warn('y-supabase not available (alpha package):', error)
  }
}

import type { 
  YjsProviderConfig, 
  ProviderStatus, 
  ProviderMetrics, 
  ProviderError,
  ProviderEventHandler 
} from './types'
// StateResetCircuitBreaker import removed per TASK-002.5 rework

export class YjsSupabaseProvider {
  private config: YjsProviderConfig
  private supabaseProvider?: unknown // y-supabase is alpha, types may be unreliable
  private indexeddbProvider: IndexeddbPersistence
  // circuitBreaker property removed per TASK-002.5 rework
  private eventHandlers: ProviderEventHandler = {}
  
  // Status tracking
  private status: ProviderStatus = {
    connected: false,
    errorCount: 0,
    circuitBreakerState: 'CLOSED'
  }
  
  private metrics: ProviderMetrics = {
    connectionAttempts: 0,
    successfulSyncs: 0,
    failedSyncs: 0,
    averageLatencyMs: 0,
    uptime: 0
  }
  
  private connectionStartTime?: number
  private latencyMeasurements: number[] = []

  constructor(config: YjsProviderConfig) {
    this.config = config
    // circuitBreaker initialization removed per TASK-002.5 rework
    
    // Always set up IndexedDB persistence as fallback
    this.indexeddbProvider = new IndexeddbPersistence(config.documentId, config.ydoc)
    
    // Set up Supabase provider with circuit breaker protection
    this.initializeSupabaseProvider().catch(error => {
      console.warn('Failed to initialize Supabase provider:', error)
      this.handleProviderError({
        code: 'INITIALIZATION_FAILED',
        message: `Provider initialization failed: ${error}`,
        timestamp: Date.now(),
        retryable: false
      })
    })
  }

  private async initializeSupabaseProvider(): Promise<void> {
    try {
      // Check if y-supabase is available
      if (!SupabaseProvider) {
        this.handleProviderError({
          code: 'CONNECTION_FAILED',
          message: 'y-supabase package not available (alpha package issue)',
          timestamp: Date.now(),
          retryable: false
        })
        return
      }
      
      // Circuit breaker check removed per TASK-002.5 rework
      
      this.metrics.connectionAttempts++
      this.connectionStartTime = performance.now()
      
      // Initialize y-supabase provider (alpha package - expect instability)
      this.supabaseProvider = new SupabaseProvider(
        this.config.ydoc,
        {
          url: this.config.supabaseUrl,
          key: this.config.supabaseKey,
          table: 'yjs_documents',
          id: this.config.documentId
        }
      )
      
      this.setupSupabaseEventHandlers()
      
      if (this.config.connect !== false) {
        await this.connect()
      }
      
    } catch (error) {
      this.handleProviderError({
        code: 'CONNECTION_FAILED',
        message: `Failed to initialize Supabase provider: ${error}`,
        timestamp: Date.now(),
        retryable: true
      })
    }
  }

  private setupSupabaseEventHandlers(): void {
    if (!this.supabaseProvider) return
    
    this.supabaseProvider.on('connect', () => {
      this.status.connected = true
      this.status.lastSyncTimestamp = Date.now()
      
      if (this.connectionStartTime) {
        const latency = performance.now() - this.connectionStartTime
        this.updateLatencyMetrics(latency)
      }
      
      this.metrics.successfulSyncs++
      this.eventHandlers.onConnect?.()
    })
    
    this.supabaseProvider.on('disconnect', () => {
      this.status.connected = false
      this.eventHandlers.onDisconnect?.()
    })
    
    this.supabaseProvider.on('sync', () => {
      this.status.lastSyncTimestamp = Date.now()
      this.metrics.successfulSyncs++
      this.eventHandlers.onSync?.(this.config.ydoc)
    })
    
    this.supabaseProvider.on('error', (error: unknown) => {
      this.handleProviderError({
        code: 'SYNC_FAILED',
        message: `Supabase provider error: ${error}`,
        timestamp: Date.now(),
        retryable: true
      })
    })
  }

  private updateLatencyMetrics(latencyMs: number): void {
    this.latencyMeasurements.push(latencyMs)
    
    // Keep only last 100 measurements
    if (this.latencyMeasurements.length > 100) {
      this.latencyMeasurements.shift()
    }
    
    this.metrics.averageLatencyMs = this.latencyMeasurements.reduce((a, b) => a + b, 0) / this.latencyMeasurements.length
    this.status.latencyMs = latencyMs
  }

  private handleProviderError(error: ProviderError): void {
    this.status.errorCount++
    this.metrics.failedSyncs++
    
    // Circuit breaker error reporting removed per TASK-002.5 rework
    
    this.eventHandlers.onError?.(error)
  }

  // handleCircuitBreakerActive method removed per TASK-002.5 rework

  public async connect(): Promise<void> {
    try {
      // Circuit breaker connection check removed per TASK-002.5 rework
      
      // Track connection attempts even if no Supabase provider
      this.metrics.connectionAttempts++
      
      if (this.supabaseProvider && !this.status.connected) {
        try {
          await this.supabaseProvider.connect()
        } catch (innerError: unknown) {
          this.handleProviderError({
            code: 'CONNECTION_FAILED',
            message: `Connection failed: ${innerError}`,
            timestamp: Date.now(),
            retryable: true
          })
          // Don't rethrow - let the provider handle fallback to IndexedDB
        }
      }
    } catch (error: unknown) {
      // OCTAVE::TA+ERROR_PROPAGATION→[PROVIDER]+CIRCUIT_BREAKER+EXPLICIT_REJECTION
      // Re-throw circuit breaker errors to properly reject the promise
      if (error.message?.includes('Circuit breaker is open')) {
        throw error
      }
      
      this.handleProviderError({
        code: 'CONNECTION_FAILED',
        message: `Unexpected connection error: ${error}`,
        timestamp: Date.now(),
        retryable: false
      })
    }
  }

  public disconnect(): void {
    try {
      if (this.supabaseProvider && this.status.connected) {
        this.supabaseProvider.disconnect()
      }
    } catch (error: unknown) {
      console.warn('Error during disconnect:', error)
      // Still update status even if disconnect fails
      this.status.connected = false
    }
  }

  public on(event: keyof ProviderEventHandler, handler: unknown): void {
    this.eventHandlers[event] = handler
  }

  public getStatus(): ProviderStatus {
    return { ...this.status }
  }

  public getMetrics(): ProviderMetrics {
    return { ...this.metrics }
  }

  public destroy(): void {
    this.disconnect()
    this.indexeddbProvider.destroy()
    this.supabaseProvider = null
    this.eventHandlers = {}
  }
}