"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  finishGoogleLogin,
  goHome,
  readGoogleRedirectResult,
} from "@/lib/google-gis";
import { useI18n } from "@/lib/i18n/provider";

export default function GoogleCallbackPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [message, setMessage] = useState(t("loggingInShort"));

  useEffect(() => {
    let cancelled = false;

    function fail(hint: string) {
      if (cancelled) return;
      setMessage(hint);
      window.setTimeout(() => router.replace("/login"), 2400);
    }

    async function run() {
      const result = readGoogleRedirectResult();
      if (!result.ok) {
        const me = await api("/api/v1/auth/me");
        if (me.body.isSuccess) {
          goHome();
          return;
        }
        const hint =
          result.error === "access_denied" || result.error === "missing_token"
            ? t("googleSignInFailed")
            : /redirect_uri|origin|client/i.test(result.error)
              ? t("googleOriginHint")
              : t("googleSignInFailed");
        fail(hint);
        return;
      }

      const outcome = await finishGoogleLogin(result.idToken);
      if (outcome.ok) {
        goHome();
        return;
      }
      fail(outcome.message === "cannot_reach" ? t("cannotReachServer") : outcome.message || t("googleSignInFailed"));
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [router, t]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-6 text-center text-sm text-[#4A4F57]">
      {message}
    </main>
  );
}
