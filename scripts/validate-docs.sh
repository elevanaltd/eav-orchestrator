#!/bin/bash
# HestAI Documentation Standards Validation
# Based on hestai-doc-steward consultation

# Parse arguments
BLOCKING_ONLY=false
if [[ "$1" == "--blocking-only" ]]; then
    BLOCKING_ONLY=true
fi

echo "HestAI Documentation Standards Validation"
echo "========================================="

# Track validation status
FAILED=0

# Check for required documentation files
echo "Checking required documentation files..."

if [ ! -f "README.md" ]; then
    echo "❌ README.md is missing"
    FAILED=1
else
    echo "✅ README.md exists"
fi

if [ ! -f "CLAUDE.md" ]; then
    echo "❌ CLAUDE.md is missing"
    FAILED=1
else
    echo "✅ CLAUDE.md exists"
fi

if [ ! -d "docs" ]; then
    echo "❌ docs/ directory is missing"
    FAILED=1
else
    echo "✅ docs/ directory exists"
fi

# Check for ADR directory (warning only during early phases)
if [ ! -d "docs/adr" ]; then
    if [ "$BLOCKING_ONLY" == "false" ]; then
        echo "⚠️  Warning: docs/adr/ directory not found (will be required after B0)"
    fi
else
    echo "✅ docs/adr/ directory exists"
fi

# Exit with appropriate code
if [ $FAILED -eq 0 ]; then
    echo ""
    echo "✅ Documentation standards validation passed"
    exit 0
else
    echo ""
    echo "❌ Documentation standards validation failed"
    exit 1
fi
