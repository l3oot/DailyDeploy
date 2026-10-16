import { Hono, type Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { requireAuth } from "../lib/auth-guard";
import { fail, statusFor, TypeError, type ApiResponse } from "../lib/api-response";
import { pickString, readJson } from "../lib/body";
import { listMoods, saveMood } from "../services/mood-service";

const moodRoutes = new Hono();

function respond<T>(c: Context, body: ApiResponse<T>) {
  return c.json(body, body.isSuccess ? 200 : (statusFor(body.errorType) as ContentfulStatusCode));
}

moodRoutes.get("/", async (c) => {
  const auth = await requireAuth(c);
  if (!auth.ok) return auth.response;
  return respond(c, await listMoods(auth.authUuid));
});

moodRoutes.post("/", async (c) => {
  const auth = await requireAuth(c);
  if (!auth.ok) return auth.response;
  const body = await readJson(c.req.raw);
  const moodKey = pickString(body, "moodKey", "mood");
  if (!moodKey) {
    return c.json(fail("moodKey is required", TypeError.ValidationError), 400);
  }
  return respond(c, await saveMood(auth.authUuid, moodKey));
});

export default moodRoutes;
