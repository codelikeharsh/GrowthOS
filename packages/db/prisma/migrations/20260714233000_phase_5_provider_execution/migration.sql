-- Optional Phase 5 provider measurements are additive. Raw provider bodies,
-- target URLs, and credentials are intentionally never stored.
CREATE TYPE "AuditProviderExecutionStatus" AS ENUM ('SUCCEEDED', 'FAILED', 'UNAVAILABLE');

CREATE TABLE "audit_provider_executions" (
  "id" UUID NOT NULL,
  "audit_run_id" UUID NOT NULL,
  "provider" VARCHAR(64) NOT NULL,
  "status" "AuditProviderExecutionStatus" NOT NULL,
  "metrics" JSONB NOT NULL DEFAULT '{}',
  "error_code" VARCHAR(100),
  "measured_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "audit_provider_executions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "audit_provider_executions_audit_run_id_provider_key"
  ON "audit_provider_executions"("audit_run_id", "provider");
CREATE INDEX "audit_provider_executions_audit_run_id_status_idx"
  ON "audit_provider_executions"("audit_run_id", "status");
ALTER TABLE "audit_provider_executions" ADD CONSTRAINT "audit_provider_executions_audit_run_id_fkey"
  FOREIGN KEY ("audit_run_id") REFERENCES "audit_runs"("id") ON DELETE CASCADE;
