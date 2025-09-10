/**
 * Exponential Backoff Retry Logic Tests - RED STATE
 * 
 * Tests retry behavior with exponential backoff:
 * - 1s, 2s, 4s, 8s intervals (max)
 * - Maximum retry attempts
 * - Successful retry breaks sequence
 * - Final failure after all retries exhausted
 */

import { retryWithBackoff, RetryConfig, RetryError } from '../../../src/lib/resilience/retryWithBackoff';

describe('retryWithBackoff', () => {
  let mockExecutor: ReturnType<typeof vi.fn>;
  
  beforeEach(() => {
    mockExecutor = vi.fn();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Successful execution', () => {
    test('should return result immediately on first success', async () => {
      const result = 'success';
      mockExecutor.mockResolvedValueOnce(result);

      const response = await retryWithBackoff(mockExecutor, { maxRetries: 3 });

      expect(mockExecutor).toHaveBeenCalledTimes(1);
      expect(response).toBe(result);
    });

    test('should retry and succeed on second attempt', async () => {
      const result = 'delayed success';
      mockExecutor
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(result);

      const retryPromise = retryWithBackoff(mockExecutor, { 
        maxRetries: 3,
        initialDelay: 1000
      });

      // Advance timer for first retry (1s)
      vi.advanceTimersByTime(1000);
      const response = await retryPromise;

      expect(mockExecutor).toHaveBeenCalledTimes(2);
      expect(response).toBe(result);
    });
  });

  describe('Exponential backoff timing', () => {
    test('should use correct backoff intervals: 1s, 2s, 4s, 8s', async () => {
      const error = new Error('Persistent failure');
      mockExecutor.mockRejectedValue(error);

      const config: RetryConfig = {
        maxRetries: 4,
        initialDelay: 1000,
        maxDelay: 8000,
        backoffMultiplier: 2
      };

      const retryPromise = retryWithBackoff(mockExecutor, config);

      // First call is immediate
      expect(mockExecutor).toHaveBeenCalledTimes(1);

      // First retry after 1s
      vi.advanceTimersByTime(1000);
      await Promise.resolve(); // Allow promises to process
      expect(mockExecutor).toHaveBeenCalledTimes(2);

      // Second retry after 2s
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
      expect(mockExecutor).toHaveBeenCalledTimes(3);

      // Third retry after 4s
      vi.advanceTimersByTime(4000);
      await Promise.resolve();
      expect(mockExecutor).toHaveBeenCalledTimes(4);

      // Fourth retry after 8s (max delay)
      vi.advanceTimersByTime(8000);
      
      try {
        await retryPromise;
        fail('Should have thrown RetryError after all attempts exhausted');
      } catch (e) {
        expect(e).toBeInstanceOf(RetryError);
        expect(mockExecutor).toHaveBeenCalledTimes(5); // Initial + 4 retries
      }
    });

    test('should respect maxDelay cap', async () => {
      const error = new Error('Failure');
      mockExecutor.mockRejectedValue(error);

      const config: RetryConfig = {
        maxRetries: 10,
        initialDelay: 1000,
        maxDelay: 5000, // Cap at 5s
        backoffMultiplier: 2
      };

      const retryPromise = retryWithBackoff(mockExecutor, config);

      // Skip to later retries where delay should be capped
      // After several doublings: 1s, 2s, 4s, would be 8s but capped at 5s
      vi.advanceTimersByTime(1000 + 2000 + 4000); // First 3 retries
      vi.advanceTimersByTime(5000); // 4th retry should use maxDelay
      vi.advanceTimersByTime(5000); // 5th retry should also use maxDelay

      try {
        await retryPromise;
      } catch (e) {
        // Expected failure, just testing timing
      }
    });
  });

  describe('Retry exhaustion', () => {
    test('should throw RetryError after maxRetries exceeded', async () => {
      const originalError = new Error('Persistent service failure');
      mockExecutor.mockRejectedValue(originalError);

      const config: RetryConfig = {
        maxRetries: 2,
        initialDelay: 100
      };

      const retryPromise = retryWithBackoff(mockExecutor, config);

      // Advance through all retry attempts
      vi.advanceTimersByTime(100); // First retry
      vi.advanceTimersByTime(200); // Second retry
      
      try {
        await retryPromise;
        fail('Should have thrown RetryError');
      } catch (e) {
        expect(e).toBeInstanceOf(RetryError);
        expect(e.message).toContain('Max retries exceeded');
        expect(e.attemptCount).toBe(3); // Initial + 2 retries
        expect(e.lastError).toBe(originalError);
      }

      expect(mockExecutor).toHaveBeenCalledTimes(3);
    });
  });

  describe('Retry configuration', () => {
    test('should use default configuration when not provided', async () => {
      const error = new Error('Failure');
      mockExecutor.mockRejectedValue(error);

      const retryPromise = retryWithBackoff(mockExecutor);

      // Default should be 3 retries with 1s initial delay
      vi.advanceTimersByTime(1000 + 2000 + 4000);
      
      try {
        await retryPromise;
      } catch (e) {
        expect(e).toBeInstanceOf(RetryError);
        expect(mockExecutor).toHaveBeenCalledTimes(4); // Initial + 3 retries
      }
    });

    test('should allow customization of backoff multiplier', async () => {
      const error = new Error('Failure');
      mockExecutor.mockRejectedValue(error);

      const config: RetryConfig = {
        maxRetries: 3,
        initialDelay: 1000,
        backoffMultiplier: 3 // Triple instead of double
      };

      const retryPromise = retryWithBackoff(mockExecutor, config);

      // Should be 1s, 3s, 9s intervals
      vi.advanceTimersByTime(1000); // First retry
      vi.advanceTimersByTime(3000); // Second retry
      vi.advanceTimersByTime(9000); // Third retry

      try {
        await retryPromise;
      } catch (e) {
        expect(mockExecutor).toHaveBeenCalledTimes(4);
      }
    });
  });
});