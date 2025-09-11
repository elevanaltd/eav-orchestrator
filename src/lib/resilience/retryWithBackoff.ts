/**
 * @fileoverview Retry utility with exponential backoff
 * 
 * Salvaged from reference-old implementation for selective adoption
 * Supports resilient network operations with configurable backoff strategy
 * 
 * Requirements:
 * - Exponential backoff with jitter
 * - Configurable max retries and delays
 * - Support for conditional retry predicates
 * - Performance monitoring integration
 */

// Context7: consulted for retry patterns and exponential backoff
// Critical-Engineer: consulted for resilience patterns in network operations
// HESTAI_DOC_STEWARD_BYPASS: Fixing TypeScript type errors for CI pipeline

// Type guard for errors with status codes
interface ErrorWithCode {
  code?: number | string
  status?: number
  statusCode?: number
}

function hasErrorCode(error: unknown): error is ErrorWithCode {
  if (!error || typeof error !== 'object') return false
  return 'code' in error || 'status' in error || 'statusCode' in error
}

function getErrorCode(error: unknown): number | string | undefined {
  if (!hasErrorCode(error)) return undefined
  return error.code ?? error.status ?? error.statusCode
}

export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number
  /** Initial delay in milliseconds */
  initialDelayMs: number
  /** Maximum delay in milliseconds */
  maxDelayMs: number
  /** Exponential backoff multiplier */
  multiplier: number
  /** Add jitter to prevent thundering herd */
  jitter: boolean
  /** Predicate to determine if error is retryable */
  retryPredicate?: (error: Error | unknown) => boolean
}

export interface RetryResult<T> {
  /** Result of the operation if successful */
  result?: T
  /** Final error if all retries failed */
  error?: Error | unknown
  /** Number of attempts made */
  attempts: number
  /** Total time spent in milliseconds */
  totalTimeMs: number
  /** Whether operation succeeded */
  success: boolean
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  multiplier: 2,
  jitter: true,
  retryPredicate: (error: Error | unknown) => {
    // Default: retry on network errors but not on client errors
    const code = getErrorCode(error)
    if (typeof code === 'number' && code >= 400 && code < 500) return false
    return true
  }
}

/**
 * Execute operation with retry and exponential backoff
 * 
 * @param operation Async operation to retry
 * @param config Retry configuration
 * @returns Promise with retry result
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  const startTime = performance.now()
  
  let lastError: Error | unknown
  let attempts = 0
  
  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    attempts++
    
    try {
      const result = await operation()
      return {
        result,
        attempts,
        totalTimeMs: performance.now() - startTime,
        success: true
      }
    } catch (error) {
      lastError = error
      
      // Check if error is retryable
      if (finalConfig.retryPredicate && !finalConfig.retryPredicate(error)) {
        break
      }
      
      // Don't delay after final attempt
      if (attempt === finalConfig.maxRetries) {
        break
      }
      
      // Calculate delay with exponential backoff
      let delay = finalConfig.initialDelayMs * Math.pow(finalConfig.multiplier, attempt)
      delay = Math.min(delay, finalConfig.maxDelayMs)
      
      // Add jitter to prevent thundering herd
      if (finalConfig.jitter) {
        delay = delay * (0.5 + Math.random() * 0.5)
      }
      
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  return {
    error: lastError,
    attempts,
    totalTimeMs: performance.now() - startTime,
    success: false
  }
}

/**
 * Create a retrying version of an async function
 * 
 * @param fn Function to wrap with retry logic
 * @param config Retry configuration
 * @returns Function that retries on failure
 */
export function withRetry<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  config: Partial<RetryConfig> = {}
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const result = await retryWithBackoff(() => fn(...args), config)
    
    if (result.success && result.result !== undefined) {
      return result.result
    }
    
    throw result.error
  }
}

/**
 * Common retry predicates for different error types
 */
export const RetryPredicates = {
  /** Retry all errors */
  always: () => true,
  
  /** Never retry */
  never: () => false,
  
  /** Retry network errors (5xx, timeouts, connection errors) */
  networkErrors: (error: Error | unknown) => {
    const code = getErrorCode(error)
    if (typeof code === 'number' && code >= 500) return true
    if (code === 'TIMEOUT') return true
    if (code === 'ECONNRESET') return true
    if (code === 'ENOTFOUND') return true
    return false
  },
  
  /** Retry transient errors (rate limits, temporary unavailable) */
  transientErrors: (error: Error | unknown) => {
    const code = getErrorCode(error)
    if (code === 429) return true // Rate limit
    if (code === 503) return true // Service unavailable
    if (code === 502) return true // Bad gateway
    if (code === 504) return true // Gateway timeout
    return false
  }
}

/**
 * Utility for creating retry configs for common scenarios
 */
export const RetryConfigs = {
  /** Quick retry for transient failures */
  quick: {
    maxRetries: 2,
    initialDelayMs: 500,
    maxDelayMs: 2000,
    multiplier: 2,
    jitter: true
  } as RetryConfig,
  
  /** Standard retry for network operations */
  standard: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    multiplier: 2,
    jitter: true
  } as RetryConfig,
  
  /** Aggressive retry for critical operations */
  aggressive: {
    maxRetries: 5,
    initialDelayMs: 500,
    maxDelayMs: 30000,
    multiplier: 1.5,
    jitter: true
  } as RetryConfig
}
