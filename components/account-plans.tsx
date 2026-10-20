"use client";

import { useState } from "react";
import { formatAlarmRadius } from "@/lib/geofence";
import { useI18n } from "@/lib/i18n/provider";
import { selectPlan } from "@/lib/plan-api";
import { nearwakeRadiusMaxMeters, type PlanCode, type PlanInfo, type PlanOverview } from "@/lib/plans";

export function AccountPlans({
  overview,
  loading,
  onUpdated,
  onToast,
}: {
  overview: PlanOverview | null;
  loading: boolean;
  onUpdated: (next: PlanOverview) => void;
  onToast: (message: string) => void;
}) {
  const { t } = useI18n();
  const [pending, setPending] = useState<PlanCode | null>(null);
  const [saving, setSaving] = useState(false);

  if (loading && !overview) {
    return <p className="py-6 text-center text-sm text-[#8E8E93]">{t("restoringSession")}</p>;
  }
  if (!overview) {
    return <p className="py-6 text-center text-sm text-[#8E8E93]">{t("planLoadFailed")}</p>;
  }

  const current = overview.mine?.planCode ?? "free";
  const taxi = overview.mine?.usage.taxi;
  const nearwake = overview.mine?.usage.nearwake;

  async function applyPlan(planCode: PlanCode) {
    setSaving(true);
    const result = await selectPlan(planCode);
    setSaving(false);
    setPending(null);
    if (!result.ok || !result.overview) {
      onToast(result.message || t("planChangeFailed"));
      return;
    }
    onUpdated(result.overview);
    onToast(t("planChanged"));
  }

  return (
    <div className="space-y-4">
      <p className="text-xs leading-snug text-[#8E8E93]">{t("planPaymentSoon")}</p>

      {taxi && nearwake ? (
        <div className="rounded-2xl bg-[#F7F7F8] px-3.5 py-3">
          <p className="text-xs font-semibold text-[#8E8E93]">{t("planUsageThisMonth")}</p>
          <UsageBar
            label={t("planFeatureNearwake")}
            used={nearwake.used}
            quota={nearwake.quota}
            unit={t("planTimesUnit")}
          />
          <UsageBar
            label={t("planFeatureTaxi")}
            used={taxi.used}
            quota={taxi.quota}
            unit={t("planTimesUnit")}
          />
        </div>
      ) : null}

      <div className="space-y-3">
        {overview.plans.map((item) => (
          <PlanCard
            key={item.planCode}
            plan={item}
            current={item.planCode === current}
            disabled={saving}
            onSelect={() => setPending(item.planCode)}
          />
        ))}
      </div>

      {pending ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5">
            <h2 className="text-lg font-semibold">{t("planChangeTitle")}</h2>
            <p className="mt-2 text-sm text-[#8E8E93]">{t("planChangeMessage")}</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl bg-[#F2F2F7] py-2 font-semibold"
                disabled={saving}
                onClick={() => setPending(null)}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl bg-[#4A89EA] py-2 font-semibold text-white disabled:opacity-70"
                disabled={saving}
                onClick={() => void applyPlan(pending)}
              >
                {saving ? "…" : t("planSelect")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PlanCard({
  plan,
  current,
  disabled,
  onSelect,
}: {
  plan: PlanInfo;
  current: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const { t } = useI18n();
  const name =
    plan.planCode === "plus"
      ? t("planNamePlus")
      : plan.planCode === "pro"
        ? t("planNamePro")
        : t("planNameFree");
  const price =
    plan.priceMonth <= 0 ? t("planFree") : `฿${plan.priceMonth}`;
  const accent =
    plan.planCode === "pro"
      ? "border-[#29292E]"
      : plan.planCode === "plus"
        ? "border-[#4A89EA]"
        : "border-[#E5E5EA]";

  return (
    <article
      className={`rounded-2xl border-2 bg-white px-4 py-3.5 ${accent} ${
        current ? "shadow-[0_4px_12px_rgba(0,0,0,0.08)]" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold">{name}</p>
          <p className="text-sm font-semibold text-[#4A89EA]">
            {price}
            <span className="font-medium text-[#8E8E93]"> / {t("planPerMonth")}</span>
          </p>
        </div>
        {current ? (
          <span className="rounded-full bg-[#9FD356] px-2.5 py-1 text-[11px] font-semibold text-white">
            {t("planCurrent")}
          </span>
        ) : null}
      </div>
      <ul className="mt-3 space-y-1.5 text-sm text-[#29292E]">
        <li>
          {t("planFeatureNearwake")} {plan.nearwakeQuota} {t("planTimesPerMonth")}
        </li>
        <li>
          {t("planNearwakeRadius")}{" "}
          {formatAlarmRadius(nearwakeRadiusMaxMeters(plan.planCode), t("taxiFareKm"), t("mapRadiusMeters"))}
        </li>
        <li>
          {t("planFeatureTaxi")} {plan.taxiQuota} {t("planTimesPerMonth")}
        </li>
      </ul>
      {current ? null : (
        <button
          type="button"
          disabled={disabled}
          onClick={onSelect}
          className="mt-3 w-full rounded-xl bg-[#4A89EA] py-2.5 text-sm font-semibold text-white disabled:opacity-70"
        >
          {t("planSelect")}
        </button>
      )}
    </article>
  );
}

function UsageBar({
  label,
  used,
  quota,
  unit,
}: {
  label: string;
  used: number;
  quota: number;
  unit: string;
}) {
  const pct = quota <= 0 ? 100 : Math.min(100, (used / quota) * 100);
  const over = used >= quota && quota > 0;
  return (
    <div className="mt-2.5">
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium">{label}</span>
        <span className={over ? "font-semibold text-[#C33E83]" : "text-[#8E8E93]"}>
          {used}/{quota} {unit}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#E5E5EA]">
        <div
          className={`h-full rounded-full ${over ? "bg-[#C33E83]" : "bg-[#4A89EA]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
