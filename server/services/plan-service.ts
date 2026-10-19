import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "../db";
import { featureUsage, plan, userPlan } from "../db/schema";
import { fail, ok, TypeError, type ApiResponse } from "../lib/api-response";
import {
  currentPeriodYm,
  isFeatureKey,
  isPlanCode,
  type FeatureKey,
  type FeatureUsageSnapshot,
  type MyPlan,
  type PlanCode,
  type PlanInfo,
  type PlanOverview,
} from "../../lib/plans";

function toPlanInfo(row: typeof plan.$inferSelect): PlanInfo {
  return {
    planCode: isPlanCode(row.planCode) ? row.planCode : "free",
    planName: row.planName,
    priceMonth: row.priceMonth,
    taxiQuota: row.taxiQuota,
    nearwakeQuota: row.nearwakeQuota,
  };
}

function snapshot(used: number, quota: number): FeatureUsageSnapshot {
  return {
    used,
    quota,
    remaining: Math.max(0, quota - used),
  };
}

async function listPlanRows() {
  return getDb().select().from(plan).orderBy(asc(plan.priceMonth));
}

export async function ensureUserPlan(authUuid: string) {
  const db = getDb();
  const existing = await db
    .select()
    .from(userPlan)
    .where(eq(userPlan.authUuid, authUuid))
    .limit(1);
  if (existing[0]) return existing[0];

  const row = {
    authUuid,
    planCode: "free",
    selectedAt: new Date(),
  };
  try {
    await db.insert(userPlan).values(row);
    return row;
  } catch {
    const again = await db
      .select()
      .from(userPlan)
      .where(eq(userPlan.authUuid, authUuid))
      .limit(1);
    if (again[0]) return again[0];
    throw new Error("Could not assign default plan");
  }
}

async function usageFor(
  authUuid: string,
  feature: FeatureKey,
  periodYm: string,
): Promise<number> {
  const rows = await getDb()
    .select({ usedCount: featureUsage.usedCount })
    .from(featureUsage)
    .where(
      and(
        eq(featureUsage.authUuid, authUuid),
        eq(featureUsage.featureKey, feature),
        eq(featureUsage.periodYm, periodYm),
      ),
    )
    .limit(1);
  return rows[0]?.usedCount ?? 0;
}

async function buildMine(authUuid: string): Promise<MyPlan | null> {
  await ensureUserPlan(authUuid);
  const db = getDb();
  const rows = await db
    .select({
      planCode: userPlan.planCode,
      selectedAt: userPlan.selectedAt,
      planName: plan.planName,
      priceMonth: plan.priceMonth,
      taxiQuota: plan.taxiQuota,
      nearwakeQuota: plan.nearwakeQuota,
    })
    .from(userPlan)
    .innerJoin(plan, eq(userPlan.planCode, plan.planCode))
    .where(eq(userPlan.authUuid, authUuid))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const periodYm = currentPeriodYm();
  const taxiUsed = await usageFor(authUuid, "taxi", periodYm);
  const nearwakeUsed = await usageFor(authUuid, "nearwake", periodYm);
  const info: PlanInfo = {
    planCode: isPlanCode(row.planCode) ? row.planCode : "free",
    planName: row.planName,
    priceMonth: row.priceMonth,
    taxiQuota: row.taxiQuota,
    nearwakeQuota: row.nearwakeQuota,
  };

  return {
    planCode: info.planCode,
    selectedAt: row.selectedAt.toISOString(),
    periodYm,
    plan: info,
    usage: {
      taxi: snapshot(taxiUsed, info.taxiQuota),
      nearwake: snapshot(nearwakeUsed, info.nearwakeQuota),
    },
  };
}

async function overviewFor(authUuid: string | null): Promise<PlanOverview> {
  const plans = (await listPlanRows()).map(toPlanInfo);
  const mine = authUuid ? await buildMine(authUuid) : null;
  return { paymentAvailable: false, plans, mine };
}

export async function getPlanOverview(
  authUuid: string | null,
): Promise<ApiResponse<PlanOverview | null>> {
  return ok(await overviewFor(authUuid));
}

export async function selectUserPlan(
  authUuid: string,
  planCode: string,
): Promise<ApiResponse<PlanOverview | null>> {
  if (!isPlanCode(planCode)) {
    return fail("Invalid plan", TypeError.ValidationError);
  }
  const catalog = await listPlanRows();
  const chosen = catalog.find((row) => row.planCode === planCode);
  if (!chosen) return fail("Plan not found", TypeError.NotFound);

  await ensureUserPlan(authUuid);
  await getDb()
    .update(userPlan)
    .set({ planCode, selectedAt: new Date() })
    .where(eq(userPlan.authUuid, authUuid));

  return ok(await overviewFor(authUuid), "Plan updated");
}

export async function consumeFeatureUsage(
  authUuid: string,
  feature: string,
): Promise<
  ApiResponse<{
    feature: FeatureKey;
    used: number;
    quota: number;
    remaining: number;
  } | null>
> {
  if (!isFeatureKey(feature)) {
    return fail("Invalid feature", TypeError.ValidationError);
  }

  const mine = await buildMine(authUuid);
  if (!mine) return fail("Plan not found", TypeError.NotFound);

  const quota = feature === "taxi" ? mine.plan.taxiQuota : mine.plan.nearwakeQuota;
  if (quota <= 0) {
    return fail("Monthly quota exceeded", TypeError.QuotaExceeded);
  }

  const periodYm = mine.periodYm;
  const rows = await getDb()
    .insert(featureUsage)
    .values({
      usageUuid: crypto.randomUUID(),
      authUuid,
      featureKey: feature,
      periodYm,
      usedCount: 1,
    })
    .onConflictDoUpdate({
      target: [
        featureUsage.authUuid,
        featureUsage.featureKey,
        featureUsage.periodYm,
      ],
      set: { usedCount: sql`${featureUsage.usedCount} + 1` },
      setWhere: sql`${featureUsage.usedCount} < ${quota}`,
    })
    .returning({ usedCount: featureUsage.usedCount });

  const used = rows[0]?.usedCount;
  if (used == null) {
    return fail("Monthly quota exceeded", TypeError.QuotaExceeded);
  }

  return ok({
    feature,
    used,
    quota,
    remaining: Math.max(0, quota - used),
  });
}
