CREATE TABLE IF NOT EXISTS "plan" (
  "plan_code" varchar(16) PRIMARY KEY,
  "plan_name" varchar(32) NOT NULL,
  "price_month" integer NOT NULL,
  "taxi_quota" integer NOT NULL,
  "nearwake_quota" integer NOT NULL,
  CONSTRAINT "plan_price_nonneg" CHECK ("price_month" >= 0),
  CONSTRAINT "plan_taxi_quota_nonneg" CHECK ("taxi_quota" >= 0),
  CONSTRAINT "plan_nearwake_quota_nonneg" CHECK ("nearwake_quota" >= 0)
);

INSERT INTO "plan" ("plan_code", "plan_name", "price_month", "taxi_quota", "nearwake_quota")
VALUES
  ('free', 'Free', 0, 30, 30),
  ('plus', 'Plus', 10, 100, 100),
  ('pro', 'Pro', 30, 500, 500)
ON CONFLICT ("plan_code") DO UPDATE SET
  "plan_name" = EXCLUDED."plan_name",
  "price_month" = EXCLUDED."price_month",
  "taxi_quota" = EXCLUDED."taxi_quota",
  "nearwake_quota" = EXCLUDED."nearwake_quota";

CREATE TABLE IF NOT EXISTS "user_plan" (
  "auth_uuid" uuid PRIMARY KEY REFERENCES "auth"("auth_uuid"),
  "plan_code" varchar(16) NOT NULL REFERENCES "plan"("plan_code"),
  "selected_at" timestamptz NOT NULL DEFAULT now()
);

INSERT INTO "user_plan" ("auth_uuid", "plan_code", "selected_at")
SELECT "auth_uuid", 'free', now() FROM "auth"
ON CONFLICT ("auth_uuid") DO NOTHING;

CREATE TABLE IF NOT EXISTS "feature_usage" (
  "usage_uuid" uuid PRIMARY KEY,
  "auth_uuid" uuid NOT NULL REFERENCES "auth"("auth_uuid"),
  "feature_key" varchar(32) NOT NULL,
  "period_ym" varchar(7) NOT NULL,
  "used_count" integer NOT NULL DEFAULT 0,
  CONSTRAINT "feature_usage_auth_feature_period" UNIQUE ("auth_uuid", "feature_key", "period_ym"),
  CONSTRAINT "feature_usage_key_allowed" CHECK ("feature_key" IN ('taxi', 'nearwake')),
  CONSTRAINT "feature_usage_count_nonneg" CHECK ("used_count" >= 0)
);

CREATE INDEX IF NOT EXISTS "feature_usage_auth_period_idx"
  ON "feature_usage" ("auth_uuid", "period_ym");

ALTER TABLE "plan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_plan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "feature_usage" ENABLE ROW LEVEL SECURITY;
