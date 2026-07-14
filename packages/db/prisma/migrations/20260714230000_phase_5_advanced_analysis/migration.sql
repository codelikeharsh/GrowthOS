-- Phase 5 adds bounded, tenant-scoped advanced audit facts. Existing audit/page
-- records are left intact so historical Phase 4 reports remain readable.
ALTER TYPE "AuditFindingCategory" ADD VALUE IF NOT EXISTS 'ACCESSIBILITY';
ALTER TYPE "AuditFindingCategory" ADD VALUE IF NOT EXISTS 'PERFORMANCE';
ALTER TYPE "AuditFindingCategory" ADD VALUE IF NOT EXISTS 'STRUCTURED_DATA';
ALTER TYPE "AuditFindingCategory" ADD VALUE IF NOT EXISTS 'MOBILE';
ALTER TYPE "AuditFindingCategory" ADD VALUE IF NOT EXISTS 'SECURITY';

CREATE TYPE "AuditLinkKind" AS ENUM ('INTERNAL', 'EXTERNAL', 'UNSUPPORTED', 'MALFORMED');
CREATE TYPE "AuditLinkStatus" AS ENUM ('WORKING', 'BROKEN', 'REDIRECT', 'UNCHECKED', 'FAILED');
CREATE TYPE "AuditStructuredDataStatus" AS ENUM ('VALID', 'WARNING', 'ERROR', 'UNSUPPORTED');

ALTER TABLE "audit_runs"
  ADD COLUMN "links_checked" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "progress_stage" VARCHAR(100);

CREATE TABLE "audit_page_metrics" (
  "id" UUID NOT NULL,
  "audit_page_id" UUID NOT NULL,
  "html_bytes" INTEGER NOT NULL DEFAULT 0,
  "response_time_ms" INTEGER,
  "resource_count" INTEGER NOT NULL DEFAULT 0,
  "javascript_count" INTEGER NOT NULL DEFAULT 0,
  "stylesheet_count" INTEGER NOT NULL DEFAULT 0,
  "image_count" INTEGER NOT NULL DEFAULT 0,
  "font_count" INTEGER NOT NULL DEFAULT 0,
  "third_party_origin_count" INTEGER NOT NULL DEFAULT 0,
  "estimated_transfer_bytes" INTEGER NOT NULL DEFAULT 0,
  "html_lang" VARCHAR(64),
  "viewport" VARCHAR(500),
  "content_hash" CHAR(64),
  "summary" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "audit_page_metrics_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "audit_page_metrics_audit_page_id_key" ON "audit_page_metrics"("audit_page_id");
CREATE INDEX "audit_page_metrics_content_hash_idx" ON "audit_page_metrics"("content_hash");
ALTER TABLE "audit_page_metrics" ADD CONSTRAINT "audit_page_metrics_audit_page_id_fkey"
  FOREIGN KEY ("audit_page_id") REFERENCES "audit_pages"("id") ON DELETE CASCADE;

CREATE TABLE "audit_links" (
  "id" UUID NOT NULL,
  "audit_run_id" UUID NOT NULL,
  "source_audit_page_id" UUID,
  "destination_url" VARCHAR(2048) NOT NULL,
  "kind" "AuditLinkKind" NOT NULL,
  "status" "AuditLinkStatus" NOT NULL DEFAULT 'UNCHECKED',
  "http_status" INTEGER,
  "redirect_url" VARCHAR(2048),
  "redirect_depth" INTEGER NOT NULL DEFAULT 0,
  "anchor_text" VARCHAR(500),
  "failure_code" VARCHAR(100),
  "first_discovered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "audit_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "audit_links_audit_run_id_source_audit_page_id_destination_url_key"
  ON "audit_links"("audit_run_id", "source_audit_page_id", "destination_url");
CREATE INDEX "audit_links_audit_run_id_kind_status_idx" ON "audit_links"("audit_run_id", "kind", "status");
CREATE INDEX "audit_links_source_audit_page_id_idx" ON "audit_links"("source_audit_page_id");
ALTER TABLE "audit_links" ADD CONSTRAINT "audit_links_audit_run_id_fkey"
  FOREIGN KEY ("audit_run_id") REFERENCES "audit_runs"("id") ON DELETE CASCADE;
ALTER TABLE "audit_links" ADD CONSTRAINT "audit_links_source_audit_page_id_fkey"
  FOREIGN KEY ("source_audit_page_id") REFERENCES "audit_pages"("id") ON DELETE SET NULL;

CREATE TABLE "audit_structured_data" (
  "id" UUID NOT NULL,
  "audit_page_id" UUID NOT NULL,
  "block_index" INTEGER NOT NULL,
  "status" "AuditStructuredDataStatus" NOT NULL,
  "types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "context" VARCHAR(500),
  "summary" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "audit_structured_data_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "audit_structured_data_audit_page_id_block_index_key"
  ON "audit_structured_data"("audit_page_id", "block_index");
CREATE INDEX "audit_structured_data_audit_page_id_status_idx" ON "audit_structured_data"("audit_page_id", "status");
ALTER TABLE "audit_structured_data" ADD CONSTRAINT "audit_structured_data_audit_page_id_fkey"
  FOREIGN KEY ("audit_page_id") REFERENCES "audit_pages"("id") ON DELETE CASCADE;

CREATE TABLE "audit_category_scores" (
  "id" UUID NOT NULL,
  "audit_run_id" UUID NOT NULL,
  "category" VARCHAR(64) NOT NULL,
  "score" INTEGER NOT NULL,
  "finding_count" INTEGER NOT NULL DEFAULT 0,
  "methodology_version" VARCHAR(32) NOT NULL,
  "explanation" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "audit_category_scores_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "audit_category_scores_audit_run_id_category_key"
  ON "audit_category_scores"("audit_run_id", "category");
CREATE INDEX "audit_category_scores_audit_run_id_category_idx"
  ON "audit_category_scores"("audit_run_id", "category");
ALTER TABLE "audit_category_scores" ADD CONSTRAINT "audit_category_scores_audit_run_id_fkey"
  FOREIGN KEY ("audit_run_id") REFERENCES "audit_runs"("id") ON DELETE CASCADE;

CREATE TABLE "audit_comparisons" (
  "id" UUID NOT NULL,
  "audit_run_id" UUID NOT NULL,
  "previous_audit_run_id" UUID,
  "scoring_version" VARCHAR(32) NOT NULL,
  "overall_score_change" INTEGER,
  "new_findings" INTEGER NOT NULL DEFAULT 0,
  "resolved_findings" INTEGER NOT NULL DEFAULT 0,
  "unchanged_findings" INTEGER NOT NULL DEFAULT 0,
  "page_count_change" INTEGER,
  "details" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "audit_comparisons_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "audit_comparisons_audit_run_id_key" ON "audit_comparisons"("audit_run_id");
CREATE INDEX "audit_comparisons_previous_audit_run_id_idx" ON "audit_comparisons"("previous_audit_run_id");
ALTER TABLE "audit_comparisons" ADD CONSTRAINT "audit_comparisons_audit_run_id_fkey"
  FOREIGN KEY ("audit_run_id") REFERENCES "audit_runs"("id") ON DELETE CASCADE;
