# Data Flow

## Primary Audit Workflow

```mermaid
sequenceDiagram
  participant User
  participant Web
  participant API
  participant DB
  participant Queue as Redis/BullMQ
  participant Worker
  participant Site as Target website
  participant Storage
  participant AI as AI service

  User->>Web: Start audit
  Web->>API: POST /api/v1/audits with idempotency key
  API->>API: Authenticate, authorize, validate tenant
  API->>API: Normalize URL and run SSRF checks
  API->>DB: Transaction creates audit_run and outbox/audit log
  API->>Queue: Enqueue audit-orchestration job
  API-->>Web: 202 Accepted with audit ID
  Web->>API: Subscribe to audit progress SSE
  Worker->>Queue: Claim job
  Worker->>DB: Mark status VALIDATING_TARGET
  Worker->>Site: Validate then fetch initial homepage through pinned-IP connection
  Worker->>DB: Store one audit_page metadata row and transition to ANALYZING
  Worker->>Storage: Store private screenshots
  Worker->>DB: Store metrics and findings
  Worker->>AI: Optional recommendation request after deterministic data is stable
  AI-->>Worker: Validated structured draft recommendations
  Worker->>DB: Store recommendations and final status
  Worker->>Queue: Publish notification/email jobs
  API-->>Web: SSE status updates
```

## Lead-Capture Workflow

```mermaid
sequenceDiagram
  participant Visitor
  participant Form as Public lead form
  participant API
  participant DB
  participant Queue
  participant Worker
  participant Agency as Agency users

  Visitor->>Form: Submit lead
  Form->>API: POST /api/v1/public/forms/{publicId}/submissions
  API->>API: Rate limit, validate origin, validate fields, honeypot
  API->>API: Spam, consent, idempotency, dedupe checks
  API->>DB: Transaction stores form_submission, lead or duplicate flag, activity, audit log
  API->>Queue: Enqueue notifications and scoring jobs if needed
  API-->>Form: Safe response without internal IDs
  Worker->>DB: Process notification/outbox jobs idempotently
  Worker-->>Agency: Notify authorized users
```

## Agency-Client Relationship

```mermaid
flowchart LR
  AgencyOrg["Agency organization"] --> Relationship["agency_client_relationship"]
  BusinessOrg["Business organization"] --> Relationship
  Relationship --> Status["status"]
  Relationship --> Primary["is_primary"]
  Relationship --> Manager["primary account manager"]
  Relationship --> Plan["service plan"]
  Relationship --> AgencyNotes["agency internal notes"]
  Relationship --> ClientNotes["client-visible notes"]
  Relationship --> Permissions["relationship permissions"]
  AgencyUser["Agency member"] --> AgencyOrg
  BusinessUser["Business member"] --> BusinessOrg
```

## Data Handling Principles

- All organization-specific records include a tenant owner or an explicit relationship to tenant-owned records.
- Public identifiers for lead forms and tracking do not expose internal organization IDs.
- Background job payloads contain stable IDs and minimal metadata, not sensitive full records.
- Private files are never served through public object URLs. The API authorizes and signs short-lived access.
- AI service inputs are minimized to authorized evidence and verified business context.
- Audit logs record sensitive state transitions without storing secrets or unnecessary personal data.
- The MVP service layer permits only one active agency relationship per business while preserving inactive history; the schema remains many-to-many.

## Outbox Flow

```mermaid
sequenceDiagram
  participant API
  participant DB
  participant Worker
  participant External as External system

  API->>DB: Transaction updates business state and inserts outbox_event
  Worker->>DB: Claim pending outbox_event
  Worker->>External: Deliver notification, webhook, email, or internal task
  Worker->>DB: Mark delivered or retry with bounded attempts
```

Phase 4C writes an `audit_runs` row, `outbox_events` row, and audit-log event in one transaction.
The dispatcher publishes only audit, website, and organization UUIDs to `audit-orchestration`.
Phase 4D1 consumes the job only when its audit is still queued, revalidates DNS immediately before
each pinned-IP connection, and stores metadata for the registered homepage only. Multi-page crawling
begins in Phase 4D2.
