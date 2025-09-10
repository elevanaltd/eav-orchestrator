/**
 * @fileoverview Fractional indexing wrapper for component ordering
 * 
 * Implements LexoRank algorithm wrapper for O(1) reordering operations
 * Addresses Week 1 Blocker #3 from BUILD PLAN with critical engineer requirements
 * 
 * Features:
 * - O(1) reordering operations (amortized)
 * - Support for 1000+ components per script
 * - Server-side validation for position strings
 * - Rebalancing strategy for performance optimization
 * - Optimistic locking compatibility
 * 
 * Critical Engineer Requirements Addressed:
 * - Race condition prevention through optimistic locking hints
 * - Server-side validation for data integrity
 * - Rebalancing strategy for performance cliffs
 * - Position string length limits and validation
 */

// Context7: consulted for fractional-indexing library
// Critical-Engineer: consulted for fractional indexing strategy and concurrency control  
// Testguard: approved RED-GREEN-REFACTOR methodology
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

/**
 * Maximum allowed length for position strings (server-side validation)
 * Critical Engineer requirement: prevent DoS attacks via oversized strings
 */
const MAX_POSITION_LENGTH = 255;

/**
 * Regex for validating position string characters
 * Only alphanumeric characters allowed per LexoRank algorithm
 */
const POSITION_VALIDATION_REGEX = /^[a-zA-Z0-9]+$/;

/**
 * Threshold for detecting when rebalancing might be needed
 * Based on average string length growth
 */
const REBALANCE_THRESHOLD_RATIO = 2.5;

/**
 * Generate initial position for the first component in a script
 * 
 * @returns Initial position string
 */
export function generateInitialPosition(): string {
  // Use fractional-indexing library's default initial position
  return generateKeyBetween(null, null);
}

/**
 * Generate position between two existing positions
 * 
 * @param before Position before the new position (null for start)
 * @param after Position after the new position (null for end)
 * @returns New position string between the given positions
 */
export function generatePositionBetween(before: string | null, after: string | null): string {
  return generateKeyBetween(before, after);
}

/**
 * Generate position after an existing position
 * 
 * @param position Existing position
 * @returns New position string after the given position
 */
export function generatePositionAfter(position: string): string {
  return generateKeyBetween(position, null);
}

/**
 * Generate position before an existing position
 * 
 * @param position Existing position
 * @returns New position string before the given position
 */
export function generatePositionBefore(position: string): string {
  return generateKeyBetween(null, position);
}

/**
 * Validate position string according to server-side rules
 * Critical Engineer requirement: prevent invalid data and DoS attacks
 * 
 * @param position Position string to validate
 * @returns True if position is valid, false otherwise
 */
export function validatePositionString(position: string): boolean {
  if (!position || typeof position !== 'string') {
    return false;
  }
  
  if (position.length === 0 || position.length > MAX_POSITION_LENGTH) {
    return false;
  }
  
  return POSITION_VALIDATION_REGEX.test(position);
}

/**
 * Check if a position string is valid
 * 
 * @param position Position string to validate
 * @returns True if position is valid, false otherwise
 */
export function isValidPosition(position: string): boolean {
  return validatePositionString(position);
}

/**
 * Compare two position strings for sorting
 * 
 * @param a First position string
 * @param b Second position string
 * @returns Negative if a < b, positive if a > b, zero if a === b
 */
export function comparePositions(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Sort an array of position strings in ascending order
 * 
 * @param positions Array of position strings
 * @returns Sorted array of position strings
 */
export function getOrderedPositions(positions: string[]): string[] {
  return [...positions].sort(comparePositions);
}

/**
 * Detect if rebalancing is needed for optimal performance
 * Critical Engineer requirement: handle rebalancing strategy
 * 
 * @param positions Array of position strings to analyze
 * @returns True if rebalancing is recommended, false otherwise
 */
export function detectRebalanceNeeded(positions: string[]): boolean {
  if (positions.length < 3) {
    return false;
  }
  
  // Calculate average string length
  const totalLength = positions.reduce((sum, pos) => sum + pos.length, 0);
  const averageLength = totalLength / positions.length;
  
  // Check for positions that are significantly longer than average
  const longPositions = positions.filter(pos => pos.length > averageLength * REBALANCE_THRESHOLD_RATIO);
  
  // If more than 20% of positions are significantly longer, suggest rebalancing
  return longPositions.length > positions.length * 0.2;
}

/**
 * Generate rebalanced positions with optimal spacing
 * Critical Engineer requirement: O(N) rebalancing operation
 * 
 * This should be called server-side when rebalancing is needed
 * to prevent client-side performance cliffs
 * 
 * @param positions Array of position strings to rebalance
 * @returns Array of new position strings with optimal spacing
 */
export function generateRebalancedPositions(positions: string[]): string[] {
  if (positions.length === 0) {
    return [];
  }
  
  if (positions.length === 1) {
    return [generateInitialPosition()];
  }
  
  // Sort positions to ensure correct order
  const sortedPositions = getOrderedPositions(positions);
  
  // Use fractional-indexing's bulk generation for optimal spacing
  // Generate N positions between null and null (evenly distributed)
  const rebalanced = generateNKeysBetween(null, null, sortedPositions.length);
  
  return rebalanced;
}

/**
 * Generate bulk positions for initial script setup
 * Optimized for creating many positions at once
 * 
 * @param count Number of positions to generate
 * @returns Array of evenly spaced position strings
 */
export function generateBulkPositions(count: number): string[] {
  if (count <= 0) {
    return [];
  }
  
  if (count === 1) {
    return [generateInitialPosition()];
  }
  
  return generateNKeysBetween(null, null, count);
}

/**
 * Type definitions for position operations
 */
export interface PositionOperation {
  readonly type: 'insert' | 'move' | 'rebalance';
  readonly componentId: string;
  readonly oldPosition?: string;
  readonly newPosition: string;
  readonly version?: number; // For optimistic locking
}

/**
 * Type for rebalancing operation
 */
export interface RebalanceOperation {
  readonly type: 'rebalance';
  readonly componentIds: string[];
  readonly newPositions: string[];
  readonly reason: 'performance' | 'maintenance';
}

/**
 * Validate a position operation before database update
 * Critical Engineer requirement: prevent race conditions
 * 
 * @param operation Position operation to validate
 * @returns Validation result with any errors
 */
export function validatePositionOperation(operation: PositionOperation): {
  valid: boolean;
  error?: string;
} {
  if (!validatePositionString(operation.newPosition)) {
    return {
      valid: false,
      error: 'Invalid position string format'
    };
  }
  
  if (operation.type === 'move' && !operation.oldPosition) {
    return {
      valid: false,
      error: 'Move operation requires oldPosition'
    };
  }
  
  if (operation.type === 'move' && !operation.version) {
    return {
      valid: false,
      error: 'Move operation requires version for optimistic locking'
    };
  }
  
  return { valid: true };
}
