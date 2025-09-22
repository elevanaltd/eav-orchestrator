// Context7: consulted for vitest/config
// MEMORY LEAK FIX: Comprehensive Vitest configuration to prevent process accumulation
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // CRITICAL: Process isolation and cleanup settings
    pool: 'forks',           // Use 'forks' instead of 'threads' for better process isolation
    poolOptions: {
      forks: {
        singleFork: true,     // IMPORTANT: Run all tests in a single fork to prevent accumulation
        isolate: true,        // Isolate test files for better memory management
      }
    },

    // MEMORY FIX: Disable file-level parallelization to prevent process spawning
    fileParallelism: false,   // Run test files sequentially

    // Test environment configuration
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],

    // Timeout settings
    testTimeout: 15000,
    hookTimeout: 15000,

    // MEMORY FIX: Force cleanup after each test file
    teardownTimeout: 1000,    // Give 1 second for teardown

    // Reporter configuration - reduce memory usage
    reporters: process.env.CI ? ['dot', 'json'] : ['default'],

    // MEMORY FIX: Disable watch mode features that can leak
    watch: false,             // Disable watch mode in config

    // Environment variables for tests
    env: {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key-for-integration-tests',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key-for-integration-tests'
    },

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.feature.test.{ts,tsx}'
      ],
      // MEMORY FIX: Disable instrumentation caching that can leak
      clean: true,
      all: false,             // Don't include all files by default
      skipFull: true,         // Skip files with 100% coverage
    },

    // MEMORY FIX: Clear module cache between test runs
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,

    // MEMORY FIX: Limit concurrent operations
    maxConcurrency: 1,        // Run one test suite at a time
    // Note: minThreads and maxThreads are not valid options in Vitest

    // MEMORY FIX: Disable features that can cause leaks
    cache: false,             // Disable test result caching
    deps: {
      optimizer: {
        web: {
          enabled: false      // Disable dependency optimization for tests
        }
      },
      interopDefault: true
    },

    // MEMORY FIX: Add explicit cleanup hooks
    onConsoleLog: (log: string) => {
      // Filter out noisy logs that can accumulate in memory
      if (log.includes('Offline queue initialized') ||
          log.includes('CustomSupabaseProvider connected')) {
        return false;
      }
      return true;
    },
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});