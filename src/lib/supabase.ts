/**
 * Supabase Client Configuration and Authentication
 *
 * TRACED Protocol: GREEN PHASE - Implementation following test contract
 * SECURITY-SPECIALIST-APPROVED: SECURITY-SPECIALIST-20250913-86799f51
 * Critical-Engineer: consulted for Authentication and role-based security architecture
 * Critical-Engineer: consulted for Authentication strategy (JWT, session management)
 * Critical-Engineer: consulted for DB trigger and RLS security model
 * Critical-Engineer: consulted for RLS policy testing and implementation
 * Critical-Engineer: consulted for Environment configuration strategy
 *
 * SECURITY ARCHITECTURE:
 * - Server-side RLS policies are the single source of truth for authorization
 * - Client-side roles are UI rendering hints ONLY, never authoritative
 * - Fail-closed error handling: role fetch failure = unauthenticated state
 * - Database trigger ensures atomic user_profiles creation
 * - Comprehensive RLS policy test harness with pg_prove
 */

// Context7: consulted for @supabase/supabase-js
import { type SupabaseClient, createClient } from '@supabase/supabase-js';

// ERROR-ARCHITECT: Lazy singleton pattern for proper test isolation
// Module-level variables for singleton management
let supabaseClient: SupabaseClient | null = null;
let initError: Error | null = null;
let isInitialized = false;

/**
 * Get or create Supabase client singleton
 * Returns null if initialization fails (handled by App-level error boundary)
 * Circuit breaker integration maintained through CustomSupabaseProvider
 *
 * ERROR-ARCHITECT: Lazy initialization pattern for test isolation
 * Creates client on first access, allowing tests to mock createClient
 */
export const getSupabase = (): SupabaseClient | null => {
  // Return cached result if already initialized
  if (isInitialized) {
    return supabaseClient;
  }

  // Check if we have an initialization error
  if (initError) {
    return null;
  }

  // Environment configuration
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    initError = new Error(
      'Missing Supabase environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or legacy VITE_SUPABASE_ANON_KEY) required'
    );
    isInitialized = true;
    if (process.env.NODE_ENV !== 'test') {
      // Only log in production - tests handle null gracefully
      console.error('Supabase initialization failed:', initError.message);
    }
    return null;
  }

  try {
    // Create singleton client on first access
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'eav-orchestrator-auth', // Prevent session conflicts
      },
      realtime: {
        params: {
          eventsPerSecond: 10, // Match CustomSupabaseProvider configuration
        },
      },
    });
    isInitialized = true;
    return supabaseClient;
  } catch (error) {
    initError = error as Error;
    isInitialized = true;
    if (process.env.NODE_ENV !== 'test') {
      console.error('Supabase initialization failed:', error);
    }
    return null;
  }
};

// Export alias for compatibility
export const getSupabaseClient = getSupabase;

// Authentication functions following test contract with fail-closed error handling
export const auth = {
  async signIn(email: string, password: string) {
    const client = getSupabase();
    if (!client) {
      throw new Error('Supabase client not available - system configuration error');
    }

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    return data;
  },

  async signUp(email: string, password: string, metadata?: { name: string; role: string }) {
    const client = getSupabase();
    if (!client) {
      throw new Error('Supabase client not available - system configuration error');
    }

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });

    if (error) {
      throw error;
    }

    return data;
  },

  async signOut() {
    const client = getSupabase();
    if (!client) {
      throw new Error('Supabase client not available - system configuration error');
    }

    const { error } = await client.auth.signOut();

    if (error) {
      throw error;
    }
  },

  async getUser() {
    // Critical-Engineer: consulted for Authentication hanging issue and diagnostic strategy
    // NOTE: This method is legacy - use reactive onAuthStateChange in React components

    const client = getSupabase();
    if (!client) {
      throw new Error('Supabase client not available - system configuration error');
    }

    try {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();

      if (sessionError) {
        return null;
      }

      if (!sessionData.session) {
        return null;
      }

      return sessionData.session.user;
    } catch (error) {
      console.error('auth.getUser(): Session check failed:', error);
      throw error;
    }
  },

  async getSession() {
    const client = getSupabase();
    if (!client) {
      throw new Error('Supabase client not available - system configuration error');
    }

    const { data, error } = await client.auth.getSession();

    if (error) {
      throw error;
    }

    return data.session;
  },

  onAuthStateChange(callback: (event: string, session: { user: { id: string } } | null) => void) {
    const client = getSupabase();
    if (!client) {
      throw new Error('Supabase client not available - system configuration error');
    }

    return client.auth.onAuthStateChange(callback);
  },
};

// Role management system (5-role system from test contract)
// WARNING: These roles are for UI rendering ONLY - all authorization enforced via RLS
export const roles = {
  ADMIN: 'admin' as const,
  INTERNAL: 'internal' as const,
  FREELANCER: 'freelancer' as const,
  CLIENT: 'client' as const,
  VIEWER: 'viewer' as const,
} as const;

export type UserRole = typeof roles[keyof typeof roles];

/**
 * Get authenticated user
 *
 * Standalone function wrapper for auth.getUser() method
 * Used by AuthenticatedProviderFactory for provider initialization
 */
export async function getUser() {
  return auth.getUser();
}

/**
 * Get user role from database with FAIL-CLOSED error handling
 *
 * CRITICAL SECURITY NOTE:
 * - This function is for UI rendering hints ONLY
 * - All actual authorization is enforced server-side via RLS policies
 * - Role fetch failure results in unauthenticated state (fail-closed)
 * - Client-side roles are NEVER authoritative for security decisions
 *
 * @param userId - User ID to fetch role for
 * @returns Promise<UserRole | null> - null indicates authentication failure
 */
export const getUserRole = async (userId: string): Promise<UserRole | null> => {
  try {
    const client = getSupabase();
    if (!client) {
      // Fail-closed: client initialization failure = unauthenticated
      console.error('Critical: Cannot fetch user role - Supabase client not available');
      return null;
    }

    const { data, error } = await client
      .from('user_profiles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (error) {
      // Fail-closed: role fetch failure = unauthenticated
      // This protects against database errors, network failures, or missing profiles
      console.error('Critical: User role fetch failed - forcing unauthenticated state:', error);
      return null;
    }

    // Validate role is one of our known types
    const userRole = data?.role as UserRole;
    if (!userRole || !Object.values(roles).includes(userRole)) {
      // Fail-closed: invalid role = unauthenticated
      console.error('Critical: Invalid user role detected - forcing unauthenticated state:', userRole);
      return null;
    }

    return userRole;
  } catch (error) {
    // Fail-closed: any error in role fetching = unauthenticated
    console.error('Critical: Exception in getUserRole - forcing unauthenticated state:', error);
    return null;
  }
};

/**
 * Reset the Supabase singleton (primarily for testing)
 * WARNING: This should only be used in test environments
 *
 * ERROR-ARCHITECT: Properly resets singleton state for test isolation
 */
export const resetSupabaseClient = (): void => {
  if (process.env.NODE_ENV !== 'test') {
    console.warn('resetSupabaseClient() should only be called in test environment');
  }
  // Clear all singleton state for next test
  supabaseClient = null;
  initError = null;
  isInitialized = false;
};
