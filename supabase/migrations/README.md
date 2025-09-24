# Migration Naming Convention

## ⚠️ IMPORTANT: Use Timestamp Format for New Migrations

### Current Structure
- **`001_production_baseline.sql`** - Initial production database snapshot (source of truth)
- **All subsequent migrations** - Use timestamp format: `YYYYMMDDHHMMSS_description.sql`

### Creating New Migrations

✅ **CORRECT - Use Supabase CLI:**
```bash
npx supabase migration new your_migration_description
```
This automatically generates: `20250922143000_your_migration_description.sql`

❌ **INCORRECT - Manual naming:**
```bash
# Don't create: 002_my_feature.sql
# Don't create: 003_another_fix.sql
```

### Why This Convention?

1. **Prevents conflicts** when multiple developers/agents work simultaneously
2. **Maintains chronological order** automatically
3. **Avoids numbering collisions** (e.g., two people creating "002")
4. **Supabase CLI default** - works seamlessly with tooling

### Current Migrations

| File | Purpose | Status |
|------|---------|--------|
| `001_production_baseline.sql` | Complete database snapshot as of project start | Applied |
| `20250922120000_fix_position_race_condition.sql` | Atomic component creation functions | Applied |

### Migration Workflow

1. Always pull latest changes first: `git pull`
2. Create migration: `npx supabase migration new description_here`
3. Write your SQL in the generated file
4. Test locally: `npx supabase db reset` (recreates from scratch)
5. Push to remote: `npx supabase db push`
6. Commit the migration file to git

### Troubleshooting

If you see "Remote migration versions not found in local migrations directory":
1. Run: `npx supabase migration list` to see the state
2. Pull remote migrations: `npx supabase db pull`
3. If needed, repair: `npx supabase migration repair --status applied [migration_name]`

---
**Convention established:** 2025-09-22
**Reason:** Mixed naming (001 + timestamps) caused sync issues and confusion