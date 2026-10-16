"use client";

import { useEffect, useRef } from "react";
import {
  BANGKOK,
  loadLeaflet,
  type LeafletMap,
  type LeafletMarker,
  type LeafletNS,
} from "@/lib/leaflet";
import type { ToiletBounds } from "@/lib/toilets";

export type MapPoint = { lat: number; lng: number };

export type ToiletMapPin = {
  toiletUuid: string;
  lat: number;
  lng: number;
};

type ToiletLeafletMapProps = {
  gps: MapPoint | null;
  toilets: ToiletMapPin[];
  draft: MapPoint | null;
  onLongPress: (point: MapPoint) => void;
  onToiletClick: (toiletUuid: string) => void;
  onBoundsChange: (bounds: ToiletBounds) => void;
  focus: { point: MapPoint; zoom: number } | null;
  recenterToken?: number;
};

const PIN_HTML =
  '<img src="/icon/toilet.png" alt="" width="32" height="32" style="display:block;width:32px;height:32px" />';
const GPS_HTML =
  '<div style="width:14px;height:14px;border-radius:50%;background:#4A89EA;border:2px solid #fff;box-shadow:0 0 0 4px rgba(74,137,234,.28)"></div>';

function round(n: number) {
  return Math.round(n * 1e5) / 1e5;
}

function readBounds(map: LeafletMap): ToiletBounds {
  const b = map.getBounds();
  const minLat = b.getSouth();
  const maxLat = b.getNorth();
  const minLng = b.getWest();
  const maxLng = b.getEast();
  const padLat = Math.max((maxLat - minLat) * 0.12, 0.002);
  const padLng = Math.max((maxLng - minLng) * 0.12, 0.002);
  return {
    minLat: round(minLat - padLat),
    maxLat: round(maxLat + padLat),
    minLng: round(minLng - padLng),
    maxLng: round(maxLng + padLng),
  };
}

export function ToiletLeafletMap({
  gps,
  toilets,
  draft,
  onLongPress,
  onToiletClick,
  onBoundsChange,
  focus,
  recenterToken = 0,
}: ToiletLeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const gpsMarkerRef = useRef<LeafletMarker | null>(null);
  const draftMarkerRef = useRef<LeafletMarker | null>(null);
  const toiletMarkersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const onLongPressRef = useRef(onLongPress);
  const onToiletClickRef = useRef(onToiletClick);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const fittedRef = useRef(false);
  const gpsRef = useRef(gps);
  const toiletsRef = useRef(toilets);
  const draftRef = useRef(draft);
  gpsRef.current = gps;
  toiletsRef.current = toilets;
  draftRef.current = draft;
  onLongPressRef.current = onLongPress;
  onToiletClickRef.current = onToiletClick;
  onBoundsChangeRef.current = onBoundsChange;

  function pinIcon(L: LeafletNS) {
    return L.divIcon({
      className: "toilet-map-pin",
      html: PIN_HTML,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });
  }

  function syncToilets(map: LeafletMap, L: LeafletNS) {
    const seen = new Set<string>();
    for (const pin of toiletsRef.current) {
      seen.add(pin.toiletUuid);
      const pos: [number, number] = [pin.lat, pin.lng];
      const existing = toiletMarkersRef.current.get(pin.toiletUuid);
      if (existing) {
        existing.setLatLng(pos);
        continue;
      }
      const marker = L.marker(pos, { icon: pinIcon(L) }).addTo(map);
      marker.on("click", () => onToiletClickRef.current(pin.toiletUuid));
      toiletMarkersRef.current.set(pin.toiletUuid, marker);
    }
    toiletMarkersRef.current.forEach((marker, uuid) => {
      if (seen.has(uuid)) return;
      marker.remove();
      toiletMarkersRef.current.delete(uuid);
    });
  }

  function syncDraft(map: LeafletMap, L: LeafletNS) {
    const next = draftRef.current;
    if (!next) {
      draftMarkerRef.current?.remove();
      draftMarkerRef.current = null;
      return;
    }
    const pos: [number, number] = [next.lat, next.lng];
    if (!draftMarkerRef.current) {
      draftMarkerRef.current = L.marker(pos, { icon: pinIcon(L) }).addTo(map);
    } else {
      draftMarkerRef.current.setLatLng(pos);
    }
  }

  function syncGps(map: LeafletMap, L: LeafletNS) {
    const next = gpsRef.current;
    if (!next) return;
    const pos: [number, number] = [next.lat, next.lng];
    if (!gpsMarkerRef.current) {
      gpsMarkerRef.current = L.marker(pos, {
        icon: L.divIcon({
          className: "toilet-map-pin",
          html: GPS_HTML,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        }),
      }).addTo(map);
    } else {
      gpsMarkerRef.current.setLatLng(pos);
    }
  }

  function emitBounds(map: LeafletMap) {
    onBoundsChangeRef.current(readBounds(map));
  }

  useEffect(() => {
    let cancelled = false;
    let pressTimer: number | null = null;
    const el = containerRef.current;
    if (!el) return;

    void loadLeaflet().then((L) => {
      if (cancelled || !containerRef.current) return;
      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true,
      }).setView(BANGKOK, 14);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);

      const clearPress = () => {
        if (pressTimer != null) {
          window.clearTimeout(pressTimer);
          pressTimer = null;
        }
      };
      const startPress = (e: { latlng: { lat: number; lng: number } }) => {
        clearPress();
        pressTimer = window.setTimeout(() => {
          onLongPressRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
        }, 520);
      };
      map.on("mousedown", startPress);
      map.on("mouseup", clearPress);
      map.on("dragstart", clearPress);
      map.on("contextmenu", (e) => {
        onLongPressRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
      map.on("moveend", () => emitBounds(map));
      map.on("zoomend", () => emitBounds(map));

      mapRef.current = map;
      syncGps(map, L);
      syncToilets(map, L);
      syncDraft(map, L);
      const currentGps = gpsRef.current;
      if (currentGps) {
        map.setView([currentGps.lat, currentGps.lng], 16);
        fittedRef.current = true;
      }
      requestAnimationFrame(() => {
        map.invalidateSize();
        emitBounds(map);
      });
    });

    return () => {
      cancelled = true;
      if (pressTimer != null) window.clearTimeout(pressTimer);
      gpsMarkerRef.current?.remove();
      draftMarkerRef.current?.remove();
      gpsMarkerRef.current = null;
      draftMarkerRef.current = null;
      toiletMarkersRef.current.forEach((marker) => marker.remove());
      toiletMarkersRef.current.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = (window as Window & { L?: LeafletNS }).L;
    if (!map || !L) return;
    syncGps(map, L);
    if (gps && !fittedRef.current) {
      map.setView([gps.lat, gps.lng], 16);
      fittedRef.current = true;
    }
  }, [gps]);

  useEffect(() => {
    const map = mapRef.current;
    const L = (window as Window & { L?: LeafletNS }).L;
    if (!map || !L) return;
    syncToilets(map, L);
  }, [toilets]);

  useEffect(() => {
    const map = mapRef.current;
    const L = (window as Window & { L?: LeafletNS }).L;
    if (!map || !L) return;
    syncDraft(map, L);
  }, [draft]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus) return;
    map.flyTo([focus.point.lat, focus.point.lng], focus.zoom ?? 16);
    fittedRef.current = true;
  }, [focus]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !gps || !recenterToken) return;
    map.flyTo([gps.lat, gps.lng], 16);
  }, [recenterToken, gps]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full"
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
