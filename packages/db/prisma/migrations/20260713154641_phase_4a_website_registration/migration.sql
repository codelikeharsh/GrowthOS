-- CreateTable
CREATE TABLE "websites" (
    "id" UUID NOT NULL,
    "business_organization_id" UUID NOT NULL,
    "display_name" VARCHAR(160),
    "url" VARCHAR(2048) NOT NULL,
    "normalized_url" VARCHAR(2048) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "websites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "websites_business_organization_id_is_active_created_at_idx" ON "websites"("business_organization_id", "is_active", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "websites_business_organization_id_normalized_url_key" ON "websites"("business_organization_id", "normalized_url");

-- Phase 4A uses named website permissions. An agency member still needs an
-- eligible relationship assignment; permission mapping alone grants no tenant access.
INSERT INTO "permissions" ("id", "name", "description") VALUES
  ('20000000-0000-4000-8000-000000000021', 'website.read', 'Read websites belonging to an eligible business.'),
  ('20000000-0000-4000-8000-000000000022', 'website.manage', 'Register, update, and disable websites belonging to an eligible business.');

INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), role."id", permission."id"
FROM "roles" role
JOIN "permissions" permission ON permission."name" IN ('website.read', 'website.manage')
WHERE role."name" IN ('OWNER', 'ADMIN', 'MEMBER')
   OR (role."name" = 'VIEWER' AND permission."name" = 'website.read');

-- AddForeignKey
ALTER TABLE "websites" ADD CONSTRAINT "websites_business_organization_id_fkey" FOREIGN KEY ("business_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
