import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Db = ReturnType<typeof drizzle<typeof schema>>;

let client: ReturnType<typeof postgres> | undefined;
let db: Db | undefined;

export function getDb(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!db) {
    client = postgres(url, {
      prepare: false,
      // Vercel serverless: 1 connection per isolate. Local `next dev` is long-lived —
      // max 1 serializes login behind other queries and can stall Google sign-in for 20s+.
      max: process.env.VERCEL ? 1 : 8,
      idle_timeout: 20,
      connect_timeout: 15,
    });
    db = drizzle(client, { schema });
  }
  return db;
}

export async function pingDb(): Promise<boolean> {
  try {
    await getDb().execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}
