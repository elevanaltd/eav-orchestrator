# EAV Orchestrator Development Instructions

<!-- LINK_VALIDATION_BYPASS: documentation update reflecting infrastructure stabilization and constitutional baseline -->

**Project:** EAV Orchestrator - Collaborative Video Production System  
**Repository:** `/Volumes/HestAI-Projects/eav-orchestrator/build/`  
**Last Updated:** 2025-09-10

These instructions guide Claude Code in developing the EAV Orchestrator system following HestAI organizational standards and project-specific requirements.

## Project Context & Constraints

### Business Requirements
- **Scale:** 10-20 concurrent users, support for 100s of projects
- **Philosophy:** 95% automation with manual overrides
- **Performance:** P95 ≤ 500ms saves, <2s page loads for script editing
- **Growth Target:** Support 3x current project volume

### Architecture Principles
- **Modular Design:** Script Module first, then phased expansion
- **Realistic Scaling:** Build for actual needs, not theoretical maximums
- **Clean Data Architecture:** UUID primary keys, human-readable display fields
- **Parallel Processing:** Non-blocking workflows, sensible defaults

## Development Standards

### TRACED Protocol Compliance
All development activities must follow TRACED protocol with evidence receipts:

- **T**est: RED-GREEN-REFACTOR cycle, failing tests before implementation
- **R**eview: Code review specialist consultation for all changes
- **A**nalyze: Critical engineer consultation for architectural decisions
- **C**onsult: Specialist consultation at mandatory trigger points
- **E**xecute: Quality gates (lint, typecheck, tests) with CI/CD evidence
- **D**ocument: TodoWrite throughout, Implementation Log updates

### Quality Gates
- **TDD Mandatory:** Write failing test before implementation
- **No Code Without Tests:** All new files must have corresponding test files
- **Coverage Diagnostic:** 80% guideline (not gate), focus on behavior validation
- **Evidence Required:** Links to CI jobs, review comments, test execution receipts

### Consultation Triggers
- **Architecture decisions:** `technical-architect` or `critical-engineer`
- **Code changes:** `code-review-specialist`
- **Testing issues:** `testguard` (mandatory for test manipulation prevention)
- **Complex systems:** `complexity-guard` for >3 layers
- **North Star conflicts:** `requirements-steward`

## Technology Stack & Implementation

### Current Status: B1 Infrastructure Complete - Ready for Script Editor Implementation
Testing infrastructure stabilized with Jest→Vitest migration complete. Technology stack confirmed and constitutional baseline established.

### Technology Stack (Confirmed)
- **Backend:** Supabase + PostgreSQL with UUID primary keys and JSONB storage
- **Frontend:** React 19 + TypeScript + TipTap rich text editor
- **Collaboration:** Yjs + Supabase Real-time for conflict-free editing
- **Testing:** Vitest + Testing Library with TRACED methodology compliance
- **Real-time:** Required for collaborative script editing (comment sync <200ms)
- **Authentication:** 5-role system (Admin, Internal, Freelancer, Client, Viewer)

### Infrastructure Status
- **Testing Framework:** Vitest migration complete (9 test files operational)
- **Constitutional Baseline:** TestGuard quality gates established
- **TDD Ready:** RED-GREEN-REFACTOR cycle infrastructure prepared
- **Quality Gates:** Lint, typecheck, coverage configuration operational
- **Framework Stack:** React 19 + TypeScript + Vitest validated

## File Organization & Naming

### Directory Structure
```
build/                       # Git repository root
├── src/                     # Source code (structure TBD)
├── tests/                   # Test suites (9 files operational)
├── docs/                    # Implementation artifacts
│   ├── adr/                 # Architectural Decision Records
│   └── 108-DOC-EAV-B1-BUILD-PLAN.md
├── README.md
└── CLAUDE.md               # This file
```

### Naming Conventions
- **Implementation Docs:** `{CATEGORY}{NN}-{CONTEXT}[-{QUALIFIER}]-{NAME}.{EXT}`
- **ADR Files:** Follow organizational naming pattern
- **Source Files:** React 19 + TypeScript patterns established

## Script Module First Implementation

Based on Script Module North Star, initial development focuses on:

### Core Features (Week 1)
- Collaborative script editing (TipTap rich text)
- Real-time commenting system
- Simple 3-state approval workflow (created → in_edit → approved)
- Component-to-scene 1:1 mapping structure
- Role-based access control (5 roles)

### Performance Requirements
- 10-20 concurrent users smooth operation
- Comment sync: <200ms latency
- Presence indicators: <500ms updates
- Support 50-100 components per script

### Quality Criteria
- No data loss during concurrent editing
- Zero internal data visible to clients
- 100% component↔scene mapping maintained
- All changes traceable through audit trail

## Current Status & Next Steps

### Constitutional Baseline Complete
1. **Jest→Vitest Migration:** Successfully completed across all 9 test files
2. **TestGuard Quality Gates:** Established with proper RED-GREEN-REFACTOR discipline
3. **Technology Stack:** Confirmed and operational (React 19 + TypeScript + Vitest)
4. **Build Infrastructure:** Lint, typecheck, test coverage fully configured
5. **TDD Infrastructure:** Ready for script editor feature implementation

### Immediate Next Steps
1. Begin script editor TDD implementation with failing tests
2. Implement TipTap collaborative editor integration
3. Set up Yjs + Supabase real-time collaboration
4. Execute Week 1 critical blockers from Build Plan
5. Proceed with 5-week implementation roadmap

### Critical Blockers (From Build Plan)
1. **Optimistic Locking Strategy** - Prevent concurrent edit data loss
2. **API Failure Isolation** - Circuit breaker pattern for external services
3. **Fractional Indexing** - LexoRank algorithm for component ordering

## Reference Documentation

### North Star Documents
- [EAV Orchestrator North Star](./docs/105-DOC-EAV-ORCHESTRATOR-D1-NORTH-STAR.md)
- [B0 Validation Report](./docs/106-DOC-B0-VALIDATION.md)

### Project Documentation
- [Project Context](../coordination/PROJECT_CONTEXT.md)
- [B1 Build Plan](./docs/108-DOC-EAV-B1-BUILD-PLAN.md)
- [Directory Structure ADR](./docs/adr/101-SYSTEM-DIRECTORY-STRUCTURE.md)
- [Data Model ADR](./docs/adr/102-DOC-ADR-DATA-MODEL.md)

### Organizational Standards
- [HestAI Complete Workflow](/Volumes/HestAI/docs/HESTAI_COMPLETE_WORKFLOW.md)
- [Agent Capability Lookup](/Volumes/HestAI/docs/guides/AGENT_CAPABILITY_LOOKUP.oct.md)
- [Directory Structure Standards](/Volumes/HestAI-New/docs/workflow/005-WORKFLOW-DIRECTORY-STRUCTURE.md)

## Git Workflow

### Repository Status
- **Initialized:** Yes (main branch)
- **Current Branch:** B1-build
- **Testing Infrastructure:** 9 test files (6 RED state TDD, 3 passing)
- **Build System:** Vite + TypeScript + ESLint configured

### Commit Standards
- **Format:** Conventional commits (feat|fix|docs|style|refactor|test|chore)
- **Atomic:** One task = one commit
- **Evidence Links:** Reference CI jobs, review comments in commit messages

## Testing Infrastructure Status

### Constitutional Baseline Stabilization
- **Framework Migration:** Jest→Vitest API successfully migrated
- **Test Count:** 9 test files operational (confirmed stable baseline)
- **TDD Discipline:** 6 tests in RED state awaiting implementation
- **Quality Gates:** Coverage configuration operational
- **TestGuard Protocol:** Quality gate procedures established

### Testing Framework Configuration
```yaml
Testing_Stack:
  Framework: Vitest 3.2.4
  UI_Testing: "@testing-library/react" 16.3.0
  Coverage: "@vitest/coverage-v8" 3.2.4
  Scripts:
    test: "vitest run"
    test:watch: "vitest"
    test:coverage: "vitest run --coverage"
    validate: "npm run lint && npm run typecheck && npm run test"
```

### TDD Readiness Status
- **RED State Infrastructure:** Confirmed working with 6 failing tests
- **GREEN State Path:** Implementation infrastructure ready
- **REFACTOR Discipline:** Code review triggers established
- **Coverage Diagnostic:** 80% guideline operational (not gate)
- **Evidence Collection:** CI job link requirements established

---

**Development Team:** Update this document as project evolves  
**Review Cycle:** Each phase transition and major decision  
**Enforcement:** TRACED protocol validation and quality gates

**Constitutional Baseline:** Infrastructure stabilized 2025-09-10  
**Next Phase:** Script editor TDD implementation ready to proceed