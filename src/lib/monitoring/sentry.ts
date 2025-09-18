/**
 * SENTRY ERROR MONITORING INITIALIZATION
 *
 * Configures Sentry SDK for production error monitoring and performance tracking.
 * Based on Context7 consultation for @sentry/react integration patterns.
 */

import * as Sentry from '@sentry/react';

// Context7: consulted for @sentry/react

interface SentryUser {
  id: string;
  email?: string;
  username?: string;
}

/**
 * Initialize Sentry with production-ready configuration
 *
 * Features:
 * - Error boundary integration
 * - Performance monitoring
 * - User context tracking
 * - Environment-specific configuration
 * - Source map support for production debugging
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.VITE_SENTRY_ENVIRONMENT || 'development';
  const tracesSampleRate = parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || '0.1');

  // Skip initialization if DSN is not configured
  if (!dsn) {
    console.info('Sentry DSN not configured. Skipping Sentry initialization.');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment,
      tracesSampleRate,

      // Configure distributed tracing targets
      tracePropagationTargets: [
        'localhost',
        /^https:\/\/[^/]*\.supabase\.co/,
        /^https:\/\/[^/]*\.vercel\.app/,
        /^https:\/\/[^/]*\.netlify\.app/,
        // Add your production domains here
      ],

      integrations: [
        Sentry.browserTracingIntegration(),
        // Enable session replay for debugging (sample rate controlled by environment)
        ...(environment === 'production' ? [] : [
          Sentry.replayIntegration({
            maskAllText: false,
            blockAllMedia: false,
          })
        ]),
      ],

      // Session Replay (only in development)
      replaysSessionSampleRate: environment === 'production' ? 0 : 0.1,
      replaysOnErrorSampleRate: environment === 'production' ? 0 : 1.0,

      // Release tracking
      release: import.meta.env.VITE_APP_VERSION || '1.0.0',

      // Enhanced error context
      beforeSend(event, hint) {
        // Filter out development-only errors
        if (environment === 'development') {
          // Skip React DevTools errors
          if (event.exception?.values?.[0]?.value?.includes('ResizeObserver loop limit exceeded')) {
            return null;
          }
        }

        // Add custom context for debugging
        if (hint.originalException) {
          event.tags = {
            ...event.tags,
            errorBoundary: hint.originalException instanceof Error ? 'true' : 'false',
          };
        }

        return event;
      },

      // Performance monitoring configuration
      profilesSampleRate: environment === 'production' ? 0.1 : 1.0,
    });

    console.info(`Sentry initialized for ${environment} environment`);
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
  }
}

/**
 * Set user context for error tracking
 * Call this after user authentication to associate errors with users
 */
export function setSentryUserContext(user: SentryUser): void {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  });
}

/**
 * Clear user context (e.g., on logout)
 */
export function clearSentryUserContext(): void {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging context
 */
export function addSentryBreadcrumb(message: string, category?: string, level?: 'info' | 'warning' | 'error'): void {
  Sentry.addBreadcrumb({
    message,
    category: category || 'app',
    level: level || 'info',
    timestamp: Date.now() / 1000,
  });
}

/**
 * Manually capture an exception
 */
export function captureSentryException(error: Error, context?: Record<string, unknown>): void {
  Sentry.withScope((scope) => {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        scope.setContext(key, value as Record<string, unknown> | null);
      });
    }
    Sentry.captureException(error);
  });
}
