# ADR-001: Data Model Selection for Elevana AV Orchestrator

**Status:** Proposed  
**Date:** 2025-09-09  
**Deciders:** Technical Architect, Critical Engineer  

## Context

The Elevana AV (EAV) Orchestrator requires a data model to support collaborative video production workflows. Initial confusion arose from the "EAV" acronym, which stands for the company name "Elevana AV", NOT the Entity-Attribute-Value database anti-pattern.

## Decision

We will use **PostgreSQL with a traditional relational model** augmented by **JSONB columns** for rich text content storage.

## Rationale

### Requirements Analysis
- 10-20 concurrent users (not 1000s)
- Script components with rich text (TipTap JSON)
- Clear hierarchical relationships (Project → Video → Script → Component)
- Real-time collaboration features
- Audit trail and versioning needs

### Options Considered

1. **Entity-Attribute-Value (EAV) Pattern**
   - ❌ REJECTED: Performance nightmare at scale
   - ❌ Complex queries for simple operations
   - ❌ Loss of referential integrity
   - ❌ Impossible to index effectively

2. **Pure Document Database (MongoDB)**
   - ❌ REJECTED: Poor for relational data
   - ❌ Weak consistency guarantees
   - ❌ Complex for cross-document transactions

3. **PostgreSQL with JSONB** ✅ SELECTED
   - ✅ Strong ACID guarantees
   - ✅ Excellent for mixed structured/unstructured data
   - ✅ JSONB for TipTap rich text storage
   - ✅ Proper indexes and constraints
   - ✅ Battle-tested at scale
   - ✅ Supports real-time via logical replication

### Schema Design Principles

```sql
-- Example: Y.js CRDT Data Model for Collaborative Documents
-- This pattern uses an append-only log for updates, ensuring data integrity and history.

-- Stores metadata and the latest state vector for efficient sync
CREATE TABLE yjs_documents (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id),
    document_type TEXT NOT NULL,
    state_vector BYTEA NOT NULL,
    version INTEGER NOT NULL DEFAULT 1, -- For optimistic locking
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Append-only log of all changes (Y.js updates)
CREATE TABLE yjs_document_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES yjs_documents(id) ON DELETE CASCADE,
    project_id UUID NOT NULL, -- Denormalized for RLS performance
    update_data BYTEA NOT NULL,
    sequence_number BIGSERIAL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Proper indexes for performance
CREATE INDEX idx_yjs_documents_project_id ON yjs_documents(project_id);
CREATE INDEX idx_yjs_updates_doc_sequence ON yjs_document_updates(document_id, sequence_number);
```

## Consequences

### Positive
- Clear, maintainable schema
- Excellent query performance
- Strong data integrity
- Easy to reason about
- Supports all requirements without complexity

### Negative
- Requires schema migrations for structural changes
- Need to carefully design JSONB structure upfront

### Mitigation
- Use database migrations tool (e.g., Prisma, TypeORM)
- Create clear JSONB validation schemas
- Document all schema decisions in ADRs

## Validation
// Critical-Engineer: consulted for Architecture pattern selection
// Technical-Architect: Validated data model aligns with system requirements

## References
- [PostgreSQL JSONB Documentation](https://www.postgresql.org/docs/current/datatype-json.html)
- [Why Entity-Attribute-Value is an Anti-Pattern](https://www.cybertec-postgresql.com/en/entity-attribute-value-eav-design-in-postgresql/)