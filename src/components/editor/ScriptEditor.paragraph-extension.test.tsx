/**
 * ScriptEditor ParagraphWithId Extension Tests
 *
 * TRACED Protocol: TEST FIRST (RED STATE) - These tests MUST fail initially
 * Testing paragraph-as-component architecture with stable UUID persistence
 *
 * FAILURE CONTRACT: Tests verify ParagraphWithId extension that doesn't exist yet
 * Each paragraph gets a stable UUID that survives splits/merges/reorders
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Editor } from '@tiptap/react';
import { Document } from '@tiptap/extension-document';
import { Text } from '@tiptap/extension-text';
import * as Y from 'yjs';

// This import will fail - extension doesn't exist yet (RED STATE)
import { ParagraphWithId } from './extensions/ParagraphWithId';
import { ScriptEditor } from './ScriptEditor';

// Mock Y.js provider for testing
const createMockYDoc = () => {
  const ydoc = new Y.Doc();
  return ydoc;
};

describe('ScriptEditor ParagraphWithId Extension', () => {
  let mockDoc: Y.Doc;

  beforeEach(() => {
    mockDoc = createMockYDoc();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockDoc.destroy();
  });

  describe('ParagraphWithId Extension', () => {
    it('should add stable UUID to each paragraph', () => {
      // RED STATE: This will fail because ParagraphWithId doesn't exist
      const editor = new Editor({
        extensions: [
          Document,
          ParagraphWithId,
          Text,
        ],
        content: '<p>Test paragraph</p>',
      });

      const paragraphNode = editor.getJSON().content?.[0];

      expect(paragraphNode?.type).toBe('paragraph');
      expect(paragraphNode?.attrs?.stableId).toBeDefined();
      expect(paragraphNode?.attrs?.stableId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

      editor.destroy();
    });

    it('should preserve stable ID when paragraph splits', () => {
      // RED STATE: This will fail because ParagraphWithId doesn't exist
      const editor = new Editor({
        extensions: [
          Document,
          ParagraphWithId,
          Text,
        ],
        content: '<p>First line<br>Second line</p>',
      });

      const originalParagraph = editor.getJSON().content?.[0];
      const originalId = originalParagraph?.attrs?.stableId;

      // Simulate paragraph split at cursor position
      editor.commands.setTextSelection(10); // Position between "First" and "line"
      editor.commands.splitBlock();

      const paragraphs = editor.getJSON().content;
      expect(paragraphs).toHaveLength(2);

      // First paragraph should keep original ID
      expect(paragraphs?.[0]?.attrs?.stableId).toBe(originalId);

      // Second paragraph should get new UUID
      expect(paragraphs?.[1]?.attrs?.stableId).toBeDefined();
      expect(paragraphs?.[1]?.attrs?.stableId).not.toBe(originalId);

      editor.destroy();
    });

    it('should maintain stable IDs in HTML output', () => {
      // RED STATE: This will fail because ParagraphWithId doesn't exist
      const editor = new Editor({
        extensions: [
          Document,
          ParagraphWithId,
          Text,
        ],
        content: '<p>Test paragraph with stable ID</p>',
      });

      const html = editor.getHTML();
      const stableId = editor.getJSON().content?.[0]?.attrs?.stableId;

      expect(html).toContain(`data-stable-id="${stableId}"`);

      editor.destroy();
    });

    it('should parse stable IDs from HTML input', () => {
      // RED STATE: This will fail because ParagraphWithId doesn't exist
      const testId = 'test-stable-id-123';
      const htmlWithId = `<p data-stable-id="${testId}">Test paragraph</p>`;

      const editor = new Editor({
        extensions: [
          Document,
          ParagraphWithId,
          Text,
        ],
        content: htmlWithId,
      });

      const paragraphNode = editor.getJSON().content?.[0];
      expect(paragraphNode?.attrs?.stableId).toBe(testId);

      editor.destroy();
    });
  });

  describe('ScriptEditor Integration', () => {
    it('should automatically assign component labels (C1, C2, C3) to paragraphs', async () => {
      // RED STATE: This will fail because component labels aren't implemented
      const config = {
        projectId: 'test-project',
        documentId: 'test-doc',
        scriptId: 'test-script',
        userId: 'test-user',
        userName: 'Test User',
      };

      render(
        <ScriptEditor
          config={config}
          ydoc={mockDoc}
          initialContent={{
            type: 'doc',
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'First component' }] },
              { type: 'paragraph', content: [{ type: 'text', text: 'Second component' }] },
              { type: 'paragraph', content: [{ type: 'text', text: 'Third component' }] },
            ]
          }}
        />
      );

      // Should see component labels in the editor
      expect(await screen.findByText('C1')).toBeInTheDocument();
      expect(await screen.findByText('C2')).toBeInTheDocument();
      expect(await screen.findByText('C3')).toBeInTheDocument();
    });

    it('should not show textarea components in paragraph-as-component mode', async () => {
      // RED STATE: This should fail initially because textareas still exist
      const config = {
        projectId: 'test-project',
        documentId: 'test-doc',
        scriptId: 'test-script',
        userId: 'test-user',
        userName: 'Test User',
      };

      render(
        <ScriptEditor
          config={config}
          ydoc={mockDoc}
          initialContent={{
            type: 'doc',
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'Test content' }] },
            ]
          }}
        />
      );

      // Should NOT find any textarea elements
      const textareas = screen.queryAllByRole('textbox');
      const tiptapTextareas = textareas.filter(textarea =>
        textarea.tagName.toLowerCase() === 'textarea'
      );

      expect(tiptapTextareas).toHaveLength(0);
    });

    it('should maintain stable IDs during collaborative editing', async () => {
      // RED STATE: Integration test that will fail until complete
      const config = {
        projectId: 'test-project',
        documentId: 'test-doc',
        scriptId: 'test-script',
        userId: 'test-user',
        userName: 'Test User',
      };

      const testContent = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { stableId: 'stable-id-1' },
            content: [{ type: 'text', text: 'Paragraph with stable ID' }]
          },
        ]
      };

      render(
        <ScriptEditor
          config={config}
          ydoc={mockDoc}
          initialContent={testContent}
        />
      );

      // Verify the stable ID is maintained in the DOM
      const paragraphElement = screen.getByText('Paragraph with stable ID').closest('p');
      expect(paragraphElement).toHaveAttribute('data-stable-id', 'stable-id-1');
    });
  });
});