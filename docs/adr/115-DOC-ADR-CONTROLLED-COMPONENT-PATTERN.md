# ADR-115: Controlled-Only Component Pattern for ScriptEditor

**Status:** Accepted
**Date:** 2025-09-19
**Decision Makers:** Technical Architect, Holistic Orchestrator

## Context

During B2-BUILD phase implementation review, we evaluated two architectural patterns for the ScriptEditor component's state management:

1. **Controlled-Only Pattern** (Current Implementation)
2. **Controlled/Uncontrolled Dual Pattern** (Reference Implementation)

### Pattern Comparison

**Controlled-Only (Current):**
- Parent component always manages component state via props
- Single data flow pattern
- Component receives `components` prop and callbacks

**Controlled/Uncontrolled Dual (Reference):**
- Component can manage its own state OR accept external state
- Dual mode with `isControlled` detection
- Internal state fallback when no props provided

## Decision

We maintain the **Controlled-Only Pattern** for ScriptEditor component management.

## Rationale

### 1. Application-Specific Context
- EAV Orchestrator is an internal tool for 10-20 users
- Not a reusable component library
- Single, known usage pattern in App.tsx

### 2. Architectural Principles Applied

**YAGNI (You Aren't Gonna Need It):**
- No evidence of need for uncontrolled mode
- All current usage is controlled via parent state

**KISS (Keep It Simple, Stupid):**
- Single data flow is simpler to understand and maintain
- Reduces cognitive load for developers

**MIP (Minimal Intervention Principle):**
- Essential: State management ✅
- Accumulative: Dual mode flexibility ❌

### 3. Risk Analysis

**Controlled-Only:**
- ✅ Zero additional complexity
- ✅ Already working for all 5 features
- ✅ Predictable state updates
- ✅ Easier debugging

**Dual Mode Would Add:**
- ❌ State synchronization complexity
- ❌ Mode detection logic
- ❌ Conditional state updates
- ❌ Additional testing burden

## Consequences

### Positive
- **Simplicity:** Single, predictable data flow
- **Maintainability:** Less code to maintain
- **Clarity:** Clear responsibility boundaries
- **Testing:** Simpler test scenarios

### Negative
- **Flexibility:** Cannot use component without parent state management
- **Reusability:** Not suitable as standalone component library

### Mitigation
The negative consequences are not relevant for our internal tool use case.

## Implementation

Current implementation in `/src/components/editor/ScriptEditor.tsx`:
```typescript
// Parent always provides components and handlers
interface ScriptEditorProps {
  components?: ScriptComponentUI[];
  onComponentAdd?: (component: Partial<ScriptComponentUI>) => Promise<ScriptComponentUI>;
  onComponentUpdate?: (componentId: string, updates: Partial<ScriptComponentUI>) => Promise<void>;
  onComponentDelete?: (componentId: string) => Promise<void>;
  onComponentReorder?: (componentIds: string[]) => Promise<void>;
  // ... other props
}
```

## Test Pattern Improvement

We adopted the improved test setup pattern from the reference:
```typescript
const setup = (props: any = {}) => {
  const defaultProps: any = {
    config: { documentId: 'doc-123', userName: 'test-user', userId: 'user-123' },
    onComponentAdd: vi.fn(),
    // ... other defaults
  };

  // Better prop merging
  Object.keys(props).forEach(key => {
    if (key !== 'components' || props.components !== undefined) {
      defaultProps[key] = props[key];
    }
  });

  return render(<ScriptEditor {...defaultProps} />);
};
```

## References

- Technical Architect Review: 2025-09-19
- Original Implementation: B2-BUILD Phase
- Component Management Features: Add, Edit, Delete, Reorder, Auto-save

## Review Notes

**Technical Architect:** "The controlled-only pattern is architecturally correct for this use case. Adding dual mode would be over-engineering."

**Holistic Orchestrator:** "MIP principle validated - essential architecture only, no accumulative complexity."

---

**ADR Status:** This decision validates the current implementation as architecturally sound.