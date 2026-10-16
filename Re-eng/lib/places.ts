import { api } from "./api";

export type PlaceSuggestion = {
  placeId: string;
  text: string;
  detail: string;
  source: "nearwake" | "ggmap";
  lat?: number;
  lon?: number;
  storeplaceUuid?: string;
};

export type ResolvedPlace = {
  lat: number;
  lon: number;
  name: string;
  source: "nearwake" | "longdo" | "google";
  storeplaceUuid?: string;
};

type GgmapPayload = {
  suggestions?: Array<{ placeId?: string; text?: string; detail?: string }>;
};

type NearwakeLocation = {
  storeplaceUuid?: string;
  placeId?: string;
  placeName?: string;
  placeDetail?: string;
  placeLat?: number;
  placeLon?: number;
};

export async function suggestPlaces(
  input: string,
  opts?: { skipNearwake?: boolean },
): Promise<{ suggestions: PlaceSuggestion[]; fromNearwake: boolean; error?: string }> {
  const q = input.trim();
  if (q.length < 2) return { suggestions: [], fromNearwake: false };

  if (!opts?.skipNearwake) {
    const nw = await api<NearwakeLocation[]>(
      `/api/v1/nearwake/location?PlaceName=${encodeURIComponent(q)}`,
    );
    if (nw.body.isSuccess && nw.body.data?.length) {
      return {
        fromNearwake: true,
        suggestions: nw.body.data.slice(0, 8).map((row) => ({
          placeId: row.placeId ?? "",
          text: row.placeName ?? "",
          detail: row.placeDetail ?? "",
          source: "nearwake" as const,
          lat: row.placeLat,
          lon: row.placeLon,
          storeplaceUuid: row.storeplaceUuid,
        })),
      };
    }
  }

  const gg = await api<GgmapPayload>(
    `/api/v1/ggmap/location?input=${encodeURIComponent(q)}`,
  );
  if (!gg.body.isSuccess) {
    return {
      suggestions: [],
      fromNearwake: false,
      error: gg.body.errorMessage || gg.body.message,
    };
  }
  return {
    fromNearwake: false,
    suggestions: (gg.body.data?.suggestions ?? []).map((row) => ({
      placeId: row.placeId ?? "",
      text: row.text ?? "",
      detail: row.detail ?? "",
      source: "ggmap" as const,
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
      knownLat: suggestion.source === "nearwake" ? suggestion.lat : undefined,
      knownLon: suggestion.source === "nearwake" ? suggestion.lon : undefined,
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
    },
  };
}
