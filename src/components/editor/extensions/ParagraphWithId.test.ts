/**
 * ParagraphWithId Extension Tests - TDD RED STATE
 *
 * Testing paragraph extension with stable UUID attributes
 * that persist through collaborative editing operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Editor } from '@tiptap/core';
import { Document } from '@tiptap/extension-document';
import { Text } from '@tiptap/extension-text';
import { ParagraphWithId } from './ParagraphWithId';

describe('ParagraphWithId Extension', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [
        Document,
        ParagraphWithId,
        Text,
      ],
      content: '<p>Test paragraph</p>',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  describe('Stable ID Generation', () => {
    it('should automatically assign stable UUID to paragraphs', () => {
      const json = editor.getJSON();
      const paragraph = json.content?.[0];

      expect(paragraph?.type).toBe('paragraph');
      expect(paragraph?.attrs?.stableId).toBeDefined();
      expect(paragraph?.attrs?.stableId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique UUIDs for different paragraphs', () => {
      editor.commands.setContent('<p>First paragraph</p><p>Second paragraph</p>');

      const json = editor.getJSON();
      const firstParagraph = json.content?.[0];
      const secondParagraph = json.content?.[1];

      expect(firstParagraph?.attrs?.stableId).toBeDefined();
      expect(secondParagraph?.attrs?.stableId).toBeDefined();
      expect(firstParagraph?.attrs?.stableId).not.toBe(secondParagraph?.attrs?.stableId);
    });
  });

  describe('HTML Parsing and Rendering', () => {
    it('should preserve stable IDs when parsing HTML', () => {
      const testId = 'test-stable-id-123';
      const htmlWithId = `<p data-stable-id="${testId}">Test paragraph</p>`;

      editor.commands.setContent(htmlWithId);
      const json = editor.getJSON();
      const paragraph = json.content?.[0];

      expect(paragraph?.attrs?.stableId).toBe(testId);
    });

    it('should render stable IDs in HTML output', () => {
      editor.commands.setContent('<p>Test paragraph with stable ID</p>');

      const json = editor.getJSON();
      const stableId = json.content?.[0]?.attrs?.stableId;
      const html = editor.getHTML();

      expect(html).toContain(`data-stable-id="${stableId}"`);
    });

    it('should generate new UUID when parsing HTML without stable ID', () => {
      const htmlWithoutId = '<p>Paragraph without ID</p>';

      editor.commands.setContent(htmlWithoutId);
      const json = editor.getJSON();
      const paragraph = json.content?.[0];

      expect(paragraph?.attrs?.stableId).toBeDefined();
      expect(paragraph?.attrs?.stableId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });

  describe('Paragraph Split Operations', () => {
    it('should preserve original stable ID on first paragraph when splitting', () => {
      editor.commands.setContent('<p>First line and second line</p>');

      const originalJson = editor.getJSON();
      const originalId = originalJson.content?.[0]?.attrs?.stableId;

      // Position cursor between "First line" and " and second line"
      editor.commands.setTextSelection(10);
      editor.commands.splitBlock();

      const newJson = editor.getJSON();
      const firstParagraph = newJson.content?.[0];
      const secondParagraph = newJson.content?.[1];

      expect(firstParagraph?.attrs?.stableId).toBe(originalId);
      expect(secondParagraph?.attrs?.stableId).toBeDefined();
      expect(secondParagraph?.attrs?.stableId).not.toBe(originalId);
    });

    it('should assign new UUID to second paragraph when splitting', () => {
      editor.commands.setContent('<p>Split me here</p>');

      // Split the paragraph
      editor.commands.setTextSelection(6); // After "Split "
      editor.commands.splitBlock();

      const json = editor.getJSON();
      const secondParagraph = json.content?.[1];

      expect(secondParagraph?.attrs?.stableId).toBeDefined();
      expect(secondParagraph?.attrs?.stableId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should use custom splitBlock on Enter key', () => {
      editor.commands.setContent('<p>Line one</p>');

      const originalJson = editor.getJSON();
      const originalId = originalJson.content?.[0]?.attrs?.stableId;

      // Simulate pressing Enter
      editor.commands.setTextSelection(8); // End of line
      editor.commands.keyboardShortcut('Enter');

      const newJson = editor.getJSON();
      expect(newJson.content).toHaveLength(2);
      expect(newJson.content?.[0]?.attrs?.stableId).toBe(originalId);
      expect(newJson.content?.[1]?.attrs?.stableId).toBeDefined();
      expect(newJson.content?.[1]?.attrs?.stableId).not.toBe(originalId);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty paragraphs', () => {
      editor.commands.setContent('<p></p>');

      const json = editor.getJSON();
      const paragraph = json.content?.[0];

      expect(paragraph?.attrs?.stableId).toBeDefined();
    });

    it('should handle multiple consecutive splits', () => {
      editor.commands.setContent('<p>Split multiple times</p>');

      const originalJson = editor.getJSON();
      const originalId = originalJson.content?.[0]?.attrs?.stableId;

      // Split twice
      editor.commands.setTextSelection(6); // After "Split "
      editor.commands.splitBlock();
      editor.commands.splitBlock();

      const json = editor.getJSON();
      expect(json.content).toHaveLength(3);

      // First paragraph keeps original ID
      expect(json.content?.[0]?.attrs?.stableId).toBe(originalId);

      // Other paragraphs have unique new IDs
      const ids = json.content?.map(p => p?.attrs?.stableId);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });
  });
});