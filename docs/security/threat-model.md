# Threat Model

## Scope

This threat model covers the planned multi-tenant SaaS platform, including browser UI, API, worker, AI service, database, Redis, object storage, public lead forms, crawler, payments, files, and platform administration.

## Assets

- User identities, password hashes, sessions, verification tokens, reset tokens, and invitation tokens.
- Organization, client, lead, project, billing, invoice, payment, report, and file data.
- Website audit data, screenshots, findings, and AI-generated recommendations.
- AI provider credentials, payment provider secrets, object-storage credentials, database credentials, and email credentials.
- Audit logs, support-access logs, usage records, and operational telemetry.

## Trust Boundaries

- Browser to API.
- Public lead form and tracker to API.
- API to PostgreSQL, Redis, object storage, email, payment provider, and AI service.
- Worker to external websites, Redis, PostgreSQL, object storage, and AI service.
- Payment provider webhooks to API.
- Platform support access to tenant data.

## Primary Threats And Controls

| Threat                       | Control                                                                                                                           |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Broken access control        | Central permission service, tenant context, repository-level tenant predicates, resource authorization tests                      |
| Cross-tenant data leakage    | Required organization scoping, relationship checks, scoped file signing, export checks, tenant-isolation test suite               |
| SSRF through audit URLs      | URL normalization, DNS resolution checks, private/reserved IP blocking, redirect revalidation, timeouts, response limits          |
| SQL injection                | Prisma parameterized queries, runtime validation, no raw SQL except reviewed migrations or bounded queries                        |
| XSS                          | React escaping, sanitized rich text, CSP, safe file handling, no unsafe HTML by default                                           |
| CSRF                         | CSRF tokens for state-changing cookie-authenticated requests, SameSite cookies, origin checks                                     |
| Brute-force login            | Rate limits, progressive delay or lockout, safe error messages, audit logs                                                        |
| Session theft                | High-entropy opaque tokens, SHA-256 hashes in PostgreSQL, HttpOnly Secure cookies, rotation, immediate revocation, Redis fallback |
| Token theft                  | Hash reset, verification, and invitation tokens; short expirations; one-time use                                                  |
| File upload attacks          | Metadata validation, signed upload flow, content signature checks, size limits, private storage, malware scanning where practical |
| Webhook forgery              | Signature verification, replay detection, provider event ID uniqueness, idempotent processing                                     |
| Payment replay               | Transactional state changes, idempotency keys, verified provider state                                                            |
| Prompt injection             | Separate system instructions from untrusted data, minimal evidence payloads, schema validation, no secrets to AI service          |
| Queue poisoning              | Typed job schemas, internal-only queue producers, minimal IDs in payloads, idempotent handlers                                    |
| CSV formula injection        | Escape dangerous leading characters in exports                                                                                    |
| Secret leakage               | `.env.example` only, no real secrets in source, secret manager in production, redaction utilities                                 |
| Log injection or PII leakage | Structured JSON logs, redaction, avoid sensitive payloads                                                                         |
| Denial of service            | Rate limits, bounded page counts, job timeouts, response size caps, queue limits                                                  |

## Risk Register

| Risk                                               | Probability | Impact   | Mitigation                                                                                    | Detection method                                      |
| -------------------------------------------------- | ----------- | -------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Cross-tenant data access through missed predicates | Medium      | Critical | Central tenant context, repository patterns, mandatory authorization tests                    | Security tests, code review, audit logs               |
| SSRF from crawler redirects or DNS rebinding       | Medium      | Critical | Re-resolve redirects, block private ranges, cap redirects, integration tests                  | SSRF test suite, worker logs, egress monitoring       |
| AI recommendations invent unsupported claims       | Medium      | High     | Structured schemas, finding-reference validation, prompt evaluations, human approval          | AI eval results, review workflow                      |
| Webhook replay duplicates payment state            | Medium      | High     | Unique provider event IDs, transactional processing, idempotency keys                         | Payment event logs, duplicate-key alerts              |
| File validation bypass exposes malicious files     | Medium      | High     | Private pending state, signature validation, size and type limits, scan step                  | File validation failures, storage audit               |
| Redis outage blocks queues and rate limits         | Medium      | Medium   | Readiness checks, retry policy, clear degraded behavior                                       | Health checks, queue metrics                          |
| Database migration error affects tenant data       | Low         | Critical | Migration validation, backups, staging tests, rollback plan                                   | CI migration job, deployment checks                   |
| Unbounded audit jobs create cost spikes            | Medium      | High     | Plan limits, page caps, job timeouts, concurrency limits                                      | Queue metrics, usage records, cost alerts             |
| Sensitive data appears in logs                     | Medium      | High     | Redaction utilities, structured logging policy, tests for known secret patterns               | Log sampling, security review                         |
| Platform support overreach                         | Low         | High     | No MVP impersonation, metadata-only diagnostics, future reason/scope/30-minute audited access | Support access logs, owner notification, admin review |
| Public lead spam                                   | High        | Medium   | Rate limits, honeypot, optional CAPTCHA, spam scoring                                         | Rejection metrics, alert thresholds                   |
| Dependency vulnerability                           | Medium      | Medium   | Lockfile review, dependency scanning, update policy                                           | CI security scan                                      |

## Finalised Security Decisions

- [Opaque sessions](../adr/0004-auth-opaque-sessions.md) use PostgreSQL as source of truth and Redis only as optional acceleration.
- [Selected sensitive fields](../adr/0014-application-field-encryption.md) use AES-256-GCM with separately keyed HMAC-SHA-256 blind indexes for normalized email and phone.
- [Platform support](../adr/0015-platform-support-access.md) has no MVP impersonation and no casual access to private tenant content.
- [AI retention](../adr/0013-openai-provider-and-retention.md) excludes raw payload storage by default and never stores hidden reasoning.
