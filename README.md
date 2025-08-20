# EAV Orchestrator

**Collaborative Video Production System**

A modern web application enabling distributed teams to collaboratively create video content through structured script development, real-time editing, and streamlined production workflows.

## System Overview

The EAV Orchestrator addresses the complex coordination challenges in modern video production by providing:

- **Collaborative Script Editing**: Real-time multi-user editing with conflict resolution
- **Component-to-Scene Mapping**: Structured content organization and tracking
- **Role-Based Access Control**: Fine-grained permissions for different team roles
- **Production Workflow Management**: Guided processes from concept to delivery
- **Real-Time Synchronization**: Sub-200ms updates for collaborative features

## Core Capabilities

### Script Module
- Rich text editing with TipTap integration
- Real-time commenting and feedback systems
- Version control and approval workflows
- Component lifecycle management

### User Management
- Multi-role authentication (Admin, Internal, Freelancer, Client, Viewer)
- Permission-based feature access
- Team collaboration tools

### Data Architecture
- UUID-based entity management
- Audit trails for all changes
- Scalable data models supporting 100s of projects

## Technology Foundation

- **Database**: UUID primary keys with human-readable display fields
- **Real-time**: Sub-200ms collaborative editing synchronization
- **Authentication**: 5-role permission system
- **Rich Text**: TipTap editor with JSON storage + plain text projections

## Performance Targets

- **Scale**: 10-20 concurrent users
- **Response Time**: P95 ≤ 500ms for saves
- **Page Load**: <2s for script editing interfaces
- **Real-time Sync**: <200ms for collaborative features

## Getting Started

This is a fresh implementation. For development setup and coordination information:

- **Coordination**: See `.coord/` directory for project management
- **Development**: See `CLAUDE.md` for implementation guidelines

## Repository Structure

```
build/                      # Implementation repository
├── src/                    # Source code (to be created)
├── tests/                  # Test suites (to be created)
├── docs/                   # Technical documentation
├── scripts/                # Development tools
├── README.md              # This file
└── CLAUDE.md             # Development instructions
```

---

**Status**: Fresh build in development  
**Architecture**: To be defined in B0 phase