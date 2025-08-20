# 103-DOC-STRUCTURE-AND-NAMING-STANDARDS

**Status:** Active  
**Source:** HestAI Organizational Standards  
**Scope:** EAV Orchestrator Project Documentation  
**Date:** 2025-08-20

## Purpose

This document establishes documentation structure and naming conventions for the EAV Orchestrator project, following HestAI organizational standards while adapting to project-specific needs.

## Naming Convention

### Pattern
```
{CATEGORY}{NN}-{CONTEXT}[-{QUALIFIER}]-{NAME}.{EXT}
```

- **CATEGORY{NN}:** 3-digit numeric taxonomy
- **CONTEXT:** Curated tokens (see below)
- **QUALIFIER:** Optional disambiguation token
- **NAME:** UPPERCASE-WITH-HYPHENS
- **EXT:** `.md` (prose) or `.oct.md` (OCTAVE compressed)

### Category Ranges (EAV Orchestrator)

```
0xx :: SYSTEM_META
      Workflows, principles, north stars, core system design

1xx :: DOCUMENTATION  
      Standards, guides, rules, conventions, processes

2xx :: PROJECT_BUILD
      Plans, workflows, deliverables, implementation artifacts
      REQUIRES phase: D1, D2, D3, B0, B1, B2, B3, B4

3xx :: UI_FRONTEND (Future)
      Components, patterns, guidelines, design systems

4xx :: SECURITY_AUTH (Future)
      Models, policies, controls, authentication systems

5xx :: RUNTIME_OPS (Future)
      Deployment, monitoring, incidents, operations

6xx :: DATA_STORAGE (Future)
      Schemas, migrations, backups, data models

7xx :: INTEGRATION_API (Future)
      Contracts, clients, protocols, external interfaces

8xx :: REPORTS
      Audits, analyses, retrospectives, assessments

9xx :: SCRIPTS_TOOLS (Future)
      Automation, generators, validators, utilities
```

### Context Tokens
**Active:** `DOC`, `SYSTEM`, `PROJECT`, `BUILD`, `REPORT`  
**Reserved:** `SCRIPT`, `AUTH`, `UI`, `RUNTIME`, `DATA`, `SEC`, `OPS`

### Examples
- `000-SYSTEM-NORTH-STAR.oct.md`
- `103-DOC-STRUCTURE-AND-NAMING-STANDARDS.md` (this document)
- `201-PROJECT-EAV-B0-VISION-ANALYSIS.md`
- `801-REPORT-SECURITY-AUDIT.oct.md`

## Directory Structure

### Current Implementation (Code Profile)
```
build/                          # Git repository root
├── src/                        # Source code (TBD)
├── tests/                      # Test suites (TBD)
├── docs/                       # Implementation artifacts
│   ├── adr/                    # Architectural Decision Records
│   ├── 103-DOC-*.md           # Documentation standards
│   └── README.md               # Directory purpose
├── reports/                    # Time-bound analyses
│   └── README.md               # Directory purpose
├── _archive/                   # Retired documents
│   ├── docs/                   # Archived docs
│   ├── reports/                # Archived reports
│   └── adr/                    # Archived ADRs
├── sessions/                   # Raw logs, explorations
├── scripts/                    # Automation tools
├── README.md                   # Project overview
└── CLAUDE.md                   # Development instructions
```

## Placement Rules

### docs/
- Standards, conventions, ADR index, guides
- Maximum depth: 2 levels (e.g., `docs/adr/401-SEC-ENCRYPTION.md`)
- Must follow naming pattern
- Includes minimal README.md stating purpose

### reports/
- Time-bound outputs (audits, analyses, retrospectives)
- Optional ISO date prefix when chronology matters: `YYYY-MM-DD-`
- Examples: `801-REPORT-SECURITY-AUDIT.oct.md`, `2025-08-20-801-REPORT-RETRO.md`

### _archive/
- Retired or superseded documents
- Parallel tree structure preserving original paths
- Required header: Status, Archive date, Original path

### ADRs (docs/adr/)
- Architectural Decision Records
- Pattern: `{CATEGORY}{NN}-{CONTEXT}-{NAME}.md`
- Example: `401-SEC-ENCRYPTION-AT-REST.md`

## Forbidden Patterns
- Version suffixes: `_v01`, `-final`, `-latest`
- Phase encoding in names: `B2_01-setup.md`
- Deep nesting: >2 levels under docs/
- Parallel drafts: multiple numbered files for same standard
- Ambiguous names: `000-NORTH-STAR.md` (missing context)

## OCTAVE Compression Guidelines

### Compress When:
- Token reduction >3:1 achievable
- Content stability (finalized, not actively edited)
- High cross-reference density
- Pattern content (roles, workflows, protocols)
- Canonical reference preservation need

### Keep Prose When:
- Frequently edited
- Simple linear content
- User-facing guides
- External consumption

## Archive Process

### Superseding Workflow:
1. Update canonical document with new content
2. Move prior version to `_archive/<same-relative-path>`
3. Add required archive header to archived file
4. Update links in other documents to new canonical
5. Optional: Create temporary pointer stub (remove within 2 releases)

### Required Archive Header:
```
Status: Archived → superseded by <relative-link-to-successor>
Archived: <YYYY-MM-DD>
Original-Path: <original relative path>
```

## Project Phase Requirements

**PROJECT context documents MUST include workflow phase:**

Pattern: `{NN}-PROJECT[-{NAME}]-{PHASE}-{NAME}.md`

Valid phases: `D1`, `D2`, `D3`, `B0`, `B1`, `B2`, `B3`, `B4`

Examples:
- `201-PROJECT-EAV-D1-NORTH-STAR.md`
- `202-PROJECT-EAV-B0-VISION-ANALYSIS.md`
- `203-PROJECT-EAV-B2-IMPLEMENTATION-LOG.md`

## Enforcement

### Validation Points:
- Pre-commit hooks validate naming patterns
- CI pipeline checks directory structure
- Depth limits enforced (max 2 levels under docs/)
- Archive integrity validated
- Anti-proliferation checks prevent parallel drafts

### Quality Gates:
- All documentation must follow naming convention
- ADRs must be under `docs/adr/`
- No version suffixes in filenames
- Archive headers required for archived content

## Future Categories

**Prepared for expansion:** As EAV Orchestrator grows, additional categories are pre-allocated:

- **3xx UI_FRONTEND:** When React/frontend work begins
- **4xx SECURITY_AUTH:** For authentication/authorization documentation
- **5xx RUNTIME_OPS:** For deployment and operations guides
- **6xx DATA_STORAGE:** For database and storage documentation
- **7xx INTEGRATION_API:** For external API documentation
- **9xx SCRIPTS_TOOLS:** For automation and tooling

## References

- **Source Standard:** `/Volumes/HestAI/docs/standards/101-DOC-STRUCTURE-AND-NAMING-STANDARDS.md`
- **North Star:** `/Volumes/HestAI/docs/standards/100-DOC-NORTH-STAR.oct.md`
- **Archival Rules:** `/Volumes/HestAI/docs/standards/102-DOC-ARCHIVAL-RULES.md`

---

**Maintenance:** Update this document when adding new categories or changing project structure. Archive previous version following supersession workflow.