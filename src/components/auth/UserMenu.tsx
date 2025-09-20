/**
 * User Menu Component
 *
 * TRACED Protocol: RED-GREEN-REFACTOR - User interface component
 * Constitutional: Essential complexity only - user profile and logout
 *
 * Displays current user info and provides logout functionality
 * Integrates with AuthContext for user state and actions
 */

import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

export const UserMenu: React.FC = () => {
  const { user, role, signOut, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) {
    return null;
  }

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  // Get display name - prefer user metadata, fallback to email
  const displayName = user.user_metadata?.name || user.email?.split('@')[0] || 'User';
  const email = user.email || 'Unknown email';

  // Role display with fallback
  const roleDisplay = role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Unknown';

  return (
    <div className="relative inline-block text-left">
      <div>
        <button
          type="button"
          className="inline-flex items-center justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          onClick={() => setIsOpen(!isOpen)}
          disabled={loading}
        >
          <div className="flex items-center space-x-2">
            {/* User avatar placeholder */}
            <div className="h-6 w-6 rounded-full bg-indigo-600 flex items-center justify-center">
              <span className="text-xs font-medium text-white">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <span>{displayName}</span>
            <svg
              className={`-mr-1 ml-2 h-5 w-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </button>
      </div>

      {isOpen && (
        <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 divide-y divide-gray-100 focus:outline-none">
          <div className="px-4 py-3">
            <p className="text-sm">Signed in as</p>
            <p className="text-sm font-medium text-gray-900 truncate">{email}</p>
            <p className="text-xs text-gray-500 mt-1">Role: {roleDisplay}</p>
          </div>

          <div className="py-1">
            <button
              onClick={handleSignOut}
              disabled={loading}
              className="group flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 w-full text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z"
                  clipRule="evenodd"
                />
              </svg>
              {loading ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};