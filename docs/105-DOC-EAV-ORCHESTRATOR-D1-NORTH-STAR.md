# EAV Orchestrator - Unified North Star

**Project:** Elevana AV Orchestrator - Content Creation Workflows  
**Date:** 2025-09-09  
**Status:** Authoritative (Requirements Immutable)  
**Scope:** V2-V8 Content Workflows Only  

## Executive Summary

A focused collaborative tool for video production content workflows, handling script creation through edit guidance. SmartSuite separately manages all project coordination, asset management, and business operations for EAV. This tool is for operations, and will start off standalone.

**Critical Scope Constraint:** Build ONLY what enables V2-V8 workflows. Everything else is explicitly out of scope.

## Problem Statement

### Current State
- ECF projects use disconnected tools for script → edit guidance workflows
- Script creation to scene planning takes 1-2 days (target: 2-3 hours)
- Comment sync and collaboration happens via email/docs
- 10-20 concurrent users need smooth script editing experience
- £2.5M+ business growth blocked by workflow inefficiencies

### Target State
- Seamless V2-V8 content creation workflow in single interface
- Real-time collaborative script editing with <200ms comment sync
- 1:1 script component to scene mapping with automated VO generation
- Edit guidance system connecting all workflow outputs
- No project/business coordination. SmartSuite handles this separately.

## Scope Definition (IMMUTABLE)

### ✅ IN SCOPE - V2-V8 Content Workflows
```yaml
V2_Script_Creation:
  Interface: Script Editor (TipTap rich text)
  Output: Script components (3-18 per video, avg 250 words)
  Features: Real-time collaboration, auto-save, version tracking
  
V3_Script_Review:
  Interface: Comments system in Script Editor  
  Output: Approval decisions (3-state workflow)
  Features: Role-based commenting, approval tracking
  
V4_Script_Revision:
  Interface: Script Editor with change tracking
  Output: Revised script components
  Features: Amendment workflow, change detection
  
V5_Scenes_Planning:
  Interface: Scene Generation tab
  Output: Detailed shot lists (1:1 component mapping)
  Features: Scene templates, requirements tracking
  
V6_VO_Generation:
  Interface: Voice Generation tab
  Output: AI-generated voiceover files
  Features: Pronunciation management, batch processing
  
V8_Edit_Guidance:
  Interface: Edit Direction tab
  Output: Comprehensive edit instructions
  Features: Categorized directions, task tracking
```

### ❌ OUT OF SCOPE - SmartSuite Domain
```yaml
Project_Management: P1-P12 tasks, resource allocation, scheduling
Asset_Management: Branding collection, file organization, storage
Filming_Logistics: Booking, crew coordination, equipment management
Client_Relations: Delivery management, invoicing, contracts
Team_Management: User provisioning, role assignments, capacity planning
```

### 🔄 FUTURE INTEGRATION DESIGN (Phase 4+)
- PHASE 1-3 = NONE. This will be standalone

- PHASE 4 = SmartSuite Integration (pending Phase 3 completion review)
```yaml
SmartSuite_To_EAV:
  - Basic project metadata and client information
  
EAV_To_SmartSuite:
  - Script completion status updates
  - Scene planning deliverables
  - VO generation completion notifications
  - Edit guidance package delivery

Note: Integration specifications for Phase 4+ planning only. Phases 1-3 operate standalone with manual data entry.
```

## Business Requirements

### Scale & Performance
```yaml
Users: 10-20 concurrent (validated from ECF usage patterns)
Projects: Support 100s of projects simultaneously
Performance:
  - Save latency: P95 ≤ 500ms (realistic target)
  - Comment sync: <200ms (collaboration requirement)
  - Page load: <2s for script editing
  - Presence updates: <500ms (awareness requirement)
Growth: Support 3x current volume without architectural changes
```

### Content Patterns (ECF-Validated)
```yaml
Script_Structure:
  - Components per video: 3-18 (average 11)
  - Words per component: 50-500 (average 250)
  - Semantic types: Introduction (25%), Operations (40%), Maintenance (20%), Safety (10%), Support (5%)
  
Real_Examples:
  - MVHR System: 11 components, technical instructions
  - Samsung Dishwasher: 18 components, step-by-step procedures
  - Expansion Gap: 3 components, explanatory content
```

### User Roles & Permissions
```yaml
Admin: Full system access, all capabilities
Internal: All production work, client approval delegation
Freelancer: Content creation, assigned project access only
Client: Review, comment, approve - no editing capabilities
Viewer: Read-only access for stakeholders
```

## Technical Requirements

### Core Architecture
```yaml
Database: PostgreSQL with JSONB for rich content
Authentication: Supabase with 5-role RLS system
Real-time: Supabase Realtime for collaboration
Rich_Text: TipTap editor with JSON storage + plain text projections
Change_Detection: Semantic hashing for content versioning
```

### Supabase Infrastructure Requirements
```yaml
Tier_Requirement: Supabase PRO (minimum)
Project_ID: tsizhlsbmwytqccjavap

Pro_Tier_Rationale:
  Connection_Pooling:
    - Supavisor pooler required for 10-20 concurrent users
    - Session mode (port 5432) for migrations and long operations
    - Transaction mode (port 6543) for API/BFF connections
    - Current config: Shared pooler (IPv4 compatible)
    
  Real_time_Requirements:
    - Yjs CRDT synchronization via broadcast channels
    - Comment sync <200ms latency target
    - Presence tracking for collaborative editing
    - Events per second limit: 10 (configured in client)
    
  Database_Features:
    - JSONB storage for TipTap rich text content
    - Row Level Security (RLS) for 5-role system
    - Optimistic locking functions for concurrent editing
    - UUID primary keys with PostgreSQL 17
    
  Production_Needs:
    - Point-in-time recovery for data protection
    - Database branching for safe migrations
    - Connection monitoring and alerting
    - 99.5% uptime SLA requirement

Connection_Architecture:
  BFF_Service:
    - Singleton pattern for connection reuse
    - HTTP keep-alive for persistent connections  
    - Service role authentication (no token refresh)
    - Connection pooling via x-connection-pool header
    
  Frontend_Collaboration:
    - y-supabase provider for CRDT sync
    - IndexedDB fallback for offline resilience
    - Circuit breaker pattern for API failures
    - Debounced saves (1s) to prevent overload

Production_Configuration:
  Primary_URL: aws-1-eu-west-2.pooler.supabase.com
  Pooler_Port: 6543 (transaction mode)
  Direct_Port: 5432 (session mode for migrations)
  Database_Version: PostgreSQL 17
  Max_Connections: 100 (pooler limit)
  Default_Pool_Size: 20 per user/database pair
```

### Integration Architecture  
```yaml
ElevenLabs_API:
  - Voice generation with pronunciation management
  - Batch processing for efficiency
  - Error recovery with regeneration capability
  - Audio storage: Hybrid LucidLink + Supabase approach
```

### Quality Standards
```yaml
Data_Integrity:
  - No data loss during concurrent editing
  - 100% audit trail for all changes
  - Zero internal data visible to clients
  - 1:1 component-to-scene mapping guaranteed
  
Security:
  - Role-based access enforcement
  - Secure API key management
  - Audit retention: 365 days
```

## Success Criteria

### Quantitative Metrics
```yaml
Performance:
  - Script save: P95 ≤ 500ms achieved
  - Comment sync: <200ms latency measured
  - System availability: >99.5% uptime
  - Concurrent users: 10-20 smooth operation validated

Business_Impact:
  - Script-to-scene time: 1-2 days → 2-3 hours
  - Comment resolution: Email threads → real-time collaboration
  - Error reduction: Trackable change history eliminates version conflicts
  - User adoption: 100% of ECF workflows migrated within 30 days
```

### Qualitative Success
```yaml
User_Experience:
  - Google Docs-style collaboration experience
  - Intuitive 6-tab interface matching visual demo
  - Seamless workflow from script to edit guidance
  - Clear role boundaries prevent access confusion

Technical_Success:
  - Clean separation between content workflows and project management
  - Reliable SmartSuite integration without tight coupling
  - Maintainable codebase following TRACED methodology
  - Production deployment with zero client data exposure
```

## Architecture Constraints

### Scope Protection Mechanisms
```yaml
Anti_Scope_Creep:
  - Requirements-steward validation at all phase boundaries
  - "SmartSuite does this" decision framework for new features
  - Visual demo as maximum scope boundary reference
  - V2-V8 workflow focus enforcement in all design decisions

Integration_Boundaries:
  - EAV Orchestrator owns content creation workflows only
  - SmartSuite remains authoritative for project coordination
  - No user management beyond authentication delegation
  - No asset storage beyond operational caching
```

### Technical Boundaries
```yaml
Complexity_Limits:
  - No distributed systems patterns for 10-20 user scale
  - No microservices - single application architecture
  - No custom authentication - delegate to Supabase
  - No custom file storage - use existing LucidLink + cache strategy

Performance_Constraints:
  - Build for actual scale (10-20 users), not theoretical thousands
  - Optimize for collaboration latency, not raw throughput
  - Focus on content editing performance over analytics/reporting
  - Use proven technologies, avoid experimental solutions
```

## Risks & Mitigations

### Critical Risks
```yaml
Scope_Creep:
  Risk: Feature requests pull toward full project management system
  Mitigation: Immutable North Star, "SmartSuite does this" framework
  
Integration_Failure:
  Risk: SmartSuite API unavailability blocks workflows
  Mitigation: 24-hour local cache, graceful degradation UI
  
Performance_Degradation:
  Risk: Real-time features impact editing performance
  Mitigation: Performance budgets, P95 latency monitoring
  
User_Confusion:
  Risk: Unclear boundaries between EAV and SmartSuite
  Mitigation: Clear UI indicators, role-based access enforcement
```

### Acceptable Risks
```yaml
Limited_Offline: Users can't work offline beyond 24-hour cache window
Vendor_Dependency: Reliance on Supabase and ElevenLabs APIs
Scale_Ceiling: Architecture targets 3x growth, not 10x exponential
Feature_Minimalism: Focused tool may not satisfy power user requests
```

## Implementation Phases

### Phase 1: Script Workflows (Weeks 1-2)
```yaml
Foundation:
  - Supabase authentication and database setup
  - Script Editor with TipTap integration
  - Basic 3-column layout matching visual demo
  
Core_Features:
  - V2: Script creation with component structure
  - V3: Comments system with real-time sync
  - V4: Revision workflow with change detection
```

### Phase 2: Production Workflows (Weeks 3-4)
```yaml
Scene_Planning:
  - V5: Scene Generation interface
  - 1:1 component mapping implementation
  - Shot list management with inline editing
  
Voice_Generation:
  - V6: ElevenLabs integration
  - Pronunciation management system
  - Batch processing capabilities
```

### Phase 3: Edit Guidance (Week 5)
```yaml
Edit_Direction:
  - V8: Categorized direction system
  - Multi-role collaboration for editors
  - Export capabilities for edit handoff
```

### Phase 4: SmartSuite integration
```yaml
Integration:
  - SmartSuite API connection
  - Status synchronization
  - Production deployment
```

## Validation & Approval

### Architectural Validation
```yaml
Critical_Engineer: Architectural approach validated for production scale
Technical_Architect: Integration patterns approved for SmartSuite coordination
Requirements_Steward: Scope boundaries enforced and integration contracts defined
```

### Business Validation
```yaml
Stakeholder_Approval: V2-V8 focus aligns with operational requirements
Success_Metrics: Quantitative targets achievable within technical constraints
Risk_Acceptance: Identified risks acceptable for business value delivered
```

---

**IMMUTABILITY CLAUSE:** This North Star defines authoritative scope boundaries. Changes require full D1 phase restart with critical-engineer approval.

**ENFORCEMENT:** Requirements-steward mandatory consultation for any scope expansion requests.

// Critical-Engineer: consulted for Architecture pattern selection  
// Requirements-Steward: validated for scope boundaries and integration contracts