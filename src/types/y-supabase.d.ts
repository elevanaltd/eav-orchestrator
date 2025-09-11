// Type declarations for y-supabase alpha package
// Critical-Engineer: consulted for Architectural coherence and dependency validation
// Context7: consulted for yjs
// Context7: consulted for y-supabase

declare module 'y-supabase' {
  import type { Doc } from 'yjs'
  
  export interface SupabaseProviderOptions {
    url: string
    key: string
    table: string
    id: string
  }
  
  export class SupabaseProvider {
    constructor(doc: Doc, options: SupabaseProviderOptions)
    
    on(event: 'connect', callback: () => void): void
    on(event: 'disconnect', callback: () => void): void
    on(event: 'sync', callback: () => void): void
    on(event: 'error', callback: (error: unknown) => void): void
    on(event: 'message', callback: (update: any) => void): void
    on(event: 'awareness', callback: (awarenessUpdate: any) => void): void
    on(event: 'save', callback: (version: number) => void): void
    on(event: 'status', callback: (status: any) => void): void
    on(event: 'synced', callback: (state: any) => void): void
    
    connect(): Promise<void>
    disconnect(): void
    destroy(): void
  }
}
