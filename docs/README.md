# Documentation Directory

**Purpose:** Implementation artifacts, standards, guides, and architectural decisions

## Content Organization

### Current Active Categories

#### 1xx :: DOCUMENTATION
- **103-DOC-STRUCTURE-AND-NAMING-STANDARDS.md** - Project documentation conventions
- **102-SYSTEM-BRANCH-PROTECTION.md** - CI/CD and branch protection setup

#### ADRs (docs/adr/)
- **101-SYSTEM-DIRECTORY-STRUCTURE.md** - Project directory structure decisions

### Future Categories (Prepared)

#### 0xx :: SYSTEM_META (Future)
Reserved for system-level north stars and core design principles when needed.

#### 4xx :: SECURITY_AUTH (Future) 
Authentication models, security policies, access control documentation.

#### 5xx :: RUNTIME_OPS (Future)
Deployment guides, monitoring setup, operational procedures.

#### 6xx :: DATA_STORAGE (Future)
Database schemas, migration guides, data model documentation.

#### 7xx :: INTEGRATION_API (Future)
External API contracts, client documentation, integration protocols.

#### 9xx :: SCRIPTS_TOOLS (Future)
Automation documentation, tooling guides, development utilities.

## Placement Rules

- **Maximum depth:** 2 levels (e.g., `docs/adr/401-SEC-MODEL.md`)
- **Naming pattern:** `{CATEGORY}{NN}-{CONTEXT}[-{QUALIFIER}]-{NAME}.{EXT}`
- **ADRs location:** Must be in `docs/adr/` subdirectory
- **Archive process:** Move retired docs to `_archive/docs/` with original structure

## Guidelines

### When to Add Documentation
- Standards and conventions (1xx range)
- Architectural decisions (ADRs in docs/adr/)
- System design principles (0xx range, when needed)
- Category-specific guides as project grows

### Archive Workflow
1. Update canonical document
2. Move old version to `_archive/docs/` 
3. Add archive header with supersession link
4. Update references in other documents

---

**Next Actions:** Add system north star when created, expand categories as project phases advance.