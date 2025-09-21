// Separate Vitest configuration for TDD RED state feature tests
// These tests should fail until implementation (constitutional TDD requirement)
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
    // ONLY include feature test files
    include: ['tests/**/*.feature.test.*'],
    // Exclude problematic infrastructure tests that cause hangs
    exclude: [
      'node_modules/**',
      'worktrees/**',
      '**/node_modules/**',
      '**/.git/**',
      // Infrastructure tests that cause worker communication issues
      '**/ScriptComponentManagement.controlled.test.tsx',
      '**/ScriptComponentManagement.test.tsx',
      '**/ScriptEditor.test.tsx',
      '**/YjsSupabaseProvider.test.ts',
      '**/custom-supabase-provider.test.ts',
      '**/custom-supabase-provider-awareness.test.ts',
      '**/persistence.test.ts',
      '**/circuitBreaker.test.ts'
    ],
    testTimeout: 10000,
    hookTimeout: 10000,
    env: {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key-for-integration-tests',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key-for-integration-tests'
    },
    // Use single thread to prevent worker communication issues
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true
      }
    }
  }
})