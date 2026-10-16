CREATE TABLE IF NOT EXISTS "auth" (
  "auth_uuid" uuid PRIMARY KEY,
  "auth_email" varchar(50) NOT NULL UNIQUE,
  "auth_password" varchar(255) NOT NULL,
  "auth_image" text,
  "auth_createat" timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS "user" (
  "user_uuid" uuid PRIMARY KEY,
  "user_name" varchar(20) NOT NULL,
  "user_birthdate" timestamptz,
  "user_phone" varchar(15) NOT NULL,
  "auth_uuid" uuid NOT NULL REFERENCES "auth"("auth_uuid")
);

CREATE TABLE IF NOT EXISTS "refresh_token" (
  "refresh_tokens_uuid" uuid PRIMARY KEY,
  "auth_uuid" uuid NOT NULL REFERENCES "auth"("auth_uuid"),
  "auth_email" varchar(50) NOT NULL,
  "refresh_token" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL,
  "revoked_at" timestamptz
);

CREATE TABLE IF NOT EXISTS "feature" (
  "feature_uuid" uuid PRIMARY KEY,
  "feature_name" varchar(50) NOT NULL,
  "feature_version" varchar(20) NOT NULL,
  "feature_createat" timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS "favorite" (
  "user_feature_uuid" uuid PRIMARY KEY,
  "user_uuid" uuid NOT NULL REFERENCES "user"("user_uuid"),
  "feature_uuid" uuid NOT NULL REFERENCES "feature"("feature_uuid")
);

CREATE TABLE IF NOT EXISTS "storeplace" (
  "storeplace_uuid" uuid PRIMARY KEY,
  "place_id" varchar(50),
  "place_name" varchar(150),
  "place_detail" varchar(250),
  "place_lat" double precision,
  "place_lon" double precision
);

CREATE TABLE IF NOT EXISTS "favorite_place" (
  "favorite_place_uuid" uuid PRIMARY KEY,
  "favorite_place_name" varchar(150),
  "user_uuid" uuid NOT NULL REFERENCES "user"("user_uuid"),
  "storeplace_uuid" uuid NOT NULL REFERENCES "storeplace"("storeplace_uuid"),
  CONSTRAINT "favorite_place_user_store_unique" UNIQUE ("user_uuid", "storeplace_uuid")
);

CREATE TABLE IF NOT EXISTS "toilet" (
  "toilet_uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "toilet_place" varchar(50) NOT NULL,
  "toilet_cleanscore" integer,
  "toilet_bidet" varchar(50),
  "toilet_price" integer,
  "toilet_quantity" integer,
  "toilet_avgscore" integer,
  "toilet_comment" varchar(255),
  "toilet_latitude" double precision,
  "toilet_longitude" double precision,
  "toilet_status" varchar(50),
  "toilet_safe" integer,
  "toilet_openhours" varchar(50),
  "user_uuid" uuid REFERENCES "user"("user_uuid"),
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "otp_challenge" (
  "email" varchar(50) PRIMARY KEY,
  "code_hash" varchar(255) NOT NULL,
  "expires_at" timestamptz NOT NULL
);

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
