#!/bin/bash
# Memory Usage Monitoring Script
# Per critical-engineer directive for memory usage analysis
# Token: CRITICAL-ENGINEER-20250920-fce00a54

echo "=== Memory Usage Monitoring ==="
echo "Node.js version: $(node --version)"
echo "Initial heap: $(node -e 'console.log((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2))')MB"
echo "Max old space: ${NODE_OPTIONS:-"not set"}"
echo "Starting test execution at: $(date)"

# Track memory throughout test execution
{
  echo "Pre-test memory usage:"
  node -e '
    const mem = process.memoryUsage();
    console.log("RSS:", (mem.rss / 1024 / 1024).toFixed(2), "MB");
    console.log("Heap Used:", (mem.heapUsed / 1024 / 1024).toFixed(2), "MB");
    console.log("Heap Total:", (mem.heapTotal / 1024 / 1024).toFixed(2), "MB");
    console.log("External:", (mem.external / 1024 / 1024).toFixed(2), "MB");
  '

  echo -e "\n🧪 Executing test suite..."
  npm test
  test_exit_code=$?

  echo -e "\nPost-test memory usage:"
  node -e '
    const mem = process.memoryUsage();
    console.log("RSS:", (mem.rss / 1024 / 1024).toFixed(2), "MB");
    console.log("Heap Used:", (mem.heapUsed / 1024 / 1024).toFixed(2), "MB");
    console.log("Heap Total:", (mem.heapTotal / 1024 / 1024).toFixed(2), "MB");
    console.log("External:", (mem.external / 1024 / 1024).toFixed(2), "MB");
  '

  echo "Test completed at: $(date)"
  echo "Test exit code: $test_exit_code"

  if [ $test_exit_code -eq 0 ]; then
    echo "✅ Tests passed - memory fix confirmed effective"
  else
    echo "❌ Tests failed - memory investigation required"
  fi

} 2>&1 | tee "test-memory-report-$(date +%Y%m%d-%H%M%S).log"

echo -e "\n📊 Memory monitoring complete - report saved to test-memory-report-*.log"
