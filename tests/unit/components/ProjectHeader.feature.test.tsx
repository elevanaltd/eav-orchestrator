// Context7: consulted for vitest
// Context7: consulted for @testing-library/react
// TESTGUARD-APPROVED: TESTGUARD-20250920-ff3d3ef3
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../../src/App';

// Mock the useAuth hook to bypass authentication loading state
vi.mock('../../../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    role: 'admin',
    loading: false, // Set loading to false to bypass the loading screen
    error: null,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    clearError: vi.fn()
  })
}));

// Mock Supabase to prevent database calls
// TESTGUARD-APPROVED: TESTGUARD-20250920-4a14eee0
vi.mock('../../../src/lib/supabase', () => ({
  getSupabase: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        data: [],
        error: null
      }))
    }))
  })),
  auth: {
    getUser: vi.fn(),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } }
    }))
  },
  getUserRole: vi.fn(() => 'admin')
}));

// Mock the script component manager
vi.mock('../../../src/lib/database/scriptComponentManager', () => ({
  ScriptComponentManager: vi.fn().mockImplementation(() => ({
    getAllScripts: vi.fn(() => Promise.resolve({
      scripts: [],
      error: null
    }))
  }))
}));

describe('Project Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays project code and title correctly', () => {
    render(<App />);

    // Check if project code is displayed
    expect(screen.getByText('EAV023')).toBeInTheDocument();

    // Check if project title is displayed
    expect(screen.getByText('Berkeley Homes')).toBeInTheDocument();
  });

  it('displays client information when available', () => {
    render(<App />);

    // Check if client name is displayed
    expect(screen.getByText('Client: Berkeley Construction')).toBeInTheDocument();
  });

  it('displays project phase badge when available', () => {
    render(<App />);

    // Check if project phase is displayed
    expect(screen.getByText('Production')).toBeInTheDocument();
  });

  it('displays script editor version info', () => {
    render(<App />);

    // Check if version info is displayed
    expect(screen.getByText('Script Editor v2.1')).toBeInTheDocument();
    expect(screen.getByText('Real-time Collaboration')).toBeInTheDocument();
  });
});