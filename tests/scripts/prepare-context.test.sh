#!/bin/bash
#
# Test suite for prepare-context.sh
# Tests the context preparation functionality

set -e

SCRIPT_PATH="./scripts/prepare-context.sh"
TEST_OUTPUT_FILE=".claude/current-context.md"

echo "🧪 Testing prepare-context.sh"

# Test 1: Script should exist and be executable
test_script_exists() {
    if [ ! -f "$SCRIPT_PATH" ]; then
        echo "❌ Test 1 FAILED: Script does not exist at $SCRIPT_PATH"
        return 1
    fi
    
    if [ ! -x "$SCRIPT_PATH" ]; then
        echo "❌ Test 1 FAILED: Script is not executable"
        return 1
    fi
    
    echo "✅ Test 1 PASSED: Script exists and is executable"
    return 0
}

# Test 2: Script should create output file
test_creates_output() {
    rm -f "$TEST_OUTPUT_FILE"
    
    $SCRIPT_PATH "test task" > /dev/null 2>&1
    
    if [ ! -f "$TEST_OUTPUT_FILE" ]; then
        echo "❌ Test 2 FAILED: Output file not created at $TEST_OUTPUT_FILE"
        return 1
    fi
    
    echo "✅ Test 2 PASSED: Output file created"
    return 0
}

# Test 3: Output should contain task description
test_contains_task() {
    $SCRIPT_PATH "collaboration feature" > /dev/null 2>&1
    
    if ! grep -q "collaboration feature" "$TEST_OUTPUT_FILE"; then
        echo "❌ Test 3 FAILED: Output does not contain task description"
        return 1
    fi
    
    echo "✅ Test 3 PASSED: Output contains task description"
    return 0
}

# Test 4: Should extract keywords from task
test_extracts_keywords() {
    $SCRIPT_PATH "Fix CustomSupabaseProvider connection" > /dev/null 2>&1
    
    if ! grep -q "Keywords:" "$TEST_OUTPUT_FILE"; then
        echo "❌ Test 4 FAILED: Output does not contain keywords section"
        return 1
    fi
    
    echo "✅ Test 4 PASSED: Keywords extracted from task"
    return 0
}

# Test 5: Should include git context
test_includes_git_context() {
    $SCRIPT_PATH "test task" > /dev/null 2>&1
    
    if ! grep -q "Recent Activity" "$TEST_OUTPUT_FILE"; then
        echo "❌ Test 5 FAILED: Output does not contain git activity"
        return 1
    fi
    
    if ! grep -q "Current Branch" "$TEST_OUTPUT_FILE"; then
        echo "❌ Test 5 FAILED: Output does not contain branch info"
        return 1
    fi
    
    echo "✅ Test 5 PASSED: Git context included"
    return 0
}

# Run all tests
FAILED=0

test_script_exists || FAILED=$((FAILED + 1))
test_creates_output || FAILED=$((FAILED + 1))
test_contains_task || FAILED=$((FAILED + 1))
test_extracts_keywords || FAILED=$((FAILED + 1))
test_includes_git_context || FAILED=$((FAILED + 1))

if [ $FAILED -eq 0 ]; then
    echo "🎉 All tests passed!"
    exit 0
else
    echo "💔 $FAILED test(s) failed"
    exit 1
fi