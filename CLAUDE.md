# EAV Orchestrator Development Instructions

**Project:** EAV Orchestrator - Collaborative Video Production System  
**Repository:** `/Volumes/HestAI-Projects/eav-orchestrator/build/`  
**Last Updated:** 2025-08-19

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

### Current Status: Awaiting B0 Phase
Technology stack decisions deferred pending B0 Vision & Analysis Document completion.

### Key Considerations (From North Star)
- **Database:** UUID primary key strategy confirmed
- **Real-time:** Required for collaborative script editing (comment sync <200ms)
- **Authentication:** 5-role system (Admin, Internal, Freelancer, Client, Viewer)
- **Rich Text:** TipTap for script editing with JSON storage + plain text projections

### Critical Dependencies
- **VO Versioning Approach:** Final confirmation required (System North Star line 34)
- **Team Assignments:** Role assignments for implementation phases
- **Infrastructure Decisions:** Hosting and deployment approach

## File Organization & Naming

### Directory Structure
```
build/                       # Git repository root
├── src/                     # Source code (structure TBD)
├── tests/                   # Test suites
├── docs/                    # Implementation artifacts
│   ├── adr/                 # Architectural Decision Records
│   ├── 201-PROJECT-EAV-B1-IMPLEMENTATION-LOG.md
│   └── 201-PROJECT-EAV-B1-BUILD-PLAN.md
├── README.md
└── CLAUDE.md               # This file
```

### Naming Conventions
- **Implementation Docs:** `{CATEGORY}{NN}-{CONTEXT}[-{QUALIFIER}]-{NAME}.{EXT}`
- **ADR Files:** Follow organizational naming pattern
- **Source Files:** [To be determined in B0/B1 phases]

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

## Current Blockers & Next Steps

### Blockers
1. **VO Versioning Approach:** System North Star line 34 requires final decision
2. **Team Assignments:** Implementation roles need assignment
3. **Technology Stack:** Awaiting B0 Vision & Analysis Document

### Immediate Next Steps
1. Complete B0 Vision & Analysis Document
2. Conduct technical architecture consultation
3. Finalize technology stack decisions
4. Expand Build Plan with detailed task breakdown
5. Set up development environment and tooling

## Reference Documentation

### North Star Documents
- [System North Star](/Volumes/HestAI/builds/eav-orchestrator/system/docs/000-EAV_SYSTEM-D1-NORTH_STAR.md)
- [Script Module North Star](/Volumes/HestAI/builds/eav-orchestrator/modules/script-module/docs/000-EAV_SCRIPT-D1-NORTH_STAR.md)

### Project Documentation
- [Project Context](../docs/201-PROJECT-EAV-D1-CONTEXT.md)
- [Implementation Log](./docs/201-PROJECT-EAV-B1-IMPLEMENTATION-LOG.md)
- [Build Plan](./docs/201-PROJECT-EAV-B1-BUILD-PLAN.md)
- [Directory Structure ADR](./docs/adr/101-SYSTEM-DIRECTORY-STRUCTURE.md)

### Organizational Standards
- [HestAI Complete Workflow](/Volumes/HestAI/docs/HESTAI_COMPLETE_WORKFLOW.md)
- [Agent Capability Lookup](/Volumes/HestAI/docs/guides/AGENT_CAPABILITY_LOOKUP.oct.md)
- [Directory Structure Standards](/Volumes/HestAI-New/docs/workflow/005-WORKFLOW-DIRECTORY-STRUCTURE.md)

## Git Workflow

### Repository Status
- **Initialized:** Yes (main branch)
- **Remote:** [To be configured]
- **Branch Strategy:** [To be defined in B1 phase]

### Commit Standards
- **Format:** Conventional commits (feat|fix|docs|style|refactor|test|chore)
- **Atomic:** One task = one commit
- **Evidence Links:** Reference CI jobs, review comments in commit messages

---

**Development Team:** Update this document as project evolves  
**Review Cycle:** Each phase transition and major decision  
**Enforcement:** TRACED protocol validation and quality gates