import { Hono, type Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
  getMe,
  loginDev,
  loginWithGoogle,
  loginWithPassword,
  logout,
  refreshSession,
  registerUser,
  sendOtp,
  validRefreshRow,
  verifyOtp,
} from "../services/auth-service";
import {
  fail,
  ok,
  statusFor,
  TypeError,
  type ApiResponse,
} from "../lib/api-response";
import { pickString, readJson } from "../lib/body";
import {
  bearerToken,
  clearAuthCookies,
  readRefreshCookie,
  setAccessCookie,
  setAuthCookies,
} from "../lib/cookies";
import { signAccessToken, verifyAccessToken } from "../lib/jwt";

type Tokenish = {
  token?: string;
  refreshToken?: string;
};

const authRoutes = new Hono();

authRoutes.use("*", async (c, next) => {
  await next();
  c.header("Cache-Control", "private, no-store");
});

function respond<T>(c: Context, body: ApiResponse<T>) {
  if (!body.isSuccess) {
    return c.json(body, statusFor(body.errorType) as ContentfulStatusCode);
  }
  const data = body.data as Tokenish | null;
  if (data?.token && data?.refreshToken) {
    setAuthCookies(c, data.token, data.refreshToken);
  }
  return c.json(body);
}

authRoutes.post("/register", async (c) => {
  const body = await readJson(c.req.raw);
  const email = pickString(body, "authEmail", "email");
  const password = pickString(body, "password");
  return respond(c, await registerUser(email, password));
});

authRoutes.post("/login", async (c) => {
  const body = await readJson(c.req.raw);
  const email = pickString(body, "authEmail", "email");
  const password = pickString(body, "password");
  return respond(c, await loginWithPassword(email, password));
});

authRoutes.post("/google", async (c) => {
  const body = await readJson(c.req.raw);
  const idToken = pickString(body, "idToken");
  const accessToken = pickString(body, "accessToken");
  return respond(c, await loginWithGoogle(idToken, accessToken));
});

authRoutes.post("/dev-login", async (c) => {
  const body = await readJson(c.req.raw);
  const email = pickString(body, "email", "authEmail");
  return respond(c, await loginDev(email));
});

authRoutes.post("/send-otp", async (c) => {
  const body = await readJson(c.req.raw);
  const email = pickString(body, "email");
  return respond(c, await sendOtp(email));
});

authRoutes.post("/verify-otp", async (c) => {
  const body = await readJson(c.req.raw);
  const email = pickString(body, "email");
  const otp = pickString(body, "otp");
  return respond(c, await verifyOtp(email, otp));
});

authRoutes.post("/refreshtoken", async (c) => {
  const body = await readJson(c.req.raw);
  const presented = pickString(body, "refreshToken") || readRefreshCookie(c);
  const result = await refreshSession(presented);
  if (!result.isSuccess) {
    if (
      result.errorType === TypeError.InvalidCredential ||
      result.errorType === TypeError.Forbidden
    ) {
      clearAuthCookies(c);
    }
    return c.json(result, statusFor(result.errorType) as ContentfulStatusCode);
  }
  return respond(c, result);
});

authRoutes.post("/logout", async (c) => {
  const body = await readJson(c.req.raw);
  const presented = pickString(body, "refreshToken") || readRefreshCookie(c);
  const result = await logout(presented);
  clearAuthCookies(c);
  if (!result.isSuccess && result.errorType === TypeError.ValidationError) {
    return c.json(ok(null, "Logout successful"));
  }
  return c.json(
    result,
    result.isSuccess ? 200 : (statusFor(result.errorType) as ContentfulStatusCode),
  );
});

authRoutes.get("/me", async (c) => {
  const token = bearerToken(c);
  let claims = token ? await verifyAccessToken(token) : null;
  if (!claims?.sub) {
    const row = await validRefreshRow(readRefreshCookie(c));
    if (row) {
      const renewed = await signAccessToken(row.authUuid, row.authEmail);
      setAccessCookie(c, renewed.token);
      claims = await verifyAccessToken(renewed.token);
    }
  }
  if (!claims?.sub) {
    return c.json(fail("Missing or invalid token", TypeError.InvalidCredential), 401);
  }
  const result = await getMe(claims.sub);
  return c.json(
    result,
    result.isSuccess ? 200 : (statusFor(result.errorType) as ContentfulStatusCode),
  );
});

export default authRoutes;
