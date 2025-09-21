# CRITICAL TECHNICAL DEBT: Test Suite Memory Exhaustion

**Priority:** HIGH
**Created:** 2025-09-20
**Status:** EMERGENCY STOPGAP APPLIED
**Approved By:** Critical-Engineer (Token: CRITICAL-ENGINEER-20250920-fce00a54)

## Problem Statement

The test suite is experiencing critical infrastructure failures:
1. **Node.js Memory Exhaustion:** `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`
2. **Worker Process Communication Breakdown:** `Error: Channel closed ERR_IPC_CHANNEL_CLOSED`
3. **Test Suite Collapse:** Process crashes during test execution with 38 test files

## Emergency Stopgap Applied

Per critical-engineer approval, the following temporary measures have been implemented:

1. **Increased Memory Allocation:** Added `NODE_OPTIONS='--max-old-space-size=8192'` to all test scripts
2. **Worker Pool Configuration:** Switched from `threads` to `forks` with `maxForks: 4` limitation
3. **CI Node Version Alignment:** Updated CI to use Node.js v22 (matching local development)

## Root Cause Analysis Required

### MANDATORY Action Items

1. **Memory Profiling:**
   - Use Node's built-in profiler (`--heap-prof`) or inspector (`--inspect` with Chrome DevTools)
   - Generate heap snapshots during failing test runs
   - Identify objects consuming excessive memory

2. **Test Isolation:**
   - Run test files individually with memory tracking (`--log-heap-usage`)
   - Identify which files or specific tests cause memory spikes
   - Document memory consumption patterns

3. **Test Teardown Audit:**
   - Review all `afterEach` and `afterAll` hooks
   - Ensure proper resource cleanup (servers, database clients, mocks, spies)
   - Check for instances created per test vs per file

4. **Common Culprits to Investigate:**
   - Multiple application instances created per test
   - Unclosed database connections or servers
   - Memory leaks in mocked modules (TipTap, Supabase, IndexedDB)
   - Large data fixtures not being garbage collected

## Symptoms vs Root Cause

The current "fix" treats symptoms, not the disease. A test suite requiring 8GB of heap is indicative of:
- Memory leaks in application code being surfaced by tests
- Improper test isolation and cleanup
- Potential production issues waiting to happen

## Success Criteria for Resolution

1. Test suite runs successfully with `--max-old-space-size=2048` (2GB)
2. No `ERR_IPC_CHANNEL_CLOSED` errors
3. Memory regression guardrail CI job established
4. Root cause documented and fixed

## Implementation Notes

### Current Test Infrastructure
- 38 test files with extensive mocking
- Heavy use of fake-indexeddb, TipTap mocks, Supabase mocks
- React Testing Library with jsdom environment
- Vitest 3.2.4 test runner

### Monitoring Commands

```bash
# Profile memory usage
NODE_OPTIONS='--heap-prof' npm test

# Track heap usage per test
NODE_OPTIONS='--log-heap-usage' npx vitest run tests/specific-file.test.ts

# Generate heap snapshot
node --inspect npm test
# Then use Chrome DevTools Memory tab
```

## References

- Critical-Engineer Consultation: 9f72d44a-1996-40f6-866e-0e111081d7c2
- Registry Approval: fce00a54-ac21-4d0f-80a3-dab9ad45815f

## Next Steps

1. [ ] Create CI job with 2GB memory limit as regression guard
2. [ ] Profile memory usage in failing tests
3. [ ] Identify and fix memory leaks
4. [ ] Remove emergency stopgap configuration
5. [ ] Document lessons learned

---

**Engineering Principle:** Build systems that don't break
**Validation Question:** What will break this in production?
