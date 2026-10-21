"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatDistanceMeters } from "@/lib/geofence";
import { useI18n } from "@/lib/i18n/provider";
import { useTracking } from "@/lib/tracking-session";

export function TrackingWidget() {
  const { t } = useI18n();
  const path = usePathname();
  const { active, dest, metersAway, stop } = useTracking();

  if (!active || !dest || path.startsWith("/nearwake/map")) return null;

  const aboveFooter = path === "/home" || path === "/account";
  const href = `/nearwake/map?lat=${dest.lat}&lng=${dest.lon}&name=${encodeURIComponent(dest.name)}${
    dest.storeplaceUuid ? `&storeplaceUuid=${encodeURIComponent(dest.storeplaceUuid)}` : ""
  }${dest.fromFavorite ? "&from=favorite" : ""}`;

  return (
    <div className={`fixed inset-x-3 z-40 ${aboveFooter ? "bottom-24" : "bottom-4"}`}>
      <div className="flex items-center gap-3 rounded-2xl bg-[#29292E] px-4 py-3 text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
        <Link href={href} className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-wide text-[#9CA3AF] uppercase">
            {t("mapTrackingActive")}
          </p>
          <p className="truncate text-sm font-semibold">{dest.name}</p>
          {metersAway != null ? (
            <p className="text-xs text-[#BFC3CC]">
              {t("trackingDistanceShort")}:{" "}
              {formatDistanceMeters(metersAway, t("taxiFareKm"), t("mapRadiusMeters"))}
            </p>
          ) : null}
        </Link>
        <Link
          href={href}
          className="shrink-0 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[#29292E]"
        >
          {t("trackingWidgetOpenMap")}
        </Link>
        <button
          type="button"
          onClick={stop}
          className="shrink-0 rounded-xl bg-[#DC2626] px-3 py-2 text-xs font-semibold text-white"
        >
          {t("trackingWidgetStop")}
        </button>
      </div>
    </div>
  );
}
