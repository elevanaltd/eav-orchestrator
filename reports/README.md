# Reports Directory

**Purpose:** Time-bound analyses, audits, retrospectives, and assessments

## Content Types

### 8xx :: REPORTS Category
- **Security Audits:** `801-REPORT-SECURITY-AUDIT.oct.md`
- **Performance Analyses:** `802-REPORT-PERFORMANCE-ANALYSIS.md`
- **Retrospectives:** `803-REPORT-PHASE-RETROSPECTIVE.md`
- **Code Quality Assessments:** `804-REPORT-CODE-QUALITY.md`
- **Architecture Reviews:** `805-REPORT-ARCHITECTURE-REVIEW.md`

## Naming Convention

Pattern: `{8NN}-REPORT[-{QUALIFIER}]-{NAME}.{EXT}`

Examples:
- `801-REPORT-SECURITY-AUDIT.oct.md`
- `802-REPORT-LOAD-TEST.md` 
- `2025-08-20-803-REPORT-RETRO.md` (with optional date prefix)

## Guidelines

### When to Add Date Prefix
Add `YYYY-MM-DD-` prefix when chronological sequence matters:
- Sprint retrospectives
- Incident reports
- Regular audit cycles
- Time-series analyses

### Archive Policy
Reports are archived following standard archival rules:
- Move to `_archive/reports/` when superseded
- Preserve original filename and sequence number
- Add required archive header

## Future Expansion

Reserved sequence ranges:
- `801-809`: Security reports
- `810-819`: Performance reports  
- `820-829`: Quality reports
- `830-839`: Architecture reports
- `840-849`: Incident reports
- `850-859`: Retrospectives
- `860-869`: Audits
- `870-879`: Analyses
- `880-889`: Assessments
- `890-899`: Reviews

---

**Maintenance:** Update sequence ranges as report categories expand