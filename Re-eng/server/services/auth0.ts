import { createRemoteJWKSet, jwtVerify } from "jose";
import { serverEnv } from "../env";

export function auth0Configured(): boolean {
  const e = serverEnv();
  return Boolean(e.auth0Domain && e.auth0ClientId && e.auth0ClientSecret);
}

export function auth0ErrorMessage(raw: string, fallback = "Send OTP failed") {
  try {
    const json = JSON.parse(raw) as { error_description?: string; error?: string; message?: string };
    return json.error_description || json.message || json.error || fallback;
  } catch {
    const trimmed = raw.replace(/\s+/g, " ").trim();
    return trimmed.slice(0, 280) || fallback;
  }
}

export async function startPasswordless(email: string): Promise<void> {
  const { auth0Domain, auth0ClientId, auth0ClientSecret } = serverEnv();
  const res = await fetch(`https://${auth0Domain}/passwordless/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: auth0ClientId,
      client_secret: auth0ClientSecret,
      connection: "email",
      email,
      send: "code",
      authParams: {
        scope: "openid email profile",
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(auth0ErrorMessage(text, "Auth0 passwordless/start failed"));
  }
}

export async function exchangeOtp(
  email: string,
  otp: string,
): Promise<{ email?: string; picture?: string } | null> {
  const { auth0Domain, auth0ClientId, auth0ClientSecret } = serverEnv();
  const res = await fetch(`https://${auth0Domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "http://auth0.com/oauth/grant-type/passwordless/otp",
      client_id: auth0ClientId,
      client_secret: auth0ClientSecret,
      username: email,
      otp,
      realm: "email",
      scope: "openid email profile",
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { id_token?: string };
  if (!json.id_token) return null;

  const JWKS = createRemoteJWKSet(
    new URL(`https://${auth0Domain}/.well-known/jwks.json`),
  );
  const { payload } = await jwtVerify(json.id_token, JWKS, {
    issuer: `https://${auth0Domain}/`,
    audience: auth0ClientId,
  });
  return {
    email: typeof payload.email === "string" ? payload.email : undefined,
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
  };
}
