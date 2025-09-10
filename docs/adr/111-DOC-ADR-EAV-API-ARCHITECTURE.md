# ADR-111: API Service Architecture for External Integrations

**Status:** ACCEPTED  
**Date:** 2025-09-10  
**Deciders:** Critical Engineer, Workspace Architect  
**Technical Impact:** HIGH (affects all external API integrations)  

## Context

The EAV Orchestrator requires external API integrations for SmartSuite (project management) and ElevenLabs (voice generation). Critical Blocker #2 in the B1 Build Plan requires circuit breaker pattern implementation but the API service architecture was undefined, creating security and implementation blockers.

## Decision

**ADOPTED: Serverless Functions Approach with Vercel KV State Management**

We will implement external API integrations using dedicated Vercel serverless functions with distributed circuit breaker state managed through Vercel KV (Redis-based key-value store).

## Options Considered

### Option 1: Backend for Frontend (BFF) Pattern
**Status:** REJECTED  
**Reasons:**
- Creates single point of failure for all external API interactions
- Introduces operational overhead misaligned with Vercel/React 19 stack
- Server process crash would sever all external connectivity
- Additional infrastructure complexity

### Option 2: Serverless Functions Approach (SELECTED)
**Status:** ACCEPTED  
**Rationale:**
- Aligns with Vercel deployment target and React 19 stack
- Provides superior fault isolation per service
- Scales efficiently with serverless model
- No single point of failure

### Option 3: Frontend Proxy with Security Layer
**Status:** REJECTED  
**Reasons:**
- **CRITICAL SECURITY FLAW:** Would expose API keys in frontend code
- Browser-based circuit breaker insufficient for server-side failures
- Eliminates ability to protect sensitive credentials

## Architectural Decision Details

### Service Architecture
```yaml
API_Functions:
  SmartSuite_Integration:
    - "/api/smartsuite/[...proxy].ts" (proxy all SmartSuite endpoints)
    - Environment: SMARTSUITE_API_KEY, SMARTSUITE_WORKSPACE_ID
    - Circuit Breaker: "circuit-breaker:smartsuite" (Vercel KV key)
    
  ElevenLabs_Integration:
    - "/api/elevenlabs/jobs.ts" (create voice generation jobs)
    - "/api/elevenlabs/status/[jobId].ts" (check job status)
    - Environment: ELEVENLABS_API_KEY
    - Circuit Breaker: "circuit-breaker:elevenlabs" (Vercel KV key)
    
  Background_Processing:
    - "/api/cron/poll-elevenlabs.ts" (cron-triggered status polling)
    - Supabase table: async_jobs (job state management)
    - Schedule: Every minute via Vercel Cron Jobs

Circuit_Breaker_State:
  Technology: Vercel KV (serverless Redis)
  Library: opossum with custom Vercel KV store adapter
  State_Keys: "circuit-breaker:${service_name}"
  Timeout: 30 seconds
  Failure_Threshold: 5 consecutive failures
  Half_Open_Retry: 60 seconds
```

### Implementation Strategy

#### 1. Circuit Breaker State Management
**Problem Solved:** Stateless serverless functions cannot share circuit breaker state
**Solution:** Vercel KV provides low-latency, shared state across function invocations

```typescript
// Example implementation pattern
import { kv } from '@vercel/kv';
import CircuitBreaker from 'opossum';

class VercelKVStore {
  async get(key: string) {
    return await kv.get(`circuit-breaker:${key}`);
  }
  
  async set(key: string, value: any) {
    return await kv.set(`circuit-breaker:${key}`, value, { ex: 300 });
  }
}

const breakerOptions = {
  timeout: 30000,
  errorThresholdPercentage: 50,
  resetTimeout: 60000,
  rollingCountTimeout: 120000,
  store: new VercelKVStore()
};
```

#### 2. Granular Function Separation
**Rationale:** Maximum fault isolation and security boundary separation
**Implementation:**
- SmartSuite proxy handles all SmartSuite API calls
- ElevenLabs functions separated by operation type (create vs status)
- Each function only receives environment variables for its specific service

#### 3. Async Job Management (ElevenLabs)
**Problem:** ElevenLabs voice generation requires async job pattern
**Solution:** Database-backed job tracking with cron polling

```yaml
Async_Flow:
  1. Client calls /api/elevenlabs/jobs
  2. Function creates Supabase async_jobs record
  3. Function submits job to ElevenLabs
  4. Returns job_id to client
  5. Cron function polls ElevenLabs every minute
  6. Updates Supabase async_jobs table with status
  7. Client polls /api/elevenlabs/status/[jobId] (fast Supabase read)

Database_Schema:
  Table: async_jobs
  Columns:
    - id (UUID, primary key)
    - service (text: 'elevenlabs')
    - external_job_id (text: ElevenLabs job ID)
    - status (text: 'pending', 'processing', 'completed', 'failed')
    - result_data (jsonb: completion data)
    - created_at (timestamp)
    - updated_at (timestamp)
```

### Performance Considerations

#### Cold Start Mitigation
**Requirement:** P95 ≤ 500ms save operations
**Risk:** Serverless cold starts could impact performance
**Mitigation Strategy:**
1. Measure baseline cold start performance before committing to SLA
2. Use Vercel provisioned concurrency for critical save operation endpoints
3. Keep warm functions that are frequently accessed

#### Circuit Breaker Performance
**State Access:** Vercel KV provides <5ms latency for circuit breaker state
**Overhead:** Circuit breaker check adds ~10ms to each external API call
**Acceptable:** Well within P95 ≤ 500ms budget

### Security Implementation

#### API Key Protection
- All external API keys stored in Vercel environment variables
- Each function only receives keys for services it integrates with
- No API keys exposed to frontend code
- Environment variable scoping per function

#### Circuit Breaker Security
- Vercel KV access restricted to serverless functions
- Circuit breaker state includes no sensitive data
- State keys use service names, not actual API endpoints

### Monitoring & Observability

#### Required Monitoring
```yaml
Circuit_Breaker_Metrics:
  - Circuit state changes (open/closed/half-open)
  - Failure rate per service
  - Response time percentiles
  - Error count by error type

API_Performance:
  - Function execution time
  - Cold start frequency
  - External API response times
  - Success/failure rates

Job_Processing:
  - Async job completion rates
  - Job processing times
  - Failed job retry patterns
  - Queue depth monitoring
```

#### Alerting Strategy
- Circuit breaker trips trigger immediate alerts
- Failed job processing after retries
- Cold start rates exceeding performance budgets
- External API error rates above thresholds

## Consequences

### Positive
- **Fault Isolation:** Individual service failures don't cascade
- **Security:** API keys properly protected server-side
- **Scalability:** Serverless functions scale automatically with load
- **Stack Alignment:** Integrates seamlessly with Vercel + React 19 + Supabase
- **Operational Simplicity:** No dedicated servers to manage

### Negative
- **State Management Complexity:** Circuit breaker state requires external store
- **Cold Start Risk:** Potential performance impact on function initialization
- **Distributed Debugging:** Error tracking across multiple functions
- **Vercel Vendor Lock-in:** KV storage ties architecture to Vercel platform

### Mitigation Strategies
- Comprehensive monitoring and alerting for distributed system health
- Performance measurement and optimization for cold start mitigation
- Structured logging across all functions for debugging
- Abstract KV store interface to enable future migration if needed

## Implementation Checklist

### Phase 1: Foundation (Week 1)
- [ ] Set up Vercel KV in project configuration
- [ ] Create circuit breaker library with Vercel KV adapter
- [ ] Implement SmartSuite proxy function with circuit breaker
- [ ] Create async_jobs table in Supabase
- [ ] Test circuit breaker state persistence across function invocations

### Phase 2: ElevenLabs Integration (Week 4)
- [ ] Implement ElevenLabs job creation function
- [ ] Create ElevenLabs status checking function
- [ ] Set up Vercel Cron Jobs for polling
- [ ] Implement async job state management
- [ ] Test end-to-end async job flow

### Phase 3: Monitoring (Week 5)
- [ ] Implement function logging and error tracking
- [ ] Set up circuit breaker monitoring
- [ ] Configure performance monitoring for cold starts
- [ ] Create alerting for service failures
- [ ] Document operational runbooks

## References

- **Critical Engineer Consultation:** 2025-09-10 (architectural validation)
- **B1 Build Plan:** 108-DOC-EAV-B1-BUILD-PLAN.md (Blocker #2 resolution)
- **Technology Stack:** React 19 + TypeScript + Vercel + Supabase
- **External Services:** SmartSuite API, ElevenLabs Creator API

## Status Updates

**2025-09-10:** ADR created, decision accepted  
**Implementation Status:** Ready to proceed with serverless functions approach  
**Next Phase:** Week 1 circuit breaker foundation implementation

---

**Evidence Trail:**
```yaml
// Critical-Engineer: consulted for API service architecture and external integration patterns
// Decision: Serverless functions with Vercel KV state management
// Validation: Architecture aligns with technology stack and provides fault isolation
// Security: API key protection validated, frontend exposure eliminated
```