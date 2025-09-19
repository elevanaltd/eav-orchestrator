/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  // New Supabase key format (preferred)
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  // Legacy Supabase key format (deprecated, maintained for backward compatibility)
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_SUPABASE_SERVICE_KEY?: string
  // Add other environment variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}