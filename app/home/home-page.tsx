"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  AlarmClock,
  CarTaxiFront,
  CircleParking,
  CloudRain,
  Fuel,
  Toilet,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { AppFooter } from "@/components/app-footer";
import { api, type SessionUser } from "@/lib/api";
import { isGuest } from "@/lib/guest";
import { useI18n } from "@/lib/i18n/provider";

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M9 6.5 15 12l-6 5.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FeatureCard({
  href,
  badge,
  icon: Icon,
  title,
  body,
  tone,
  art,
}: {
  href: string;
  badge: string;
  icon: LucideIcon;
  title: string;
  body: string;
  tone: "blue" | "green" | "amber";
  art?: ReactNode;
}) {
  const tones = {
    blue: { card: "bg-[#F3F8FF]", badge: "bg-[#DCEEFF] text-[#3B82F6]" },
    green: { card: "bg-[#F3FBF6]", badge: "bg-[#DDF6E6] text-[#2EAF62]" },
    amber: { card: "bg-[#FFF8EE]", badge: "bg-[#FFE8C4] text-[#E39B2B]" },
  }[tone];

  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-[28px] p-4 pr-3 ${tones.card}`}
    >
      <div className="min-w-0 flex-1">
        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-semibold ${tones.badge}`}>
          <Icon className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
          {badge}
        </span>
        <p className="mt-3 text-[20px] font-bold leading-snug text-[#1B2430]">{title}</p>
        <p className="mt-1 whitespace-pre-line text-[13px] leading-5 text-[#8B95A1]">{body}</p>
      </div>
      {art}
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/80 text-[#C5CDD6]">
        <Chevron />
      </span>
    </Link>
  );
}

export default function HomePage() {
  const { t } = useI18n();
  const [guest, setGuestState] = useState(false);
  const [pictureUrl, setPictureUrl] = useState<string | undefined>();
  const [userName, setUserName] = useState("");
  const [dialog, setDialog] = useState(false);
  const [wave, setWave] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setWave(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const guestMode = isGuest();
    setGuestState(guestMode);
    if (guestMode) return;
    void api<SessionUser>("/api/v1/auth/me").then((me) => {
      const data = me.body.data;
      if (!data) return;
      if (data.pictureUrl) setPictureUrl(data.pictureUrl);
      const name = data.userName?.trim();
      if (name && name !== "—" && name !== "-") setUserName(name);
    });
  }, []);

  const soonTools: { label: string; color: string; icon: LucideIcon }[] = [
    { label: t("homeGas"), color: "bg-[#FDE8EA] text-[#E25C6A]", icon: Fuel },
    { label: t("homeFood"), color: "bg-[#F0E8FB] text-[#8B5CF6]", icon: Utensils },
    { label: t("homeParking"), color: "bg-[#E7F0FB] text-[#3B82F6]", icon: CircleParking },
    { label: t("homeRain"), color: "bg-[#E5F6EA] text-[#2EAF62]", icon: CloudRain },
  ];

  return (
    <main className="relative min-h-dvh bg-white pb-28">
      <div className="mx-auto w-full max-w-[430px] px-5 pt-6">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[#1B2430]">
              {t("homeHelloWord")}
              {userName ? ` ${userName}` : ""}{" "}
              <span className={wave ? "hi-wave" : "inline-block"} aria-hidden="true">
                👋
              </span>
            </h1>
            <p className="mt-0.5 text-[15px] text-[#8B95A1]">{t("welcomeLead")}</p>
            {guest ? (
              <p className="mt-1 text-sm font-medium text-[#3B82F6]">{t("guestBadge")}</p>
            ) : null}
          </div>
          <Link
            href="/account"
            aria-label={t("accountTitle")}
            className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F2F4F7] text-[#9AA3AE]"
          >
            {pictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pictureUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
                <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
                <path
                  d="M5.5 19.2c1.2-3 3.5-4.4 6.5-4.4s5.3 1.4 6.5 4.4"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </Link>
        </header>

        <section className="mt-5 grid gap-3">
          <FeatureCard
            href="/nearwake"
            tone="blue"
            icon={AlarmClock}
            badge={t("nearAlarm")}
            title={t("homeNearTitle")}
            body={t("homeNearBody")}
          />
          <FeatureCard
            href="/toilet"
            tone="green"
            icon={Toilet}
            badge={t("bentoRestroom")}
            title={t("homeToiletTitle")}
            body={t("homeToiletBody")}
          />
          <FeatureCard
            href="/taxi"
            tone="amber"
            icon={CarTaxiFront}
            badge={t("bentoTaxiCardTitle")}
            title={t("homeTaxiTitle")}
            body={t("homeTaxiBody")}
            art={
              <Image
                src="/icon/taxi.png"
                alt=""
                width={92}
                height={64}
                className="h-16 w-auto shrink-0 object-contain"
              />
            }
          />
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-bold text-[#1B2430]">{t("homeMoreTools")}</h2>
            <button
              type="button"
              onClick={() => setDialog(true)}
              className="flex items-center gap-0.5 text-[14px] font-medium text-[#8B95A1]"
            >
              {t("homeSeeAll")}
              <Chevron />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {soonTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.label}
                  type="button"
                  onClick={() => setDialog(true)}
                  className="flex flex-col items-center gap-2"
                >
                  <span className={`flex h-16 w-full items-center justify-center rounded-2xl ${tool.color}`}>
                    <Icon className="h-7 w-7" strokeWidth={2.5} aria-hidden="true" />
                  </span>
                  <span className="text-center text-[12px] leading-4 text-[#5C6570]">{tool.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {dialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="home-soon-title"
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
          >
            <h2 id="home-soon-title" className="text-lg font-semibold text-[#1B2430]">
              {t("homeMoreTools")}
            </h2>
            <p className="mt-2 text-sm text-[#8B95A1]">{t("comingPhase2")}</p>
            <button
              type="button"
              className="mt-4 w-full rounded-xl bg-[#3B82F6] py-2.5 font-semibold text-white"
              onClick={() => setDialog(false)}
            >
              {t("ok")}
            </button>
          </div>
        </div>
      ) : null}

      <AppFooter active="home" />
    </main>
  );
}
