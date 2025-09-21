// Context7: consulted for vitest/config
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Use dedicated integration test setup (no Y.js mocks)
      setupFiles: ['./tests/integration-setup.ts'],
      include: ['tests/integration/**/*.ts'],
      // Longer timeout for real network/CRDT operations
      testTimeout: 30000,
      hookTimeout: 30000,
      globals: true,
      environment: 'jsdom',
    },
  })
);