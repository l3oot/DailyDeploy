"use client";

import { useEffect, useRef } from "react";

export type MapPoint = { lat: number; lng: number };

type NearwakeLeafletMapProps = {
  gps: MapPoint | null;
  dest: MapPoint | null;
  destName?: string;
  radiusMeters: number;
  onLongPress: (point: MapPoint) => void;
  recenterToken?: number;
};

type LeafletMap = {
  setView: (latlng: [number, number], zoom?: number) => LeafletMap;
  fitBounds: (
    bounds: unknown,
    opts?: {
      padding?: [number, number];
      paddingTopLeft?: [number, number];
      paddingBottomRight?: [number, number];
      maxZoom?: number;
      animate?: boolean;
    },
  ) => LeafletMap;
  flyTo: (latlng: [number, number], zoom?: number) => LeafletMap;
  invalidateSize: () => void;
  remove: () => void;
  on: (event: string, handler: (e: { latlng: { lat: number; lng: number } }) => void) => void;
  off: (event: string) => void;
};

type LeafletCircle = {
  setLatLng: (latlng: [number, number]) => void;
  setRadius: (m: number) => void;
  getBounds: () => unknown;
  remove: () => void;
};
type LeafletMarker = { setLatLng: (latlng: [number, number]) => void; remove: () => void };

type LeafletNS = {
  map: (el: HTMLElement, opts?: Record<string, unknown>) => LeafletMap;
  tileLayer: (url: string, opts?: Record<string, unknown>) => { addTo: (map: LeafletMap) => void };
  circle: (latlng: [number, number], opts?: Record<string, unknown>) => LeafletCircle & { addTo: (map: LeafletMap) => LeafletCircle };
  marker: (latlng: [number, number], opts?: Record<string, unknown>) => LeafletMarker & { addTo: (map: LeafletMap) => LeafletMarker };
  divIcon: (opts: Record<string, unknown>) => unknown;
  latLngBounds: (a: [number, number], b: [number, number]) => unknown;
};

declare global {
  interface Window {
    L?: LeafletNS;
  }
}

const BANGKOK: [number, number] = [13.7563, 100.5018];
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

let leafletPromise: Promise<LeafletNS> | null = null;

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (window.L) resolve();
      else existing.addEventListener("load", () => resolve(), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function loadCss(href: string) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (!leafletPromise) {
    loadCss(LEAFLET_CSS);
    leafletPromise = loadScript(LEAFLET_JS).then(() => {
      if (!window.L) throw new Error("Leaflet failed to load");
      return window.L;
    });
  }
  return leafletPromise;
}

function fitMapToCircle(map: LeafletMap, circle: LeafletCircle) {
  map.invalidateSize();
  const side = 36;
  const top = 88;
  const bottom = Math.max(240, Math.round(window.innerHeight * 0.52));
  map.fitBounds(circle.getBounds(), {
    paddingTopLeft: [side, top],
    paddingBottomRight: [side, bottom],
    maxZoom: 16,
    animate: false,
  });
}

export function NearwakeLeafletMap({
  gps,
  dest,
  destName,
  radiusMeters,
  onLongPress,
  recenterToken = 0,
}: NearwakeLeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const destMarkerRef = useRef<LeafletMarker | null>(null);
  const gpsMarkerRef = useRef<LeafletMarker | null>(null);
  const circleRef = useRef<LeafletCircle | null>(null);
  const onLongPressRef = useRef(onLongPress);
  const fittedRef = useRef(false);
  const destRef = useRef(dest);
  const destNameRef = useRef(destName);
  const gpsRef = useRef(gps);
  const radiusRef = useRef(radiusMeters);
  destRef.current = dest;
  destNameRef.current = destName;
  gpsRef.current = gps;
  radiusRef.current = radiusMeters;
  onLongPressRef.current = onLongPress;

  function syncOverlays(map: LeafletMap, L: LeafletNS) {
    const nextDest = destRef.current;
    const nextGps = gpsRef.current;
    const nextRadius = radiusRef.current;
    const nextName = destNameRef.current;

    if (nextDest) {
      const pos: [number, number] = [nextDest.lat, nextDest.lng];
      if (!destMarkerRef.current) {
        destMarkerRef.current = L.marker(pos, {
          icon: L.divIcon({
            className: "",
            html: `<div title="${escapeHtml(nextName ?? "")}" style="width:18px;height:18px;border-radius:50% 50% 50% 0;background:#DC2626;transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.28)"></div>`,
            iconSize: [18, 18],
            iconAnchor: [9, 18],
          }),
        }).addTo(map);
      } else {
        destMarkerRef.current.setLatLng(pos);
      }
      if (!circleRef.current) {
        circleRef.current = L.circle(pos, {
          radius: nextRadius,
          color: "#29292E",
          weight: 2,
          fillColor: "#9CA3AF",
          fillOpacity: 0.42,
        }).addTo(map);
      } else {
        circleRef.current.setLatLng(pos);
        circleRef.current.setRadius(nextRadius);
      }
    } else {
      destMarkerRef.current?.remove();
      circleRef.current?.remove();
      destMarkerRef.current = null;
      circleRef.current = null;
    }

    if (nextGps) {
      const pos: [number, number] = [nextGps.lat, nextGps.lng];
      if (!gpsMarkerRef.current) {
        gpsMarkerRef.current = L.marker(pos, {
          icon: L.divIcon({
            className: "",
            html: `<div style="width:14px;height:14px;border-radius:50%;background:#4A89EA;border:2px solid #fff;box-shadow:0 0 0 4px rgba(74,137,234,.28)"></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          }),
        }).addTo(map);
      } else {
        gpsMarkerRef.current.setLatLng(pos);
      }
    }
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
      }).setView(BANGKOK, 13);
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

      mapRef.current = map;
      syncOverlays(map, L);
      if (circleRef.current) {
        fitMapToCircle(map, circleRef.current);
        fittedRef.current = true;
      } else if (gpsRef.current) {
        map.setView([gpsRef.current.lat, gpsRef.current.lng], 15);
        fittedRef.current = true;
      }
      requestAnimationFrame(() => {
        map.invalidateSize();
        if (circleRef.current) fitMapToCircle(map, circleRef.current);
      });
    });

    return () => {
      cancelled = true;
      if (pressTimer != null) window.clearTimeout(pressTimer);
      destMarkerRef.current?.remove();
      gpsMarkerRef.current?.remove();
      circleRef.current?.remove();
      destMarkerRef.current = null;
      gpsMarkerRef.current = null;
      circleRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = window.L;
    if (!map || !L) return;
    syncOverlays(map, L);
  }, [dest, destName, gps, radiusMeters]);

  useEffect(() => {
    const map = mapRef.current;
    const L = window.L;
    if (!map || !L) return;
    syncOverlays(map, L);
    if (dest && circleRef.current) {
      fitMapToCircle(map, circleRef.current);
      fittedRef.current = true;
      return;
    }
    if (gps && !fittedRef.current) {
      map.setView([gps.lat, gps.lng], 15);
      fittedRef.current = true;
    }
  }, [dest?.lat, dest?.lng, radiusMeters]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !gps || dest || fittedRef.current) return;
    map.setView([gps.lat, gps.lng], 15);
    fittedRef.current = true;
  }, [gps?.lat, gps?.lng, dest]);

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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
