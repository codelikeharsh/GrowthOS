# zero2one Growth OS

zero2one Growth OS is a planned multi-tenant operating system for digital service agencies and their business clients. The product will combine deterministic website audits, evidence-backed AI assistance, lead management, client delivery, files, approvals, reporting, and billing. Core workflows must remain useful when AI is unavailable.

## Current phase

Phases 0 through 4 are complete. The repository includes the platform, identity and tenant
foundation, agency-client workflows, secure bounded website audits, deterministic findings, and
tenant-authorized audit reports with live progress. Homepage screenshots are explicitly deferred.

## Architecture

- `apps/web`: Next.js 16 App Router identity and organisation browser experience; no server secrets.
- `apps/api`: NestJS 11 with Fastify, versioned under `/api/v1`, with identity and tenant authorization.
- `apps/worker`: Node.js BullMQ lifecycle and Redis foundation; no product jobs.
- `services/ai-service`: Python FastAPI service with an internal provider protocol; no real AI calls.
- `packages/config`: server runtime environment validation for the API and worker.
- `packages/db`: backend-only Prisma client lifecycle and PostgreSQL connectivity.
- `packages/logger`: structured Pino logging with secret redaction.
- `packages/tsconfig` and `packages/eslint-config`: role-appropriate shared quality rules.
- `docker-compose.yml`: PostgreSQL, Redis, MinIO, bucket initialization, and Mailpit.

See the [system overview](docs/architecture/system-overview.md) and [implementation roadmap](docs/implementation-roadmap.md) for the longer-term design.

## Runtime requirements

- Node.js **24.x LTS** (`>=24 <25`; `.nvmrc` and CI pin 24.18.0)
- pnpm **11.x** (`>=11 <12`; Corepack pins 11.7.0)
- Python **3.12.x** (`>=3.12 <3.13`; `.python-version` and CI pin 3.12.4)
- Docker Engine with Docker Compose v2 for local dependencies

The preinstall check rejects unsupported Node and pnpm major versions while the version files and CI retain exact reproducible pins. Use `.nvmrc`, `.node-version`, and `.python-version` with your version managers.

## Local setup

```bash
docker compose up -d
pnpm install --frozen-lockfile
pnpm dev
```

For a first checkout, create `.env` from `.env.example`, run `pnpm db:generate` and
`pnpm db:migrate:deploy`, and create the AI virtual environment with
`python3 -m venv services/ai-service/.venv && services/ai-service/.venv/bin/pip install -e 'services/ai-service[dev]'`.
`pnpm dev` loads the root `.env` automatically for web, API, worker, and the AI service. All values
in `.env.example` are local-development values. OpenAI, Sentry, and OpenTelemetry variables remain
optional. Do not commit `.env` or real credentials.

## Local infrastructure

```bash
docker compose up -d
docker compose ps
docker compose logs
docker compose down
docker compose down -v
```

**Warning:** `docker compose down -v` permanently deletes the local PostgreSQL, Redis, MinIO, and Mailpit development data volumes.

The Compose credentials are deliberately non-default but remain local-only. They are not production secrets.
The default published PostgreSQL port is `55432`, which avoids a host PostgreSQL service commonly
using `5432`. Keep `POSTGRES_PORT` and `DATABASE_URL` aligned if you choose a different port.

## Development and quality commands

```bash
pnpm dev
pnpm build
pnpm lint
pnpm format
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm db:generate
pnpm db:validate
pnpm db:migrate
pnpm db:migrate:deploy
pnpm db:studio
pnpm clean
```

With PostgreSQL, Redis, and Mailpit healthy, run the infrastructure suite explicitly:

```bash
RUN_INTEGRATION_TESTS=true pnpm test:integration
```

Direct Python equivalents from `services/ai-service` are:

```bash
python3 -m ruff check .
python3 -m ruff format --check .
python3 -m mypy src tests
python3 -m pytest
```

## Service URLs and health endpoints

| Service             | Local URL                                         | Health                                                |
| ------------------- | ------------------------------------------------- | ----------------------------------------------------- |
| Web                 | `http://localhost:3000`                           | `GET /health`                                         |
| API                 | `http://localhost:3001`                           | `GET /api/v1/health/live`, `GET /api/v1/health/ready` |
| AI service          | `http://localhost:8000`                           | `GET /health/live`, `GET /health/ready`               |
| MinIO API / console | `http://localhost:9000` / `http://localhost:9001` | Compose health check                                  |
| Mailpit SMTP / UI   | `localhost:1025` / `http://localhost:8025`        | Compose health check                                  |

API readiness returns HTTP 503 if PostgreSQL or Redis is unavailable. Mailpit supports local
verification, reset, and invitation emails. AI readiness reports optional provider configuration
without contacting OpenAI.

## Identity and client data model

The first product migration defines users, hashed opaque sessions and transient tokens,
organisations, memberships, invitations, roles, permissions, and audit logs. A second migration
installs the reviewed Phase 2 role/permission matrix and the live-invitation uniqueness rule. A
third migration adds relationships, visibility-filtered notes, profiles, locations, services, structured
opening hours, social links, named permissions, and database-enforced partial/exclusion constraints.

## Known limitations

- No website/audit, crawler, lead capture, projects, billing, or payments.
- No OpenAI call, provider adapter implementation, recommendation data, or fake AI response.
- No worker product queue is registered.
- Terraform implementation is deferred to production hardening.

## Deployment environment

Do not deploy local `.env` values. The deployment platform must supply a managed `DATABASE_URL`
and managed `REDIS_URL`. Configure `NEXT_PUBLIC_API_URL` with the deployed API base URL,
`API_CORS_ORIGINS` with the deployed web origin, and `PUBLIC_WEB_URL` with that same web origin.
Use HTTPS and secure production session cookies; do not reuse local PostgreSQL, Redis, MinIO, or
session values in production. No platform-specific credentials are stored in this repository.
