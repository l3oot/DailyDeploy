import { serverEnv } from "../env";

export type GoogleSuggestion = {
  placeId: string;
  text: string;
  detail: string;
};

export type GooglePlace = {
  lat: number;
  lon: number;
  name?: string;
};

const ADDRESS_KEYWORDS = new Set([
  "หมู่ที่",
  "หมู่",
  "ถนน",
  "แขวง",
  "เขต",
  "ตำบล",
  "อำเภอ",
  "จังหวัด",
  "หมู่บ้าน",
  "ประเทศไทย",
  "กรุงเทพมหานคร",
  "นนทบุรี",
  "สมุทรปราการ",
  "ปทุมธานี",
]);

function splitPlaceText(placeText: string): { text: string; detail: string } {
  const parts = placeText.split(" ");
  let splitIndex = parts.length;
  for (let i = 1; i < parts.length; i++) {
    const word = parts[i] ?? "";
    const isNumber = word.length > 0 && word[0] >= "0" && word[0] <= "9";
    if (ADDRESS_KEYWORDS.has(word) || isNumber) {
      splitIndex = i;
      break;
    }
  }
  return {
    text: parts.slice(0, splitIndex).join(" ").trim() || placeText,
    detail: parts.slice(splitIndex).join(" ").trim(),
  };
}

export async function autocompletePlaces(input: string): Promise<GoogleSuggestion[]> {
  const apiKey = serverEnv().googleApiKey;
  const q = input.trim();
  if (!apiKey || q.length < 2) return [];

  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
    },
    body: JSON.stringify({
      input: q,
      languageCode: "th",
      locationBias: {
        circle: {
          center: { latitude: 13.7563309, longitude: 100.5017651 },
          radius: 50000.0,
        },
      },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    suggestions?: Array<{
      placePrediction?: { placeId?: string; text?: { text?: string } };
    }>;
  };

  return (data.suggestions ?? [])
    .slice(0, 8)
    .flatMap((item) => {
      const placeId = item.placePrediction?.placeId?.trim() ?? "";
      const raw = item.placePrediction?.text?.text?.trim() ?? "";
      if (!placeId || !raw) return [];
      const split = splitPlaceText(raw);
      return [{ placeId, text: split.text, detail: split.detail }];
    });
}

export async function resolveGooglePlace(placeId: string): Promise<GooglePlace | null> {
  const apiKey = serverEnv().googleApiKey;
  const id = placeId.trim();
  if (!apiKey || !id) return null;

  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`,
    {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "displayName,location",
      },
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!res.ok) return null;

  const data = (await res.json()) as {
    displayName?: { text?: string };
    location?: { latitude?: number; longitude?: number };
  };
  const lat = Number(data.location?.latitude);
  const lon = Number(data.location?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon, name: data.displayName?.text };
}
