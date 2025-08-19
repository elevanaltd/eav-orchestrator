# EAV Orchestrator

**Collaborative Video Production System**

A modular system designed for 10-20 concurrent users managing video production workflows from script creation through delivery. Built with realistic scaling in mind, focusing on 95% automation with manual overrides.

## Project Overview

EAV Orchestrator supports the complete video production workflow:

- **Script Management**: Collaborative editing with modular components, real-time commenting, and approval workflows
- **Production Coordination**: Scheduling, scene management, and status tracking
- **Asset Management**: Storage, versioning, and cross-project reuse of media assets
- **Review & Approval**: Two-stage review process with timestamped feedback
- **Delivery**: Controlled access links with analytics and permissions

## Architecture Philosophy

- **Modular Design**: Script Module as standalone first component, followed by phased expansion
- **Realistic Scaling**: Built for actual business needs (10-20 users, 100s of projects)
- **Clean Data Architecture**: UUID primary keys with human-readable display fields
- **Parallel Processing**: Non-blocking workflows for efficient team coordination

## Current Status

**Phase:** D1 → B0 Transition  
**Next Milestone:** B0 Vision & Analysis Document

### North Star Documents
- [System North Star](/Volumes/HestAI/builds/eav-orchestrator/system/docs/000-EAV_SYSTEM-D1-NORTH_STAR.md)
- [Script Module North Star](/Volumes/HestAI/builds/eav-orchestrator/modules/script-module/docs/000-EAV_SCRIPT-D1-NORTH_STAR.md)

### Key Performance Targets
- Save latency: P95 ≤ 500ms for 10-20 users
- Page load: < 2 seconds
- Comment sync: < 200ms
- Support for 3x growth target

## Development

### Prerequisites
- [Development environment setup documentation pending]
- [Technology stack decisions pending B0 phase]

### Quality Standards
- Test-Driven Development (TDD) with RED-GREEN-REFACTOR cycle
- TRACED protocol compliance for all development activities
- Architectural decisions recorded in ADR format
- Evidence-based implementation log maintained

### Directory Structure
```
/Volumes/HestAI-Projects/eav-orchestrator/
├── docs/                    # Bridge documents (project state index)
├── build/                   # This repository (implementation artifacts)
│   ├── src/                 # Source code
│   ├── tests/               # Test suites
│   ├── docs/                # Implementation documentation
│   │   ├── adr/             # Architectural Decision Records
│   │   └── *.md             # Build plans, implementation logs
│   ├── README.md            # This file
│   └── CLAUDE.md            # Development instructions
└── sessions/                # Project conversations
```

## Links

### Project Management
- [Project Context](../docs/201-PROJECT-EAV-D1-CONTEXT.md)
- [Implementation Log](./docs/201-PROJECT-EAV-B1-IMPLEMENTATION-LOG.md)
- [Build Plan](./docs/201-PROJECT-EAV-B1-BUILD-PLAN.md)

### Architecture
- [Architectural Decisions](./docs/adr/)
- [Directory Structure ADR](./docs/adr/101-SYSTEM-DIRECTORY-STRUCTURE.md)

### Development
- [Development Instructions](./CLAUDE.md)
- [Project Sessions](../sessions/)

## Team

- **Implementation Lead:** [Assignment Pending]
- **Technical Architect:** [Assignment Pending]
- **Script Module Specialist:** [Assignment Pending]
- **System Integration Lead:** [Assignment Pending]

## License

[License information to be determined]

---

**Last Updated:** 2025-08-19  
**Maintained by:** EAV Orchestrator Development Team