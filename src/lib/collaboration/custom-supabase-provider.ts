/**
 * CustomSupabaseProvider - Direct Supabase Integration for Y.js
 * 
 * Replaces y-supabase alpha package with production-ready implementation
 * Implementation-lead: consulted for CustomSupabaseProvider.ts integration
 * Critical-engineer: consulted for standard RLS policy integration
 * Test-methodology-guardian: consulted for TDD discipline enforcement
 * 
 * PRODUCTION REQUIREMENTS:
 * - <200ms connection establishment
 * - 10-20 concurrent user support
 * - Conflict-free collaborative editing via Y.js CRDT
 * - Standard RLS policies (not "optimized" patterns)
 */

import * as Y from 'yjs';
import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

export interface CustomSupabaseProviderConfig {
  supabaseClient: SupabaseClient;
  ydoc: Y.Doc;
  documentId: string;
  tableName?: string;
}

export interface YjsDocument {
  id: string;
  content: Uint8Array;
  state_vector: Uint8Array;
  updated_at: string;
}

export class CustomSupabaseProvider {
  private supabaseClient: SupabaseClient;
  private ydoc: Y.Doc;
  private documentId: string;
  private tableName: string;
  private channel?: RealtimeChannel;
  private isConnected: boolean = false;

  constructor(config: CustomSupabaseProviderConfig) {
    this.supabaseClient = config.supabaseClient;
    this.ydoc = config.ydoc;
    this.documentId = config.documentId;
    this.tableName = config.tableName || 'yjs_documents';
  }

  async connect(): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Load initial document state
      await this.loadInitialState();
      
      // Set up real-time subscription
      await this.setupRealtimeSubscription();
      
      // Set up Y.js update handler
      this.setupYjsUpdateHandler();
      
      this.isConnected = true;
      
      const connectionTime = performance.now() - startTime;
      console.log(`CustomSupabaseProvider connected in ${connectionTime.toFixed(2)}ms`);
      
    } catch (error) {
      console.error('CustomSupabaseProvider connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.channel) {
      await this.supabaseClient.removeChannel(this.channel);
    }
    this.isConnected = false;
  }

  private async loadInitialState(): Promise<void> {
    const { data, error } = await this.supabaseClient
      .from(this.tableName)
      .select('content, state_vector')
      .eq('id', this.documentId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      throw new Error(`Failed to load document: ${error.message}`);
    }

    if (data && data.content) {
      // Apply stored document state to Y.js document
      Y.applyUpdate(this.ydoc, new Uint8Array(data.content));
    }
  }

  private async setupRealtimeSubscription(): Promise<void> {
    this.channel = this.supabaseClient
      .channel(`yjs_document_${this.documentId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: this.tableName,
        filter: `id=eq.${this.documentId}`
      }, (payload) => {
        this.handleRemoteUpdate(payload);
      })
      .on('postgres_changes', {
        event: 'INSERT', 
        schema: 'public',
        table: this.tableName,
        filter: `id=eq.${this.documentId}`
      }, (payload) => {
        this.handleRemoteUpdate(payload);
      });

    await this.channel.subscribe();
    
    // Note: Channel subscription is asynchronous, check connection state if needed
    // The subscribe() method returns void, not a status string
  }

  private setupYjsUpdateHandler(): void {
    this.ydoc.on('update', () => {
      // Send local updates to Supabase
      this.persistUpdate();
    });
  }

  private async persistUpdate(): Promise<void> {
    try {
      const stateVector = Y.encodeStateVector(this.ydoc);
      const documentState = Y.encodeStateAsUpdate(this.ydoc);

      const { error } = await this.supabaseClient
        .from(this.tableName)
        .upsert({
          id: this.documentId,
          content: Array.from(documentState),
          state_vector: Array.from(stateVector),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Failed to persist Y.js update:', error);
      }
    } catch (error) {
      console.error('Error persisting update:', error);
    }
  }

  private handleRemoteUpdate(payload: { new?: { content?: number[] } }): void {
    if (payload.new && payload.new.content) {
      try {
        const remoteUpdate = new Uint8Array(payload.new.content);
        // Apply remote update to local Y.js document
        Y.applyUpdate(this.ydoc, remoteUpdate);
      } catch (error) {
        console.error('Error applying remote update:', error);
      }
    }
  }

  get connected(): boolean {
    return this.isConnected;
  }

  get documentState(): Uint8Array {
    return Y.encodeStateAsUpdate(this.ydoc);
  }

  async destroy(): Promise<void> {
    await this.disconnect();
  }
}