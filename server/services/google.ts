import { OAuth2Client } from "google-auth-library";
import { serverEnv } from "../env";

type GoogleIdentity = {
  email: string;
  picture?: string;
};

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity | null> {
  const { googleClientId } = serverEnv();
  if (!googleClientId || !idToken) return null;
  try {
    const client = new OAuth2Client(googleClientId);
    const ticket = await client.verifyIdToken({
      idToken,
      audience: googleClientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) return null;
    return { email: payload.email, picture: payload.picture };
  } catch {
    return null;
  }
}

export async function verifyGoogleAccessToken(
  accessToken: string,
): Promise<GoogleIdentity | null> {
  const { googleClientId } = serverEnv();
  if (!googleClientId || !accessToken) return null;
  try {
    const [infoRes, userRes] = await Promise.all([
      fetch(
        `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(accessToken)}`,
      ),
      fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ]);
    if (!infoRes.ok || !userRes.ok) return null;
    const info = (await infoRes.json()) as { aud?: string; azp?: string };
    const user = (await userRes.json()) as { email?: string; picture?: string };
    if (info.aud !== googleClientId && info.azp !== googleClientId) return null;
    if (!user.email) return null;
    return { email: user.email, picture: user.picture };
  } catch {
    return null;
  }
}
