ALTER TABLE "toilet" ALTER COLUMN "toilet_place" TYPE varchar(120);

ALTER TABLE "toilet" ADD COLUMN IF NOT EXISTS "toilet_type" varchar(40);
ALTER TABLE "toilet" ADD COLUMN IF NOT EXISTS "toilet_address" varchar(255);
ALTER TABLE "toilet" ADD COLUMN IF NOT EXISTS "toilet_accessible" boolean NOT NULL DEFAULT false;
ALTER TABLE "toilet" ADD COLUMN IF NOT EXISTS "toilet_attendant" boolean NOT NULL DEFAULT false;
ALTER TABLE "toilet" ADD COLUMN IF NOT EXISTS "toilet_diaper" boolean NOT NULL DEFAULT false;
ALTER TABLE "toilet" ADD COLUMN IF NOT EXISTS "toilet_gender_split" boolean NOT NULL DEFAULT false;
ALTER TABLE "toilet" ADD COLUMN IF NOT EXISTS "toilet_tissue" boolean NOT NULL DEFAULT false;
ALTER TABLE "toilet" ADD COLUMN IF NOT EXISTS "toilet_paper" boolean NOT NULL DEFAULT false;
ALTER TABLE "toilet" ADD COLUMN IF NOT EXISTS "toilet_photos" text[] NOT NULL DEFAULT '{}';

DO $$ BEGIN
  ALTER TABLE "toilet" ADD CONSTRAINT "toilet_type_allowed"
    CHECK ("toilet_type" IS NULL OR "toilet_type" IN ('mall', 'gas', 'food'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
