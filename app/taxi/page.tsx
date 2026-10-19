"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { BentoWave } from "@/components/bento-wave";
import { PageBack } from "@/components/page-back";
import { PlaceSearch } from "@/components/place-search";
import { TaxiRouteMap } from "@/components/taxi-route-map";
import { TopoPattern } from "@/components/topo-pattern";
import { fetchDrivingRoute } from "@/lib/google-routes";
import { useI18n } from "@/lib/i18n/provider";
import { consumeFeature, peekFeatureUsage } from "@/lib/plan-api";
import type { FeatureUsageSnapshot } from "@/lib/plans";
import { computeTaxiFare, haversineKm, type TaxiFareResult } from "@/lib/taxi";

type Point = { lat: number; lng: number };

export default function TaxiPage() {
  const { t } = useI18n();
  const [originLabel, setOriginLabel] = useState("");
  const [destLabel, setDestLabel] = useState("");
  const [origin, setOrigin] = useState<Point | null>(null);
  const [dest, setDest] = useState<Point | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [traffic, setTraffic] = useState("");
  const [optApp, setOptApp] = useState(false);
  const [optAirport, setOptAirport] = useState(false);
  const [result, setResult] = useState<TaxiFareResult | null>(null);
  const [needMessage, setNeedMessage] = useState("");
  const [rateOpen, setRateOpen] = useState(false);
  const [routeKm, setRouteKm] = useState<number | null>(null);
  const [routePath, setRoutePath] = useState<Point[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeFallback, setRouteFallback] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [taxiUsage, setTaxiUsage] = useState<FeatureUsageSnapshot | null>(null);
  const odBoxRef = useRef<HTMLDivElement>(null);

  const originLat = origin?.lat ?? null;
  const originLng = origin?.lng ?? null;
  const destLat = dest?.lat ?? null;
  const destLng = dest?.lng ?? null;
  const canCalculate =
    routeKm != null && !routeLoading && origin != null && dest != null && !calculating;

  useEffect(() => {
    void peekFeatureUsage("taxi").then((usage) => {
      if (usage) setTaxiUsage(usage);
    });
  }, []);

  useEffect(() => {
    if (
      originLat == null ||
      originLng == null ||
      destLat == null ||
      destLng == null
    ) {
      setRouteKm(null);
      setRoutePath([]);
      setRouteFallback(false);
      setRouteLoading(false);
      return;
    }

    const from = { lat: originLat, lng: originLng };
    const to = { lat: destLat, lng: destLng };
    const controller = new AbortController();
    setRouteLoading(true);
    setResult(null);
    setRouteFallback(false);
    setRoutePath([]);
    setNeedMessage("");

    void fetchDrivingRoute(from, to, controller.signal)
      .then((route) => {
        if (controller.signal.aborted) return;
        if (route) {
          setRouteKm(route.distanceKm);
          setRoutePath(route.points);
          setRouteFallback(false);
        } else {
          setRouteKm(haversineKm(from, to));
          setRoutePath([from, to]);
          setRouteFallback(true);
        }
        setRouteLoading(false);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const name = error instanceof Error ? error.name : "";
        if (name === "AbortError") return;
        setRouteKm(haversineKm(from, to));
        setRoutePath([from, to]);
        setRouteFallback(true);
        setRouteLoading(false);
      });

    return () => controller.abort();
  }, [originLat, originLng, destLat, destLng]);

  function captureOrigin() {
    if (!navigator.geolocation) {
      setGpsError(t("taxiFareGpsError"));
      return;
    }
    setGpsBusy(true);
    setGpsError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setOriginLabel(t("taxiFareOriginMyLocation"));
        setResult(null);
        setGpsBusy(false);
      },
      () => {
        setGpsError(t("taxiFareGpsError"));
        setGpsBusy(false);
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  async function calculate() {
    if (originLat == null || originLng == null) {
      setNeedMessage(t("taxiFareSelectOrigin"));
      setResult(null);
      return;
    }
    if (routeKm == null || destLat == null) {
      setNeedMessage(t("taxiFareSelectPlace"));
      setResult(null);
      return;
    }
    if (calculating) return;
    setCalculating(true);
    const consumed = await consumeFeature("taxi");
    setCalculating(false);
    if (!consumed.ok) {
      setResult(null);
      if (consumed.reason === "quota") {
        setNeedMessage(t("planQuotaExceededTaxi"));
        setTaxiUsage((prev) =>
          prev ? { ...prev, used: prev.quota, remaining: 0 } : prev,
        );
        return;
      }
      setNeedMessage(
        consumed.reason === "auth" ? t("planQuotaAuthRequired") : consumed.message,
      );
      return;
    }
    setTaxiUsage({
      used: consumed.used,
      quota: consumed.quota,
      remaining: consumed.remaining,
    });
    setNeedMessage("");
    setResult(
      computeTaxiFare({
        distanceKm: routeKm,
        trafficMinutes: Number.parseInt(traffic, 10) || 0,
        appBookingSurcharge: optApp,
        airportSurcharge: optAirport,
      }),
    );
  }

  const money = (v: number) =>
    v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <main className="relative min-h-dvh overflow-x-hidden pb-10">
      <TopoPattern />
      <div className="relative z-10 px-1 pt-2">
        <PageBack />
      </div>
      <div className="relative z-10 mx-auto w-full max-w-lg px-5">
        <div className="relative overflow-hidden rounded-3xl bg-[#C33E83] px-5 py-5 text-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <BentoWave
            color="#D573A8"
            animate={false}
            progress={0.34}
            topRightToBottomLeft
            cloudLike
          />
          <div className="relative z-10 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[22px] font-bold">{t("bentoTaxiCardTitle")}</p>
              <p className="mt-1 text-[13px] leading-snug text-[#F2D5E5]">{t("taxiFareSubtitle")}</p>
            </div>
            <Image src="/icon/taxi.png" alt="" width={78} height={52} className="h-auto w-[78px]" />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setRateOpen(true)}
            className="pt-1 text-[15px] font-semibold text-[#C33E83]"
          >
            {t("taxiFareRateDetails")}
          </button>
        </div>

        <div className="mt-1 overflow-visible rounded-[20px] bg-[#FFF8F0]">
          <div
            ref={odBoxRef}
            className="grid grid-cols-2 overflow-visible rounded-xl border border-[#E5E5EA] bg-white"
          >
            <div className="border-r border-[#E5E5EA] px-3.5 py-2">
              <p className="text-xs font-medium text-[#8E8E93]">{t("taxiFareOrigin")}</p>
              <PlaceSearch
                value={originLabel}
                suggestionsEnabled={!origin}
                menuAnchorRef={odBoxRef}
                onChange={(next) => {
                  setOriginLabel(next);
                  setOrigin(null);
                  setResult(null);
                  setNeedMessage("");
                }}
                onResolved={(place) => {
                  setOrigin({ lat: place.lat, lng: place.lon });
                  setOriginLabel(place.name);
                  setResult(null);
                }}
              />
            </div>
            <div className="px-3.5 py-2">
              <p className="text-xs font-medium text-[#8E8E93]">{t("taxiFareDestination")}</p>
              <PlaceSearch
                value={destLabel}
                suggestionsEnabled={!dest}
                menuAnchorRef={odBoxRef}
                onChange={(next) => {
                  setDestLabel(next);
                  setDest(null);
                  setResult(null);
                  setNeedMessage("");
                }}
                onResolved={(place) => {
                  setDest({ lat: place.lat, lng: place.lon });
                  setDestLabel(place.name);
                  setResult(null);
                }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={captureOrigin}
            disabled={gpsBusy}
            className="mt-1 inline-flex items-center gap-1.5 px-1 py-1 text-[13px] font-semibold text-[#C33E83] disabled:opacity-60"
          >
            <GpsIcon />
            {gpsBusy ? t("taxiFareGpsLoading") : t("taxiFareOriginMyLocation")}
          </button>

          <label className="mt-2 block">
            <span className="text-sm font-medium text-[#8E8E93]">{t("taxiFareTraffic")}</span>
            <input
              inputMode="numeric"
              value={traffic}
              onChange={(e) => {
                setTraffic(e.target.value.replace(/\D/g, ""));
                setResult(null);
              }}
              className="mt-2 w-full rounded-xl border border-[#E5E5EA] bg-white px-3.5 py-3"
            />
            <span className="mt-1 block text-xs text-[#8E8E93]">{t("taxiFareTrafficHelp")}</span>
          </label>

          <TaxiSwitch
            label={t("taxiFareOptApp")}
            checked={optApp}
            onChange={(v) => {
              setOptApp(v);
              setResult(null);
            }}
          />
          <div className="h-px bg-[#E5E5EA]" />
          <TaxiSwitch
            label={t("taxiFareOptAirport")}
            checked={optAirport}
            onChange={(v) => {
              setOptAirport(v);
              setResult(null);
            }}
          />

          {routeLoading && dest ? (
            <p className="mt-3 flex items-center gap-2.5 text-[13px] text-[#8E8E93]">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#C33E83] border-t-transparent" />
              {t("taxiFareRouteLoading")}
            </p>
          ) : null}

          {routeKm != null && !routeLoading ? (
            <div className="mt-3.5 border-t border-[#E5E5EA] pt-3">
              <p className="text-sm font-bold text-[#C33E83]">
                {t("taxiFareDistanceRoute")}: {money(routeKm)} {t("taxiFareKm")}
              </p>
              {routeFallback ? (
                <p className="mt-1.5 text-xs leading-snug text-orange-800">
                  {t("taxiFareRouteFallback")}
                </p>
              ) : null}
              {origin && dest ? (
                <div className="mt-3 h-[200px] overflow-hidden rounded-2xl">
                  <TaxiRouteMap
                    origin={origin}
                    dest={dest}
                    path={routePath}
                    fallback={routeFallback}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {gpsError ? <p className="mt-2 text-sm text-[#C33E83]">{gpsError}</p> : null}

        <button
          type="button"
          onClick={() => void calculate()}
          disabled={!canCalculate}
          className={`relative mt-3 w-full overflow-hidden rounded-2xl bg-[#C33E83] py-3.5 text-lg font-extrabold text-white ${
            canCalculate ? "" : "opacity-50"
          }`}
        >
          <BentoWave
            color="#D573A8"
            animate={false}
            progress={0.34}
            topRightToBottomLeft
            cloudLike
          />
          <span className="relative z-10">{t("taxiFareCalculate")}</span>
        </button>

        {taxiUsage ? (
          <p className="mt-2 text-center text-xs text-[#8E8E93]">
            {t("planUsageRemaining")} {taxiUsage.used}/{taxiUsage.quota} {t("planTimesUnit")}
          </p>
        ) : null}

        {needMessage ? <p className="mt-3 text-sm text-[#C33E83]">{needMessage}</p> : null}

        {result ? (
          <section className="mt-4 rounded-[20px] border border-[#C33E83]/35 bg-[#FFF8F0] px-5 py-5">
            <p className="text-base font-bold">{t("taxiFareBreakdown")}</p>
            <div className="my-3 h-px bg-[#E5E5EA]" />
            <ul className="space-y-1.5 text-[13px]">
              {result.distanceLines.map((line) => (
                <li key={line.label} className="flex justify-between gap-3">
                  <span className="text-[#8E8E93]">{line.label}</span>
                  <span className="font-semibold">
                    {money(line.amountBaht)} {t("taxiFareBaht")}
                  </span>
                </li>
              ))}
              {result.trafficBaht > 0 ? (
                <li className="flex justify-between gap-3">
                  <span className="text-[#8E8E93]">{t("taxiFareTrafficCharge")}</span>
                  <span className="font-semibold">
                    {money(result.trafficBaht)} {t("taxiFareBaht")}
                  </span>
                </li>
              ) : null}
              {result.appSurcharge > 0 ? (
                <li className="flex justify-between gap-3">
                  <span className="text-[#8E8E93]">{t("taxiFareSurchargeApp")}</span>
                  <span className="font-semibold">
                    {money(result.appSurcharge)} {t("taxiFareBaht")}
                  </span>
                </li>
              ) : null}
              {result.airportSurcharge > 0 ? (
                <li className="flex justify-between gap-3">
                  <span className="text-[#8E8E93]">{t("taxiFareSurchargeAirport")}</span>
                  <span className="font-semibold">
                    {money(result.airportSurcharge)} {t("taxiFareBaht")}
                  </span>
                </li>
              ) : null}
            </ul>
            <div className="my-4 h-px bg-[#E5E5EA]" />
            <p className="flex items-start justify-between gap-3">
              <span className="text-lg font-bold">{t("taxiFareTotal")}</span>
              <span className="text-[22px] font-bold text-[#C33E83]">
                {money(result.totalBaht)} {t("taxiFareBaht")}
              </span>
            </p>
          </section>
        ) : null}

        <p className="mt-4 text-xs font-medium leading-relaxed text-[#8E8E93]">
          {t("taxiFareDisclaimer")}
        </p>
      </div>

      {rateOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6">
          <div className="max-h-[80vh] w-full max-w-md overflow-auto rounded-2xl bg-[#FFF8F0] p-6 shadow-xl">
            <h2 className="text-lg font-semibold">{t("taxiFareRateDetails")}</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-[#8E8E93]">
              {t("taxiFareRateIntro")}
            </p>
            <button
              type="button"
              className="mt-4 w-full rounded-xl bg-[#C33E83] py-2 font-semibold text-white"
              onClick={() => setRateOpen(false)}
            >
              {t("ok")}
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function TaxiSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="pr-3 text-sm">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked ? "bg-[#C33E83]" : "bg-[#D1D1D6]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function GpsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M12 2v2.2M12 19.8V22M2 12h2.2M19.8 12H22"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
