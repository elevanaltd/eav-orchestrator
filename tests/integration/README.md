# Integration Test Suite

## TestGuard Constitutional Compliance - CONTRACT-DRIVEN-CORRECTION

This directory contains integration tests that use **real Y.js instances** for absolute contract fidelity, as mandated by TestGuard constitutional intervention.

## Why Integration Tests with Real Y.js?

Previously, we were skipping Y.js integration tests to hide contract failures. TestGuard has mandated this approach:

> **TestGuard Authority:** Truth over convenience - failing tests reveal real issues that must be addressed, not hidden.

## Tiered Testing Strategy

### 1. Unit Tests (`tests/unit/`)
- **Purpose:** Fast execution with lightweight mocks
- **Y.js Handling:** Uses simplified mocks for memory efficiency
- **Execution Time:** ~1.16s (preserved memory leak fixes)
- **Coverage:** Basic encoding/decoding logic, error handling

### 2. Integration Tests (`tests/integration/`)
- **Purpose:** Real Y.js contract validation
- **Y.js Handling:** Actual Y.js instances for CRDT behavior validation
- **Execution Time:** ~15s timeout per test (real CRDT operations)
- **Coverage:** Y.js synchronization, binary encoding roundtrips, CRDT merge semantics

### 3. Feature Tests (`tests/**/*.feature.test.*`)
- **Purpose:** TDD RED state tracking (unimplemented features)
- **Execution:** Non-blocking CI pipeline
- **Status:** Expected to fail until features are implemented

## CI Pipeline Integration

```yaml
# Unit Tests: Every commit (fast feedback)
npm test

# Integration Tests: On merge to main branch only
npm run test:integration  # CONTRACT-DRIVEN-CORRECTION

# Feature Tests: Non-blocking RED state tracking
npm run test:feature
```

## Integration Test Categories

### Y.js CRDT Integration (`yjs-encoding-integration.test.ts`)
Tests that validate our encoding utilities work with **real Y.js documents**:

- **Real Y.js Update Encoding/Decoding:** Validates binary transport layer
- **CRDT Merge Semantics:** Tests conflict resolution with concurrent edits
- **Complex Document Structures:** Multi-type Y.js data (Array, Map, Text)
- **Performance & Memory:** Realistic document sizes and cleanup
- **Error Boundaries:** Corruption detection and graceful degradation

## Expected Failures (Constitutional RED State)

Currently failing integration tests reveal real contract violations:

1. **Y.js State Synchronization Issues:** Updates not properly applying
2. **API Method Availability:** Missing Y.js methods in our environment
3. **Validation Logic Gaps:** Current validation too permissive for real Y.js data
4. **Binary Encoding Roundtrip Problems:** Data loss during transport

## Test Infrastructure Features

### Memory Leak Prevention
- Proper Y.js document cleanup with `doc.destroy()`
- Single-threaded execution for state isolation
- Extended timeouts for real CRDT operations

### Configuration
- **File:** `vitest.integration.config.ts`
- **Environment:** `NODE_ENV=integration`
- **Memory:** `NODE_OPTIONS='--max-old-space-size=8192'`
- **Threading:** Single thread for Y.js state consistency

## Development Workflow

### Running Integration Tests Locally
```bash
# Run all integration tests
npm run test:integration

# Run specific integration test file
npm run test:integration tests/integration/collaboration/yjs-encoding-integration.test.ts

# Watch mode for development
npm run test:integration -- --watch
```

### Adding New Integration Tests

1. Create test file in appropriate `tests/integration/` subdirectory
2. Import real Y.js (not mocks): `import * as Y from 'yjs'`
3. Use `beforeEach/afterEach` for proper Y.js cleanup
4. Test actual CRDT behavior, not simplified mocks
5. Include performance and memory validation

### Contract Validation Requirements

Every integration test must validate **real Y.js contracts**:

- ✅ Use actual `Y.Doc()` instances
- ✅ Test real binary update encoding/decoding
- ✅ Validate CRDT merge semantics
- ✅ Include error boundary testing
- ✅ Memory leak prevention
- ❌ No simplified mocks or shortcuts
- ❌ No skipping difficult edge cases

## TestGuard Enforcement

**Constitutional Mandate:** These tests MUST use real Y.js instances. Any attempt to weaken, skip, or mock these tests violates TestGuard authority.

**Evidence Requirements:**
- Integration tests must fail until real issues are fixed
- No expectation adjustment - fix code, not tests
- CI evidence required for test modifications
- TestGuard consultation mandatory for test changes

## Current Status

**Integration Tests:** 7 failed, 2 passed (constitutional RED state)
**Unit Tests:** 14 passed (lightweight mock efficiency)
**Memory Performance:** 1.16s unit test execution preserved
**CI Integration:** Tiered strategy operational

This failure state is **constitutionally required** until real Y.js integration contracts are properly implemented.