import { fail, ok, TypeError, type ApiResponse } from "../lib/api-response";
import { resolveGooglePlace } from "./google-places-service";
import { searchLongdoFirst } from "./longdo-service";
import { createLocation, type StorePlace } from "./nearwake-service";

export type ResolvedPlace = {
  lat: number;
  lon: number;
  name: string;
  source: "nearwake" | "longdo" | "google";
  storeplaceUuid?: string;
};

export async function resolvePlace(input: {
  displayText: string;
  placeId?: string;
  placeDetail?: string;
  knownLat?: number | null;
  knownLon?: number | null;
  persist?: boolean;
}): Promise<ApiResponse<ResolvedPlace>> {
  const displayText = input.displayText.trim();
  if (displayText.length < 2) {
    return fail("displayText is required", TypeError.ValidationError);
  }

  if (
    input.knownLat != null &&
    input.knownLon != null &&
    Number.isFinite(input.knownLat) &&
    Number.isFinite(input.knownLon)
  ) {
    return ok({
      lat: input.knownLat,
      lon: input.knownLon,
      name: displayText,
      source: "nearwake",
    });
  }

  const longdo = await searchLongdoFirst(displayText).catch(() => null);
  let resolved: ResolvedPlace | null = longdo
    ? {
        lat: longdo.lat,
        lon: longdo.lon,
        name: longdo.name?.trim() || displayText,
        source: "longdo",
      }
    : null;

  if (!resolved && input.placeId?.trim()) {
    const google = await resolveGooglePlace(input.placeId);
    if (google) {
      resolved = {
        lat: google.lat,
        lon: google.lon,
        name: google.name?.trim() || displayText,
        source: "google",
      };
    }
  }

  if (!resolved) return fail("Place not found", TypeError.NotFound);

  if (input.persist && resolved.source !== "nearwake") {
    const saved: ApiResponse<StorePlace> = await createLocation({
      placeId: input.placeId ?? "",
      placeName: displayText,
      placeDetail: input.placeDetail ?? "",
      placeLat: resolved.lat,
      placeLon: resolved.lon,
    });
    if (saved.isSuccess && saved.data) {
      resolved.storeplaceUuid = saved.data.storeplaceUuid;
    }
  }

  return ok(resolved);
}
