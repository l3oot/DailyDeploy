import { Hono, type Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { fail, statusFor, TypeError, type ApiResponse } from "../lib/api-response";
import { optionalAuth } from "../lib/auth-guard";
import { pickNumber, pickString, readJson } from "../lib/body";
import { resolvePlace } from "../services/places-service";

const placesRoutes = new Hono();

function respond<T>(c: Context, body: ApiResponse<T>) {
  return c.json(body, body.isSuccess ? 200 : (statusFor(body.errorType) as ContentfulStatusCode));
}

placesRoutes.post("/resolve", async (c) => {
  const body = await readJson(c.req.raw);
  const displayText = pickString(body, "displayText", "placeName", "text");
  if (!displayText) {
    return c.json(fail("displayText is required", TypeError.ValidationError), 400);
  }
  const auth = await optionalAuth(c);
  const persistFlag = body.persist;
  const persist =
    persistFlag === false ? false : persistFlag === true ? true : auth.ok;

  return respond(
    c,
    await resolvePlace({
      displayText,
      placeId: pickString(body, "placeId") || undefined,
      placeDetail: pickString(body, "placeDetail", "detail") || undefined,
      knownLat: pickNumber(body, "knownLat", "lat", "placeLat"),
      knownLon: pickNumber(body, "knownLon", "lon", "lng", "placeLon"),
      persist: persist && auth.ok,
    }),
  );
});

export default placesRoutes;
