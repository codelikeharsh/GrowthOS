# Phase 3 Acceptance Validation

Phase 3 acceptance validation completed on 2026-07-13 on macOS 26.5.1 (`arm64`). Phase 4 was not
started.

## Runtime And Infrastructure

- Node.js 24.18.0; pnpm 11.7.0; Python 3.12.4.
- Docker 29.6.1 (build 8900f1d); Docker Compose v5.2.0.
- PostgreSQL 17.6 on host port 55432, Redis 8.2.2, MinIO, and Mailpit: running and healthy.
- MinIO bucket initialization: exited 0 as the successful one-shot state.
- Existing named volumes and development data were retained; no volume deletion command ran.

## Delivered Boundary

Phase 3 delivers many-to-many-compatible agency-client relationship storage with an MVP one-active
relationship constraint; the approved lifecycle; manager assignment; internal and client-visible
notes; atomic, idempotent client creation; Phase 2 invitation reuse; profiles; locations; services;
structured hours; social links; 20 named permissions; stable domain errors; audit events; bounded
pagination; optimistic concurrency; and agency/business UI routes. Phase 4 websites and audits are
absent.

Agency routes use `x-organization-id` for the authenticated active agency. Shared profile routes use
either an authenticated business `x-organization-id`, or the checked pair
`x-agency-organization-id` plus `x-relationship-id`. Request bodies cannot select a tenant.

## Commands And Results

The final run used the repository root, the Python virtualenv, and local values corresponding to
`.env.example`, with PostgreSQL mapped to port 55432.

```bash
pnpm install --frozen-lockfile
POSTGRES_PORT=55432 docker compose config --quiet
docker compose ps -a
pnpm db:generate
pnpm db:validate
pnpm db:migrate:deploy
pnpm format:check
pnpm lint
pnpm typecheck
RUN_INTEGRATION_TESTS=true pnpm test
RUN_INTEGRATION_TESTS=true pnpm test:e2e
pnpm build
services/ai-service/.venv/bin/python -m ruff check services/ai-service
services/ai-service/.venv/bin/python -m ruff format --check services/ai-service
services/ai-service/.venv/bin/python -m mypy --strict services/ai-service/src services/ai-service/tests
services/ai-service/.venv/bin/python -m pytest services/ai-service
pnpm outdated -r
git diff --check
```

All required commands passed. A disposable `growthos_phase3_validation` database applied all three
migrations from empty state and was removed afterwards. The development database proved the
Phase 2-to-Phase 3 upgrade path. No authentication table was dropped or recreated.

## Tests And Builds

- Aggregate TypeScript: 36 passed — API 25, worker 4, web 2, configuration 3, database 1, logger 1.
- Python: 6 passed, 2 skipped. The skips are the documented Phase 6 real-provider and absent AI
  workflow markers; they are not Phase 3 behavior or infrastructure.
- HTTP/browser smoke suite: 4 API tests and 2 real Chromium journeys passed.
- Phase 3-specific coverage: 6 domain unit tests, 3 Docker-backed HTTP/integration scenarios, and
  the required 20-step browser journey. No required Phase 3 test was skipped.
- Nine workspace builds passed. Next.js compiled all 23 generated/static routes, including all 17
  Phase 3 agency and business pages.

Coverage includes lifecycle transitions, pricing, currencies, timezones, social normalization,
hours overlap, partial uniqueness, idempotency, profile/resource CRUD, stale writes, invitations,
audits, outsider isolation, and backend filtering of internal notes. The browser journey performs
registration, Mailpit verification, agency creation, client creation, resource onboarding,
invitation acceptance in a separate context, client self-editing, visible-note collaboration, and
agency list confirmation.

## Live Health And Shutdown

- Web `/`, `/app`, and `/health`: HTTP 200.
- API liveness: HTTP 200. Readiness: HTTP 200 with PostgreSQL and Redis `up`.
- AI liveness and readiness: HTTP 200; `providerConfigured: false` is expected before Phase 6.
- Production-built web and API listeners stopped promptly on interrupt. FastAPI logged
  `service_stopped` and completed application shutdown. The pnpm API wrapper reports SIGINT while
  the underlying Nest shutdown hooks close database, Redis, and mail resources.

## Security And Dependency Review

No private key, cloud/API credential, unsafe TypeScript `any`, broad suppression, production fake
data, or placeholder Phase 3 product behavior was found. `.env.example`, CI, Prisma validation, and
test PostgreSQL URLs contain documented local-only credentials. The two narrow NestJS
`no-extraneous-class` suppressions are required for decorator-metadata module/test classes. HTML
input placeholder attributes and future-phase documentation were reviewed and retained.

Outdated dependencies were classified without changing the lockfile:

- Patch: NestJS 11.1.x, React/React DOM 19.2.x, React type packages, and PostCSS.
- Minor or changelog review: Fastify 5 packages, Nest Swagger, BullMQ, Next.js 16.2, Tailwind 4.3,
  ioredis, Prettier, Rimraf, tsx, Turbo, typescript-eslint, Zod, and pre-1.0 class-validator.
- Major/migration required: Prisma 7, ESLint 10 and `@eslint/js` 10, Pino 10, Vitest 4,
  TypeScript 7, `@types/node` 26, and Swagger UI 6.

No dependency was upgraded automatically.

## Remaining Limitations

Mailpit remains local-only. The business hours UI exposes the validated interval JSON representation
as a minimal Phase 3 editor; a richer schedule builder may replace it without changing storage.
The client members page exposes account-manager assignment to active agency members, while client
ownership membership remains intentionally managed through the validated invitation workflow;
general business membership administration remains the shared Phase 2 settings surface. The Next.js
package uses standalone output and prints a development-oriented warning under `next start`; the
production artifact remains buildable and the live routes passed. Website entities, URL validation,
SSRF defenses, crawlers, audits, and audit findings are intentionally deferred to Phase 4.

Phase 3 meets its definition of done. No required infrastructure-backed or browser check was skipped.
The exact next starting point is Phase 4 website registration and URL/SSRF validation, followed by
audit creation and queue orchestration; Phase 3 relationship/profile contracts should remain stable.
