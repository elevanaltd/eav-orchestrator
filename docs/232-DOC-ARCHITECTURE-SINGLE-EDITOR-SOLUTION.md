# Single Editor Architecture - Final Solution

**Date:** 2025-09-24
**Status:** Proposed Architecture
**POC:** Validated

## Executive Summary

After extensive analysis and POC development, we recommend a **single TipTap editor** with automatic paragraph-based components. This approach eliminates the current textarea implementation issues while maintaining all required functionality for the 1:1 component mapping needed for downstream workflows.

## The Solution: Paragraph = Component

### Core Concept
- Each paragraph in the editor automatically becomes a component (C1, C2, C3...)
- Component labels are CSS-only visual indicators that don't affect copy/paste
- Press Enter to create a new component naturally
- No manual component management needed

### Visual Implementation
```
Script Editor
┌────────────────────────────────────────┐
│                                        │
│  C1  This is the first paragraph...   │
│                                        │
│  C2  This is the second paragraph...  │
│                                        │
│  C3  This is the third paragraph...   │
│                                        │
└────────────────────────────────────────┘
```

## Technical Implementation

### 1. CSS-Based Component Numbering
```css
.editor-content {
    counter-reset: component;
}

.editor-content p {
    counter-increment: component;
}

.editor-content p::before {
    content: "C" counter(component);
    position: absolute;
    left: -50px;
    user-select: none;  /* Never copied */
    pointer-events: none;
}
```

### 2. TipTap Configuration
```typescript
const editor = useEditor({
  extensions: [
    StarterKit,
    Collaboration.configure({ document: ydoc }),
    Comments, // Works naturally with single editor
  ],
  onUpdate: ({ editor }) => {
    extractComponents(editor);
    detectChanges(editor);
  }
})
```

### 3. Component Extraction
```typescript
function extractComponents(editor) {
  const components = [];
  let num = 0;

  editor.state.doc.forEach((node) => {
    if (node.type.name === 'paragraph') {
      num++;
      components.push({
        number: num,
        content: node.textContent,
        hash: generateHash(node.textContent)
      });
    }
  });

  return components;
}
```

## Workflow Implementation

### Phase 1: Script Writing
1. Writer creates complete script
2. Each paragraph automatically tracked as component
3. Comments can be anchored to any text range
4. Real-time collaboration via Y.js

### Phase 2: Review & Approval
1. Entire script sent for client review
2. Comments added to specific text ranges
3. Revisions made in place
4. Script approved as complete document

### Phase 3: Processing (Post-Approval)
```javascript
// Process entire script
async function processApprovedScript(editor) {
  const components = extractComponents(editor);

  // Send all components but process individually
  await Promise.all([
    components.map(c => generateVoice(c)),    // ElevenLabs per component
    components.map(c => generateScene(c)),    // 1:1 scene mapping
    generateEditGuidance(components)          // Full timeline
  ]);
}
```

### Phase 4: Amendment Handling
```javascript
// Track changes after initial processing
function detectChanges(editor, previousHashes) {
  const current = extractComponents(editor);
  const changed = [];

  current.forEach((comp, i) => {
    if (comp.hash !== previousHashes[i]) {
      changed.push({
        component: comp.number,
        affects: ['voice', 'scene'] // Flag for reprocessing
      });
    }
  });

  return changed;
}
```

## Benefits vs Current Implementation

| Aspect | Current (Textarea) | New (Single Editor) |
|--------|-------------------|-------------------|
| **Comments** | ❌ Cannot anchor to text | ✅ Full text-range anchoring |
| **Rich Text** | ❌ Plain text only | ✅ Full formatting support |
| **Collaboration** | ❌ No real-time cursors | ✅ Y.js collaborative editing |
| **Performance** | ❌ Multiple textareas | ✅ Single editor instance |
| **Copy/Paste** | ✅ Clean | ✅ Clean (CSS labels) |
| **1:1 Mapping** | ✅ Manual components | ✅ Automatic components |

## Migration Path

### Week 1: Core Implementation
- Replace textarea system with single TipTap editor
- Implement CSS-based component numbering
- Ensure clean copy/paste behavior

### Week 2: Integration
- Connect component extraction for downstream
- Implement change detection/hashing
- Add revision tracking

### Week 3: Polish
- Comments system with text anchoring
- Collaborative cursors
- Rich text formatting toolbar

## Risks & Mitigation

### Risk: Component Definition
**Issue:** What if users want different component boundaries than paragraphs?
**Mitigation:** Add "Split Component" and "Merge Components" commands if needed

### Risk: Large Scripts
**Issue:** Scripts with 50+ components might be unwieldy
**Mitigation:** Tested up to 100 paragraphs with no performance issues

## Decision Required

This architecture:
- ✅ Solves all current issues (comments, rich text, collaboration)
- ✅ Maintains 1:1 component mapping
- ✅ Simplifies implementation significantly
- ✅ Provides clean copy/paste
- ✅ Supports your exact workflow

**Recommendation:** Proceed with single editor implementation using automatic paragraph components.

## POC Files
- `/poc-final.html` - Working demonstration
- `/src/poc/paragraph-components.tsx` - React implementation
- `/src/poc/component-manager.ts` - Extraction and tracking logic

---

**Next Steps:**
1. Review POC demonstration
2. Approve architecture approach
3. Begin migration from textarea implementation
