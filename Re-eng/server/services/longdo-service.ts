import { serverEnv } from "../env";

export type LongdoPlace = {
  lat: number;
  lon: number;
  name?: string;
};

export async function searchLongdoFirst(keyword: string): Promise<LongdoPlace | null> {
  const key = serverEnv().longdoApiKey;
  const q = keyword.trim();
  if (!key || q.length < 2) {
    if (!key) console.warn("LONGDO_API_KEY is not set; skipping Longdo search");
    return null;
  }

  const uri = new URL("https://search.longdo.com/mapsearch/json/search");
  uri.searchParams.set("keyword", q);
  uri.searchParams.set("key", key);

  try {
    const res = await fetch(uri, { signal: AbortSignal.timeout(20_000) });
    const text = await res.text();
    if (!res.ok || !text.trim().startsWith("{")) return null;
    const root = JSON.parse(text) as { data?: Array<Record<string, unknown>> };
    const list = root.data;
    if (!list?.length) return null;

    const poi = list.find(
      (item) => item.type === "poi" && item.lat != null && item.lon != null,
    );
    const pick = poi ?? list[0];
    const lat = Number(pick.lat);
    const lon = Number(pick.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    return {
      lat,
      lon,
      name: typeof pick.name === "string" ? pick.name : undefined,
    };
  } catch {
    return null;
  }
}
