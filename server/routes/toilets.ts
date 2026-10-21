import { Hono, type Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { fail, statusFor, TypeError, type ApiResponse } from "../lib/api-response";
import { requireAuth } from "../lib/auth-guard";
import { pickBool, pickNumber, pickPhotos, pickString, readJson } from "../lib/body";
import {
  countToilets,
  createToilet,
  getToilet,
  isToiletPlaceType,
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

const HOURS = /^(?:[01]\d|2[0-3]):[0-5]\d-(?:[01]\d|2[0-3]):[0-5]\d$/;

function readWriteInput(body: Record<string, unknown>): ToiletWriteInput {
  const hours = pickString(body, "openHoursToilet");
  return {
    placeToilet: pickString(body, "placeToilet"),
    placeType: pickString(body, "placeType"),
    addressToilet: pickString(body, "addressToilet"),
    cleanToilet: pickBool(body, "cleanToilet"),
    freeToilet: pickBool(body, "freeToilet"),
    accessibleToilet: pickBool(body, "accessibleToilet"),
    attendantToilet: pickBool(body, "attendantToilet"),
    diaperToilet: pickBool(body, "diaperToilet"),
    genderSplitToilet: pickBool(body, "genderSplitToilet"),
    tissueToilet: pickBool(body, "tissueToilet"),
    paperToilet: pickBool(body, "paperToilet"),
    photosToilet: pickPhotos(body, "photosToilet"),
    latitudeToilet: pickNumber(body, "latitudeToilet", "lat"),
    longitudeToilet: pickNumber(body, "longitudeToilet", "lon", "lng"),
    openHoursToilet: hours && hours !== "-" ? hours : null,
  };
}

function validateWrite(input: ToiletWriteInput) {
  if (!input.placeToilet) return "PlaceToilet is required";
  if (!isToiletPlaceType(input.placeType)) return "Place type is required";
  if (!input.addressToilet) return "Address is required";
  if (input.latitudeToilet == null || input.longitudeToilet == null) {
    return "Latitude and longitude are required";
  }
  if (input.openHoursToilet && !HOURS.test(input.openHoursToilet)) return "Open hours are invalid";
  return "";
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

toiletRoutes.get("/location/:toiletUuid", async (c) => {
  return respond(c, await getToilet(c.req.param("toiletUuid")));
});

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
  const invalid = validateWrite(input);
  if (invalid) return c.json(fail(invalid, TypeError.ValidationError), 400);
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
  const input = readWriteInput(body);
  const invalid = validateWrite(input);
  if (invalid) return c.json(fail(invalid, TypeError.ValidationError), 400);
  return respond(c, await updateToilet({ ...input, toiletUuid }));
});

export default toiletRoutes;
