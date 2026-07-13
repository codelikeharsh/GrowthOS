CREATE TYPE "AuditRunStatus" AS ENUM ('QUEUED', 'VALIDATING_TARGET', 'CRAWLING', 'ANALYZING', 'GENERATING_RECOMMENDATIONS', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED');
CREATE TYPE "AuditTriggerType" AS ENUM ('MANUAL', 'SCHEDULED');

CREATE TABLE "audit_runs" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "website_id" UUID NOT NULL,
  "initiated_by_user_id" UUID NOT NULL,
  "status" "AuditRunStatus" NOT NULL DEFAULT 'QUEUED',
  "trigger_type" "AuditTriggerType" NOT NULL DEFAULT 'MANUAL',
  "configuration" JSONB,
  "idempotency_key" VARCHAR(128),
  "started_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "failed_at" TIMESTAMPTZ(6),
  "failure_code" VARCHAR(100),
  "failure_message" VARCHAR(500),
  "pages_discovered" INTEGER NOT NULL DEFAULT 0,
  "pages_processed" INTEGER NOT NULL DEFAULT 0,
  "previous_audit_run_id" UUID,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "audit_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outbox_events" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "audit_run_id" UUID NOT NULL,
  "event_type" VARCHAR(100) NOT NULL,
  "payload" JSONB NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "processed_at" TIMESTAMPTZ(6),
  "last_error" VARCHAR(500),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- The partial index prevents an overlapping audit even if two requests race.
CREATE UNIQUE INDEX "audit_runs_one_active_per_website_key"
  ON "audit_runs" ("website_id")
  WHERE "status" IN ('QUEUED', 'VALIDATING_TARGET', 'CRAWLING', 'ANALYZING', 'GENERATING_RECOMMENDATIONS');
CREATE INDEX "audit_runs_organization_id_created_at_idx" ON "audit_runs"("organization_id", "created_at");
CREATE INDEX "audit_runs_website_id_created_at_idx" ON "audit_runs"("website_id", "created_at");
CREATE UNIQUE INDEX "audit_runs_website_id_idempotency_key_key" ON "audit_runs"("website_id", "idempotency_key");
CREATE UNIQUE INDEX "outbox_events_audit_run_id_key" ON "outbox_events"("audit_run_id");
CREATE INDEX "outbox_events_processed_at_created_at_idx" ON "outbox_events"("processed_at", "created_at");

INSERT INTO "permissions" ("id", "name", "description") VALUES
  ('20000000-0000-4000-8000-000000000023', 'website.audit.create', 'Request an audit for an eligible website.'),
  ('20000000-0000-4000-8000-000000000024', 'website.audit.read', 'Read audits for an eligible website.'),
  ('20000000-0000-4000-8000-000000000025', 'website.audit.cancel', 'Cancel an eligible queued audit.');

INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), role."id", permission."id"
FROM "roles" role JOIN "permissions" permission ON permission."name" LIKE 'website.audit.%'
WHERE role."name" IN ('OWNER', 'ADMIN', 'MEMBER')
   OR (role."name" = 'VIEWER' AND permission."name" = 'website.audit.read');

ALTER TABLE "audit_runs" ADD CONSTRAINT "audit_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_runs" ADD CONSTRAINT "audit_runs_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "websites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_runs" ADD CONSTRAINT "audit_runs_initiated_by_user_id_fkey" FOREIGN KEY ("initiated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "audit_runs" ADD CONSTRAINT "audit_runs_previous_audit_run_id_fkey" FOREIGN KEY ("previous_audit_run_id") REFERENCES "audit_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_audit_run_id_fkey" FOREIGN KEY ("audit_run_id") REFERENCES "audit_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
