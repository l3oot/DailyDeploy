import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let client: ReturnType<typeof postgres> | undefined;
let db: Db | undefined;

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function describeDatabaseUrl() {
  const raw = process.env.DATABASE_URL ?? "";
  if (!raw) {
    return { host: "", port: "", sslmode: "", connectPort: "" };
  }
  try {
    const parsed = new URL(raw);
    const connected = new URL(normalizeDatabaseUrl(raw));
    return {
      host: parsed.hostname,
      port: parsed.port || "5432",
      sslmode: parsed.searchParams.get("sslmode") || "default",
      connectPort: connected.port || "5432",
    };
  } catch {
    const atSigns = (raw.match(/@/g) || []).length;
    return { host: "unparseable", port: "", sslmode: `at_signs=${atSigns}`, connectPort: "" };
  }
}

function normalizeDatabaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!isLocalHost(parsed.hostname) && !parsed.searchParams.get("sslmode")) {
      parsed.searchParams.set("sslmode", "require");
    }
    // Transaction-mode :6543 + postgres.js pipelining hangs on Vercel
    // (statement timeout 57014 / 300s). Session-mode :5432 stays IPv4.
    if (
      process.env.VERCEL &&
      parsed.hostname.includes("pooler.supabase.com") &&
      parsed.port === "6543"
    ) {
      parsed.port = "5432";
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function collectError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let i = 0; i < 4 && current; i += 1) {
    const err = current as {
      name?: string;
      code?: string;
      errno?: string | number;
      syscall?: string;
      message?: string;
      cause?: unknown;
    };
    const bit = [
      err.name,
      err.code ? `code=${err.code}` : "",
      err.syscall ? `syscall=${err.syscall}` : "",
      err.message,
    ]
      .filter(Boolean)
      .join(" ");
    if (bit) parts.push(bit);
    current = err.cause;
  }
  let message = parts.join(" | ") || String(error);
  message = message.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgres://***");
  message = message.replace(/(password|pwd)[=:]\s*\S+/gi, "$1=***");
  return message.slice(0, 240);
}

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  const resolved = normalizeDatabaseUrl(url);
  let hostname = "";
  try {
    hostname = new URL(resolved).hostname;
  } catch {
    hostname = "";
  }
  const local = isLocalHost(hostname);
  client = postgres(resolved, {
    prepare: false,
    fetch_types: false,
    max: process.env.VERCEL ? 1 : 8,
    idle_timeout: 20,
    connect_timeout: 10,
    max_lifetime: process.env.VERCEL ? 60 * 5 : 60 * 30,
    ssl: local ? false : "require",
    connection: {
      application_name: "ndaily",
    },
  });
  db = drizzle(client, { schema });
}

export function resetDb() {
  const previous = client;
  client = undefined;
  db = undefined;
  if (previous) {
    void previous.end({ timeout: 1 });
  }
}

export function getDb(): Db {
  if (!db) {
    createClient();
  }
  return db!;
}

export async function pingDb(): Promise<{ ok: boolean; error?: string }> {
  try {
    const database = getDb();
    if (client) {
      await client`select 1`;
    } else {
      await database.execute(sql`select 1`);
    }
    return { ok: true };
  } catch (error) {
    const message = collectError(error);
    console.error("db ping failed", message);
    resetDb();
    return { ok: false, error: message };
  }
}
