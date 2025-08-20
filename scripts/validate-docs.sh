#!/bin/bash
# HestAI Documentation Standards Validator
# Based on hestai-doc-steward consultation

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Exit codes
EXIT_SUCCESS=0
EXIT_BLOCKING_ERROR=1

# Counters
ERRORS=0
WARNINGS=0

# Validation patterns from doc-steward
NAMING_PATTERN='^[0-9]{3}-(DOC|SYSTEM|PROJECT|WORKFLOW|SCRIPT|AUTH|UI|RUNTIME|DATA|SEC|OPS|BUILD|REPORT)(-[A-Z0-9]+)?-[A-Z0-9]+(-[A-Z0-9]+)*\.(md|oct\.md)$'
FORBIDDEN_SUFFIXES='(_v[0-9]+|_v[0-9]+\.[0-9]+|_final|_latest|_draft|_old|_new|_copy|_backup)'
PROJECT_PHASE_PATTERN='^[0-9]{3}-PROJECT.*-(D1|D2|D3|B0|B1|B2|B3|B4)-.*\.md$'
ADR_PATTERN='^[0-9]{3}-.*\.md$'

# Function to print colored output
print_error() {
    echo -e "${RED}❌ ERROR: $1${NC}" >&2
    ((ERRORS++))
}

print_warning() {
    echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
    ((WARNINGS++))
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo "ℹ️  $1"
}

# Check 1: Validate filename patterns
check_naming_conventions() {
    print_info "Checking document naming conventions..."
    
    while IFS= read -r -d '' file; do
        filename=$(basename "$file")
        dirname=$(dirname "$file")
        
        # Skip .git and node_modules
        if [[ "$file" == */.git/* ]] || [[ "$file" == */node_modules/* ]]; then
            continue
        fi
        
        # Special handling for ADR directory
        if [[ "$dirname" == *"/adr" ]] || [[ "$dirname" == *"/adr/"* ]]; then
            if ! [[ "$filename" =~ $ADR_PATTERN ]]; then
                print_error "ADR file '$file' doesn't follow pattern: NNN-*.md"
            fi
            continue
        fi
        
        # Check main naming pattern for docs
        if [[ "$dirname" == "./docs" ]] || [[ "$dirname" == "docs" ]]; then
            if ! [[ "$filename" =~ $NAMING_PATTERN ]]; then
                print_error "File '$file' doesn't follow naming convention"
                print_info "  Expected: NNN-{CATEGORY}[-{QUALIFIER}]-{NAME}.md"
                print_info "  Categories: DOC|SYSTEM|PROJECT|WORKFLOW|SCRIPT|AUTH|UI|RUNTIME|DATA|SEC|OPS|BUILD|REPORT"
            fi
            
            # Check for PROJECT phase requirement
            if [[ "$filename" =~ ^[0-9]{3}-PROJECT ]]; then
                if ! [[ "$filename" =~ $PROJECT_PHASE_PATTERN ]]; then
                    print_error "PROJECT document '$file' missing phase (D1|D2|D3|B0|B1|B2|B3|B4)"
                fi
            fi
        fi
        
        # Check for forbidden version suffixes
        if [[ "$filename" =~ $FORBIDDEN_SUFFIXES ]]; then
            print_error "File '$file' contains forbidden version suffix (use git for versioning)"
        fi
        
    done < <(find ./docs ./reports ./_archive -name "*.md" -type f -print0 2>/dev/null || true)
}

# Check 2: Validate directory structure
check_directory_structure() {
    print_info "Checking directory structure requirements..."
    
    # Check required directories exist
    if [ ! -d "docs" ]; then
        print_error "Required directory 'docs/' is missing"
    fi
    
    if [ ! -d "docs/adr" ]; then
        print_warning "Directory 'docs/adr/' is missing (will be required after B0)"
    fi
    
    # Check directory depth (max 2 levels under docs/)
    while IFS= read -r -d '' dir; do
        # Count slashes to determine depth
        rel_path=${dir#./docs/}
        depth=$(echo "$rel_path" | tr -cd '/' | wc -c)
        
        if [ "$depth" -gt 1 ]; then
            print_error "Directory '$dir' exceeds maximum depth (max 2 levels under docs/)"
        fi
    done < <(find ./docs -type d -print0 2>/dev/null || true)
}

# Check 3: Validate archive headers
check_archive_headers() {
    if [ ! -d "_archive" ]; then
        return  # No archive directory yet
    fi
    
    print_info "Checking archive headers..."
    
    while IFS= read -r -d '' file; do
        # Check for required archive headers
        if ! grep -q "Status: Archived" "$file" 2>/dev/null; then
            print_warning "Archive file '$file' missing 'Status: Archived' header"
        fi
        
        if ! grep -q "Archived: [0-9]{4}-[0-9]{2}-[0-9]{2}" "$file" 2>/dev/null; then
            print_warning "Archive file '$file' missing 'Archived: YYYY-MM-DD' header"
        fi
        
        if ! grep -q "Original-Path:" "$file" 2>/dev/null; then
            print_warning "Archive file '$file' missing 'Original-Path:' header"
        fi
    done < <(find ./_archive -name "*.md" -type f -print0 2>/dev/null || true)
}

# Check 4: Detect potential duplicates
check_duplicates() {
    print_info "Checking for potential duplicate documents..."
    
    # Use temporary file for compatibility with older bash versions
    local temp_file="/tmp/doc_patterns_$$"
    > "$temp_file"
    
    while IFS= read -r -d '' file; do
        filename=$(basename "$file")
        # Extract the core pattern (number and category)
        if [[ "$filename" =~ ^([0-9]{3}-[A-Z]+) ]]; then
            pattern="${BASH_REMATCH[1]}"
            # Check if pattern already exists in temp file
            if grep -q "^$pattern:" "$temp_file" 2>/dev/null; then
                existing=$(grep "^$pattern:" "$temp_file" | cut -d: -f2)
                print_warning "Potential duplicate pattern '$pattern' in:"
                print_info "  - $existing"
                print_info "  - $file"
            else
                echo "$pattern:$file" >> "$temp_file"
            fi
        fi
    done < <(find ./docs -name "*.md" -type f -print0 2>/dev/null || true)
    
    # Clean up temp file
    rm -f "$temp_file"
}

# Check 5: Suggest OCTAVE compression (informational)
check_octave_opportunities() {
    print_info "Checking for OCTAVE compression opportunities..."
    
    while IFS= read -r -d '' file; do
        filename=$(basename "$file")
        
        # Skip if already OCTAVE compressed
        if [[ "$filename" == *.oct.md ]]; then
            continue
        fi
        
        # Count lines and pattern density
        if [ -f "$file" ]; then
            line_count=$(wc -l < "$file")
            pattern_count=$(grep -c -E "(MUST|SHOULD|SHALL|::|→|REQUIREMENT|CONSTRAINT)" "$file" 2>/dev/null || echo "0")
            
            if [ "$line_count" -gt 100 ] && [ "$pattern_count" -gt 20 ]; then
                density=$((pattern_count * 100 / line_count))
                if [ "$density" -gt 15 ]; then
                    print_info "File '$file' might benefit from OCTAVE compression"
                    print_info "  Lines: $line_count, Pattern density: ${density}%"
                fi
            fi
        fi
    done < <(find ./docs -name "*.md" -type f -print0 2>/dev/null || true)
}

# Main execution
main() {
    echo "==============================================="
    echo "HestAI Documentation Standards Validator"
    echo "==============================================="
    echo ""
    
    # Run all checks
    check_naming_conventions
    check_directory_structure
    check_archive_headers
    check_duplicates
    
    # Informational checks (don't affect exit code)
    if [ "${1:-}" != "--blocking-only" ]; then
        check_octave_opportunities
    fi
    
    # Summary
    echo ""
    echo "==============================================="
    echo "Validation Summary"
    echo "==============================================="
    
    if [ "$ERRORS" -eq 0 ]; then
        print_success "All blocking checks passed!"
    else
        print_error "Found $ERRORS blocking error(s)"
    fi
    
    if [ "$WARNINGS" -gt 0 ]; then
        print_warning "Found $WARNINGS warning(s)"
    fi
    
    # Exit with appropriate code
    if [ "$ERRORS" -gt 0 ]; then
        exit $EXIT_BLOCKING_ERROR
    else
        exit $EXIT_SUCCESS
    fi
}

# Run main function with all arguments
main "$@"