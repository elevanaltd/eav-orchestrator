// Context7: consulted for vitest/config
// MEMORY LEAK FIX: Integration test configuration with process isolation
import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  // Remove test config from vite.config to avoid duplication
  { ...viteConfig, test: undefined },
  defineConfig({
    test: {
      // CRITICAL: Process isolation for integration tests
      pool: 'forks',
      poolOptions: {
        forks: {
          singleFork: true,     // Run all integration tests in single fork
          isolate: true,
        }
      },

      // Disable parallelization for integration tests
      fileParallelism: false,
      maxConcurrency: 1,

      // Use dedicated integration test setup (no Y.js mocks)
      setupFiles: ['./tests/integration-setup.ts'],
      include: ['tests/integration/**/*.ts'],

      // Longer timeout for real network/CRDT operations
      testTimeout: 30000,
      hookTimeout: 30000,
      teardownTimeout: 2000,    // Give more time for integration test teardown

      globals: true,
      environment: 'jsdom',

      // Clear mocks between integration tests
      clearMocks: true,
      mockReset: true,
      restoreMocks: true,

      // Disable caching for integration tests
      cache: false,

      // Environment variables for integration tests
      env: {
        VITE_SUPABASE_URL: 'https://test.supabase.co',
        VITE_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key-for-integration-tests',
        VITE_SUPABASE_ANON_KEY: 'test-anon-key-for-integration-tests'
      },
    },
  })
);