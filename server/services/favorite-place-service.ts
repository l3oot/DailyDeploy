import { and, eq } from "drizzle-orm";
import { getDb } from "../db";
import { favoritePlace, storeplace, users } from "../db/schema";
import { fail, ok, TypeError, type ApiResponse } from "../lib/api-response";

export type FavoritePlaceRow = {
  favoritePlaceUuid: string;
  favoritePlaceName: string | null;
  storeplaceUuid: string;
  placeId: string;
  placeName: string;
  placeDetail: string;
  placeLat: number;
  placeLon: number;
  userUuid: string;
};

async function userUuidForAuth(authUuid: string): Promise<string | null> {
  const rows = await getDb()
    .select({ userUuid: users.userUuid })
    .from(users)
    .where(eq(users.authUuid, authUuid))
    .limit(1);
  return rows[0]?.userUuid ?? null;
}

export async function listFavoritePlaces(
  authUuid: string,
  requestedUserUuid?: string,
): Promise<ApiResponse<FavoritePlaceRow[]>> {
  const userUuid = await userUuidForAuth(authUuid);
  if (!userUuid) return fail("NotFound User", TypeError.NotFound);
  if (requestedUserUuid && requestedUserUuid !== userUuid) {
    return fail("Forbidden", TypeError.Forbidden);
  }

  const rows = await getDb()
    .select({
      favoritePlaceUuid: favoritePlace.favoritePlaceUuid,
      favoritePlaceName: favoritePlace.favoritePlaceName,
      storeplaceUuid: favoritePlace.storeplaceUuid,
      userUuid: favoritePlace.userUuid,
      placeId: storeplace.placeId,
      placeName: storeplace.placeName,
      placeDetail: storeplace.placeDetail,
      placeLat: storeplace.placeLat,
      placeLon: storeplace.placeLon,
    })
    .from(favoritePlace)
    .innerJoin(storeplace, eq(favoritePlace.storeplaceUuid, storeplace.storeplaceUuid))
    .where(eq(favoritePlace.userUuid, userUuid));

  return ok(
    rows.map((row) => ({
      favoritePlaceUuid: row.favoritePlaceUuid,
      favoritePlaceName: row.favoritePlaceName,
      storeplaceUuid: row.storeplaceUuid,
      placeId: row.placeId ?? "",
      placeName: row.placeName ?? "",
      placeDetail: row.placeDetail ?? "",
      placeLat: row.placeLat ?? 0,
      placeLon: row.placeLon ?? 0,
      userUuid: row.userUuid,
    })),
    "Find Place success",
  );
}

export async function createFavoritePlace(input: {
  authUuid: string;
  favoritePlaceName: string;
  storeplaceUuid: string;
}): Promise<ApiResponse<FavoritePlaceRow>> {
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

  const exist = await db
    .select()
    .from(favoritePlace)
    .where(
      and(
        eq(favoritePlace.userUuid, userUuid),
        eq(favoritePlace.storeplaceUuid, input.storeplaceUuid),
      ),
    )
    .limit(1);
  if (exist[0]) return fail("Exist Place", TypeError.Conflict);

  const name = input.favoritePlaceName.trim().slice(0, 150) || place.placeName || "Favorite";
  const row = {
    favoritePlaceUuid: crypto.randomUUID(),
    favoritePlaceName: name,
    userUuid,
    storeplaceUuid: input.storeplaceUuid,
  };
  await db.insert(favoritePlace).values(row);

  return ok(
    {
      favoritePlaceUuid: row.favoritePlaceUuid,
      favoritePlaceName: row.favoritePlaceName,
      storeplaceUuid: row.storeplaceUuid,
      placeId: place.placeId ?? "",
      placeName: place.placeName ?? "",
      placeDetail: place.placeDetail ?? "",
      placeLat: place.placeLat ?? 0,
      placeLon: place.placeLon ?? 0,
      userUuid,
    },
    "Create Favorite Place success",
  );
}

export async function updateFavoritePlace(input: {
  authUuid: string;
  favoritePlaceUuid: string;
  favoritePlaceName: string;
}): Promise<ApiResponse<{ favoritePlaceUuid: string; favoritePlaceName: string }>> {
  const userUuid = await userUuidForAuth(input.authUuid);
  if (!userUuid) return fail("NotFound User", TypeError.NotFound);
  const name = input.favoritePlaceName.trim().slice(0, 150);
  if (!name) return fail("favoritePlaceName is required", TypeError.ValidationError);

  const db = getDb();
  const rows = await db
    .select()
    .from(favoritePlace)
    .where(eq(favoritePlace.favoritePlaceUuid, input.favoritePlaceUuid))
    .limit(1);
  const row = rows[0];
  if (!row || row.userUuid !== userUuid) {
    return fail("NotFound Favorite Place", TypeError.NotFound);
  }

  await db
    .update(favoritePlace)
    .set({ favoritePlaceName: name })
    .where(eq(favoritePlace.favoritePlaceUuid, input.favoritePlaceUuid));

  return ok(
    { favoritePlaceUuid: input.favoritePlaceUuid, favoritePlaceName: name },
    "Update success",
  );
}

export async function deleteFavoritePlace(input: {
  authUuid: string;
  favoritePlaceUuid: string;
}): Promise<ApiResponse<null>> {
  const userUuid = await userUuidForAuth(input.authUuid);
  if (!userUuid) return fail("NotFound User", TypeError.NotFound);

  const db = getDb();
  const rows = await db
    .select()
    .from(favoritePlace)
    .where(eq(favoritePlace.favoritePlaceUuid, input.favoritePlaceUuid))
    .limit(1);
  const row = rows[0];
  if (!row || row.userUuid !== userUuid) {
    return fail("NotFound Favorite Place", TypeError.NotFound);
  }

  await db
    .delete(favoritePlace)
    .where(eq(favoritePlace.favoritePlaceUuid, input.favoritePlaceUuid));
  return ok(null, "Delete success");
}
