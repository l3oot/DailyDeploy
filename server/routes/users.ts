import { Hono, type Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { requireAuth } from "../lib/auth-guard";
import { fail, statusFor, TypeError, type ApiResponse } from "../lib/api-response";
import { pickString, readJson } from "../lib/body";
import { createUser, getUserByAuthUuid, updateUser } from "../services/user-service";

const userRoutes = new Hono();

function respond<T>(c: Context, body: ApiResponse<T>) {
  return c.json(body, body.isSuccess ? 200 : (statusFor(body.errorType) as ContentfulStatusCode));
}

userRoutes.get("/:authUuid", async (c) => {
  const auth = await requireAuth(c);
  if (!auth.ok) return auth.response;
  const authUuid = c.req.param("authUuid");
  if (authUuid !== auth.authUuid) {
    return c.json(fail("Forbidden", TypeError.Forbidden), 403);
  }
  return respond(c, await getUserByAuthUuid(authUuid));
});

userRoutes.post("/", async (c) => {
  const auth = await requireAuth(c);
  if (!auth.ok) return auth.response;
  const body = await readJson(c.req.raw);
  return respond(
    c,
    await createUser({
      authUuid: auth.authUuid,
      userName: pickString(body, "userName"),
      userPhone: pickString(body, "userPhone"),
      userBirthdate: pickString(body, "userBirthdate"),
    }),
  );
});

userRoutes.put("/", async (c) => {
  const auth = await requireAuth(c);
  if (!auth.ok) return auth.response;
  const body = await readJson(c.req.raw);
  return respond(
    c,
    await updateUser({
      authUuid: auth.authUuid,
      userUuid: pickString(body, "userUuid"),
      userName: pickString(body, "userName"),
      userPhone: pickString(body, "userPhone"),
      userBirthdate: pickString(body, "userBirthdate"),
    }),
  );
});

export default userRoutes;
