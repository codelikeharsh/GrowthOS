# ADR 0009: Tenant Isolation Strategy

Date: 2026-07-13

Status: Accepted and implemented in Phase 2

## Context

The product handles multiple agencies and businesses. No user may access another organization's data through URL manipulation, direct IDs, API requests, search, files, background jobs, exports, analytics, reports, or webhooks.

## Decision

Use application-enforced tenant context with explicit organization ownership, agency-client relationship records, repository-level tenant predicates, resource authorization checks, and mandatory tenant-isolation tests.

## Alternatives

- Separate databases per tenant.
- PostgreSQL row-level security from the beginning.
- Trusting frontend route guards.

## Consequences

- Tenant checks must be part of every protected backend operation.
- Tests are required before Phase 2 is considered complete.
- Row-level security may be evaluated later for defense in depth.
