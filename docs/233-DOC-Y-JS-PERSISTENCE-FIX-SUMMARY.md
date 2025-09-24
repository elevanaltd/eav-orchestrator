# Y.js Persistence Fix Summary

## Problem
Data was not persisting to Supabase - all content disappeared on page refresh.

## Root Causes Identified

### 1. Data Type Mismatch
- **Issue**: The PostgreSQL function `append_yjs_update` expected `bytea` type
- **JavaScript sent**: `Array.from(updateData)` which became an integer array `[1, 2, 3...]`
- **PostgreSQL expected**: Hex string like `\x0102030405` for bytea columns

### 2. Missing Document Creation
- **Issue**: The yjs_documents table entry wasn't being created when a new document started
- **Result**: Updates failed because there was no parent document record

### 3. Function Signature Mismatch
- **Issue**: The append_yjs_update function couldn't handle JavaScript's data format
- **Result**: RPC calls failed silently or with cryptic errors

## Solution Implemented

### 1. Fixed Data Type Conversion
```typescript
// Before - sending integer array
const { data, error } = await this.supabaseClient.rpc('append_yjs_update', {
  p_update_data: Array.from(updateData), // [1, 2, 3...]
  p_new_state_vector: Array.from(stateVector)
});

// After - sending hex string
const updateHex = '\\x' + Array.from(updateData)
  .map(byte => byte.toString(16).padStart(2, '0'))
  .join('');
const { data, error } = await this.supabaseClient.rpc('append_yjs_update', {
  p_update_data: updateHex, // '\x010203...'
  p_new_state_vector: stateVectorHex
});
```

### 2. Added Document Creation on First Save
```typescript
if (!docData) {
  // Create the document entry
  const { error: createError } = await this.supabaseClient
    .from(this.tableName)
    .insert({
      id: this.documentId,
      project_id: this.projectId,
      state_vector: new Uint8Array(),
      version: 1,
      update_count: 0,
      last_edited_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
}
```

### 3. Created Database Migration
Created new migration `20250924045047_fix_yjs_bytea_handling.sql` that:
- Changed function parameters from `bytea` to `text` to accept hex strings
- Added conversion logic: `decode(substring(p_update_data from 3), 'hex')`
- Preserved all existing functionality including optimistic locking

## Files Modified

1. **src/lib/collaboration/custom-supabase-provider.ts**
   - Fixed data type conversion in `persistUpdateOperation()`
   - Added document creation in `loadInitialStateOperation()`
   - Enhanced logging for debugging

2. **supabase/migrations/20250924045047_fix_yjs_bytea_handling.sql**
   - New migration to fix the append_yjs_update function

## How It Works Now

1. **On First Load**:
   - ScriptEditor creates a Y.js document with the script ID as document ID
   - CustomSupabaseProvider checks if document exists in database
   - If not, creates a new yjs_documents entry
   - Loads any existing updates and applies them to restore content

2. **On Each Edit**:
   - Y.js detects the change and fires an update event
   - Update is converted to hex string format
   - Sent to `append_yjs_update` function via RPC
   - Function stores update in yjs_document_updates table
   - Updates the state vector in yjs_documents table

3. **On Page Refresh**:
   - Provider loads the document from database
   - Fetches all updates since sequence 0
   - Applies updates in order to reconstruct the document state
   - Content is restored exactly as it was

## Testing

To test the fix:
1. Open the app at http://localhost:5174/
2. Login and select a script
3. Type some content in the editor
4. Check browser console for success logs:
   - `[CustomSupabaseProvider] Y.js update detected`
   - `[CustomSupabaseProvider] Successfully persisted update to database`
5. Refresh the page
6. Content should persist and reload

## Debugging

Enhanced logging shows:
- Document creation: `Successfully created document {id}`
- Update persistence: `Successfully persisted update to database`
- Loading updates: `Loading {n} updates from database`
- Errors with details: `Failed to persist Y.js update: {error}`

## Architecture Notes

The system uses:
- **Y.js CRDT**: For conflict-free collaborative editing
- **Incremental updates**: Only changes are sent, not full document
- **Optimistic locking**: Version checking prevents concurrent overwrites
- **Circuit breakers**: Resilience against database failures
- **IndexedDB fallback**: Offline queue for updates when database is unavailable
