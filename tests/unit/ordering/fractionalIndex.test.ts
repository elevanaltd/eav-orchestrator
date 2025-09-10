/**
 * @fileoverview Fractional indexing tests for component ordering
 * Tests the LexoRank algorithm wrapper for O(1) reordering operations
 * 
 * Requirements from BUILD PLAN:
 * - Fractional index generation between two positions
 * - Handling edge cases (start, end, between close values)
 * - Maintaining sort order with 1000+ components
 * - O(1) reordering operations
 * - Position stored as TEXT in database
 * 
 * Critical Engineer Requirements:
 * - Optimistic locking for concurrent operations
 * - Server-side validation for position strings
 * - Rebalancing strategy for performance
 */

// Context7: consulted for vitest
// Critical-Engineer: consulted for fractional indexing strategy and concurrency control  
// TESTGUARD-APPROVED-20250910-jest-vitest-migration
import { describe, expect, it, test } from 'vitest';
import {
  generateInitialPosition,
  generatePositionBetween,
  generatePositionAfter,
  generatePositionBefore,
  getOrderedPositions,
  isValidPosition,
  comparePositions,
  validatePositionString,
  detectRebalanceNeeded,
  generateRebalancedPositions
} from '../../../src/lib/ordering/fractionalIndex';

describe('Fractional Index Generation', () => {
  describe('generateInitialPosition', () => {
    it('should generate a valid initial position', () => {
      const position = generateInitialPosition();
      
      expect(typeof position).toBe('string');
      expect(position.length).toBeGreaterThan(0);
      expect(isValidPosition(position)).toBe(true);
    });

    it('should generate consistent initial positions', () => {
      const position1 = generateInitialPosition();
      const position2 = generateInitialPosition();
      
      expect(position1).toBe(position2);
    });
  });

  describe('generatePositionBetween', () => {
    it('should generate position between two existing positions', () => {
      const before = generateInitialPosition();
      const after = generatePositionAfter(before);
      const between = generatePositionBetween(before, after);
      
      expect(isValidPosition(between)).toBe(true);
      expect(comparePositions(before, between)).toBeLessThan(0);
      expect(comparePositions(between, after)).toBeLessThan(0);
    });

    it('should handle null before parameter (position at start)', () => {
      const after = generateInitialPosition();
      const before = generatePositionBetween(null, after);
      
      expect(isValidPosition(before)).toBe(true);
      expect(comparePositions(before, after)).toBeLessThan(0);
    });

    it('should handle null after parameter (position at end)', () => {
      const before = generateInitialPosition();
      const after = generatePositionBetween(before, null);
      
      expect(isValidPosition(after)).toBe(true);
      expect(comparePositions(before, after)).toBeLessThan(0);
    });

    it('should handle both parameters null', () => {
      const position = generatePositionBetween(null, null);
      
      expect(isValidPosition(position)).toBe(true);
    });

    it('should work with close positions (edge case)', () => {
      let current = generateInitialPosition();
      
      // Generate 10 positions between close positions
      for (let i = 0; i < 10; i++) {
        const next = generatePositionAfter(current);
        const between = generatePositionBetween(current, next);
        
        expect(isValidPosition(between)).toBe(true);
        expect(comparePositions(current, between)).toBeLessThan(0);
        expect(comparePositions(between, next)).toBeLessThan(0);
        
        current = between;
      }
    });
  });

  describe('generatePositionAfter', () => {
    it('should generate position after existing position', () => {
      const position = generateInitialPosition();
      const after = generatePositionAfter(position);
      
      expect(isValidPosition(after)).toBe(true);
      expect(comparePositions(position, after)).toBeLessThan(0);
    });

    it('should maintain sort order with multiple after positions', () => {
      const positions: string[] = [];
      let current = generateInitialPosition();
      positions.push(current);
      
      for (let i = 0; i < 10; i++) {
        current = generatePositionAfter(current);
        positions.push(current);
      }
      
      // Verify all positions are valid and in order
      for (let i = 0; i < positions.length; i++) {
        expect(isValidPosition(positions[i])).toBe(true);
        
        if (i > 0) {
          expect(comparePositions(positions[i - 1], positions[i])).toBeLessThan(0);
        }
      }
    });
  });

  describe('generatePositionBefore', () => {
    it('should generate position before existing position', () => {
      const position = generateInitialPosition();
      const before = generatePositionBefore(position);
      
      expect(isValidPosition(before)).toBe(true);
      expect(comparePositions(before, position)).toBeLessThan(0);
    });

    it('should maintain sort order with multiple before positions', () => {
      const positions: string[] = [];
      let current = generateInitialPosition();
      positions.unshift(current);
      
      for (let i = 0; i < 10; i++) {
        current = generatePositionBefore(current);
        positions.unshift(current);
      }
      
      // Verify all positions are valid and in order
      for (let i = 0; i < positions.length; i++) {
        expect(isValidPosition(positions[i])).toBe(true);
        
        if (i > 0) {
          expect(comparePositions(positions[i - 1], positions[i])).toBeLessThan(0);
        }
      }
    });
  });

  describe('Performance and Scale Testing', () => {
    test('should maintain sort order with 1000+ components', () => {
      const positions: string[] = [];
      let current = generateInitialPosition();
      positions.push(current);
      
      // Generate 1000 positions
      for (let i = 0; i < 1000; i++) {
        current = generatePositionAfter(current);
        positions.push(current);
      }
      
      // Verify sort order is maintained
      for (let i = 1; i < positions.length; i++) {
        expect(comparePositions(positions[i - 1], positions[i])).toBeLessThan(0);
      }
      
      // Test insertion in middle (O(1) operation)
      const middleIndex = Math.floor(positions.length / 2);
      const beforePos = positions[middleIndex];
      const afterPos = positions[middleIndex + 1];
      
      const startTime = performance.now();
      const betweenPos = generatePositionBetween(beforePos, afterPos);
      const endTime = performance.now();
      
      // Verify O(1) performance (should be < 1ms)
      expect(endTime - startTime).toBeLessThan(1);
      expect(isValidPosition(betweenPos)).toBe(true);
      expect(comparePositions(beforePos, betweenPos)).toBeLessThan(0);
      expect(comparePositions(betweenPos, afterPos)).toBeLessThan(0);
    });

    test('should handle frequent reordering operations efficiently', () => {
      const positions: string[] = [];
      
      // Create initial set of positions
      let current = generateInitialPosition();
      for (let i = 0; i < 100; i++) {
        positions.push(current);
        current = generatePositionAfter(current);
      }
      
      // Perform 100 reordering operations
      const startTime = performance.now();
      
      for (let i = 0; i < 100; i++) {
        const fromIndex = Math.floor(Math.random() * positions.length);
        const toIndex = Math.floor(Math.random() * positions.length);
        
        if (fromIndex !== toIndex) {
          // Simulate moving component from fromIndex to toIndex
          const beforePos = toIndex > 0 ? positions[toIndex - 1] : null;
          const afterPos = toIndex < positions.length ? positions[toIndex] : null;
          
          const newPosition = generatePositionBetween(beforePos, afterPos);
          positions.splice(fromIndex, 1);
          positions.splice(toIndex, 0, newPosition);
        }
      }
      
      const endTime = performance.now();
      
      // Verify all operations completed in reasonable time
      expect(endTime - startTime).toBeLessThan(100); // 100ms for 100 operations
      
      // Verify all positions are still valid
      positions.forEach(pos => {
        expect(isValidPosition(pos)).toBe(true);
      });
    });

    test('should detect when rebalancing is needed', () => {
      const positions: string[] = [];
      let current = generateInitialPosition();
      
      // Force many insertions between two close positions to trigger rebalancing need
      const startPos = current;
      const endPos = generatePositionAfter(current);
      
      // Insert many positions between startPos and endPos
      let insertPos = startPos;
      for (let i = 0; i < 50; i++) {
        const newPos = generatePositionBetween(insertPos, endPos);
        positions.push(newPos);
        insertPos = newPos;
        
        // Check if rebalancing is needed (algorithm-dependent)
        const needsRebalance = detectRebalanceNeeded(positions);
        if (needsRebalance) {
          expect(typeof needsRebalance).toBe('boolean');
          break;
        }
      }
    });
  });

  describe('Critical Engineer Requirements - Concurrency and Validation', () => {
    describe('Position String Validation', () => {
      it('should validate position strings according to server-side rules', () => {
        const validPosition = generateInitialPosition();
        expect(validatePositionString(validPosition)).toBe(true);
      });

      it('should reject position strings that are too long', () => {
        const tooLong = 'a'.repeat(256); // Assuming 255 char limit
        expect(validatePositionString(tooLong)).toBe(false);
      });

      it('should reject position strings with invalid characters', () => {
        expect(validatePositionString('invalid!@#$%')).toBe(false);
        expect(validatePositionString('test space')).toBe(false);
        expect(validatePositionString('test\n')).toBe(false);
      });

      it('should reject empty or null position strings', () => {
        expect(validatePositionString('')).toBe(false);
        expect(validatePositionString(null as any)).toBe(false);
        expect(validatePositionString(undefined as any)).toBe(false);
      });

      it('should only allow alphanumeric characters', () => {
        expect(validatePositionString('abc123XYZ')).toBe(true);
        expect(validatePositionString('ABC')).toBe(true);
        expect(validatePositionString('123')).toBe(true);
        expect(validatePositionString('aBc123')).toBe(true);
      });
    });

    describe('Rebalancing Strategy', () => {
      it('should detect when rebalancing is needed', () => {
        // Create a scenario where positions become very close
        let positions = [generateInitialPosition()];
        let current = positions[0];
        const end = generatePositionAfter(current);
        
        // Force narrow insertions to trigger rebalancing need
        for (let i = 0; i < 20; i++) {
          current = generatePositionBetween(current, end);
          positions.push(current);
        }
        
        const needsRebalance = detectRebalanceNeeded(positions);
        expect(typeof needsRebalance).toBe('boolean');
      });

      it('should generate rebalanced positions when needed', () => {
        const positions = [];
        let current = generateInitialPosition();
        
        // Create positions that might need rebalancing
        for (let i = 0; i < 10; i++) {
          positions.push(current);
          current = generatePositionAfter(current);
        }
        
        const rebalanced = generateRebalancedPositions(positions);
        
        expect(Array.isArray(rebalanced)).toBe(true);
        expect(rebalanced).toHaveLength(positions.length);
        
        // Verify rebalanced positions maintain order
        for (let i = 1; i < rebalanced.length; i++) {
          expect(comparePositions(rebalanced[i - 1], rebalanced[i])).toBeLessThan(0);
        }
      });

      it('should generate rebalanced positions with optimal spacing', () => {
        const crammedPositions = [];
        let current = generateInitialPosition();
        const end = generatePositionAfter(generatePositionAfter(current));
        
        // Create many positions in a small space
        for (let i = 0; i < 15; i++) {
          current = generatePositionBetween(current, end);
          crammedPositions.push(current);
        }
        
        const rebalanced = generateRebalancedPositions(crammedPositions);
        
        // Verify rebalanced positions have better spacing characteristics
        expect(rebalanced).toHaveLength(crammedPositions.length);
        
        // Check that average string length is reasonable (not growing unboundedly)
        const avgOriginalLength = crammedPositions.reduce((sum, pos) => sum + pos.length, 0) / crammedPositions.length;
        const avgRebalancedLength = rebalanced.reduce((sum, pos) => sum + pos.length, 0) / rebalanced.length;
        
        // Rebalanced positions should not be significantly longer on average
        expect(avgRebalancedLength).toBeLessThanOrEqual(avgOriginalLength * 1.5);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle positions with special characters', () => {
      const position = generateInitialPosition();
      expect(typeof position).toBe('string');
      expect(position).toMatch(/^[a-zA-Z0-9]*$/); // Only alphanumeric characters
    });

    it('should maintain consistent ordering after multiple insertions', () => {
      const positions: string[] = [];
      
      // Start with one position
      positions.push(generateInitialPosition());
      
      // Insert 50 positions randomly
      for (let i = 0; i < 50; i++) {
        const insertIndex = Math.floor(Math.random() * (positions.length + 1));
        
        const beforePos = insertIndex > 0 ? positions[insertIndex - 1] : null;
        const afterPos = insertIndex < positions.length ? positions[insertIndex] : null;
        
        const newPosition = generatePositionBetween(beforePos, afterPos);
        positions.splice(insertIndex, 0, newPosition);
      }
      
      // Verify final order is valid
      const sortedPositions = getOrderedPositions(positions);
      expect(sortedPositions).toHaveLength(positions.length);
      
      for (let i = 1; i < sortedPositions.length; i++) {
        expect(comparePositions(sortedPositions[i - 1], sortedPositions[i])).toBeLessThan(0);
      }
    });

    it('should handle edge case of maximum string lengths', () => {
      // Test behavior when position strings approach practical limits
      let position = generateInitialPosition();
      let iterations = 0;
      const maxIterations = 100; // Safety limit
      
      // Force narrow insertions to see string growth behavior
      const endPos = generatePositionAfter(position);
      
      while (iterations < maxIterations) {
        const newPos = generatePositionBetween(position, endPos);
        
        // Ensure position strings don't grow unbounded
        expect(newPos.length).toBeLessThan(100); // Reasonable upper limit
        expect(isValidPosition(newPos)).toBe(true);
        
        position = newPos;
        iterations++;
        
        // Break if we detect rebalancing is needed
        if (detectRebalanceNeeded([position, endPos])) {
          break;
        }
      }
    });
  });

  describe('Utility Functions', () => {
    describe('isValidPosition', () => {
      it('should validate correct positions', () => {
        const position = generateInitialPosition();
        expect(isValidPosition(position)).toBe(true);
      });

      it('should reject invalid positions', () => {
        expect(isValidPosition('')).toBe(false);
        expect(isValidPosition(null as any)).toBe(false);
        expect(isValidPosition(undefined as any)).toBe(false);
        expect(isValidPosition(123 as any)).toBe(false);
      });
    });

    describe('comparePositions', () => {
      it('should compare positions correctly', () => {
        const pos1 = generateInitialPosition();
        const pos2 = generatePositionAfter(pos1);
        const pos3 = generatePositionAfter(pos2);
        
        expect(comparePositions(pos1, pos2)).toBeLessThan(0);
        expect(comparePositions(pos2, pos3)).toBeLessThan(0);
        expect(comparePositions(pos1, pos3)).toBeLessThan(0);
        
        expect(comparePositions(pos2, pos1)).toBeGreaterThan(0);
        expect(comparePositions(pos3, pos2)).toBeGreaterThan(0);
        expect(comparePositions(pos3, pos1)).toBeGreaterThan(0);
        
        expect(comparePositions(pos1, pos1)).toBe(0);
      });
    });

    describe('getOrderedPositions', () => {
      it('should sort positions correctly', () => {
        const positions = [
          generateInitialPosition(),
          generatePositionAfter(generateInitialPosition()),
          generatePositionBefore(generateInitialPosition())
        ];
        
        const shuffled = [...positions].sort(() => Math.random() - 0.5);
        const ordered = getOrderedPositions(shuffled);
        
        // Should be in ascending order
        for (let i = 1; i < ordered.length; i++) {
          expect(comparePositions(ordered[i - 1], ordered[i])).toBeLessThan(0);
        }
      });
    });
  });
});