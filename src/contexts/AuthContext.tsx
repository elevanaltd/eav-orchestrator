/**
 * Authentication Context Provider
 *
 * TRACED Protocol: RED-GREEN-REFACTOR - Auth foundation implementation
 * Constitutional: Essential complexity only - thin layer over Supabase auth
 *
 * Integrates with existing supabase.ts infrastructure:
 * - Uses auth.getUser(), auth.signIn(), auth.signOut() methods
 * - Maintains fail-closed error handling from supabase.ts
 * - Respects 5-role system (admin, internal, freelancer, client, viewer)
 * - Integrates with Y.js AuthenticatedProviderFactory pattern
 */

import React, { createContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
// Critical-Engineer: consulted for Authentication strategy and React integration pattern
import { supabase } from '../lib/supabaseClient'; // Use singleton client
import { auth, getUserRole, type UserRole } from '../lib/supabase';

interface AuthState {
  user: User | null;
  role: UserRole | null;
  loading: boolean;
  error: string | null;
}

export interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, metadata?: { name: string; role: string }) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  console.log('🔐 AuthProvider: Component mounting...');

  const [state, setState] = useState<AuthState>({
    user: null,
    role: null,
    loading: true,
    error: null,
  });

  console.log('🔐 AuthProvider: Initial state set, loading =', state.loading);

  // Setup reactive auth subscription - no polling needed
  useEffect(() => {
    console.log('🔐 AuthProvider: useEffect running - setting up auth subscription...');

    let mounted = true; // Track if component is still mounted

    // Handle auth state updates
    const handleAuthChange = async (session: any) => {
      if (!mounted) return; // Prevent updates after unmount

      try {
        if (session?.user?.id) {
          console.log('🔐 AuthProvider: Session exists, fetching user role...');

          // Add timeout to getUserRole to prevent hanging
          const rolePromise = getUserRole(session.user.id);
          const timeoutPromise = new Promise<null>((resolve) => {
            setTimeout(() => {
              console.warn('🔐 AuthProvider: getUserRole timed out, proceeding without role');
              resolve(null);
            }, 2000);
          });

          const role = await Promise.race([rolePromise, timeoutPromise]);
          console.log('🔐 AuthProvider: User role fetched:', role);

          if (mounted) {
            setState({
              user: session.user as User,
              role,
              loading: false,
              error: null,
            });
            console.log('🔐 AuthProvider: State updated with authenticated user');
          }
        } else {
          console.log('🔐 AuthProvider: No session - setting unauthenticated state');
          if (mounted) {
            setState({
              user: null,
              role: null,
              loading: false,
              error: null,
            });
          }
        }
      } catch (error) {
        console.error('AuthContext: Authentication error:', error);
        if (mounted) {
          setState({
            user: null,
            role: null,
            loading: false,
            error: error instanceof Error ? error.message : 'Authentication failed',
          });
        }
      }
    };

    // Skip initial session check - let onAuthStateChange handle it
    // This prevents the hanging issue with getSession()
    console.log('🔐 AuthProvider: Skipping initial session check, waiting for auth state change...');

    // Set to not loading after a delay ONLY if we haven't received auth state
    let authStateReceived = false;

    const fallbackTimer = setTimeout(() => {
      if (mounted && state.loading && !authStateReceived) {
        console.log('🔐 AuthProvider: No auth state received, setting to unauthenticated');
        setState({
          user: null,
          role: null,
          loading: false,
          error: null,
        });
      }
    }, 1000); // Give onAuthStateChange a second to fire

    // Critical-Engineer: consulted for Authentication strategy and React integration pattern
    // Use reactive onAuthStateChange for subsequent changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        console.log('🔐 AuthProvider: Auth state change callback fired!', _event, session ? 'session exists' : 'no session');
        authStateReceived = true; // Mark that we've received auth state
        await handleAuthChange(session);
      }
    );

    console.log('🔐 AuthProvider: Auth subscription established, subscription:', subscription);

    // Cleanup subscription on unmount - prevents memory leaks
    return () => {
      console.log('🔐 AuthProvider: Cleaning up auth subscription');
      mounted = false;
      clearTimeout(fallbackTimer); // Clear the fallback timer
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array - subscription runs once

  const signIn = async (email: string, password: string): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      await auth.signIn(email, password);
      // Auth state will be updated via onAuthStateChange listener
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Sign in failed',
      }));
      throw error;
    }
  };

  const signUp = async (email: string, password: string, metadata?: { name: string; role: string }): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      await auth.signUp(email, password, metadata);
      // Auth state will be updated via onAuthStateChange listener
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Sign up failed',
      }));
      throw error;
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      await auth.signOut();
      // Auth state will be updated via onAuthStateChange listener
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Sign out failed',
      }));
      throw error;
    }
  };

  const clearError = (): void => {
    setState(prev => ({ ...prev, error: null }));
  };

  const value: AuthContextValue = {
    ...state,
    signIn,
    signUp,
    signOut,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};