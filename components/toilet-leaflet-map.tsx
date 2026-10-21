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
  pinMode?: boolean;
  onLongPress: (point: MapPoint) => void;
  onToiletClick: (toiletUuid: string) => void;
  onBoundsChange: (bounds: ToiletBounds) => void;
  focus: { point: MapPoint; zoom: number } | null;
  recenterToken?: number;
  active?: boolean;
};

const PIN_HTML =
  '<svg width="40" height="48" viewBox="0 0 40 48" aria-hidden="true" style="display:block;filter:drop-shadow(0 2px 3px rgba(20,40,80,.28))"><circle cx="20" cy="44.5" r="3.2" fill="#2F80ED"/><circle cx="20" cy="18" r="16" fill="#2F80ED"/><g transform="translate(11 9) scale(.75)" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 12h13a1 1 0 0 1 1 1 5 5 0 0 1-5 5h-.598a.5.5 0 0 0-.424.765l1.544 2.47a.5.5 0 0 1-.424.765H5.402a.5.5 0 0 1-.424-.765L7 18"/><path d="M8 18a5 5 0 0 1-5-5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8"/></g></svg>';
const DRAFT_HTML =
  '<svg width="28" height="36" viewBox="0 0 28 36" aria-hidden="true"><path d="M14 1C7 1 1.5 6.4 1.5 13.2 1.5 22.4 14 35 14 35s12.5-12.6 12.5-21.8C26.5 6.4 21 1 14 1z" fill="#EF4444"/><circle cx="14" cy="13" r="4.5" fill="#fff"/></svg>';
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
  pinMode = false,
  onLongPress,
  onToiletClick,
  onBoundsChange,
  focus,
  recenterToken = 0,
  active = true,
}: ToiletLeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const gpsMarkerRef = useRef<LeafletMarker | null>(null);
  const draftMarkerRef = useRef<LeafletMarker | null>(null);
  const toiletMarkersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const onLongPressRef = useRef(onLongPress);
  const onToiletClickRef = useRef(onToiletClick);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const pinModeRef = useRef(pinMode);
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
  pinModeRef.current = pinMode;

  function pinIcon(L: LeafletNS) {
    return L.divIcon({
      className: "toilet-map-pin",
      html: PIN_HTML,
      iconSize: [40, 48],
      iconAnchor: [20, 47],
    });
  }

  function draftIcon(L: LeafletNS) {
    return L.divIcon({
      className: "toilet-map-pin",
      html: DRAFT_HTML,
      iconSize: [28, 36],
      iconAnchor: [14, 34],
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
    const icon = pinModeRef.current ? draftIcon(L) : pinIcon(L);
    if (!draftMarkerRef.current) {
      draftMarkerRef.current = L.marker(pos, { icon }).addTo(map);
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
      const dropPin = (e: { latlng: { lat: number; lng: number } }) => {
        if (!pinModeRef.current) return;
        onLongPressRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
      };
      const startPress = (e: { latlng: { lat: number; lng: number } }) => {
        if (!pinModeRef.current) return;
        clearPress();
        pressTimer = window.setTimeout(() => dropPin(e), 520);
      };
      map.on("mousedown", startPress);
      map.on("mouseup", clearPress);
      map.on("dragstart", clearPress);
      map.on("click", dropPin);
      map.on("contextmenu", dropPin);
      map.on("moveend", () => emitBounds(map));
      map.on("zoomend", () => emitBounds(map));

      mapRef.current = map;
      syncGps(map, L);
      syncToilets(map, L);
      syncDraft(map, L);
      const seed = draftRef.current;
      const currentGps = gpsRef.current;
      if (pinModeRef.current && seed) {
        map.setView([seed.lat, seed.lng], 16);
        fittedRef.current = true;
      } else if (currentGps) {
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
    if (draftMarkerRef.current) {
      draftMarkerRef.current.remove();
      draftMarkerRef.current = null;
    }
    syncDraft(map, L);
  }, [draft, pinMode]);

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

  useEffect(() => {
    if (!active) return;
    const map = mapRef.current;
    if (!map) return;
    const id = window.requestAnimationFrame(() => map.invalidateSize());
    return () => window.cancelAnimationFrame(id);
  }, [active]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full"
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
