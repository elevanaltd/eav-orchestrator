/**
 * Memory Leak Test for ScriptEditor Auto-Save
 * 
 * Verifies that the auto-save timer is properly managed to prevent memory leaks
 * Tests that previous timers are cleared before setting new ones
 */

// Context7: consulted for vitest
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Context7: consulted for @testing-library/react
import { render, screen, waitFor } from '@testing-library/react';
// Context7: consulted for react
import React from 'react';
// Context7: consulted for yjs
import * as Y from 'yjs';

import { ScriptEditor } from '../../../src/components/editor/ScriptEditor';

describe('ScriptEditor Memory Leak Prevention', () => {
  let clearTimeoutSpy: any;
  let setTimeoutSpy: any;
  let originalSetTimeout: any;
  let originalClearTimeout: any;
  let timeoutIds: Set<NodeJS.Timeout>;

  beforeEach(() => {
    vi.clearAllMocks();
    timeoutIds = new Set();
    
    // Spy on setTimeout to track timer creation
    originalSetTimeout = global.setTimeout;
    setTimeoutSpy = vi.fn((callback, delay) => {
      const id = originalSetTimeout(callback, delay);
      timeoutIds.add(id);
      return id;
    });
    global.setTimeout = setTimeoutSpy as any;
    
    // Spy on clearTimeout to track timer cleanup
    originalClearTimeout = global.clearTimeout;
    clearTimeoutSpy = vi.fn((id) => {
      timeoutIds.delete(id);
      return originalClearTimeout(id);
    });
    global.clearTimeout = clearTimeoutSpy as any;
  });

  afterEach(() => {
    // Restore original functions
    global.setTimeout = originalSetTimeout;
    global.clearTimeout = originalClearTimeout;
    
    // Clear any remaining timers
    timeoutIds.forEach(id => clearTimeout(id));
  });

  it('should clear previous auto-save timer when content changes rapidly', async () => {
    const mockOnSave = vi.fn();
    const mockOnContentChange = vi.fn();
    
    const { rerender } = render(
      <ScriptEditor
        documentId="test-doc"
        projectId="test-project"
        config={{
          autoSave: true,
          autoSaveDelay: 1000
        }}
        onSave={mockOnSave}
        onContentChange={mockOnContentChange}
        testMode={true}
      />
    );

    // Wait for editor to be ready
    await waitFor(() => {
      expect(screen.getByTestId('script-editor')).toBeInTheDocument();
    });

    // Simulate rapid content changes
    const editorContent = screen.getByTestId('editor-content');
    
    // Trigger multiple content changes
    for (let i = 0; i < 5; i++) {
      // Simulate content change by updating the editor
      // In a real scenario, this would be typing
      editorContent.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Small delay between changes
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Verify that clearTimeout was called to prevent memory leak
    // Should have cleared timers for the first 4 changes
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(4);
    
    // Should only have one active timer at the end
    expect(timeoutIds.size).toBeLessThanOrEqual(1);
  });

  it('should clear auto-save timer on component unmount', async () => {
    const mockOnSave = vi.fn();
    
    const { unmount } = render(
      <ScriptEditor
        documentId="test-doc"
        projectId="test-project"
        config={{
          autoSave: true,
          autoSaveDelay: 1000
        }}
        onSave={mockOnSave}
        testMode={true}
      />
    );

    // Wait for editor to be ready
    await waitFor(() => {
      expect(screen.getByTestId('script-editor')).toBeInTheDocument();
    });

    // Trigger a content change to start auto-save timer
    const editorContent = screen.getByTestId('editor-content');
    editorContent.dispatchEvent(new Event('input', { bubbles: true }));

    // Track how many timers were created
    const timersBeforeUnmount = timeoutIds.size;

    // Unmount the component
    unmount();

    // Verify that timer was cleared on unmount
    if (timersBeforeUnmount > 0) {
      expect(clearTimeoutSpy).toHaveBeenCalled();
    }
    
    // No timers should remain after unmount
    expect(timeoutIds.size).toBe(0);
  });

  it('should not create multiple timers for the same auto-save delay', async () => {
    const mockOnSave = vi.fn();
    
    render(
      <ScriptEditor
        documentId="test-doc"
        projectId="test-project"
        config={{
          autoSave: true,
          autoSaveDelay: 500
        }}
        onSave={mockOnSave}
        testMode={true}
      />
    );

    // Wait for editor to be ready
    await waitFor(() => {
      expect(screen.getByTestId('script-editor')).toBeInTheDocument();
    });

    const editorContent = screen.getByTestId('editor-content');
    
    // Trigger rapid content changes
    for (let i = 0; i < 10; i++) {
      editorContent.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Wait a bit for any timers to be set
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should have created timers (one per change)
    expect(setTimeoutSpy).toHaveBeenCalled();
    
    // But should have cleared all but the last one
    // clearTimeout calls should be numberOfChanges - 1
    expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThanOrEqual(
      setTimeoutSpy.mock.calls.length - 1
    );
    
    // Only one timer should be active
    expect(timeoutIds.size).toBeLessThanOrEqual(1);
  });

  it('should not leak memory when auto-save is disabled', async () => {
    const mockOnSave = vi.fn();
    
    render(
      <ScriptEditor
        documentId="test-doc"
        projectId="test-project"
        config={{
          autoSave: false // Auto-save disabled
        }}
        onSave={mockOnSave}
        testMode={true}
      />
    );

    // Wait for editor to be ready
    await waitFor(() => {
      expect(screen.getByTestId('script-editor')).toBeInTheDocument();
    });

    const editorContent = screen.getByTestId('editor-content');
    
    // Trigger content changes
    for (let i = 0; i < 5; i++) {
      editorContent.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // No auto-save timers should be created when disabled
    const autoSaveTimers = setTimeoutSpy.mock.calls.filter(
      ([, delay]: [any, number]) => delay >= 1000 && delay <= 5000
    );
    
    expect(autoSaveTimers.length).toBe(0);
  });
});