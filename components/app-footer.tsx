"use client";

import { House, Settings } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";

const tabs = [
  { href: "/home", id: "home", label: "footerHome" },
  { href: "/account", id: "settings", label: "footerSettings" },
] as const;

export function AppFooter({ active }: { active?: (typeof tabs)[number]["id"] }) {
  const { t } = useI18n();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-[#EEF1F4] bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="relative mx-auto max-w-lg">
        <div className="relative flex h-12 items-center bg-white">
          {tabs.map((tab) => {
            const on = active === tab.id;
            return (
              <Link
                key={tab.id}
                href={tab.href}
                aria-current={on ? "page" : undefined}
                className={`flex flex-1 flex-col items-center justify-center gap-1 text-[12px] leading-none ${
                  on ? "font-semibold text-[#3B82F6]" : "font-medium text-[#A0A8B3]"
                }`}
              >
                {tab.id === "home" ? (
                  <House className="h-6 w-6" strokeWidth={2.5} aria-hidden="true" />
                ) : (
                  <Settings className="h-6 w-6" strokeWidth={2.5} aria-hidden="true" />
                )}
                {t(tab.label)}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
