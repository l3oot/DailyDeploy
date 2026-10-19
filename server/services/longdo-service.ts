import { serverEnv } from "../env";

export type LongdoPlace = {
  lat: number;
  lon: number;
  name?: string;
};

export type LongdoSuggestion = {
  placeId: string;
  text: string;
  detail: string;
  lat: number;
  lon: number;
};

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function searchLongdoSuggestions(keyword: string): Promise<LongdoSuggestion[]> {
  const key = serverEnv().longdoApiKey;
  const q = keyword.trim();
  if (!key || q.length < 2) {
    if (!key) console.warn("LONGDO_API_KEY is not set; skipping Longdo search");
    return [];
  }

  const uri = new URL("https://search.longdo.com/mapsearch/json/search");
  uri.searchParams.set("keyword", q);
  uri.searchParams.set("key", key);

  try {
    const res = await fetch(uri, { signal: AbortSignal.timeout(20_000) });
    if (res.status === 404) return [];
    const text = await res.text();
    if (!res.ok || !text.trim().startsWith("{")) return [];
    const root = JSON.parse(text) as { data?: Array<Record<string, unknown>> };
    const list = root.data ?? [];
    const ranked = [...list].sort((a, b) => Number(b.type === "poi") - Number(a.type === "poi"));

    const suggestions: LongdoSuggestion[] = [];
    for (const item of ranked) {
      const lat = Number(item.lat);
      const lon = Number(item.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const name = asText(item.name) || q;
      const id = asText(item.id) || `longdo:${lat.toFixed(5)},${lon.toFixed(5)}`;
      suggestions.push({
        placeId: id.slice(0, 80),
        text: name,
        detail: asText(item.address),
        lat,
        lon,
      });
      if (suggestions.length >= 8) break;
    }
    return suggestions;
  } catch {
    return [];
  }
}

export async function searchLongdoFirst(keyword: string): Promise<LongdoPlace | null> {
  const first = (await searchLongdoSuggestions(keyword))[0];
  if (!first) return null;
  return { lat: first.lat, lon: first.lon, name: first.text };
}
