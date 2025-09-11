/**
 * @fileoverview Tests for circuit breaker pattern implementation
 * 
 * Tests resilience circuit breaker for network operations
 * Part of selective salvage implementation for Week 1 critical path
 * 
 * Requirements:
 * - Three states: CLOSED, OPEN, HALF_OPEN
 * - Configurable failure threshold and timeout
 * - Automatic state transitions
 * - Error counting and reset logic
 */

// Context7: consulted for vitest
// TestGuard: approved RED-GREEN-REFACTOR methodology
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  CircuitBreaker,
  CircuitBreakerState,
  type CircuitBreakerConfig,
} from '../../../src/lib/resilience/circuitBreaker'

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker
  
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    
    const config: CircuitBreakerConfig = {
      failureThreshold: 3,
      resetTimeoutMs: 5000,
      monitoringPeriodMs: 10000,
      minimumRequests: 2
    }
    
    circuitBreaker = new CircuitBreaker(config)
  })

  describe('initial state', () => {
    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED)
    })

    it('should have initial metrics', () => {
      const metrics = circuitBreaker.getMetrics()
      
      expect(metrics.totalRequests).toBe(0)
      expect(metrics.failureCount).toBe(0)
      expect(metrics.successCount).toBe(0)
      expect(metrics.state).toBe(CircuitBreakerState.CLOSED)
    })
  })

  describe('CLOSED state behavior', () => {
    it('should allow requests in CLOSED state', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      
      const result = await circuitBreaker.execute(operation)
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledOnce()
    })

    it('should track successful operations', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      
      await circuitBreaker.execute(operation)
      
      const metrics = circuitBreaker.getMetrics()
      expect(metrics.totalRequests).toBe(1)
      expect(metrics.successCount).toBe(1)
      expect(metrics.failureCount).toBe(0)
    })

    it('should track failed operations', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'))
      
      await expect(circuitBreaker.execute(operation)).rejects.toThrow('fail')
      
      const metrics = circuitBreaker.getMetrics()
      expect(metrics.totalRequests).toBe(1)
      expect(metrics.successCount).toBe(0)
      expect(metrics.failureCount).toBe(1)
    })

    it('should transition to OPEN after failure threshold reached', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'))
      
      // Fail 3 times to reach threshold
      await expect(circuitBreaker.execute(operation)).rejects.toThrow()
      await expect(circuitBreaker.execute(operation)).rejects.toThrow()
      await expect(circuitBreaker.execute(operation)).rejects.toThrow()
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN)
    })

    it('should require minimum requests before considering failure rate', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'))
      
      // Only 1 failure, below minimum requests threshold
      await expect(circuitBreaker.execute(operation)).rejects.toThrow()
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED)
      expect(circuitBreaker.getMetrics().failureCount).toBe(1)
    })
  })

  describe('OPEN state behavior', () => {
    beforeEach(async () => {
      // Force circuit breaker to OPEN state
      const operation = vi.fn().mockRejectedValue(new Error('fail'))
      await expect(circuitBreaker.execute(operation)).rejects.toThrow()
      await expect(circuitBreaker.execute(operation)).rejects.toThrow()
      await expect(circuitBreaker.execute(operation)).rejects.toThrow()
    })

    it('should reject requests immediately in OPEN state', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      
      await expect(circuitBreaker.execute(operation)).rejects.toThrow('Circuit breaker is open')
      
      expect(operation).not.toHaveBeenCalled()
    })

    it('should transition to HALF_OPEN after reset timeout', async () => {
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN)
      
      // Advance time by reset timeout
      await vi.advanceTimersByTimeAsync(5000)
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN)
    })
  })

  describe('HALF_OPEN state behavior', () => {
    beforeEach(async () => {
      // Force to OPEN state first
      const operation = vi.fn().mockRejectedValue(new Error('fail'))
      await expect(circuitBreaker.execute(operation)).rejects.toThrow()
      await expect(circuitBreaker.execute(operation)).rejects.toThrow()
      await expect(circuitBreaker.execute(operation)).rejects.toThrow()
      
      // Then advance time to HALF_OPEN
      await vi.advanceTimersByTimeAsync(5000)
    })

    it('should allow limited requests in HALF_OPEN state', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      
      const result = await circuitBreaker.execute(operation)
      
      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledOnce()
    })

    it('should transition to CLOSED on successful request', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      
      await circuitBreaker.execute(operation)
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED)
    })

    it('should transition back to OPEN on failed request', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('still failing'))
      
      await expect(circuitBreaker.execute(operation)).rejects.toThrow('still failing')
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN)
    })

    it('should reset metrics when transitioning to CLOSED', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      
      await circuitBreaker.execute(operation)
      
      const metrics = circuitBreaker.getMetrics()
      expect(metrics.failureCount).toBe(0)
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED)
    })
  })

  describe('error handling', () => {
    it('should handle promise rejections correctly', async () => {
      const error = new Error('network timeout')
      const operation = vi.fn().mockRejectedValue(error)
      
      await expect(circuitBreaker.execute(operation)).rejects.toThrow('network timeout')
      
      const metrics = circuitBreaker.getMetrics()
      expect(metrics.failureCount).toBe(1)
    })

    it('should handle synchronous errors correctly', async () => {
      const operation = vi.fn().mockImplementation(() => {
        throw new Error('sync error')
      })
      
      await expect(circuitBreaker.execute(operation)).rejects.toThrow('sync error')
      
      const metrics = circuitBreaker.getMetrics()
      expect(metrics.failureCount).toBe(1)
    })
  })

  describe('metrics', () => {
    it('should track request timing', async () => {
      const operation = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return 'success'
      })
      
      await circuitBreaker.execute(operation)
      
      const metrics = circuitBreaker.getMetrics()
      expect(metrics.averageResponseTimeMs).toBeGreaterThan(0)
    })

    it('should calculate failure rate correctly', async () => {
      const successOp = vi.fn().mockResolvedValue('success')
      const failOp = vi.fn().mockRejectedValue(new Error('fail'))
      
      // 2 successes, 1 failure = 33% failure rate
      await circuitBreaker.execute(successOp)
      await circuitBreaker.execute(successOp)
      await expect(circuitBreaker.execute(failOp)).rejects.toThrow()
      
      const metrics = circuitBreaker.getMetrics()
      expect(metrics.failureRate).toBeCloseTo(0.33, 2)
    })

    it('should track consecutive failures', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'))
      
      await expect(circuitBreaker.execute(operation)).rejects.toThrow()
      await expect(circuitBreaker.execute(operation)).rejects.toThrow()
      
      const metrics = circuitBreaker.getMetrics()
      expect(metrics.consecutiveFailures).toBe(2)
    })
  })

  describe('configuration', () => {
    it('should respect custom failure threshold', async () => {
      const customConfig: CircuitBreakerConfig = {
        failureThreshold: 5,
        resetTimeoutMs: 1000,
        monitoringPeriodMs: 5000,
        minimumRequests: 1
      }
      
      const customBreaker = new CircuitBreaker(customConfig)
      const operation = vi.fn().mockRejectedValue(new Error('fail'))
      
      // Should stay closed after 3 failures (threshold is 5)
      await expect(customBreaker.execute(operation)).rejects.toThrow()
      await expect(customBreaker.execute(operation)).rejects.toThrow()
      await expect(customBreaker.execute(operation)).rejects.toThrow()
      
      expect(customBreaker.getState()).toBe(CircuitBreakerState.CLOSED)
      
      // Should open after 5th failure
      await expect(customBreaker.execute(operation)).rejects.toThrow()
      await expect(customBreaker.execute(operation)).rejects.toThrow()
      
      expect(customBreaker.getState()).toBe(CircuitBreakerState.OPEN)
    })

    it('should respect custom reset timeout', async () => {
      const customConfig: CircuitBreakerConfig = {
        failureThreshold: 2,
        resetTimeoutMs: 1000, // Short timeout
        monitoringPeriodMs: 5000,
        minimumRequests: 1
      }
      
      const customBreaker = new CircuitBreaker(customConfig)
      const operation = vi.fn().mockRejectedValue(new Error('fail'))
      
      // Force to OPEN state
      await expect(customBreaker.execute(operation)).rejects.toThrow()
      await expect(customBreaker.execute(operation)).rejects.toThrow()
      
      expect(customBreaker.getState()).toBe(CircuitBreakerState.OPEN)
      
      // Should transition after short timeout
      await vi.advanceTimersByTimeAsync(1000)
      
      expect(customBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN)
    })
  })

  describe('edge cases', () => {
    it('should handle null/undefined operations', async () => {
      await expect(circuitBreaker.execute(null as any)).rejects.toThrow()
      await expect(circuitBreaker.execute(undefined as any)).rejects.toThrow()
    })

    it('should handle operations that return undefined', async () => {
      const operation = vi.fn().mockResolvedValue(undefined)
      
      const result = await circuitBreaker.execute(operation)
      
      expect(result).toBeUndefined()
      expect(circuitBreaker.getMetrics().successCount).toBe(1)
    })
  })
})