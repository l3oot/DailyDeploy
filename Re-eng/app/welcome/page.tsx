"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ButtonWave, WaveBackground } from "@/components/wave-bg";
import { LanguageSwitcher } from "@/components/language-switcher";
import { setGuest } from "@/lib/guest";
import { useI18n } from "@/lib/i18n/provider";

export default function WelcomePage() {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <WaveBackground className="absolute inset-0" />
      <div className="relative z-10 flex justify-end p-4">
        <LanguageSwitcher />
      </div>
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-8 text-center">
        <Image src="/icon/logo.png" alt="" width={112} height={112} priority />
        <p className="mt-7 text-[22px] font-semibold tracking-wide text-[#8E8E93]">
          {t("welcomeTitle")}
        </p>
        <h1 className="mt-1 text-5xl font-bold tracking-wide text-[#1A1A1A]">
          {t("welcomeBrand")}
        </h1>
        <p className="mt-3 text-lg font-medium text-[#8E8E93]">{t("welcomeSubtitle")}</p>
      </div>
      <div className="relative z-10 mx-auto w-full max-w-md px-6 pb-10">
        <Link
          href="/login"
          className="relative flex items-center justify-center overflow-hidden rounded-3xl bg-[#4A89EA] py-3.5 text-xl font-semibold tracking-wide text-white"
        >
          <ButtonWave />
          <span className="relative">{t("welcomeSignIn")}</span>
        </Link>
        <button
          type="button"
          className="mt-4 w-full py-2 text-[15px] font-semibold tracking-wide text-[#4A89EA]"
          onClick={() => {
            setGuest(true);
            router.replace("/home");
          }}
        >
          {t("welcomeContinueGuest")}
        </button>
      </div>
    </main>
  );
}
