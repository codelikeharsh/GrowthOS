# ADR 0005: BullMQ And Redis For Background Jobs

Date: 2026-07-13

Status: Accepted for Phase 1

## Context

The product needs asynchronous audit orchestration, crawling, screenshots, reports, emails, webhooks, imports, exports, file validation, analytics rollups, and scheduled maintenance.

## Decision

Use a dedicated Node.js worker application with BullMQ backed by Redis.

## Alternatives

- Database-backed jobs only.
- Cloud-native queues first.
- In-process background tasks.

## Consequences

- Jobs must be typed, idempotent, bounded, observable, and safe to retry.
- Redis failure affects queue processing and must be reflected in readiness checks.
- Sensitive full records should not be placed in job payloads.
