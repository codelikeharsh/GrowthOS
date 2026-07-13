-- CreateEnum
CREATE TYPE "AgencyClientRelationshipStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "AgencyClientNoteVisibility" AS ENUM ('AGENCY_INTERNAL', 'CLIENT_VISIBLE');

-- CreateEnum
CREATE TYPE "BusinessLocationType" AS ENUM ('HEADQUARTERS', 'OFFICE', 'STORE', 'SERVICE_AREA', 'OTHER');

-- CreateEnum
CREATE TYPE "BusinessPriceType" AS ENUM ('FIXED', 'STARTING_FROM', 'RANGE', 'QUOTE_REQUIRED', 'FREE', 'NOT_DISPLAYED');

-- CreateEnum
CREATE TYPE "BusinessDayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "BusinessSocialPlatform" AS ENUM ('INSTAGRAM', 'FACEBOOK', 'LINKEDIN', 'YOUTUBE', 'X', 'WHATSAPP', 'GOOGLE_BUSINESS_PROFILE', 'OTHER');

-- CreateTable
CREATE TABLE "agency_client_relationships" (
    "id" UUID NOT NULL,
    "agency_organization_id" UUID NOT NULL,
    "business_organization_id" UUID NOT NULL,
    "status" "AgencyClientRelationshipStatus" NOT NULL DEFAULT 'PENDING',
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "primary_account_manager_user_id" UUID,
    "service_plan" VARCHAR(120),
    "started_at" TIMESTAMPTZ(6),
    "ended_at" TIMESTAMPTZ(6),
    "created_by_user_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(128),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "agency_client_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_client_notes" (
    "id" UUID NOT NULL,
    "relationship_id" UUID NOT NULL,
    "author_user_id" UUID NOT NULL,
    "visibility" "AgencyClientNoteVisibility" NOT NULL,
    "body" VARCHAR(5000) NOT NULL,
    "edited_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "agency_client_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_profiles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "legal_name" VARCHAR(160) NOT NULL,
    "trade_name" VARCHAR(160),
    "short_description" VARCHAR(300),
    "description" VARCHAR(5000),
    "industry" VARCHAR(120),
    "phone" VARCHAR(32),
    "email" VARCHAR(320),
    "website_display_url" VARCHAR(2048),
    "timezone" VARCHAR(100) NOT NULL DEFAULT 'UTC',
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "country_code" CHAR(2) NOT NULL DEFAULT 'US',
    "primary_language" VARCHAR(20) NOT NULL DEFAULT 'en',
    "logo_file_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "business_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_locations" (
    "id" UUID NOT NULL,
    "business_organization_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "location_type" "BusinessLocationType" NOT NULL DEFAULT 'OTHER',
    "address_line_1" VARCHAR(200),
    "address_line_2" VARCHAR(200),
    "city" VARCHAR(120),
    "state" VARCHAR(120),
    "postal_code" VARCHAR(32),
    "country_code" CHAR(2) NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "phone" VARCHAR(32),
    "email" VARCHAR(320),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "business_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_services" (
    "id" UUID NOT NULL,
    "business_organization_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "short_description" VARCHAR(300),
    "description" VARCHAR(5000),
    "price_type" "BusinessPriceType" NOT NULL,
    "starting_price_minor" INTEGER,
    "maximum_price_minor" INTEGER,
    "currency" CHAR(3),
    "duration_minutes" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "business_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_hours" (
    "id" UUID NOT NULL,
    "business_organization_id" UUID NOT NULL,
    "day_of_week" "BusinessDayOfWeek" NOT NULL,
    "opens_at_minutes" INTEGER,
    "closes_at_minutes" INTEGER,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "business_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_social_links" (
    "id" UUID NOT NULL,
    "business_organization_id" UUID NOT NULL,
    "platform" "BusinessSocialPlatform" NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "display_label" VARCHAR(120),
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "business_social_links_pkey" PRIMARY KEY ("id")
);

-- Prisma cannot express these cross-field and partial constraints. They keep invalid
-- tenant relationships, coordinates, pricing, and opening-hour ranges out of storage.
ALTER TABLE "agency_client_relationships"
  ADD CONSTRAINT "agency_client_relationships_distinct_organizations_check"
  CHECK ("agency_organization_id" <> "business_organization_id");

CREATE UNIQUE INDEX "agency_client_relationships_one_active_business_key"
  ON "agency_client_relationships" ("business_organization_id")
  WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX "business_locations_one_primary_active_key"
  ON "business_locations" ("business_organization_id")
  WHERE "is_primary" = true AND "is_active" = true;

ALTER TABLE "business_locations"
  ADD CONSTRAINT "business_locations_latitude_check"
    CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
  ADD CONSTRAINT "business_locations_longitude_check"
    CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180);

ALTER TABLE "business_services"
  ADD CONSTRAINT "business_services_prices_nonnegative_check"
    CHECK (("starting_price_minor" IS NULL OR "starting_price_minor" >= 0)
      AND ("maximum_price_minor" IS NULL OR "maximum_price_minor" >= 0)),
  ADD CONSTRAINT "business_services_price_range_check"
    CHECK ("price_type" <> 'RANGE'
      OR ("starting_price_minor" IS NOT NULL AND "maximum_price_minor" IS NOT NULL
        AND "maximum_price_minor" >= "starting_price_minor")),
  ADD CONSTRAINT "business_services_duration_check"
    CHECK ("duration_minutes" IS NULL OR "duration_minutes" > 0);

ALTER TABLE "business_hours"
  ADD CONSTRAINT "business_hours_interval_check"
    CHECK (("is_closed" = true AND "opens_at_minutes" IS NULL AND "closes_at_minutes" IS NULL)
      OR ("is_closed" = false AND "opens_at_minutes" >= 0 AND "opens_at_minutes" < 1440
        AND "closes_at_minutes" > "opens_at_minutes" AND "closes_at_minutes" <= 1440));

CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "business_hours"
  ADD CONSTRAINT "business_hours_no_overlap_exclusion"
  EXCLUDE USING gist (
    "business_organization_id" WITH =,
    "day_of_week" WITH =,
    int4range("opens_at_minutes", "closes_at_minutes", '[)') WITH &&
  ) WHERE ("is_closed" = false);

-- Phase 3 named capabilities. Controllers and services authorize capabilities rather
-- than role names; role defaults remain editable data.
INSERT INTO "permissions" ("id", "name", "description") VALUES
  ('20000000-0000-4000-8000-000000000001', 'agency_client.read', 'Read eligible agency client relationships.'),
  ('20000000-0000-4000-8000-000000000002', 'agency_client.create', 'Create a business client and relationship.'),
  ('20000000-0000-4000-8000-000000000003', 'agency_client.update', 'Update an eligible agency client relationship.'),
  ('20000000-0000-4000-8000-000000000004', 'agency_client.suspend', 'Suspend and reactivate an agency client relationship.'),
  ('20000000-0000-4000-8000-000000000005', 'agency_client.terminate', 'Terminate an agency client relationship.'),
  ('20000000-0000-4000-8000-000000000006', 'agency_client.assign_manager', 'Assign eligible agency account managers.'),
  ('20000000-0000-4000-8000-000000000007', 'agency_client.notes.internal.read', 'Read agency-internal client notes.'),
  ('20000000-0000-4000-8000-000000000008', 'agency_client.notes.internal.write', 'Create and edit agency-internal client notes.'),
  ('20000000-0000-4000-8000-000000000009', 'agency_client.notes.client.read', 'Read client-visible relationship notes.'),
  ('20000000-0000-4000-8000-000000000010', 'agency_client.notes.client.write', 'Create and edit client-visible relationship notes.'),
  ('20000000-0000-4000-8000-000000000011', 'business_profile.read', 'Read an eligible business profile.'),
  ('20000000-0000-4000-8000-000000000012', 'business_profile.update', 'Update an eligible business profile.'),
  ('20000000-0000-4000-8000-000000000013', 'business_location.read', 'Read eligible business locations.'),
  ('20000000-0000-4000-8000-000000000014', 'business_location.manage', 'Manage eligible business locations.'),
  ('20000000-0000-4000-8000-000000000015', 'business_service.read', 'Read eligible business services.'),
  ('20000000-0000-4000-8000-000000000016', 'business_service.manage', 'Manage eligible business services.'),
  ('20000000-0000-4000-8000-000000000017', 'business_hours.read', 'Read eligible business opening hours.'),
  ('20000000-0000-4000-8000-000000000018', 'business_hours.manage', 'Manage eligible business opening hours.'),
  ('20000000-0000-4000-8000-000000000019', 'business_social_link.read', 'Read eligible business social links.'),
  ('20000000-0000-4000-8000-000000000020', 'business_social_link.manage', 'Manage eligible business social links.');

-- OWNER and ADMIN receive all Phase 3 capabilities. MEMBER receives assigned-client
-- collaboration and business maintenance; VIEWER receives read-only capabilities.
INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT gen_random_uuid(), role."id", permission."id"
FROM "roles" role
JOIN "permissions" permission ON permission."name" LIKE 'agency_client.%'
  OR permission."name" LIKE 'business_%'
WHERE role."name" IN ('OWNER', 'ADMIN')
   OR (role."name" = 'MEMBER' AND permission."name" IN (
     'agency_client.read', 'agency_client.update',
     'agency_client.notes.client.read', 'agency_client.notes.client.write',
     'business_profile.read', 'business_profile.update',
     'business_location.read', 'business_location.manage',
     'business_service.read', 'business_service.manage',
     'business_hours.read', 'business_hours.manage',
     'business_social_link.read', 'business_social_link.manage'
   ))
   OR (role."name" = 'VIEWER' AND permission."name" IN (
     'agency_client.read', 'agency_client.notes.client.read',
     'business_profile.read', 'business_location.read', 'business_service.read',
     'business_hours.read', 'business_social_link.read'
   ));

-- CreateIndex
CREATE INDEX "agency_client_relationships_agency_organization_id_status_c_idx" ON "agency_client_relationships"("agency_organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "agency_client_relationships_business_organization_id_status_idx" ON "agency_client_relationships"("business_organization_id", "status");

-- CreateIndex
CREATE INDEX "agency_client_relationships_agency_organization_id_primary__idx" ON "agency_client_relationships"("agency_organization_id", "primary_account_manager_user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "agency_client_relationships_agency_organization_id_idempote_key" ON "agency_client_relationships"("agency_organization_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "agency_client_notes_relationship_id_created_at_id_idx" ON "agency_client_notes"("relationship_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "agency_client_notes_relationship_id_visibility_created_at_idx" ON "agency_client_notes"("relationship_id", "visibility", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "business_profiles_organization_id_key" ON "business_profiles"("organization_id");

-- CreateIndex
CREATE INDEX "business_locations_business_organization_id_is_active_creat_idx" ON "business_locations"("business_organization_id", "is_active", "created_at");

-- CreateIndex
CREATE INDEX "business_services_business_organization_id_is_active_displa_idx" ON "business_services"("business_organization_id", "is_active", "display_order");

-- CreateIndex
CREATE UNIQUE INDEX "business_services_business_organization_id_slug_key" ON "business_services"("business_organization_id", "slug");

-- CreateIndex
CREATE INDEX "business_hours_business_organization_id_day_of_week_idx" ON "business_hours"("business_organization_id", "day_of_week");

-- CreateIndex
CREATE UNIQUE INDEX "business_hours_business_organization_id_day_of_week_display_key" ON "business_hours"("business_organization_id", "day_of_week", "display_order");

-- CreateIndex
CREATE INDEX "business_social_links_business_organization_id_display_orde_idx" ON "business_social_links"("business_organization_id", "display_order");

-- AddForeignKey
ALTER TABLE "agency_client_relationships" ADD CONSTRAINT "agency_client_relationships_agency_organization_id_fkey" FOREIGN KEY ("agency_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_client_relationships" ADD CONSTRAINT "agency_client_relationships_business_organization_id_fkey" FOREIGN KEY ("business_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_client_relationships" ADD CONSTRAINT "agency_client_relationships_primary_account_manager_user_i_fkey" FOREIGN KEY ("primary_account_manager_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_client_relationships" ADD CONSTRAINT "agency_client_relationships_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_client_notes" ADD CONSTRAINT "agency_client_notes_relationship_id_fkey" FOREIGN KEY ("relationship_id") REFERENCES "agency_client_relationships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_client_notes" ADD CONSTRAINT "agency_client_notes_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_profiles" ADD CONSTRAINT "business_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_locations" ADD CONSTRAINT "business_locations_business_organization_id_fkey" FOREIGN KEY ("business_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_services" ADD CONSTRAINT "business_services_business_organization_id_fkey" FOREIGN KEY ("business_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_business_organization_id_fkey" FOREIGN KEY ("business_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_social_links" ADD CONSTRAINT "business_social_links_business_organization_id_fkey" FOREIGN KEY ("business_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
