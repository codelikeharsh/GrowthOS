CREATE TYPE "AuditPageStatus" AS ENUM ('FETCHED', 'FAILED');

CREATE TABLE "audit_pages" (
    "id" UUID NOT NULL,
    "audit_run_id" UUID NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "normalized_url" VARCHAR(2048) NOT NULL,
    "canonical_url" VARCHAR(2048),
    "http_status" INTEGER,
    "content_type" VARCHAR(255),
    "title" VARCHAR(1000),
    "meta_description" VARCHAR(2000),
    "word_count" INTEGER,
    "load_duration_ms" INTEGER,
    "status" "AuditPageStatus" NOT NULL,
    "error_code" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "audit_pages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "audit_pages_audit_run_id_normalized_url_key" ON "audit_pages"("audit_run_id", "normalized_url");
CREATE INDEX "audit_pages_audit_run_id_status_idx" ON "audit_pages"("audit_run_id", "status");
ALTER TABLE "audit_pages" ADD CONSTRAINT "audit_pages_audit_run_id_fkey" FOREIGN KEY ("audit_run_id") REFERENCES "audit_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
