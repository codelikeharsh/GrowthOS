# Phase 4 validation

Phase 4 is complete without screenshots. Screenshot capture remains explicitly deferred until the
product has a production-ready private storage abstraction and a browser capture implementation
that preserves pinned-IP outbound connection guarantees.

The deterministic Playwright journey in `apps/web/e2e/phase4.spec.ts` uses PostgreSQL, Redis,
Mailpit, the API, and the web application locally. It registers a business website, requests and
dispatches an audit, processes the queued payload through an injected fixture-only worker fetcher,
checks the rendered persisted report, and verifies that an unrelated tenant receives `404` for both
the report and progress stream. The fixture fetcher opens no public network connection.

The worker production entrypoint always composes `SafeTargetValidator` with
`SecureHomepageFetcher`; only the test bootstrap receives a deterministic fetcher. No environment
setting selects a fake transport or relaxes SSRF policy.
