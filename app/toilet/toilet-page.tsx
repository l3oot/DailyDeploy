"use client";

import { useEffect, useMemo, useState } from "react";
import { BANGKOK } from "@/lib/leaflet";
import { isGuest } from "@/lib/guest";
import { useI18n } from "@/lib/i18n/provider";
import { openHoursForPayload } from "@/lib/open-hours";
import {
  createToiletLocation,
  fetchToiletLocation,
  fetchToiletLocations,
  type ToiletBounds,
  type ToiletLocation,
} from "@/lib/toilets";
import {
  emptyAmenityFlags,
  emptyToiletDraft,
  ToiletBrowse,
  ToiletDetail,
  ToiletForm,
  toiletDistance,
  type AmenityFlags,
  type AmenityKey,
  type ToiletDraft,
} from "@/components/toilet-screens";

type MapPoint = { lat: number; lng: number };
type View = "browse" | "detail" | "form";

const SAVED_KEY = "ndaily.toilet.saved.v1";

function readSaved() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SAVED_KEY) || "[]");
    if (!Array.isArray(raw)) return new Set<string>();
    return new Set(raw.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set<string>();
  }
}

export default function ToiletPage() {
  const { t } = useI18n();
  const [view, setView] = useState<View>("browse");
  const [query, setQuery] = useState("");
  const [placeFilter, setPlaceFilter] = useState("all");
  const [amenityFilter, setAmenityFilter] = useState<AmenityFlags>(emptyAmenityFlags);
  const [gps, setGps] = useState<MapPoint | null>(null);
  const [toilets, setToilets] = useState<ToiletLocation[]>([]);
  const [bounds, setBounds] = useState<ToiletBounds | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [focus, setFocus] = useState<{ point: MapPoint; zoom: number } | null>(null);
  const [recenterToken, setRecenterToken] = useState(0);
  const [selected, setSelected] = useState<ToiletLocation | null>(null);
  const [draft, setDraft] = useState<ToiletDraft>(emptyToiletDraft);
  const [pin, setPin] = useState<MapPoint | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [guest, setGuestState] = useState(false);

  useEffect(() => {
    setGuestState(isGuest());
    setSaved(readSaved());
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 4000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  useEffect(() => {
    if (!bounds) return;
    const id = window.setTimeout(() => {
      void fetchToiletLocations(bounds).then(setToilets);
    }, 280);
    return () => window.clearTimeout(id);
  }, [bounds, refreshToken]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(id);
  }, [toast]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = toilets.filter((row) => {
      if (placeFilter !== "all" && row.placeType !== placeFilter) return false;
      if (q && !`${row.placeToilet} ${row.addressToilet}`.toLowerCase().includes(q)) return false;
      if (amenityFilter.clean && !row.cleanToilet) return false;
      if (amenityFilter.free && !row.freeToilet) return false;
      if (amenityFilter.accessible && !row.accessibleToilet) return false;
      if (amenityFilter.attendant && !row.attendantToilet) return false;
      return true;
    });
    if (!gps) return rows;
    return rows
      .slice()
      .sort((a, b) => (toiletDistance(gps, a) ?? 0) - (toiletDistance(gps, b) ?? 0));
  }, [toilets, query, placeFilter, amenityFilter, gps]);

  function mapCenter() {
    if (bounds) {
      return {
        lat: (bounds.minLat + bounds.maxLat) / 2,
        lng: (bounds.minLng + bounds.maxLng) / 2,
      };
    }
    if (gps) return gps;
    return { lat: BANGKOK[0], lng: BANGKOK[1] };
  }

  function toggleAmenity(key: AmenityKey) {
    setAmenityFilter((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function toggleSaved(toiletUuid: string) {
    const removing = saved.has(toiletUuid);
    const next = new Set(saved);
    if (removing) next.delete(toiletUuid);
    else next.add(toiletUuid);
    setSaved(next);
    window.localStorage.setItem(SAVED_KEY, JSON.stringify([...next]));
    setToast(removing ? t("toiletUnbookmarked") : t("toiletBookmarked"));
  }

  function openToilet(toiletUuid: string) {
    const found = toilets.find((row) => row.toiletUuid === toiletUuid);
    if (!found) return;
    setSelected(found);
    setView("detail");
    void fetchToiletLocation(toiletUuid).then((full) => {
      if (!full) return;
      setSelected((current) => (current?.toiletUuid === toiletUuid ? full : current));
    });
  }

  function openForm() {
    setDraft(emptyToiletDraft());
    setPin(mapCenter());
    setFormError("");
    setView("form");
  }

  async function onShare() {
    if (!selected) return;
    const url = `https://www.google.com/maps?q=${selected.latitudeToilet},${selected.longitudeToilet}`;
    const text = [selected.placeToilet, selected.addressToilet, url].filter(Boolean).join("\n");
    try {
      if (navigator.share) {
        await navigator.share({ title: selected.placeToilet, text, url });
        return;
      }
      await navigator.clipboard.writeText(text);
      setToast(t("toiletShareCopied"));
    } catch {
      /* dismissed */
    }
  }

  async function onSave() {
    const place = draft.placeToilet.trim();
    if (!place) {
      setFormError(t("toiletPlaceRequired"));
      return;
    }
    if (!draft.placeType) {
      setFormError(t("toiletTypeRequired"));
      return;
    }
    const address = draft.addressToilet.trim();
    if (!address) {
      setFormError(t("toiletAddressRequired"));
      return;
    }
    if (!pin) return;
    if (guest) {
      setFormError(t("toiletGuestSaveBlocked"));
      return;
    }
    const hours = openHoursForPayload(draft.openHoursToilet);
    if (hours == null) {
      setFormError(t("toiletHoursInvalid"));
      return;
    }
    setSaving(true);
    setFormError("");
    const result = await createToiletLocation({
      placeToilet: place,
      placeType: draft.placeType,
      addressToilet: address,
      cleanToilet: draft.cleanToilet,
      freeToilet: draft.freeToilet,
      accessibleToilet: draft.accessibleToilet,
      attendantToilet: draft.attendantToilet,
      diaperToilet: draft.diaperToilet,
      genderSplitToilet: draft.genderSplitToilet,
      tissueToilet: draft.tissueToilet,
      paperToilet: draft.paperToilet,
      photosToilet: draft.photosToilet,
      latitudeToilet: pin.lat,
      longitudeToilet: pin.lng,
      openHoursToilet: hours || null,
    });
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
    setView("browse");
    setToast(result.message || t("toiletSaveSuccess"));
    setRefreshToken((n) => n + 1);
  }

  return (
    <main
      className={
        view === "browse" ? "h-dvh overflow-hidden bg-[#F4F7FB]" : "relative min-h-dvh bg-[#F4F7FB]"
      }
    >
      <div className={view === "browse" ? "h-full" : "hidden"}>
        <ToiletBrowse
          query={query}
          onQueryChange={setQuery}
          onPlaceResolved={(point) => {
            setQuery("");
            setFocus({ point, zoom: 16 });
          }}
          placeFilter={placeFilter}
          onPlaceFilter={setPlaceFilter}
          amenityFilter={amenityFilter}
          onToggleAmenity={toggleAmenity}
          gps={gps}
          toilets={visible}
          saved={saved}
          onToggleSaved={toggleSaved}
          onOpen={openToilet}
          onSearchArea={() => setRefreshToken((n) => n + 1)}
          onAdd={openForm}
          onRecenter={() => {
            if (!gps) {
              setToast(t("toiletGpsFailed"));
              return;
            }
            setRecenterToken((n) => n + 1);
          }}
          focus={focus}
          recenterToken={recenterToken}
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
          active={view === "browse"}
        />
      </div>
      {view === "detail" && selected ? (
        <ToiletDetail
          toilet={selected}
          gps={gps}
          saved={saved.has(selected.toiletUuid)}
          onBack={() => setView("browse")}
          onToggleSaved={() => toggleSaved(selected.toiletUuid)}
          onShare={() => void onShare()}
        />
      ) : null}
      {view === "form" && pin ? (
        <ToiletForm
          values={draft}
          onChange={setDraft}
          pin={pin}
          onPin={setPin}
          onClose={() => setView("browse")}
          onSave={() => void onSave()}
          saving={saving}
          error={formError}
          onPhotoError={setFormError}
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
