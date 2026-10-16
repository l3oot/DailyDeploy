import { eq, ilike } from "drizzle-orm";
import { getDb } from "../db";
import { storeplace } from "../db/schema";
import { fail, ok, TypeError, type ApiResponse } from "../lib/api-response";

export type StorePlace = {
  storeplaceUuid: string;
  placeId: string;
  placeName: string;
  placeDetail: string;
  placeLat: number;
  placeLon: number;
};

function clip(value: string, max: number) {
  return value.trim().slice(0, max);
}

function toStorePlace(row: typeof storeplace.$inferSelect): StorePlace {
  return {
    storeplaceUuid: row.storeplaceUuid,
    placeId: row.placeId ?? "",
    placeName: row.placeName ?? "",
    placeDetail: row.placeDetail ?? "",
    placeLat: row.placeLat ?? 0,
    placeLon: row.placeLon ?? 0,
  };
}

export async function findLocations(placeName: string): Promise<ApiResponse<StorePlace[]>> {
  const q = placeName.replace(/[%_]/g, "").trim();
  if (q.length < 2) {
    return fail("PlaceName is required", TypeError.ValidationError);
  }

  const rows = await getDb()
    .select()
    .from(storeplace)
    .where(ilike(storeplace.placeName, `%${q}%`))
    .limit(10);

  if (!rows.length) return fail("Place NotFound", TypeError.NotFound);
  return ok(rows.map(toStorePlace), "Get locations success");
}

function coordPlaceId(lat: number, lon: number) {
  return `coord:${lat.toFixed(5)},${lon.toFixed(5)}`.slice(0, 50);
}

export async function createLocation(input: {
  placeId: string;
  placeName: string;
  placeDetail: string;
  placeLat: number;
  placeLon: number;
}): Promise<ApiResponse<StorePlace>> {
  if (!Number.isFinite(input.placeLat) || !Number.isFinite(input.placeLon)) {
    return fail("PlaceLat and PlaceLon are required", TypeError.ValidationError);
  }
  const placeId = clip(input.placeId, 50) || coordPlaceId(input.placeLat, input.placeLon);
  const placeName =
    clip(input.placeName, 150) ||
    `ตำแหน่งที่เลือก (${input.placeLat.toFixed(5)}, ${input.placeLon.toFixed(5)})`;

  const db = getDb();
  const existing = await db
    .select()
    .from(storeplace)
    .where(eq(storeplace.placeId, placeId))
    .limit(1);
  if (existing[0]) return ok(toStorePlace(existing[0]), "Place already exists");

  const row = {
    storeplaceUuid: crypto.randomUUID(),
    placeId,
    placeName,
    placeDetail: clip(input.placeDetail, 250),
    placeLat: input.placeLat,
    placeLon: input.placeLon,
  };
  await db.insert(storeplace).values(row);
  return ok(toStorePlace(row), "Create location success");
}
