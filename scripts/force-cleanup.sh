#!/bin/bash

# MEMORY LEAK FIX: Aggressive cleanup of all Node/Vitest processes
echo "🧹 Force cleaning all Node.js and Vitest processes..."

# Kill all vitest processes
pkill -9 -f vitest 2>/dev/null || true

# Kill all node processes that might be test-related
pkill -9 -f "node.*vitest" 2>/dev/null || true
pkill -9 -f "node.*test" 2>/dev/null || true

# Wait for processes to die
sleep 2

# Check remaining processes
REMAINING=$(ps aux | grep -E "(vitest|node.*test)" | grep -v grep | wc -l)

if [ "$REMAINING" -eq 0 ]; then
    echo "✅ All test processes cleaned successfully"
else
    echo "⚠️  Warning: $REMAINING processes may still be running"
    ps aux | grep -E "(vitest|node.*test)" | grep -v grep
fi

echo "🔄 Ready for clean test run"