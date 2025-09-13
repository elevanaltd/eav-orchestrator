/**
 * TipTap Editor Mock for Memory Leak Testing
 *
 * Provides a mock TipTap editor that triggers content change callbacks
 * to test auto-save timer management without full editor functionality.
 */

// Context7: consulted for react
import React from 'react';
// Context7: consulted for vitest
import { vi } from 'vitest';

// Mock editor instance with trigger capabilities
// eslint-disable-next-line react-refresh/only-export-components
export const createMockEditor = (onUpdate?: (data: { editor: any }) => void) => {
  const mockEditor = {
    getJSON: vi.fn(() => ({ type: 'doc', content: [] })),
    can: vi.fn(() => ({
      undo: vi.fn(() => false),
      redo: vi.fn(() => false)
    })),
    isActive: vi.fn(() => false),
    getAttributes: vi.fn(() => ({})),
    chain: vi.fn(() => ({
      focus: vi.fn(() => ({
        toggleBold: vi.fn(() => ({ run: vi.fn() })),
        toggleItalic: vi.fn(() => ({ run: vi.fn() })),
        toggleBulletList: vi.fn(() => ({ run: vi.fn() })),
        toggleHeading: vi.fn(() => ({ run: vi.fn() })),
        setParagraph: vi.fn(() => ({ run: vi.fn() }))
      }))
    })),
    state: {
      selection: { from: 0, to: 0 },
      doc: {
        textBetween: vi.fn(() => '')
      }
    },
    storage: {
      characterCount: {
        words: vi.fn(() => 0),
        characters: vi.fn(() => 0)
      }
    },
    // Add method to trigger content change
    triggerUpdate: () => {
      if (onUpdate) {
        onUpdate({ editor: mockEditor });
      }
    }
  };

  return mockEditor;
};

// Mock EditorContent component
export const MockEditorContent: React.FC<{ editor: any }> = ({ editor }) => {
  // Store editor reference for test access
  React.useEffect(() => {
    if (editor && typeof window !== 'undefined') {
      (window as any).__testEditor = editor;
    }
  }, [editor]);

  return (
    <div data-testid="editor-content">
      Mock Editor Content
    </div>
  );
};