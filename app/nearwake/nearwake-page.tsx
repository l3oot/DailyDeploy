"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Briefcase,
  GraduationCap,
  House,
  Map,
  MapPin,
  MoreVertical,
  Check,
  Plane,
  ShoppingBag,
  X,
  type LucideIcon,
} from "lucide-react";
import { PageBack } from "@/components/page-back";
import { api, type SessionUser } from "@/lib/api";
import { isGuest } from "@/lib/guest";
import { useI18n } from "@/lib/i18n/provider";
import { resolveSelectedPlace, suggestPlaces, type PlaceSuggestion, type ResolvedPlace } from "@/lib/places";

type FavoritePlace = {
  favoritePlaceUuid: string;
  favoritePlaceName: string | null;
  storeplaceUuid: string;
  placeName: string;
  placeDetail: string;
  placeLat: number;
  placeLon: number;
};

type RecentPlace = {
  recentPlaceUuid: string;
  recentPlaceName: string | null;
  storeplaceUuid: string;
  placeName: string;
  placeDetail: string;
  placeLat: number;
  placeLon: number;
};

type ListTab = "recent" | "favorites";

const FAVORITE_VISIBLE_COUNT = 5;

const MARK_TONES = [
  "bg-[#E8F1FF] text-[#3B82F6]",
  "bg-[#FFF3E4] text-[#F0A03A]",
  "bg-[#F1EBFF] text-[#7C6BF2]",
  "bg-[#E7F0FF] text-[#5B8DEF]",
  "bg-[#FDE8EE] text-[#F07A96]",
];

function placeTone(index: number) {
  return MARK_TONES[index % MARK_TONES.length] ?? MARK_TONES[0];
}

function placeIcon(name: string): LucideIcon {
  const text = name.toLowerCase();
  if (/บ้าน|home|house/.test(text)) return House;
  if (/ทำงาน|ออฟฟิศ|work|office/.test(text)) return Briefcase;
  if (/ห้าง|ร้าน|mall|central|shop|market/.test(text)) return ShoppingBag;
  if (/สนามบิน|airport/.test(text)) return Plane;
  if (/มหาวิทยาลัย|โรงเรียน|วิทยาลัย|university|school/.test(text)) return GraduationCap;
  return MapPin;
}

const SKELETON_TITLE_WIDTH = ["w-2/5", "w-1/2", "w-1/3", "w-[46%]", "w-2/5"] as const;
const SKELETON_DETAIL_WIDTH = ["w-4/5", "w-3/5", "w-[72%]", "w-3/4", "w-[64%]"] as const;

function PlaceListSkeleton({ label }: { label: string }) {
  return (
    <ul className="h-full overflow-hidden" aria-busy="true" aria-live="polite">
      <li className="sr-only">{label}</li>
      {Array.from({ length: FAVORITE_VISIBLE_COUNT }, (_, index) => (
        <li key={index} className="border-b border-[#F2F4F7] last:border-b-0" aria-hidden="true">
          <div className="flex animate-pulse items-center gap-3 px-4 py-3.5">
            <span className="h-11 w-11 shrink-0 rounded-full bg-[#EEF2F6]" />
            <div className="min-w-0 flex-1">
              <span className="relative block truncate text-[16px] font-semibold text-transparent">
                ชื่อ
                <span
                  className={`absolute top-1/2 h-3.5 -translate-y-1/2 rounded-full bg-[#EEF2F6] ${SKELETON_TITLE_WIDTH[index]}`}
                />
              </span>
              <span className="relative mt-0.5 block truncate text-[13px] text-transparent">
                รายละเอียด
                <span
                  className={`absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-[#F3F6F9] ${SKELETON_DETAIL_WIDTH[index]}`}
                />
              </span>
            </div>
            <span className="h-8 w-8 shrink-0" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function mapHref(
  item: Pick<FavoritePlace, "placeLat" | "placeLon" | "favoritePlaceName" | "placeName" | "storeplaceUuid" | "placeDetail">,
  fromFavorite: boolean,
) {
  const params = new URLSearchParams({
    lat: String(item.placeLat),
    lng: String(item.placeLon),
    name: item.favoritePlaceName || item.placeName,
    storeplaceUuid: item.storeplaceUuid,
  });
  if (item.placeDetail) params.set("detail", item.placeDetail);
  if (fromFavorite) params.set("from", "favorite");
  return `/nearwake/map?${params.toString()}`;
}

export default function NearwakePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [favoritesError, setFavoritesError] = useState("");
  const [recentError, setRecentError] = useState("");
  const [listTab, setListTab] = useState<ListTab>("recent");
  const [items, setItems] = useState<FavoritePlace[]>([]);
  const [recents, setRecents] = useState<RecentPlace[]>([]);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [slotHeight, setSlotHeight] = useState<number | null>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const searchSeq = useRef(0);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(""), 2200);
  }

  async function load() {
    if (isGuest()) {
      setNeedLogin(true);
      setLoading(false);
      return;
    }
    const me = await api<SessionUser>("/api/v1/auth/me");
    if (!me.body.isSuccess) {
      setNeedLogin(true);
      setLoading(false);
      return;
    }
    const [favs, history] = await Promise.all([
      api<FavoritePlace[]>("/api/v1/nearwake/favoriteplace"),
      api<RecentPlace[]>("/api/v1/nearwake/recentplace"),
    ]);
    if (favs.status === 401 || history.status === 401) {
      setNeedLogin(true);
      setLoading(false);
      return;
    }
    if (!favs.body.isSuccess && !history.body.isSuccess && (favs.status === 404 || history.status === 404)) {
      setNeedLogin(true);
      setLoading(false);
      return;
    }
    setNeedLogin(false);
    setItems(favs.body.isSuccess ? (favs.body.data ?? []) : []);
    setRecents(history.body.isSuccess ? (history.body.data ?? []) : []);
    setFavoritesError(favs.body.isSuccess ? "" : favs.body.errorMessage || t("favoritePlacesLoadFailed"));
    setRecentError(history.body.isSuccess ? "" : history.body.errorMessage || t("nearwakeRecentLoadFailed"));
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    const seq = ++searchSeq.current;
    const handle = window.setTimeout(() => {
      setSearching(true);
      void suggestPlaces(q).then((res) => {
        if (searchSeq.current !== seq) return;
        setSearching(false);
        setSuggestions(res.suggestions);
      });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    if (!menuId) return;
    function close() {
      setMenuId(null);
    }
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [menuId]);

  function selectTab(tab: ListTab) {
    setListTab(tab);
    setMenuId(null);
    setEditingId(null);
    setEditName("");
  }

  async function remove(uuid: string) {
    const recent = listTab === "recent";
    const res = await api(
      recent ? `/api/v1/nearwake/recentplace/${uuid}` : `/api/v1/nearwake/favoriteplace/${uuid}`,
      { method: "DELETE" },
    );
    if (res.body.isSuccess) {
      if (recent) setRecents((rows) => rows.filter((row) => row.recentPlaceUuid !== uuid));
      else setItems((rows) => rows.filter((row) => row.favoritePlaceUuid !== uuid));
      if (editingId === uuid) {
        setEditingId(null);
        setEditName("");
      }
    }
    setMenuId(null);
  }

  function startRename(item: FavoritePlace) {
    setMenuId(null);
    setEditingId(item.favoritePlaceUuid);
    setEditName(item.favoritePlaceName || item.placeName);
  }

  async function saveRename(uuid: string) {
    const name = editName.trim();
    if (!name) {
      showToast(t("favoritePlaceNameRequired"));
      return;
    }
    if (saving) return;
    setSaving(true);
    const res = await api<{ favoritePlaceUuid: string; favoritePlaceName: string }>(
      "/api/v1/nearwake/favoriteplace",
      {
        method: "PUT",
        body: JSON.stringify({ favoritePlaceUuid: uuid, favoritePlaceName: name }),
      },
    );
    setSaving(false);
    if (!res.body.isSuccess || !res.body.data) {
      showToast(res.body.errorMessage || t("favoritePlaceRenameFailed"));
      return;
    }
    const nextName = res.body.data.favoritePlaceName;
    setItems((rows) =>
      rows.map((row) =>
        row.favoritePlaceUuid === uuid ? { ...row, favoritePlaceName: nextName } : row,
      ),
    );
    setEditingId(null);
    setEditName("");
    showToast(t("favoritePlaceRenamed"));
  }

  async function pickSuggestion(suggestion: PlaceSuggestion) {
    setResolving(true);
    const { place, error: resolveError } = await resolveSelectedPlace(suggestion);
    setResolving(false);
    if (!place) {
      showToast(resolveError || t("longdoSearchNoResult"));
      return;
    }
    openPlace(place);
  }

  function openPlace(place: ResolvedPlace) {
    const params = new URLSearchParams({
      lat: String(place.lat),
      lng: String(place.lon),
      name: place.name,
    });
    if (place.storeplaceUuid) params.set("storeplaceUuid", place.storeplaceUuid);
    if (place.detail) params.set("detail", place.detail);
    router.push(`/nearwake/map?${params.toString()}`);
  }

  const shown: FavoritePlace[] =
    listTab === "favorites"
      ? items
      : recents.map((item) => ({
          favoritePlaceUuid: item.recentPlaceUuid,
          favoritePlaceName: item.recentPlaceName,
          storeplaceUuid: item.storeplaceUuid,
          placeName: item.placeName,
          placeDetail: item.placeDetail,
          placeLat: item.placeLat,
          placeLon: item.placeLon,
        }));
  const listError = listTab === "favorites" ? favoritesError : recentError;

  useLayoutEffect(() => {
    const probe = slotRef.current;
    if (!probe) return;
    const measure = () => {
      const row = probe.offsetHeight;
      if (!row) return;
      setSlotHeight(row * FAVORITE_VISIBLE_COUNT + (FAVORITE_VISIBLE_COUNT - 1));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(probe);
    return () => observer.disconnect();
  }, []);

  return (
    <main className="min-h-dvh bg-[#F5F8FC] pb-10">
      <div className="mx-auto w-full max-w-[430px] px-4 pt-3">
        <header className="relative flex min-h-12 items-center justify-center">
          <div className="absolute left-0 top-0">
            <PageBack />
          </div>
          <div className="px-20 text-center">
            <h1 className="text-[20px] font-bold leading-tight text-[#1B2430]">{t("nearAlarm")}</h1>
            <p className="mt-0.5 text-[13px] text-[#8B95A1]">{t("nearwakeLead")}</p>
          </div>
          <Link
            href="/nearwake/map"
            className="absolute top-1.5 right-0 inline-flex h-9 items-center gap-1 rounded-full bg-[#E7F1FF] px-3 text-[14px] font-semibold text-[#3B82F6]"
          >
            <Map className="h-4 w-4" aria-hidden="true" />
            {t("nearwakePickMap")}
          </Link>
        </header>

        <div className="relative mt-4">
          <div className="rounded-[22px] bg-white px-4 py-3.5 shadow-[0_8px_24px_rgba(40,80,140,0.06)]">
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 shrink-0 text-[#3B82F6]" aria-hidden="true" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("nearwakeSearchPlaceholder")}
                className="min-w-0 flex-1 bg-transparent text-[16px] text-[#1B2430] outline-none placeholder:text-[#C5CDD6]"
                autoComplete="off"
              />
              {query ? (
                <button
                  type="button"
                  aria-label={t("cancel")}
                  className="text-[#C5CDD6]"
                  onClick={() => {
                    setQuery("");
                    setSuggestions([]);
                  }}
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
          <p className="mt-2 pl-4 text-[13px] text-[#A8B0BA]">{t("nearwakeSearchHint")}</p>
          {suggestions.length > 0 ? (
            <ul className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl bg-white py-1 shadow-[0_10px_28px_rgba(40,80,140,0.12)]">
              {suggestions.map((item) => (
                <li key={`${item.source}-${item.placeId}-${item.text}`}>
                  <button
                    type="button"
                    className="flex w-full flex-col px-4 py-2.5 text-left hover:bg-[#F5F8FC]"
                    onClick={() => void pickSuggestion(item)}
                  >
                    <span className="text-[15px] font-medium text-[#1B2430]">{item.text}</span>
                    {item.detail ? (
                      <span className="truncate text-[12px] text-[#8B95A1]">{item.detail}</span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {searching || resolving ? (
            <p className="mt-2 px-2 text-[12px] text-[#8B95A1]">
              {resolving ? t("resolvingPlace") : t("searchingPlaces")}
            </p>
          ) : null}
        </div>

        <section className="mt-6">
          <div className="flex items-center gap-5 px-1">
            <button
              type="button"
              onClick={() => selectTab("recent")}
              className={`text-[18px] font-bold ${listTab === "recent" ? "text-[#1B2430]" : "text-[#C5CDD6]"}`}
            >
              {t("nearwakeRecent")}
            </button>
            <button
              type="button"
              onClick={() => selectTab("favorites")}
              className={`text-[18px] font-bold ${listTab === "favorites" ? "text-[#1B2430]" : "text-[#C5CDD6]"}`}
            >
              {t("nearwakeFavorites")}
            </button>
          </div>

          <div
            className="relative mt-3 flex flex-col overflow-hidden rounded-[22px] bg-white shadow-[0_8px_24px_rgba(40,80,140,0.06)]"
            style={slotHeight ? { height: slotHeight } : undefined}
          >
            <div ref={slotRef} className="pointer-events-none invisible absolute inset-x-0 top-0" aria-hidden>
              <div className="flex items-center gap-3 px-4 py-3.5">
                <span className="h-11 w-11 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-semibold">ชื่อ</span>
                  <span className="mt-0.5 block truncate text-[13px]">รายละเอียด</span>
                </div>
              </div>
            </div>
            {loading ? (
              <PlaceListSkeleton label={t("restoringSession")} />
            ) : needLogin ? (
              <p className="flex flex-1 items-center justify-center px-4 text-center text-[15px] leading-relaxed text-[#5C6570]">
                {t("favoritePlacesLoginPrompt")}
              </p>
            ) : listError ? (
              <p className="flex flex-1 items-center justify-center px-4 text-center text-sm text-[#C33E83]">
                {listError}
              </p>
            ) : shown.length === 0 ? (
              <p className="flex flex-1 items-center justify-center px-4 text-center text-[15px] text-[#8B95A1]">
                {listTab === "favorites" ? t("nearwakeFavoritesEmpty") : t("nearwakeRecentEmpty")}
              </p>
            ) : (
              <ul className="h-full overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {shown.map((item, index) => {
                  const title = item.favoritePlaceName || item.placeName;
                  const Icon = placeIcon(`${title} ${item.placeName}`);
                  const tone = placeTone(index);
                  const editing = editingId === item.favoritePlaceUuid;
                  return (
                    <li key={item.favoritePlaceUuid} className="border-b border-[#F2F4F7] last:border-b-0">
                      <div className="flex items-center gap-3 px-4 py-3.5">
                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tone}`}>
                          <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                        </span>
                        {editing ? (
                          <form
                            className="min-w-0 flex-1"
                            onSubmit={(e) => {
                              e.preventDefault();
                              void saveRename(item.favoritePlaceUuid);
                            }}
                          >
                            <input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              maxLength={150}
                              autoFocus
                              aria-label={t("renameFavoritePlace")}
                              className="w-full bg-transparent text-[16px] font-semibold text-[#1B2430] outline-none"
                            />
                          </form>
                        ) : (
                          <Link href={mapHref(item, listTab === "favorites")} className="min-w-0 flex-1">
                            <span className="block truncate text-[16px] font-semibold text-[#1B2430]">{title}</span>
                            {item.placeDetail ? (
                              <span className="mt-0.5 block truncate text-[13px] text-[#8B95A1]">
                                {item.placeDetail}
                              </span>
                            ) : null}
                          </Link>
                        )}
                        {editing ? (
                          <button
                            type="button"
                            disabled={saving}
                            aria-label={t("accountSave")}
                            className="text-[#3B82F6] disabled:opacity-60"
                            onClick={() => void saveRename(item.favoritePlaceUuid)}
                          >
                            <Check className="h-5 w-5" aria-hidden="true" />
                          </button>
                        ) : null}
                        <div className="relative">
                          <button
                            type="button"
                            aria-label={t("renameFavoritePlace")}
                            className="flex h-8 w-8 items-center justify-center text-[#C5CDD6]"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={() =>
                              setMenuId((current) =>
                                current === item.favoritePlaceUuid ? null : item.favoritePlaceUuid,
                              )
                            }
                          >
                            <MoreVertical className="h-5 w-5" />
                          </button>
                          {menuId === item.favoritePlaceUuid ? (
                            <div
                              className="absolute top-8 right-0 z-20 w-max overflow-hidden rounded-xl bg-white py-1 shadow-[0_10px_28px_rgba(40,80,140,0.16)]"
                              onPointerDown={(e) => e.stopPropagation()}
                            >
                              {listTab === "favorites" ? (
                                <button
                                  type="button"
                                  className="block w-full whitespace-nowrap px-4 py-2.5 text-left text-sm text-[#1B2430]"
                                  onClick={() => startRename(item)}
                                >
                                  {t("renameFavoritePlace")}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                className="block w-full whitespace-nowrap px-4 py-2.5 text-left text-sm text-[#E5484D]"
                                onClick={() => void remove(item.favoritePlaceUuid)}
                              >
                                {listTab === "favorites" ? t("deleteFavoritePlace") : t("deleteRecentPlace")}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-full bg-[#29292E] px-4 py-2 text-sm text-white">
          {toast}
        </div>
      ) : null}
    </main>
  );
}
