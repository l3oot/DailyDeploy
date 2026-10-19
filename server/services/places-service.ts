import { fail, ok, TypeError, type ApiResponse } from "../lib/api-response";
import { autocompletePlaces, resolveGooglePlace } from "./google-places-service";
import { searchLongdoFirst, searchLongdoSuggestions } from "./longdo-service";
import { createLocation, type StorePlace } from "./nearwake-service";

export type ResolvedPlace = {
  lat: number;
  lon: number;
  name: string;
  source: "nearwake" | "longdo" | "google";
  storeplaceUuid?: string;
};

export type PlaceSearchSuggestion = {
  placeId: string;
  text: string;
  detail: string;
  source: "longdo" | "ggmap";
  lat?: number;
  lon?: number;
};

export async function searchPlaces(input: {
  query: string;
  skipLongdo?: boolean;
}): Promise<ApiResponse<{ suggestions: PlaceSearchSuggestion[]; source: "longdo" | "ggmap" }>> {
  const q = input.query.trim();
  if (q.length < 2) {
    return fail("input is required", TypeError.ValidationError);
  }

  if (!input.skipLongdo) {
    const longdo = await searchLongdoSuggestions(q).catch(() => []);
    if (longdo.length) {
      return ok({
        source: "longdo",
        suggestions: longdo.map((row) => ({
          placeId: row.placeId,
          text: row.text,
          detail: row.detail,
          source: "longdo" as const,
          lat: row.lat,
          lon: row.lon,
        })),
      });
    }
  }

  const google = await autocompletePlaces(q).catch(() => []);
  if (!google.length) {
    return fail("Place not found", TypeError.NotFound);
  }
  return ok({
    source: "ggmap",
    suggestions: google.map((row) => ({
      placeId: row.placeId,
      text: row.text,
      detail: row.detail,
      source: "ggmap" as const,
    })),
  });
}

export async function resolvePlace(input: {
  displayText: string;
  placeId?: string;
  placeDetail?: string;
  knownLat?: number | null;
  knownLon?: number | null;
  source?: string;
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
    const source =
      input.source === "longdo" ? "longdo" : input.source === "ggmap" ? "google" : "nearwake";
    return ok({
      lat: input.knownLat,
      lon: input.knownLon,
      name: displayText,
      source,
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

  if (!resolved) {
    const googleGuess = (await autocompletePlaces(displayText).catch(() => []))[0];
    if (googleGuess?.placeId) {
      const google = await resolveGooglePlace(googleGuess.placeId);
      if (google) {
        resolved = {
          lat: google.lat,
          lon: google.lon,
          name: google.name?.trim() || googleGuess.text || displayText,
          source: "google",
        };
      }
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
