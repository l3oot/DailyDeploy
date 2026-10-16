import { desc, eq } from "drizzle-orm";
import { getDb } from "../db";
import { mood } from "../db/schema";
import { isMoodKey, MOOD_SCORES } from "../../lib/moods";
import { fail, ok, TypeError, type ApiResponse } from "../lib/api-response";

export type MoodEntry = {
  moodUuid: string;
  moodKey: string;
  moodScore: number;
  authUuid: string;
  createdAt: string;
};

export async function saveMood(
  authUuid: string,
  moodKey: string,
): Promise<ApiResponse<MoodEntry | null>> {
  if (!isMoodKey(moodKey)) {
    return fail("Invalid mood", TypeError.ValidationError);
  }
  const db = getDb();
  const row = {
    moodUuid: crypto.randomUUID(),
    moodKey,
    moodScore: MOOD_SCORES[moodKey],
    authUuid,
    createdAt: new Date(),
  };
  await db.insert(mood).values(row);
  return ok(
    {
      moodUuid: row.moodUuid,
      moodKey: row.moodKey,
      moodScore: row.moodScore,
      authUuid: row.authUuid,
      createdAt: row.createdAt.toISOString(),
    },
    "Mood saved",
  );
}

export async function listMoods(
  authUuid: string,
): Promise<ApiResponse<MoodEntry[] | null>> {
  const db = getDb();
  const rows = await db
    .select()
    .from(mood)
    .where(eq(mood.authUuid, authUuid))
    .orderBy(desc(mood.createdAt))
    .limit(50);
  return ok(
    rows.map((row) => ({
      moodUuid: row.moodUuid,
      moodKey: row.moodKey,
      moodScore: row.moodScore,
      authUuid: row.authUuid,
      createdAt: row.createdAt.toISOString(),
    })),
  );
}
