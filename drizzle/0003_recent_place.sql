CREATE TABLE IF NOT EXISTS "recent_place" (
  "recent_place_uuid" uuid PRIMARY KEY,
  "recent_place_name" varchar(150),
  "user_uuid" uuid NOT NULL REFERENCES "user"("user_uuid"),
  "storeplace_uuid" uuid NOT NULL REFERENCES "storeplace"("storeplace_uuid"),
  "used_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "recent_place_user_store_unique" UNIQUE ("user_uuid", "storeplace_uuid")
);

CREATE INDEX IF NOT EXISTS "recent_place_user_used_idx"
  ON "recent_place" ("user_uuid", "used_at" DESC);

ALTER TABLE "recent_place" ENABLE ROW LEVEL SECURITY;
