"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { NearwakeLeafletMap } from "@/components/nearwake-leaflet-map";
import { PageBack } from "@/components/page-back";
import { PlaceSearch } from "@/components/place-search";
import { api } from "@/lib/api";
import { distanceMeters, formatAlarmRadius, formatDistanceMeters } from "@/lib/geofence";
import { isGuest } from "@/lib/guest";
import { useI18n } from "@/lib/i18n/provider";
import { requestAlarmPermission } from "@/lib/near-alarm";
import { fetchPlanOverview, peekFeatureUsage } from "@/lib/plan-api";
import {
  clampNearwakeRadius,
  NEARWAKE_RADIUS_DEFAULT_METERS,
  NEARWAKE_RADIUS_MIN_METERS,
  NEARWAKE_RADIUS_STEP_METERS,
  nearwakeRadiusMaxMeters,
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
  const params = useSearchParams();
  const tracking = useTracking();
  const [query, setQuery] = useState("");
  const [dest, setDest] = useState<ResolvedPlace | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [favoriteName, setFavoriteName] = useState("");
  const [radiusMeters, setRadiusMeters] = useState(NEARWAKE_RADIUS_DEFAULT_METERS);
  const [planCode, setPlanCode] = useState<PlanCode>("free");
  const [notifyOnExit, setNotifyOnExit] = useState(false);
  const [recenterToken, setRecenterToken] = useState(0);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const gps = tracking.gps;

  useEffect(() => {
    const lat = Number(params.get("lat"));
    const lng = Number(params.get("lng"));
    const name = params.get("name")?.trim() || "";
    const storeplaceUuid = params.get("storeplaceUuid")?.trim() || undefined;
    if (Number.isFinite(lat) && Number.isFinite(lng) && name) {
      setDest({ lat, lon: lng, name, source: "nearwake", storeplaceUuid });
      setQuery("");
      setFavoriteName(name);
    }
  }, [params]);

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
      if (isGuest()) {
        if (!cancelled) setPlanCode("free");
        return;
      }
      const overview = await fetchPlanOverview();
      if (cancelled) return;
      setPlanCode(overview?.mine?.planCode ?? "free");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const maxRadius = nearwakeRadiusMaxMeters(planCode);
  const planLabel =
    planCode === "plus" ? t("planNamePlus") : planCode === "pro" ? t("planNamePro") : t("planNameFree");

  useEffect(() => {
    if (tracking.active) return;
    setRadiusMeters((current) => clampNearwakeRadius(current, planCode));
  }, [planCode, tracking.active]);

  useEffect(() => {
    if (!tracking.active || !tracking.dest || dest) return;
    setDest({
      lat: tracking.dest.lat,
      lon: tracking.dest.lon,
      name: tracking.dest.name,
      source: "nearwake",
      storeplaceUuid: tracking.dest.storeplaceUuid,
    });
    setFavoriteName(tracking.dest.name);
    setRadiusMeters(tracking.radiusMeters);
    setNotifyOnExit(tracking.notifyOnExit);
  }, [tracking.active, tracking.dest, tracking.radiusMeters, tracking.notifyOnExit, dest]);

  const destPoint = dest ? { lat: dest.lat, lng: dest.lon } : null;
  const liveMeters = gps && destPoint ? distanceMeters(gps, destPoint) : tracking.metersAway;

  function applyDestination(place: ResolvedPlace) {
    if (tracking.active) tracking.stop();
    setDest(place);
    setQuery("");
    setFavoriteName(place.name);
  }

  async function onPlaceResolved(place: ResolvedPlace) {
    applyDestination(place);
    if (place.source === "longdo") setToast(t("mapResolvedWithLongdo"));
    if (place.source === "google") setToast(t("mapResolvedWithGoogle"));
    if (place.source === "nearwake") setToast(t("mapResolvedFromNearwake"));
  }

  function onMapLongPress(point: { lat: number; lng: number }) {
    applyDestination({
      lat: point.lat,
      lon: point.lng,
      name: `${t("mapPickedLocation")} (${point.lat.toFixed(5)}, ${point.lng.toFixed(5)})`,
      source: "nearwake",
    });
  }

  async function saveFavorite() {
    if (!dest) {
      setToast(t("mapFavoriteNeedDest"));
      return;
    }
    const name = favoriteName.trim() || dest.name;
    if (!name) {
      setToast(t("mapFavoriteNeedName"));
      return;
    }
    setSaving(true);
    let storeplaceUuid = dest.storeplaceUuid;
    if (!storeplaceUuid) {
      const saved = await persistStorePlace({
        placeName: dest.name,
        placeDetail: "",
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
      const allowedRadius = clampNearwakeRadius(radiusMeters, planCode);
      setRadiusMeters(allowedRadius);
      tracking.start({
        dest: {
          lat: dest.lat,
          lon: dest.lon,
          name: dest.name,
          storeplaceUuid: dest.storeplaceUuid,
        },
        radiusMeters: allowedRadius,
        notifyOnExit,
      });
    } finally {
      startingRef.current = false;
      setStarting(false);
    }
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#FFF8F0]">
      <div className="absolute inset-0">
        <NearwakeLeafletMap
          gps={gps}
          dest={destPoint}
          destName={dest?.name}
          radiusMeters={radiusMeters}
          onLongPress={onMapLongPress}
          recenterToken={recenterToken}
        />
        {!gps && !error ? (
          <div className="pointer-events-none absolute inset-x-0 top-20 z-10 text-center text-sm font-medium text-[#29292E]">
            {t("mapWaitingGps")}
          </div>
        ) : null}
        {error ? (
          <div className="absolute inset-x-4 top-20 z-10 rounded-xl bg-white/90 px-3 py-2 text-center text-sm text-[#C33E83]">
            {error}
          </div>
        ) : null}
        {!dest ? (
          <div className="absolute inset-x-4 bottom-4 z-10 rounded-xl border border-[#E5E5EA] bg-white/95 px-3 py-2 text-center text-xs font-medium text-[#8E8E93] shadow-sm">
            {t("mapLongPressHint")}
          </div>
        ) : null}
      </div>

      <div className="absolute inset-x-0 top-0 z-20 flex items-center gap-1 px-2 pt-2">
        <PageBack href="/nearwake" />
        <div className="flex h-10 min-w-0 flex-1 items-center rounded-xl border border-[#E5E5EA] bg-white px-3 shadow-sm">
          <PlaceSearch
            value={query}
            onChange={setQuery}
            onResolved={(place) => void onPlaceResolved(place)}
            placeholder={t("mapSearchHint")}
            showInlineStatus={false}
          />
        </div>
        <button
          type="button"
          aria-label={t("mapMyLocation")}
          onClick={() => setRecenterToken((n) => n + 1)}
          className="mr-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z"
              stroke="#29292E"
              strokeWidth="1.8"
            />
            <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21" stroke="#29292E" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {dest ? (
        <section className="absolute inset-x-0 bottom-0 z-20 max-h-[58vh] overflow-y-auto rounded-t-3xl bg-[#FFF8F0] px-5 pb-5 pt-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
          <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-[#D1D5DB]" />
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-[#29292E]">{dest.name}</p>
              {liveMeters != null ? (
                <p className="text-xs text-[#8E8E93]">
                  {t("trackingDistanceShort")}: {formatDistanceMeters(liveMeters, t("taxiFareKm"), t("mapRadiusMeters"))}
                </p>
              ) : null}
            </div>
            {tracking.active ? (
              <span className="shrink-0 rounded-full bg-[#ECECFF] px-2.5 py-1 text-xs font-semibold text-[#4A89EA]">
                {t("mapTrackingActive")}
              </span>
            ) : null}
          </div>

          <label className="block text-sm font-semibold text-[#29292E]">
            {t("mapAlarmRadius")}:{" "}
            {formatAlarmRadius(radiusMeters, t("taxiFareKm"), t("mapRadiusMeters"))}
          </label>
          <input
            type="range"
            min={NEARWAKE_RADIUS_MIN_METERS}
            max={tracking.active ? Math.max(maxRadius, radiusMeters) : maxRadius}
            step={NEARWAKE_RADIUS_STEP_METERS}
            value={radiusMeters}
            disabled={tracking.active || starting}
            onChange={(e) => setRadiusMeters(clampNearwakeRadius(Number(e.target.value), planCode))}
            className="mt-1 w-full accent-[#29292E]"
          />
          <div className="mb-3 flex justify-between text-xs text-[#8E8E93]">
            <span>
              {formatAlarmRadius(NEARWAKE_RADIUS_MIN_METERS, t("taxiFareKm"), t("mapRadiusMeters"))}
            </span>
            <span>
              {planLabel} {formatAlarmRadius(maxRadius, t("taxiFareKm"), t("mapRadiusMeters"))}
            </span>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={tracking.active || starting}
              onClick={() => setNotifyOnExit(false)}
              className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                !notifyOnExit ? "bg-[#E5E7EB] text-[#29292E]" : "bg-white text-[#8E8E93]"
              }`}
            >
              {t("mapNotifyEnter")}
            </button>
            <button
              type="button"
              disabled={tracking.active || starting}
              onClick={() => setNotifyOnExit(true)}
              className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                notifyOnExit ? "bg-[#E5E7EB] text-[#29292E]" : "bg-white text-[#8E8E93]"
              }`}
            >
              {t("mapNotifyExit")}
            </button>
          </div>

          <form
            className="mb-3 flex items-center gap-2 rounded-xl border border-[#E5E5EA] bg-white py-1.5 pr-1.5 pl-3"
            onSubmit={(e) => {
              e.preventDefault();
              void saveFavorite();
            }}
          >
            <input
              value={favoriteName}
              onChange={(e) => setFavoriteName(e.target.value)}
              placeholder={t("mapFavoriteNameHint")}
              className="min-w-0 flex-1 bg-transparent py-2 text-[15px]"
            />
            <button
              type="submit"
              disabled={saving}
              aria-label={t("saveFavoritePlace")}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#C33E83] text-lg leading-none text-white shadow-[0_2px_8px_rgba(195,62,131,0.28)] transition active:scale-95 disabled:opacity-50"
            >
              ♥
            </button>
          </form>

          <button
            type="button"
            disabled={starting}
            aria-busy={starting}
            onClick={() => void toggleTracking()}
            className={`relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl py-3.5 text-base font-semibold text-white disabled:opacity-70 ${
              tracking.active ? "bg-[#DC2626]" : "bg-[#29292E]"
            }`}
          >
            {starting ? (
              <>
                <span
                  className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
                  aria-hidden
                />
                {t("mapStartingTracking")}
              </>
            ) : tracking.active ? (
              t("mapStopTracking")
            ) : (
              t("mapStartTracking")
            )}
          </button>
          <p className="mt-2 text-center text-[11px] text-[#8E8E93]">{t("mapKeepTabOpen")}</p>
        </section>
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-full bg-[#29292E] px-4 py-2 text-sm text-white">
          {toast}
        </div>
      ) : null}
    </main>
  );
}
