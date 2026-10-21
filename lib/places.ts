import { api } from "./api";

export type PlaceSuggestion = {
  placeId: string;
  text: string;
  detail: string;
  source: "nearwake" | "ggmap" | "longdo";
  lat?: number;
  lon?: number;
  storeplaceUuid?: string;
};

export type ResolvedPlace = {
  lat: number;
  lon: number;
  name: string;
  detail?: string;
  source: "nearwake" | "longdo" | "google";
  storeplaceUuid?: string;
};

type SearchPayload = {
  source?: "longdo" | "ggmap";
  suggestions?: Array<{
    placeId?: string;
    text?: string;
    detail?: string;
    source?: PlaceSuggestion["source"];
    lat?: number;
    lon?: number;
  }>;
};

export async function suggestPlaces(
  input: string,
  opts?: { skipLongdo?: boolean },
): Promise<{ suggestions: PlaceSuggestion[]; fromLongdo: boolean; error?: string }> {
  const q = input.trim();
  if (q.length < 2) return { suggestions: [], fromLongdo: false };

  const params = new URLSearchParams({ input: q });
  if (opts?.skipLongdo) params.set("skipLongdo", "1");
  const res = await api<SearchPayload>(`/api/v1/places/search?${params.toString()}`);
  if (!res.body.isSuccess) {
    return {
      suggestions: [],
      fromLongdo: false,
      error: res.body.errorMessage || res.body.message,
    };
  }
  const source = res.body.data?.source === "longdo" ? "longdo" : "ggmap";
  return {
    fromLongdo: source === "longdo",
    suggestions: (res.body.data?.suggestions ?? []).map((row) => ({
      placeId: row.placeId ?? "",
      text: row.text ?? "",
      detail: row.detail ?? "",
      source: row.source === "longdo" ? "longdo" : source,
      lat: row.lat,
      lon: row.lon,
    })),
  };
}

export type StorePlace = {
  storeplaceUuid: string;
  placeId: string;
  placeName: string;
  placeDetail: string;
  placeLat: number;
  placeLon: number;
};

export async function persistStorePlace(input: {
  placeId?: string;
  placeName: string;
  placeDetail?: string;
  lat: number;
  lon: number;
}): Promise<{ storeplaceUuid?: string; status: number; error?: string }> {
  const { status, body } = await api<StorePlace>("/api/v1/nearwake/location", {
    method: "POST",
    body: JSON.stringify({
      placeId: input.placeId ?? "",
      placeName: input.placeName,
      placeDetail: input.placeDetail ?? "",
      placeLat: input.lat,
      placeLon: input.lon,
    }),
  });
  if (!body.isSuccess || !body.data?.storeplaceUuid) {
    return { status, error: body.errorMessage || body.message };
  }
  return { status, storeplaceUuid: body.data.storeplaceUuid };
}

export async function resolveSelectedPlace(
  suggestion: PlaceSuggestion,
): Promise<{ place: ResolvedPlace | null; error?: string }> {
  const { status, body } = await api<ResolvedPlace>("/api/v1/places/resolve", {
    method: "POST",
    body: JSON.stringify({
      displayText: suggestion.text,
      placeId: suggestion.placeId,
      placeDetail: suggestion.detail,
      source: suggestion.source,
      persist: suggestion.source !== "nearwake",
      knownLat:
        suggestion.source === "nearwake" || suggestion.source === "longdo"
          ? suggestion.lat
          : undefined,
      knownLon:
        suggestion.source === "nearwake" || suggestion.source === "longdo"
          ? suggestion.lon
          : undefined,
    }),
  });
  if (!body.isSuccess || !body.data) {
    return {
      place: null,
      error: body.errorMessage || body.message || `HTTP ${status}`,
    };
  }
  let storeplaceUuid = body.data.storeplaceUuid || suggestion.storeplaceUuid;
  if (!storeplaceUuid && suggestion.source !== "nearwake") {
    const saved = await persistStorePlace({
      placeId: suggestion.placeId,
      placeName: suggestion.text,
      placeDetail: suggestion.detail,
      lat: body.data.lat,
      lon: body.data.lon,
    });
    storeplaceUuid = saved.storeplaceUuid;
  }
  return {
    place: {
      ...body.data,
      storeplaceUuid,
      detail: suggestion.detail || body.data.detail || undefined,
    },
  };
}
