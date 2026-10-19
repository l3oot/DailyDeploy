import {
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const auth = pgTable("auth", {
  authUuid: uuid("auth_uuid").primaryKey(),
  authEmail: varchar("auth_email", { length: 50 }).notNull().unique(),
  authPassword: varchar("auth_password", { length: 255 }).notNull(),
  authImage: text("auth_image"),
  authCreateat: timestamp("auth_createat", { withTimezone: true }).notNull(),
});

export const users = pgTable("user", {
  userUuid: uuid("user_uuid").primaryKey(),
  userName: varchar("user_name", { length: 20 }).notNull(),
  userBirthdate: timestamp("user_birthdate", { withTimezone: true }),
  userPhone: varchar("user_phone", { length: 15 }).notNull(),
  authUuid: uuid("auth_uuid")
    .notNull()
    .references(() => auth.authUuid),
});

export const plan = pgTable("plan", {
  planCode: varchar("plan_code", { length: 16 }).primaryKey(),
  planName: varchar("plan_name", { length: 32 }).notNull(),
  priceMonth: integer("price_month").notNull(),
  taxiQuota: integer("taxi_quota").notNull(),
  nearwakeQuota: integer("nearwake_quota").notNull(),
});

export const userPlan = pgTable("user_plan", {
  authUuid: uuid("auth_uuid")
    .primaryKey()
    .references(() => auth.authUuid),
  planCode: varchar("plan_code", { length: 16 })
    .notNull()
    .references(() => plan.planCode),
  selectedAt: timestamp("selected_at", { withTimezone: true }).notNull(),
});

export const featureUsage = pgTable(
  "feature_usage",
  {
    usageUuid: uuid("usage_uuid").primaryKey(),
    authUuid: uuid("auth_uuid")
      .notNull()
      .references(() => auth.authUuid),
    featureKey: varchar("feature_key", { length: 32 }).notNull(),
    periodYm: varchar("period_ym", { length: 7 }).notNull(),
    usedCount: integer("used_count").notNull().default(0),
  },
  (t) => [
    unique("feature_usage_auth_feature_period").on(
      t.authUuid,
      t.featureKey,
      t.periodYm,
    ),
    index("feature_usage_auth_period_idx").on(t.authUuid, t.periodYm),
  ],
);

export const refreshToken = pgTable("refresh_token", {
  refreshTokensUuid: uuid("refresh_tokens_uuid").primaryKey(),
  authUuid: uuid("auth_uuid")
    .notNull()
    .references(() => auth.authUuid),
  authEmail: varchar("auth_email", { length: 50 }).notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const feature = pgTable("feature", {
  featureUuid: uuid("feature_uuid").primaryKey(),
  featureName: varchar("feature_name", { length: 50 }).notNull(),
  featureVersion: varchar("feature_version", { length: 20 }).notNull(),
  featureCreateat: timestamp("feature_createat", { withTimezone: true }).notNull(),
});

export const favorite = pgTable("favorite", {
  userFeatureUuid: uuid("user_feature_uuid").primaryKey(),
  userUuid: uuid("user_uuid")
    .notNull()
    .references(() => users.userUuid),
  featureUuid: uuid("feature_uuid")
    .notNull()
    .references(() => feature.featureUuid),
});

export const storeplace = pgTable("storeplace", {
  storeplaceUuid: uuid("storeplace_uuid").primaryKey(),
  placeId: varchar("place_id", { length: 50 }),
  placeName: varchar("place_name", { length: 150 }),
  placeDetail: varchar("place_detail", { length: 250 }),
  placeLat: doublePrecision("place_lat"),
  placeLon: doublePrecision("place_lon"),
});

export const favoritePlace = pgTable(
  "favorite_place",
  {
    favoritePlaceUuid: uuid("favorite_place_uuid").primaryKey(),
    favoritePlaceName: varchar("favorite_place_name", { length: 150 }),
    userUuid: uuid("user_uuid")
      .notNull()
      .references(() => users.userUuid),
    storeplaceUuid: uuid("storeplace_uuid")
      .notNull()
      .references(() => storeplace.storeplaceUuid),
  },
  (t) => [unique("favorite_place_user_store_unique").on(t.userUuid, t.storeplaceUuid)],
);

export const toilet = pgTable("toilet", {
  toiletUuid: uuid("toilet_uuid").primaryKey().defaultRandom(),
  toiletPlace: varchar("toilet_place", { length: 50 }).notNull(),
  toiletCleanscore: integer("toilet_cleanscore"),
  toiletBidet: varchar("toilet_bidet", { length: 50 }),
  toiletPrice: integer("toilet_price"),
  toiletQuantity: integer("toilet_quantity"),
  toiletAvgscore: integer("toilet_avgscore"),
  toiletComment: varchar("toilet_comment", { length: 255 }),
  toiletLatitude: doublePrecision("toilet_latitude"),
  toiletLongitude: doublePrecision("toilet_longitude"),
  toiletStatus: varchar("toilet_status", { length: 50 }),
  toiletSafe: integer("toilet_safe"),
  toiletOpenhours: varchar("toilet_openhours", { length: 50 }),
  userUuid: uuid("user_uuid").references(() => users.userUuid),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const mood = pgTable(
  "mood",
  {
    moodUuid: uuid("mood_uuid").primaryKey().defaultRandom(),
    moodKey: varchar("mood_key", { length: 32 }).notNull(),
    moodScore: integer("mood_score").notNull(),
    authUuid: uuid("auth_uuid")
      .notNull()
      .references(() => auth.authUuid),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("mood_auth_created_idx").on(t.authUuid, t.createdAt)],
);

/** ใช้เมื่อยังไม่ต่อ Auth0 — เก็บ OTP ชั่วคราวฝั่ง Postgres */
export const otpChallenge = pgTable("otp_challenge", {
  email: varchar("email", { length: 50 }).primaryKey(),
  codeHash: varchar("code_hash", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
