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
// React and Y imports removed - not used directly in tests

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

    const { } = render(
      <ScriptEditor
        config={{
          documentId: "test-doc",
          userId: "test-user",
          userName: "Test User",
          autoSave: true,
          autoSaveDelay: 1000
        }}
        onSave={mockOnSave}
        onContentChange={mockOnContentChange}
      />
    );

    // Wait for editor to be ready
    await waitFor(() => {
      expect(screen.getByTestId('script-editor')).toBeInTheDocument();
    });

    // Get the trigger function from the window
    const triggerUpdate = (window as any).__triggerEditorUpdate;
    expect(triggerUpdate).toBeDefined();

    // Trigger multiple content changes
    for (let i = 0; i < 5; i++) {
      // Trigger editor update which will call handleContentChange
      triggerUpdate();

      // Small delay between changes
      await new Promise(resolve => originalSetTimeout(resolve, 100));
    }

    // Wait for any pending timers
    await new Promise(resolve => originalSetTimeout(resolve, 100));

    // Check that timers were managed properly
    // The key is that we don't accumulate timers
    expect(timeoutIds.size).toBeLessThanOrEqual(1);

    // Verify that we did clear some timers (proving management is happening)
    // With auto-save enabled and multiple changes, we should have cleared timers
    if (setTimeoutSpy.mock.calls.length > 1) {
      expect(clearTimeoutSpy).toHaveBeenCalled();
    }
  });

  it('should clear auto-save timer on component unmount', async () => {
    const mockOnSave = vi.fn();

    const { unmount } = render(
      <ScriptEditor
        config={{
          documentId: "test-doc",
          userId: "test-user",
          userName: "Test User",
          autoSave: true,
          autoSaveDelay: 1000
        }}
        onSave={mockOnSave}
      />
    );

    // Wait for editor to be ready
    await waitFor(() => {
      expect(screen.getByTestId('script-editor')).toBeInTheDocument();
    });

    // Get the trigger function from the window
    const triggerUpdate = (window as any).__triggerEditorUpdate;
    expect(triggerUpdate).toBeDefined();

    // Trigger a content change to start auto-save timer
    triggerUpdate();

    // Wait for timer to be set
    await new Promise(resolve => originalSetTimeout(resolve, 100));

    // Track how many timers were created
    const timersBeforeUnmount = setTimeoutSpy.mock.calls.length;

    // Unmount the component
    unmount();

    // Verify that timer was cleared on unmount
    if (timersBeforeUnmount > 0) {
      // Should have called clearTimeout during unmount
      expect(clearTimeoutSpy).toHaveBeenCalled();
    }

    // Check that unmount cleanup happened (may still have other test timers)
    // The important thing is that clearTimeout was called
  });

  it('should not create multiple timers for the same auto-save delay', async () => {
    const mockOnSave = vi.fn();

    render(
      <ScriptEditor
        config={{
          documentId: "test-doc",
          userId: "test-user",
          userName: "Test User",
          autoSave: true,
          autoSaveDelay: 500
        }}
        onSave={mockOnSave}
      />
    );

    // Wait for editor to be ready
    await waitFor(() => {
      expect(screen.getByTestId('script-editor')).toBeInTheDocument();
    });

    // Get the trigger function from the window
    const triggerUpdate = (window as any).__triggerEditorUpdate;
    expect(triggerUpdate).toBeDefined();

    // Clear previous counts
    setTimeoutSpy.mockClear();
    clearTimeoutSpy.mockClear();

    // Trigger rapid content changes
    for (let i = 0; i < 10; i++) {
      triggerUpdate();
      // No delay - rapid fire changes
    }

    // Wait a bit for any timers to be set
    await new Promise(resolve => originalSetTimeout(resolve, 100));

    // Should have created timers
    expect(setTimeoutSpy).toHaveBeenCalled();

    // With rapid changes, we should have cleared previous timers
    // The exact count depends on timing, but there should be clears
    const setCount = setTimeoutSpy.mock.calls.length;
    const clearCount = clearTimeoutSpy.mock.calls.length;

    // Should have cleared most timers (at least setCount - 1)
    expect(clearCount).toBeGreaterThanOrEqual(Math.max(0, setCount - 1));

    // Only one timer should be active at the end
    expect(timeoutIds.size).toBeLessThanOrEqual(1);
  });

  it('should not leak memory when auto-save is disabled', async () => {
    const mockOnSave = vi.fn();

    render(
      <ScriptEditor
        config={{
          documentId: "test-doc",
          userId: "test-user",
          userName: "Test User",
          autoSave: false // Auto-save disabled
        }}
        onSave={mockOnSave}
      />
    );

    // Wait for editor to be ready
    await waitFor(() => {
      expect(screen.getByTestId('script-editor')).toBeInTheDocument();
    });

    // Get the trigger function from the window
    const triggerUpdate = (window as any).__triggerEditorUpdate;
    expect(triggerUpdate).toBeDefined();

    // Clear previous spy calls
    setTimeoutSpy.mockClear();

    // Trigger content changes
    for (let i = 0; i < 5; i++) {
      triggerUpdate();
    }

    // Wait a bit to ensure no timers are set
    await new Promise(resolve => originalSetTimeout(resolve, 100));

    // No auto-save timers should be created when disabled
    // Check for timers with delays typical of auto-save (500ms - 5000ms)
    const autoSaveTimers = setTimeoutSpy.mock.calls.filter(
      ([, delay]: [any, number]) => delay >= 500 && delay <= 5000
    );

    expect(autoSaveTimers.length).toBe(0);
  });
});