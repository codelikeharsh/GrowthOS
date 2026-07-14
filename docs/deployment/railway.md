# Railway production deployment

Configure one Railway project with `growthos-web`, `growthos-api`, `growthos-worker`,
`growthos-ai-service`, Railway PostgreSQL, and Railway Redis. Do not deploy local Docker services.

| Service               | Config path                      | Build                                                           | Pre-deploy                   | Start                                                                 | Health check           | Public domain |
| --------------------- | -------------------------------- | --------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------- | ---------------------- | ------------- |
| `growthos-web`        | `deploy/railway/web.toml`        | `pnpm install --frozen-lockfile && pnpm railway:build:web`      | none                         | `pnpm railway:start:web`                                              | `/health`              | required      |
| `growthos-api`        | `deploy/railway/api.toml`        | `pnpm install --frozen-lockfile && pnpm railway:build:api`      | `pnpm railway:prisma:deploy` | `pnpm railway:start:api`                                              | `/api/v1/health/ready` | required      |
| `growthos-worker`     | `deploy/railway/worker.toml`     | `pnpm install --frozen-lockfile && pnpm railway:build:worker`   | none                         | `pnpm railway:start:worker`                                           | none                   | never         |
| `growthos-ai-service` | `deploy/railway/ai-service.toml` | Docker build with `infrastructure/docker/ai-service.Dockerfile` | none                         | `python3 -m uvicorn growthos_ai.main:app --host 0.0.0.0 --port $PORT` | `/health/live`         | never         |

Set every source service's Railway root directory to the repository root. In each service's Railway
settings, select the matching Config as Code path above. The Node services build shared packages
from the root; do not configure a subdirectory root.

The web build packages `apps/web/.next/static` into
`apps/web/.next/standalone/apps/web/.next/static` after `next build`. If `apps/web/public` exists,
it is copied to `apps/web/.next/standalone/apps/web/public` as well. The standalone server therefore
serves the same hashed JavaScript, CSS, and public assets referenced by the generated HTML.

## Networking

Generate public domains only for web and API. PostgreSQL, Redis, worker, and AI service remain
private. Use Railway's managed database `DATABASE_URL` and managed Redis `REDIS_URL` references,
not public proxy URLs. Railway private networking is project-scoped and is the required path for
API/worker database and Redis traffic.

The browser cannot use a private domain. Set web `NEXT_PUBLIC_API_URL` to the API's public HTTPS
base URL with `/api/v1`, for example `https://api.example.com/api/v1`. The API does not currently
call AI. When it does, use a private AI URL such as
`http://${{growthos-ai-service.RAILWAY_PRIVATE_DOMAIN}}:${{growthos-ai-service.PORT}}` for
`AI_SERVICE_URL`.

Railway supplies `PORT`; HTTP services bind to `0.0.0.0:$PORT`. Do not configure local ports such
as 3000, 3001, 8000, or 55432 in production.

## Variables

Set `NODE_ENV=production` on every application service. API and worker need Railway PostgreSQL
`DATABASE_URL`, Railway Redis `REDIS_URL`, and `LOG_LEVEL`. The worker uses Prisma to persist audit
processing, so it needs the same private `DATABASE_URL` as API.

API also requires `WEB_APP_URL` and `API_CORS_ORIGINS`, both set to the exact public HTTPS web
origin; `NEXT_PUBLIC_API_URL` is required at web build time. Configure explicit session durations
and rate limits. `SESSION_COOKIE_NAME` and `CSRF_COOKIE_NAME` are stable non-secret names. The app
uses opaque database-backed session/CSRF tokens, so it has no session signing-secret variable.
Cookie `Secure` is automatically enabled when `NODE_ENV=production`.

Railway blocks outbound SMTP on Trial/Hobby, so production API services must use Resend HTTPS:
set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and a verified `MAIL_FROM`. The API applies the
bounded `EMAIL_DELIVERY_TIMEOUT_MS` (default 10 seconds) to every provider request. Do not set or
use SMTP variables for that provider. Local Mailpit remains supported with `EMAIL_PROVIDER=smtp`,
`SMTP_HOST=localhost`, `SMTP_PORT=1025`, and `SMTP_SECURE=false`; SMTP is not the Railway
production transport. `SMTP_USER` and `SMTP_PASSWORD` must be supplied together when SMTP is used.

The AI service needs `NODE_ENV`, `LOG_LEVEL`, `AI_PROVIDER`, and optional `OPENAI_API_KEY` plus
`OPENAI_MODEL`. No current production journey requires AI provider credentials.

Phase 5 local measurements require no extra Railway variable or public-internet test dependency.
An optional remote performance provider is intentionally not enabled by default: do not add a
provider API key until the provider is configured through the worker's secure target-validation
boundary, with HTTPS, strict timeout/rate limits, and a clearly labelled provider-metric source.
Local response timing is not presented as Core Web Vitals.

## Database, storage, and deployment order

The API pre-deploy command runs only `prisma migrate deploy`. It never runs `migrate dev`, reset,
or seed. Create PostgreSQL and Redis first, then API with private references and SMTP/public-origin
variables. Generate the API public domain, set the web build variable `NEXT_PUBLIC_API_URL`, deploy
web and generate its public domain, then set API `WEB_APP_URL` and `API_CORS_ORIGINS` to that final
web origin and redeploy API. Finally deploy worker and AI service.

No active product path reads or writes MinIO/S3: screenshots and private file storage remain
deferred. Object storage is optional and must not block this deployment. A future storage phase must
add S3-compatible endpoint, region, bucket, access-key, secret-key, and signed-URL policy variables.

## Verification and secrets

After deployment, verify public web `/health`, API `/api/v1/health/ready`, SMTP registration and
verification, queue dispatch, worker processing, persisted report data, and cross-tenant 404 denial.
Confirm PostgreSQL, Redis, worker, and AI service have no public domains.

Generate a 48-byte secret for a future provider with `pnpm secrets:generate`; enter its output only
in Railway. The command stores nothing. Never commit `.env`, Railway exports, generated secrets,
SMTP credentials, database URLs, or provider API keys.
