# Implementation Roadmap

## Phase 0: Discovery And Architecture

Status: complete. Documentation was reviewed and the five final decisions were recorded on 2026-07-13.

Deliverables:

- Repository assessment.
- Product requirements.
- MVP scope.
- User roles.
- Permission matrix.
- System overview.
- Data-flow diagrams.
- Initial data model.
- Threat model.
- Test strategy.
- Risk register.
- Initial ADRs.
- Confirmation decisions list.

## Phase 1: Monorepo And Infrastructure Foundation

Status: complete. Acceptance validation passed on 2026-07-13 under the pinned Node runtime, including Docker-backed PostgreSQL and Redis checks.

Deliverables:

- pnpm workspace and Turborepo.
- Apps: web, api, worker.
- Service: ai-service.
- Shared packages with clear responsibility.
- Docker Compose for PostgreSQL, Redis, MinIO, Mailpit.
- Root scripts for install, dev, build, lint, typecheck, tests.
- Strict TypeScript configs.
- Python tooling for FastAPI service.
- Basic health endpoints.
- CI foundation.
- `.env.example`.
- Initial README local workflow.

Validation:

- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- Python lint/type/test commands
- Health endpoint smoke tests where possible

## Phase 2: Authentication, Organizations, And RBAC

Status: complete. Acceptance validation passed on 2026-07-13, including Docker-backed identity,
session, CSRF, invitation, permission, tenant-isolation, audit-log, and real Chromium flows.

Delivered:

- First-party registration, email verification, login, logout, logout-all, and password reset.
- Argon2id password hashing and hashed, expiring verification/reset/invitation tokens.
- PostgreSQL-backed opaque sessions, secure cookies, CSRF validation, rotation, listing, and revocation.
- Organizations, memberships, invitations, seeded roles and permissions, and last-owner protection.
- Resource-level tenant predicates and permission checks on every organization operation.
- Immediate session revocation after role changes and membership removal.
- Audit records for sensitive identity and organization events.
- Functional authentication and organization settings UI.
- Docker-backed integration tests and the required browser acceptance journey.

Validation: see [Phase 2 acceptance validation](testing/phase-2-validation.md).

## Phase 3: Agency-Client Relationships And Business Profiles

Deliver agency dashboard foundation, business client creation, relationship records, business profile, locations, services, hours, social links, client invitation, and permission-aware UI.

## Phase 4: Website Management And Audit Foundation

Deliver website registration, URL validation, SSRF protection, audit creation, queue orchestration, crawler, page discovery, page storage, audit progress, basic technical findings, screenshots, and audit report UI.

## Phase 5: Advanced Website Analysis

Deliver Lighthouse, axe-core checks, SEO checks, broken-link detection, structured-data checks, conversion heuristics, recurring audits, comparisons, and security/performance tests.

## Phase 6: AI Recommendations

Deliver provider abstraction, Python AI workflows, prompt versions, structured outputs, recommendation generation, evidence references, approval, usage/cost tracking, evaluation suite, and provider-failure fallback.

## Phase 7: Lead Capture And CRM

Deliver form configuration, public endpoint, spam protection, leads, dedupe, pipeline, scoring, activities, tasks, imports, exports, analytics, and first-party tracker.

## Phase 8: Client Project Portal

Deliver projects, members, milestones, tasks, content requests, submissions, approvals, comments, files, notifications, and support tickets.

## Phase 9: Reports, Billing, And Payments

Deliver report snapshots, PDF generation, plans, limits, subscriptions, invoices, Razorpay integration, verified webhooks, payment state machine, and billing UI.

## Phase 10: Production Hardening

Deliver OpenTelemetry, Sentry, metrics, rate limits, security headers, retention jobs, backup strategy, disaster recovery docs, load testing, dependency scanning, container hardening, Terraform, staging deployment, and production docs.

## Phase 11: Adoption And Evidence

Deliver onboarding guides, demonstration data, pilot process, feedback collection, product analytics, case-study template, public technical architecture article, performance report, security summary, and demo script.
