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

export function pickBool(body: Record<string, unknown>, ...keys: string[]): boolean {
  const lower = new Map(Object.entries(body).map(([k, v]) => [k.toLowerCase(), v]));
  for (const key of keys) {
    const value = lower.get(key.toLowerCase());
    if (typeof value === "boolean") return value;
    if (value === 1 || value === "1" || value === "true") return true;
    if (value === 0 || value === "0" || value === "false") return false;
  }
  return false;
}

const PHOTO_PREFIX = /^data:image\/(?:jpeg|png|webp);base64,/i;

export function pickPhotos(body: Record<string, unknown>, ...keys: string[]): string[] {
  const lower = new Map(Object.entries(body).map(([k, v]) => [k.toLowerCase(), v]));
  for (const key of keys) {
    const value = lower.get(key.toLowerCase());
    if (!Array.isArray(value)) continue;
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 32 && item.length <= 550_000 && PHOTO_PREFIX.test(item))
      .slice(0, 5);
  }
  return [];
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
