/**
 * @fileoverview Tests for retry utility with exponential backoff
 * 
 * Tests resilient network operations with configurable backoff strategy
 * Part of selective salvage implementation for Week 1 critical path
 * 
 * Requirements:
 * - Exponential backoff with jitter
 * - Configurable max retries and delays  
 * - Support for conditional retry predicates
 * - Performance monitoring integration
 */

// Context7: consulted for vitest
// TestGuard: approved RED-GREEN-REFACTOR methodology
// TEST-METHODOLOGY-GUARDIAN-20250912-17577016: Fix timer handling for async operations
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  retryWithBackoff,
  withRetry,
  RetryPredicates,
  RetryConfigs,
  type RetryConfig,
} from '../../../src/lib/resilience/retryWithBackoff'

describe('retryWithBackoff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  describe('successful operations', () => {
    it('should return result on first success', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      
      const result = await retryWithBackoff(operation)
      
      expect(result.success).toBe(true)
      expect(result.result).toBe('success')
      expect(result.attempts).toBe(1)
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should track timing metrics correctly', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      
      const result = await retryWithBackoff(operation)
      
      expect(result.totalTimeMs).toBeGreaterThanOrEqual(0)
      expect(typeof result.totalTimeMs).toBe('number')
    })
  })

  describe('retry behavior', () => {
    it('should retry failed operations up to maxRetries', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail1'))
        .mockRejectedValueOnce(new Error('fail2'))
        .mockResolvedValue('success')
      
      const promise = retryWithBackoff(operation, { 
        maxRetries: 3,
        initialDelayMs: 100,
        jitter: false
      })
      
      // Advance timers for each retry
      await vi.advanceTimersByTimeAsync(100) // First retry
      await vi.advanceTimersByTimeAsync(200) // Second retry (100 * 2)
      
      const result = await promise
      
      expect(result.success).toBe(true)
      expect(result.result).toBe('success')
      expect(result.attempts).toBe(3)
      expect(operation).toHaveBeenCalledTimes(3)
    })

    it('should fail after maxRetries exhausted', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('persistent failure'))
      
      const promise = retryWithBackoff(operation, { 
        maxRetries: 2,
        initialDelayMs: 100,
        jitter: false
      })
      
      // Advance timers for each retry
      await vi.advanceTimersByTimeAsync(100) // First retry
      await vi.advanceTimersByTimeAsync(200) // Second retry (100 * 2)
      
      const result = await promise
      
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      if (result.error instanceof Error) {
        expect(result.error.message).toBe('persistent failure')
      }
      expect(result.attempts).toBe(3) // initial + 2 retries
      expect(operation).toHaveBeenCalledTimes(3)
    })
  })

  describe('exponential backoff', () => {
    it('should implement exponential backoff with correct delays', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail1'))
        .mockRejectedValueOnce(new Error('fail2'))
        .mockResolvedValue('success')
      
      const config: RetryConfig = {
        maxRetries: 2,
        initialDelayMs: 1000,
        multiplier: 2,
        maxDelayMs: 10000,
        jitter: false
      }
      
      const promise = retryWithBackoff(operation, config)
      
      // First retry should wait 1000ms
      await vi.advanceTimersByTimeAsync(999)
      expect(operation).toHaveBeenCalledTimes(1)
      
      await vi.advanceTimersByTimeAsync(1)
      expect(operation).toHaveBeenCalledTimes(2)
      
      // Second retry should wait 2000ms
      await vi.advanceTimersByTimeAsync(1999)
      expect(operation).toHaveBeenCalledTimes(2)
      
      await vi.advanceTimersByTimeAsync(1)
      expect(operation).toHaveBeenCalledTimes(3)
      
      const result = await promise
      expect(result.success).toBe(true)
    })

    it('should respect maxDelayMs limit', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success')
      
      const config: RetryConfig = {
        maxRetries: 1,
        initialDelayMs: 5000,
        multiplier: 3,
        maxDelayMs: 2000, // Lower than calculated delay
        jitter: false
      }
      
      const promise = retryWithBackoff(operation, config)
      
      // Should wait maxDelayMs (2000) not calculated delay (15000)
      await vi.advanceTimersByTimeAsync(2000)
      
      const result = await promise
      expect(result.success).toBe(true)
    })
  })

  describe('retry predicates', () => {
    it('should use retryPredicate to determine retryability', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('client error'))
      
      const config: RetryConfig = {
        maxRetries: 3,
        initialDelayMs: 100,
        multiplier: 2,
        maxDelayMs: 1000,
        jitter: false,
        retryPredicate: (error) => {
          if (error instanceof Error) {
            return error.message !== 'client error'
          }
          return true
        }
      }
      
      const result = await retryWithBackoff(operation, config)
      
      expect(result.success).toBe(false)
      expect(result.attempts).toBe(1) // Should not retry
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should retry when predicate returns true', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('retryable error'))
        .mockResolvedValue('success')
      
      const config: RetryConfig = {
        maxRetries: 2,
        initialDelayMs: 100,
        multiplier: 2,
        maxDelayMs: 1000,
        jitter: false,
        retryPredicate: (error) => {
          if (error instanceof Error) {
            return error.message === 'retryable error'
          }
          return false
        }
      }
      
      const promise = retryWithBackoff(operation, config)
      await vi.advanceTimersByTimeAsync(100)
      
      const result = await promise
      expect(result.success).toBe(true)
      expect(result.attempts).toBe(2)
    })
  })

  describe('jitter behavior', () => {
    it('should add jitter when enabled', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success')
      
      // Mock Math.random to return consistent value for testing
      const originalRandom = Math.random
      Math.random = vi.fn().mockReturnValue(0.7)
      
      const config: RetryConfig = {
        maxRetries: 1,
        initialDelayMs: 1000,
        multiplier: 2,
        maxDelayMs: 10000,
        jitter: true
      }
      
      const promise = retryWithBackoff(operation, config)
      
      // With jitter: delay = 1000 * (0.5 + 0.7 * 0.5) = 1000 * 0.85 = 850ms
      await vi.advanceTimersByTimeAsync(850)
      
      const result = await promise
      expect(result.success).toBe(true)
      
      Math.random = originalRandom
    })
  })
})

describe('withRetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  it('should create retrying version of function', async () => {
    // TESTGUARD-APPROVED: TESTGUARD-20250911-de838fd2
    const originalFn = vi.fn<(arg1: string, arg2: string) => Promise<string>>()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('success')
    
    const retryingFn = withRetry(originalFn, { maxRetries: 2 })
    
    const promise = retryingFn('arg1', 'arg2')
    await vi.advanceTimersByTimeAsync(1000)
    
    const result = await promise
    expect(result).toBe('success')
    expect(originalFn).toHaveBeenCalledWith('arg1', 'arg2')
    expect(originalFn).toHaveBeenCalledTimes(2)
  })

  it('should throw error when all retries fail', async () => {
    const originalFn = vi.fn<() => Promise<void>>().mockRejectedValue(new Error('persistent error'))
    const retryingFn = withRetry(originalFn, { 
      maxRetries: 1,
      initialDelayMs: 100,
      jitter: false
    })
    
    const promise = expect(retryingFn()).rejects.toThrow('persistent error')
    
    // Advance timer for retry
    await vi.advanceTimersByTimeAsync(100)
    
    await promise
  })
})

describe('RetryPredicates', () => {
  it('always should return true for any error', () => {
    expect(RetryPredicates.always()).toBe(true)
  })

  it('never should return false for any error', () => {
    expect(RetryPredicates.never()).toBe(false)
  })

  it('networkErrors should identify network-related errors', () => {
    expect(RetryPredicates.networkErrors({ code: 500 })).toBe(true)
    expect(RetryPredicates.networkErrors({ code: 502 })).toBe(true)
    expect(RetryPredicates.networkErrors({ code: 'TIMEOUT' })).toBe(true)
    expect(RetryPredicates.networkErrors({ code: 'ECONNRESET' })).toBe(true)
    expect(RetryPredicates.networkErrors({ code: 400 })).toBe(false)
    expect(RetryPredicates.networkErrors({ code: 404 })).toBe(false)
  })

  it('transientErrors should identify transient failures', () => {
    expect(RetryPredicates.transientErrors({ code: 429 })).toBe(true) // Rate limit
    expect(RetryPredicates.transientErrors({ code: 503 })).toBe(true) // Service unavailable
    expect(RetryPredicates.transientErrors({ code: 502 })).toBe(true) // Bad gateway
    expect(RetryPredicates.transientErrors({ code: 504 })).toBe(true) // Gateway timeout
    expect(RetryPredicates.transientErrors({ code: 500 })).toBe(false)
    expect(RetryPredicates.transientErrors({ code: 400 })).toBe(false)
  })
})

describe('RetryConfigs', () => {
  it('should provide predefined configuration objects', () => {
    expect(RetryConfigs.quick.maxRetries).toBe(2)
    expect(RetryConfigs.quick.initialDelayMs).toBe(500)
    
    expect(RetryConfigs.standard.maxRetries).toBe(3)
    expect(RetryConfigs.standard.initialDelayMs).toBe(1000)
    
    expect(RetryConfigs.aggressive.maxRetries).toBe(5)
    expect(RetryConfigs.aggressive.initialDelayMs).toBe(500)
  })
  
  it('should have all configs with jitter enabled', () => {
    expect(RetryConfigs.quick.jitter).toBe(true)
    expect(RetryConfigs.standard.jitter).toBe(true)
    expect(RetryConfigs.aggressive.jitter).toBe(true)
  })
})