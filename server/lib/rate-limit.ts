import type { Context, Next } from "hono";
import { fail, TypeError } from "./api-response";

const WINDOW_MS = 1000;
const MAX_REQUESTS = 50;
const COOLDOWN_MS = 0;

type Bucket = {
  hits: number[];
  cooldownUntil: number;
};

const buckets = new Map<string, Bucket>();

function clientKey(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip")?.trim() ||
    c.req.header("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  return ip;
}

function prune(now: number) {
  if (buckets.size < 2000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.cooldownUntil > now) continue;
    if (bucket.hits.some((t) => now - t < WINDOW_MS)) continue;
    buckets.delete(key);
  }
}

export async function rateLimit(c: Context, next: Next) {
  if (c.req.method === "OPTIONS") {
    await next();
    return;
  }

  const now = Date.now();
  prune(now);

  const key = clientKey(c);
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [], cooldownUntil: 0 };
    buckets.set(key, bucket);
  }

  if (bucket.cooldownUntil > now) {
    const retrySec = Math.max(1, Math.ceil((bucket.cooldownUntil - now) / 1000));
    c.header("Retry-After", String(retrySec));
    return c.json(fail("Too many requests.", TypeError.TooManyRequests), 429);
  }

  bucket.hits = bucket.hits.filter((t) => now - t < WINDOW_MS);
  if (bucket.hits.length >= MAX_REQUESTS) {
    if (COOLDOWN_MS > 0) bucket.cooldownUntil = now + COOLDOWN_MS;
    const retrySec = Math.max(1, Math.ceil((WINDOW_MS - (now - (bucket.hits[0] ?? now))) / 1000));
    c.header("Retry-After", String(retrySec));
    return c.json(fail("Too many requests.", TypeError.TooManyRequests), 429);
  }

  bucket.hits.push(now);
  await next();
}
