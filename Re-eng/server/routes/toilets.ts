import { Hono, type Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { fail, statusFor, TypeError, type ApiResponse } from "../lib/api-response";
import { requireAuth } from "../lib/auth-guard";
import { pickNumber, pickString, readJson } from "../lib/body";
import {
  countToilets,
  createToilet,
  listToilets,
  updateToilet,
  type ToiletWriteInput,
} from "../services/toilet-service";

const toiletRoutes = new Hono();

function respond<T>(c: Context, body: ApiResponse<T>, successStatus: ContentfulStatusCode = 200) {
  return c.json(
    body,
    body.isSuccess ? successStatus : (statusFor(body.errorType) as ContentfulStatusCode),
  );
}

function readWriteInput(body: Record<string, unknown>): ToiletWriteInput {
  return {
    placeToilet: pickString(body, "placeToilet"),
    cleanScoreToilet: pickNumber(body, "cleanScoreToilet"),
    bidetToilet: pickString(body, "bidetToilet"),
    priceToilet: pickNumber(body, "priceToilet"),
    quantityToilet: pickNumber(body, "quantityToilet"),
    avgScoreToilet: pickNumber(body, "avgScoreToilet"),
    commentToilet: pickString(body, "commentToilet"),
    latitudeToilet: pickNumber(body, "latitudeToilet", "lat"),
    longitudeToilet: pickNumber(body, "longitudeToilet", "lon", "lng"),
    statusToilet: pickString(body, "statusToilet"),
    safeToilet: pickNumber(body, "safeToilet"),
    openHoursToilet: pickString(body, "openHoursToilet"),
  };
}

toiletRoutes.get("/location/count", async (c) => respond(c, await countToilets()));

function queryNumber(c: Context, ...keys: string[]) {
  for (const key of keys) {
    const raw = c.req.query(key);
    if (raw == null || raw === "") continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

toiletRoutes.get("/location", async (c) => {
  const minLat = queryNumber(c, "minLat", "south");
  const maxLat = queryNumber(c, "maxLat", "north");
  const minLng = queryNumber(c, "minLng", "west");
  const maxLng = queryNumber(c, "maxLng", "east");
  if (minLat == null || maxLat == null || minLng == null || maxLng == null) {
    return c.json(fail("Map bounds are required", TypeError.ValidationError), 400);
  }
  return respond(c, await listToilets({ minLat, maxLat, minLng, maxLng }));
});

toiletRoutes.post("/location", async (c) => {
  const auth = await requireAuth(c);
  if (!auth.ok) return auth.response;
  const body = await readJson(c.req.raw);
  const input = readWriteInput(body);
  if (!input.placeToilet) {
    return c.json(fail("PlaceToilet is required", TypeError.ValidationError), 400);
  }
  if (input.latitudeToilet == null || input.longitudeToilet == null) {
    return c.json(fail("Latitude and longitude are required", TypeError.ValidationError), 400);
  }
  return respond(c, await createToilet(auth.authUuid, input), 201);
});

toiletRoutes.put("/location", async (c) => {
  const auth = await requireAuth(c);
  if (!auth.ok) return auth.response;
  const body = await readJson(c.req.raw);
  const toiletUuid = pickString(body, "toiletUuid");
  if (!toiletUuid) {
    return c.json(fail("ToiletUuid is required", TypeError.ValidationError), 400);
  }
  return respond(c, await updateToilet({ ...readWriteInput(body), toiletUuid }));
});

export default toiletRoutes;
