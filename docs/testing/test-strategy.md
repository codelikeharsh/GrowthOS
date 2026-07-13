# Test Strategy

## Principles

- Tests must prove authorization, tenant isolation, validation, idempotency, and failure handling, not only happy paths.
- Mocks are allowed in unit tests and local fixtures, but production code cannot depend on fake success behavior.
- Integration tests should use real PostgreSQL and Redis where practical.
- Browser tests should cover critical business flows once the UI exists.

## Root Quality Commands

The repository provides these commands:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
```

Python service checks should be reachable from root scripts or documented:

```bash
ruff check .
mypy .
pytest
```

## Unit Test Coverage

- Permission logic and role mappings.
- Tenant scoping helpers.
- Password policy and token hashing utilities.
- URL normalization and SSRF protections.
- Lead scoring and deduplication.
- Audit finding rules.
- Recommendation validation and finding-reference checks.
- Payment state transitions and money calculations.
- CSV export escaping.
- File metadata validation.
- Project status and approval transitions.

## Integration Test Coverage

- Repository queries enforce tenant predicates.
- Transactions create business state and outbox events atomically.
- Session revocation and logout-all-devices.
- Invitation acceptance and role assignment.
- Atomic client creation, active-relationship uniqueness, profile resources, note visibility,
  optimistic concurrency, and Phase 3 audits. Implemented in Phase 3.
- Audit creation idempotency and queue job creation.
- Outbox processing.
- Lead capture validation, rate limiting, dedupe, and activity creation.
- Payment webhook verification, replay handling, and invoice update.
- File upload metadata flow and access checks.

## End-to-End Test Coverage

- Registration and local email verification. Implemented in Phase 2.
- Agency creation. Implemented in Phase 2.
- Member invitation and acceptance. Implemented in Phase 2.
- Client creation. Implemented in Phase 3.
- Business profile, location, service, hours, and social-link setup. Implemented in Phase 3.
- Website registration.
- Audit creation and progress.
- Audit report review.
- Lead capture and pipeline movement.
- Project creation.
- Client content submission.
- Approval completion.
- Report generation.
- Invoice view.

## Security Tests

- User A cannot access User B's organization. Implemented in Phase 2.
- Business client cannot read agency-internal notes. Implemented in Phase 3.
- Agency member cannot access an unassigned client when restricted. Implemented in Phase 3.
- Expired file URLs cannot be reused.
- Website outbound-target policy blocks private, loopback, link-local, metadata, multicast,
  unspecified, reserved, special-use, and unsafe IPv4-mapped IPv6 addresses; validates all DNS
  answers and redirects without real external DNS in unit tests. Implemented in Phase 4B.
- Webhook replay does not duplicate payment changes.
- Public forms are rate-limited.
- Invalid roles and permissions are rejected. Implemented in Phase 2.
- Exports require permission.
- Admin routes reject ordinary users.

## Load Tests

Use k6 or equivalent once endpoints exist. Initial targets:

- Public lead-capture endpoint.
- Audit-creation endpoint.
- Dashboard query.
- Lead search.
- Tracking-event endpoint.
- SSE audit progress.
- Webhook ingestion.

Record environment, data volume, request rate, P50, P95, P99, error rate, and bottlenecks. Do not publish performance claims without environment context.
