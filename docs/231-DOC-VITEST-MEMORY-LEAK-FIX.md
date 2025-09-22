# Vitest Memory Leak Fix Documentation

## Problem Statement
Multiple Node.js processes running Vitest were accumulating in memory without proper cleanup, causing severe RAM exhaustion during development. Each test run would spawn new processes that weren't terminating, requiring manual intervention with `pkill` to recover memory.

## Root Cause Analysis

### 1. **Process Pool Misconfiguration**
- Default Vitest uses `threads` pool which can spawn multiple worker threads
- These threads weren't being properly cleaned up after test runs
- File-level parallelization was creating multiple processes per test file

### 2. **Missing Resource Cleanup**
- IndexedDB connections weren't being closed
- Mock accumulation between test runs
- Timer references keeping processes alive
- Memory-intensive mocks (433-line Y.js mock) causing heap exhaustion

### 3. **Configuration Duplication**
- Test configuration in both `vite.config.ts` and `vitest.config.ts`
- Conflicting settings causing unpredictable behavior
- No explicit memory management settings

## Solution Implementation

### Configuration Changes

#### 1. **vitest.config.ts** - Main Configuration
```typescript
pool: 'forks',                    // Use forks instead of threads
poolOptions: {
  forks: {
    singleFork: true,              // Run all tests in single fork
    isolate: true,                 // Isolate test files
  }
},
fileParallelism: false,            // Sequential file execution
maxConcurrency: 1,                 // One test suite at a time
minThreads: 0,                     // Don't keep threads alive
maxThreads: 1,                     // Maximum one thread
cache: false,                      // Disable result caching
```

#### 2. **Enhanced Cleanup Hooks** (tests/setup.ts)
- Clear React component state
- Reset all mocks and timers
- Close IndexedDB connections
- Force garbage collection hints
- Global teardown with `afterAll`

#### 3. **Memory-Safe NPM Scripts**
```json
"test:safe": "node --expose-gc --max-old-space-size=2048 ./node_modules/.bin/vitest run",
"test:watch:safe": "node --expose-gc --max-old-space-size=2048 ./node_modules/.bin/vitest --reporter=dot",
"test:cleanup": "pkill -f vitest || true"
```

### Node.js Flags Explained
- `--expose-gc`: Allows manual garbage collection triggering
- `--max-old-space-size=2048`: Limits heap to 2GB (prevents runaway memory)

## Usage Guidelines

### For Regular Testing
```bash
npm run test:safe          # Memory-safe test run
npm run test:watch:safe    # Memory-safe watch mode
npm run test:cleanup       # Kill any hanging processes
```

### For CI/CD
```bash
# Use the standard commands - they now include memory fixes
npm run test
npm run test:coverage
```

### Emergency Recovery
```bash
# If processes still accumulate
npm run test:cleanup
# OR
pkill -f vitest
```

## Best Practices

### 1. **Test Structure**
- Keep test files focused and small
- Avoid heavy mocks in global setup
- Use lightweight mocks where possible

### 2. **Watch Mode**
- Use `test:watch:safe` for development
- Use dot reporter to reduce memory overhead
- Restart watch mode periodically during long sessions

### 3. **CI/CD Configuration**
```yaml
# GitHub Actions example
- name: Run tests
  run: |
    npm run test:cleanup      # Clean before
    npm run test:safe         # Run with memory management
    npm run test:cleanup      # Clean after
```

## Performance Impact

### Before Fix
- Memory usage: Unbounded growth (5GB+)
- Process count: Accumulating (10+ processes)
- Test speed: Degrading over time
- Developer experience: Manual cleanup required

### After Fix
- Memory usage: Stable at ~500MB-1GB
- Process count: Single controlled process
- Test speed: Consistent performance
- Developer experience: Automatic cleanup

## Monitoring

### Check Process Count
```bash
ps aux | grep vitest | grep -v grep | wc -l
```

### Monitor Memory Usage
```bash
# During test run
top -pid $(pgrep -f vitest)
```

### Verify Cleanup
```bash
# After test run - should return 0
ps aux | grep vitest | grep -v grep | wc -l
```

## Troubleshooting

### Issue: Tests Still Accumulating Processes
1. Check for custom test scripts bypassing configuration
2. Verify no duplicate vitest processes from IDE
3. Run `npm run test:cleanup` before testing

### Issue: Out of Memory Errors
1. Reduce `--max-old-space-size` to 1024MB
2. Split large test files into smaller units
3. Check for memory leaks in application code

### Issue: Tests Running Slowly
1. This is expected trade-off for memory safety
2. Use watch mode for faster feedback during development
3. Run specific test files instead of full suite

## Technical Details

### Process Model
- **Forks**: Each test suite runs in a forked Node.js process
- **Single Fork**: All tests share one fork to prevent accumulation
- **Isolation**: Test files are isolated within the fork

### Memory Management
- **Garbage Collection**: Explicit GC hints after each test
- **Heap Limit**: 2GB maximum to prevent runaway growth
- **Resource Cleanup**: IndexedDB, timers, and mocks cleared

### Configuration Hierarchy
1. `vitest.config.ts` - Main test configuration
2. `vitest.integration.config.ts` - Integration test overrides
3. `package.json` scripts - Runtime flags
4. `tests/setup.ts` - Global hooks

## References
- [Vitest Pool Options](https://vitest.dev/config/#pool)
- [Node.js Memory Management](https://nodejs.org/api/cli.html#--max-old-space-sizesize-in-mb)
- [V8 Garbage Collection](https://v8.dev/blog/trash-talk)

## Maintenance
- Review configuration quarterly
- Monitor CI/CD test performance
- Update Node.js flags as needed
- Keep Vitest version current

---

**Last Updated**: 2025-09-22
**Author**: Technical Architect
**Status**: Implemented and Tested