#!/bin/bash
#
# Context Preparation Script - Transforms "go find" into "here is"
#
# Usage: ./scripts/prepare-context.sh "task description"

set -e

TASK="${1:-general}"
OUTPUT_FILE=".claude/current-context.md"

# Ensure .claude directory exists
mkdir -p .claude

echo "= Preparing context for: $TASK"

# Extract keywords from task (simple version)
KEYWORDS=$(echo "$TASK" | tr '[:upper:]' '[:lower:]' | grep -oE '[a-z]+' | sort -u | head -5)

echo "=Ë Task Context Summary" > "$OUTPUT_FILE"
echo "======================" >> "$OUTPUT_FILE"
echo "Task: $TASK" >> "$OUTPUT_FILE"
echo "Keywords: $KEYWORDS" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Get recent git activity for context
echo "## Recent Activity" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
git log --oneline -5 >> "$OUTPUT_FILE" 2>/dev/null || echo "No git history" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "## Changed Files (Last 10 commits)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
git diff --name-only HEAD~10 2>/dev/null | head -20 >> "$OUTPUT_FILE" || echo "No recent changes" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "## Current Branch" >> "$OUTPUT_FILE"
git branch --show-current >> "$OUTPUT_FILE" 2>/dev/null || echo "Not in git repo" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# If we have an MCP output ID saved, add search results
if [ -f ".claude/last-pack-id.txt" ]; then
    OUTPUT_ID=$(cat .claude/last-pack-id.txt)
    echo "## Relevant Code Sections" >> "$OUTPUT_FILE"
    echo "Output ID: $OUTPUT_ID" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    
    # For each keyword, add a search hint
    for keyword in $KEYWORDS; do
        echo "- Search for '$keyword' using: grep_repomix_output(\"$OUTPUT_ID\", \"$keyword\")" >> "$OUTPUT_FILE"
    done
fi

echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "Context prepared at: $(date)" >> "$OUTPUT_FILE"

echo " Context prepared at: $OUTPUT_FILE"
cat "$OUTPUT_FILE"