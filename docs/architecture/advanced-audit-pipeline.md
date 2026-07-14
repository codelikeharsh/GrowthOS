# Advanced Audit Pipeline

Phase 5 uses the existing `SecureHomepageFetcher` for every outbound request. It validates the
target and every redirect through the pinned-IP target policy before connecting. There is no local
network allowlist, alternate production transport, or user-controlled bypass.

The worker first performs the bounded Phase 4 crawl. For each already-fetched HTML document it
derives a compact static-analysis summary: document structure, resource references, links,
JSON-LD parsing results, response-header facts, and a normalized visible-content hash. Raw HTML
and external response bodies are not persisted. Link verification is sequential and capped; an
external link is never added to the crawl queue.

`audit_page_metrics`, `audit_links`, and `audit_structured_data` are per-page records. Category
scores, a comparison summary, and compact provider-execution records belong to `audit_runs`. All are reachable only through the
existing organization-scoped audit/website predicates, and use cascade-safe foreign keys.

The live progress stream exposes actual lifecycle stages and counters (`pagesDiscovered`,
`pagesProcessed`, `linksChecked`). A rule, resource, or optional provider failure can produce a
partial result; it must not expose DNS details, response bodies, credentials, or stack traces.

## Optional performance-provider boundary

`PERFORMANCE_PROVIDER=disabled` is the only production configuration currently accepted. The
injectable provider boundary has a 10-second timeout and persists only a labelled status, compact
typed metrics, and a stable error code. It never stores a raw provider response or credentials.
When a later reviewed provider is enabled, a provider failure produces `PARTIAL` while retaining
the deterministic crawl findings; an unavailable disabled provider does not alter completion.

## Important limits

- HTML body: existing 2 MiB secure-fetch cap.
- Crawl: existing 10 pages, depth 2, 50 candidates.
- Static facts: 200 links, 100 resource references, and 20 JSON-LD blocks per page.
- Link verification: at most 200 links per audit, sequentially through the existing secure
  transport.

Automated accessibility inspection is not WCAG certification. Header checks are not a penetration
test. Static mobile checks are not device testing. Provider metrics are not shown unless an
explicit optional provider returns them; AI recommendations remain Phase 6 work.
