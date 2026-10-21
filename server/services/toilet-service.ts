import { and, count, eq, gte, lte } from "drizzle-orm";
import { getDb } from "../db";
import { toilet, users } from "../db/schema";
import { fail, ok, TypeError, type ApiResponse } from "../lib/api-response";

const PLACE_TYPES = new Set(["mall", "gas", "food"]);

export type ToiletDto = {
  toiletUuid: string;
  placeToilet: string;
  placeType: string;
  addressToilet: string;
  cleanToilet: boolean;
  freeToilet: boolean;
  accessibleToilet: boolean;
  attendantToilet: boolean;
  diaperToilet: boolean;
  genderSplitToilet: boolean;
  tissueToilet: boolean;
  paperToilet: boolean;
  photosToilet: string[];
  photoCount: number;
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

function toDto(
  row: ToiletRow,
  userName: string | null = null,
  coverOnly = false,
): ToiletDto {
  const photos = row.toiletPhotos ?? [];
  const bidet = row.toiletBidet ?? "";
  return {
    toiletUuid: row.toiletUuid,
    placeToilet: row.toiletPlace,
    placeType: row.toiletType ?? "",
    addressToilet: row.toiletAddress ?? "",
    cleanToilet: (row.toiletCleanscore ?? 0) > 0,
    freeToilet: row.toiletPrice === 0,
    accessibleToilet: row.toiletAccessible,
    attendantToilet: row.toiletAttendant,
    diaperToilet: row.toiletDiaper,
    genderSplitToilet: row.toiletGenderSplit,
    tissueToilet: row.toiletTissue || bidet.includes("ทิชชู่"),
    paperToilet: row.toiletPaper,
    photosToilet: coverOnly ? photos.slice(0, 1) : photos,
    photoCount: photos.length,
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
  placeType: string;
  addressToilet: string;
  cleanToilet: boolean;
  freeToilet: boolean;
  accessibleToilet: boolean;
  attendantToilet: boolean;
  diaperToilet: boolean;
  genderSplitToilet: boolean;
  tissueToilet: boolean;
  paperToilet: boolean;
  photosToilet: string[];
  latitudeToilet: number | null;
  longitudeToilet: number | null;
  openHoursToilet: string | null;
};

export function isToiletPlaceType(value: string) {
  return PLACE_TYPES.has(value);
}

export async function createToilet(
  authUuid: string,
  input: ToiletWriteInput,
): Promise<ApiResponse<ToiletDto | null>> {
  const user = await userForAuth(authUuid);
  if (!user) return fail("User NotFound", TypeError.NotFound);

  const place = clip(input.placeToilet, 120);
  const row = {
    toiletUuid: crypto.randomUUID(),
    toiletPlace: place,
    toiletCleanscore: input.cleanToilet ? 1 : 0,
    toiletBidet: input.tissueToilet ? "ทิชชู่" : "-",
    toiletPrice: input.freeToilet ? 0 : null,
    toiletQuantity: 1,
    toiletAvgscore: 0,
    toiletComment: "-",
    toiletLatitude: input.latitudeToilet ?? 0,
    toiletLongitude: input.longitudeToilet ?? 0,
    toiletStatus: "เปิด",
    toiletSafe: 0,
    toiletOpenhours: input.openHoursToilet,
    toiletType: input.placeType,
    toiletAddress: clip(input.addressToilet, 255),
    toiletAccessible: input.accessibleToilet,
    toiletAttendant: input.attendantToilet,
    toiletDiaper: input.diaperToilet,
    toiletGenderSplit: input.genderSplitToilet,
    toiletTissue: input.tissueToilet,
    toiletPaper: input.paperToilet,
    toiletPhotos: input.photosToilet,
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
    rows.map((row) => toDto(row.toilet, row.userName ?? null, true)),
    "Get All Toilet",
  );
}

export async function getToilet(toiletUuid: string): Promise<ApiResponse<ToiletDto | null>> {
  const uuid = toiletUuid.trim();
  if (!uuid) return fail("ToiletUuid is required", TypeError.ValidationError);
  const rows = await getDb()
    .select({ toilet, userName: users.userName })
    .from(toilet)
    .leftJoin(users, eq(toilet.userUuid, users.userUuid))
    .where(eq(toilet.toiletUuid, uuid))
    .limit(1);
  const row = rows[0];
  if (!row) return fail("Toilet NotFound", TypeError.NotFound);
  return ok(toDto(row.toilet, row.userName ?? null), "Get Toilet");
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
      toiletPlace: clip(input.placeToilet, 120) || current.toiletPlace,
      toiletCleanscore: input.cleanToilet ? 1 : 0,
      toiletBidet: input.tissueToilet ? "ทิชชู่" : "-",
      toiletPrice: input.freeToilet ? 0 : null,
      toiletLatitude: input.latitudeToilet ?? current.toiletLatitude,
      toiletLongitude: input.longitudeToilet ?? current.toiletLongitude,
      toiletOpenhours: input.openHoursToilet,
      toiletType: input.placeType,
      toiletAddress: clip(input.addressToilet, 255),
      toiletAccessible: input.accessibleToilet,
      toiletAttendant: input.attendantToilet,
      toiletDiaper: input.diaperToilet,
      toiletGenderSplit: input.genderSplitToilet,
      toiletTissue: input.tissueToilet,
      toiletPaper: input.paperToilet,
      toiletPhotos: input.photosToilet,
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
