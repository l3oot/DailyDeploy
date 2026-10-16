import { api } from "./api";
import { setGuest } from "./guest";

const STATE_KEY = "da_google_oauth_state";
const NONCE_KEY = "da_google_oauth_nonce";
const PENDING_KEY = "da_google_id_token";

export function googleRedirectUri() {
  return `${window.location.origin}/login/google`;
}

export function startGoogleRedirect(clientId: string) {
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();
  sessionStorage.removeItem(PENDING_KEY);
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(NONCE_KEY, nonce);

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "id_token");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  window.location.assign(url.toString());
}

function clearHash() {
  const path = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, "", path);
}

export function readGoogleRedirectResult():
  | { ok: true; idToken: string }
  | { ok: false; error: string } {
  const pending = sessionStorage.getItem(PENDING_KEY);
  if (pending) return { ok: true, idToken: pending };

  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const error = hash.get("error");
  if (error) {
    sessionStorage.removeItem(STATE_KEY);
    sessionStorage.removeItem(NONCE_KEY);
    clearHash();
    return { ok: false, error: hash.get("error_description") || error };
  }

  const state = hash.get("state");
  const idToken = hash.get("id_token");
  if (!idToken) return { ok: false, error: "missing_token" };

  const expectedState = sessionStorage.getItem(STATE_KEY);
  if (!expectedState || state !== expectedState) {
    return { ok: false, error: "state_mismatch" };
  }

  sessionStorage.setItem(PENDING_KEY, idToken);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(NONCE_KEY);
  clearHash();
  return { ok: true, idToken };
}

export function clearGooglePending() {
  sessionStorage.removeItem(PENDING_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(NONCE_KEY);
}

let googleLoginInflight: Promise<{ ok: boolean; message: string }> | null = null;

export function finishGoogleLogin(idToken: string) {
  if (!googleLoginInflight) {
    googleLoginInflight = api("/api/v1/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    })
      .then(({ body }) => {
        if (!body.isSuccess) {
          clearGooglePending();
          return {
            ok: false,
            message: body.errorMessage || body.message || "Google sign-in failed",
          };
        }
        setGuest(false);
        clearGooglePending();
        return { ok: true, message: body.message || "" };
      })
      .catch(() => {
        clearGooglePending();
        return { ok: false, message: "cannot_reach" };
      })
      .finally(() => {
        googleLoginInflight = null;
      });
  }
  return googleLoginInflight;
}

export function goHome() {
  window.location.replace("/home");
}
