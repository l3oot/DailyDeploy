"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bell,
  Car,
  ChevronLeft,
  Compass,
  Crosshair,
  MapPin,
  Navigation,
  Settings,
  Star,
  X,
} from "lucide-react";
import Link from "next/link";
import { NearwakeLeafletMap, type MapPoint } from "@/components/nearwake-leaflet-map";
import { PlaceSearch } from "@/components/place-search";
import { api } from "@/lib/api";
import { distanceMeters, formatAlarmRadius } from "@/lib/geofence";
import { isGuest } from "@/lib/guest";
import { useI18n } from "@/lib/i18n/provider";
import { requestAlarmPermission } from "@/lib/near-alarm";
import { fetchPlanOverview, peekFeatureUsage } from "@/lib/plan-api";
import {
  NEARWAKE_RADIUS_DEFAULT_METERS,
  NEARWAKE_RADIUS_STOPS_METERS,
  nearwakeRadiusMaxMeters,
  snapNearwakeRadius,
  type PlanCode,
} from "@/lib/plans";
import { persistStorePlace, type ResolvedPlace } from "@/lib/places";
import { useTracking } from "@/lib/tracking-session";

export default function NearwakeMapPage() {
  return (
    <Suspense fallback={<MapFallback />}>
      <NearwakeMapInner />
    </Suspense>
  );
}

function formatStraight(meters: number, kmLabel: string, mLabel: string) {
  if (meters < 1000) return `${Math.max(1, Math.round(meters))} ${mLabel}`;
  const km = meters / 1000;
  const rounded = km >= 10 ? Math.round(km) : Math.round(km * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} ${kmLabel}`;
}

function MapFallback() {
  const { t } = useI18n();
  return (
    <main className="flex min-h-dvh items-center justify-center text-sm text-[#8E8E93]">
      {t("mapWaitingGps")}
    </main>
  );
}

function NearwakeMapInner() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const tracking = useTracking();
  const [query, setQuery] = useState("");
  const [dest, setDest] = useState<ResolvedPlace | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [namingFavorite, setNamingFavorite] = useState(false);
  const [favoriteName, setFavoriteName] = useState("");
  const [fromFavorite, setFromFavorite] = useState(false);
  const [radiusMeters, setRadiusMeters] = useState(NEARWAKE_RADIUS_DEFAULT_METERS);
  const [planCode, setPlanCode] = useState<PlanCode>("free");
  const [planReady, setPlanReady] = useState(false);
  const [notifyOnExit, setNotifyOnExit] = useState(false);
  const [recenterToken, setRecenterToken] = useState(0);
  const [overviewToken, setOverviewToken] = useState(0);
  const [compassToken, setCompassToken] = useState(0);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const recentKeyRef = useRef("");
  const gps = tracking.gps;

  useEffect(() => {
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    const name = params.get("name")?.trim() || "";
    const storeplaceUuid = params.get("storeplaceUuid")?.trim() || undefined;
    const detail = params.get("detail")?.trim() || undefined;
    if (Number.isFinite(lat) && Number.isFinite(lng) && name) {
      setDest({ lat, lon: lng, name, detail, source: "nearwake", storeplaceUuid });
      setFromFavorite(params.get("from") === "favorite");
      setQuery("");
    }
  }, [params]);

  useEffect(() => {
    if (!dest) {
      recentKeyRef.current = "";
      return;
    }
    const key = `${dest.lat.toFixed(5)}|${dest.lon.toFixed(5)}|${dest.name}`;
    if (recentKeyRef.current === key) return;
    recentKeyRef.current = key;
    const snapshot = dest;
    void (async () => {
      let storeplaceUuid = snapshot.storeplaceUuid;
      if (!storeplaceUuid) {
        const saved = await persistStorePlace({
          placeName: snapshot.name,
          placeDetail: snapshot.detail ?? "",
          lat: snapshot.lat,
          lon: snapshot.lon,
        });
        if (saved.status === 401) return;
        if (!saved.storeplaceUuid) {
          recentKeyRef.current = "";
          return;
        }
        storeplaceUuid = saved.storeplaceUuid;
        setDest((current) =>
          current &&
          current.lat === snapshot.lat &&
          current.lon === snapshot.lon &&
          current.name === snapshot.name &&
          !current.storeplaceUuid
            ? { ...current, storeplaceUuid }
            : current,
        );
      }
      const res = await api("/api/v1/nearwake/recentplace", {
        method: "POST",
        body: JSON.stringify({
          recentPlaceName: snapshot.name,
          storeplaceUuid,
        }),
      });
      if (!res.body.isSuccess && res.status !== 401) recentKeyRef.current = "";
    })();
  }, [dest]);

  useEffect(() => {
    tracking.setMapVisible(true);
    return () => tracking.setMapVisible(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!navigator.geolocation || tracking.gpsDenied) setError(t("mapGpsDenied"));
    else setError("");
  }, [t, tracking.gpsDenied]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (isGuest()) {
          if (!cancelled) setPlanCode("free");
          return;
        }
        const overview = await fetchPlanOverview();
        if (cancelled) return;
        setPlanCode(overview?.mine?.planCode ?? "free");
      } finally {
        if (!cancelled) setPlanReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const maxRadius = planReady
    ? nearwakeRadiusMaxMeters(planCode)
    : NEARWAKE_RADIUS_STOPS_METERS[NEARWAKE_RADIUS_STOPS_METERS.length - 1];
  const planLabel =
    planCode === "plus" ? t("planNamePlus") : planCode === "pro" ? t("planNamePro") : t("planNameFree");

  useEffect(() => {
    if (!planReady) return;
    const source = tracking.active ? tracking.radiusMeters : radiusMeters;
    const next = snapNearwakeRadius(source, planCode);
    if (next !== radiusMeters) setRadiusMeters(next);
    if (tracking.active && next !== tracking.radiusMeters) tracking.setRadius(next);
    // Re-snap when the plan ceiling is known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planReady, planCode]);

  useEffect(() => {
    if (!tracking.active || !tracking.dest || dest) return;
    setDest({
      lat: tracking.dest.lat,
      lon: tracking.dest.lon,
      name: tracking.dest.name,
      detail: tracking.dest.detail,
      source: "nearwake",
      storeplaceUuid: tracking.dest.storeplaceUuid,
    });
    setFromFavorite(Boolean(tracking.dest.fromFavorite));
    setRadiusMeters(tracking.radiusMeters);
    setNotifyOnExit(tracking.notifyOnExit);
  }, [tracking.active, tracking.dest, tracking.radiusMeters, tracking.notifyOnExit, dest]);

  useEffect(() => {
    if (!planReady || !tracking.active || !tracking.dest || !dest) return;
    const samePlace =
      Math.abs(dest.lat - tracking.dest.lat) < 0.00001 && Math.abs(dest.lon - tracking.dest.lon) < 0.00001;
    if (!samePlace) return;
    const next = snapNearwakeRadius(tracking.radiusMeters, planCode);
    setRadiusMeters(next);
    if (next !== tracking.radiusMeters) tracking.setRadius(next);
  }, [planReady, tracking.active, tracking.dest, tracking.radiusMeters, tracking.setRadius, dest, planCode]);

  const destPoint = dest ? { lat: dest.lat, lng: dest.lon } : null;
  const straightMeters = gps && destPoint ? distanceMeters(gps, destPoint) : null;
  const straightLabel =
    straightMeters != null
      ? formatStraight(straightMeters, t("taxiFareKm"), t("mapRadiusMeters"))
      : "";
  const radius = snapNearwakeRadius(radiusMeters, planReady ? planCode : "pro");

  function applyDestination(place: ResolvedPlace) {
    if (tracking.active) tracking.stop();
    setDest(place);
    setQuery("");
    setFromFavorite(false);
    setNamingFavorite(false);
    setFavoriteName("");
  }

  async function onPlaceResolved(place: ResolvedPlace) {
    applyDestination(place);
    if (place.source === "longdo") setToast(t("mapResolvedWithLongdo"));
    if (place.source === "google") setToast(t("mapResolvedWithGoogle"));
    if (place.source === "nearwake") setToast(t("mapResolvedFromNearwake"));
  }

  function onMapLongPress(point: MapPoint) {
    applyDestination({
      lat: point.lat,
      lon: point.lng,
      name: `${t("mapPickedLocation")} (${point.lat.toFixed(5)}, ${point.lng.toFixed(5)})`,
      source: "nearwake",
    });
  }

  function clearDestination() {
    if (tracking.active) tracking.stop();
    setDest(null);
    setQuery("");
    setFromFavorite(false);
    setNamingFavorite(false);
    setFavoriteName("");
    router.replace("/nearwake/map");
  }

  function chooseRadius(stop: number) {
    if (stop > maxRadius) {
      setToast(`${planLabel} ${formatAlarmRadius(maxRadius, t("taxiFareKm"), t("mapRadiusMeters"))}`);
      return;
    }
    setRadiusMeters(stop);
    if (tracking.active) tracking.setRadius(stop);
  }

  function beginSaveFavorite() {
    if (!dest) {
      setToast(t("mapFavoriteNeedDest"));
      return;
    }
    setFavoriteName(dest.name);
    setNamingFavorite(true);
  }

  async function saveFavorite() {
    if (!dest) {
      setToast(t("mapFavoriteNeedDest"));
      return;
    }
    const name = favoriteName.trim();
    if (!name) {
      setToast(t("mapFavoriteNeedName"));
      return;
    }
    setSaving(true);
    let storeplaceUuid = dest.storeplaceUuid;
    if (!storeplaceUuid) {
      const saved = await persistStorePlace({
        placeName: dest.name,
        placeDetail: dest.detail ?? "",
        lat: dest.lat,
        lon: dest.lon,
      });
      if (saved.status === 401) {
        setSaving(false);
        setToast(t("favoritePlaceLoginRequired"));
        return;
      }
      if (!saved.storeplaceUuid) {
        setSaving(false);
        setToast(t("mapCreateLocationFailed"));
        return;
      }
      storeplaceUuid = saved.storeplaceUuid;
      setDest({ ...dest, storeplaceUuid });
    }
    const res = await api("/api/v1/nearwake/favoriteplace", {
      method: "POST",
      body: JSON.stringify({
        favoritePlaceName: name,
        storeplaceUuid,
      }),
    });
    setSaving(false);
    if (res.status === 401) {
      setToast(t("favoritePlaceLoginRequired"));
      return;
    }
    if (res.status === 409) {
      setToast(t("favoritePlaceAlreadySaved"));
      return;
    }
    if (res.body.isSuccess) {
      setNamingFavorite(false);
      setFavoriteName("");
    }
    setToast(res.body.isSuccess ? t("favoritePlaceSaved") : t("favoritePlaceSaveFailed"));
  }

  async function toggleTracking() {
    if (startingRef.current) return;
    if (!dest) {
      setToast(t("mapNeedDestToTrack"));
      return;
    }
    if (tracking.active) {
      tracking.stop();
      return;
    }
    startingRef.current = true;
    setStarting(true);
    try {
      await requestAlarmPermission();
      const usage = await peekFeatureUsage("nearwake");
      if (usage && usage.remaining <= 0) {
        setToast(t("planQuotaExceededNearwake"));
        return;
      }
      const allowedRadius = snapNearwakeRadius(radiusMeters, planCode);
      setRadiusMeters(allowedRadius);
      tracking.start({
        dest: {
          lat: dest.lat,
          lon: dest.lon,
          name: dest.name,
          detail: dest.detail,
          storeplaceUuid: dest.storeplaceUuid,
          fromFavorite,
        },
        radiusMeters: allowedRadius,
        notifyOnExit,
      });
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }

  const subtitle = !dest
    ? t("nearwakeLead")
    : tracking.active
      ? t("mapTrackingSubtitle")
      : t("mapReadySubtitle");

  return (
    <main className="mx-auto flex h-dvh w-full max-w-[430px] flex-col bg-white">
      <header className="flex items-center px-1 pt-2">
        <Link
          href="/nearwake"
          aria-label="Back"
          className="inline-flex h-11 w-11 items-center justify-center text-[#1B2430]"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2.2} />
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="text-[18px] font-bold leading-tight text-[#1B2430]">{t("nearAlarm")}</h1>
          <p className="mt-0.5 text-[13px] text-[#8B95A1]">{subtitle}</p>
        </div>
        <Link
          href="/settings/notifications"
          aria-label={t("mapSettings")}
          className="inline-flex h-11 w-11 items-center justify-center text-[#1B2430]"
        >
          <Settings className="h-[22px] w-[22px]" strokeWidth={1.8} />
        </Link>
      </header>

      {error ? (
        <p className="mx-4 mb-2 rounded-xl bg-[#FFF1F4] px-3 py-2 text-center text-sm text-[#C33E83]">
          {error}
        </p>
      ) : null}

      {dest ? (
        <div className="mx-4 mb-3 flex items-center gap-3 rounded-[22px] bg-white px-4 py-3 shadow-[0_-8px_24px_rgba(40,80,140,0.08),0_8px_24px_rgba(40,80,140,0.08)]">
          <MapPin className="h-6 w-6 shrink-0 text-[#FF4D6D]" fill="#FF4D6D" strokeWidth={1.6} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-bold text-[#1B2430]">{dest.name}</p>
            {dest.detail ? <p className="mt-0.5 truncate text-[13px] text-[#8B95A1]">{dest.detail}</p> : null}
          </div>
          <button
            type="button"
            aria-label={t("mapClearDestination")}
            onClick={clearDestination}
            className="inline-flex h-8 w-8 items-center justify-center text-[#C5CDD6]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <div className="mx-4 mb-3">
          <div className="flex items-center gap-3 rounded-[22px] bg-white px-4 py-3.5 shadow-[0_8px_24px_rgba(40,80,140,0.08)]">
            <MapPin className="h-5 w-5 shrink-0 text-[#3B82F6]" aria-hidden />
            <div className="min-w-0 flex-1">
              <PlaceSearch
                value={query}
                onChange={setQuery}
                onResolved={(place) => void onPlaceResolved(place)}
                placeholder={t("mapSearchHint")}
                showInlineStatus={false}
              />
            </div>
          </div>
          <p className="mt-2 px-1 text-[13px] text-[#A8B0BA]">{t("mapLongPressHint")}</p>
        </div>
      )}

      <div className="relative mx-4 mb-3 min-h-0 flex-1 overflow-hidden rounded-[22px]">
        <NearwakeLeafletMap
          gps={gps}
          dest={destPoint}
          destName={dest?.name}
          radiusMeters={radius}
          onLongPress={onMapLongPress}
          recenterToken={recenterToken}
          overviewToken={overviewToken}
          compassToken={compassToken}
        />
        {!gps && !error ? (
          <div className="pointer-events-none absolute inset-x-0 top-4 z-10 text-center text-sm font-medium text-[#29292E]">
            {t("mapWaitingGps")}
          </div>
        ) : null}
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-2.5">
          <MapToolButton label={t("mapRouteOverview")} onClick={() => setOverviewToken((n) => n + 1)}>
            <Navigation className="h-5 w-5" strokeWidth={1.8} />
          </MapToolButton>
          <MapToolButton label={t("mapCompass")} onClick={() => setCompassToken((n) => n + 1)}>
            <Compass className="h-5 w-5" strokeWidth={1.8} />
          </MapToolButton>
          <MapToolButton label={t("mapMyLocation")} onClick={() => setRecenterToken((n) => n + 1)}>
            <Crosshair className="h-5 w-5" strokeWidth={1.8} />
          </MapToolButton>
        </div>
      </div>

      {dest ? (
        <section className="relative z-20 rounded-t-[28px] bg-white px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(20,40,80,0.08)]">
          <div className="flex items-stretch">
            <div className="flex min-w-0 flex-1 items-stretch gap-3 pr-4">
              <span className="flex aspect-square h-full shrink-0 items-center justify-center rounded-full bg-[#EAF2FF] text-[#3B82F6]">
                <Car className="h-[52%] w-[52%]" strokeWidth={1.8} aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] text-[#8B95A1]">{t("mapArriveIn")}</p>
                <p className="text-[32px] font-bold leading-none text-[#16A34A]">{straightLabel || "—"}</p>
                <p className="mt-1 text-[11px] leading-tight text-[#C5CDD6]">{t("mapStraightHint")}</p>
              </div>
            </div>
            <div className="w-px shrink-0 bg-[#E6EAF0]" />
            <div className="flex w-[132px] shrink-0 flex-col items-center pl-4 text-center">
              <p className="text-[12px] text-[#8B95A1]">{t("mapNotifyWhenLeft")}</p>
              <Bell className="mt-1.5 h-5 w-5 text-[#3B82F6]" strokeWidth={1.8} aria-hidden />
              <p className="mt-1 text-[18px] font-bold leading-none text-[#3B82F6]">
                {formatAlarmRadius(radius, t("taxiFareKm"), t("mapRadiusMeters"))}
              </p>
            </div>
          </div>

          <RadiusStops
            value={radius}
            maxMeters={maxRadius}
            kmLabel={t("taxiFareKm")}
            mLabel={t("mapRadiusMeters")}
            onChange={chooseRadius}
          />

          <button
            type="button"
            disabled={starting}
            aria-busy={starting}
            onClick={() => void toggleTracking()}
            className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-[16px] font-semibold text-white disabled:opacity-70 ${
              tracking.active
                ? "bg-gradient-to-r from-[#FF8A96] to-[#FF5C6C] shadow-[0_8px_18px_rgba(255,92,108,0.28)]"
                : "bg-[#3B82F6] shadow-[0_8px_18px_rgba(59,130,246,0.28)]"
            }`}
          >
            {starting ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : tracking.active ? (
              <span className="h-2.5 w-2.5 rounded-full bg-white" aria-hidden />
            ) : null}
            {starting ? t("mapStartingTracking") : tracking.active ? t("mapStopTracking") : t("mapStartTracking")}
          </button>

          {fromFavorite ? null : namingFavorite ? (
            <form
              className="mt-3"
              onSubmit={(event) => {
                event.preventDefault();
                void saveFavorite();
              }}
            >
              <input
                value={favoriteName}
                onChange={(event) => setFavoriteName(event.target.value)}
                placeholder={t("mapFavoriteNameHint")}
                aria-label={t("mapFavoriteNameHint")}
                maxLength={150}
                autoFocus
                className="mb-2 w-full rounded-full border border-[#E6EAF0] bg-white px-4 py-3 text-[15px] text-[#1B2430] outline-none"
              />
              <button
                type="submit"
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#3B82F6] py-3.5 text-[16px] font-semibold text-[#3B82F6] disabled:opacity-60"
              >
                <Star className="h-4 w-4" fill="currentColor" aria-hidden />
                {t("mapSaveFavoriteAction")}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={beginSaveFavorite}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#3B82F6] py-3.5 text-[16px] font-semibold text-[#3B82F6]"
            >
              <Star className="h-4 w-4" fill="currentColor" aria-hidden />
              {t("mapSaveFavoriteAction")}
            </button>
          )}
        </section>
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-30 max-w-[90vw] -translate-x-1/2 rounded-full bg-[#29292E] px-4 py-2 text-center text-sm text-white">
          {toast}
        </div>
      ) : null}
    </main>
  );
}

function MapToolButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#3A4350] shadow-[0_6px_16px_rgba(20,40,80,0.14)]"
    >
      {children}
    </button>
  );
}

function RadiusStops({
  value,
  maxMeters,
  kmLabel,
  mLabel,
  onChange,
}: {
  value: number;
  maxMeters: number;
  kmLabel: string;
  mLabel: string;
  onChange: (meters: number) => void;
}) {
  const stops = NEARWAKE_RADIUS_STOPS_METERS;
  const trackRef = useRef<HTMLDivElement>(null);
  const index = Math.max(0, stops.indexOf(value as (typeof stops)[number]));
  const pct = (index / (stops.length - 1)) * 100;

  function stopFromClientX(clientX: number) {
    const el = trackRef.current;
    if (!el) return stops[0];
    const rect = el.getBoundingClientRect();
    const ratio = rect.width <= 0 ? 0 : Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const rawIndex = Math.round(ratio * (stops.length - 1));
    return stops[rawIndex] ?? stops[0];
  }

  function pick(clientX: number) {
    onChange(stopFromClientX(clientX));
  }

  return (
    <div className="mt-4 px-1">
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-valuemin={stops[0]}
        aria-valuemax={stops[stops.length - 1]}
        aria-valuenow={value}
        aria-orientation="horizontal"
        className="relative h-8 cursor-pointer touch-none"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          pick(event.clientX);
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          pick(event.clientX);
        }}
        onKeyDown={(event) => {
          const current = Math.max(0, stops.indexOf(value as (typeof stops)[number]));
          if (event.key === "ArrowRight" || event.key === "ArrowUp") {
            event.preventDefault();
            const next = stops[Math.min(stops.length - 1, current + 1)];
            if (next != null) onChange(next);
          }
          if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
            event.preventDefault();
            const next = stops[Math.max(0, current - 1)];
            if (next != null) onChange(next);
          }
        }}
      >
        <div className="absolute top-1/2 right-0 left-0 h-[3px] -translate-y-1/2 rounded-full bg-[#E6EAF0]" />
        <div
          className="absolute top-1/2 left-0 h-[3px] -translate-y-1/2 rounded-full bg-[#3B82F6]"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-[#3B82F6] shadow-[0_2px_8px_rgba(59,130,246,0.45)]"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="relative mt-1 h-6">
        {stops.map((stop, stopIndex) => {
          const allowed = stop <= maxMeters;
          const selected = stop === value;
          return (
            <button
              key={stop}
              type="button"
              onClick={() => onChange(stop)}
              className={`absolute -translate-x-1/2 text-[12px] ${
                selected ? "font-bold text-[#3B82F6]" : allowed ? "text-[#8B95A1]" : "text-[#D5DBE3]"
              }`}
              style={{ left: `${(stopIndex / (stops.length - 1)) * 100}%` }}
            >
              {formatAlarmRadius(stop, kmLabel, mLabel)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
