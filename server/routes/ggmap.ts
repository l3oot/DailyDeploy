import { Hono, type Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { fail, ok, statusFor, TypeError, type ApiResponse } from "../lib/api-response";
import { pickNumber, readJson } from "../lib/body";
import { serverEnv } from "../env";
import { autocompletePlaces } from "../services/google-places-service";
import { computeDrivingRoute } from "../services/google-routes-service";

const ggmapRoutes = new Hono();

function respond<T>(c: Context, body: ApiResponse<T>) {
  return c.json(body, body.isSuccess ? 200 : (statusFor(body.errorType) as ContentfulStatusCode));
}

function googleReferer(c: Context) {
  const prodHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const prodUrl = prodHost
    ? prodHost.startsWith("http")
      ? prodHost
      : `https://${prodHost}`
    : "https://dailydeploy.vercel.app";
  const origin = c.req.header("origin")?.trim();
  if (origin && !isLocalOrigin(origin)) return origin;
  const referer = c.req.header("referer")?.trim();
  if (referer && !isLocalOrigin(referer)) return referer;
  return prodUrl;
}

function isLocalOrigin(value: string) {
  return /localhost|127\.0\.0\.1/i.test(value);
}

ggmapRoutes.get("/location", async (c) => {
  const input = (c.req.query("input") ?? c.req.query("Input") ?? "").trim();
  if (input.length < 2) {
    return c.json(fail("input is required", TypeError.ValidationError), 400);
  }
  if (!serverEnv().googleApiKey) {
    return c.json(fail("GOOGLE_API_KEY is not configured", TypeError.InternalError), 500);
  }
  try {
    const suggestions = await autocompletePlaces(input);
    return respond(c, ok({ suggestions }));
  } catch (error) {
    console.error(error);
    return c.json(fail("Google API error", TypeError.InternalError), 500);
  }
});

ggmapRoutes.post("/route", async (c) => {
  const body = await readJson(c.req.raw);
  const originLat = pickNumber(body, "originLat");
  const originLng = pickNumber(body, "originLng");
  const destLat = pickNumber(body, "destLat");
  const destLng = pickNumber(body, "destLng");
  if (
    originLat == null ||
    originLng == null ||
    destLat == null ||
    destLng == null ||
    originLat < -90 ||
    originLat > 90 ||
    destLat < -90 ||
    destLat > 90 ||
    originLng < -180 ||
    originLng > 180 ||
    destLng < -180 ||
    destLng > 180
  ) {
    return c.json(
      fail("origin and destination coordinates are required", TypeError.ValidationError),
      400,
    );
  }
  if (!serverEnv().googleApiKey) {
    return c.json(fail("GOOGLE_API_KEY is not configured", TypeError.InternalError), 500);
  }
  try {
    const route = await computeDrivingRoute({
      originLat,
      originLng,
      destLat,
      destLng,
      referer: googleReferer(c),
    });
    if (!route) {
      return c.json(fail("Routes API returned no route", TypeError.NotFound), 404);
    }
    return respond(c, ok(route));
  } catch (error) {
    console.error(error);
    return c.json(fail("Google Routes API error", TypeError.InternalError), 500);
  }
});

export default ggmapRoutes;
