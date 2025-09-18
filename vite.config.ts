// Context7: consulted for vite
// Context7: consulted for @vitejs/plugin-react
// Context7: consulted for @sentry/vite-plugin
// Critical-Engineer: consulted for Build system and quality assurance strategy
// TestGuard: Vitest coverage configuration added for quality enforcement
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig({
  plugins: [
    react(),
    // Sentry plugin for source maps and release management
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,

      // Upload source maps for better error debugging in production
      sourceMaps: {
        assets: ['./dist/**'],
        ignore: ['node_modules'],
        filesToDeleteAfterUpload: ['./dist/**/*.map']
      },

      // Only upload in production builds
      disable: process.env.NODE_ENV !== 'production',

      // Release configuration
      release: {
        name: process.env.VITE_APP_VERSION || '1.0.0',
        uploadLegacySourcemaps: false,
      }
    })
  ],
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  server: {
    port: 3000,
    open: true
  },
  build: {
    sourcemap: true, // Generate source maps for production debugging
    rollupOptions: {
      output: {
        // Prevent Sentry source maps from being served in production
        sourcemapExcludeSources: true
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', 'src/**/*.test.ts', 'src/**/*.test.tsx'], // Include all test files
    exclude: [
      'node_modules/**',
      'worktrees/**', // Exclude git worktrees
      '**/node_modules/**',
      '**/.git/**'
    ],
    env: {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key-for-integration-tests'
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/main.tsx', // Entry point
        'src/vite-env.d.ts'
      ],
      thresholds: {
        lines: 80,
        functions: 75,
        branches: 70,
        statements: 80
      }
    }
  }
})
