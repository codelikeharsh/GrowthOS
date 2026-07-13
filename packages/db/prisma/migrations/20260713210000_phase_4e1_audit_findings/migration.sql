CREATE TYPE "AuditFindingCategory" AS ENUM ('TECHNICAL', 'SEO', 'CONTENT', 'BROKEN_LINK');
CREATE TYPE "AuditFindingSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TABLE "audit_findings" (
  "id" UUID NOT NULL, "audit_run_id" UUID NOT NULL, "audit_page_id" UUID,
  "category" "AuditFindingCategory" NOT NULL, "rule_id" VARCHAR(100) NOT NULL,
  "severity" "AuditFindingSeverity" NOT NULL, "title" VARCHAR(300) NOT NULL,
  "description" VARCHAR(2000) NOT NULL, "evidence" JSONB NOT NULL,
  "recommendation_template" VARCHAR(2000) NOT NULL, "fingerprint" CHAR(64) NOT NULL,
  "first_detected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_detected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMPTZ(6), "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL, CONSTRAINT "audit_findings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "audit_findings_audit_run_id_fingerprint_key" ON "audit_findings"("audit_run_id", "fingerprint");
CREATE INDEX "audit_findings_audit_run_id_severity_category_idx" ON "audit_findings"("audit_run_id", "severity", "category");
CREATE INDEX "audit_findings_audit_page_id_idx" ON "audit_findings"("audit_page_id");
ALTER TABLE "audit_findings" ADD CONSTRAINT "audit_findings_audit_run_id_fkey" FOREIGN KEY ("audit_run_id") REFERENCES "audit_runs"("id") ON DELETE CASCADE;
ALTER TABLE "audit_findings" ADD CONSTRAINT "audit_findings_audit_page_id_fkey" FOREIGN KEY ("audit_page_id") REFERENCES "audit_pages"("id") ON DELETE SET NULL;
