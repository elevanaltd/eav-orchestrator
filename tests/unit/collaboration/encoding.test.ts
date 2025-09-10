/**
 * Binary Encoding/Decoding Unit Tests
 * 
 * TRACED Protocol: TEST FIRST (RED) - These tests MUST fail initially
 * Testing binary update encoding utilities for Yjs + Supabase transport
 */

// Context7: consulted for vitest
// Context7: consulted for yjs
import { describe, it, expect } from 'vitest';
import * as Y from 'yjs';
import { 
  encodeBinaryUpdate, 
  decodeBinaryUpdate, 
  validateBinaryUpdate,
  BinaryUpdateError 
} from '../../../src/lib/collaboration/encoding';

describe('Binary Encoding Utilities', () => {
  describe('encodeBinaryUpdate', () => {
    it('should encode Uint8Array to base64 string', () => {
      const testData = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      
      // This test MUST fail - encodeBinaryUpdate doesn't exist yet
      const encoded = encodeBinaryUpdate(testData);
      
      expect(encoded).toBe('SGVsbG8=');
      expect(typeof encoded).toBe('string');
    });

    it('should handle empty arrays', () => {
      const emptyData = new Uint8Array([]);
      
      const encoded = encodeBinaryUpdate(emptyData);
      
      expect(encoded).toBe('');
    });

    it('should handle large binary data', () => {
      // Create a large update (1KB)
      const largeData = new Uint8Array(1024).fill(255);
      
      const encoded = encodeBinaryUpdate(largeData);
      
      expect(encoded).toBeDefined();
      expect(encoded.length).toBeGreaterThan(0);
    });

    it('should produce deterministic output', () => {
      const testData = new Uint8Array([1, 2, 3, 4, 5]);
      
      const encoded1 = encodeBinaryUpdate(testData);
      const encoded2 = encodeBinaryUpdate(testData);
      
      expect(encoded1).toBe(encoded2);
    });
  });

  describe('decodeBinaryUpdate', () => {
    it('should decode base64 string to Uint8Array', () => {
      const base64String = 'SGVsbG8='; // "Hello"
      
      // This test MUST fail - decodeBinaryUpdate doesn't exist yet
      const decoded = decodeBinaryUpdate(base64String);
      
      expect(decoded).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
      expect(decoded).toBeInstanceOf(Uint8Array);
    });

    it('should handle empty strings', () => {
      const decoded = decodeBinaryUpdate('');
      
      expect(decoded).toEqual(new Uint8Array([]));
    });

    it('should roundtrip with encoding', () => {
      const originalData = new Uint8Array([10, 20, 30, 40, 50]);
      
      const encoded = encodeBinaryUpdate(originalData);
      const decoded = decodeBinaryUpdate(encoded);
      
      expect(decoded).toEqual(originalData);
    });

    it('should throw error for invalid base64', () => {
      const invalidBase64 = 'invalid-base64-string!@#';
      
      expect(() => {
        decodeBinaryUpdate(invalidBase64);
      }).toThrow(BinaryUpdateError);
    });
  });

  describe('validateBinaryUpdate', () => {
    it('should validate correct Yjs update structure', () => {
      // Create a valid Yjs update
      const doc = new Y.Doc();
      doc.getText('content').insert(0, 'Test content');
      const validUpdate = Y.encodeStateAsUpdate(doc);
      
      // This test MUST fail - validateBinaryUpdate doesn't exist yet
      const isValid = validateBinaryUpdate(validUpdate);
      
      expect(isValid).toBe(true);
    });

    it('should reject malformed update data', () => {
      const malformedUpdate = new Uint8Array([1, 2, 3]); // Too short
      
      const isValid = validateBinaryUpdate(malformedUpdate);
      
      expect(isValid).toBe(false);
    });

    it('should reject empty updates', () => {
      const emptyUpdate = new Uint8Array([]);
      
      const isValid = validateBinaryUpdate(emptyUpdate);
      
      expect(isValid).toBe(false);
    });

    it('should handle maximum size limit', () => {
      // Create update that exceeds size limit (1MB)
      const oversizedUpdate = new Uint8Array(1024 * 1024 + 1).fill(255);
      
      const isValid = validateBinaryUpdate(oversizedUpdate);
      
      expect(isValid).toBe(false);
    });
  });

  describe('Yjs Integration', () => {
    it('should encode and decode real Yjs updates', () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      
      // Make changes to doc1
      doc1.getText('content').insert(0, 'Hello Yjs CRDT!');
      const update = Y.encodeStateAsUpdate(doc1);
      
      // Encode for transport
      const encoded = encodeBinaryUpdate(update);
      expect(encoded).toBeDefined();
      
      // Decode and apply to doc2
      const decoded = decodeBinaryUpdate(encoded);
      Y.applyUpdate(doc2, decoded);
      
      // Verify synchronization
      expect(doc2.getText('content').toString()).toBe('Hello Yjs CRDT!');
    });

    it('should preserve CRDT merge semantics', () => {
      const doc1 = new Y.Doc();
      const doc2 = new Y.Doc();
      
      // Concurrent edits
      doc1.getText('content').insert(0, 'User 1 edit');
      doc2.getText('content').insert(0, 'User 2 edit');
      
      // Encode updates
      const update1 = Y.encodeStateAsUpdate(doc1);
      const update2 = Y.encodeStateAsUpdate(doc2);
      
      const encoded1 = encodeBinaryUpdate(update1);
      const encoded2 = encodeBinaryUpdate(update2);
      
      // Cross-apply decoded updates
      Y.applyUpdate(doc1, decodeBinaryUpdate(encoded2));
      Y.applyUpdate(doc2, decodeBinaryUpdate(encoded1));
      
      // Both documents should converge to same state
      expect(doc1.getText('content').toString()).toBe(doc2.getText('content').toString());
    });

    it('should handle complex document structures', () => {
      const doc = new Y.Doc();
      
      // Create complex nested structure
      const yarray = doc.getArray('items');
      const ymap = doc.getMap('metadata');
      const ytext = doc.getText('content');
      
      yarray.push(['item1', 'item2']);
      ymap.set('author', 'test-user');
      ytext.insert(0, 'Complex document with multiple types');
      
      const update = Y.encodeStateAsUpdate(doc);
      const encoded = encodeBinaryUpdate(update);
      const decoded = decodeBinaryUpdate(encoded);
      
      // Apply to new document
      const doc2 = new Y.Doc();
      Y.applyUpdate(doc2, decoded);
      
      expect(doc2.getArray('items').toArray()).toEqual(['item1', 'item2']);
      expect(doc2.getMap('metadata').get('author')).toBe('test-user');
      expect(doc2.getText('content').toString()).toBe('Complex document with multiple types');
    });
  });

  describe('Error Handling', () => {
    it('should provide detailed error messages', () => {
      try {
        decodeBinaryUpdate('invalid-base64');
      } catch (error) {
        expect(error).toBeInstanceOf(BinaryUpdateError);
        expect(error.message).toContain('Failed to decode base64');
      }
    });

    it('should handle null/undefined inputs gracefully', () => {
      expect(() => encodeBinaryUpdate(null as any)).toThrow(BinaryUpdateError);
      expect(() => encodeBinaryUpdate(undefined as any)).toThrow(BinaryUpdateError);
      expect(() => decodeBinaryUpdate(null as any)).toThrow(BinaryUpdateError);
      expect(() => decodeBinaryUpdate(undefined as any)).toThrow(BinaryUpdateError);
    });
  });
});