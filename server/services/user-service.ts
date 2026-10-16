import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { users } from "../db/schema";
import { fail, ok, TypeError, type ApiResponse } from "../lib/api-response";
import { normalizeUserPhone } from "../../lib/phone";

export type UserProfile = {
  userUuid: string;
  userName: string;
  userPhone: string;
  userBirthdate: string | null;
  authUuid: string;
};

function toProfile(row: typeof users.$inferSelect): UserProfile {
  return {
    userUuid: row.userUuid,
    userName: row.userName,
    userPhone: row.userPhone,
    userBirthdate: row.userBirthdate ? row.userBirthdate.toISOString() : null,
    authUuid: row.authUuid,
  };
}

function parseBirth(raw: string): Date | null {
  if (!raw.trim()) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function getUserByAuthUuid(
  authUuid: string,
): Promise<ApiResponse<UserProfile | null>> {
  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.authUuid, authUuid)).limit(1);
  const row = rows[0];
  if (!row) return fail("User not found", TypeError.NotFound);
  return ok(toProfile(row));
}

export async function createUser(input: {
  authUuid: string;
  userName: string;
  userPhone: string;
  userBirthdate: string;
}): Promise<ApiResponse<UserProfile | null>> {
  const name = input.userName.trim();
  const phone = normalizeUserPhone(input.userPhone);
  const birth = parseBirth(input.userBirthdate);
  if (!name) return fail("Username is required", TypeError.ValidationError);
  if (name.length > 20) return fail("Username is too long", TypeError.ValidationError);
  if (!phone) return fail("Invalid phone number format", TypeError.ValidationError);
  if (!birth) return fail("Birth date is required", TypeError.ValidationError);

  const existing = await getUserByAuthUuid(input.authUuid);
  if (existing.isSuccess) return fail("User already exists", TypeError.Conflict);

  const row = {
    userUuid: crypto.randomUUID(),
    userName: name,
    userPhone: phone,
    userBirthdate: birth,
    authUuid: input.authUuid,
  };
  await getDb().insert(users).values(row);
  return ok(toProfile(row), "User created");
}

export async function updateUser(input: {
  authUuid: string;
  userUuid: string;
  userName: string;
  userPhone: string;
  userBirthdate: string;
}): Promise<ApiResponse<UserProfile | null>> {
  const name = input.userName.trim();
  const phone = normalizeUserPhone(input.userPhone);
  const birth = parseBirth(input.userBirthdate);
  if (!name) return fail("Username is required", TypeError.ValidationError);
  if (name.length > 20) return fail("Username is too long", TypeError.ValidationError);
  if (!phone) return fail("Invalid phone number format", TypeError.ValidationError);
  if (!birth) return fail("Birth date is required", TypeError.ValidationError);

  const db = getDb();
  const rows = await db.select().from(users).where(eq(users.userUuid, input.userUuid)).limit(1);
  const row = rows[0];
  if (!row) return fail("User not found", TypeError.NotFound);
  if (row.authUuid !== input.authUuid) {
    return fail("Forbidden", TypeError.Forbidden);
  }
  await db
    .update(users)
    .set({ userName: name, userPhone: phone, userBirthdate: birth })
    .where(eq(users.userUuid, input.userUuid));
  return ok(
    { ...toProfile(row), userName: name, userPhone: phone, userBirthdate: birth.toISOString() },
    "User updated",
  );
}
