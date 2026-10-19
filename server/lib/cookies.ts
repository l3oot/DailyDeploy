import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { serverEnv } from "../env";

export const ACCESS_COOKIE = "da_access";
export const REFRESH_COOKIE = "da_refresh";

function cookieBase() {
  return {
    httpOnly: true,
    secure: serverEnv().isProd || Boolean(process.env.VERCEL),
    sameSite: "Lax" as const,
    path: "/",
  };
}

export function setAccessCookie(c: Context, accessToken: string) {
  setCookie(c, ACCESS_COOKIE, accessToken, {
    ...cookieBase(),
    maxAge: 15 * 60,
  });
}

export function setAuthCookies(
  c: Context,
  accessToken: string,
  refreshToken: string,
) {
  setAccessCookie(c, accessToken);
  setCookie(c, REFRESH_COOKIE, refreshToken, {
    ...cookieBase(),
    maxAge: 30 * 24 * 60 * 60,
  });
}

export function clearAuthCookies(c: Context) {
  deleteCookie(c, ACCESS_COOKIE, { path: "/" });
  deleteCookie(c, REFRESH_COOKIE, { path: "/" });
}

export function readAccessCookie(c: Context): string {
  return getCookie(c, ACCESS_COOKIE) ?? "";
}

export function readRefreshCookie(c: Context): string {
  return getCookie(c, REFRESH_COOKIE) ?? "";
}

export function bearerToken(c: Context): string {
  const header = c.req.header("authorization") ?? "";
  if (header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  return readAccessCookie(c);
}
