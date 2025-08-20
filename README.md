# EAV Orchestrator - Fresh Build with Phoenix Insights

**Project:** Collaborative Video Production System  
**Approach:** Fresh HestAI workflow (D1→B4) using old system as reference  
**Status:** Ready for B0 Phase (Vision & Analysis Document)

## Overview

This is a fresh build of the EAV Orchestrator system following the complete HestAI workflow methodology. We are treating this as a new project while leveraging insights from the previous Phoenix analysis as reference material.

## Migration Strategy

### Approach: Fresh Workflow with Reference
Rather than migrating the old codebase, we are:
1. Following the complete HestAI workflow (D1→B4) from scratch
2. Using the old system as a reference library for business logic understanding
3. Building with proper TDD discipline and current best practices
4. Making fresh architectural decisions based on empirical validation

### Key Insights from Phoenix Analysis
The previous system analysis revealed:
- ✅ **Working Well:** CustomSupabaseProvider, security implementation, business logic
- ❌ **Critical Issues:** Test infrastructure (100% failure rate), memory leaks, documentation drift
- 📊 **To Validate:** Provider choice (CustomSupabaseProvider vs YjsSupabaseProvider)

## Current Phase: Pre-B0

### Immediate Next Steps
1. Execute `/workflow` command to begin formal process
2. Check for North Star document existence
3. Begin B0 phase for Vision & Analysis Document
4. Conduct all required consultations per phase

### Reference Materials
- **Old System Location:** `/Volumes/HestAI-old/builds/eav-orchestrator-old/`
- **Phoenix Analysis:** `phoenix/` directory in old system
- **North Star Documents:** Referenced in coordination PROJECT_CONTEXT.md

## Workflow Phases

### D1: Discovery & Definition (if needed)
- Create North Star document if missing
- Establish requirements and constraints

### B0: Vision & Analysis ← **CURRENT TARGET**
- Fresh architectural assessment
- Technology stack evaluation
- Empirical provider validation
- Risk analysis and mitigation

### B1: Build Planning
- Task decomposition based on B0 decisions
- Project structure definition
- Development environment setup

### B2: Implementation
- TDD-driven development
- Component-by-component build
- Continuous integration

### B3: Integration
- System-wide testing
- Performance validation
- Security verification

### B4: Delivery
- Handoff documentation
- Operational runbooks
- Team training materials

## Development Standards

### TRACED Protocol (Mandatory)
- **T**est: Write failing test before any code
- **R**eview: Code review after implementation
- **A**nalyze: Architecture consultation for decisions
- **C**onsult: Specialists at trigger points
- **E**xecute: Quality gates (lint, typecheck, test)
- **D**ocument: TodoWrite throughout

### Consultation Requirements
Each phase has mandatory consultations:
- Context7 for library documentation
- Critical-engineer for architecture validation
- Code-review-specialist for all code changes
- Test-methodology-guardian for testing approach

## Repository Structure

```
build/                      # Git repository root
├── src/                    # Source code (to be created)
├── tests/                  # Test suites (to be created)
├── docs/                   # Implementation artifacts
│   ├── adr/               # Architectural Decision Records
│   ├── 103-DOC-STRUCTURE-AND-NAMING-STANDARDS.md
│   └── README.md          # Directory purpose
├── reports/                # Time-bound analyses
│   └── README.md          # Category guidelines
├── _archive/               # Retired documents
│   ├── docs/              # Archived docs
│   ├── reports/           # Archived reports
│   └── adr/               # Archived ADRs
├── sessions/               # Raw logs, explorations
├── scripts/                # Automation tools
├── reference-old/         # Symlink to old system (git-ignored)
├── README.md              # This file
└── CLAUDE.md             # Development instructions
```

## Documentation Categories

### Naming Convention Pattern
`{CATEGORY}{NN}-{CONTEXT}[-{QUALIFIER}]-{NAME}.{EXT}`

### Category Ranges
```
0xx :: SYSTEM_META      → Core system design, workflows, north stars
1xx :: DOCUMENTATION    → Standards, guides, rules, conventions  
2xx :: PROJECT_BUILD    → Plans, workflows, deliverables (requires phase)
3xx :: UI_FRONTEND      → Components, patterns, design systems (future)
4xx :: SECURITY_AUTH    → Models, policies, authentication (future)
5xx :: RUNTIME_OPS      → Deployment, monitoring, operations (future)
6xx :: DATA_STORAGE     → Schemas, migrations, data models (future)
7xx :: INTEGRATION_API  → Contracts, clients, protocols (future)
8xx :: REPORTS          → Audits, analyses, retrospectives
9xx :: SCRIPTS_TOOLS    → Automation, generators, validators (future)
```

### Context Tokens
**Active:** `DOC`, `SYSTEM`, `PROJECT`, `BUILD`, `REPORT`  
**Reserved:** `SCRIPT`, `AUTH`, `UI`, `RUNTIME`, `DATA`, `SEC`, `OPS`

### Examples
- `000-SYSTEM-NORTH-STAR.oct.md`
- `103-DOC-STRUCTURE-AND-NAMING-STANDARDS.md`
- `201-PROJECT-EAV-B0-VISION-ANALYSIS.md`
- `801-REPORT-SECURITY-AUDIT.oct.md`

## Project Management

### Business Requirements
- **Users:** 10-20 concurrent
- **Projects:** Support for 100s
- **Growth:** 3x current volume target
- **Performance:** P95 ≤ 500ms saves, <2s page loads

### Script Module (First Implementation)
- Collaborative editing with TipTap
- Real-time commenting (<200ms sync)
- 3-state approval workflow
- Component-to-scene mapping

## Links

### Coordination
- [Project Context](/.coord/PROJECT_CONTEXT.md)
- [Team Charter](/.coord/CHARTER.md)
- [RACI Assignments](/.coord/ASSIGNMENTS.md)

### Reference System
- [Phoenix Analysis](/Volumes/HestAI-old/builds/eav-orchestrator-old/phoenix/)
- [Old Implementation](/Volumes/HestAI-old/builds/eav-orchestrator-old/modules/)

### HestAI Standards
- [Complete Workflow](/Volumes/HestAI/docs/HESTAI_COMPLETE_WORKFLOW.md)
- [Agent Capabilities](/Volumes/HestAI/docs/guides/AGENT_CAPABILITY_LOOKUP.oct.md)

## Getting Started

1. **Initialize Workflow:**
   ```bash
   /workflow
   ```

2. **Create Reference Link:**
   ```bash
   ln -s /Volumes/HestAI-old/builds/eav-orchestrator-old reference-old
   echo "reference-old" >> .gitignore
   ```

3. **Begin B0 Phase:**
   Follow workflow guidance for Vision & Analysis Document creation

## Team

- **Implementation Lead:** [Assignment Pending]
- **Technical Architect:** [Assignment Pending]
- **Script Module Specialist:** [Assignment Pending]
- **System Integration Lead:** [Assignment Pending]

---

**Last Updated:** 2025-08-20  
**Note:** This is a fresh build following proper methodology. The old system serves only as a reference for business logic understanding, not as a base for modification.