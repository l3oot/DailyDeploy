"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BentoWave } from "@/components/bento-wave";
import { PageBack } from "@/components/page-back";
import { TopoPattern } from "@/components/topo-pattern";
import { api, type SessionUser } from "@/lib/api";
import { isGuest } from "@/lib/guest";
import { useI18n } from "@/lib/i18n/provider";

type FavoritePlace = {
  favoritePlaceUuid: string;
  favoritePlaceName: string | null;
  storeplaceUuid: string;
  placeName: string;
  placeDetail: string;
  placeLat: number;
  placeLon: number;
};

export default function NearwakePage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [error, setError] = useState("");
  const [items, setItems] = useState<FavoritePlace[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

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
    const favs = await api<FavoritePlace[]>("/api/v1/nearwake/favoriteplace");
    if (!favs.body.isSuccess) {
      if (favs.status === 401) setNeedLogin(true);
      else if (favs.status === 404) setNeedLogin(true);
      else setError(favs.body.errorMessage || t("favoritePlacesLoadFailed"));
      setLoading(false);
      return;
    }
    setNeedLogin(false);
    setError("");
    setItems(favs.body.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function remove(uuid: string) {
    const res = await api(`/api/v1/nearwake/favoriteplace/${uuid}`, { method: "DELETE" });
    if (res.body.isSuccess) {
      setItems((rows) => rows.filter((row) => row.favoritePlaceUuid !== uuid));
      if (editingId === uuid) {
        setEditingId(null);
        setEditName("");
      }
    }
  }

  function startRename(item: FavoritePlace) {
    setEditingId(item.favoritePlaceUuid);
    setEditName(item.favoritePlaceName || item.placeName);
  }

  function cancelRename() {
    setEditingId(null);
    setEditName("");
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

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <TopoPattern />
      <div className="relative z-10 px-1 pt-2">
        <PageBack />
      </div>
      <div className="relative z-10 mx-auto max-w-lg px-5 pb-10">
        <div className="relative overflow-hidden rounded-3xl bg-[#29292E] px-6 py-6 text-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
          <BentoWave color="rgba(74,79,87,0.9)" />
          <p className="relative z-10 text-[26px] font-bold leading-tight">{t("favoritePlacesTitle")}</p>
          <p className="relative z-10 mt-1.5 max-w-[70%] text-[13px] text-[#BFC3CC]">
            {t("nearAlarmCardSubtitle")}
          </p>
          <Image
            src="/icon/map1.png"
            alt=""
            width={118}
            height={80}
            className="absolute right-0 bottom-0 z-10"
          />
        </div>

        {loading ? (
          <p className="mt-10 text-center text-sm text-[#8E8E93]">{t("restoringSession")}</p>
        ) : needLogin ? (
          <p className="mt-10 whitespace-pre-line text-center text-[15px] leading-relaxed text-[#4A4F57]">
            {t("favoritePlacesLoginPrompt")}
          </p>
        ) : error ? (
          <p className="mt-10 text-center text-sm text-[#C33E83]">{error}</p>
        ) : items.length === 0 ? (
          <p className="mt-10 whitespace-pre-line text-center text-[15px] leading-relaxed text-[#4A4F57]">
            {t("favoritePlacesEmpty")}
          </p>
        ) : (
          <ul className="mt-6 space-y-2">
            {items.map((item, index) => {
              const href = `/nearwake/map?lat=${item.placeLat}&lng=${item.placeLon}&name=${encodeURIComponent(
                item.favoritePlaceName || item.placeName,
              )}&storeplaceUuid=${encodeURIComponent(item.storeplaceUuid)}`;
              const bg = ["bg-[#ECECFF]", "bg-[#FDF2D9]", "bg-[#3A3A3E] text-white"][index % 3];
              const editing = editingId === item.favoritePlaceUuid;
              return (
                <li key={item.favoritePlaceUuid} className="flex items-stretch gap-2">
                  {editing ? (
                    <form
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-white px-3 py-3 shadow-sm"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void saveRename(item.favoritePlaceUuid);
                      }}
                    >
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                        ★
                      </span>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        maxLength={150}
                        autoFocus
                        aria-label={t("renameFavoritePlace")}
                        className="min-w-0 flex-1 bg-transparent font-semibold"
                      />
                    </form>
                  ) : (
                    <Link href={href} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-white px-3 py-3 shadow-sm">
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                        ★
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">
                          {item.favoritePlaceName || item.placeName}
                        </span>
                        {item.placeDetail ? (
                          <span className="block truncate text-xs text-[#8E8E93]">{item.placeDetail}</span>
                        ) : null}
                      </span>
                    </Link>
                  )}
                  {editing ? (
                    <>
                      <button
                        type="button"
                        disabled={saving}
                        aria-label={t("accountSave")}
                        className="flex items-center justify-center rounded-2xl bg-[#4A89EA] px-3 text-white disabled:opacity-70"
                        onClick={() => void saveRename(item.favoritePlaceUuid)}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path
                            d="M5 12.5 10 17.5 19 7.5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        aria-label={t("cancel")}
                        className="flex items-center justify-center rounded-2xl bg-[#ECECEF] px-3 text-[#29292E]"
                        onClick={cancelRename}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path
                            d="M7 7l10 10M17 7 7 17"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        aria-label={t("renameFavoritePlace")}
                        className="flex items-center justify-center rounded-2xl bg-[#ECECFF] px-3 text-[#4A89EA]"
                        onClick={() => startRename(item)}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path
                            d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Zm11.2-13.7 3 3"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        aria-label={t("deleteFavoritePlace")}
                        className="flex items-center justify-center rounded-2xl bg-[#E5484D] px-3 text-white"
                        onClick={() => void remove(item.favoritePlaceUuid)}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path
                            d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <Link
          href="/nearwake/map"
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-[#29292E] bg-white py-3.5 font-semibold text-[#29292E]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M9 20L3 17V5L9 8M9 20L15 17M9 20V8M15 17L21 20V8L15 5M15 17V5M9 8L15 5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
          {t("favoritePlacesOpenMap")}
        </Link>
      </div>

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-full bg-[#29292E] px-4 py-2 text-sm text-white">
          {toast}
        </div>
      ) : null}
    </main>
  );
}
