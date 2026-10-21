"use client";

import { AppFooter } from "@/components/app-footer";
import { useI18n } from "@/lib/i18n/provider";

export default function ActivityPage() {
  const { t } = useI18n();

  return (
    <main className="relative min-h-dvh bg-white pb-28">
      <div className="mx-auto w-full max-w-[430px] px-5 pt-6">
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-[#1B2430]">
          {t("footerList")}
        </h1>
        <p className="mt-2 text-[15px] text-[#8B95A1]">{t("comingPhase2")}</p>
      </div>
      <AppFooter />
    </main>
  );
}
