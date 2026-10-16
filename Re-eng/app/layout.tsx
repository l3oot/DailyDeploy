import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Prompt } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { LocaleProvider } from "@/lib/i18n/provider";
import "./globals.css";

const prompt = Prompt({
  variable: "--font-prompt",
  subsets: ["latin", "thai"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Daily App",
  description: "Daily — ใกล้ถึงปลุก, ห้องน้ำตรงใจ, คำนวณค่าแท็กซี่",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="th" className={`${prompt.variable} h-full antialiased`}>
      <body className="min-h-full bg-background font-sans text-foreground">
        <LocaleProvider>
          <AppShell>{children}</AppShell>
        </LocaleProvider>
      </body>
    </html>
  );
}
