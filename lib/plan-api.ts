import { api, errorText } from "./api";
import { isGuest } from "./guest";
import {
  currentPeriodYm,
  FREE_MONTHLY_QUOTA,
  type FeatureKey,
  type FeatureUsageSnapshot,
  type PlanCode,
  type PlanOverview,
} from "./plans";

export type ConsumeResult =
  | { ok: true; used: number; quota: number; remaining: number }
  | { ok: false; reason: "quota" | "auth" | "error"; message: string };

type GuestUsage = {
  periodYm: string;
  taxi: number;
  nearwake: number;
};

const GUEST_USAGE_KEY = "da_feature_usage";

function snapshot(used: number, quota: number): FeatureUsageSnapshot {
  const safeUsed = Math.max(0, used);
  const safeQuota = Math.max(0, quota);
  return {
    used: safeUsed,
    quota: safeQuota,
    remaining: Math.max(0, safeQuota - safeUsed),
  };
}

function emptyGuestUsage(periodYm: string): GuestUsage {
  return { periodYm, taxi: 0, nearwake: 0 };
}

function readGuestUsage(): GuestUsage {
  const periodYm = currentPeriodYm();
  if (typeof window === "undefined") return emptyGuestUsage(periodYm);
  try {
    const raw = window.localStorage.getItem(GUEST_USAGE_KEY);
    if (!raw) return emptyGuestUsage(periodYm);
    const data = JSON.parse(raw) as Partial<GuestUsage>;
    if (data.periodYm !== periodYm) return emptyGuestUsage(periodYm);
    return {
      periodYm,
      taxi: Math.max(0, Number(data.taxi) || 0),
      nearwake: Math.max(0, Number(data.nearwake) || 0),
    };
  } catch {
    return emptyGuestUsage(periodYm);
  }
}

function writeGuestUsage(usage: GuestUsage) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GUEST_USAGE_KEY, JSON.stringify(usage));
}

function consumeGuest(feature: FeatureKey): ConsumeResult {
  const usage = readGuestUsage();
  const used = usage[feature];
  if (used >= FREE_MONTHLY_QUOTA) {
    return { ok: false, reason: "quota", message: "Quota exceeded" };
  }
  const nextUsed = used + 1;
  writeGuestUsage({ ...usage, [feature]: nextUsed });
  return {
    ok: true,
    used: nextUsed,
    quota: FREE_MONTHLY_QUOTA,
    remaining: Math.max(0, FREE_MONTHLY_QUOTA - nextUsed),
  };
}

export async function fetchPlanOverview(): Promise<PlanOverview | null> {
  const res = await api<PlanOverview>("/api/v1/plans");
  if (!res.body.isSuccess || !res.body.data) return null;
  return res.body.data;
}

export async function selectPlan(planCode: PlanCode): Promise<{
  ok: boolean;
  overview: PlanOverview | null;
  message: string;
}> {
  const res = await api<PlanOverview>("/api/v1/plans", {
    method: "PUT",
    body: JSON.stringify({ planCode }),
  });
  if (!res.body.isSuccess || !res.body.data) {
    return {
      ok: false,
      overview: null,
      message: errorText(res.body, "Could not change plan"),
    };
  }
  return { ok: true, overview: res.body.data, message: res.body.message ?? "" };
}

export async function peekFeatureUsage(
  feature: FeatureKey,
): Promise<FeatureUsageSnapshot | null> {
  if (isGuest()) {
    const usage = readGuestUsage();
    return snapshot(usage[feature], FREE_MONTHLY_QUOTA);
  }
  const overview = await fetchPlanOverview();
  return overview?.mine?.usage[feature] ?? null;
}

export async function consumeFeature(feature: FeatureKey): Promise<ConsumeResult> {
  if (isGuest()) return consumeGuest(feature);

  const res = await api<{
    feature: FeatureKey;
    used: number;
    quota: number;
    remaining: number;
  }>("/api/v1/plans/usage", {
    method: "POST",
    body: JSON.stringify({ feature }),
  });

  if (res.status === 401 || res.body.errorType === 2) {
    return {
      ok: false,
      reason: "auth",
      message: errorText(res.body, "Sign in required"),
    };
  }
  if (res.body.errorType === 8 || res.body.errorMessage?.toLowerCase().includes("quota")) {
    return {
      ok: false,
      reason: "quota",
      message: errorText(res.body, "Quota exceeded"),
    };
  }
  if (res.status === 429 || res.body.errorType === 7) {
    return {
      ok: false,
      reason: "error",
      message: errorText(res.body, "Too many requests"),
    };
  }
  if (!res.body.isSuccess || !res.body.data) {
    return {
      ok: false,
      reason: "error",
      message: errorText(res.body, "Could not record usage"),
    };
  }
  return {
    ok: true,
    used: res.body.data.used,
    quota: res.body.data.quota,
    remaining: res.body.data.remaining,
  };
}
