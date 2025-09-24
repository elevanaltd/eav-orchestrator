# Actual Permission Requirements - Visual Architect Analysis

## Real Business Needs (Not Assumptions!)

### Internal Team Access
- **Who**: Admin, Internal, Freelancer roles
- **What**: Full access to ALL projects and features
- **How**: Global role in user_profiles
- **No need for**: Per-project permissions (they see everything)

### Client Access
- **Who**: Clients reviewing scripts
- **What**: ONLY the specific scripts they're reviewing
- **Not**: Voice tab, Scenes tab, Direction tab, other projects
- **How**: Separate review interface or tokenized links
- **No need for**: Client logins in main app

## Current Over-Engineering

```
CURRENT (Too Complex):
┌──────────────┐     ┌──────────────┐     ┌─────────────────┐
│ auth.users   │────▶│user_profiles │────▶│project_members  │ ← WHY?!
└──────────────┘     └──────────────┘     └─────────────────┘
                            │                      │
                            ▼                      ▼
                     Global Role            Project Role
                     (admin, etc)           (duplicate!)
```

## Simplified Architecture

```
SIMPLIFIED (What We Actually Need):
┌──────────────┐     ┌──────────────┐
│ auth.users   │────▶│user_profiles │
└──────────────┘     └──────────────┘
                            │
                            ▼
                     Global Role Only
                     (admin/internal/freelancer)

                     Client Review:
                     ┌──────────────┐
                     │Script Review │ ← Separate Interface
                     │  (tokenized) │ ← No login required
                     └──────────────┘
```

## Client Review Options

### Option 1: Magic Links (Recommended)
```
1. Generate signed URL with script ID + expiry
2. Client clicks link → sees ONLY that script
3. No login, no user account needed
4. Can comment/approve through the link
```

### Option 2: Minimal Client Portal
```
1. Separate subdomain (review.eav.com)
2. Very restricted interface
3. Only shows assigned scripts
4. No access to main app
```

### Option 3: View-Only Tokens
```
1. Generate view tokens in script_reviews table
2. Token-based access (no auth.users entry)
3. Track approvals without user accounts
```

## RLS Simplification

Instead of:
```sql
-- Complex check through project_members
FUNCTION is_project_editor(project_id)
  SELECT FROM project_members WHERE user_id = auth.uid()...
```

We need:
```sql
-- Simple check on user_profiles
FUNCTION can_edit_content()
  SELECT role IN ('admin', 'internal', 'freelancer')
  FROM user_profiles
  WHERE user_id = auth.uid()
```

## Benefits of Simplification

1. **No project_members table** - Not needed!
2. **No team_members table** - Redundant!
3. **Simpler RLS** - Just check global role
4. **Client isolation** - Separate review system
5. **Less maintenance** - 2 tables instead of 4

## Migration Path

1. Drop project_members completely
2. Drop team_members completely
3. Rewrite RLS functions to use user_profiles
4. Create separate client_review table for script reviews
5. Build tokenized review interface

---

**Visual Architect Verdict**: We're over-engineering! Internal users need global access, clients need isolated review. Two different systems, not one complex permission matrix.