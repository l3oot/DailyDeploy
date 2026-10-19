import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { auth, otpChallenge, refreshToken, users } from "../db/schema";
import { serverEnv } from "../env";
import { fail, ok, TypeError, type ApiResponse } from "../lib/api-response";
import { randomRefreshToken, signAccessToken } from "../lib/jwt";
import { hashPassword, verifyPassword } from "../lib/password";
import { auth0Configured, auth0ErrorMessage, exchangeOtp, startPasswordless } from "./auth0";
import { verifyGoogleAccessToken, verifyGoogleIdToken } from "./google";
import { ensureUserPlan } from "./plan-service";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isEmail(email: string) {
  return EMAIL_RE.test(email);
}

export type TokenPayload = {
  token: string;
  refreshToken: string;
  expiration: string;
  authUuid: string;
  pictureUrl?: string;
};

async function revokeActiveRefresh(authUuid: string) {
  const db = getDb();
  await db
    .update(refreshToken)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(refreshToken.authUuid, authUuid), isNull(refreshToken.revokedAt)),
    );
}

async function issueSession(
  authUuid: string,
  email: string,
  pictureUrl?: string,
): Promise<TokenPayload> {
  const db = getDb();
  await ensureUserPlan(authUuid);
  await revokeActiveRefresh(authUuid);
  const { token, expiration } = await signAccessToken(authUuid, email);
  const refresh = randomRefreshToken();
  await db.insert(refreshToken).values({
    refreshTokensUuid: crypto.randomUUID(),
    authUuid,
    authEmail: email,
    refreshToken: refresh,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
    revokedAt: null,
  });
  return {
    token,
    refreshToken: refresh,
    expiration: expiration.toISOString(),
    authUuid,
    pictureUrl,
  };
}

async function upsertAuth(email: string, pictureUrl?: string) {
  const db = getDb();
  const existing = await db
    .select()
    .from(auth)
    .where(eq(auth.authEmail, email))
    .limit(1);
  if (existing[0]) {
    if (pictureUrl && existing[0].authImage !== pictureUrl) {
      await db
        .update(auth)
        .set({ authImage: pictureUrl })
        .where(eq(auth.authUuid, existing[0].authUuid));
    }
    return existing[0];
  }
  const row = {
    authUuid: crypto.randomUUID(),
    authEmail: email,
    authPassword: "",
    authImage: pictureUrl ?? null,
    authCreateat: new Date(),
  };
  await db.insert(auth).values(row);
  return row;
}

export async function registerUser(
  email: string,
  password: string,
): Promise<ApiResponse<{ authEmail: string; createdAt: string } | null>> {
  email = normalizeEmail(email);
  if (!email || !password) {
    return fail("Email and password are required", TypeError.ValidationError);
  }
  if (!isEmail(email)) {
    return fail("Invalid email address", TypeError.ValidationError);
  }
  const db = getDb();
  const existing = await db
    .select()
    .from(auth)
    .where(eq(auth.authEmail, email))
    .limit(1);
  if (existing[0]) {
    return fail("Email already exists", TypeError.Conflict);
  }
  const createdAt = new Date();
  const authUuid = crypto.randomUUID();
  await db.insert(auth).values({
    authUuid,
    authEmail: email,
    authPassword: await hashPassword(password),
    authCreateat: createdAt,
  });
  await ensureUserPlan(authUuid);
  return ok(
    { authEmail: email, createdAt: createdAt.toISOString() },
    "Registration successful",
  );
}

export async function loginWithPassword(
  email: string,
  password: string,
): Promise<ApiResponse<TokenPayload | null>> {
  email = normalizeEmail(email);
  if (!email || !password) {
    return fail("Email and password are required", TypeError.ValidationError);
  }
  const db = getDb();
  const rows = await db.select().from(auth).where(eq(auth.authEmail, email)).limit(1);
  const user = rows[0];
  if (!user?.authPassword) {
    return fail("Invalid email or password", TypeError.InvalidCredential);
  }
  const matches = await verifyPassword(password, user.authPassword);
  if (!matches) {
    return fail("Invalid email or password", TypeError.InvalidCredential);
  }
  const session = await issueSession(
    user.authUuid,
    user.authEmail,
    user.authImage ?? undefined,
  );
  return ok(session, "Login successful");
}

export async function loginWithGoogle(
  idToken: string,
  accessToken = "",
): Promise<ApiResponse<TokenPayload | null>> {
  const payload = idToken
    ? await verifyGoogleIdToken(idToken)
    : await verifyGoogleAccessToken(accessToken);
  if (!payload) {
    return fail("Invalid Google token", TypeError.InvalidCredential);
  }
  const user = await upsertAuth(normalizeEmail(payload.email), payload.picture);
  const session = await issueSession(
    user.authUuid,
    user.authEmail,
    payload.picture,
  );
  return ok(session, "Google login successful");
}

/** ข้าม OTP — ใช้ได้เฉพาะตอน AUTH_DEV_OTP และไม่ใช่ production */
export async function loginDev(
  email: string,
): Promise<ApiResponse<TokenPayload | null>> {
  const env = serverEnv();
  if (!env.authDevOtp || env.isProd) {
    return fail("Dev login is disabled", TypeError.Forbidden);
  }
  email = normalizeEmail(email);
  if (!email) {
    return fail("Email is required", TypeError.ValidationError);
  }
  if (!isEmail(email)) {
    return fail("Invalid email address", TypeError.ValidationError);
  }
  const user = await upsertAuth(email);
  const session = await issueSession(
    user.authUuid,
    user.authEmail,
    user.authImage ?? undefined,
  );
  return ok(session, "Login successful");
}

export type SendOtpData = {
  via: "auth0" | "dev";
  debugOtp?: string;
};

async function storeLocalOtp(email: string): Promise<string> {
  const code = String(Math.floor(1000 + Math.random() * 9000));
  const codeHash = await hashPassword(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const db = getDb();
  await db
    .insert(otpChallenge)
    .values({ email, codeHash, expiresAt })
    .onConflictDoUpdate({
      target: otpChallenge.email,
      set: { codeHash, expiresAt },
    });
  console.info(`[AUTH_DEV_OTP] ${email} → ${code}`);
  return code;
}

export async function sendOtp(email: string): Promise<ApiResponse<SendOtpData | null>> {
  const target = normalizeEmail(email);
  if (!target) {
    return fail("Email is required", TypeError.ValidationError);
  }
  if (!isEmail(target)) {
    return fail("Invalid email address", TypeError.ValidationError);
  }
  const env = serverEnv();
  if (auth0Configured()) {
    try {
      await startPasswordless(target);
      return ok({ via: "auth0" }, "OTP sent successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Send OTP failed";
      if (!(env.authDevOtp && !env.isProd)) {
        return fail(auth0ErrorMessage(message), TypeError.InternalError);
      }
      console.warn(`[AUTH_DEV_OTP] Auth0 send failed, using local OTP: ${message}`);
    }
  }
  if (!env.authDevOtp || env.isProd) {
    return fail("Auth0 is not configured", TypeError.InternalError);
  }
  try {
    const code = await storeLocalOtp(target);
    return ok({ via: "dev", debugOtp: code }, "OTP sent successfully");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Send OTP failed";
    return fail(message, TypeError.InternalError);
  }
}

async function verifyLocalOtp(email: string, otp: string): Promise<boolean> {
  const db = getDb();
  const rows = await db
    .select()
    .from(otpChallenge)
    .where(eq(otpChallenge.email, email))
    .limit(1);
  const row = rows[0];
  if (!row || row.expiresAt.getTime() <= Date.now()) return false;
  const good = await verifyPassword(otp, row.codeHash);
  if (!good) return false;
  await db.delete(otpChallenge).where(eq(otpChallenge.email, email));
  return true;
}

export async function verifyOtp(
  email: string,
  otp: string,
): Promise<ApiResponse<TokenPayload | null>> {
  const target = normalizeEmail(email);
  const code = otp.trim();
  if (!target || !code) {
    return fail("Email and OTP are required", TypeError.ValidationError);
  }
  if (code.length < 4 || code.length > 8) {
    return fail("OTP must be 4–8 digits", TypeError.ValidationError);
  }
  const env = serverEnv();
  let picture: string | undefined;
  let verified = false;

  if (env.authDevOtp && !env.isProd) {
    try {
      verified = await verifyLocalOtp(target, code);
    } catch {
      verified = false;
    }
  }

  if (!verified && auth0Configured()) {
    const decoded = await exchangeOtp(target, code);
    if (!decoded) {
      return fail("Invalid OTP or token verification failed", TypeError.InvalidCredential);
    }
    verified = true;
    picture = decoded.picture;
  }

  if (!verified) {
    if (!auth0Configured() && !(env.authDevOtp && !env.isProd)) {
      return fail("Auth0 is not configured", TypeError.InternalError);
    }
    return fail("Invalid OTP or token verification failed", TypeError.InvalidCredential);
  }

  const user = await upsertAuth(target, picture);
  const session = await issueSession(user.authUuid, user.authEmail, picture);
  return ok(session, "OTP verified and logged in successfully");
}

export async function validRefreshRow(presented: string) {
  if (!presented) return null;
  const db = getDb();
  const rows = await db
    .select()
    .from(refreshToken)
    .where(eq(refreshToken.refreshToken, presented))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;
  if (row.revokedAt) return null;
  return row;
}

export async function refreshSession(
  presented: string,
): Promise<ApiResponse<TokenPayload | null>> {
  if (!presented) {
    return fail("Invalid refresh token request", TypeError.ValidationError);
  }
  const db = getDb();
  const rows = await db
    .select()
    .from(refreshToken)
    .where(eq(refreshToken.refreshToken, presented))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return fail("Invalid refresh token", TypeError.InvalidCredential);
  }
  if (row.expiresAt.getTime() <= Date.now()) {
    return fail("Refresh token expired", TypeError.ValidationError);
  }
  if (row.revokedAt) {
    return fail("Refresh token revoked", TypeError.Forbidden);
  }
  await db
    .update(refreshToken)
    .set({ revokedAt: new Date() })
    .where(eq(refreshToken.refreshTokensUuid, row.refreshTokensUuid));
  const session = await issueSession(row.authUuid, row.authEmail);
  return ok(session, "Refresh token successful");
}

export async function logout(presented: string): Promise<ApiResponse<null>> {
  if (!presented) {
    return fail("Refresh token is required for logout", TypeError.ValidationError);
  }
  const db = getDb();
  const rows = await db
    .select()
    .from(refreshToken)
    .where(eq(refreshToken.refreshToken, presented))
    .limit(1);
  const row = rows[0];
  if (!row) {
    return fail("Invalid refresh token", TypeError.InvalidCredential);
  }
  if (row.revokedAt) {
    return fail("Refresh token already revoked", TypeError.Forbidden);
  }
  await db
    .update(refreshToken)
    .set({ revokedAt: new Date() })
    .where(eq(refreshToken.refreshTokensUuid, row.refreshTokensUuid));
  return ok(null, "Logout successful");
}

export async function getMe(authUuid: string): Promise<
  ApiResponse<{
    authUuid: string;
    email: string;
    pictureUrl?: string;
    userName?: string;
  } | null>
> {
  const db = getDb();
  const rows = await db.select().from(auth).where(eq(auth.authUuid, authUuid)).limit(1);
  const user = rows[0];
  if (!user) {
    return fail("User not found", TypeError.NotFound);
  }
  const profile = await db
    .select()
    .from(users)
    .where(eq(users.authUuid, authUuid))
    .limit(1);
  return ok({
    authUuid: user.authUuid,
    email: user.authEmail,
    pictureUrl: user.authImage ?? undefined,
    userName: profile[0]?.userName,
  });
}
