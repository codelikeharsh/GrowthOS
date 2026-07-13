# zero2one Growth OS

zero2one Growth OS is a planned multi-tenant operating system for digital service agencies and their business clients. The product will combine deterministic website audits, evidence-backed AI assistance, lead management, client delivery, files, approvals, reporting, and billing. Core workflows must remain useful when AI is unavailable.

## Current phase

Phases 0, 1, and 2 are complete. The repository now includes the validated platform foundation plus
first-party authentication, PostgreSQL-backed opaque sessions, organisations, memberships,
invitations, RBAC, tenant isolation, audit logging, and the minimal functional identity UI. Phase 3
has not started.

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
cp .env.example .env
set -a
source .env
set +a
corepack prepare pnpm@11.7.0 --activate
pnpm install --frozen-lockfile
python3 -m venv services/ai-service/.venv
services/ai-service/.venv/bin/pip install -e 'services/ai-service[dev]'
source services/ai-service/.venv/bin/activate
docker compose up -d
pnpm db:generate
pnpm db:migrate:deploy
pnpm dev
```

All values in `.env.example` are local-development values. OpenAI, Sentry, and OpenTelemetry
variables remain optional. Do not commit `.env` or real credentials.

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
If port 5432 is already occupied, set `POSTGRES_PORT` and use the same port in `DATABASE_URL`.

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

## Identity data model

The first product migration defines users, hashed opaque sessions and transient tokens,
organisations, memberships, invitations, roles, permissions, and audit logs. A second migration
installs the reviewed Phase 2 role/permission matrix and the live-invitation uniqueness rule. The
generated Prisma client remains backend-only and ignored by Git.

## Known limitations

- No product domains, crawler, lead capture, projects, billing, or payments.
- No OpenAI call, provider adapter implementation, recommendation data, or fake AI response.
- No worker product queue is registered.
- Terraform implementation is deferred to production hardening.

The next permitted roadmap boundary is Phase 3: agency-client relationships and business profiles.
