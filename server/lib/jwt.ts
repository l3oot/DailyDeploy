import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { requireJwtSecret, serverEnv } from "../env";

export type AccessClaims = JWTPayload & {
  email?: string;
  client_id?: string;
};

function secretKey() {
  return new TextEncoder().encode(requireJwtSecret());
}

export async function signAccessToken(
  authUuid: string,
  email: string,
  clientId = "",
): Promise<{ token: string; expiration: Date }> {
  const { jwtIssuer, jwtAudience } = serverEnv();
  const expiration = new Date(Date.now() + 15 * 60 * 1000);
  const token = await new SignJWT({ email, client_id: clientId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(authUuid)
    .setIssuer(jwtIssuer)
    .setAudience(jwtAudience)
    .setExpirationTime("15m")
    .sign(secretKey());
  return { token, expiration };
}

export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { jwtIssuer, jwtAudience } = serverEnv();
    const { payload } = await jwtVerify(token, secretKey(), {
      issuer: jwtIssuer,
      audience: jwtAudience,
    });
    return payload;
  } catch {
    return null;
  }
}

export function randomRefreshToken(): string {
  const bytes = new Uint8Array(64);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64");
}
