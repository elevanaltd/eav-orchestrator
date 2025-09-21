// Context7: consulted for vitest/config
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Isolate integration tests from global setup mocks
      setupFiles: [],
      include: ['tests/integration/**/*.ts'],
      // Longer timeout for real network/CRDT operations
      testTimeout: 30000,
      hookTimeout: 30000,
    },
  })
);