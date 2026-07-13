# ADR 0007: Server-Sent Events For Progress Updates

Date: 2026-07-13

Status: Accepted for Phase 4

## Context

Audit progress, export progress, report generation, and background-job status require real-time-ish one-way updates from server to browser.

## Decision

Use Server-Sent Events for progress streams.

## Alternatives

- WebSockets.
- Polling.
- Third-party realtime service.

## Consequences

- SSE fits one-way progress updates with less complexity than WebSockets.
- WebSockets remain available later only for genuine bidirectional collaboration.
- Progress checkpoints must still be persisted so clients can reconnect safely.
