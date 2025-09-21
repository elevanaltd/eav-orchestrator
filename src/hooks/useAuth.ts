/**
 * useAuth Hook
 *
 * Separate hook file to satisfy react-refresh/only-export-components rule
 * Provides authentication state and methods from AuthContext
 */

import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import type { AuthContextValue } from '../contexts/AuthContext';

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};