/**
 * @fileoverview Circuit breaker pattern implementation
 * 
 * Salvaged from reference-old implementation for selective adoption
 * Implements circuit breaker pattern for resilient network operations
 * 
 * Features:
 * - Three states: CLOSED, OPEN, HALF_OPEN
 * - Configurable failure threshold and timeout
 * - Automatic state transitions
 * - Performance monitoring integration
 * - Error counting and reset logic
 */

// Context7: consulted for circuit breaker patterns
// Critical-Engineer: consulted for resilience patterns and state management

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerConfig {
  /** Number of failures required to open circuit */
  failureThreshold: number
  /** Time in ms to wait before transitioning from OPEN to HALF_OPEN */
  resetTimeoutMs: number
  /** Period in ms to monitor for failure rate calculation */
  monitoringPeriodMs: number
  /** Minimum requests required before considering failure rate */
  minimumRequests: number
}

export interface CircuitBreakerMetrics {
  /** Current state of the circuit breaker */
  state: CircuitBreakerState
  /** Total number of requests processed */
  totalRequests: number
  /** Number of successful requests */
  successCount: number
  /** Number of failed requests */
  failureCount: number
  /** Number of consecutive failures */
  consecutiveFailures: number
  /** Current failure rate (0-1) */
  failureRate: number
  /** Average response time in milliseconds */
  averageResponseTimeMs: number
  /** Last state transition timestamp */
  lastStateChange: number
  /** Time when circuit will attempt to transition from OPEN to HALF_OPEN */
  nextAttempt?: number
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 60000, // 1 minute
  monitoringPeriodMs: 120000, // 2 minutes
  minimumRequests: 10
}

export class CircuitBreaker {
  private config: CircuitBreakerConfig
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED
  private metrics: CircuitBreakerMetrics
  private lastFailureTime: number = 0
  private responseTimes: number[] = []
  private stateChangeTime: number = 0
  
  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.metrics = this.initializeMetrics()
    this.stateChangeTime = Date.now()
  }

  private initializeMetrics(): CircuitBreakerMetrics {
    return {
      state: CircuitBreakerState.CLOSED,
      totalRequests: 0,
      successCount: 0,
      failureCount: 0,
      consecutiveFailures: 0,
      failureRate: 0,
      averageResponseTimeMs: 0,
      lastStateChange: Date.now()
    }
  }

  /**
   * Execute an operation through the circuit breaker
   * 
   * @param operation Function to execute
   * @returns Promise with operation result
   */
  async execute<T>(operation: () => Promise<T> | T): Promise<T> {
    if (!operation) {
      throw new Error('Operation is required')
    }

    // Check current state and handle accordingly
    this.updateStateIfNeeded()

    if (this.state === CircuitBreakerState.OPEN) {
      throw new Error('Circuit breaker is open')
    }

    const startTime = performance.now()
    this.metrics.totalRequests++

    try {
      const result = await Promise.resolve(operation())
      
      // Record successful execution
      const responseTime = performance.now() - startTime
      this.recordSuccess(responseTime)
      
      return result
    } catch (error) {
      // Record failed execution
      const responseTime = performance.now() - startTime
      this.recordFailure(responseTime)
      
      throw error
    }
  }

  private recordSuccess(responseTime: number): void {
    this.metrics.successCount++
    this.metrics.consecutiveFailures = 0
    this.updateResponseTime(responseTime)
    this.updateFailureRate()

    // If in HALF_OPEN state, successful request closes the circuit
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.transitionTo(CircuitBreakerState.CLOSED)
      this.resetMetrics()
    }
  }

  private recordFailure(responseTime: number): void {
    this.metrics.failureCount++
    this.metrics.consecutiveFailures++
    this.lastFailureTime = Date.now()
    this.updateResponseTime(responseTime)
    this.updateFailureRate()

    // Check if we should open the circuit
    if (this.shouldOpenCircuit()) {
      this.transitionTo(CircuitBreakerState.OPEN)
    }

    // If in HALF_OPEN state, failed request opens the circuit again
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.transitionTo(CircuitBreakerState.OPEN)
    }
  }

  private shouldOpenCircuit(): boolean {
    // Must have minimum requests to consider failure rate
    if (this.metrics.totalRequests < this.config.minimumRequests) {
      return false
    }

    // Open if consecutive failures exceed threshold
    return this.metrics.consecutiveFailures >= this.config.failureThreshold
  }

  private updateStateIfNeeded(): void {
    const now = Date.now()

    if (this.state === CircuitBreakerState.OPEN) {
      // Check if enough time has passed to try HALF_OPEN
      if (now - this.stateChangeTime >= this.config.resetTimeoutMs) {
        this.transitionTo(CircuitBreakerState.HALF_OPEN)
      }
    }
  }

  private transitionTo(newState: CircuitBreakerState): void {
    if (this.state !== newState) {
      this.state = newState
      this.stateChangeTime = Date.now()
      this.metrics.state = newState
      this.metrics.lastStateChange = this.stateChangeTime

      if (newState === CircuitBreakerState.OPEN) {
        this.metrics.nextAttempt = this.stateChangeTime + this.config.resetTimeoutMs
      } else {
        delete this.metrics.nextAttempt
      }
    }
  }

  private resetMetrics(): void {
    this.metrics.failureCount = 0
    this.metrics.consecutiveFailures = 0
    this.updateFailureRate()
  }

  private updateResponseTime(responseTime: number): void {
    this.responseTimes.push(responseTime)
    
    // Keep only recent response times (last 100)
    if (this.responseTimes.length > 100) {
      this.responseTimes.shift()
    }

    this.metrics.averageResponseTimeMs = 
      this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length
  }

  private updateFailureRate(): void {
    if (this.metrics.totalRequests === 0) {
      this.metrics.failureRate = 0
    } else {
      this.metrics.failureRate = this.metrics.failureCount / this.metrics.totalRequests
    }
  }

  /**
   * Get current circuit breaker state
   */
  getState(): CircuitBreakerState {
    this.updateStateIfNeeded()
    return this.state
  }

  /**
   * Get current metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    this.updateStateIfNeeded()
    return { ...this.metrics }
  }

  /**
   * Manually reset the circuit breaker to CLOSED state
   */
  reset(): void {
    this.transitionTo(CircuitBreakerState.CLOSED)
    this.metrics = this.initializeMetrics()
    this.responseTimes = []
    this.lastFailureTime = 0
  }

  /**
   * Check if circuit breaker is currently allowing requests
   */
  isRequestAllowed(): boolean {
    this.updateStateIfNeeded()
    return this.state !== CircuitBreakerState.OPEN
  }

  /**
   * Get time until next attempt (if in OPEN state)
   */
  getTimeUntilNextAttempt(): number {
    if (this.state !== CircuitBreakerState.OPEN) {
      return 0
    }

    const timeRemaining = this.config.resetTimeoutMs - (Date.now() - this.stateChangeTime)
    return Math.max(0, timeRemaining)
  }
}
