# 116-DOC-ADR-SMARTSUITE-CACHE - SmartSuite Navigation Cache Architecture

**Status:** Proposed
**Date:** 2025-09-20
**Author:** SmartSuite Expert + Critical Engineer
**Reviewers:** Technical Architect, Implementation Lead

## Context

The EAV Orchestrator requires navigation and status display capabilities for projects and videos while maintaining SmartSuite as the source of truth for business data. The current Supabase schema includes full duplication of clients, projects, and team tables which creates unnecessary synchronization complexity.

Based on analysis of:
- Visual demo requirements showing project-based navigation UI
- SmartSuite workspace structure (s3qnmox1) with 9 tables
- Current production patterns with 400-850ms API performance
- V2-V8 workflow requirements (Script → Voice → Scenes → Direction)

## Decision

Implement a **Hybrid Navigation Cache Architecture** that:
1. Maintains SmartSuite as the authoritative source for all business data
2. Caches only navigation-essential fields in Supabase for UI performance
3. Stores collaborative editing data (scripts, comments) exclusively in Supabase
4. Uses SmartSuite record IDs as primary foreign keys throughout

## Architecture

### Data Ownership Model

| Data Type | SmartSuite (Source) | Supabase (Cache/Local) |
|-----------|-------------------|------------------------|
| Client data | ✅ Full ownership | ❌ No storage |
| Project metadata | ✅ Full ownership | 📋 Navigation cache only |
| Video structure | ✅ Full ownership | 📋 Navigation cache only |
| User management | ✅ Full ownership | 🔑 Auth mapping only |
| Script content | ❌ Not stored | ✅ Full ownership (Y.js) |
| Comments | ❌ Not stored | ✅ Full ownership |
| Collaboration | ❌ Not stored | ✅ Full ownership |

### Proposed Supabase Schema

```sql
-- ============================================================================
-- 1. PROJECTS NAVIGATION CACHE
-- ============================================================================
-- Minimal sync from SmartSuite Projects table (68a8ff5237fde0bf797c05b3)
CREATE TABLE projects_cache (
  project_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  smartsuite_id TEXT UNIQUE NOT NULL,           -- SmartSuite record ID

  -- Essential navigation fields from SmartSuite
  eav_code TEXT NOT NULL UNIQUE,                -- "eavcode" field (e.g., "EAV023")
  project_title TEXT NOT NULL,                  -- "title" field
  client_name TEXT,                             -- From "sbfc98645c" linked client
  project_phase TEXT,                           -- "status" field value

  -- SmartSuite workflow status
  mainstream_status TEXT,                       -- "mainstream" field

  -- Local orchestrator status (NOT in SmartSuite)
  orchestrator_status TEXT DEFAULT 'active',
  scripts_count INTEGER DEFAULT 0,
  scripts_complete INTEGER DEFAULT 0,

  -- Sync metadata
  last_sync_at TIMESTAMP DEFAULT NOW(),
  sync_version INTEGER DEFAULT 0
);

-- ============================================================================
-- 2. VIDEOS NAVIGATION CACHE
-- ============================================================================
-- Minimal sync from SmartSuite Videos table (68b2437a8f1755b055e0a124)
CREATE TABLE videos_cache (
  video_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  smartsuite_id TEXT UNIQUE NOT NULL,           -- SmartSuite record ID

  -- Foreign keys
  project_cache_id UUID REFERENCES projects_cache(project_id),
  smartsuite_project_id TEXT NOT NULL,          -- "projects_link" field
  eav_code TEXT NOT NULL,                       -- From project for unique script names

  -- Essential display field from SmartSuite
  video_title TEXT NOT NULL,                    -- "title" field (e.g., "1-Introduction")

  -- Unique script identifier (globally unique)
  script_title TEXT GENERATED ALWAYS AS          -- e.g., "1-Introduction (EAV023)"
    (video_title || ' (' || eav_code || ')') STORED,

  -- SmartSuite status fields
  main_status TEXT,                             -- "main_status" field
  vo_status TEXT,                               -- "vo_status" field

  -- Local orchestrator status (NOT in SmartSuite)
  script_status TEXT DEFAULT 'not_started',
  vo_local_status TEXT DEFAULT 'pending',
  scene_status TEXT DEFAULT 'pending',

  -- Performance cache
  target_duration INTEGER,                      -- "target_duration" field
  actual_word_count INTEGER DEFAULT 0,          -- Updated locally

  -- Sync metadata
  last_sync_at TIMESTAMP DEFAULT NOW(),
  sync_version INTEGER DEFAULT 0
);

-- ============================================================================
-- 3. VIDEO SCRIPTS (LOCAL COLLABORATIVE DATA)
-- ============================================================================
-- Stores only collaborative editing data not in SmartSuite
CREATE TABLE video_scripts (
  script_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_cache_id UUID REFERENCES videos_cache(video_id),
  smartsuite_video_id TEXT UNIQUE NOT NULL,

  -- Y.js collaboration
  yjs_document_room TEXT UNIQUE,
  content_version INTEGER DEFAULT 0,

  -- Local workflow status
  approval_status TEXT DEFAULT 'draft',
  last_edited_by UUID,
  last_edited_at TIMESTAMP,

  -- Quick stats for UI
  word_count INTEGER DEFAULT 0,
  estimated_duration INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- 4. MINIMAL USER MAPPING
-- ============================================================================
CREATE TABLE user_mappings (
  supabase_user_id UUID PRIMARY KEY,
  smartsuite_user_email TEXT UNIQUE,
  role TEXT CHECK (role IN ('admin', 'internal', 'freelancer', 'client', 'viewer')),
  cached_display_name TEXT
);
```

## Implementation Strategy

### Phase 1: Navigation Cache Setup
1. Create cache tables with SmartSuite ID foreign keys
2. Implement initial data load from SmartSuite
3. Build project picker UI component

### Phase 2: Sync Service
```javascript
class NavigationSyncService {
  // Refresh triggers:
  // - On project selection (user-initiated)
  // - Every 5 minutes for active project
  // - On status change webhook from SmartSuite

  async refreshProjectCache(eavCode) {
    // 1. Query SmartSuite Projects (400-600ms)
    const project = await smartsuite.query({
      appId: '68a8ff5237fde0bf797c05b3',
      filters: { eavcode: eavCode },
      limit: 1
    });

    // 2. Extract only navigation fields
    await supabase.from('projects_cache').upsert({
      smartsuite_id: project.id,
      eav_code: project.eavcode,
      project_title: project.title,
      client_name: project.sbfc98645c?.[0]?.title,
      project_phase: project.status,
      mainstream_status: project.mainstream
    });

    // 3. Fetch associated videos
    const videos = await smartsuite.query({
      appId: '68b2437a8f1755b055e0a124',
      filters: { projects_link: project.id },
      limit: 100 // All videos for project
    });

    // 4. Update video cache - simplified to use title directly
    await supabase.from('videos_cache').upsert(
      videos.map(v => ({
        smartsuite_id: v.id,
        smartsuite_project_id: project.id,
        eav_code: project.eavcode,
        video_title: v.title,  // Direct from SmartSuite (e.g., "1-Introduction")
        main_status: v.main_status,
        vo_status: v.vo_status,
        target_duration: v.target_duration
      }))
    );
  }
}
```

### Phase 3: Bidirectional Status Updates
- Read: SmartSuite → Supabase cache (navigation/display)
- Write: Supabase → SmartSuite (status updates only)
- Collaborative data stays in Supabase only

## Performance Characteristics

| Operation | Performance | Acceptable? |
|-----------|------------|-------------|
| Project list load | 400-600ms | ✅ Yes (navigation) |
| Video list refresh | 400-600ms | ✅ Yes (navigation) |
| Script editor open | <200ms | ✅ Yes (cached) |
| Comment sync | <200ms | ✅ Yes (Y.js local) |
| Status update | 400-700ms | ✅ Yes (async) |

## Benefits

1. **Eliminates 70% sync complexity** by not duplicating full tables
2. **Maintains data integrity** with SmartSuite as single source of truth
3. **Optimizes performance** with local caching for navigation
4. **Preserves collaboration speed** with Y.js local operations
5. **Reduces maintenance** by avoiding complex reconciliation logic
6. **Simplifies data model** by using SmartSuite's pre-formatted title field directly
7. **Ensures global uniqueness** with script_title combining video title and EAV code

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Cache staleness | 5-minute refresh + user-triggered refresh |
| SmartSuite API downtime | Local cache continues working for reads |
| Field changes in SmartSuite | Version tracking and migration scripts |
| Performance degradation | Background refresh, not blocking UI |

## Alternatives Considered

1. **Full Table Duplication** (REJECTED)
   - Would require complex bidirectional sync
   - High risk of data inconsistency
   - 60-80% more code to maintain

2. **No Local Cache** (REJECTED)
   - Every navigation would take 400-600ms
   - Poor user experience
   - Excessive API calls

3. **GraphQL Federation** (REJECTED)
   - Over-engineering for 10-20 users
   - Added infrastructure complexity
   - Not supported by SmartSuite

## SmartSuite Field Mappings Reference

### Projects Table (68a8ff5237fde0bf797c05b3)
- `id` → `smartsuite_id`
- `eavcode` → `eav_code` (formula field, e.g., "EAV023")
- `title` → `project_title`
- `sbfc98645c` → `client` (linked record to Clients)
- `status` → `project_phase`
- `mainstream` → `mainstream_status`

### Videos Table (68b2437a8f1755b055e0a124)
- `id` → `smartsuite_id`
- `title` → `video_title` (recordtitlefield, e.g., "1-Introduction")
- `projects_link` → `smartsuite_project_id` (linked record)
- `main_status` → `main_status` (status field)
- `vo_status` → `vo_status` (status field)
- `target_duration` → `target_duration` (number field)

Note: The `title` field in SmartSuite already contains the complete formatted name (e.g., "1-Introduction"),
eliminating the need to store and reconstruct from separate `video_seq01` and `video_name` fields.

## Decision Outcome

**APPROVED** - Implement Hybrid Navigation Cache Architecture with:
- Minimal field caching for navigation
- SmartSuite as authoritative source
- Local storage for collaborative features only
- 5-minute refresh cycle for active projects

## References

- SmartSuite API Documentation (246 pages)
- EAV Workspace Structure (s3qnmox1)
- Visual Demo Requirements (/Volumes/EAV/new-system/eav-visual-demo.html)
- Current Migration 011_smartsuite_alignment.sql