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

Status: complete. Acceptance validation passed on 2026-07-13, including upgrade and fresh-database
migrations, PostgreSQL constraints, tenant isolation, client invitation, note visibility, and the
required 20-step Chromium journey.

Delivered:

- Audited agency-client relationships with the approved lifecycle and one-active-agency MVP rule.
- Atomic agency-led business creation with idempotency and post-commit owner invitation delivery.
- Business profiles, locations, integer-minor-unit services, non-overlapping hours, and social links.
- Named Phase 3 permissions, assigned-client restrictions, active-relationship write rules, and
  business self-management without internal-note leakage.
- Optimistic concurrency, stable domain error codes, bounded client/note listings, and safe tenant
  context resolution.
- Agency and business browser routes using shared React Hook Form and Zod components.
- Docker-backed integration coverage and the complete agency-to-client browser journey.

Validation: see [Phase 3 acceptance validation](testing/phase-3-validation.md).

## Phase 4: Website Management And Audit Foundation

Status: Phase 4A–4D2B complete. Website registration, SSRF validation, audit lifecycle/outbox,
bounded crawling, robots compliance, and sitemap-assisted discovery are implemented.

- Phase 4A: business-owned website registration, tenant-aware agency/business management, storage
  URL normalization, and safe disablement.
- Phase 4B: target parsing, injectable A/AAAA DNS validation, IP policy, CNAME alias checks,
  redirect validation, and validated-IP connection instructions for a later crawler.
- Phase 4C: auditable queued audit runs, lifecycle validation, partial active-audit uniqueness,
  typed `audit-orchestration` outbox dispatch, and agency/business audit history UI.
- Phase 4D1: queue consumer, conditional `QUEUED → VALIDATING_TARGET → CRAWLING → ANALYZING`
  lifecycle, pinned-IP homepage GET, bounded HTML metadata storage in `audit_pages`, and safe failure
  handling. Audits remain in `ANALYZING` until a later analysis consumer exists.
- Phase 4D2A: same-approved-host anchor discovery and secure bounded crawling (10 pages, depth 2,
  concurrency cap 2, 50 candidates), tracking/fragment normalization, and page-level failure results.
- Phase 4D2B: pinned-transport robots policy and sitemap-assisted same-host candidate discovery;
  sitemap files cap at 5, sitemap index depth remains pending, and at most 200 sitemap URLs are examined.
- Remaining Phase 4: multi-page discovery/crawling, progress, findings, screenshots, and report UI.

Validation: see [Phase 4D1 acceptance validation](testing/phase-4d1-validation.md).

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
