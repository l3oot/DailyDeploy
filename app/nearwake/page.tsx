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
    if (res.body.isSuccess) setItems((rows) => rows.filter((row) => row.favoritePlaceUuid !== uuid));
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
              return (
                <li key={item.favoritePlaceUuid} className="flex items-stretch gap-2">
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
    </main>
  );
}
