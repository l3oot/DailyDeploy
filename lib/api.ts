export type ApiResponse<T> = {
  isSuccess: boolean;
  message?: string;
  data: T | null;
  errorMessage?: string;
  errorType: number;
};

export type SessionUser = {
  authUuid: string;
  email: string;
  pictureUrl?: string;
  userName?: string;
};

const SKIP_REFRESH = new Set([
  "/api/v1/auth/login",
  "/api/v1/auth/google",
  "/api/v1/auth/register",
  "/api/v1/auth/dev-login",
  "/api/v1/auth/send-otp",
  "/api/v1/auth/verify-otp",
  "/api/v1/auth/refreshtoken",
  "/api/v1/auth/logout",
]);

const PUBLIC_APP_PATHS = new Set(["/welcome", "/login", "/terms"]);

type RefreshResult = { ok: boolean; status: number };

let refreshInflight: Promise<RefreshResult> | null = null;

async function parse<T>(res: Response): Promise<ApiResponse<T>> {
  try {
    return (await res.json()) as ApiResponse<T>;
  } catch {
    return {
      isSuccess: false,
      data: null,
      errorMessage: "Invalid response",
      errorType: 5,
    };
  }
}

function requestPath(path: string) {
  return path.split("?")[0] ?? path;
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: ApiResponse<T> }> {
  const res = await fetch(path, {
    ...init,
    cache: "no-store",
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  return { status: res.status, body: await parse<T>(res) };
}

function redirectToWelcome() {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  if (PUBLIC_APP_PATHS.has(path) || path.startsWith("/login/")) return;
  window.location.replace("/welcome");
}

async function refreshSession(): Promise<RefreshResult> {
  if (!refreshInflight) {
    refreshInflight = request("/api/v1/auth/refreshtoken", {
      method: "POST",
      body: JSON.stringify({}),
    })
      .then((res) => ({
        ok: res.status === 200 && res.body.isSuccess,
        status: res.status,
      }))
      .finally(() => {
        refreshInflight = null;
      });
  }
  return refreshInflight;
}

export async function api<T>(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: ApiResponse<T> }> {
  const first = await request<T>(path, init);
  if (first.status !== 401) return first;
  if (SKIP_REFRESH.has(requestPath(path))) return first;
  const refreshed = await refreshSession();
  if (refreshed.ok) return request<T>(path, init);
  if (refreshed.status === 401 || refreshed.status === 403) {
    redirectToWelcome();
  }
  return first;
}

export function errorText(body: ApiResponse<unknown>, fallback: string) {
  return body.errorMessage || body.message || fallback;
}
