# EAV Script Editor Visual Requirements
*Based on /Volumes/EAV/new-system/eav-visual-demo.html analysis*

## Critical Design Pattern: Google Docs Style

### Core Concept
The script editor must appear as a **single continuous document** (like Google Docs), NOT as separate component blocks. Each paragraph is actually a separate database component, but this separation is **completely invisible** to users.

## Layout Structure (3-Column)

### Left Sidebar (280px)
- Project/video list
- Script metadata (word count, duration, status)
- Clean white cards with hover effects
- Active script highlighted in blue

### Center Content (flex: 1)
- **Document-style editor**
- White background
- No visual separation between components
- Continuous text flow

### Right Sidebar (350px)
- Comments panel
- Review threads
- Status indicators per section

## Typography & Spacing

```css
.script-paragraph {
    font-family: Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.8;
    margin-bottom: 16px;
    padding: 4px 0;
    /* NO borders, NO background colors, NO cards */
}

.script-title {
    font-size: 24px;
    font-weight: normal;
    margin-bottom: 24px;
    padding-bottom: 12px;
    border-bottom: 1px solid #dadce0;
}
```

## Component Rendering Requirements

### Current Problem (Likely)
```jsx
// WRONG - Components shown as separate blocks
<div className="component-card">
  <ScriptComponent />
</div>
<div className="component-card">
  <ScriptComponent />
</div>
```

### Required Implementation
```jsx
// CORRECT - Components rendered as seamless paragraphs
<div className="document-container">
  <p className="script-paragraph">Content from component 1...</p>
  <p className="script-paragraph">Content from component 2...</p>
  <p className="script-paragraph">Content from component 3...</p>
</div>
```

## Visual Features to Implement

1. **Seamless Text Flow**
   - No visual boundaries between components
   - Paragraphs flow naturally like a Word document
   - Component separation only visible in database/admin view

2. **Comment Highlights**
   - Yellow background (rgba(251, 188, 4, 0.3))
   - Small numbered indicators
   - Connected to right sidebar comments

3. **Inline Status Indicators** (Per Component)
   - Small badges above each paragraph (only in certain views)
   - States: Generated, Generating, Pending
   - Should be toggleable (show/hide)

4. **Voice Pronunciation Markers**
   - Highlighted text with yellow background
   - Shows phonetic spelling (e.g., "MVHR" → "M-V-H-R")

## Implementation Strategy

### Phase 1: Fix Component Rendering
1. Remove all card/container styling from components
2. Render components as simple paragraphs
3. Ensure continuous document flow

### Phase 2: Add Document Styling
1. Apply Google Docs-like typography
2. Add proper paragraph spacing
3. Implement clean, minimal toolbar

### Phase 3: Add Interactive Features
1. Comment highlighting system
2. Component status indicators (toggleable)
3. Voice pronunciation markers

## Key Success Criteria

✅ **Looks like Google Docs** - Single continuous document
✅ **No visible component boundaries** - Seamless paragraph flow
✅ **Clean, professional appearance** - Minimal UI chrome
✅ **Hidden complexity** - Database components invisible to users

## Anti-Patterns to Avoid

❌ Card-based component display
❌ Visible borders between components
❌ Different background colors per component
❌ Excessive spacing between components
❌ Complex component headers/footers

---

**Next Steps:**
1. Review current ScriptEditor component implementation
2. Remove component card styling
3. Implement seamless paragraph rendering
4. Add document-style CSS from demo
