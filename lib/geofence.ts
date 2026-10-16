import { haversineKm } from "./taxi";

export type LatLng = { lat: number; lng: number };

export function distanceMeters(a: LatLng, b: LatLng) {
  return haversineKm(a, b) * 1000;
}

export function isInsideGeofence(gps: LatLng, dest: LatLng, radiusMeters: number) {
  return distanceMeters(gps, dest) <= radiusMeters;
}

export function formatDistanceMeters(meters: number, kmLabel: string, mLabel: string) {
  if (meters < 1000) return `${Math.round(meters)} ${mLabel}`;
  return `${(meters / 1000).toFixed(1)} ${kmLabel}`;
}
