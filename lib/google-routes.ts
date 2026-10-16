import { api } from "./api";
import { decodePolyline } from "./taxi";

export type DrivingRouteResult = {
  distanceKm: number;
  points: { lat: number; lng: number }[];
};

type RoutePayload = {
  distanceKm?: number;
  encodedPolyline?: string;
};

export async function fetchDrivingRoute(
  origin: { lat: number; lng: number },
  dest: { lat: number; lng: number },
  signal?: AbortSignal,
): Promise<DrivingRouteResult | null> {
  const { body } = await api<RoutePayload>("/api/v1/ggmap/route", {
    method: "POST",
    body: JSON.stringify({
      originLat: origin.lat,
      originLng: origin.lng,
      destLat: dest.lat,
      destLng: dest.lng,
    }),
    signal,
  });
  const km = body.data?.distanceKm;
  if (!body.isSuccess || typeof km !== "number" || !Number.isFinite(km) || km <= 0) {
    return null;
  }
  const encoded = body.data?.encodedPolyline?.trim() ?? "";
  let points = [origin, dest];
  if (encoded) {
    try {
      const decoded = decodePolyline(encoded);
      if (decoded.length) points = decoded;
    } catch {
      points = [origin, dest];
    }
  }
  return { distanceKm: km, points };
}
