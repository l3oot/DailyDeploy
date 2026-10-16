"use client";

import { useState } from "react";
import { BentoWave } from "@/components/bento-wave";
import { useI18n } from "@/lib/i18n/provider";
import { digitsFromOpenHours, formatOpenHoursMask, nextOpenHoursValue, OPEN_HOURS_MASK } from "@/lib/open-hours";
import { dashIfEmpty, starCountFromStoredScore, type ToiletLocation } from "@/lib/toilets";

const BIDET_SPRAY = "สายชำระ";
const BIDET_TISSUE = "ทิชชู่";
const STATUS_OPEN = "เปิด";
const STATUS_CLOSED = "ปิด";

export type ToiletFormValues = {
  placeToilet: string;
  bidetToilet: string;
  statusToilet: string;
  commentToilet: string;
  priceToilet: string;
  quantityToilet: string;
  openHoursToilet: string;
  cleanStars: number;
  avgStars: number;
  safeStars: number;
};

export const emptyToiletForm = (): ToiletFormValues => ({
  placeToilet: "",
  bidetToilet: "",
  statusToilet: "",
  commentToilet: "",
  priceToilet: "",
  quantityToilet: "",
  openHoursToilet: OPEN_HOURS_MASK,
  cleanStars: 0,
  avgStars: 0,
  safeStars: 0,
});

function blankIfDash(value: string) {
  const t = value.trim();
  return !t || t === "-" ? "" : t;
}

export function formFromToilet(toilet: ToiletLocation): ToiletFormValues {
  const bidet = toilet.bidetToilet.trim();
  const status = toilet.statusToilet.trim();
  const hoursDigits = digitsFromOpenHours(toilet.openHoursToilet);
  return {
    placeToilet: blankIfDash(toilet.placeToilet),
    bidetToilet: bidet === BIDET_SPRAY || bidet === BIDET_TISSUE ? bidet : "",
    statusToilet: status === STATUS_OPEN || status === STATUS_CLOSED ? status : "",
    commentToilet: blankIfDash(toilet.commentToilet),
    priceToilet: toilet.priceToilet ? String(toilet.priceToilet) : "",
    quantityToilet: toilet.quantityToilet ? String(toilet.quantityToilet) : "",
    openHoursToilet: hoursDigits ? formatOpenHoursMask(hoursDigits) : OPEN_HOURS_MASK,
    cleanStars: starCountFromStoredScore(toilet.cleanScoreToilet),
    avgStars: starCountFromStoredScore(toilet.avgScoreToilet),
    safeStars: Math.max(0, Math.min(5, toilet.safeToilet)),
  };
}

function SheetShell({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-3xl bg-[#FFF8F0] px-5 pb-6 pt-3 shadow-[0_-8px_24px_rgba(0,0,0,0.12)]">
        <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-[#D1D5DB]" />
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  rows,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: string;
  rows?: number;
}) {
  const readOnly = !onChange;
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-[#1F2937]">{label}</span>
      {rows ? (
        <textarea
          value={value}
          readOnly={readOnly}
          rows={rows}
          placeholder={placeholder}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          className="w-full resize-none rounded-xl border border-[#DCE3EE] bg-white px-3 py-2.5 text-[15px] text-[#1F2937]"
        />
      ) : (
        <input
          type={type}
          inputMode={type === "number" ? "numeric" : undefined}
          value={value}
          readOnly={readOnly}
          placeholder={placeholder}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          className="w-full rounded-xl border border-[#DCE3EE] bg-white px-3 py-2.5 text-[15px] text-[#1F2937]"
        />
      )}
    </label>
  );
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  readOnly,
}: {
  label: string;
  value: T | "";
  options: Array<{ value: T; label: string }>;
  onChange?: (value: T | "") => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <p className="w-[38%] text-sm font-semibold text-[#1F2937]">{label}</p>
      <div className="grid min-w-0 flex-1 grid-cols-2 overflow-hidden rounded-xl border border-[#DCE3EE] bg-white">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={readOnly}
              onClick={() => onChange?.(selected ? "" : option.value)}
              className={`px-2 py-2 text-sm font-semibold ${
                selected ? "bg-[#E5E7EB] text-[#1F2937]" : "text-[#6B7280]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StarRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange?: (value: number) => void;
}) {
  const v = Math.max(0, Math.min(5, value));
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <p className="text-sm font-semibold text-[#1F2937]">{label}</p>
      <div className="flex">
        {Array.from({ length: 5 }, (_, i) => {
          const star = i + 1;
          const filled = star <= v;
          return (
            <button
              key={star}
              type="button"
              disabled={!onChange}
              onClick={() => onChange?.(star)}
              className="px-0.5 text-[22px] leading-none disabled:cursor-default"
              aria-label={`${star}`}
            >
              <span className={filled ? "text-amber-600" : "text-gray-400"}>{filled ? "★" : "☆"}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ToiletFormSheet({
  values,
  onChange,
  onClose,
  onSave,
  saving,
  error,
  recorderName,
}: {
  values: ToiletFormValues;
  onChange: (next: ToiletFormValues) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  error: string;
  recorderName?: string;
}) {
  const { t } = useI18n();
  const [otherOpen, setOtherOpen] = useState(false);

  return (
    <SheetShell onClose={onClose}>
      <div className="grid gap-3">
        <Field
          label={t("toiletPlaceName")}
          value={values.placeToilet}
          onChange={(placeToilet) => onChange({ ...values, placeToilet })}
        />
        <Segmented
          label={t("toiletBidet")}
          value={values.bidetToilet}
          options={[
            { value: BIDET_SPRAY, label: t("toiletBidetSpray") },
            { value: BIDET_TISSUE, label: t("toiletBidetTissue") },
          ]}
          onChange={(bidetToilet) => onChange({ ...values, bidetToilet })}
        />
        <Segmented
          label={t("toiletStatus")}
          value={values.statusToilet}
          options={[
            { value: STATUS_OPEN, label: t("toiletStatusOpen") },
            { value: STATUS_CLOSED, label: t("toiletStatusClosed") },
          ]}
          onChange={(statusToilet) => onChange({ ...values, statusToilet })}
        />
        <Field
          label={t("toiletComment")}
          value={values.commentToilet}
          rows={2}
          onChange={(commentToilet) => onChange({ ...values, commentToilet })}
        />
        <button
          type="button"
          onClick={() => setOtherOpen((open) => !open)}
          className="flex items-center justify-between py-1 text-sm font-semibold text-[#1F2937]"
        >
          {t("toiletOtherDetails")}
          <span className="text-[#6B7280]">{otherOpen ? "▴" : "▾"}</span>
        </button>
        {otherOpen ? (
          <div className="grid gap-3">
            <div className="grid grid-cols-3 gap-2">
              <Field
                label={t("toiletPrice")}
                value={values.priceToilet}
                type="number"
                onChange={(priceToilet) => onChange({ ...values, priceToilet })}
              />
              <Field
                label={t("toiletQuantity")}
                value={values.quantityToilet}
                type="number"
                onChange={(quantityToilet) => onChange({ ...values, quantityToilet })}
              />
              <Field
                label={t("toiletOpenHours")}
                value={values.openHoursToilet}
                onChange={(openHoursToilet) =>
                  onChange({ ...values, openHoursToilet: nextOpenHoursValue(values.openHoursToilet, openHoursToilet) })
                }
              />
            </div>
            <StarRow
              label={t("toiletCleanScore")}
              value={values.cleanStars}
              onChange={(cleanStars) => onChange({ ...values, cleanStars })}
            />
            <StarRow
              label={t("toiletAvgScore")}
              value={values.avgStars}
              onChange={(avgStars) => onChange({ ...values, avgStars })}
            />
            <StarRow
              label={t("toiletSafety")}
              value={values.safeStars}
              onChange={(safeStars) => onChange({ ...values, safeStars })}
            />
            {recorderName ? <Field label={t("toiletRecorder")} value={dashIfEmpty(recorderName)} /> : null}
          </div>
        ) : null}
        {recorderName ? (
          <p className="text-xs text-[#8E8E93]">{t("toiletSharedEditHint")}</p>
        ) : null}
        {error ? <p className="text-sm text-[#C33E83]">{error}</p> : null}
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="relative mt-1 overflow-hidden rounded-3xl bg-[#2563EB] py-3.5 text-xl font-semibold tracking-wide text-white disabled:opacity-60"
        >
          <BentoWave color="#6BA3F0" animate={false} progress={0.34} cloudLike />
          <span className="relative z-10">{saving ? t("toiletSaving") : t("toiletSave")}</span>
        </button>
      </div>
    </SheetShell>
  );
}

