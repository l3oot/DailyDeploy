import { Hono, type Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { fail, statusFor, TypeError, type ApiResponse } from "../lib/api-response";
import { requireAuth } from "../lib/auth-guard";
import { pickNumber, pickString, readJson } from "../lib/body";
import {
  createFavoritePlace,
  deleteFavoritePlace,
  listFavoritePlaces,
  updateFavoritePlace,
} from "../services/favorite-place-service";
import { deleteRecentPlace, listRecentPlaces, rememberRecentPlace } from "../services/recent-place-service";
import { createLocation, findLocations } from "../services/nearwake-service";

const nearwakeRoutes = new Hono();

function respond<T>(c: Context, body: ApiResponse<T>) {
  return c.json(body, body.isSuccess ? 200 : (statusFor(body.errorType) as ContentfulStatusCode));
}

nearwakeRoutes.get("/location", async (c) => {
  const auth = await requireAuth(c);
  if (!auth.ok) return auth.response;
  const placeName = (c.req.query("PlaceName") ?? c.req.query("placeName") ?? "").trim();
  return respond(c, await findLocations(placeName));
});

nearwakeRoutes.post("/location", async (c) => {
  const auth = await requireAuth(c);
  if (!auth.ok) return auth.response;
  const body = await readJson(c.req.raw);
  const placeLat = pickNumber(body, "placeLat", "lat");
  const placeLon = pickNumber(body, "placeLon", "lon", "lng");
  if (placeLat == null || placeLon == null) {
    return c.json(fail("PlaceLat and PlaceLon are required", TypeError.ValidationError), 400);
  }
  return respond(
    c,
    await createLocation({
      placeId: pickString(body, "placeId"),
      placeName: pickString(body, "placeName"),
      placeDetail: pickString(body, "placeDetail"),
      placeLat,
      placeLon,
    }),
  );
});

nearwakeRoutes.get("/favoriteplace", async (c) => {
  const auth = await requireAuth(c);
  if (!auth.ok) return auth.response;
  return respond(c, await listFavoritePlaces(auth.authUuid));
});

nearwakeRoutes.get("/favoriteplace/:userUuid", async (c) => {
  const auth = await requireAuth(c);
  if (!auth.ok) return auth.response;
  return respond(c, await listFavoritePlaces(auth.authUuid, c.req.param("userUuid")));
});

nearwakeRoutes.post("/favoriteplace", async (c) => {
  const auth = await requireAuth(c);
  if (!auth.ok) return auth.response;
  const body = await readJson(c.req.raw);
  return respond(
    c,
    await createFavoritePlace({
      authUuid: auth.authUuid,
      favoritePlaceName: pickString(body, "favoritePlaceName"),
      storeplaceUuid: pickString(body, "storeplaceUuid"),
    }),
  );
});

nearwakeRoutes.put("/favoriteplace", async (c) => {
  const auth = await requireAuth(c);
  if (!auth.ok) return auth.response;
  const body = await readJson(c.req.raw);
  return respond(
    c,
    await updateFavoritePlace({
      authUuid: auth.authUuid,
      favoritePlaceUuid: pickString(body, "favoritePlaceUuid"),
      favoritePlaceName: pickString(body, "favoritePlaceName"),
    }),
  );
});

nearwakeRoutes.get("/recentplace", async (c) => {
  const auth = await requireAuth(c);
  if (!auth.ok) return auth.response;
  return respond(c, await listRecentPlaces(auth.authUuid));
});

nearwakeRoutes.post("/recentplace", async (c) => {
  const auth = await requireAuth(c);
  if (!auth.ok) return auth.response;
  const body = await readJson(c.req.raw);
  const storeplaceUuid = pickString(body, "storeplaceUuid");
  if (!storeplaceUuid) {
    return c.json(fail("storeplaceUuid is required", TypeError.ValidationError), 400);
  }
  return respond(
    c,
    await rememberRecentPlace({
      authUuid: auth.authUuid,
      recentPlaceName: pickString(body, "recentPlaceName"),
      storeplaceUuid,
    }),
  );
});

nearwakeRoutes.delete("/recentplace/:recentPlaceUuid", async (c) => {
  const auth = await requireAuth(c);
  if (!auth.ok) return auth.response;
  return respond(
    c,
    await deleteRecentPlace({
      authUuid: auth.authUuid,
      recentPlaceUuid: c.req.param("recentPlaceUuid"),
    }),
  );
});

nearwakeRoutes.delete("/favoriteplace/:favoritePlaceUuid", async (c) => {
  const auth = await requireAuth(c);
  if (!auth.ok) return auth.response;
  return respond(
    c,
    await deleteFavoritePlace({
      authUuid: auth.authUuid,
      favoritePlaceUuid: c.req.param("favoritePlaceUuid"),
    }),
  );
});

export default nearwakeRoutes;
