"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, type SessionUser } from "@/lib/api";
import { isGuest } from "@/lib/guest";
import { useI18n } from "@/lib/i18n/provider";

export default function SessionStartPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [retry, setRetry] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (isGuest()) {
        router.replace("/home");
        return;
      }
      try {
        let me = await api<SessionUser>("/api/v1/auth/me");
        if (me.status === 401) {
          const refreshed = await api("/api/v1/auth/refreshtoken", {
            method: "POST",
            body: JSON.stringify({}),
          });
          if (refreshed.body.isSuccess) {
            me = await api<SessionUser>("/api/v1/auth/me");
          }
        }
        if (cancelled) return;
        if (me.body.isSuccess) {
          router.replace("/home");
          return;
        }
        router.replace("/welcome");
      } catch {
        if (!cancelled) setRetry(true);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
      <p className="text-lg font-medium text-[#8E8E93]">{t("restoringSession")}</p>
      {retry ? (
        <button
          type="button"
          className="rounded-full bg-[#4A89EA] px-6 py-3 font-semibold text-white"
          onClick={() => {
            setRetry(false);
            window.location.reload();
          }}
        >
          {t("retry")}
        </button>
      ) : null}
    </main>
  );
}
