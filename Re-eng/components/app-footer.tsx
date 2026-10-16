"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n/provider";
import type { MoodKey } from "@/lib/moods";

const FAB = 56;
const BURST_R = 78;
const STACK_W = 180;
const STACK_H = 148;
const DOT_MIN = 15;
const DOT_MAX = 39;
const SPREAD = Math.PI * 0.85;
const MOODS: { src: string; label: "moodSad" | "moodConfused" | "moodSmile" | "moodHappy" | "moodVeryHappy"; key: MoodKey }[] = [
  { src: "/icon/sad.png", label: "moodSad", key: "sad" },
  { src: "/icon/confused.png", label: "moodConfused", key: "confused" },
  { src: "/icon/smile.png", label: "moodSmile", key: "smile" },
  { src: "/icon/happy-face.png", label: "moodHappy", key: "happy" },
  { src: "/icon/happy-face-push.png", label: "moodVeryHappy", key: "very_happy" },
];

function easeOutBack(x: number) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (x - 1) ** 3 + c1 * (x - 1) ** 2;
}

function burstGeom(i: number, v: number) {
  const stagger = 0.1;
  const denom = Math.max(0.2, 1 - 4 * stagger);
  const raw = Math.min(1, Math.max(0, (v - i * stagger) / denom));
  const t = easeOutBack(raw);
  if (t < 0.01) return null;
  const angle = -SPREAD / 2 + (SPREAD / 4) * i;
  const size = DOT_MIN + (DOT_MAX - DOT_MIN) * t;
  const fabCenterFromBottom = FAB / 2;
  return {
    size,
    opacity: Math.min(1, t * 1.15),
    left: STACK_W / 2 + BURST_R * Math.sin(angle) * t - size / 2,
    bottom: fabCenterFromBottom + BURST_R * Math.cos(angle) * t - size / 2,
  };
}

export function AppFooter({ active }: { active: "home" | "account" }) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuShown, setMenuShown] = useState(false);
  const [burst, setBurst] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [menuRadius, setMenuRadius] = useState(288);
  const burstDir = useRef<"fwd" | "rev" | null>(null);
  const burstVal = useRef(0);
  const holdTimer = useRef<number>(0);
  const holding = useRef(false);
  const draggedOff = useRef(false);
  const hoveredRef = useRef<number | null>(null);
  const stackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    function tick(now: number) {
      const dir = burstDir.current;
      if (dir) {
        const dur = dir === "fwd" ? 720 : 380;
        const delta = (now - last) / dur;
        burstVal.current =
          dir === "fwd"
            ? Math.min(1, burstVal.current + delta)
            : Math.max(0, burstVal.current - delta);
        setBurst(burstVal.current);
        if (burstVal.current === 1 || burstVal.current === 0) {
          burstDir.current = null;
        }
      }
      last = now;
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    function updateRadius() {
      setMenuRadius(Math.hypot(window.innerWidth, window.innerHeight) * 0.36);
    }
    updateRadius();
    window.addEventListener("resize", updateRadius);
    return () => window.removeEventListener("resize", updateRadius);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const id = window.setTimeout(() => setMenuShown(true), 16);
    return () => window.clearTimeout(id);
  }, [menuOpen]);

  function closeMenu() {
    setMenuShown(false);
    window.setTimeout(() => setMenuOpen(false), 340);
  }

  function setHover(index: number | null) {
    if (hoveredRef.current === index) return;
    hoveredRef.current = index;
    setHovered(index);
    if (index != null) navigator.vibrate?.(10);
  }

  function hitMood(clientX: number, clientY: number) {
    const el = stackRef.current;
    const opened = burstVal.current > 0.001 || burstDir.current === "fwd";
    if (!el || !opened) return null;
    const v = Math.max(burstVal.current, 0.85);
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    let hit: number | null = null;
    let best = Infinity;
    for (let i = 0; i < MOODS.length; i++) {
      const g = burstGeom(i, v);
      if (!g) continue;
      const cx = g.left + g.size / 2;
      const cy = rect.height - g.bottom - g.size / 2;
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.max(g.size * 0.52, 22);
      const dist = dx * dx + dy * dy;
      if (dist <= r * r && dist < best) {
        best = dist;
        hit = i;
      }
    }
    return hit;
  }

  function startHold() {
    holding.current = true;
    draggedOff.current = false;
    setHover(null);
    holdTimer.current = window.setTimeout(() => {
      if (!holding.current) return;
      burstDir.current = "fwd";
    }, 280);
  }

  function endHold() {
    holding.current = false;
    window.clearTimeout(holdTimer.current);
    const wasBurst = burstVal.current > 0.001 || burstDir.current === "fwd";
    if (wasBurst) burstDir.current = "rev";
    setHover(null);
    return wasBurst;
  }

  function onFabPointerDown(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    startHold();
  }

  function onFabPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!holding.current) return;
    const fab = event.currentTarget.getBoundingClientRect();
    const cx = fab.left + fab.width / 2;
    const cy = fab.top + fab.height / 2;
    const dist = Math.hypot(event.clientX - cx, event.clientY - cy);
    if (dist > fab.width / 2 + 8) {
      draggedOff.current = true;
      if (burstVal.current < 0.001 && burstDir.current !== "fwd") {
        window.clearTimeout(holdTimer.current);
        burstDir.current = "fwd";
      }
    }
    setHover(hitMood(event.clientX, event.clientY));
  }

  function onFabPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const selected = hoveredRef.current;
    const dragged = draggedOff.current;
    const wasBurst = endHold();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const mood = selected != null ? MOODS[selected] : null;
    if (mood) {
      void persistMood(mood.key, t(mood.label));
      return;
    }
    if (wasBurst || dragged) return;
    if (burstVal.current > 0.05) return;
    setMenuOpen(true);
  }

  function onFabPointerCancel(event: PointerEvent<HTMLButtonElement>) {
    endHold();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  async function persistMood(moodKey: MoodKey, label: string) {
    try {
      const { status, body } = await api("/api/v1/moods", {
        method: "POST",
        body: JSON.stringify({ moodKey }),
      });
      if (status === 401) {
        setToast(t("moodLoginRequired"));
      } else if (!body.isSuccess) {
        setToast(t("moodSaveFailed"));
      } else {
        setToast(`${t("moodSaved")} · ${label}`);
      }
    } catch {
      setToast(t("moodSaveFailed"));
    }
    window.setTimeout(() => setToast(""), 2200);
  }

  function rateApp() {
    closeMenu();
    setToast(t("snackLinkNotConfigured"));
    window.setTimeout(() => setToast(""), 2200);
  }

  return (
    <>
      <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-30 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="relative mx-auto max-w-lg">
          <div
            ref={stackRef}
            className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2"
            style={{ width: STACK_W, height: STACK_H, bottom: 8 }}
          >
            {MOODS.map((mood, i) => {
              const g = burstGeom(i, burst);
              if (!g) return null;
              return (
                <div
                  key={mood.src}
                  className="absolute overflow-hidden rounded-full bg-white shadow-[0_4px_16px_rgba(0,0,0,0.16)] transition-transform duration-200"
                  style={{
                    width: g.size,
                    height: g.size,
                    left: g.left,
                    bottom: g.bottom,
                    opacity: g.opacity,
                    transform: `scale(${hovered === i ? 1.22 : 1})`,
                    padding: Math.min(4.5, Math.max(2, g.size * 0.1)),
                  }}
                >
                  <Image
                    src={mood.src}
                    alt=""
                    width={39}
                    height={39}
                    className="pointer-events-none h-full w-full object-cover"
                  />
                </div>
              );
            })}
          </div>

          <div className="pointer-events-auto relative flex h-[60px] items-center rounded-[26px] bg-white shadow-[0_8px_20px_rgba(0,0,0,0.18)]">
            <Link
              href="/home"
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-xs ${
                active === "home" ? "font-bold text-[#4A89EA]" : "font-medium text-[#8E8E93]"
              }`}
            >
              <HomeIcon />
              {t("footerHome")}
            </Link>
            <div style={{ width: FAB }} />
            <Link
              href="/account"
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-xs ${
                active === "account" ? "font-bold text-[#4A89EA]" : "font-medium text-[#8E8E93]"
              }`}
            >
              <PersonIcon />
              {t("footerProfile")}
            </Link>
          </div>

          <button
            type="button"
            aria-label="menu"
            onPointerDown={onFabPointerDown}
            onPointerMove={onFabPointerMove}
            onPointerUp={onFabPointerUp}
            onPointerCancel={onFabPointerCancel}
            onContextMenu={(e) => e.preventDefault()}
            className="pointer-events-auto absolute left-1/2 z-30 -translate-x-1/2 touch-none rounded-full select-none"
            style={{
              width: FAB,
              height: FAB,
              bottom: 8,
              background:
                "radial-gradient(circle at 35% 30%, #6A6A72 0%, #1E1E22 95%)",
              boxShadow:
                "0 -2px 12px rgba(190,190,198,0.35), 0 8px 16px rgba(0,0,0,0.34)",
            }}
          />
        </div>
      </nav>

      {menuOpen ? (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label="close menu"
            className="absolute inset-0 bg-black/30"
            style={{
              WebkitMaskImage: menuShown
                ? `radial-gradient(circle ${menuRadius}px at calc(100% - 4px) 4px, transparent 99%, #000 100%)`
                : "none",
              maskImage: menuShown
                ? `radial-gradient(circle ${menuRadius}px at calc(100% - 4px) 4px, transparent 99%, #000 100%)`
                : "none",
            }}
            onClick={closeMenu}
          />
          <div
            className="absolute inset-0 bg-white shadow-2xl"
            style={{
              clipPath: menuShown
                ? `circle(${menuRadius}px at calc(100% - 4px) 4px)`
                : "circle(0px at calc(100% - 4px) 4px)",
              transition: menuShown
                ? "clip-path 420ms cubic-bezier(0.33,1,0.68,1)"
                : "clip-path 340ms cubic-bezier(0.32,0,0.67,0)",
            }}
          >
            <div className="flex flex-col items-stretch pt-4 pr-3 pl-8 text-right">
              <p className="px-3 py-4 text-2xl font-bold">{t("welcomeBrand")}</p>
              <button
                type="button"
                className="flex items-center justify-end gap-3 rounded-xl px-3 py-3 text-base"
                onClick={rateApp}
              >
                {t("menuRateApp")}
                <StarIcon />
              </button>
              <button
                type="button"
                className="flex items-center justify-end gap-3 rounded-xl px-3 py-3 text-base"
                onClick={() => {
                  closeMenu();
                  setPayOpen(true);
                }}
              >
                {t("menuPaymentQr")}
                <QrIcon />
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {payOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold">{t("menuPaymentQr")}</h2>
            <Image
              src="/icon/pay.jpeg"
              alt=""
              width={360}
              height={360}
              className="mt-3 w-full rounded-xl"
            />
            <p className="mt-4 text-sm leading-relaxed">{t("paymentAccountName")}</p>
            <p className="mt-1 text-sm">{t("paymentBankName")}</p>
            <button
              type="button"
              className="mt-4 w-full rounded-xl bg-[#4A89EA] py-2 font-semibold text-white"
              onClick={() => setPayOpen(false)}
            >
              {t("ok")}
            </button>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-28 left-1/2 z-50 -translate-x-1/2 rounded-full bg-[#29292E] px-4 py-2 text-sm text-white">
          {toast}
        </div>
      ) : null}
    </>
  );
}

function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 3.2 3 11h2.2V20h5.3v-6h3V20H18.8V11H21L12 3.2Z" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 12a4.2 4.2 0 1 0-4.2-4.2A4.2 4.2 0 0 0 12 12Zm0 2.2c-3.4 0-8 1.7-8 5V21h16v-1.8c0-3.3-4.6-5-8-5Z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#1A1A1A" aria-hidden>
      <path d="m12 3.2 2.5 6.1 6.6.6-5 4.5 1.5 6.4L12 17.4 6.4 20.8 7.9 14.4l-5-4.5 6.6-.6Z" />
    </svg>
  );
}

function QrIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="#1A1A1A" aria-hidden>
      <path d="M3 3h8v8H3V3Zm2 2v4h4V5H5Zm8-2h8v8h-8V3Zm2 2v4h4V5h-4ZM3 13h8v8H3v-8Zm2 2v4h4v-4H5Zm10 6v-2h2v2h-2Zm4-6h2v2h-2v-2Zm-4 0h2v2h-2v-2Zm4 4h2v4h-2v-4Zm-2 2h2v2h-2v-2Z" />
    </svg>
  );
}
