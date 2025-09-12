#!/bin/bash
set -euo pipefail

# Context Diffing Script for EAV Orchestrator
# Compare current project state with the latest context snapshot

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
CONTEXT_DIR="${PROJECT_ROOT}/.coord/context"

echo "🔍 Comparing current state with latest context snapshot..."

# Find the most recent snapshot
LATEST_SNAPSHOT=$(ls -t "${CONTEXT_DIR}"/*.md 2>/dev/null | head -n 1 || echo "")

if [[ -z "${LATEST_SNAPSHOT}" || ! -f "${LATEST_SNAPSHOT}" ]]; then
    echo "❌ No previous context snapshots found in ${CONTEXT_DIR}"
    echo "💡 Run 'npm run context:compile' to create the first snapshot"
    exit 1
fi

echo "📄 Latest snapshot: $(basename "${LATEST_SNAPSHOT}")"

# Get current git state
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "no-git")
CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "no-commit")

echo "🌿 Current state: ${CURRENT_BRANCH} (${CURRENT_COMMIT})"

# Extract snapshot info from filename
SNAPSHOT_NAME=$(basename "${LATEST_SNAPSHOT}")
if [[ "${SNAPSHOT_NAME}" =~ ([0-9]{8}-[0-9]{6})-(.+)-phase-context\.md ]]; then
    SNAPSHOT_TIMESTAMP="${BASH_REMATCH[1]}"
    SNAPSHOT_BRANCH="${BASH_REMATCH[2]}"
    echo "📸 Snapshot taken: ${SNAPSHOT_TIMESTAMP} on branch ${SNAPSHOT_BRANCH}"
else
    echo "⚠️ Could not parse snapshot metadata from filename"
fi

# Show git changes since snapshot
if git rev-parse --git-dir > /dev/null 2>&1; then
    # Try to extract commit from snapshot content
    SNAPSHOT_COMMIT=$(head -20 "${LATEST_SNAPSHOT}" | grep "^Commit:" | cut -d' ' -f2 || echo "")
    
    if [[ -n "${SNAPSHOT_COMMIT}" && "${SNAPSHOT_COMMIT}" != "${CURRENT_COMMIT}" ]]; then
        echo ""
        echo "🔄 Git changes since snapshot:"
        echo "---"
        git log --oneline "${SNAPSHOT_COMMIT}..HEAD" 2>/dev/null | head -20 || echo "Could not determine git changes"
        echo "---"
        
        # Show file change statistics
        echo ""
        echo "📊 File change summary:"
        git diff --stat "${SNAPSHOT_COMMIT}..HEAD" 2>/dev/null | tail -1 || echo "No stat data available"
    else
        echo "✅ No git changes since latest snapshot"
    fi
else
    echo "⚠️ Not in a git repository - cannot compare commit states"
fi

# Show directory changes
echo ""
echo "📁 Current directory structure:"
find . -type f -not -path './node_modules/*' -not -path './.git/*' -not -path './coverage/*' -not -path './dist/*' | sort | head -20
TOTAL_FILES=$(find . -type f -not -path './node_modules/*' -not -path './.git/*' -not -path './coverage/*' -not -path './dist/*' | wc -l | tr -d ' ')
echo "... (${TOTAL_FILES} files total, showing first 20)"

echo ""
echo "💡 To create a new snapshot: npm run context:compile"
echo "📂 Context directory: ${CONTEXT_DIR}"
