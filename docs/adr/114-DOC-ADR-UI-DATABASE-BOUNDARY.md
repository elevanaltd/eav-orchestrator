# ADR-114: UI/Database Boundary Transformation Layer

**Status:** Accepted
**Date:** 2025-09-19
**Decision Makers:** Holistic Orchestrator, Critical Engineer, Implementation Lead

## Context

The EAV Orchestrator system interfaces with a PostgreSQL database that follows SQL naming conventions (snake_case) while the React UI layer follows JavaScript conventions (camelCase). Initially, database field names were directly exposed in the UI layer, creating a leaky abstraction that violated separation of concerns.

### Problem Evidence
- TypeScript interfaces using snake_case in React components
- Test failures due to property name mismatches
- Direct coupling between database schema and UI components
- 20 failing tests expecting camelCase but receiving snake_case

## Decision

Implement a transformation boundary layer between the database and UI to maintain clean separation of concerns.

### Architecture Components

1. **Database Layer** (`ScriptComponent`)
   - Uses snake_case naming (`component_id`, `script_id`, `content_tiptap`)
   - Matches PostgreSQL column names exactly
   - Located in `/src/types/scriptComponent.ts`

2. **UI Layer** (`ScriptComponentUI`)
   - Uses camelCase naming (`componentId`, `scriptId`, `content`)
   - Follows React/JavaScript conventions
   - Located in `/src/types/ui/scriptComponent.ts`

3. **Transformation Layer**
   - `toUIModel(data: ScriptComponent): ScriptComponentUI`
   - `toApiModel(data: ScriptComponentUI): ScriptComponent`
   - Located in `/src/types/editor.ts` and `/src/lib/api/transformers.ts`

## Consequences

### Positive
- **Clean Separation:** Database structure changes don't ripple through UI
- **Type Safety:** Compile-time verification of transformations
- **Convention Compliance:** Each layer follows its ecosystem's conventions
- **Maintainability:** Clear boundaries make the system easier to understand
- **Testability:** UI tests use UI models, database tests use DB models

### Negative
- **Additional Code:** Transformation functions must be maintained
- **Performance:** Minor overhead for transformations (negligible for our scale)
- **Learning Curve:** Developers must understand the two-model system

## Implementation Details

### Example Transformation
```typescript
// Database to UI
export const toUIModel = (data: ScriptComponent): ScriptComponentUI => ({
  componentId: data.component_id,
  scriptId: data.script_id,
  content: data.content_tiptap,
  plainText: data.content_plain,
  position: data.position,
  // ... other mappings
});

// UI to Database
export const toApiModel = (data: ScriptComponentUI): ScriptComponent => ({
  component_id: data.componentId,
  script_id: data.scriptId,
  content_tiptap: data.content,
  content_plain: data.plainText,
  position: data.position,
  // ... other mappings
});
```

### Usage Pattern
```typescript
// Fetching data
const dbData = await supabase.from('script_components').select();
const uiData = dbData.map(toUIModel);

// Saving data
const dbData = toApiModel(uiComponent);
await supabase.from('script_components').insert(dbData);
```

## Alternatives Considered

1. **Force camelCase in Database**
   - Rejected: Goes against PostgreSQL conventions, harder to query

2. **Force snake_case in UI**
   - Rejected: Non-idiomatic React, confuses frontend developers

3. **Use GraphQL with Auto-transformation**
   - Rejected: Over-engineering for our 10-20 user scale

4. **ORM with Aliasing**
   - Rejected: Adds complexity without clear benefits at our scale

## Validation Criteria

- ✅ All UI components use camelCase properties
- ✅ All database operations use snake_case
- ✅ TypeScript compilation shows 0 errors
- ✅ Tests properly separated by layer
- ✅ No snake_case in `/src/components`
- ✅ No camelCase in `/src/lib/database`

## References

- Critical Engineer Assessment: "Textbook case of leaky abstraction"
- Commit: d5712ef - "fix: complete UI/database boundary transformation"
- Session Summary: `/docs/224-BUILD-UI-DATABASE-TRANSFORMATION-SESSION.md`
- Design Principles: Clean Architecture, Separation of Concerns

## Review Notes

**Critical Engineer:** "This is the minimum viable architecture for a maintainable system. The cost to fix now is trivial; the cost later would be enormous."

**Holistic Orchestrator:** "Constitutional enforcement - this boundary violation would have cascaded through the entire system causing Conway's Law manifestation."

---

**ADR Status:** This decision is final and forms part of the system's architectural foundation.