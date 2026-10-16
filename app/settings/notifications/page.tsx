"use client";

import { useEffect, useState } from "react";
import { PageBack } from "@/components/page-back";
import { TopoPattern } from "@/components/topo-pattern";
import { useI18n } from "@/lib/i18n/provider";

const V_KEY = "da_notify_vibration";
const S_KEY = "da_notify_sound";

export default function NotificationSettingsPage() {
  const { t } = useI18n();
  const [vibration, setVibration] = useState(true);
  const [sound, setSound] = useState(true);

  useEffect(() => {
    setVibration(window.localStorage.getItem(V_KEY) !== "false");
    setSound(window.localStorage.getItem(S_KEY) !== "false");
  }, []);

  return (
    <main className="relative min-h-dvh">
      <TopoPattern />
      <div className="relative z-10 flex items-center px-1 pt-2">
        <PageBack href="/account" />
        <h1 className="text-lg font-semibold">{t("notifications")}</h1>
      </div>
      <section className="relative z-10 mx-auto max-w-lg px-5 pt-4">
        <Toggle
          label={t("notifyVibration")}
          value={vibration}
          onChange={(v) => {
            setVibration(v);
            window.localStorage.setItem(V_KEY, String(v));
          }}
        />
        <Toggle
          label={t("notifySound")}
          value={sound}
          onChange={(v) => {
            setSound(v);
            window.localStorage.setItem(S_KEY, String(v));
          }}
        />
      </section>
    </main>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="mb-4 flex items-center justify-between rounded-2xl bg-white px-4 py-4 shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
      <span className="font-semibold">{label}</span>
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-9 accent-[#4A89EA]"
      />
    </label>
  );
}
