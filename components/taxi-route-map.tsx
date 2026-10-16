"use client";

import { useEffect, useRef } from "react";
import {
  BANGKOK,
  loadLeaflet,
  type LeafletMap,
  type LeafletMarker,
  type LeafletNS,
  type LeafletPolyline,
} from "@/lib/leaflet";

export type MapPoint = { lat: number; lng: number };

type TaxiRouteMapProps = {
  origin: MapPoint;
  dest: MapPoint;
  path: MapPoint[];
  fallback?: boolean;
};

const ORIGIN_HTML =
  '<div style="width:16px;height:16px;border-radius:50%;background:#34C759;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>';
const DEST_HTML =
  '<div style="width:16px;height:16px;border-radius:50%;background:#FF3B30;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>';

function toLatLngs(points: MapPoint[]): [number, number][] {
  return points.map((p) => [p.lat, p.lng]);
}

export function TaxiRouteMap({ origin, dest, path, fallback = false }: TaxiRouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<LeafletNS | null>(null);
  const originMarkerRef = useRef<LeafletMarker | null>(null);
  const destMarkerRef = useRef<LeafletMarker | null>(null);
  const lineRef = useRef<LeafletPolyline | null>(null);
  const originRef = useRef(origin);
  const destRef = useRef(dest);
  const pathRef = useRef(path);
  const fallbackRef = useRef(fallback);
  originRef.current = origin;
  destRef.current = dest;
  pathRef.current = path;
  fallbackRef.current = fallback;

  function syncRoute(map: LeafletMap, L: LeafletNS) {
    const nextOrigin = originRef.current;
    const nextDest = destRef.current;
    const nextPath = pathRef.current;
    const nextFallback = fallbackRef.current;

    originMarkerRef.current?.remove();
    destMarkerRef.current?.remove();
    lineRef.current?.remove();

    originMarkerRef.current = L.marker([nextOrigin.lat, nextOrigin.lng], {
      icon: L.divIcon({
        className: "toilet-map-pin",
        html: ORIGIN_HTML,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    }).addTo(map);
    destMarkerRef.current = L.marker([nextDest.lat, nextDest.lng], {
      icon: L.divIcon({
        className: "toilet-map-pin",
        html: DEST_HTML,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      }),
    }).addTo(map);

    const linePoints = nextPath.length >= 2 ? nextPath : [nextOrigin, nextDest];
    const latlngs = toLatLngs(linePoints);
    lineRef.current = L.polyline(latlngs, {
      color: nextFallback ? "#8E8E93" : "#C33E83",
      weight: nextFallback ? 4 : 5,
      opacity: nextFallback ? 0.85 : 1,
      dashArray: nextFallback ? "8 8" : undefined,
      lineJoin: "round",
      lineCap: "round",
    }).addTo(map);
    map.fitBounds(L.latLngBounds(latlngs), { padding: [48, 48] });
    requestAnimationFrame(() => map.invalidateSize());
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;
    void loadLeaflet().then((L) => {
      if (cancelled || mapRef.current || !containerRef.current) return;
      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView(BANGKOK, 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);
      leafletRef.current = L;
      mapRef.current = map;
      syncRoute(map, L);
    });
    return () => {
      cancelled = true;
      lineRef.current?.remove();
      originMarkerRef.current?.remove();
      destMarkerRef.current?.remove();
      lineRef.current = null;
      originMarkerRef.current = null;
      destMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;
    syncRoute(map, L);
  }, [origin.lat, origin.lng, dest.lat, dest.lng, path, fallback]);

  return <div ref={containerRef} className="h-full w-full" />;
}
