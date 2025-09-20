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
  const [state, setState] = useState<AuthState>({
    user: null,
    role: null,
    loading: true,
    error: null,
  });

  // Initialize auth state and setup listener
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Get initial session from Supabase
        const user = await auth.getUser();

        if (!mounted) return;

        if (user) {
          // Fetch user role with fail-closed error handling
          const role = await getUserRole(user.id);
          setState({
            user,
            role,
            loading: false,
            error: null,
          });
        } else {
          setState({
            user: null,
            role: null,
            loading: false,
            error: null,
          });
        }
      } catch (error) {
        if (!mounted) return;

        console.error('Auth initialization failed:', error);
        setState({
          user: null,
          role: null,
          loading: false,
          error: 'Authentication initialization failed',
        });
      }
    };

    // Setup auth state change listener
    const { data: { subscription } } = auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      if (session?.user?.id) {
        // User signed in - fetch role and convert to proper User type
        const role = await getUserRole(session.user.id);
        setState({
          user: session.user as User,
          role,
          loading: false,
          error: null,
        });
      } else {
        // User signed out
        setState({
          user: null,
          role: null,
          loading: false,
          error: null,
        });
      }
    });

    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

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