// TestGuard-approved integration test configuration
// CONTRACT-DRIVEN-CORRECTION: Real Y.js instances for absolute contract fidelity
// Per constitutional mandate: truth over convenience

// Context7: consulted for vite
// Context7: consulted for @vitejs/plugin-react
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],

    // INTEGRATION TESTS ONLY: Real Y.js instances for contract validation
    include: [
      'tests/integration/**/*.test.ts',
      'tests/integration/**/*.test.tsx'
    ],

    // Exclude unit tests - they use lightweight mocks
    exclude: [
      'node_modules/**',
      'worktrees/**',
      '**/node_modules/**',
      '**/.git/**',
      'tests/unit/**', // Unit tests run separately with mocks
      'tests/**/*.feature.test.*' // Feature tests run separately
    ],

    // Extended timeouts for real Y.js operations
    testTimeout: 15000, // 15s for integration complexity
    hookTimeout: 15000,

    // Integration test environment
    env: {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-integration-key',
      VITE_SUPABASE_ANON_KEY: 'test-integration-anon-key',
      NODE_ENV: 'integration'
    },

    // Single thread for Y.js state consistency
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // Critical for Y.js state isolation
        maxThreads: 1,
        minThreads: 1
      }
    },

    // Integration-specific coverage (optional)
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/lib/collaboration/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.mock.ts'
      ]
    }
  }
})