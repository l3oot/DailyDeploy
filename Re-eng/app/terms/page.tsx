"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";

export default function TermsPage() {
  const { t } = useI18n();
  return (
    <main className="mx-auto min-h-dvh max-w-lg px-5 py-8">
      <Link href="/login" className="text-sm font-semibold text-[#4A89EA]">
        ← {t("welcomeSignIn")}
      </Link>
      <h1 className="mt-4 text-2xl font-bold">{t("termsOfServiceTitle")}</h1>
      <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-6 text-[#1A1A1A]">
        {t("termsBody")}
      </pre>
    </main>
  );
}
