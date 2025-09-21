// Context7: consulted for vite
// Context7: consulted for @vitejs/plugin-react
// Context7: consulted for @sentry/vite-plugin
// Critical-Engineer: consulted for Build system and quality assurance strategy
// TestGuard: Vitest coverage configuration added for quality enforcement
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from '@sentry/vite-plugin'

// Custom plugin to serve /api/version endpoint
const apiVersionPlugin = () => ({
  name: 'api-version',
  configureServer(server: { middlewares: { use: (path: string, handler: (req: unknown, res: { setHeader: (name: string, value: string) => void; end: (data: string) => void }) => void) => void } }) {
    server.middlewares.use('/api/version', (_req: unknown, res: { setHeader: (name: string, value: string) => void; end: (data: string) => void }) => {
      const versionData = {
        version: '1.0.0',
        schemaVersion: 1,
        timestamp: new Date().toISOString(),
        build: 'B2-Build'
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.end(JSON.stringify(versionData, null, 2));
    });
  }
});

export default defineConfig({
  plugins: [
    react(),
    apiVersionPlugin(),
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
    // The 'include' property is now managed by the npm scripts, not here.
    // This allows for flexible test execution from the command line.
    testTimeout: 15000, // Increased timeout for integration tests
    hookTimeout: 15000,
    env: {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key-for-integration-tests',
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