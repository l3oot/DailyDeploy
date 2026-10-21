export const PLAN_CODES = ["free", "plus", "pro"] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export const FEATURE_KEYS = ["taxi", "nearwake"] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FREE_MONTHLY_QUOTA = 30;

export const NEARWAKE_RADIUS_MIN_METERS = 50;
export const NEARWAKE_RADIUS_STEP_METERS = 50;
export const NEARWAKE_RADIUS_DEFAULT_METERS = 500;
/** Stops shown on the tracking screen. */
export const NEARWAKE_RADIUS_STOPS_METERS = [500, 1_000, 2_000, 5_000] as const;

/** Alarm radius ceiling by plan: Free 500 m, Plus 3 km, Pro 5 km. */
export const NEARWAKE_RADIUS_MAX_METERS: Record<PlanCode, number> = {
  free: 500,
  plus: 3_000,
  pro: 5_000,
};

export function nearwakeRadiusMaxMeters(planCode: PlanCode | null | undefined) {
  return NEARWAKE_RADIUS_MAX_METERS[planCode ?? "free"];
}

export function clampNearwakeRadius(meters: number, planCode: PlanCode | null | undefined) {
  const max = nearwakeRadiusMaxMeters(planCode);
  const clamped = Math.min(max, Math.max(NEARWAKE_RADIUS_MIN_METERS, meters));
  const steps = Math.round(clamped / NEARWAKE_RADIUS_STEP_METERS);
  return Math.min(max, steps * NEARWAKE_RADIUS_STEP_METERS);
}

export function snapNearwakeRadius(meters: number, planCode: PlanCode | null | undefined) {
  const max = nearwakeRadiusMaxMeters(planCode);
  const allowed = NEARWAKE_RADIUS_STOPS_METERS.filter((stop) => stop <= max);
  const stops = allowed.length > 0 ? allowed : [NEARWAKE_RADIUS_STOPS_METERS[0]];
  return stops.reduce((best, stop) => (Math.abs(stop - meters) < Math.abs(best - meters) ? stop : best));
}

export type PlanInfo = {
  planCode: PlanCode;
  planName: string;
  priceMonth: number;
  taxiQuota: number;
  nearwakeQuota: number;
};

export type FeatureUsageSnapshot = {
  used: number;
  quota: number;
  remaining: number;
};

export type MyPlan = {
  planCode: PlanCode;
  selectedAt: string;
  periodYm: string;
  plan: PlanInfo;
  usage: {
    taxi: FeatureUsageSnapshot;
    nearwake: FeatureUsageSnapshot;
  };
};

export type PlanOverview = {
  paymentAvailable: boolean;
  plans: PlanInfo[];
  mine: MyPlan | null;
};

export function isPlanCode(value: string): value is PlanCode {
  return (PLAN_CODES as readonly string[]).includes(value);
}

export function isFeatureKey(value: string): value is FeatureKey {
  return (FEATURE_KEYS as readonly string[]).includes(value);
}

export function currentPeriodYm(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}
