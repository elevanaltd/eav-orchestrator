/**
 * AuthenticatedProviderFactory - Authentication-aware Y.js Provider Factory
 *
 * Technical-architect: consulted for minimal intervention authentication pattern
 * Implementation-lead: green phase execution for authenticated provider integration
 *
 * PURPOSE:
 * - Initialize CustomSupabaseProvider with authentication context
 * - Anonymous fallback for unauthenticated users
 * - Fail-closed security with server-side RLS enforcement
 * - Circuit breaker resilience preserved
 */

// Context7: consulted for yjs
// Context7: consulted for @supabase/supabase-js
import * as Y from 'yjs';
import { createClient } from '@supabase/supabase-js';
import { CustomSupabaseProvider, CustomSupabaseProviderConfig } from './custom-supabase-provider';
import { getUser } from '../supabase';

export interface AuthenticatedProviderFactoryConfig {
  projectId: string;
  documentId: string;
  ydoc: Y.Doc;
  onSync?: () => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: string | { circuitBreakerState: string }) => void;
}

export class AuthenticatedProviderFactory {
  /**
   * Create authenticated CustomSupabaseProvider with user context
   *
   * SECURITY PATTERN:
   * - Attempts authentication with getUser()
   * - Falls back to anonymous mode on auth failure
   * - Server-side RLS policies remain authoritative
   * - No VIEWER role assumption - fail-closed approach
   */
  static async create(config: AuthenticatedProviderFactoryConfig): Promise<CustomSupabaseProvider> {
    try {
      // Attempt to get authenticated user
      const user = await getUser().catch(() => null);

      // Create Supabase client with environment configuration
      const supabaseClient = createClient(
        import.meta.env.VITE_SUPABASE_URL!,
        import.meta.env.VITE_SUPABASE_ANON_KEY!
      );

      // Build provider configuration with authentication context
      const providerConfig: CustomSupabaseProviderConfig = {
        supabaseClient,
        ydoc: config.ydoc,
        documentId: config.documentId,
        projectId: config.projectId,
        tableName: 'yjs_documents',
        onSync: config.onSync,
        onError: config.onError,
        onStatusChange: config.onStatusChange
      };

      // Create provider instance
      const provider = new CustomSupabaseProvider(providerConfig);

      // Attach authentication metadata for debugging/logging
      // Using type assertion to attach metadata to provider instance
      const providerWithAuth = provider as CustomSupabaseProvider & {
        _authContext: {
          userId: string;
          isAuthenticated: boolean;
          email: string | null;
        };
      };

      providerWithAuth._authContext = {
        userId: user?.id || 'anonymous',
        isAuthenticated: !!user,
        email: user?.email || null
      };

      return provider;

    } catch (error) {
      console.error('AuthenticatedProviderFactory: Failed to create provider:', error);
      throw new Error(`Failed to create authenticated provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get authentication context from provider instance
   * Used for debugging and testing
   */
  static getAuthContext(provider: CustomSupabaseProvider): {
    userId: string;
    isAuthenticated: boolean;
    email: string | null;
  } | null {
    const providerWithAuth = provider as CustomSupabaseProvider & {
      _authContext?: {
        userId: string;
        isAuthenticated: boolean;
        email: string | null;
      };
    };
    return providerWithAuth._authContext || null;
  }
}