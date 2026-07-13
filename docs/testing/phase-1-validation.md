# Phase 1 Acceptance Validation

Phase 1 acceptance validation completed on 2026-07-13 on macOS 26.5.1 (build 25F80),
Apple Silicon (`arm64`). Phase 2 was not started.

## Runtime And Infrastructure

- Node.js: 24.18.0, installed with nvm 0.40.5
- npm: 11.16.0
- pnpm: 11.7.0, activated with Corepack 0.35.0
- Python: 3.12.4
- Docker client and server: 29.6.1 (build 8900f1d), Linux `aarch64` engine
- Docker Compose: v5.2.0
- PostgreSQL: `postgres:17.6-alpine`, healthy, host port 55432
- Redis: `redis:8.2.2-alpine`, healthy, host port 6379
- MinIO: `minio/minio:RELEASE.2025-09-07T16-13-09Z`, healthy
- MinIO initialization: exited 0; `growthos-local` exists with anonymous access disabled
- Mailpit: `axllent/mailpit:v1.27.8`, healthy

Port 55432 was used because an unrelated native PostgreSQL process already occupied
`127.0.0.1:5432`. Compose now accepts `POSTGRES_PORT` while retaining 5432 as its default.
Named Docker volumes were retained; no volume-deletion command was used.

## Commands And Results

The validation used the repository root unless noted otherwise.

```bash
pnpm install --frozen-lockfile
POSTGRES_PORT=55432 docker compose config
POSTGRES_PORT=55432 docker compose up -d
POSTGRES_PORT=55432 docker compose ps -a --format json
docker compose logs --tail=200 postgres redis minio minio-init mailpit
pnpm db:generate
pnpm db:validate
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
RUN_INTEGRATION_TESTS=true pnpm test:integration
RUN_INTEGRATION_TESTS=true pnpm test
pnpm test:e2e
pnpm build
services/ai-service/.venv/bin/python -m ruff check services/ai-service
services/ai-service/.venv/bin/python -m ruff format --check services/ai-service
services/ai-service/.venv/bin/python -m mypy services/ai-service/src services/ai-service/tests
services/ai-service/.venv/bin/python -m pytest services/ai-service
pnpm outdated -r
git diff --check
```

The local values from `.env.example` were exported for application and integration commands.
`DATABASE_URL` used port 55432 for this machine. All listed validation commands passed. As
expected, `pnpm outdated -r` returned a nonzero status because updates are available; no package
was upgraded.

## Test Totals

- Aggregate TypeScript suite: 16 passed, 0 failed, 0 skipped. This includes PostgreSQL,
  Redis-worker, and API PostgreSQL-plus-Redis integration tests.
- TypeScript unit-only command: 13 passed, 0 failed. The database package has no unit files and
  correctly preserves its separate integration test.
- Implemented end-to-end smoke tests: 4 passed, 0 failed.
- Python: 6 passed, 2 skipped, 0 failed.
- Skipped Python provider integration: real provider calls are intentionally deferred to Phase 6.
- Skipped Python AI workflow end-to-end test: no product AI workflow exists in Phase 1.
- No required infrastructure-backed test was skipped.

Vitest reports nonmatching unit or integration files as skipped when a marker-specific command is
used. Those files ran in their appropriate unit, integration, or aggregate command and are not
acceptance omissions.

## Builds And Live Health

The complete Turborepo production build passed for all nine workspace packages. Next.js 16.1.6
compiled and generated `/`, `/app`, and `/health` successfully.

- Web `/`: HTTP 200; landing page rendered in the browser.
- Web `/app`: HTTP 200; Phase 2 boundary page rendered without fake dashboard data.
- Web `/health`: HTTP 200, `status: ok`, service `web`.
- API `/api/v1/health/live`: HTTP 200 with request and correlation IDs.
- API `/api/v1/health/ready`: HTTP 200 with PostgreSQL `up` and Redis `up`.
- AI service `/health/live`: HTTP 200, `status: ok`.
- AI service `/health/ready`: HTTP 200; `providerConfigured: false`, as expected in Phase 1.
- Mailpit `/api/v1/info`: HTTP 200.
- MinIO `/minio/health/live`: HTTP 200.
- Browser verification found no console warnings or errors on `/` or `/app`.

Graceful shutdown was verified directly. The worker closed its Redis connection and logged
`worker stopped`; FastAPI completed its lifespan shutdown and logged `service_stopped`; the API
returned promptly through its NestJS shutdown hooks. No application listener remained on ports
3000, 3001, or 8000.

## Security And Dependency Review

No real credential, private key, unsafe TypeScript `any`, production fake data, broad lint
suppression, or disabled acceptance test was found. Values in `.env.example`, Compose, CI, and
test configuration are documented local-only credentials. Two narrow NestJS lint suppressions
are justified for decorator-metadata-only module classes. Documentation references to deferred
placeholders and Phase 2 behavior were reviewed and retained.

Outdated direct dependencies were classified without upgrades:

- Patch candidates: NestJS 11.1.x, React 19.2.x, React type packages, and PostCSS.
- Minor updates requiring changelog review: Fastify packages, BullMQ, Next.js, Tailwind CSS,
  ioredis, Prettier, Rimraf, tsx, Turbo, typescript-eslint, Zod, and related tooling.
- Major updates intentionally deferred: Prisma 7, ESLint 10, Pino 10, Vitest 4, TypeScript 7,
  `@types/node` 26, and Swagger UI 6.
- No transitive-only update required Phase 1 action.

## Remaining Product Limitations

Phase 1 intentionally contains no authentication, organisations, memberships, RBAC, product
domains, crawler, lead capture, billing, real AI provider call, product queue processor, or
production Terraform. These remain future roadmap work and do not prevent Phase 1 acceptance.
