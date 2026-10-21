"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import {
  Accessibility,
  Baby,
  Bookmark,
  Building2,
  Camera,
  ChevronLeft,
  Clock,
  Fuel,
  Gem,
  LayoutGrid,
  LocateFixed,
  MapPin,
  Search,
  Navigation,
  Plus,
  RotateCw,
  Share2,
  Sparkles,
  ScrollText,
  Star,
  UserRound,
  Users,
  Utensils,
  X,
  type LucideIcon,
} from "lucide-react";
import { PageBack } from "@/components/page-back";
import { PlaceSearch } from "@/components/place-search";
import { ToiletLeafletMap } from "@/components/toilet-leaflet-map";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/messages";
import { OPEN_HOURS_MASK, nextOpenHoursValue } from "@/lib/open-hours";
import { starCountFromStoredScore, type ToiletLocation } from "@/lib/toilets";
import type { MapPoint } from "@/components/toilet-leaflet-map";

export type AmenityKey =
  | "clean"
  | "free"
  | "accessible"
  | "attendant"
  | "diaper"
  | "gender"
  | "tissue"
  | "paper";

export type ToiletDraft = {
  placeToilet: string;
  placeType: string;
  addressToilet: string;
  openHoursToilet: string;
  cleanToilet: boolean;
  freeToilet: boolean;
  accessibleToilet: boolean;
  attendantToilet: boolean;
  diaperToilet: boolean;
  genderSplitToilet: boolean;
  tissueToilet: boolean;
  paperToilet: boolean;
  photosToilet: string[];
};

export type AmenityFlags = Record<AmenityKey, boolean>;

const AMENITIES: AmenityKey[] = [
  "clean",
  "free",
  "accessible",
  "attendant",
  "diaper",
  "gender",
  "tissue",
  "paper",
];

const FILTER_AMENITIES: AmenityKey[] = ["clean", "free", "accessible", "attendant"];

const AMENITY_LABEL: Record<AmenityKey, MessageKey> = {
  clean: "toiletAmenityClean",
  free: "toiletAmenityFree",
  accessible: "toiletAmenityAccessible",
  attendant: "toiletAmenityAttendant",
  diaper: "toiletAmenityDiaper",
  gender: "toiletAmenityGender",
  tissue: "toiletAmenityTissue",
  paper: "toiletAmenityPaper",
};

const AMENITY_ICON: Record<AmenityKey, LucideIcon> = {
  clean: Gem,
  free: Gem,
  accessible: Accessibility,
  attendant: UserRound,
  diaper: Baby,
  gender: Users,
  tissue: Sparkles,
  paper: ScrollText,
};

const PLACE_FILTERS = [
  { id: "all", label: "toiletFilterAll", icon: LayoutGrid },
  { id: "mall", label: "toiletTypeMall", icon: Building2 },
  { id: "gas", label: "toiletTypeGas", icon: Fuel },
  { id: "food", label: "toiletTypeFood", icon: Utensils },
] as const;

const DRAFT_FIELD: Record<AmenityKey, keyof ToiletDraft> = {
  clean: "cleanToilet",
  free: "freeToilet",
  accessible: "accessibleToilet",
  attendant: "attendantToilet",
  diaper: "diaperToilet",
  gender: "genderSplitToilet",
  tissue: "tissueToilet",
  paper: "paperToilet",
};

const LOCATION_FIELD: Record<AmenityKey, keyof ToiletLocation> = {
  clean: "cleanToilet",
  free: "freeToilet",
  accessible: "accessibleToilet",
  attendant: "attendantToilet",
  diaper: "diaperToilet",
  gender: "genderSplitToilet",
  tissue: "tissueToilet",
  paper: "paperToilet",
};

export const emptyAmenityFlags = (): AmenityFlags => ({
  clean: false,
  free: false,
  accessible: false,
  attendant: false,
  diaper: false,
  gender: false,
  tissue: false,
  paper: false,
});

export const emptyToiletDraft = (): ToiletDraft => ({
  placeToilet: "",
  placeType: "",
  addressToilet: "",
  openHoursToilet: OPEN_HOURS_MASK,
  cleanToilet: false,
  freeToilet: false,
  accessibleToilet: false,
  attendantToilet: false,
  diaperToilet: false,
  genderSplitToilet: false,
  tissueToilet: false,
  paperToilet: false,
  photosToilet: [],
});

function haversineMeters(a: MapPoint, b: MapPoint) {
  const R = 6371000;
  const p1 = (a.lat * Math.PI) / 180;
  const p2 = (b.lat * Math.PI) / 180;
  const dLat = p2 - p1;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatToiletDistance(meters: number, locale: "th" | "en") {
  if (meters < 1000) {
    const rounded = Math.max(50, Math.round(meters / 50) * 50);
    return locale === "th" ? `${rounded} ม.` : `${rounded} m`;
  }
  const km = meters / 1000;
  const label = km < 10 ? km.toFixed(1) : String(Math.round(km));
  return locale === "th" ? `${label} กม.` : `${label} km`;
}

export function toiletDistance(gps: MapPoint | null, toilet: ToiletLocation) {
  if (!gps) return null;
  return haversineMeters(gps, { lat: toilet.latitudeToilet, lng: toilet.longitudeToilet });
}

function displayHours(raw: string) {
  const match = raw.trim().match(/^(\d{2}:\d{2})-(\d{2}:\d{2})$/);
  if (!match) return "";
  return `${match[1]}–${match[2]}`;
}

function isOpenAllDay(raw: string) {
  const hours = displayHours(raw);
  return hours === "00:00–23:59" || hours === "00:00–00:00";
}

function amenityOn(toilet: ToiletLocation, key: AmenityKey) {
  return Boolean(toilet[LOCATION_FIELD[key]]);
}

function BackButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-12 w-12 items-center justify-center text-[#29292E]"
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]">
        <ChevronLeft size={18} strokeWidth={2.4} />
      </span>
    </button>
  );
}

function IconBubble({
  icon: Icon,
  label,
  onClick,
  pressed = false,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={onClick ? pressed : undefined}
      onClick={onClick}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] ${
        pressed ? "text-[#4A89EA]" : "text-[#29292E]"
      }`}
    >
      <Icon size={16} className={pressed ? "fill-[#4A89EA]" : ""} />
    </button>
  );
}

function FreeMark() {
  return (
    <span className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border-[1.6px] border-current text-[10px] font-bold leading-none">
      B
    </span>
  );
}

function AmenityGlyph({ name, className }: { name: AmenityKey; className?: string }) {
  if (name === "free") return <FreeMark />;
  const Icon = AMENITY_ICON[name];
  return <Icon className={className} size={16} />;
}

function RequiredLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1.5 block text-sm font-semibold text-[#1F2937]">
      {children}
      <span className="text-[#E11D48]"> *</span>
    </span>
  );
}

const fieldClass =
  "w-full rounded-2xl border border-[#E6EAF0] bg-white px-4 py-3 text-[15px] text-[#1F2937] outline-none";

export function ToiletBrowse({
  query,
  onQueryChange,
  onPlaceResolved,
  placeFilter,
  onPlaceFilter,
  amenityFilter,
  onToggleAmenity,
  gps,
  toilets,
  saved,
  onToggleSaved,
  onOpen,
  onSearchArea,
  onAdd,
  onRecenter,
  focus,
  recenterToken,
  onBoundsChange,
  active = true,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onPlaceResolved: (point: MapPoint) => void;
  placeFilter: string;
  onPlaceFilter: (id: string) => void;
  amenityFilter: AmenityFlags;
  onToggleAmenity: (key: AmenityKey) => void;
  gps: MapPoint | null;
  toilets: ToiletLocation[];
  saved: Set<string>;
  onToggleSaved: (toiletUuid: string) => void;
  onOpen: (toiletUuid: string) => void;
  onSearchArea: () => void;
  onAdd: () => void;
  onRecenter: () => void;
  focus: { point: MapPoint; zoom: number } | null;
  recenterToken: number;
  onBoundsChange: (bounds: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  }) => void;
  active?: boolean;
}) {
  const { t, locale } = useI18n();
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ y: number; height: number } | null>(null);
  const [sheetHeight, setSheetHeight] = useState(300);

  function sheetBounds() {
    const total = rootRef.current?.clientHeight || window.innerHeight;
    const max = Math.max(240, total - 220);
    const peek = Math.min(320, Math.max(220, Math.round(total * 0.4)));
    return { peek: Math.min(peek, max), max };
  }

  useEffect(() => {
    setSheetHeight(sheetBounds().peek);
  }, []);

  function onSheetPointerDown(event: PointerEvent<HTMLDivElement>) {
    dragRef.current = { y: event.clientY, height: sheetHeight };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onSheetPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const { peek, max } = sheetBounds();
    const next = drag.height + (drag.y - event.clientY);
    setSheetHeight(Math.min(max, Math.max(peek, next)));
  }

  function onSheetPointerUp() {
    if (!dragRef.current) return;
    dragRef.current = null;
    const { peek, max } = sheetBounds();
    setSheetHeight((current) => (current > (peek + max) / 2 ? max : peek));
  }

  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F4F7FB]">
      <header className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-1 px-2 pt-2">
        <PageBack href="/home" />
        <div className="min-w-0 text-center">
          <h1 className="truncate text-[17px] font-semibold leading-tight text-[#1F2937]">{t("toiletMapTitle")}</h1>
          <p className="truncate text-xs text-[#8E8E93]">{t("bentoRestroomSubtitle")}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="mr-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-2 text-sm font-semibold text-[#4A89EA] shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
        >
          <Plus size={16} />
          {t("toiletAddAction")}
        </button>
      </header>

      <div className="px-4 pt-2">
        <div className="flex h-11 items-center gap-2 rounded-2xl border border-[#E6EAF0] bg-white px-3 shadow-sm">
          <Search size={16} className="shrink-0 text-[#8E8E93]" />
          <div className="min-w-0 flex-1">
            <PlaceSearch
              value={query}
              onChange={onQueryChange}
              placeholder={t("toiletSearchHint")}
              showInlineStatus={false}
              onResolved={(place) => onPlaceResolved({ lat: place.lat, lng: place.lon })}
            />
          </div>
          <MapPin size={16} className="shrink-0 text-[#4A89EA]" />
        </div>
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {PLACE_FILTERS.map((item) => {
          const selected = placeFilter === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onPlaceFilter(item.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold ${
                selected ? "bg-[#4A89EA] text-white" : "bg-white text-[#3C3C43] shadow-sm"
              }`}
            >
              <Icon size={15} />
              {t(item.label)}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex gap-2 overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTER_AMENITIES.map((key) => {
          const selected = amenityFilter[key];
          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected}
              onClick={() => onToggleAmenity(key)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium ${
                selected
                  ? "border-[#4A89EA] bg-white text-[#4A89EA]"
                  : "border-[#E6EAF0] bg-white text-[#6B7280]"
              }`}
            >
              <AmenityGlyph name={key} />
              {t(AMENITY_LABEL[key])}
            </button>
          );
        })}
      </div>

      <div className="relative mx-4 mb-3 min-h-0 flex-1 overflow-hidden rounded-[22px]">
        <ToiletLeafletMap
          gps={gps}
          toilets={toilets.map((row) => ({
            toiletUuid: row.toiletUuid,
            lat: row.latitudeToilet,
            lng: row.longitudeToilet,
          }))}
          draft={null}
          onLongPress={() => undefined}
          onToiletClick={onOpen}
          onBoundsChange={onBoundsChange}
          focus={focus}
          recenterToken={recenterToken}
          active={active}
        />
        <button
          type="button"
          onClick={onSearchArea}
          className="absolute top-3 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#4A89EA] shadow-md"
        >
          <RotateCw size={13} />
          {t("toiletSearchArea")}
        </button>
        <button
          type="button"
          aria-label={t("mapMyLocation")}
          onClick={onRecenter}
          className="absolute right-3 bottom-8 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#29292E] shadow-md"
        >
          <LocateFixed size={18} />
        </button>
      </div>

      <section
        style={{ height: sheetHeight }}
        className="relative z-20 flex shrink-0 flex-col rounded-t-[28px] bg-white px-5 pt-1 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(20,40,80,0.08)]"
      >
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label={t("toiletMapTitle")}
          onPointerDown={onSheetPointerDown}
          onPointerMove={onSheetPointerMove}
          onPointerUp={onSheetPointerUp}
          onPointerCancel={onSheetPointerUp}
          className="flex cursor-grab touch-none justify-center py-2 active:cursor-grabbing"
        >
          <span className="h-1.5 w-11 rounded-full bg-[#E5E7EB]" />
        </div>
        <ul className="grid min-h-0 flex-1 gap-3 overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {toilets.length === 0 ? (
            <li className="px-1 py-6 text-center text-sm text-[#8E8E93]">{t("toiletEmptyList")}</li>
          ) : (
            toilets.map((toilet) => (
              <ToiletCard
                key={toilet.toiletUuid}
                toilet={toilet}
                distanceLabel={
                  gps ? formatToiletDistance(toiletDistance(gps, toilet) ?? 0, locale) : ""
                }
                saved={saved.has(toilet.toiletUuid)}
                onOpen={() => onOpen(toilet.toiletUuid)}
                onToggleSaved={() => onToggleSaved(toilet.toiletUuid)}
              />
            ))
          )}
        </ul>
      </section>
    </div>
  );
}

function ToiletCard({
  toilet,
  distanceLabel,
  saved,
  onOpen,
  onToggleSaved,
}: {
  toilet: ToiletLocation;
  distanceLabel: string;
  saved: boolean;
  onOpen: () => void;
  onToggleSaved: () => void;
}) {
  const { t } = useI18n();
  const score = starCountFromStoredScore(toilet.avgScoreToilet);
  const cover = toilet.photosToilet[0] ?? "";
  const badge = isOpenAllDay(toilet.openHoursToilet)
    ? t("toiletOpen24")
    : toilet.cleanToilet
      ? t("toiletAmenityClean")
      : "";
  const chips = [
    ...FILTER_AMENITIES.filter((key) => key !== "clean" && key !== "free"),
    ...AMENITIES.filter((key) => !FILTER_AMENITIES.includes(key) && amenityOn(toilet, key)),
  ];

  return (
    <li className="relative">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full gap-3 rounded-2xl border border-[#EEF2F6] bg-[#F7F9FC] p-3 text-left"
      >
        <span className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-xl bg-[#EEF2F7]">
          {cover ? (
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : (
            <img src="/icon/toilet.png" alt="" className="m-auto mt-7 h-8 w-8 opacity-70" />
          )}
          {badge ? (
            <span className="absolute top-1.5 left-1.5 rounded-md bg-white/95 px-1.5 py-0.5 text-[10px] font-semibold text-[#4A89EA]">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="min-w-0 flex-1 pr-6">
          <span className="block truncate text-[18px] font-bold leading-tight text-[#1F2937]">
            {toilet.placeToilet}
          </span>
          {score > 0 ? (
            <span className="mt-0.5 flex items-center gap-1 text-xs text-[#1F2937]">
              <Star size={13} className="fill-amber-400 text-amber-400" />
              {score.toFixed(1)}
            </span>
          ) : null}
          {distanceLabel ? (
            <span className="mt-0.5 flex items-center gap-1 text-xs text-[#8E8E93]">
              <MapPin size={13} className="shrink-0 text-[#4A89EA]" />
              {distanceLabel}
            </span>
          ) : null}
          {toilet.cleanToilet || toilet.freeToilet ? (
            <span className="mt-1 flex flex-wrap gap-1">
              {toilet.cleanToilet ? (
                <span className="rounded-full bg-[#DCFCE7] px-2 py-0.5 text-[11px] font-semibold text-[#15803D]">
                  {t("toiletAmenityClean")}
                </span>
              ) : null}
              {toilet.freeToilet ? (
                <span className="rounded-full bg-[#DBEAFE] px-2 py-0.5 text-[11px] font-semibold text-[#1D4ED8]">
                  {t("toiletAmenityFree")}
                </span>
              ) : null}
            </span>
          ) : null}
          <span className="mt-1.5 flex flex-wrap gap-1">
            {chips.map((key) => (
              <span
                key={key}
                className="inline-flex items-center gap-1 bg-transparent text-[11px] font-medium text-[#6B7280]"
              >
                <AmenityGlyph name={key} />
                {t(AMENITY_LABEL[key])}
              </span>
            ))}
          </span>
        </span>
      </button>
      <button
        type="button"
        aria-label={t("toiletBookmark")}
        aria-pressed={saved}
        onClick={onToggleSaved}
        className="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center text-[#4A89EA]"
      >
        <Bookmark size={18} className={saved ? "fill-[#4A89EA]" : ""} />
      </button>
    </li>
  );
}

export function ToiletDetail({
  toilet,
  gps,
  saved,
  onBack,
  onToggleSaved,
  onShare,
}: {
  toilet: ToiletLocation;
  gps: MapPoint | null;
  saved: boolean;
  onBack: () => void;
  onToggleSaved: () => void;
  onShare: () => void;
}) {
  const { t, locale } = useI18n();
  const [index, setIndex] = useState(0);
  const photos = toilet.photosToilet;
  const score = starCountFromStoredScore(toilet.avgScoreToilet);
  const hours = displayHours(toilet.openHoursToilet);
  const distance = toiletDistance(gps, toilet);
  const active = AMENITIES.filter((key) => amenityOn(toilet, key));

  useEffect(() => {
    setIndex(0);
  }, [toilet.toiletUuid]);

  const photo = photos[index] ?? "";
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${toilet.latitudeToilet},${toilet.longitudeToilet}`;

  return (
    <div className="flex min-h-dvh flex-col bg-[#F4F7FB]">
      <header className="relative flex items-center px-2 pt-2">
        <BackButton label={t("cancel")} onClick={onBack} />
        <h1 className="pointer-events-none absolute inset-x-16 text-center text-[17px] font-semibold text-[#1F2937]">
          {t("toiletDetailTitle")}
        </h1>
        <div className="ml-auto flex gap-1 pr-2">
          <IconBubble icon={Share2} label={t("toiletShare")} onClick={onShare} />
          <IconBubble icon={Bookmark} label={t("toiletBookmark")} onClick={onToggleSaved} pressed={saved} />
        </div>
      </header>

      <div className="px-4 pt-3">
        <div className="relative aspect-[16/10] overflow-hidden rounded-[28px] bg-[#E7EDF5]">
          {photo ? (
            <img src={photo} alt={toilet.placeToilet} className="h-full w-full object-cover" />
          ) : (
            <img src="/icon/toilet.png" alt="" className="mx-auto mt-[18%] h-12 w-12 opacity-60" />
          )}
          {photos.length > 1 ? (
            <>
              <button
                type="button"
                aria-label={t("cancel")}
                onClick={() => setIndex((n) => (n - 1 + photos.length) % photos.length)}
                className="absolute top-1/2 left-3 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#29292E]"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                aria-label={t("toiletNavigate")}
                onClick={() => setIndex((n) => (n + 1) % photos.length)}
                className="absolute top-1/2 right-3 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#29292E]"
              >
                <ChevronLeft size={18} className="rotate-180" />
              </button>
            </>
          ) : null}
          {photos.length > 0 ? (
            <span className="absolute right-3 bottom-3 rounded-full bg-black/55 px-2 py-0.5 text-xs font-medium text-white">
              {index + 1}/{photos.length}
            </span>
          ) : null}
        </div>
      </div>

      <section className="mx-4 mt-4 rounded-3xl bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-[#1F2937]">{toilet.placeToilet}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#6B7280]">
              {score > 0 ? (
                <span className="inline-flex items-center gap-1 font-semibold text-[#1F2937]">
                  <Star size={14} className="fill-amber-400 text-amber-400" />
                  {score.toFixed(1)}
                </span>
              ) : null}
              {distance != null ? <span>{formatToiletDistance(distance, locale)}</span> : null}
              {hours ? (
                <span>
                  {t("toiletStatusOpen")} {hours}
                </span>
              ) : null}
            </p>
            {toilet.addressToilet ? (
              <p className="mt-2 flex items-start gap-1.5 text-sm text-[#6B7280]">
                <MapPin size={15} className="mt-0.5 shrink-0 text-[#4A89EA]" />
                <span>{toilet.addressToilet}</span>
              </p>
            ) : null}
          </div>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={t("toiletNavigate")}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#4A89EA] text-white"
          >
            <Navigation size={18} className="fill-white" />
          </a>
        </div>
      </section>

      {active.length > 0 || hours ? (
        <section className="mx-4 mt-4 rounded-3xl bg-white p-4 shadow-sm">
          <div className="grid grid-cols-4 gap-3">
            {active.map((key) => (
              <div key={key} className="flex flex-col items-center gap-1.5 text-center">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8F1FC] text-[#4A89EA]">
                  <AmenityGlyph name={key} />
                </span>
                <span className="text-[11px] leading-tight font-medium text-[#374151]">
                  {t(AMENITY_LABEL[key])}
                </span>
              </div>
            ))}
            {hours ? (
              <div className="flex flex-col items-center gap-1.5 text-center">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E8F1FC] text-[#4A89EA]">
                  <Clock size={16} />
                </span>
                <span className="text-[11px] leading-tight font-medium text-[#374151]">
                  {t("toiletStatusOpen")} {hours}
                </span>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="sticky bottom-0 mt-auto flex gap-3 bg-[#F4F7FB]/95 px-4 py-4 backdrop-blur">
        <button
          type="button"
          aria-pressed={saved}
          onClick={onToggleSaved}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[#D7DEE8] bg-white py-3.5 text-sm font-semibold text-[#1F2937]"
        >
          <Bookmark size={16} className={saved ? "fill-[#4A89EA] text-[#4A89EA]" : ""} />
          {t("toiletBookmark")}
        </button>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-[#4A89EA] py-3.5 text-sm font-semibold text-white"
        >
          <Navigation size={16} className="fill-white" />
          {t("toiletNavigate")}
        </a>
      </div>
    </div>
  );
}

async function compressImage(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("read"));
      el.src = url;
    });
    const maxEdge = 1280;
    const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("read");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    let quality = 0.72;
    let data = canvas.toDataURL("image/jpeg", quality);
    while (data.length > 500_000 && quality > 0.4) {
      quality -= 0.12;
      data = canvas.toDataURL("image/jpeg", quality);
    }
    if (data.length > 520_000) throw new Error("big");
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ToiletForm({
  values,
  onChange,
  pin,
  onPin,
  onClose,
  onSave,
  saving,
  error,
  onPhotoError,
}: {
  values: ToiletDraft;
  onChange: (next: ToiletDraft) => void;
  pin: MapPoint;
  onPin: (point: MapPoint) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  error: string;
  onPhotoError: (message: string) => void;
}) {
  const { t } = useI18n();

  async function addPhotos(list: FileList | null) {
    if (!list || list.length === 0) return;
    const room = 5 - values.photosToilet.length;
    if (room <= 0) {
      onPhotoError(t("toiletPhotoLimit"));
      return;
    }
    const next: string[] = [];
    for (const file of Array.from(list).slice(0, room)) {
      if (file.size > 5 * 1024 * 1024) {
        onPhotoError(t("toiletPhotoTooBig"));
        return;
      }
      try {
        next.push(await compressImage(file));
      } catch (err) {
        onPhotoError(err instanceof Error && err.message === "big" ? t("toiletPhotoTooBig") : t("toiletPhotoReadFailed"));
        return;
      }
    }
    onChange({ ...values, photosToilet: [...values.photosToilet, ...next] });
  }

  return (
    <div className="min-h-dvh bg-[#F4F7FB] pb-8">
      <header className="grid grid-cols-[48px_1fr_48px] items-center px-2 pt-2">
        <BackButton label={t("cancel")} onClick={onClose} />
        <h1 className="text-center text-[17px] font-semibold text-[#1F2937]">{t("toiletAddNew")}</h1>
        <span />
      </header>

      <div className="grid gap-4 px-4 pt-4">
        <h2 className="text-base font-semibold text-[#1F2937]">{t("toiletBasicInfo")}</h2>

        {values.photosToilet.length > 0 ? (
          <div className="flex gap-2 overflow-x-auto">
            {values.photosToilet.map((src, index) => (
              <div key={`${index}-${src.slice(-12)}`} className="relative h-20 w-20 shrink-0">
                <img src={src} alt="" className="h-20 w-20 rounded-2xl object-cover" />
                <button
                  type="button"
                  aria-label={t("cancel")}
                  onClick={() =>
                    onChange({
                      ...values,
                      photosToilet: values.photosToilet.filter((_, i) => i !== index),
                    })
                  }
                  className="absolute -top-1 -right-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#1F2937] text-white"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {values.photosToilet.length < 5 ? (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-[#D6E4F5] bg-[#F8FBFF] px-4 py-8 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#4A89EA] shadow-sm">
              <Camera size={22} />
            </span>
            <span className="mt-3 text-sm font-semibold text-[#4A89EA]">{t("toiletAddPhoto")}</span>
            <span className="mt-1 text-xs text-[#8E8E93]">{t("toiletPhotoLimit")}</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                void addPhotos(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        ) : null}

        <label className="block">
          <RequiredLabel>{t("toiletPlaceName")}</RequiredLabel>
          <input
            value={values.placeToilet}
            onChange={(e) => onChange({ ...values, placeToilet: e.target.value })}
            className={fieldClass}
          />
        </label>

        <label className="block">
          <RequiredLabel>{t("toiletPlaceType")}</RequiredLabel>
          <span className="relative block">
            <select
              value={values.placeType}
              onChange={(e) => onChange({ ...values, placeType: e.target.value })}
              className={`${fieldClass} appearance-none pr-10 ${values.placeType ? "" : "text-[#9CA3AF]"}`}
            >
              <option value="">{t("toiletPlaceTypePlaceholder")}</option>
              <option value="mall">{t("toiletTypeMall")}</option>
              <option value="gas">{t("toiletTypeGas")}</option>
              <option value="food">{t("toiletTypeFood")}</option>
            </select>
            <ChevronLeft size={16} className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 -rotate-90 text-[#9CA3AF]" />
          </span>
        </label>

        <label className="block">
          <RequiredLabel>{t("toiletAddress")}</RequiredLabel>
          <span className="relative block">
            <MapPin size={16} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-[#4A89EA]" />
            <input
              value={values.addressToilet}
              placeholder={t("toiletAddressPlaceholder")}
              onChange={(e) => onChange({ ...values, addressToilet: e.target.value })}
              className={`${fieldClass} pl-10`}
            />
          </span>
        </label>

        <div>
          <RequiredLabel>{t("toiletMapPin")}</RequiredLabel>
          <div className="relative h-44 overflow-hidden rounded-3xl border border-[#E6EAF0]">
            <ToiletLeafletMap
              gps={null}
              toilets={[]}
              draft={pin}
              pinMode
              onLongPress={onPin}
              onToiletClick={() => undefined}
              onBoundsChange={() => undefined}
              focus={null}
            />
          </div>
          <p className="mt-2 text-xs text-[#8E8E93]">
            {t("toiletCoords")}: {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)} ({t("toiletPinHint")})
          </p>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-[#1F2937]">{t("toiletOpenHours")}</span>
          <input
            value={values.openHoursToilet}
            inputMode="numeric"
            onChange={(e) =>
              onChange({
                ...values,
                openHoursToilet: nextOpenHoursValue(values.openHoursToilet, e.target.value),
              })
            }
            className={fieldClass}
          />
        </label>

        <div>
          <h2 className="mb-2 text-base font-semibold text-[#1F2937]">{t("toiletDetails")}</h2>
          <div className="flex flex-wrap gap-2">
            {AMENITIES.map((key) => {
              const selected = Boolean(values[DRAFT_FIELD[key]]);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    onChange({
                      ...values,
                      [DRAFT_FIELD[key]]: !selected,
                    })
                  }
                  className={`inline-flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-sm font-medium ${
                    selected
                      ? "border-[#4A89EA] bg-[#E8F1FC] text-[#4A89EA]"
                      : "border-[#E6EAF0] bg-white text-[#6B7280]"
                  }`}
                >
                  <AmenityGlyph name={key} />
                  {t(AMENITY_LABEL[key])}
                </button>
              );
            })}
          </div>
        </div>

        {error ? <p className="text-sm text-[#C33E83]">{error}</p> : null}

        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="rounded-2xl bg-[#4A89EA] py-3.5 text-base font-semibold text-white disabled:opacity-60"
        >
          {saving ? t("toiletSaving") : t("toiletAddAction")}
        </button>
      </div>
    </div>
  );
}
