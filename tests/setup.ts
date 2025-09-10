// Context7: consulted for vitest
// Context7: consulted for @testing-library/react
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
