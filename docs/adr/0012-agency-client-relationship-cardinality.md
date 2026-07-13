# ADR 0012: Many-To-Many Agency-Client Schema With MVP Restriction

Date: 2026-07-13

Status: Accepted for Phase 3

## Context

The long-term product must support businesses working with multiple agencies, while the MVP needs a simpler operational rule and must preserve relationship history.

## Decision

Keep an explicit many-to-many `agency_client_relationships` table and add an `is_primary` concept. During the MVP, a business may have only one active agency relationship at a time; inactive historical relationships remain valid.

Plan a PostgreSQL partial unique index for active primary relationships. The Phase 3 service layer must also reject any second active relationship during the MVP, including a second non-primary active relationship. Future multi-agency support will relax the service rule without replacing the relationship table.

## Consequences

- Historical relationship data remains intact.
- The database constraint protects active-primary uniqueness while the stricter MVP service rule protects the one-active-agency policy.
- Concurrent relationship activation needs transactional conflict handling.
