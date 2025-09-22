#!/bin/bash

# MEMORY LEAK FIX: Safe test execution script with memory management
# This script runs Vitest with Node.js flags optimized for memory management

echo "🧪 Running tests with memory-safe configuration..."

# Set Node.js memory management flags
export NODE_OPTIONS="--max-old-space-size=2048 --expose-gc"

# Kill any existing vitest processes
pkill -f vitest 2>/dev/null || true

# Run tests with memory management
node --expose-gc --max-old-space-size=2048 ./node_modules/.bin/vitest run "$@"

# Check exit code
EXIT_CODE=$?

# Clean up any remaining processes
pkill -f vitest 2>/dev/null || true

echo "✅ Test run complete. Cleaning up..."

# Exit with the test exit code
exit $EXIT_CODE