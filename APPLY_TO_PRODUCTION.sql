-- ============================================================================
-- PRODUCTION FIX: Apply missing schema changes
-- ============================================================================
-- TO APPLY THIS FIX:
-- 1. Go to: https://supabase.com/dashboard/project/vbcfaegexbygqgsstoig/sql/new
-- 2. Copy and paste this entire SQL script
-- 3. Click "Run" to execute
-- ============================================================================

-- Step 1: Add missing columns to video_scripts table
ALTER TABLE video_scripts
ADD COLUMN IF NOT EXISTS script_status TEXT DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS estimated_duration INTEGER DEFAULT 0;

-- Step 2: Update any NULL values
UPDATE video_scripts
SET
  script_status = COALESCE(script_status, 'draft'),
  word_count = COALESCE(word_count, 0),
  estimated_duration = COALESCE(estimated_duration, 0)
WHERE script_status IS NULL
   OR word_count IS NULL
   OR estimated_duration IS NULL;

-- Step 3: Add index for performance
CREATE INDEX IF NOT EXISTS idx_video_scripts_status
ON video_scripts(script_status);

-- Step 4: Verify the fix worked
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'video_scripts'
  AND column_name IN ('script_status', 'word_count', 'estimated_duration')
ORDER BY ordinal_position;