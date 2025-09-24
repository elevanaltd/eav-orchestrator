/**
 * ParagraphWithId TipTap Extension
 *
 * Extends the default Paragraph node to include stable UUID attributes
 * that persist through paragraph operations (split, merge, reorder).
 *
 * Each paragraph gets a data-stable-id attribute that:
 * - Is automatically generated as UUID v4
 * - Persists through collaborative editing
 * - Is used for server-side component extraction
 * - Enables C1, C2, C3 visual decorations
 */

import { Paragraph } from '@tiptap/extension-paragraph';
import { mergeAttributes } from '@tiptap/core';

// Generate UUID v4
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const ParagraphWithId = Paragraph.extend({
  name: 'paragraph',

  addAttributes() {
    return {
      ...this.parent?.(),
      stableId: {
        default: () => generateUUID(),
        parseHTML: element => element.getAttribute('data-stable-id') || generateUUID(),
        renderHTML: attributes => {
          if (!attributes.stableId) {
            attributes.stableId = generateUUID();
          }
          return {
            'data-stable-id': attributes.stableId,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'p',
        getAttrs: element => {
          const stableId = (element as HTMLElement).getAttribute('data-stable-id') || generateUUID();
          return { stableId };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      ...this.parent?.(),
    };
  },

  addKeyboardShortcuts() {
    return {
      'Enter': () => {
        // Use default splitBlock behavior, onUpdate will handle UUID assignment
        return this.editor.commands.splitBlock();
      },
    };
  },
});

export default ParagraphWithId;