export const PLAN_CODES = ["free", "plus", "pro"] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export const FEATURE_KEYS = ["taxi", "nearwake"] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FREE_MONTHLY_QUOTA = 30;

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
