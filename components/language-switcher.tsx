"use client";

import Image from "next/image";
import { useI18n } from "@/lib/i18n/provider";

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const next = locale === "th" ? "en" : "th";
  const src = locale === "th" ? "/icon/thai.png" : "/icon/kingdom.png";

  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 shadow-sm ring-1 ring-black/5"
      aria-label={locale === "th" ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}
    >
      <Image src={src} alt="" width={28} height={28} />
    </button>
  );
}

/** สองวงธงเคียงกัน — แบบ `DailyAppLanguageRowSelector` ในแอป Flutter */
export function LanguageRowSelector() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="flex items-center gap-2.5">
      <FlagCircle selected={locale === "th"} src="/icon/thai.png" label="ไทย" onClick={() => setLocale("th")} />
      <FlagCircle
        selected={locale === "en"}
        src="/icon/kingdom.png"
        label="English"
        onClick={() => setLocale("en")}
      />
    </div>
  );
}

function FlagCircle({
  selected,
  src,
  label,
  onClick,
}: {
  selected: boolean;
  src: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      className={`flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF8F0] ${
        selected ? "shadow-[0_2px_8px_rgba(0,0,0,0.12)] ring-2 ring-[#4A89EA]" : "ring-1 ring-black/5"
      }`}
    >
      <Image src={src} alt="" width={26} height={26} className="rounded-sm object-cover" />
    </button>
  );
}
