import { and, count, eq, gte, lte } from "drizzle-orm";
import { getDb } from "../db";
import { toilet, users } from "../db/schema";
import { fail, ok, TypeError, type ApiResponse } from "../lib/api-response";

export type ToiletDto = {
  toiletUuid: string;
  placeToilet: string;
  cleanScoreToilet: number | null;
  bidetToilet: string | null;
  priceToilet: number | null;
  quantityToilet: number | null;
  avgScoreToilet: number | null;
  commentToilet: string | null;
  latitudeToilet: number | null;
  longitudeToilet: number | null;
  statusToilet: string | null;
  safeToilet: number | null;
  openHoursToilet: string | null;
  userUuid: string | null;
  user_name: string | null;
  userName: string | null;
};

type ToiletRow = typeof toilet.$inferSelect;

function clip(value: string, max: number) {
  return value.trim().slice(0, max);
}

function toDto(row: ToiletRow, userName: string | null = null): ToiletDto {
  return {
    toiletUuid: row.toiletUuid,
    placeToilet: row.toiletPlace,
    cleanScoreToilet: row.toiletCleanscore,
    bidetToilet: row.toiletBidet,
    priceToilet: row.toiletPrice,
    quantityToilet: row.toiletQuantity,
    avgScoreToilet: row.toiletAvgscore,
    commentToilet: row.toiletComment,
    latitudeToilet: row.toiletLatitude,
    longitudeToilet: row.toiletLongitude,
    statusToilet: row.toiletStatus,
    safeToilet: row.toiletSafe,
    openHoursToilet: row.toiletOpenhours,
    userUuid: row.userUuid,
    user_name: userName,
    userName,
  };
}

async function userForAuth(authUuid: string) {
  const rows = await getDb()
    .select({ userUuid: users.userUuid, userName: users.userName })
    .from(users)
    .where(eq(users.authUuid, authUuid))
    .limit(1);
  return rows[0] ?? null;
}

export type ToiletWriteInput = {
  placeToilet: string;
  cleanScoreToilet: number | null;
  bidetToilet: string | null;
  priceToilet: number | null;
  quantityToilet: number | null;
  avgScoreToilet: number | null;
  commentToilet: string | null;
  latitudeToilet: number | null;
  longitudeToilet: number | null;
  statusToilet: string | null;
  safeToilet: number | null;
  openHoursToilet: string | null;
};

export async function createToilet(
  authUuid: string,
  input: ToiletWriteInput,
): Promise<ApiResponse<ToiletDto | null>> {
  const user = await userForAuth(authUuid);
  if (!user) return fail("User NotFound", TypeError.NotFound);

  const place = clip(input.placeToilet, 50) || "-";
  const row = {
    toiletUuid: crypto.randomUUID(),
    toiletPlace: place,
    toiletCleanscore: input.cleanScoreToilet ?? 0,
    toiletBidet: input.bidetToilet ?? "-",
    toiletPrice: input.priceToilet ?? 0,
    toiletQuantity: input.quantityToilet ?? 1,
    toiletAvgscore: input.avgScoreToilet ?? 0,
    toiletComment: input.commentToilet ?? "-",
    toiletLatitude: input.latitudeToilet ?? 0,
    toiletLongitude: input.longitudeToilet ?? 0,
    toiletStatus: input.statusToilet ?? "open",
    toiletSafe: input.safeToilet ?? 0,
    toiletOpenhours: input.openHoursToilet ?? "-",
    userUuid: user.userUuid,
  };

  const inserted = await getDb().insert(toilet).values(row).returning();
  const created = inserted[0];
  if (!created) return fail("InternalError", TypeError.InternalError);
  return ok(toDto(created, user.userName), "Create Success");
}

export async function countToilets(): Promise<ApiResponse<number>> {
  const rows = await getDb().select({ n: count() }).from(toilet);
  return ok(Number(rows[0]?.n ?? 0), "Get Quantity Success");
}

export type ToiletBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

const VIEWPORT_LIMIT = 250;

export async function listToilets(bounds?: ToiletBounds): Promise<ApiResponse<ToiletDto[]>> {
  if (
    !bounds ||
    !Number.isFinite(bounds.minLat) ||
    !Number.isFinite(bounds.maxLat) ||
    !Number.isFinite(bounds.minLng) ||
    !Number.isFinite(bounds.maxLng)
  ) {
    return fail("Map bounds are required", TypeError.ValidationError);
  }
  if (bounds.minLat > bounds.maxLat || bounds.minLng > bounds.maxLng) {
    return fail("Invalid map bounds", TypeError.ValidationError);
  }

  const rows = await getDb()
    .select({
      toilet,
      userName: users.userName,
    })
    .from(toilet)
    .leftJoin(users, eq(toilet.userUuid, users.userUuid))
    .where(
      and(
        gte(toilet.toiletLatitude, bounds.minLat),
        lte(toilet.toiletLatitude, bounds.maxLat),
        gte(toilet.toiletLongitude, bounds.minLng),
        lte(toilet.toiletLongitude, bounds.maxLng),
      ),
    )
    .limit(VIEWPORT_LIMIT);

  return ok(
    rows.map((row) => toDto(row.toilet, row.userName ?? null)),
    "Get All Toilet",
  );
}

export async function updateToilet(
  input: ToiletWriteInput & { toiletUuid: string },
): Promise<ApiResponse<ToiletDto | null>> {
  const uuid = input.toiletUuid.trim();
  if (!uuid) return fail("Invalid request data", TypeError.InvalidCredential);

  const existing = await getDb()
    .select()
    .from(toilet)
    .where(eq(toilet.toiletUuid, uuid))
    .limit(1);
  const current = existing[0];
  if (!current) return fail("Toilet NotFound", TypeError.NotFound);

  const updatedRows = await getDb()
    .update(toilet)
    .set({
      toiletPlace: clip(input.placeToilet, 50) || current.toiletPlace,
      toiletCleanscore: input.cleanScoreToilet ?? current.toiletCleanscore,
      toiletBidet: input.bidetToilet ?? current.toiletBidet,
      toiletPrice: input.priceToilet ?? current.toiletPrice,
      toiletQuantity: input.quantityToilet ?? current.toiletQuantity,
      toiletAvgscore: input.avgScoreToilet ?? current.toiletAvgscore,
      toiletComment: input.commentToilet ?? current.toiletComment,
      toiletLatitude: input.latitudeToilet ?? current.toiletLatitude,
      toiletLongitude: input.longitudeToilet ?? current.toiletLongitude,
      toiletStatus: input.statusToilet ?? current.toiletStatus,
      toiletSafe: input.safeToilet ?? current.toiletSafe,
      toiletOpenhours: input.openHoursToilet ?? current.toiletOpenhours,
      updatedAt: new Date(),
    })
    .where(eq(toilet.toiletUuid, uuid))
    .returning();

  const updated = updatedRows[0];
  if (!updated) return fail("InternalError", TypeError.InternalError);

  let userName: string | null = null;
  if (updated.userUuid) {
    const owner = await getDb()
      .select({ userName: users.userName })
      .from(users)
      .where(eq(users.userUuid, updated.userUuid))
      .limit(1);
    userName = owner[0]?.userName ?? null;
  }
  return ok(toDto(updated, userName), "Update Toilet Success");
}
