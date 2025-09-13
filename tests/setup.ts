// Context7: consulted for vitest
// Context7: consulted for @testing-library/react
// Context7: consulted for @testing-library/jest-dom
// Error-Architect: IndexedDB polyfill for Node.js test environment
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';

// CONSTITUTIONAL FIX: IndexedDB Test Environment Support
// The y-indexeddb package requires IndexedDB API which is not available
// in Node.js test environment. fake-indexeddb provides a complete
// implementation for testing without modifying production code.
// This preserves architectural integrity while enabling test validation.

afterEach(() => {
  cleanup();
});
