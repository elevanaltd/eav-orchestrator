// Context7: consulted for vite
// Context7: consulted for @vitejs/plugin-react  
// Critical-Engineer: consulted for Build system and quality assurance strategy
// TestGuard: Vitest coverage configuration added for quality enforcement
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  server: {
    port: 3000,
    open: true
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'], // Only include our test files
    exclude: [
      'node_modules/**',
      'worktrees/**', // Exclude git worktrees
      '**/node_modules/**',
      '**/.git/**'
    ],
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
