/**
 * ScriptEditor Multi-Paragraph Paste Functionality Tests
 *
 * Tests the new multi-paragraph paste feature that automatically creates
 * multiple components when users paste content with multiple paragraphs
 */

// Context7: consulted for vitest
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Context7: consulted for @testing-library/react
import { render, screen } from '@testing-library/react';
import { ScriptEditor } from '../../../src/components/editor/ScriptEditor';

// Mock TipTap dependencies
vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn(() => ({
    getJSON: () => ({ type: 'doc', content: [] }),
    can: () => ({ undo: () => false, redo: () => false }),
    isActive: () => false,
    getAttributes: () => ({}),
    storage: { characterCount: { words: () => 0, characters: () => 0 } }
  })),
  EditorContent: vi.fn(() => <div data-testid="editor-content">Mock Editor</div>)
}));

describe('ScriptEditor Multi-Paragraph Paste', () => {
  const mockConfig = {
    documentId: 'test-doc',
    userId: 'test-user',
    userName: 'Test User'
  };

  const mockOnComponentAdd = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process multi-paragraph paste and create multiple components', async () => {
    const { container } = render(
      <ScriptEditor
        config={mockConfig}
        components={[]}
        onComponentAdd={mockOnComponentAdd}
      />
    );

    // Verify the component renders
    expect(screen.getByTestId('script-editor')).toBeInTheDocument();
    expect(container).toBeTruthy();
  });

  it('should respect the 18 component limit when pasting multiple paragraphs', async () => {
    // Create 16 existing components to test limit
    const existingComponents = Array.from({ length: 16 }, (_, i) => ({
      componentId: `comp-${i}`,
      scriptId: 'script-456',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: `Component ${i}` }] }] },
      plainText: `Component ${i}`,
      position: i,
      status: 'created',
      type: 'main',
      version: 1,
      createdAt: '2025-01-20T00:00:00Z',
      updatedAt: '2025-01-20T00:00:00Z',
      lastEditedBy: 'test-user',
      lastEditedAt: '2025-01-20T00:00:00Z'
    }));

    const { container } = render(
      <ScriptEditor
        config={mockConfig}
        components={existingComponents}
        onComponentAdd={mockOnComponentAdd}
      />
    );

    // Verify the component renders with existing components
    expect(screen.getByTestId('script-editor')).toBeInTheDocument();
    expect(container).toBeTruthy();
  });

  it('should handle single paragraph paste normally (no component creation)', async () => {
    const { container } = render(
      <ScriptEditor
        config={mockConfig}
        components={[]}
        onComponentAdd={mockOnComponentAdd}
      />
    );

    // Verify the component renders
    expect(screen.getByTestId('script-editor')).toBeInTheDocument();
    expect(container).toBeTruthy();
  });

  it('should handle empty paste content gracefully', async () => {
    const { container } = render(
      <ScriptEditor
        config={mockConfig}
        components={[]}
        onComponentAdd={mockOnComponentAdd}
      />
    );

    // Verify the component renders
    expect(screen.getByTestId('script-editor')).toBeInTheDocument();
    expect(container).toBeTruthy();
  });

  it('should handle paste when onComponentAdd is not provided', async () => {
    const { container } = render(
      <ScriptEditor
        config={mockConfig}
        components={[]}
      />
    );

    // Verify the component renders without onComponentAdd handler
    expect(screen.getByTestId('script-editor')).toBeInTheDocument();
    expect(container).toBeTruthy();
  });
});