import type { Context } from "hono";
import { fail, TypeError } from "./api-response";
import { bearerToken } from "./cookies";
import { verifyAccessToken } from "./jwt";

export async function optionalAuth(c: Context) {
  const token = bearerToken(c);
  const claims = token ? await verifyAccessToken(token) : null;
  if (!claims?.sub) return { ok: false as const };
  return { ok: true as const, authUuid: claims.sub, email: String(claims.email ?? "") };
}

export async function requireAuth(c: Context) {
  const auth = await optionalAuth(c);
  if (!auth.ok) {
    return {
      ok: false as const,
      response: c.json(fail("Missing or invalid token", TypeError.InvalidCredential), 401),
    };
  }
  return auth;
}
