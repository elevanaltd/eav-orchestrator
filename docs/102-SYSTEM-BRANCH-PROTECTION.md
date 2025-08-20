# 102-SYSTEM-BRANCH-PROTECTION

**Status:** Implemented  
**Date:** 2025-08-20  
**Type:** Infrastructure Setup

## Branch Protection Configuration

This document outlines the branch protection rules and CI/CD setup for the EAV Orchestrator project, following test methodology guardian principles.

## Core Principle: Zero-Tolerance CI

Per testguard consultation (be92c7f5-0d20-47cf-b626-5f1e06c613be), our CI pipeline maintains absolute integrity:
- **Green means GO**: All checks pass
- **Red means STOP**: Something needs fixing
- **No grey areas**: No `continue-on-error` in blocking workflows

## GitHub Branch Protection Settings

### For `main` branch:

```yaml
# Settings → Branches → Add rule → main
Protection Rules:
  ✅ Require a pull request before merging
    - Dismiss stale reviews: Yes
    - Required approvals: 0 (initially, increase after team growth)
    
  ✅ Require status checks to pass
    - Strict mode: Yes (branches must be up-to-date)
    - Required checks:
      • validate (from ci.yml)
      • prepare-next-phase (from ci.yml)
    
  ✅ Require conversation resolution
  
  ✅ Include administrators: No (during early development)
  
  ✅ Restrict force pushes: Yes
  
  ✅ Restrict deletions: Yes
```

## CI Pipeline Structure

### 1. Blocking Pipeline (`ci.yml`)
**Purpose:** Enforce quality gates that MUST pass

- Directory structure validation
- Naming convention enforcement  
- Security scanning (secrets)
- File size limits
- Technology detection

**Principle:** Every check here is MANDATORY - no exceptions

### 2. Informational Pipeline (`doc-quality.yml`)
**Purpose:** Provide quality insights without blocking

- Markdown link checking (daily + on doc changes)
- Creates GitHub issues for problems
- Does not block merges

**Principle:** Useful information routed appropriately

## Progressive Enhancement Timeline

### Current Phase (Pre-B0)
- Basic structural validation
- Security scanning
- Naming conventions

### After B0 (Technology Decided)
```yaml
Add to ci.yml:
- Package manager validation
- Dependency lockfile checks
- Basic configuration validation
```

### After B1 (Structure Defined)
```yaml
Add to ci.yml:
- Dependency vulnerability scanning  
- License compliance checks
- Architecture validation
```

### After B2 Begins (Code Exists)
```yaml
Add to ci.yml:
- Unit tests (must pass)
- Integration tests (must pass)
- Linting (must pass)
- Type checking (must pass)
- Coverage reporting (informational initially)
```

### After B3 (Integration Phase)
```yaml
Add to ci.yml:
- E2E tests
- Performance benchmarks
- Security scanning (SAST/DAST)
```

## How to Configure Branch Protection

1. **Navigate to Settings:**
   ```
   Repository → Settings → Branches
   ```

2. **Add Branch Protection Rule:**
   - Branch name pattern: `main`
   - Configure as specified above

3. **Enable Required Status Checks:**
   - Search for `validate` and `prepare-next-phase`
   - Mark as required

4. **Save Changes**

## Testing the Setup

1. **Create a test PR:**
   ```bash
   git checkout -b test/ci-validation
   echo "test" > test.md
   git add test.md
   git commit -m "test: validate CI pipeline"
   git push origin test/ci-validation
   ```

2. **Open PR and verify:**
   - CI runs automatically
   - All checks must pass
   - Cannot merge until green

3. **Clean up:**
   ```bash
   git checkout main
   git branch -D test/ci-validation
   ```

## Maintenance

### Adding New Checks
1. Always add to blocking pipeline if it's a quality gate
2. Use informational pipeline for non-critical metrics
3. Never use `continue-on-error` in blocking workflows

### Monitoring
- Review CI failure patterns weekly
- Adjust timeout/retry settings based on data
- Keep test execution time under 5 minutes

## References

- [GitHub Branch Protection Docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)
- [Test Methodology Guardian Principles](testguard consultation be92c7f5)
- [HestAI Quality Standards](/Volumes/HestAI/docs/guides/)

---

**Principle:** The CI pipeline is our automated quality guardian. It must never lie, never compromise, and never accept failure as normal.