# EAV Orchestrator - Production Ready System

**🟢 PRODUCTION READY** - Collaborative Video Production System for 10-20 concurrent users

- **For Business Context & Project Status:** See [PROJECT_CONTEXT.md](../coordination/PROJECT_CONTEXT.md)
- **For Development Instructions:** See [CLAUDE.md](./CLAUDE.md)
- **For Deployment Guide:** See [CONTINUATION_PROMPT.md](../coordination/CONTINUATION_PROMPT.md)

## Current Status: PRODUCTION READY 🟢

**All Critical Requirements Complete → Ready for Deployment**

The EAV Orchestrator has achieved full production readiness with both strong foundations and operational maturity.

### Production Features Complete ✅
- **Collaborative Editing:** Y.js CRDT with conflict-free real-time sync
- **Security:** 18/18 boundary tests, 5-role RLS (Admin/Internal/Freelancer/Client/Viewer)
- **Resilience:** IndexedDB queue with fallback chain, circuit breaker patterns
- **Monitoring:** Sentry error tracking with performance monitoring
- **Operational Maturity:** Client Lifecycle Manager with schema versioning
- **Deployment Safety:** Version coordination API preventing data corruption
- **User Experience:** Clear status banner for all system states

### System Architecture
- **Client Lifecycle States:** INITIALIZING | HEALTHY | OFFLINE | SYNCING | UPDATE_REQUIRED
- **Data Persistence:** IndexedDB → localStorage → memory fallback chain
- **Real-time Sync:** CustomSupabaseProvider with project-scoped security
- **Schema Evolution:** Automatic migrations on deployment
- **Version Control:** Forced refresh protocol for breaking changes

## Technology Stack

### Production Dependencies
```yaml
Frontend: React 19.1.1 + TypeScript 5.9.2 + Vite 7.1.5
Rich_Text: TipTap 2.26.1 + collaboration extensions  
Collaboration: Yjs 13.6.27 + custom Supabase glue code
Backend: Supabase 2.57.4 + PostgreSQL + real-time
State: Zustand 4.5.7 + fractional-indexing 3.2.0
```

### Development Dependencies
```yaml
Testing: Vitest 3.2.4 + @testing-library/react 16.3.0
Linting: ESLint 9.35.0 + TypeScript rules
Coverage: @vitest/coverage-v8 3.2.4
Formatting: Prettier 3.6.2
```

### Dependency Management Strategy

**Production Stability Approach:**
- **Lock File Commitment:** `package-lock.json` is committed and provides reproducible builds
- **CI/CD Safety:** `npm ci` used in all automated environments for exact dependency matching
- **Security Scanning:** Automated `npm audit` in CI pipeline blocks builds with high/critical vulnerabilities
- **Automated Updates:** Dependabot configured for weekly security and dependency updates
- **Semantic Versioning:** Use `^` ranges in `package.json` to receive non-breaking security patches

**Critical Engineer Guidance:**
This project follows modern dependency management best practices instead of manual version pinning:
1. **Reproducible Builds:** Achieved through committed `package-lock.json` and `npm ci`
2. **Security First:** Automated scanning prevents vulnerable dependencies from being deployed
3. **Controlled Updates:** Dependabot creates isolated PRs for testing individual updates
4. **No Manual Pinning:** Avoid manual dependency pinning which creates security vulnerabilities

**Update Process:**
- **Weekly Schedule:** Dependabot runs Monday 09:00 UTC for npm dependencies
- **Grouped Updates:** Minor/patch updates grouped together to reduce PR noise
- **Manual Review:** Major version updates require explicit approval
- **Security Priority:** High/critical vulnerabilities fail CI and block deployments

## Quick Start

### Setup Development Environment
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests  
npm run test

# Run tests in watch mode
npm run test:watch

# Run quality gates
npm run validate  # lint + typecheck + test
```

### Testing Infrastructure
- **Framework:** Vitest (Jest-compatible API)
- **Test Files:** 9 operational test files 
- **TDD Discipline:** 6 RED state tests awaiting implementation
- **Coverage:** Available via `npm run test:coverage`

## Documentation Naming Convention

All implementation documents follow the `{CATEGORY}{NN}-{CONTEXT}[-{QUALIFIER}]-{NAME}.{EXT}` pattern as defined in `CLAUDE.md`.

- **`{CATEGORY}`**: `DOC`, `ADR`, etc.
- **`{NN}`**: Numeric identifier.
- **`{CONTEXT}`**: High-level context (e.g., `EAV`).
- **`{QUALIFIER}`**: Optional phase or version (e.g., `B1-BUILD-PLAN`).
- **`{NAME}`**: Descriptive name.

Example: `108-DOC-EAV-B1-BUILD-PLAN.md`

## Project Structure

```
build/                          # Implementation repository
├── src/                        # Source code (React 19 + TypeScript)
├── tests/                      # Test suites (9 files, Vitest)
├── docs/                       # Implementation documentation
│   ├── adr/                    # Architectural Decision Records
│   ├── 108-DOC-EAV-B1-BUILD-PLAN.md
│   ├── 109-DOC-CONSTITUTIONAL-BASELINE-IMPLEMENTATION-LOG.md
│   └── 110-DOC-SCRIPT-EDITOR-IMPLEMENTATION-READINESS.md
├── CLAUDE.md                   # Development instructions
├── package.json                # Dependencies & scripts
└── README.md                   # This file
```

## Key Documents

### Implementation Planning
- [B1 Build Plan](./docs/108-DOC-EAV-B1-BUILD-PLAN.md) - 5-week implementation roadmap
- [Constitutional Baseline](./docs/109-DOC-CONSTITUTIONAL-BASELINE-IMPLEMENTATION-LOG.md) - Infrastructure stabilization
- [Implementation Readiness](./docs/110-DOC-SCRIPT-EDITOR-IMPLEMENTATION-READINESS.md) - Script editor readiness assessment

### Project Context
- [Project Context](../coordination/PROJECT_CONTEXT.md) - Business requirements & status
- [EAV North Star](./docs/105-DOC-EAV-ORCHESTRATOR-D1-NORTH-STAR.md) - Project vision
- [B0 Validation](./docs/106-DOC-B0-VALIDATION.md) - Architecture validation

### Development Standards
- [CLAUDE.md](./CLAUDE.md) - Development instructions & TRACED protocol
- [Data Model ADR](./docs/adr/102-DOC-ADR-DATA-MODEL.md) - Database architecture decisions

## Development Standards

### TRACED Protocol Compliance
All development follows TRACED methodology:
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

## Performance Targets

### Script Editor Module
- P95 save operations ≤ 500ms
- Comment sync latency <200ms  
- Presence updates <500ms
- Support 10-20 concurrent users
- Component reordering <100ms

### Quality Criteria
- No data loss during concurrent editing
- Zero internal data visible to clients (RLS enforcement)
- 100% component↔scene mapping maintained
- All changes traceable through audit trail

---

**Development Team:** Ready for script editor TDD implementation  
**Constitutional Baseline:** Complete (2025-09-10)  
**Next Phase:** Collaborative script editing features

For questions about project context or business requirements, see [coordination/PROJECT_CONTEXT.md](../coordination/PROJECT_CONTEXT.md).  
For development setup and standards, see [CLAUDE.md](./CLAUDE.md).