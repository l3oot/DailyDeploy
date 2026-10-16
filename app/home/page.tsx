"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppFooter } from "@/components/app-footer";
import { BentoWave } from "@/components/bento-wave";
import { LanguageSwitcher } from "@/components/language-switcher";
import { RouteHint } from "@/components/route-hint";
import { api, type SessionUser } from "@/lib/api";
import { isGuest } from "@/lib/guest";
import { useI18n } from "@/lib/i18n/provider";
import { fetchToiletCount } from "@/lib/toilets";

export default function HomePage() {
  const { t } = useI18n();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [guest, setGuestState] = useState(false);
  const [toiletCount, setToiletCount] = useState<number | null>(null);
  const [toiletCountLoading, setToiletCountLoading] = useState(true);

  useEffect(() => {
    const guestMode = isGuest();
    setGuestState(guestMode);
    void fetchToiletCount().then((n) => {
      setToiletCountLoading(false);
      setToiletCount(n);
    });
    if (guestMode) return;
    void api<SessionUser>("/api/v1/auth/me").then(async (me) => {
      if (me.body.isSuccess && me.body.data) {
        setUser(me.body.data);
        return;
      }
      const refreshed = await api("/api/v1/auth/refreshtoken", {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (refreshed.body.isSuccess) {
        const again = await api<SessionUser>("/api/v1/auth/me");
        if (again.body.data) setUser(again.body.data);
      }
    });
  }, []);

  const name = user?.userName || user?.email?.split("@")[0] || "";

  return (
    <main className="relative min-h-dvh pb-28">
      <header className="flex items-center justify-between px-5 pt-6">
        <p className="text-2xl font-bold">{t("welcomeBrand")}</p>
        <LanguageSwitcher />
      </header>

      <section className="px-5 pt-2">
        <div className="flex items-center gap-2">
          <h1 className="text-4xl font-bold">{t("homeHelloWord")}</h1>
          {name ? <span className="truncate text-4xl font-bold">{name}</span> : null}
          <Image src="/icon/hi.png" alt="" width={44} height={44} className="hi-wave" />
        </div>
        {guest ? (
          <p className="mt-1 text-sm font-medium text-[#4A89EA]">{t("guestBadge")}</p>
        ) : null}
        <p className="mt-2 text-[#8E8E93]">{t("homeSubtitle")}</p>
      </section>

      <section className="mt-5 grid gap-3 px-5">
        <Link
          href="/nearwake"
          className="relative block overflow-hidden rounded-3xl bg-[#29292E] p-5 text-left text-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
        >
          <BentoWave color="rgba(74,79,87,0.9)" />
          <p className="relative z-10 text-[28px] font-semibold leading-tight">{t("nearAlarm")}</p>
          <p className="relative z-10 mt-2 max-w-[70%] text-[13px] text-[#BFC3CC]">
            {t("nearAlarmCardSubtitle")}
          </p>
          <div className="relative z-10 mt-4">
            <RouteHint />
          </div>
          <Image
            src="/icon/map1.png"
            alt=""
            width={130}
            height={90}
            className="absolute right-3 bottom-4 z-10"
          />
        </Link>

        <p className="pt-1 text-sm font-semibold text-[#8E8E93]">{t("recommendedFeatures")}</p>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/toilet"
            className="relative block min-h-[168px] overflow-hidden rounded-3xl bg-[#408CBF] p-4 text-left text-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
          >
            <BentoWave color="#5B9FCC" animate={false} progress={0.34} cloudLike />
            <p className="relative z-10 text-xl font-semibold">{t("bentoRestroom")}</p>
            <p className="relative z-10 mt-1 text-[13px] text-[#DDEEFF]">
              {t("bentoRestroomSubtitle")}
            </p>
            <Image
              src="/icon/toilet.png"
              alt=""
              width={64}
              height={64}
              className="relative z-10 ml-auto mt-4 float-y"
            />
            <div className="absolute bottom-3 left-4 z-10 flex items-center gap-1.5">
              <span className="text-xs font-bold leading-none text-[#DDEEFF]">
                {toiletCountLoading ? "…" : toiletCount != null ? toiletCount : "—"}
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M7 10.5V20h3v-4h4v4h3V10.5"
                  stroke="#DDEEFF"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="6.5" r="2.4" stroke="#DDEEFF" strokeWidth="1.8" />
              </svg>
            </div>
          </Link>
          <Link
            href="/taxi"
            className="relative block min-h-[168px] overflow-hidden rounded-3xl bg-[#C33E83] p-4 text-left text-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
          >
            <BentoWave
              color="#D573A8"
              animate={false}
              progress={0.34}
              topRightToBottomLeft
              cloudLike
            />
            <p className="relative z-10 text-xl font-semibold">{t("bentoTaxiCardTitle")}</p>
            <p className="relative z-10 mt-1 text-[13px] text-pink-100">{t("bentoTaxiCardSubtitle")}</p>
            <span className="taxi-drive-in absolute right-3 bottom-3 z-10">
              <Image src="/icon/taxi.png" alt="" width={72} height={48} />
            </span>
          </Link>
        </div>
      </section>

      <AppFooter active="home" />
    </main>
  );
}
