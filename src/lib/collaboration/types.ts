// OCTAVE::IL+PROVIDER_TYPES→[SCRIPT_MODULE]+YIJS_SUPABASE+INTEGRATION
/**
 * TASK-002 Y-Supabase Provider Integration - Type Definitions
 * 
 * Defines types for provider integration with circuit breaker support
 */

import type * as Y from 'yjs'
// State-Reset imports removed per TASK-002.5 rework plan

export interface YjsProviderConfig {
  /** Supabase configuration */
  supabaseUrl: string
  supabaseKey: string
  
  /** Document configuration */
  documentId: string
  ydoc: Y.Doc
  
  /** Provider behavior */
  connect?: boolean
  awareness?: boolean
  
  /** Circuit breaker integration - to be refactored in Phase 3 */
  // circuitBreaker?: CircuitBreaker // Will be replaced with non-blocking implementation
  
  /** Performance monitoring */
  performanceMonitoring?: boolean
  maxLatencyMs?: number
  reconnectIntervalMs?: number
}

export interface ProviderConfig extends YjsProviderConfig {
  /** Performance monitor integration - to be refactored in Phase 3 */
  // performanceMonitor?: PerformanceMonitor // Will be replaced with non-blocking implementation
  
  /** User configuration */
  userName?: string
  userColor?: string
  
  /** Performance settings */
  performanceBudgetMs?: number
  enableQuarantine?: boolean
  
  /** Supabase client (optional for testing) */
  supabaseClient?: any
}

export interface ProviderStatus {
  connected: boolean
  lastSyncTimestamp?: number
  latencyMs?: number
  errorCount: number
  circuitBreakerState: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  // State-Reset capability removed - trusting Y.js CRDT
  authError?: boolean
  destroyed?: boolean
  lastError?: ProviderError | null
  queueFull?: boolean
}

export interface ProviderMetrics {
  connectionAttempts: number
  reconnectionAttempts?: number
  successfulSyncs: number
  failedSyncs: number
  averageLatencyMs: number
  uptime: number
  queueSize?: number
  queuedUpdates?: number
  droppedUpdates?: number
  budgetViolations?: number
  malformedMessages?: number
  p95?: number
}

export interface ProviderError {
  code: 'CONNECTION_FAILED' | 'SYNC_FAILED' | 'CIRCUIT_BREAKER_OPEN' | 'AUTHENTICATION_FAILED' | 'AUTH_ERROR' | 'RETRY_EXHAUSTED' | 'QUEUE_OVERFLOW' | 'INITIALIZATION_FAILED' | 'UNKNOWN_ERROR'
  message: string
  timestamp: number
  retryable: boolean
  originalError?: any
  userAction?: string
}

export type ProviderEventHandler = {
  onConnect?: () => void
  onDisconnect?: (error?: ProviderError) => void
  onSync?: (doc: Y.Doc) => void
  onError?: (error: ProviderError) => void
  // Circuit breaker callbacks to be refactored in Phase 3
  // onCircuitBreakerOpen?: () => void
  // onCircuitBreakerClose?: () => void
}