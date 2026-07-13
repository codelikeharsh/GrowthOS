# zero2one Growth OS Product Requirements

## Phase 0 Repository Assessment

The repository at `/Users/harshupadhyay/Desktop/GrowthOS` was empty at the start of Phase 0. There was no existing product code, documentation, package manifest, GitHub workflow, infrastructure definition, or application scaffold to preserve.

Phase 0 established the product and architecture baseline. The five initially open decisions are now finalised in [ADRs 0004 and 0012–0015](../adr/README.md). Phases 1–3 now implement the infrastructure foundation, identity and organization layer, and the first product domain: agency-client relationships and business profiles. Website audits remain out of scope until Phase 4.

## Product Summary

zero2one Growth OS is a multi-tenant operating system for zero2one labs and, later, other website and digital service agencies. It combines website audit evidence, AI-assisted recommendations, lead capture, CRM, client project collaboration, files, approvals, monthly reporting, billing, and operational visibility.

The product must be useful without AI. Deterministic collectors and business workflows are the source of truth. AI may summarize, classify, prioritize, and draft content, but it must not invent facts or publish changes without human approval.

## Primary Goals

- Give agencies a secure workspace for managing businesses, websites, audits, leads, projects, files, approvals, invoices, and reports.
- Give business clients a restricted portal for reports, project status, content requests, approvals, files, support tickets, and selected lead visibility.
- Produce evidence-based website audit findings through deterministic crawling, analysis, and measurement.
- Generate AI-assisted recommendations that reference stored findings and remain in draft until approved.
- Enforce tenant isolation and role-based authorization from the beginning.
- Provide a local development workflow, CI foundation, documentation, and deployment architecture suitable for production hardening.

## Non-Goals For Early Phases

- Native mobile applications.
- Bulk email marketing automation.
- Multiple payment providers before the Razorpay adapter is stable.
- Kubernetes.
- Marketplace integrations.
- White-label custom domains.
- Advanced machine-learning models.
- Arbitrary workflow builders.

## Product Principles

- Evidence over decorative AI.
- Human approval for generated content and approval-sensitive deliverables.
- Multi-tenancy from the first data model.
- Privacy-conscious analytics without invasive fingerprinting.
- Useful core workflows when AI providers are unavailable.
- Secure defaults for authentication, sessions, files, webhooks, payments, jobs, and crawler targets.

## Core Modules

- Identity, authentication, sessions, invitations, organizations, memberships, RBAC, and audit logs.
- Agency-client relationships and business profiles.
- Website registration, verification, audit runs, pages, metrics, findings, screenshots, comparisons, schedules, and reports.
- AI service, prompt versions, structured outputs, recommendation sets, recommendation approval, usage, and evaluation.
- Lead capture, form submissions, deduplication, scoring, pipeline stages, activities, tasks, imports, exports, and first-party tracking.
- Projects, milestones, tasks, content requests, content submissions, approvals, feedback, comments, support tickets, and notifications.
- Private file metadata, direct object-storage upload flow, validation, retention, and signed downloads.
- Plans, subscriptions, usage records, invoices, payments, payment events, and provider abstraction.
- Platform administration, feature flags, support access, health, jobs, and usage.

## Implemented Phase 3 Product Slice

An authenticated agency can create a business client atomically, manage the relationship lifecycle,
assign an active agency account manager, invite the business owner, and manage the business profile,
locations, services and pricing, hours, social links, and visibility-scoped notes. An invited business
owner can manage their own business data and collaborate through client-visible notes. Backend
permission, tenant, relationship, assignment, and note-visibility checks are authoritative; Phase 4
website and audit entities are not present.

## Success Criteria

- Tenant isolation is enforced and tested for protected workflows.
- Authentication, authorization, validation, error handling, logging, and audit logging are implemented at backend boundaries.
- Website audit facts are collected deterministically and stored with source metadata.
- AI recommendations validate against schemas and reference valid finding IDs.
- Financial amounts use integer minor units and webhook processing is idempotent.
- File uploads use signed private storage and validation before availability.
- Local setup and CI commands are documented and reproducible.

## Assumptions

- Initial target geography is India, with INR as the first billing currency and Razorpay as the first payment provider.
- The initial deployment architecture should target AWS, while an affordable staging platform may be used earlier if documented.
- PostgreSQL is the source of truth for business data.
- Redis is used for queues, rate limits, short-lived cache, locks, optional session lookup acceleration, and idempotency support, but never as the sole session source of truth.
- OpenAI is the first AI provider behind an internal interface, with model selection through environment configuration and raw payload retention disabled by default.
- AI service calls are internal and authenticated; browser clients never call provider SDKs directly.
- Website audits respect robots.txt by default and start with conservative page limits.
