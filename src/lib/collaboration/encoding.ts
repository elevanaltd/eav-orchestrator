/**
 * Binary Encoding/Decoding Utilities
 * 
 * STUB IMPLEMENTATION for TDD - Tests written first, implementation pending
 * Context7: consulted for yjs
 * Critical-Engineer: consulted for Quality gate architecture
 */

export class BinaryUpdateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BinaryUpdateError';
  }
}

export const MAX_UPDATE_SIZE = 100 * 1024; // 100KB as per technical-architect guidance

export function encodeBinaryUpdate(data: Uint8Array): string {
  // Input validation
  if (data === null || data === undefined) {
    throw new BinaryUpdateError('Input data cannot be null or undefined');
  }
  
  if (!(data instanceof Uint8Array)) {
    throw new BinaryUpdateError('Input data must be a Uint8Array');
  }
  
  // Size validation per technical-architect requirements
  if (data.length > MAX_UPDATE_SIZE) {
    throw new BinaryUpdateError(`Update size ${data.length} exceeds maximum of ${MAX_UPDATE_SIZE} bytes`);
  }
  
  // Handle empty arrays
  if (data.length === 0) {
    return '';
  }
  
  // Convert Uint8Array to base64 string
  // Using Node.js Buffer for reliable base64 encoding
  const buffer = Buffer.from(data);
  return buffer.toString('base64');
}

export function decodeBinaryUpdate(encoded: string): Uint8Array {
  // Input validation
  if (encoded === null || encoded === undefined) {
    throw new BinaryUpdateError('Input encoded string cannot be null or undefined');
  }
  
  if (typeof encoded !== 'string') {
    throw new BinaryUpdateError('Input must be a string');
  }
  
  // Handle empty strings
  if (encoded === '') {
    return new Uint8Array([]);
  }
  
  // Validate base64 format before attempting decode
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(encoded)) {
    throw new BinaryUpdateError(`Failed to decode base64: Invalid base64 format`);
  }
  
  try {
    // Decode base64 string to Buffer, then to Uint8Array
    const buffer = Buffer.from(encoded, 'base64');
    return new Uint8Array(buffer);
  } catch (error) {
    throw new BinaryUpdateError(`Failed to decode base64: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export function validateBinaryUpdate(data: unknown): boolean {
  // Basic type validation
  if (!(data instanceof Uint8Array)) {
    return false;
  }
  
  // Empty updates are invalid
  if (data.length === 0) {
    return false;
  }
  
  // Size limit validation (1MB maximum as per tests)
  const maxSize = 1024 * 1024; // 1MB
  if (data.length > maxSize) {
    return false;
  }
  
  // Basic Y.js update structure validation
  // Y.js updates have a specific binary format structure
  // A valid update should have at least a minimal header (typically 4+ bytes)
  if (data.length < 4) {
    return false;
  }
  
  // For now, accept any Uint8Array that meets basic criteria
  // More sophisticated Y.js format validation could be added here
  // This implementation focuses on transport-level validation
  return true;
}
