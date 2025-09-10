// Mock implementation of fractional-indexing for Jest tests
// Implements basic LexoRank-like behavior for testing

let counter = 0;
const usedPositions = new Set();

// Convert counter to alphanumeric suffix
function getAlphanumericSuffix(num) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
  let result = '';
  let n = num;
  do {
    result = chars[n % chars.length] + result;
    n = Math.floor(n / chars.length);
  } while (n > 0);
  return result;
}

function generateKeyBetween(a, b) {
  let result = generateKeyBetweenInternal(a, b);
  let attempts = 0;
  
  // Ensure uniqueness
  while (usedPositions.has(result) && attempts < 50) {
    result = generateKeyBetweenInternal(a, b) + getAlphanumericSuffix(attempts);
    attempts++;
  }
  
  usedPositions.add(result);
  return result;
}

function generateKeyBetweenInternal(a, b) {
  if (a === null && b === null) {
    return 'a0';
  }
  
  if (a === null) {
    // Generate before b 
    if (b === 'a0') {
      return '9z'; // Use alphanumeric characters only
    }
    // Get character before b's first character
    const bCode = b.charCodeAt(0);
    if (bCode > 48) { // > '0'
      return String.fromCharCode(bCode - 1) + '0';
    } else {
      return '0' + getAlphanumericSuffix(counter++);
    }
  }
  
  if (b === null) {
    // Generate after a - extend with a character that leaves room for insertion  
    // Instead of 'a0' -> 'a00', do 'a0' -> 'b0' to leave room for 'aZ' etc.
    const lastChar = a[a.length - 1];
    const lastCharCode = lastChar.charCodeAt(0);
    
    // If we can increment the last character, do so
    if (lastCharCode < 122) { // < 'z'
      return a.slice(0, -1) + String.fromCharCode(lastCharCode + 1) + '0';
    } else {
      // If last char is 'z', extend with suffix  
      return a + getAlphanumericSuffix(counter++);
    }
  }
  
  // Generate between a and b
  if (a >= b) {
    // Invalid case - just extend a
    return a + getAlphanumericSuffix(counter++);
  }
  
  // For simple case where we can fit a character between
  if (a.length === 2 && b.length === 2 && a[0] === b[0]) {
    const aSecond = a.charCodeAt(1);
    const bSecond = b.charCodeAt(1);
    if (bSecond - aSecond > 1) {
      const midChar = Math.floor((aSecond + bSecond) / 2);
      return a[0] + String.fromCharCode(midChar);
    }
  }
  
  // Find lexicographic middle between a and b
  // Handle case where first characters are different
  if (a[0] !== b[0]) {
    const aCode = a.charCodeAt(0);
    const bCode = b.charCodeAt(0);
    const midCode = Math.floor((aCode + bCode) / 2);
    return String.fromCharCode(midCode) + '0';
  }
  
  // First characters are same, need to look deeper
  let i = 0;
  while (i < Math.min(a.length, b.length) && a[i] === b[i]) {
    i++;
  }
  
  if (i < a.length && i < b.length) {
    // Characters differ at position i
    const aCode = a.charCodeAt(i);
    const bCode = b.charCodeAt(i);
    if (bCode - aCode > 1) {
      const midCode = Math.floor((aCode + bCode) / 2);
      return a.substring(0, i) + String.fromCharCode(midCode) + '0';
    }
  }
  
  // Default fallback: add character between a and b lexicographically
  // Use 'z' (lowercase) instead of 'Z' to match alphanumeric validation
  return a + 'z';
}

function generateNKeysBetween(a, b, n) {
  if (n <= 0) return [];
  
  const keys = [];
  
  // Simple implementation: generate evenly spaced keys
  if (a === null && b === null) {
    // Generate sequence: a0, b0, c0, ...
    for (let i = 0; i < n; i++) {
      keys.push(String.fromCharCode(97 + i) + '0');
    }
    return keys;
  }
  
  // For simplicity in mock, just generate between with incremental suffixes
  let current = a;
  for (let i = 0; i < n; i++) {
    const next = generateKeyBetween(current, b);
    keys.push(next);
    current = next;
  }
  
  return keys;
}

module.exports = {
  generateKeyBetween,
  generateNKeysBetween
};
