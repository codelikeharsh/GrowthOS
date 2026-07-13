# ADR 0012: Many-To-Many Agency-Client Schema With MVP Restriction

Date: 2026-07-13

Status: Accepted and implemented in Phase 3

## Context

The long-term product must support businesses working with multiple agencies, while the MVP needs a simpler operational rule and must preserve relationship history.

## Decision

Keep an explicit many-to-many `agency_client_relationships` table and add an `is_primary` concept. During the MVP, a business may have only one active agency relationship at a time; inactive historical relationships remain valid.

The PostgreSQL migration installs a partial unique index on active relationships by business. The
Phase 3 service maps database uniqueness races to the stable
`AGENCY_CLIENT_RELATIONSHIP_ALREADY_ACTIVE` conflict. Historical pending, suspended, and terminated
rows remain compatible with future multi-agency support without replacing the relationship table.

## Consequences

- Historical relationship data remains intact.
- The database constraint protects active-primary uniqueness while the stricter MVP service rule protects the one-active-agency policy.
- Concurrent relationship activation needs transactional conflict handling.
