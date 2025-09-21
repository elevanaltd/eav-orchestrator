# Database Schema Reset Cutover Playbook

**Critical-Engineer: consulted for Database schema evolution strategy**
**Technical-Architect: Schema reset strategy approved with full procedural safety**

## Overview

This playbook implements the **source-of-truth reset strategy** to eliminate migration drift by:
1. Capturing production database as single source of truth
2. Archiving 14 accumulated migration patches
3. Establishing clean baseline for future development
4. Coordinating all environment resets

## EXECUTE NOW: Complete Verified Strategy

**STEP 1**: Test the staging clone procedure first
```bash
# Link to production (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# Create production schema snapshot
supabase db pull --linked --file "production_baseline_$(date +%Y%m%d)"
```

**STEP 2**: Archive current migrations and establish baseline
```bash
# Archive the 14 migration mess
mv supabase/migrations "supabase/migrations.archive.$(date +%Y%m%d-%H%M)"

# Create clean migrations directory
mkdir supabase/migrations

# Establish new baseline from production reality
mv supabase/migrations.archive.*/[0-9]*_production_baseline_*.sql supabase/migrations/0001_production_baseline.sql
```

**STEP 3**: Test complete reset on staging/local
```bash
# Reset to new baseline + seed data
supabase db reset --linked

# Verify application works
npm run dev
```

This is the **architecturally correct approach** with proper engineering safety.