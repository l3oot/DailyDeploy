import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { recentPlace, storeplace, users } from "../db/schema";
import { fail, ok, TypeError, type ApiResponse } from "../lib/api-response";

const RECENT_LIMIT = 30;

export type RecentPlaceRow = {
  recentPlaceUuid: string;
  recentPlaceName: string | null;
  storeplaceUuid: string;
  placeId: string;
  placeName: string;
  placeDetail: string;
  placeLat: number;
  placeLon: number;
  userUuid: string;
  usedAt: string;
};

async function userUuidForAuth(authUuid: string): Promise<string | null> {
  const rows = await getDb()
    .select({ userUuid: users.userUuid })
    .from(users)
    .where(eq(users.authUuid, authUuid))
    .limit(1);
  return rows[0]?.userUuid ?? null;
}

function toRow(input: {
  recentPlaceUuid: string;
  recentPlaceName: string | null;
  storeplaceUuid: string;
  userUuid: string;
  usedAt: Date;
  placeId: string | null;
  placeName: string | null;
  placeDetail: string | null;
  placeLat: number | null;
  placeLon: number | null;
}): RecentPlaceRow {
  return {
    recentPlaceUuid: input.recentPlaceUuid,
    recentPlaceName: input.recentPlaceName,
    storeplaceUuid: input.storeplaceUuid,
    placeId: input.placeId ?? "",
    placeName: input.placeName ?? "",
    placeDetail: input.placeDetail ?? "",
    placeLat: input.placeLat ?? 0,
    placeLon: input.placeLon ?? 0,
    userUuid: input.userUuid,
    usedAt: input.usedAt.toISOString(),
  };
}

export async function listRecentPlaces(authUuid: string): Promise<ApiResponse<RecentPlaceRow[]>> {
  const userUuid = await userUuidForAuth(authUuid);
  if (!userUuid) return fail("NotFound User", TypeError.NotFound);

  const rows = await getDb()
    .select({
      recentPlaceUuid: recentPlace.recentPlaceUuid,
      recentPlaceName: recentPlace.recentPlaceName,
      storeplaceUuid: recentPlace.storeplaceUuid,
      userUuid: recentPlace.userUuid,
      usedAt: recentPlace.usedAt,
      placeId: storeplace.placeId,
      placeName: storeplace.placeName,
      placeDetail: storeplace.placeDetail,
      placeLat: storeplace.placeLat,
      placeLon: storeplace.placeLon,
    })
    .from(recentPlace)
    .innerJoin(storeplace, eq(recentPlace.storeplaceUuid, storeplace.storeplaceUuid))
    .where(eq(recentPlace.userUuid, userUuid))
    .orderBy(desc(recentPlace.usedAt));

  return ok(rows.map(toRow), "Find recent places success");
}

export async function rememberRecentPlace(input: {
  authUuid: string;
  recentPlaceName: string;
  storeplaceUuid: string;
}): Promise<ApiResponse<RecentPlaceRow>> {
  const userUuid = await userUuidForAuth(input.authUuid);
  if (!userUuid) return fail("NotFound user or place", TypeError.NotFound);

  const db = getDb();
  const places = await db
    .select()
    .from(storeplace)
    .where(eq(storeplace.storeplaceUuid, input.storeplaceUuid))
    .limit(1);
  const place = places[0];
  if (!place) return fail("NotFound user or place", TypeError.NotFound);

  const name = input.recentPlaceName.trim().slice(0, 150) || place.placeName || "Recent";
  const usedAt = new Date();
  const existing = await db
    .select()
    .from(recentPlace)
    .where(and(eq(recentPlace.userUuid, userUuid), eq(recentPlace.storeplaceUuid, input.storeplaceUuid)))
    .limit(1);

  const recentPlaceUuid = existing[0]?.recentPlaceUuid ?? crypto.randomUUID();
  if (existing[0]) {
    await db
      .update(recentPlace)
      .set({ recentPlaceName: name, usedAt })
      .where(eq(recentPlace.recentPlaceUuid, recentPlaceUuid));
  } else {
    await db.insert(recentPlace).values({
      recentPlaceUuid,
      recentPlaceName: name,
      userUuid,
      storeplaceUuid: input.storeplaceUuid,
      usedAt,
    });
  }

  const stale = await db
    .select({ recentPlaceUuid: recentPlace.recentPlaceUuid })
    .from(recentPlace)
    .where(eq(recentPlace.userUuid, userUuid))
    .orderBy(desc(recentPlace.usedAt))
    .offset(RECENT_LIMIT);
  if (stale.length > 0) {
    await db.delete(recentPlace).where(
      inArray(
        recentPlace.recentPlaceUuid,
        stale.map((row) => row.recentPlaceUuid),
      ),
    );
  }

  return ok(
    toRow({
      recentPlaceUuid,
      recentPlaceName: name,
      storeplaceUuid: input.storeplaceUuid,
      userUuid,
      usedAt,
      placeId: place.placeId,
      placeName: place.placeName,
      placeDetail: place.placeDetail,
      placeLat: place.placeLat,
      placeLon: place.placeLon,
    }),
    "Remember recent place success",
  );
}

export async function deleteRecentPlace(input: {
  authUuid: string;
  recentPlaceUuid: string;
}): Promise<ApiResponse<null>> {
  const userUuid = await userUuidForAuth(input.authUuid);
  if (!userUuid) return fail("NotFound User", TypeError.NotFound);

  const db = getDb();
  const rows = await db
    .select()
    .from(recentPlace)
    .where(eq(recentPlace.recentPlaceUuid, input.recentPlaceUuid))
    .limit(1);
  const row = rows[0];
  if (!row || row.userUuid !== userUuid) {
    return fail("NotFound Recent Place", TypeError.NotFound);
  }

  await db.delete(recentPlace).where(eq(recentPlace.recentPlaceUuid, input.recentPlaceUuid));
  return ok(null, "Delete success");
}
