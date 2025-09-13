#!/bin/bash
#
# EAV Orchestrator - Post-Session Start Hook
#
# This hook automatically packs the entire codebase using the Repomix MCP server
# and saves the resulting outputId for the AI to use throughout the session.

set -e

echo "🚀 Post-session hook initiated: Packing codebase..."

# Ensure directories exist
mkdir -p .coord
mkdir -p .claude

# Define a predictable location for session variables
# MUST be in .claude (local) not .coord (shared) to prevent session bleeding
SESSION_VARS_FILE=".claude/session.vars"
touch "$SESSION_VARS_FILE"

# Note: Since we're in a hook, we can't directly call MCP tools
# Instead, we'll save the current MCP output ID if available
# The AI will need to pack on first use if not present

# Check if we already have an output ID from current session
if [ -f ".claude/last-pack-id.txt" ]; then
    OUTPUT_ID=$(cat .claude/last-pack-id.txt)
    echo "REPOMIX_OUTPUT_ID=${OUTPUT_ID}" > "$SESSION_VARS_FILE"
    echo "✅ Using existing packed codebase. Output ID: ${OUTPUT_ID}"
else
    # Create placeholder for AI to detect and pack
    echo "# Session variables - Repomix output ID will be saved here" > "$SESSION_VARS_FILE"
    echo "REPOMIX_OUTPUT_ID=" >> "$SESSION_VARS_FILE"
    echo "⚠️  No packed codebase found. AI will pack on first task."
fi

# Save session start time for reference
echo "SESSION_START=$(date -Iseconds)" >> "$SESSION_VARS_FILE"

# Get current git context for session
echo "GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo 'not-in-git')" >> "$SESSION_VARS_FILE"
echo "LAST_COMMIT=$(git log -1 --oneline 2>/dev/null || echo 'no-commits')" >> "$SESSION_VARS_FILE"

echo "✅ Session variables saved to ${SESSION_VARS_FILE}"
cat "$SESSION_VARS_FILE"