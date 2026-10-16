export async function readJson(
  request: Request,
): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) {
      return body as Record<string, unknown>;
    }
  } catch {
    /* empty body */
  }
  return {};
}

export function pickString(
  body: Record<string, unknown>,
  ...keys: string[]
): string {
  const lower = new Map(
    Object.entries(body).map(([k, v]) => [k.toLowerCase(), v]),
  );
  for (const key of keys) {
    const value = lower.get(key.toLowerCase());
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

export function pickNumber(
  body: Record<string, unknown>,
  ...keys: string[]
): number | null {
  const lower = new Map(
    Object.entries(body).map(([k, v]) => [k.toLowerCase(), v]),
  );
  for (const key of keys) {
    const value = lower.get(key.toLowerCase());
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}
