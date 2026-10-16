CREATE TABLE IF NOT EXISTS "mood" (
  "mood_uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "mood_key" varchar(32) NOT NULL,
  "mood_score" integer NOT NULL,
  "auth_uuid" uuid NOT NULL REFERENCES "auth"("auth_uuid"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "mood_score_range" CHECK ("mood_score" BETWEEN 1 AND 5),
  CONSTRAINT "mood_key_allowed" CHECK (
    "mood_key" IN ('sad', 'confused', 'smile', 'happy', 'very_happy')
  )
);

CREATE INDEX IF NOT EXISTS "mood_auth_created_idx"
  ON "mood" ("auth_uuid", "created_at" DESC);

ALTER TABLE "mood" ENABLE ROW LEVEL SECURITY;
