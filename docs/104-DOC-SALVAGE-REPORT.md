# EAV Orchestrator Salvage Report & Restart Strategy

**Date:** 2025-09-09  
**Author:** Technical Architect  
**Status:** Final  

## Executive Summary

After comprehensive analysis of reference-old build and visual demo requirements, this report provides definitive guidance for restarting the EAV Orchestrator with proper architecture and narrowed scope.

## Critical Clarification

**"EAV" = Elevana AV** (company name), NOT Entity-Attribute-Value database pattern. This eliminates the primary architectural concern identified by critical-engineer.

## Scope Definition

### In Scope (V2-V8 Workflows Only)
- V2: Script Creation
- V3: Script Review  
- V4: Script Revision
- V5: Scenes Planning
- V6: VO Generation
- V8: Video Edit Guidance

### Out of Scope (Handled by SmartSuite)
- Project setup and management (P1-P12)
- Asset collection and management
- Filming logistics and booking
- Team assignment and resource allocation
- Client delivery and invoicing
- All non-content-creation workflows

## Salvage Analysis

### ✅ SALVAGE - High Value Components

#### 1. Core Business Requirements
```yaml
VALIDATED_REQUIREMENTS:
  Users: 10-20 concurrent (not 1000s)
  Approval: 3-state workflow (created → in_edit → approved)
  Roles: 5-role system (Admin, Internal, Freelancer, Client, Viewer)
  Performance:
    - Save latency: P95 ≤ 500ms
    - Comment sync: <200ms
    - Page load: <2 seconds
  Scale: 50-100 components per script

#### 2. Data Architecture Patterns
```sql
-- Proven content storage strategy
CREATE TABLE script_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id UUID NOT NULL REFERENCES scripts(id),
    position INTEGER NOT NULL,
    content_rich JSONB NOT NULL, -- TipTap JSON
    content_plain TEXT GENERATED ALWAYS AS (content_rich->>'plainText') STORED,
    content_hash TEXT GENERATED ALWAYS AS (md5(content_plain)) STORED,
    status TEXT CHECK (status IN ('draft', 'internal_approved', 'client_approved', 'stale')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. Real Production Data Patterns
```yaml
ECF_PROJECT_INSIGHTS:
  Components_Per_Script: 3-18 (average 11)
  Component_Length: 50-500 words (average 250)
  Semantic_Types:
    - Introduction: 25%
    - Operations: 40%
    - Maintenance: 20%
    - Safety: 10%
    - Support: 5%
```

### ❌ ABANDON - Over-Engineered Components

#### 1. Complex Distributed Architecture
- Redis/RedLock distributed locking
- Circuit breaker patterns
- Saga pattern implementations
- OpenTelemetry monitoring
- Event streaming architecture

#### 2. All Implementation Code
- BFF layer (over-complicated)
- UI components (incomplete)
- Test infrastructure (flawed approach)
- CI/CD setup (needs complete rebuild)

#### 3. Advanced Features
- ML-powered approval prediction
- Semantic content analysis
- Complex amendment cascading
- Multi-module orchestration

## Visual Demo Requirements

### Interface Structure (6 Tabs)
```yaml
TAB_ARCHITECTURE:
  1_Dashboard:
    Purpose: Project overview and task management
    Features: Status cards, progress bars, blockers
    
  2_Script_Editor:
    Purpose: V2-V4 Script workflows
    Layout: 3-column (videos | editor | comments)
    Features: Real-time collaboration, approval tracking
    
  3_Voice_Generation:
    Purpose: V6 VO Generation
    Layout: 3-column (settings | script | pronunciation)
    Features: Batch processing, pronunciation management
    
  4_Scene_Generation:
    Purpose: V5 Scene Planning
    Layout: 3-column (management | shot lists | library)
    Features: 1:1 mapping, inline editing, reusable components
    
  5_Edit_Direction:
    Purpose: V8 Video Edit Guidance
    Layout: 3-column (videos | script | directions)
    Features: Categorized directions, task tracking
    
  6_Project_Overview:
    Purpose: Multi-project management
    Layout: Card grid system
    Features: Analytics, capacity management
```

## Recommended Architecture

### Simplified 2-Stream Workflow
```yaml
SCRIPT_STREAM:
  V2_Script_Creation:
    Interface: Script Editor tab
    Output: Draft script components
    
  V3_Script_Review:
    Interface: Script Editor comments
    Gate: Approval required
    
  V4_Script_Revision:
    Interface: Script Editor
    Trigger: Changes requested
    
PRODUCTION_STREAM:
  V5_Scenes_Planning:
    Interface: Scene Generation tab
    Dependency: Script approved
    Output: Shot lists
    
  V6_VO_Generation:
    Interface: Voice Generation tab
    Dependency: Script approved
    Parallel: Can run with V5
    
  V8_Edit_Guidance:
    Interface: Edit Direction tab
    Dependency: V5 + V6 complete
    Output: Guidance for editors
```

### Technology Stack
```yaml
CORE_STACK:
  Database: PostgreSQL with JSONB
  Auth: Supabase (real, not mocked)
  Frontend: React with TipTap editor
  Real-time: Supabase Realtime
  Styling: Tailwind CSS
  
INTEGRATIONS:
  SmartSuite: REST API for project data
  ElevenLabs: Voice generation API
  Frame.io: Review integration (future)
```

## Implementation Plan

### Phase 1: Foundation (Week 1)
1. Set up PostgreSQL with proper schema
2. Implement Supabase auth with 5 roles
3. Create basic 3-column layout
4. Integrate TipTap editor
5. Build Script Editor interface (V2)

### Phase 2: Core Features (Week 2)
1. Real-time comments system
2. Approval workflow (V3)
3. Script revision flow (V4)
4. Scene planning interface (V5)
5. SmartSuite integration layer

### Phase 3: Production Features (Week 3)
1. Voice generation interface (V6)
2. Pronunciation management
3. Edit direction system (V8)
4. Progress tracking
5. Export capabilities

## Critical Success Factors

1. **Real Authentication**: Start with actual Supabase auth, no mocks
2. **Realistic Data**: Use ECF project patterns, not theoretical maximums
3. **Simple Architecture**: PostgreSQL + JSONB, no distributed systems
4. **Focused Scope**: V2-V8 only, SmartSuite handles the rest
5. **Performance Targets**: 500ms saves (realistic), not 50ms (unnecessary)

## Lessons Learned

### What Failed
- Trying to build comprehensive video production system
- Over-engineering for theoretical scale
- Mock authentication blocking production
- Complex distributed architecture for 10-20 users

### What Works
- TipTap + plain text projections
- 3-state approval workflow
- 5-role permission system
- 1:1 component-to-scene mapping
- Real ECF content patterns

## Next Steps

1. **Immediate**: Copy North Star documents as drafts for validation
2. **Today**: Create B0 Vision & Analysis Document with narrowed scope
3. **This Week**: Set up development environment with real auth
4. **Week 1**: Implement Phase 1 foundation

## Approval

// Critical-Engineer: consulted for Architecture pattern selection
// Technical-Architect: Validated restart strategy aligns with business requirements

---

**Recommendation**: Proceed with focused rebuild targeting V2-V8 workflows only, using salvaged business requirements but abandoning all implementation code.