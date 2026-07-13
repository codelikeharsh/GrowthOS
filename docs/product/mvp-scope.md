# MVP Scope

## MVP Objective

The first usable MVP should let zero2one labs operate a real agency workflow: sign in, create an agency, add business clients, register websites, run audits, review findings, draft evidence-backed recommendations, capture leads, move leads through a pipeline, manage projects, request client content, approve deliverables, store private files, generate a basic monthly report, and maintain audit logs.

## Included Capabilities

- Secure email/password authentication with email verification, password reset, opaque sessions, CSRF protection, and login rate limiting.
- Agency and business organizations with memberships, invitations, roles, and named permissions.
- Explicit many-to-many agency-client relationship records with status, `is_primary`, notes, account manager, service plan, and suspension or termination state. MVP permits one active agency relationship per business while preserving inactive history.
- Business profile, locations, services, hours, and social links.
- Website registration with normalized URLs and ownership status.
- Audit creation with SSRF protection, usage checks, idempotent queueing, progress updates, pages, metrics, findings, screenshots, and report UI.
- AI recommendations generated only from stored findings, with schema validation, prompt provenance, usage tracking, and human approval states.
- Public lead capture with validation, rate limiting, honeypot, consent capture, deduplication, scoring, pipeline stages, activities, tasks, and notifications.
- Projects, milestones, tasks, content requests, submissions, approvals, comments, and basic support tickets.
- Private file upload flow backed by signed object-storage URLs and validation before availability.
- Basic monthly report snapshot and private PDF generation.
- Plans, usage limits, invoices, payments, Razorpay order creation, and verified idempotent webhooks.
- Structured logs, health checks, CI, local Docker Compose infrastructure, seed data, and documentation.

## Excluded From MVP

- OAuth login unless it becomes a low-risk addition after email/password is complete.
- Bulk email campaigns.
- White-label custom domains.
- Native mobile apps.
- Multi-provider payments beyond the abstraction and first Razorpay adapter.
- Full accounting.
- Advanced workflow builders.
- Kubernetes.
- Complex marketing attribution or cross-site fingerprinting.

## Phase Gate

MVP work should not begin until Phase 1 through Phase 10 foundations are planned and implemented in sequence. Phase 2 must not be considered complete until tenant-isolation tests pass.

## MVP Acceptance Risks

- Audit engine can become the most expensive and security-sensitive capability. It should be implemented behind strict URL validation, page caps, worker timeouts, and operational limits.
- AI recommendation quality depends on deterministic audit quality and prompt evaluation. AI should not be introduced before Phase 4 and Phase 5 audit results are stable.
- Client portal value depends on permission-aware project workflows. Static dashboards or decorative metrics are not acceptable.
