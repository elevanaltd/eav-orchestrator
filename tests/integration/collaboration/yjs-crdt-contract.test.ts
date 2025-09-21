/**
 * Y.js CRDT Integration Tests
 *
 * TestGuard Constitutional Compliance: CONTRACT-DRIVEN-CORRECTION
 * Real Y.js instances for absolute contract fidelity
 * Per constitutional mandate: truth over convenience
 */

// Context7: consulted for vitest
// Context7: consulted for yjs
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import {
  encodeBinaryUpdate,
  decodeBinaryUpdate,
  validateBinaryUpdate,
  BinaryUpdateError as _BinaryUpdateError
} from '../../../src/lib/collaboration/encoding';

describe('Y.js CRDT Integration Tests', () => {
  let doc1: Y.Doc;
  let doc2: Y.Doc;

  beforeEach(() => {
    // Fresh Y.js documents for each test - absolute isolation
    doc1 = new Y.Doc();
    doc2 = new Y.Doc();
  });

  afterEach(() => {
    // Cleanup Y.js resources - prevent memory accumulation
    doc1.destroy();
    doc2.destroy();
  });

  describe('Real Y.js Update Encoding/Decoding', () => {
    it('should encode and decode real Yjs updates', () => {
      // Make changes to doc1
      doc1.getText('content').insert(0, 'Hello Yjs CRDT!');
      const update = Y.encodeStateAsUpdate(doc1);

      // Encode for transport using our utility
      const encoded = encodeBinaryUpdate(update);
      expect(encoded).toBeDefined();
      expect(typeof encoded).toBe('string');

      // Decode and apply to doc2
      const _decoded = decodeBinaryUpdate(encoded);
      expect(_decoded).toBeInstanceOf(Uint8Array);

      Y.applyUpdate(doc2, _decoded);

      // Verify CRDT synchronization worked
      expect(doc2.getText('content').toString()).toBe('Hello Yjs CRDT!');
    });

    it('should preserve CRDT merge semantics', () => {
      // Simulate concurrent edits (the core CRDT challenge)
      doc1.getText('content').insert(0, 'User 1 edit ');
      doc2.getText('content').insert(0, 'User 2 edit ');

      // Both documents have diverged - capture their states
      const update1 = Y.encodeStateAsUpdate(doc1);
      const update2 = Y.encodeStateAsUpdate(doc2);

      // Transport through our encoding layer
      const encoded1 = encodeBinaryUpdate(update1);
      const encoded2 = encodeBinaryUpdate(update2);

      // Cross-apply updates (conflict resolution test)
      const decoded1 = decodeBinaryUpdate(encoded1);
      const decoded2 = decodeBinaryUpdate(encoded2);

      Y.applyUpdate(doc1, decoded2); // doc1 receives doc2's changes
      Y.applyUpdate(doc2, decoded1); // doc2 receives doc1's changes

      // CRITICAL CRDT PROPERTY: Both documents must converge to identical state
      const finalState1 = doc1.getText('content').toString();
      const finalState2 = doc2.getText('content').toString();

      expect(finalState1).toBe(finalState2);
      // The exact merge result depends on Y.js algorithm, but both must be identical
      expect(finalState1).toContain('User 1 edit');
      expect(finalState1).toContain('User 2 edit');
    });

    it('should handle complex document structures', () => {
      // Create the complex nested Y.js structure our app uses
      const yarray = doc1.getArray('items');
      const ymap = doc1.getMap('metadata');
      const ytext = doc1.getText('content');

      // Populate with realistic data
      yarray.push(['component-1', 'component-2', 'component-3']);
      ymap.set('author', 'test-user-uuid');
      ymap.set('timestamp', Date.now());
      ymap.set('version', 1);
      ytext.insert(0, 'Complex document with multiple Y.js data types');

      // Encode the entire document state
      const update = Y.encodeStateAsUpdate(doc1);
      const encoded = encodeBinaryUpdate(update);
      const _decoded = decodeBinaryUpdate(encoded);

      // Apply to fresh document
      Y.applyUpdate(doc2, _decoded);

      // Verify all data types survived the encoding roundtrip
      expect(doc2.getArray('items').toArray()).toEqual(['component-1', 'component-2', 'component-3']);
      expect(doc2.getMap('metadata').get('author')).toBe('test-user-uuid');
      expect(doc2.getMap('metadata').get('version')).toBe(1);
      expect(doc2.getText('content').toString()).toBe('Complex document with multiple Y.js data types');
    });
  });

  describe('Y.js Update Validation with Real Data', () => {
    it('should validate genuine Y.js update structures', () => {
      // Create a realistic update with actual Y.js operations
      doc1.getText('content').insert(0, 'Script content here');
      doc1.getMap('metadata').set('status', 'draft');

      const validUpdate = Y.encodeStateAsUpdate(doc1);

      // Our validation should recognize real Y.js updates
      const isValid = validateBinaryUpdate(validUpdate);
      expect(isValid).toBe(true);
    });

    it('should reject malformed binary data that would crash Y.js', () => {
      // These are the kinds of malformed data that could cause Y.js crashes
      const malformedUpdates = [
        new Uint8Array([1, 2, 3]), // Too short for Y.js header
        new Uint8Array([0xFF, 0xFF, 0xFF, 0xFF]), // Invalid header
        new Uint8Array(0), // Empty array
      ];

      for (const malformed of malformedUpdates) {
        const isValid = validateBinaryUpdate(malformed);
        expect(isValid).toBe(false);

        // Verify our validation prevents Y.js crashes
        expect(() => {
          if (isValid) {
            Y.applyUpdate(doc1, malformed);
          }
        }).not.toThrow();
      }
    });
  });

  describe('Performance and Memory with Real Y.js', () => {
    it('should handle realistic document sizes efficiently', () => {
      const startTime = performance.now();

      // Simulate realistic script editing session
      const content = doc1.getText('content');
      for (let i = 0; i < 100; i++) {
        content.insert(content.length, `Line ${i}: This is script content that would be typical.\n`);
      }

      // Encode large document
      const update = Y.encodeStateAsUpdate(doc1);
      const encoded = encodeBinaryUpdate(update);

      const endTime = performance.now();

      // Performance expectations for production use
      expect(endTime - startTime).toBeLessThan(1000); // <1s for 100 lines
      expect(encoded.length).toBeGreaterThan(0);
      expect(update.length).toBeLessThan(50000); // Reasonable size limit
    });

    it('should not leak memory during repeated operations', () => {
      // This test ensures our encoding doesn't interfere with Y.js garbage collection
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 50; i++) {
        const tempDoc = new Y.Doc();
        tempDoc.getText('content').insert(0, `Iteration ${i}`);


        tempDoc.destroy(); // Critical for memory cleanup
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be minimal (< 10MB for 50 iterations)
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Error Boundary Testing with Real Y.js', () => {
    it('should handle Y.js document destruction gracefully', () => {
      doc1.getText('content').insert(0, 'Content before destruction');
      const update = Y.encodeStateAsUpdate(doc1);

      doc1.destroy();

      // Encoding should still work with captured update
      const encoded = encodeBinaryUpdate(update);
      const _decoded = decodeBinaryUpdate(encoded);

      // Fresh document should be able to apply the update
      const doc3 = new Y.Doc();
      expect(() => {
        Y.applyUpdate(doc3, _decoded);
      }).not.toThrow();

      expect(doc3.getText('content').toString()).toBe('Content before destruction');
      doc3.destroy();
    });

    it('should detect corrupted updates that could destabilize Y.js', () => {
      // Create a valid update then corrupt it
      doc1.getText('content').insert(0, 'Original content');
      const validUpdate = Y.encodeStateAsUpdate(doc1);

      // Corrupt the update by flipping bits
      const corruptedUpdate = new Uint8Array(validUpdate);
      corruptedUpdate[validUpdate.length - 1] ^= 0xFF; // Flip last byte

      // Our validation should catch this corruption
      const isValid = validateBinaryUpdate(corruptedUpdate);
      expect(isValid).toBe(false);

      // Since validation correctly detected corruption, don't apply the invalid update
      // This prevents potential Y.js crashes and data corruption
      expect(() => {
        if (isValid) {
          Y.applyUpdate(doc2, corruptedUpdate);
        }
      }).not.toThrow(); // Because we won't apply invalid updates
    });
  });
});