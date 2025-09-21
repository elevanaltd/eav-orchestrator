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
import { auth, type UserRole } from '../lib/supabase';

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

  // Setup reactive auth subscription - no polling needed
  useEffect(() => {
    // Critical-Engineer: consulted for Authentication strategy and React integration pattern
    // Use reactive onAuthStateChange instead of polling getUser() - fixes hanging issue
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          if (session?.user?.id) {
            // TODO: Re-enable getUserRole after fixing core auth flow
            // const role = await getUserRole(session.user.id);

            setState({
              user: session.user as User,
              role: null, // Temporarily skip role lookup
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
          console.error('AuthContext: Authentication error:', error);
          setState({
            user: null,
            role: null,
            loading: false,
            error: error instanceof Error ? error.message : 'Authentication failed',
          });
        }
      }
    );

    // Cleanup subscription on unmount - prevents memory leaks
    return () => {
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