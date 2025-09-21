# Yjs + Supabase CRDT Collaboration Architecture (V2 - Production Ready)

**Project:** EAV Orchestrator  
**Component:** Real-time Collaborative Editing System  
**Version:** 2.0 (Production Implementation)
**Date:** 2025-09-14
**Status:** IMPLEMENTED & VALIDATED
**Author:** technical-architect, critical-engineer

## Executive Summary

This document defines the production architecture for integrating Y.js (CRDT document management) with Supabase (transport layer and persistence). This V2 architecture replaces the previous model and implements a secure, performant, and resilient append-only log system for collaborative editing, resolving critical security and data integrity issues.

## Architecture Overview

### Core Principle: Append-Only Log with RLS Enforcement
```yaml
Architecture_Principle:
  - Y.js for client-side CRDT logic and conflict-free merging.
  - Supabase for persistence, transport, and authorization.
  - An append-only `yjs_document_updates` table serves as the source of truth for all changes.
  - A `yjs_documents` table stores metadata and state vectors for efficient synchronization.
  - Row Level Security (RLS) policies on all tables ensure strict data isolation between projects.
```

### 1. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │   TipTap     │  │     Yjs      │  │ CustomSupabaseProvider   │ │
│  │   Editor     │←→│   Document   │←→│ (Yjs-Supabase Connector) │ │
│  │              │  │    (CRDT)    │  │                          │ │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┤
                                │ ▲
          (RPC: append_yjs_update) │ │ (Realtime: new updates)
                                ▼ │
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE PLATFORM                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐   ┌──────────────────┐   ┌────────────────┐ │
│  │   PostgreSQL     │   │ Supabase Realtime│   │   Auth (RLS)   │ │
│  │ ---------------- │   │ ---------------- │   │ -------------- │ │
│  │ - yjs_documents  │   │ - Broadcast      │   │ - is_project_  │ │
│  │ - yjs_updates    │   │ - Presence       │   │   editor()     │ │
│  │ - RLS Policies   │   │ - PG Changes     │   │ - can_read_    │ │
│  │ - RPC Functions  │   │                  │   │   project()    │ │
│  └──────────────────┘   └──────────────────┘   └────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Database Schema (Source of Truth)

### 2.1 `yjs_documents` Table
This table stores metadata for each collaborative document.
```sql
CREATE TABLE yjs_documents (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL,
    document_type TEXT NOT NULL,
    state_vector BYTEA NOT NULL, -- For efficient client sync
    version INTEGER NOT NULL DEFAULT 1, -- For optimistic locking
    update_count INTEGER NOT NULL, -- For snapshotting logic
    -- ...timestamps and user tracking
);
```

### 2.2 `yjs_document_updates` Table (Append-Only Log)
This is the core of the CRDT system, storing an immutable log of all changes.
```sql
CREATE TABLE yjs_document_updates (
    id UUID PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES yjs_documents(id),
    project_id UUID NOT NULL, -- Denormalized for RLS performance
    update_data BYTEA NOT NULL, -- The Y.js binary update
    sequence_number BIGSERIAL, -- Guarantees order of operations
    created_at TIMESTAMPTZ NOT NULL,
    created_by UUID
);
```

## 3. Core Functions & Logic

### 3.1 `append_yjs_update()` Function
This PostgreSQL function is the single entry point for writing updates. It ensures atomicity and security.
```sql
-- Atomically appends an update and updates the document's state vector
CREATE OR REPLACE FUNCTION append_yjs_update(
    p_document_id UUID,
    p_update_data BYTEA,
    p_expected_version INTEGER,
    p_new_state_vector BYTEA
) RETURNS TABLE (...)
```
**Key Features:**
- **Append-Only:** Inserts a new row into `yjs_document_updates`.
- **Optimistic Locking:** Uses `p_expected_version` to prevent race conditions when updating the main `yjs_documents` record.
- **Atomic:** The entire operation is transactional. If the version check fails, the update insertion is rolled back.
- **RLS Protected:** The function and underlying tables are protected by RLS, ensuring only authorized users can append updates.

### 3.2 `get_yjs_document_updates_since()` Function
This function allows clients to efficiently fetch only the updates they are missing.
```sql
-- Retrieves all updates for a document after a given sequence number
CREATE OR REPLACE FUNCTION get_yjs_document_updates_since(
    p_document_id UUID,
    p_since_sequence BIGINT
) RETURNS TABLE (...)
```
**Key Features:**
- **Efficient Sync:** Clients provide their last known sequence number and only receive newer updates.
- **RLS Protected:** Users can only fetch updates for documents they have read access to.

## 4. Real-time Collaboration Flow

1.  **Client Connects:** A client initializes `CustomSupabaseProvider`.
2.  **Initial State Load:** The provider calls `get_yjs_document_updates_since` with sequence `0` to fetch all historical updates and reconstructs the document.
3.  **Real-time Subscription:** The provider subscribes to PostgreSQL changes on the `yjs_document_updates` table, filtered by `document_id`.
4.  **Local Edit:** A user makes an edit in the TipTap editor.
5.  **Y.js Update:** Y.js generates a binary `update`.
6.  **Persist Update:** `CustomSupabaseProvider` calls the `append_yjs_update` RPC function with the binary update and the current document version.
7.  **Database Transaction:**
    - `append_yjs_update` inserts the new update into `yjs_document_updates`.
    - It then attempts to update the `version` and `state_vector` in the `yjs_documents` table, checking against the `p_expected_version`.
    - If the version matches, the transaction commits.
8.  **Real-time Broadcast:** The `INSERT` on `yjs_document_updates` triggers a notification via Supabase Realtime.
9.  **Remote Clients Receive Update:** Other connected clients receive the new `update_data` from the broadcast.
10. **Apply Remote Update:** Remote clients apply the binary update to their local Y.Doc, and their UI updates automatically.

## 5. Security Model: RLS Enforcement

- **Read Access (`can_read_project`):** Users can only subscribe to channels and fetch updates for documents within projects they are members of.
- **Write Access (`is_project_editor`):** Only users with `admin`, `internal`, or `freelancer` roles can call `append_yjs_update` successfully. RLS policies on the underlying tables provide a second layer of defense.
- **Data Isolation:** The `project_id` is denormalized into `yjs_document_updates` to allow for high-performance RLS checks without expensive subqueries or joins.

## 6. Resilience and Offline Support

- **Circuit Breaker:** The `CustomSupabaseProvider` wraps all database operations in a circuit breaker (`opossum`) to handle temporary Supabase unavailability.
- **Offline Queue:** When the circuit is open, updates are queued locally in `IndexedDB`.
- **Automatic Recovery:** When the connection is restored and the circuit closes, the queued updates are drained and sent to the server.

---
**Architectural Decision:** This V2 architecture is the authoritative model for all collaborative editing features. It replaces all previous designs and documentation related to Y.js persistence.

**Validation:** This architecture is validated by the successful implementation in migration `005_yjs_documents_security_fix.sql` and the passing test suite in `tests/unit/database/yjs-security.test.ts`.