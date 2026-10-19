import { Hono, type Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { optionalAuth, requireAuth } from "../lib/auth-guard";
import { fail, statusFor, TypeError, type ApiResponse } from "../lib/api-response";
import { pickString, readJson } from "../lib/body";
import {
  consumeFeatureUsage,
  getPlanOverview,
  selectUserPlan,
} from "../services/plan-service";

const planRoutes = new Hono();

function respond<T>(c: Context, body: ApiResponse<T>) {
  return c.json(body, body.isSuccess ? 200 : (statusFor(body.errorType) as ContentfulStatusCode));
}

planRoutes.get("/", async (c) => {
  const auth = await optionalAuth(c);
  return respond(c, await getPlanOverview(auth.ok ? auth.authUuid : null));
});

planRoutes.put("/", async (c) => {
  const auth = await requireAuth(c);
  if (!auth.ok) return auth.response;
  const body = await readJson(c.req.raw);
  const planCode = pickString(body, "planCode", "plan");
  if (!planCode) {
    return c.json(fail("planCode is required", TypeError.ValidationError), 400);
  }
  return respond(c, await selectUserPlan(auth.authUuid, planCode));
});

planRoutes.post("/usage", async (c) => {
  const auth = await requireAuth(c);
  if (!auth.ok) return auth.response;
  const body = await readJson(c.req.raw);
  const feature = pickString(body, "feature", "featureKey");
  if (!feature) {
    return c.json(fail("feature is required", TypeError.ValidationError), 400);
  }
  return respond(c, await consumeFeatureUsage(auth.authUuid, feature));
});

export default planRoutes;
