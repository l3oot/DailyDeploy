"use client";

import type { ReactNode } from "react";
import { TrackingWidget } from "@/components/tracking-widget";
import { TrackingProvider } from "@/lib/tracking-session";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <TrackingProvider>
      {children}
      <TrackingWidget />
    </TrackingProvider>
  );
}
