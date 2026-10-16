"use client";

import { useEffect, useState } from "react";
import { PageBack } from "@/components/page-back";
import { PlaceSearch } from "@/components/place-search";
import {
  emptyToiletForm,
  formFromToilet,
  ToiletFormSheet,
  type ToiletFormValues,
} from "@/components/toilet-sheets";
import { ToiletLeafletMap } from "@/components/toilet-leaflet-map";
import { isGuest } from "@/lib/guest";
import { useI18n } from "@/lib/i18n/provider";
import { openHoursForPayload } from "@/lib/open-hours";
import {
  createToiletLocation,
  fetchToiletLocations,
  updateToiletLocation,
  type ToiletBounds,
  type ToiletLocation,
} from "@/lib/toilets";

type MapPoint = { lat: number; lng: number };

export default function ToiletPage() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [gps, setGps] = useState<MapPoint | null>(null);
  const [gpsError, setGpsError] = useState("");
  const [toilets, setToilets] = useState<ToiletLocation[]>([]);
  const [draft, setDraft] = useState<MapPoint | null>(null);
  const [form, setForm] = useState<ToiletFormValues>(emptyToiletForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<ToiletLocation | null>(null);
  const [bounds, setBounds] = useState<ToiletBounds | null>(null);
  const [focus, setFocus] = useState<{ point: MapPoint; zoom: number } | null>(null);
  const [recenterToken, setRecenterToken] = useState(0);
  const [toast, setToast] = useState("");
  const [guest, setGuestState] = useState(false);

  useEffect(() => {
    setGuestState(isGuest());
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError(t("mapGpsDenied"));
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsError("");
      },
      () => setGpsError(t("mapGpsDenied")),
      { enableHighAccuracy: true, maximumAge: 4000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [t]);

  useEffect(() => {
    if (!bounds) return;
    const id = window.setTimeout(() => {
      void fetchToiletLocations(bounds).then(setToilets);
    }, 280);
    return () => window.clearTimeout(id);
  }, [bounds]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  function closeForm() {
    setDraft(null);
    setSelected(null);
    setForm(emptyToiletForm());
    setFormError("");
    setSaving(false);
  }

  function onLongPress(point: MapPoint) {
    if (typeof navigator.vibrate === "function") navigator.vibrate(30);
    setSelected(null);
    setDraft(point);
    setForm(emptyToiletForm());
    setFormError("");
  }

  function onToiletClick(toiletUuid: string) {
    const found = toilets.find((row) => row.toiletUuid === toiletUuid);
    if (!found) return;
    setDraft(null);
    setFormError("");
    setSaving(false);
    setForm(formFromToilet(found));
    setSelected(found);
    setFocus({
      point: { lat: found.latitudeToilet, lng: found.longitudeToilet },
      zoom: 17,
    });
  }

  async function onSave() {
    const place = form.placeToilet.trim();
    if (!place) {
      setFormError(t("toiletPlaceRequired"));
      return;
    }
    if (guest) {
      setFormError(t("toiletGuestSaveBlocked"));
      return;
    }
    if (!draft && !selected) return;
    const hours = openHoursForPayload(form.openHoursToilet);
    if (hours == null) {
      setFormError(t("toiletHoursInvalid"));
      return;
    }
    setSaving(true);
    setFormError("");
    const payload = {
      placeToilet: place,
      cleanScoreToilet: form.cleanStars,
      bidetToilet: form.bidetToilet,
      priceToilet: Number.parseInt(form.priceToilet.trim(), 10) || 0,
      quantityToilet: Number.parseInt(form.quantityToilet.trim(), 10) || 0,
      avgScoreToilet: form.avgStars,
      commentToilet: form.commentToilet.trim() || null,
      latitudeToilet: selected?.latitudeToilet ?? draft!.lat,
      longitudeToilet: selected?.longitudeToilet ?? draft!.lng,
      statusToilet: form.statusToilet,
      safeToilet: form.safeStars,
      openHoursToilet: hours,
    };
    const result = selected
      ? await updateToiletLocation({ ...payload, toiletUuid: selected.toiletUuid })
      : await createToiletLocation(payload);
    setSaving(false);
    if (result.status === 401) {
      setFormError(t("toiletGuestSaveBlocked"));
      return;
    }
    if (result.status === 404) {
      setFormError(t("toiletUserRequired"));
      return;
    }
    if (!result.ok) {
      setFormError(result.message || t("toiletSaveFailed"));
      return;
    }
    closeForm();
    setToast(result.message || t("toiletSaveSuccess"));
    if (bounds) setToilets(await fetchToiletLocations(bounds));
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#FFF8F0]">
      <div className="absolute inset-0">
        <ToiletLeafletMap
          gps={gps}
          toilets={toilets.map((row) => ({
            toiletUuid: row.toiletUuid,
            lat: row.latitudeToilet,
            lng: row.longitudeToilet,
          }))}
          draft={draft}
          onLongPress={onLongPress}
          onToiletClick={onToiletClick}
          onBoundsChange={(next) => {
            setBounds((prev) =>
              prev &&
              prev.minLat === next.minLat &&
              prev.maxLat === next.maxLat &&
              prev.minLng === next.minLng &&
              prev.maxLng === next.maxLng
                ? prev
                : next,
            );
          }}
          focus={focus}
          recenterToken={recenterToken}
        />
      </div>

      <div className="absolute inset-x-0 top-0 z-20 flex items-start gap-1 px-2 pt-2">
        <PageBack href="/home" />
        <div className="min-w-0 flex-1 rounded-xl border border-[#E5E5EA] bg-white px-3.5 py-2 shadow-sm">
          <PlaceSearch
            value={query}
            onChange={setQuery}
            placeholder={t("toiletSearchHint")}
            onResolved={(place) => {
              setQuery("");
              const point = { lat: place.lat, lng: place.lon };
              setSelected(null);
              setFocus({ point, zoom: 16 });
              if (place.source === "longdo") setToast(t("mapResolvedWithLongdo"));
              if (place.source === "google") setToast(t("mapResolvedWithGoogle"));
            }}
          />
        </div>
        <button
          type="button"
          aria-label={t("mapMyLocation")}
          onClick={() => {
            if (!gps) {
              setToast(t("toiletGpsFailed"));
              return;
            }
            setSelected(null);
            setRecenterToken((n) => n + 1);
          }}
          className="mr-1 mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-sm"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7Z"
              stroke="#29292E"
              strokeWidth="1.8"
            />
            <path
              d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21"
              stroke="#29292E"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {gpsError && !gps ? (
        <div className="absolute inset-x-4 top-20 z-10 rounded-xl bg-white/90 px-3 py-2 text-center text-sm text-[#C33E83]">
          {gpsError}
        </div>
      ) : null}

      {!draft && !selected ? (
        <div className="absolute inset-x-4 bottom-4 z-10 rounded-xl border border-[#E5E5EA] bg-white/95 px-3 py-2 text-center text-xs font-medium text-[#8E8E93] shadow-sm">
          {t("toiletNearbyHint")}
          <span className="mt-1 block">{t("toiletLongPressHint")}</span>
        </div>
      ) : null}

      {draft || selected ? (
        <ToiletFormSheet
          values={form}
          onChange={setForm}
          onClose={closeForm}
          onSave={() => void onSave()}
          saving={saving}
          error={formError}
          recorderName={selected?.userName}
        />
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-[#29292E] px-4 py-2 text-sm text-white">
          {toast}
        </div>
      ) : null}
    </main>
  );
}
