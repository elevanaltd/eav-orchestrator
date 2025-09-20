#!/bin/bash
# SECURITY-SPECIALIST-APPROVED: SECURITY-SPECIALIST-20250917-e6beadd6
# Production Migration via Official CLI Authentication

echo "🚀 EAV Orchestrator - Production Database Migration"
echo "=================================================="
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "⚠️  Supabase CLI not found. Installing..."
    npm install -g supabase
fi

echo "📋 Migration Steps:"
echo "1. Authenticate with Supabase"
echo "2. Link to production project"
echo "3. Create backup"
echo "4. Validate migrations (dry run)"
echo "5. Apply migrations"
echo "6. Verify completion"
echo ""

# Step 1: Authenticate
echo "🔐 Step 1: Authenticating with Supabase..."
echo "   You'll be prompted to log in via browser"
npx supabase login

# Step 2: Link to production
echo ""
echo "🔗 Step 2: Linking to production project..."
npx supabase link --project-ref tsizhlsbmwytqccjavap

# Step 3: Create backup
echo ""
echo "💾 Step 3: Creating database backup..."
BACKUP_FILE="backup-$(date +%Y%m%d-%H%M%S).sql"
npx supabase db dump --data-only > "$BACKUP_FILE"
echo "   Backup saved to: $BACKUP_FILE"

# Step 4: Dry run
echo ""
echo "🔍 Step 4: Validating migrations (dry run)..."
npx supabase db push --dry-run

echo ""
read -p "Review the dry run output above. Proceed with actual migration? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Step 5: Apply migrations
    echo ""
    echo "🚀 Step 5: Applying migrations to production..."
    npx supabase db push

    # Step 6: Verify
    echo ""
    echo "✅ Step 6: Verifying migrations..."
    npx supabase migration list

    echo ""
    echo "🎉 Migration complete! Please verify in Supabase dashboard:"
    echo "   https://supabase.com/dashboard/project/tsizhlsbmwytqccjavap/database/tables"
else
    echo ""
    echo "❌ Migration cancelled. No changes were made to production."
    echo "   Backup file retained: $BACKUP_FILE"
fi