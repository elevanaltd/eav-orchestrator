/**
 * Circuit Breaker Pattern Tests - RED STATE
 * 
 * Tests circuit breaker behavior:
 * - Closed → Open after 3 consecutive failures
 * - Half-Open → Closed on success
 * - Half-Open → Open on failure
 * - Timeout-based state transitions
 */

import { CircuitBreaker, CircuitBreakerConfig, CircuitBreakerState } from '../../../src/lib/resilience/circuitBreaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  let mockExecutor: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockExecutor = vi.fn();
    const config: CircuitBreakerConfig = {
      failureThreshold: 3,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 30000, // 30 seconds
    };
    circuitBreaker = new CircuitBreaker('test-service', config);
  });

  describe('Closed State', () => {
    test('should execute function when circuit is closed', async () => {
      const result = 'success';
      mockExecutor.mockResolvedValueOnce(result);

      const response = await circuitBreaker.execute(mockExecutor);

      expect(mockExecutor).toHaveBeenCalledTimes(1);
      expect(response).toBe(result);
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    test('should count failures and open circuit after threshold', async () => {
      const error = new Error('Service failure');
      mockExecutor.mockRejectedValue(error);

      // Attempt 3 failures to reach threshold
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockExecutor);
        } catch (e) {
          // Expected failures
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
      expect(mockExecutor).toHaveBeenCalledTimes(3);
    });
  });

  describe('Open State', () => {
    beforeEach(async () => {
      // Force circuit to open state
      const error = new Error('Service failure');
      mockExecutor.mockRejectedValue(error);
      
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockExecutor);
        } catch (e) {
          // Expected failures to open circuit
        }
      }
    });

    test('should reject immediately without executing function when open', async () => {
      mockExecutor.mockClear();
      
      try {
        await circuitBreaker.execute(mockExecutor);
        fail('Should have thrown circuit breaker open error');
      } catch (error) {
        expect(error.message).toContain('Circuit breaker is OPEN');
        expect(mockExecutor).not toHaveBeenCalled();
      }
    });

    test('should transition to half-open after reset timeout', async () => {
      // Mock timer to advance time
      vi.useFakeTimers();
      
      // Advance time past reset timeout
      vi.advanceTimersByTime(60001); // 1 minute + 1ms
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
      
      vi.useRealTimers();
    });
  });

  describe('Half-Open State', () => {
    beforeEach(async () => {
      // Force circuit to open, then advance to half-open
      const error = new Error('Service failure');
      mockExecutor.mockRejectedValue(error);
      
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockExecutor);
        } catch (e) {
          // Expected failures
        }
      }

      vi.useFakeTimers();
      vi.advanceTimersByTime(60001);
      vi.useRealTimers();
    });

    test('should close circuit on successful execution', async () => {
      const result = 'success';
      mockExecutor.mockResolvedValueOnce(result);

      const response = await circuitBreaker.execute(mockExecutor);

      expect(response).toBe(result);
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    test('should open circuit immediately on failure', async () => {
      const error = new Error('Service still failing');
      mockExecutor.mockRejectedValueOnce(error);

      try {
        await circuitBreaker.execute(mockExecutor);
        fail('Should have thrown the service error');
      } catch (e) {
        expect(e).toBe(error);
        expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
      }
    });
  });

  describe('Metrics', () => {
    test('should track failure count correctly', async () => {
      const error = new Error('Service failure');
      mockExecutor.mockRejectedValueOnce(error);

      try {
        await circuitBreaker.execute(mockExecutor);
      } catch (e) {
        // Expected failure
      }

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failureCount).toBe(1);
      expect(metrics.totalCalls).toBe(1);
      expect(metrics.successRate).toBe(0);
    });

    test('should track success rate correctly', async () => {
      // One success
      mockExecutor.mockResolvedValueOnce('success');
      await circuitBreaker.execute(mockExecutor);

      // One failure
      mockExecutor.mockRejectedValueOnce(new Error('failure'));
      try {
        await circuitBreaker.execute(mockExecutor);
      } catch (e) {
        // Expected failure
      }

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.successRate).toBe(0.5); // 1 success out of 2 total
    });
  });
});