/**
 * Tests for Y.js Awareness integration in CustomSupabaseProvider
 * Verifies that awareness is properly initialized for CollaborationCursor support
 */

// Context7: consulted for vitest
import { describe, it, expect, beforeEach, vi } from 'vitest';
// Context7: consulted for yjs
import * as Y from 'yjs';
import { CustomSupabaseProvider } from '../../../src/lib/collaboration/custom-supabase-provider';
// Context7: consulted for @supabase/supabase-js
import type { SupabaseClient } from '@supabase/supabase-js';

describe('CustomSupabaseProvider - Awareness Integration', () => {
  let ydoc: Y.Doc;
  let mockSupabaseClient: Partial<SupabaseClient>;

  beforeEach(() => {
    ydoc = new Y.Doc();

    // Create a mock Supabase client with required methods
    mockSupabaseClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: null,
              error: { code: 'PGRST116', message: 'No rows found' }
            }))
          }))
        }))
      })) as any,
      // TESTGUARD-APPROVED: TEST-METHODOLOGY-GUARDIAN-20250917-63c03b2b - Fixing mock to match API structure
      rpc: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      })) as any,
      channel: vi.fn(() => ({
        on: vi.fn(() => ({
          subscribe: vi.fn(() => Promise.resolve())
        }))
      })) as any,
      removeChannel: vi.fn(() => Promise.resolve()) as any
    };
  });

  it('should initialize awareness on provider creation', () => {
    const provider = new CustomSupabaseProvider({
      supabaseClient: mockSupabaseClient as SupabaseClient,
      ydoc,
      documentId: 'test-doc-123',
      projectId: 'test-project-456'
    });

    // Verify awareness is initialized
    expect(provider.awareness).toBeDefined();
    expect(provider.awareness).not.toBeNull();
  });

  it('should share the same Y.Doc with awareness', () => {
    const provider = new CustomSupabaseProvider({
      supabaseClient: mockSupabaseClient as SupabaseClient,
      ydoc,
      documentId: 'test-doc-123',
      projectId: 'test-project-456'
    });

    // Verify awareness uses the same Y.Doc
    expect(provider.awareness.doc).toBe(ydoc);
  });

  it('should have a valid client ID in awareness', () => {
    const provider = new CustomSupabaseProvider({
      supabaseClient: mockSupabaseClient as SupabaseClient,
      ydoc,
      documentId: 'test-doc-123',
      projectId: 'test-project-456'
    });

    // Verify awareness has a client ID
    expect(provider.awareness.clientID).toBeDefined();
    expect(typeof provider.awareness.clientID).toBe('number');
    expect(provider.awareness.clientID).toBeGreaterThan(0);
  });

  it('should allow setting and getting local state in awareness', () => {
    const provider = new CustomSupabaseProvider({
      supabaseClient: mockSupabaseClient as SupabaseClient,
      ydoc,
      documentId: 'test-doc-123',
      projectId: 'test-project-456'
    });

    // Set local state (user cursor info)
    const userState = {
      user: {
        name: 'Test User',
        color: '#007acc'
      },
      cursor: {
        anchor: 0,
        head: 10
      }
    };

    provider.awareness.setLocalState(userState);

    // Get local state
    const localState = provider.awareness.getLocalState();

    expect(localState).toEqual(userState);
    expect(localState?.user).toEqual(userState.user);
    expect(localState?.cursor).toEqual(userState.cursor);
  });

  it('should clean up awareness on disconnect', async () => {
    const provider = new CustomSupabaseProvider({
      supabaseClient: mockSupabaseClient as SupabaseClient,
      ydoc,
      documentId: 'test-doc-123',
      projectId: 'test-project-456'
    });

    // Spy on awareness destroy method
    const destroySpy = vi.spyOn(provider.awareness, 'destroy');

    // Disconnect provider
    await provider.disconnect();

    // Verify awareness was cleaned up
    expect(destroySpy).toHaveBeenCalledTimes(1);
  });

  it('should support awareness event listeners', () => {
    const provider = new CustomSupabaseProvider({
      supabaseClient: mockSupabaseClient as SupabaseClient,
      ydoc,
      documentId: 'test-doc-123',
      projectId: 'test-project-456'
    });

    const updateHandler = vi.fn();

    // Add event listener
    provider.awareness.on('update', updateHandler);

    // Trigger an update by changing local state
    provider.awareness.setLocalState({ test: 'value' });

    // Verify handler was called
    expect(updateHandler).toHaveBeenCalled();

    // Clean up
    provider.awareness.off('update', updateHandler);
  });

  it('should expose awareness for TipTap CollaborationCursor', () => {
    const provider = new CustomSupabaseProvider({
      supabaseClient: mockSupabaseClient as SupabaseClient,
      ydoc,
      documentId: 'test-doc-123',
      projectId: 'test-project-456'
    });

    // Verify awareness is public and accessible
    expect(provider.awareness).toBeDefined();

    // Verify it has the methods CollaborationCursor needs
    expect(typeof provider.awareness.setLocalStateField).toBe('function');
    expect(typeof provider.awareness.getLocalState).toBe('function');
    expect(typeof provider.awareness.getStates).toBe('function');
  });

  it('should maintain awareness states map', () => {
    const provider = new CustomSupabaseProvider({
      supabaseClient: mockSupabaseClient as SupabaseClient,
      ydoc,
      documentId: 'test-doc-123',
      projectId: 'test-project-456'
    });

    // Set local state
    provider.awareness.setLocalState({ user: 'local-user' });

    // Get all states (includes local)
    const states = provider.awareness.getStates();

    // Verify states map exists and contains local client
    expect(states).toBeDefined();
    expect(states instanceof Map).toBe(true);
    expect(states.size).toBeGreaterThan(0);
    expect(states.has(provider.awareness.clientID)).toBe(true);
  });
});