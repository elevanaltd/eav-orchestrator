# User Management Table Analysis - Visual Architect Report

## Current State: A Confusing Mess 🔴

### The Four Tables (Why?!)

```
┌─────────────────────────────────────────────────────────────┐
│                     CURRENT MESS                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  auth.users (Supabase)                                       │
│  ├── id (UUID)                                               │
│  ├── email                                                   │
│  └── [Supabase managed]                                      │
│       ↓                                                      │
│       ↓ (No automatic sync!)                                 │
│       ↓                                                      │
│  user_profiles                                               │
│  ├── user_id → auth.users                                    │
│  ├── name, email                                             │
│  └── role (admin/internal/freelancer/client/viewer)         │
│                                                               │
│  team_members (EMPTY - Why does this exist?)                 │
│  ├── member_id (different from user_id!)                     │
│  ├── user_id → auth.users                                    │
│  ├── display_name, email (duplicate!)                        │
│  ├── phone, job_title, department                            │
│  ├── bio, profile_image_url                                  │
│  ├── timezone, preferences, skills                           │
│  └── availability_status                                     │
│                                                               │
│  project_members (EMPTY - Required for RLS!)                 │
│  ├── project_id                                              │
│  ├── user_id → auth.users                                    │
│  ├── role_name (duplicate of user_profiles.role!)           │
│  └── status (active/inactive/removed)                        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## The Problems

1. **No Auto-Provisioning**: New users in auth.users don't automatically get profiles
2. **Duplicate Role Storage**: Both user_profiles and project_members have roles
3. **Redundant Tables**: team_members duplicates user_profiles functionality
4. **Empty Critical Tables**: project_members is required for RLS but never populated
5. **No Single Source of Truth**: User data scattered across 4 tables

## Proposed Solution: Simplify! ✅

```
┌─────────────────────────────────────────────────────────────┐
│                    SIMPLIFIED DESIGN                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  auth.users (Supabase)                                       │
│  ├── id                                                      │
│  └── email                                                   │
│       ↓                                                      │
│       ↓ (AUTO TRIGGER on insert!)                           │
│       ↓                                                      │
│  user_profiles (Single source of truth)                      │
│  ├── user_id → auth.users                                    │
│  ├── display_name                                            │
│  ├── email                                                   │
│  ├── global_role (admin/internal/freelancer/client/viewer)  │
│  ├── avatar_url                                              │
│  ├── preferences (JSONB)                                     │
│  └── created_at, updated_at                                  │
│       ↓                                                      │
│       ↓ (AUTO TRIGGER on user_profiles insert!)             │
│       ↓                                                      │
│  project_members (Auto-populated for default project)        │
│  ├── project_id                                              │
│  ├── user_id → auth.users                                    │
│  ├── project_role (can override global_role)                │
│  └── status                                                  │
│                                                               │
│  ❌ DELETE team_members (redundant)                          │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Auto-Provisioning
```sql
-- Trigger to create user_profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_profile();

-- Function creates profile AND adds to default project
CREATE FUNCTION create_user_profile()
  ...creates profile
  ...adds to project_members for default project
```

### Phase 2: Data Migration
1. Migrate any data from team_members → user_profiles
2. Drop team_members table
3. Ensure all existing users have project_members entries

### Phase 3: RLS Simplification
- user_profiles: Users see own, admins see all
- project_members: Check for project-specific permissions
- No more missing permissions!

## Benefits

1. **Auto-Provisioning**: New users automatically work
2. **Single Source of Truth**: user_profiles for user data
3. **Project Flexibility**: project_members for per-project roles
4. **RLS Works**: No more permission errors
5. **Less Complexity**: 3 tables instead of 4

## Visual Flow

```
User Signs Up
     ↓
auth.users row created
     ↓
[TRIGGER] create_user_profile()
     ↓
user_profiles row created
     ↓
[TRIGGER] add_to_default_project()
     ↓
project_members row created
     ↓
✅ User can immediately use the app!
```

---

**Visual Architect Assessment**: The current 4-table design is overcomplicated and broken. We need to simplify to 3 tables with proper auto-provisioning.
