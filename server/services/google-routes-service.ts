import { serverEnv } from "../env";

export type DrivingRoute = {
  distanceKm: number;
  encodedPolyline?: string;
};

const ROUTES_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";

export async function computeDrivingRoute(input: {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
}): Promise<DrivingRoute | null> {
  const apiKey = serverEnv().googleApiKey;
  if (!apiKey) return null;

  const res = await fetch(ROUTES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
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
  if (!res.ok) return null;

  const data = (await res.json()) as {
    routes?: Array<{
      distanceMeters?: number;
      polyline?: { encodedPolyline?: string };
    }>;
  };
  const first = data.routes?.[0];
  const meters = first?.distanceMeters;
  if (typeof meters !== "number" || !Number.isFinite(meters)) return null;

  const encoded = first?.polyline?.encodedPolyline?.trim();
  return {
    distanceKm: meters / 1000,
    encodedPolyline: encoded || undefined,
  };
}
