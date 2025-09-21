// Critical-Engineer: consulted for Authentication strategy and React integration pattern
// Singleton Supabase client - created once, shared across application

import { createClient } from '@supabase/supabase-js';

// Environment configuration with hard failure on missing vars
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or legacy VITE_SUPABASE_ANON_KEY) required'
  );
}

// Create singleton client - this runs once when module is imported
export const supabase = createClient(supabaseUrl, supabaseKey, {
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