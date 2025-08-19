# ADR-001: Project Directory Structure

**Status:** Accepted  
**Date:** 2025-08-19  
**Decision Makers:** System Steward, Project Setup

## Context

EAV Orchestrator project needed proper directory structure following HestAI organizational standards to separate project state management (Bridge) from implementation artifacts (Truth) and enable clean Git repository boundaries.

## Decision

Implement the two-repository separation pattern as defined in `/Volumes/HestAI-New/docs/workflow/005-WORKFLOW-DIRECTORY-STRUCTURE.md`:

```
/Volumes/HestAI-Projects/eav-orchestrator/
├── docs/                          # BRIDGE - project state index only
│   └── 201-PROJECT-EAV-D1-CONTEXT.md
├── build/                         # TRUTH - Git repository root
│   ├── src/                       # Source code
│   ├── tests/                     # Test suites
│   ├── docs/                      # Implementation artifacts
│   │   ├── 201-PROJECT-EAV-B1-IMPLEMENTATION-LOG.md
│   │   ├── 201-PROJECT-EAV-B1-BUILD-PLAN.md
│   │   └── adr/                   # Architectural Decision Records
│   ├── README.md                  # Project overview
│   └── CLAUDE.md                  # Development instructions
└── sessions/                      # Project conversations
```

## Rationale

### Benefits
- **Clear Separation:** Bridge docs serve as navigation index only, Truth docs contain all substantial content
- **Git Simplicity:** Clean repository boundary in build/ directory eliminates nesting confusion
- **Scalable Structure:** Easy to add new projects following same pattern
- **Session Locality:** Project conversations isolated from organizational sessions

### Addresses Organizational Problems
- **Eliminates 4+ levels of nesting** to reach actual work
- **Prevents dual truth sources** through Bridge/Truth boundary enforcement  
- **Separates project concerns** from organizational standards
- **Enables clean Git workflows** with single repository per project

## Consequences

### Positive
- Maximum 3 levels to reach code/documentation
- Clear boundary between index and content
- Project sessions isolated from organizational sessions
- Clean repository boundaries for development workflow

### Negative
- Requires discipline to maintain Bridge/Truth separation
- Links between Bridge and Truth docs must be maintained
- Migration needed from legacy builds/ structure

## Alternatives Considered

1. **Single directory with mixed content** - Rejected: Creates dual truth sources
2. **Nested repository structure** - Rejected: Too many nesting levels
3. **Flat structure without separation** - Rejected: Mixes project state with implementation

## Implementation

### Completed
- ✅ Directory structure created
- ✅ Git repository initialized in build/
- ✅ Bridge document created with proper naming
- ✅ Truth documents structure established
- ✅ ADR framework setup

### Next Steps
- Set up sessions/ directory for project conversations
- Create README.md and CLAUDE.md in build/
- Validate structure against organizational standards

---

**References:**
- [Workflow Directory Structure](/Volumes/HestAI-New/docs/workflow/005-WORKFLOW-DIRECTORY-STRUCTURE.md)
- [HestAI Naming Conventions](docs/guides/HESTAI_NAMING_CONVENTIONS.md)

**Related ADRs:** None (first ADR)