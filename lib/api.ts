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

export async function api<T>(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: ApiResponse<T> }> {
  const res = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  return { status: res.status, body: await parse<T>(res) };
}

export function errorText(body: ApiResponse<unknown>, fallback: string) {
  return body.errorMessage || body.message || fallback;
}
