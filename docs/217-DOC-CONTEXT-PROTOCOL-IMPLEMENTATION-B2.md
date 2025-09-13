# Proactive Context-Gathering Protocol Implementation Guide

## Overview
This guide enables AI agents to maintain holistic codebase awareness through proactive context gathering, transforming the workflow from "go find context" to "here is the context."

## Prerequisites
- Repomix MCP server installed and configured (automatic)
- Git repository initialized
- Access to `.claude/` and project directories

## Implementation Steps

### Step 1: Add Protocol to CLAUDE.md

Add this section to your project's `CLAUDE.md` file:

```markdown
## Proactive Context-Gathering Protocol

**MANDATORY: Your first action for any new task is to prepare the context.** Do not begin analysis or coding until you have completed this protocol.

### Phase 1: Context Initialization
1. **Verify Codebase is Packed:** Check for the existence of a Repomix `outputId` from the current session. This ID is stored in `.claude/session.vars`. If it doesn't exist, you must run `mcp__repomix__pack_codebase` first and save the new ID.

2. **Analyze the Task:** Read the user's request and extract 2-4 key nouns, function names, or concepts (e.g., "CustomSupabaseProvider", "circuitBreaker", "database migration").

3. **Search the Codebase:** Use `mcp__repomix__grep_repomix_output` for each keyword you identified. Use a context of 3-5 lines to understand the surrounding code.

4. **Cross-Reference Checks:** ALWAYS perform these additional searches:
   - **Dependency Check:** Search for imports/requires in found files
   - **Pattern Check:** Search for common patterns (cache, retry, auth, validation, circuit, provider, manager)
   - **Impact Radius:** Search for files that import the one being modified
   - **Architecture Check:** Grep for architectural patterns mentioned in README/CLAUDE.md

5. **Present Your Findings:** Synthesize the results into a brief summary. Start your response with: **"I have prepared the context. Here is what I found relevant to your request:"**
   - List the key files that appeared in the search
   - Show 1-2 of the most relevant code snippets from your search
   - Identify any existing patterns that relate to the task
   - State that you are now ready to proceed with the task

### Phase 2: Precedent Search Protocol

**Before implementing ANY new pattern** (caching, error handling, retry logic, authentication, etc.):

1. **Search for existing implementations:** Use `mcp__repomix__grep_repomix_output(outputId, "pattern_name")` to find existing examples
2. **If found:** Follow the existing pattern for consistency
3. **If not found:** Check architectural docs (README.md, CLAUDE.md, ADR files) for guidance
4. **Only create new pattern** after confirming no precedent exists and documenting why

### Phase 3: Impact Analysis

**Before making changes:**

1. **Identify dependencies:** What calls this code? What does this code call?
2. **Check test coverage:** Search for existing tests of the code being modified
3. **Verify architectural fit:** Does this change align with system patterns?
4. **Consider side effects:** What else might be affected by this change?
```

### Step 2: Create Session Hook (Optional but Recommended)

#### 2a. Create the Hook Script
Create `.claude/hooks/post-session-start.sh`:

```bash
#!/bin/bash
#
# Post-Session Start Hook
# Prepares session variables for context protocol

set -e

echo "🚀 Post-session hook initiated: Preparing session..."

# Ensure directories exist
mkdir -p .claude

# Define session variables location
# IMPORTANT: Use .claude (local) not .coord (shared) to prevent session bleeding
# Note: This only provides isolation with git worktrees. Same repo = shared session.
SESSION_VARS_FILE=".claude/session.vars"
touch "$SESSION_VARS_FILE"

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

# Save session context
echo "SESSION_START=$(date -Iseconds)" >> "$SESSION_VARS_FILE"
echo "GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo 'not-in-git')" >> "$SESSION_VARS_FILE"
echo "LAST_COMMIT=$(git log -1 --oneline 2>/dev/null || echo 'no-commits')" >> "$SESSION_VARS_FILE"

echo "✅ Session variables saved to ${SESSION_VARS_FILE}"
cat "$SESSION_VARS_FILE"
```

Make it executable:
```bash
chmod +x .claude/hooks/post-session-start.sh
```

#### 2b. Register the Hook in Settings (CRITICAL)
**⚠️ IMPORTANT: Hooks will NOT execute unless registered in settings!**

Create `.claude/settings.local.json`:
```json
{
  "hooks": {
    "PostSessionStart": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "/absolute/path/to/project/.claude/hooks/post-session-start.sh"
          }
        ]
      }
    ]
  }
}
```

**Note:** The command path MUST be absolute, not relative. Replace `/absolute/path/to/project` with your actual project path.

### Step 3: Create Context Preparation Script (Optional Enhancement)

Create `scripts/prepare-context.sh`:

```bash
#!/bin/bash
#
# Context Preparation Script - Manual context preparation helper
# Usage: ./scripts/prepare-context.sh "task description"

set -e

TASK="${1:-general}"
OUTPUT_FILE=".claude/current-context.md"

# Ensure .claude directory exists
mkdir -p .claude

echo "🔍 Preparing context for: $TASK"

# Extract keywords from task
KEYWORDS=$(echo "$TASK" | tr '[:upper:]' '[:lower:]' | grep -oE '[a-z]+' | sort -u | head -5)

echo "📋 Task Context Summary" > "$OUTPUT_FILE"
echo "======================" >> "$OUTPUT_FILE"
echo "Task: $TASK" >> "$OUTPUT_FILE"
echo "Keywords: $KEYWORDS" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Get recent git activity
echo "## Recent Activity" >> "$OUTPUT_FILE"
git log --oneline -5 >> "$OUTPUT_FILE" 2>/dev/null || echo "No git history" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "## Changed Files (Last 10 commits)" >> "$OUTPUT_FILE"
git diff --name-only HEAD~10 2>/dev/null | head -20 >> "$OUTPUT_FILE" || echo "No recent changes" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "## Current Branch" >> "$OUTPUT_FILE"
git branch --show-current >> "$OUTPUT_FILE" 2>/dev/null || echo "Not in git repo" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# If we have an MCP output ID saved, add search hints
if [ -f ".claude/last-pack-id.txt" ]; then
    OUTPUT_ID=$(cat .claude/last-pack-id.txt)
    echo "## Relevant Code Sections" >> "$OUTPUT_FILE"
    echo "Output ID: $OUTPUT_ID" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    
    # For each keyword, add a search hint
    for keyword in $KEYWORDS; do
        echo "- Search for '$keyword' using: grep_repomix_output(\"$OUTPUT_ID\", \"$keyword\")" >> "$OUTPUT_FILE"
    done
    
    echo "" >> "$OUTPUT_FILE"
    echo "## Cross-Reference Patterns (Check for existing implementations)" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    
    # Add common patterns to check for precedent
    for pattern in "cache" "retry" "auth" "circuit" "provider" "manager" "validation" "error" "resilience"; do
        echo "- Pattern '$pattern': grep_repomix_output(\"$OUTPUT_ID\", \"$pattern\")" >> "$OUTPUT_FILE"
    done
    
    echo "" >> "$OUTPUT_FILE"
    echo "## Architecture Patterns to Consider" >> "$OUTPUT_FILE"
    echo "- Database patterns: grep_repomix_output(\"$OUTPUT_ID\", \"supabase|database|sql\")" >> "$OUTPUT_FILE"
    echo "- Testing patterns: grep_repomix_output(\"$OUTPUT_ID\", \"test|spec|mock\")" >> "$OUTPUT_FILE"
    echo "- Component patterns: grep_repomix_output(\"$OUTPUT_ID\", \"component|tsx|props\")" >> "$OUTPUT_FILE"
elif [ -f ".claude/session.vars" ]; then
    # Try to get from session vars (local to this agent)
    source .claude/session.vars
    if [ -n "$REPOMIX_OUTPUT_ID" ]; then
        echo "## Relevant Code Sections" >> "$OUTPUT_FILE"
        echo "Output ID: $REPOMIX_OUTPUT_ID" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        echo "Use mcp__repomix__grep_repomix_output to search the packed codebase." >> "$OUTPUT_FILE"
    fi
fi

echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "Context prepared at: $(date)" >> "$OUTPUT_FILE"

echo "✅ Context prepared at: $OUTPUT_FILE"
cat "$OUTPUT_FILE"
```

## How It Works

### First Task in New Session

1. User provides task: "Fix the authentication bug"
2. AI checks `.claude/session.vars` → No outputId found
3. AI runs `mcp__repomix__pack_codebase`:
   ```javascript
   const result = await pack_codebase({
     directory: process.cwd(),
     includePatterns: "src/**/*.ts,src/**/*.tsx,tests/**/*.test.ts"
   });
   const outputId = result.outputId;
   ```
4. AI saves outputId to `.claude/session.vars`:
   ```bash
   # Save the outputId for session persistence
   echo "REPOMIX_OUTPUT_ID=${outputId}" > .claude/session.vars
   echo "${outputId}" > .claude/last-pack-id.txt
   ```
5. AI searches for "authentication", "bug", "auth"
6. AI presents findings: "I have prepared the context. Here's what I found..."

### Subsequent Tasks in Same Session

1. User provides new task
2. AI checks `.claude/session.vars` → Finds existing outputId
3. AI uses existing pack for searches
4. No re-packing needed (saves ~3k tokens)

## Session Management Considerations

### ⚠️ CRITICAL LIMITATION
**Without git worktrees, all agents in the same repository share `.claude/session.vars`.**
This means:
- Agents can overwrite each other's sessions
- Last agent to pack "wins" 
- For true parallel work, worktrees are REQUIRED
- Consider this when running multiple agents simultaneously

### Single Repository Work
- All agents in the same repository share `.claude/session.vars`
- Last agent to pack overwrites the outputId
- Generally acceptable as they're working on the same codebase
- MCP outputs are ephemeral - expect re-packing after restarts

### Parallel Work (Recommended: Git Worktrees)
```bash
# Create isolated worktree for parallel work
git worktree add ../project-feature-x feature-branch

# Each worktree has its own .claude/session.vars
/main-repo/.claude/session.vars          → Agent 1
/project-feature-x/.claude/session.vars  → Agent 2
```

### After MCP Server Restart
- All temp MCP outputs are cleared
- Every agent must re-pack (~3k token cost)
- This is unavoidable but handled gracefully by the protocol

## Troubleshooting

### "Output file not found" Error
**Cause:** MCP output expired or MCP server restarted
**Solution:** Protocol automatically re-packs. This is expected behavior.

### Session Collision
**Symptom:** Agents overwriting each other's session.vars
**Solution:** Use git worktrees for true isolation, or coordinate single-agent work

### High Token Usage
**Cause:** Frequent re-packing
**Solution:** 
- Work within single MCP session when possible
- Accept ~3k token cost per session as normal overhead
- Use more specific includePatterns to reduce pack size

## Quick Test

To verify the protocol is working:

1. Start a new session
2. Ask: "Can you check what authentication methods are used in this codebase?"
3. The AI should:
   - Check `.claude/session.vars`
   - Pack the codebase if needed
   - Search for "authentication", "auth", "login"
   - Present findings with "I have prepared the context..."

## Key Benefits

- **Proactive Context:** AI prepares context before starting work
- **Pattern Consistency:** Always finds and follows existing patterns
- **System Coherence:** Changes fit the architectural whole
- **Token Efficiency:** Reuses packed context within sessions
- **Graceful Degradation:** Handles expired outputs automatically

## Current Implementation Status in EAV Orchestrator

### ✅ Fully Implemented
- **CLAUDE.md** updated with complete protocol text (includes manual hook execution)
- **Hook created** at `.claude/hooks/post-session-start.sh` (executable)
- **Settings file** at `.claude/settings.local.json` (hook registration)
- **Context script** at `scripts/prepare-context.sh` with passing tests
- **Session vars** correctly located in `.claude/` directory
- **MCP Repomix** server installed and configured

### 📍 File Locations
```
build/
├── CLAUDE.md                                    # ✅ Protocol added
├── .claude/
│   ├── hooks/
│   │   └── post-session-start.sh              # ✅ Hook implemented
│   ├── settings.local.json                    # ✅ Hook registration
│   ├── session.vars                           # ✅ Auto-created by hook
│   └── last-pack-id.txt                       # ✅ Stores outputId
├── scripts/
│   └── prepare-context.sh                     # ✅ Helper script
├── tests/scripts/
│   └── prepare-context.test.sh                # ✅ Tests passing
└── docs/
    └── 217-DOC-CONTEXT-PROTOCOL-IMPLEMENTATION-B2.md  # This document
```

## Notes

- MCP outputs are stored in temp directories and don't persist across restarts
- Each MCP server restart requires re-packing (unavoidable)
- The protocol adds ~3-5k tokens overhead per session (acceptable cost)
- For production use, consider git worktrees for parallel development
- Session isolation only works with filesystem isolation (worktrees)

---

*This protocol transforms AI agents from reactive searchers to proactive context gatherers, ensuring holistic codebase awareness and architectural coherence.*

**Implementation Date:** 2025-09-13  
**Status:** Production Ready