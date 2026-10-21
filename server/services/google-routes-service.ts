import { serverEnv } from "../env";

export type DrivingRoute = {
  distanceKm: number;
  durationSeconds?: number;
  encodedPolyline?: string;
};

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json";

type LatLngInput = {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  referer?: string;
};

export async function computeDrivingRoute(input: LatLngInput): Promise<DrivingRoute | null> {
  const apiKey = serverEnv().googleApiKey;
  if (!apiKey) return null;

  const viaRoutes = await computeViaRoutesApi(apiKey, input);
  if (viaRoutes) return viaRoutes;
  return computeViaDirectionsApi(apiKey, input);
}

function googleBrowserHeaders(apiKey: string, referer?: string) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": apiKey,
  };
  const origin = referer?.trim();
  if (origin) {
    headers.Referer = origin;
    headers.Origin = origin.replace(/\/$/, "");
  }
  return headers;
}

async function computeViaRoutesApi(
  apiKey: string,
  input: LatLngInput,
): Promise<DrivingRoute | null> {
  const res = await fetch(ROUTES_URL, {
    method: "POST",
    headers: {
      ...googleBrowserHeaders(apiKey, input.referer),
      "X-Goog-FieldMask":
        "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
    },
    body: JSON.stringify({
      origin: {
        location: {
          latLng: { latitude: input.originLat, longitude: input.originLng },
        },
      },
      destination: {
        location: {
          latLng: { latitude: input.destLat, longitude: input.destLng },
        },
      },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_UNAWARE",
      polylineQuality: "HIGH_QUALITY",
    }),
    signal: AbortSignal.timeout(25_000),
  });
  const raw = await res.text();
  if (!res.ok) {
    console.error("Google Routes API failed", res.status, summarizeGoogleError(raw));
    return null;
  }

  const data = parseJson<{
    routes?: Array<{
      distanceMeters?: number;
      duration?: unknown;
      polyline?: { encodedPolyline?: string };
    }>;
  }>(raw);
  const first = data?.routes?.[0];
  const meters = first?.distanceMeters;
  if (typeof meters !== "number" || !Number.isFinite(meters) || meters <= 0) return null;

  const encoded = first?.polyline?.encodedPolyline?.trim();
  return {
    distanceKm: meters / 1000,
    durationSeconds: durationToSeconds(first?.duration),
    encodedPolyline: encoded || undefined,
  };
}

async function computeViaDirectionsApi(
  apiKey: string,
  input: LatLngInput,
): Promise<DrivingRoute | null> {
  const params = new URLSearchParams({
    origin: `${input.originLat},${input.originLng}`,
    destination: `${input.destLat},${input.destLng}`,
    mode: "driving",
    language: "th",
    key: apiKey,
  });
  const res = await fetch(`${DIRECTIONS_URL}?${params.toString()}`, {
    headers: googleBrowserHeaders(apiKey, input.referer),
    signal: AbortSignal.timeout(25_000),
  });
  const raw = await res.text();
  if (!res.ok) {
    console.error("Google Directions API HTTP failed", res.status, summarizeGoogleError(raw));
    return null;
  }

  const data = parseJson<{
    status?: string;
    error_message?: string;
    routes?: Array<{
      overview_polyline?: { points?: string };
      legs?: Array<{ distance?: { value?: number }; duration?: { value?: number } }>;
    }>;
  }>(raw);
  if (!data || data.status !== "OK") {
    console.error(
      "Google Directions API failed",
      data?.status ?? "UNKNOWN",
      data?.error_message ?? summarizeGoogleError(raw),
    );
    return null;
  }

  const first = data.routes?.[0];
  const meters = first?.legs?.reduce((sum, leg) => sum + (leg.distance?.value ?? 0), 0) ?? 0;
  if (!Number.isFinite(meters) || meters <= 0) return null;
  const durationSeconds = first?.legs?.reduce((sum, leg) => sum + (leg.duration?.value ?? 0), 0) ?? 0;

  const encoded = first?.overview_polyline?.points?.trim();
  return {
    distanceKm: meters / 1000,
    durationSeconds: durationSeconds > 0 ? Math.round(durationSeconds) : undefined,
    encodedPolyline: encoded || undefined,
  };
}

function durationToSeconds(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value);
  if (typeof value !== "string") return undefined;
  const match = /^(\d+(?:\.\d+)?)s$/.exec(value.trim());
  if (!match) return undefined;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  return Math.round(seconds);
}

function parseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function summarizeGoogleError(raw: string) {
  const text = raw.replaceAll(/key=[^&"\s]+/gi, "key=REDACTED").slice(0, 400);
  return text || "(empty)";
}
