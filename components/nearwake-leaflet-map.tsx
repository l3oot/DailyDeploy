"use client";

import { useEffect, useRef } from "react";

export type MapPoint = { lat: number; lng: number };

type NearwakeLeafletMapProps = {
  gps: MapPoint | null;
  dest: MapPoint | null;
  destName?: string;
  radiusMeters?: number;
  onLongPress: (point: MapPoint) => void;
  recenterToken?: number;
  overviewToken?: number;
  compassToken?: number;
};

type LeafletMap = {
  setView: (latlng: [number, number], zoom?: number) => LeafletMap;
  fitBounds: (
    bounds: unknown,
    opts?: {
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

type LeafletMarker = {
  setLatLng: (latlng: [number, number]) => void;
  setIcon: (icon: unknown) => void;
  remove: () => void;
};

type LeafletBounds = {
  extend: (latlng: [number, number]) => LeafletBounds;
};

type LeafletCircle = {
  setLatLng: (latlng: [number, number]) => void;
  setRadius: (meters: number) => void;
  getBounds: () => LeafletBounds;
  remove: () => void;
};

type LeafletNS = {
  map: (el: HTMLElement, opts?: Record<string, unknown>) => LeafletMap;
  tileLayer: (url: string, opts?: Record<string, unknown>) => { addTo: (map: LeafletMap) => void };
  marker: (
    latlng: [number, number],
    opts?: Record<string, unknown>,
  ) => LeafletMarker & { addTo: (map: LeafletMap) => LeafletMarker };
  divIcon: (opts: Record<string, unknown>) => unknown;
  circle: (
    latlng: [number, number],
    opts?: Record<string, unknown>,
  ) => LeafletCircle & { addTo: (map: LeafletMap) => LeafletCircle };
  latLngBounds: (latlngs: [number, number][]) => unknown;
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function bearingDeg(from: MapPoint, to: MapPoint) {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

function gpsPuckIcon(deg: number) {
  return {
    className: "nearwake-marker",
    html: `<div style="position:relative;width:35px;height:35px">
      <div style="position:absolute;inset:0;border-radius:999px;background:rgba(59,130,246,.28)"></div>
      <div style="position:absolute;left:7.5px;top:7.5px;width:20px;height:20px;border-radius:999px;background:#fff;box-shadow:0 1px 5px rgba(20,40,80,.18)"></div>
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform:rotate(${deg}deg)">
        <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2 20.2 20.6 12 16.6 3.8 20.6 12 2.2Z" fill="#3B82F6"/></svg>
      </div>
    </div>`,
    iconSize: [35, 35],
    iconAnchor: [17.5, 17.5],
  };
}

function destIcon(name: string) {
  const label = escapeHtml(name);
  return {
    className: "nearwake-marker",
    html: `<div style="position:relative;width:28px;height:36px">
      <div style="position:absolute;right:34px;top:1px;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:#fff;color:#1B2430;font:700 13px/1.2 Prompt,sans-serif;padding:6px 10px;border-radius:10px;box-shadow:0 4px 14px rgba(20,40,80,.16)">${label}</div>
      <svg width="28" height="36" viewBox="0 0 28 36" aria-hidden="true"><path d="M14 1.5c-6.2 0-11.2 4.9-11.2 11.1 0 8.2 11.2 21.4 11.2 21.4S25.2 20.8 25.2 12.6C25.2 6.4 20.2 1.5 14 1.5Z" fill="#F43F5E"/><circle cx="14" cy="12.2" r="4.1" fill="#fff"/></svg>
    </div>`,
    iconSize: [28, 36],
    iconAnchor: [14, 34],
  };
}

export function NearwakeLeafletMap({
  gps,
  dest,
  destName,
  radiusMeters = 500,
  onLongPress,
  recenterToken = 0,
  overviewToken = 0,
  compassToken = 0,
}: NearwakeLeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const circleRef = useRef<LeafletCircle | null>(null);
  const gpsRefMarker = useRef<LeafletMarker | null>(null);
  const destRefMarker = useRef<LeafletMarker | null>(null);
  const onLongPressRef = useRef(onLongPress);
  const gpsRef = useRef(gps);
  const destPointRef = useRef(dest);
  const destNameRef = useRef(destName);
  const radiusRef = useRef(radiusMeters);
  const framedKey = useRef("");

  gpsRef.current = gps;
  destPointRef.current = dest;
  destNameRef.current = destName;
  radiusRef.current = radiusMeters;
  onLongPressRef.current = onLongPress;

  function placeMarker(
    current: LeafletMarker | null,
    map: LeafletMap,
    L: LeafletNS,
    pos: [number, number] | null,
    icon: Record<string, unknown> | null,
    zIndexOffset: number,
  ) {
    if (!pos || !icon) {
      current?.remove();
      return null;
    }
    if (!current) {
      return L.marker(pos, { icon: L.divIcon(icon), zIndexOffset }).addTo(map);
    }
    current.setLatLng(pos);
    current.setIcon(L.divIcon(icon));
    return current;
  }

  function syncOverlays(map: LeafletMap, L: LeafletNS) {
    const nextGps = gpsRef.current;
    const nextDest = destPointRef.current;
    const nextRadius = radiusRef.current;

    if (nextDest && nextRadius > 0) {
      const pos: [number, number] = [nextDest.lat, nextDest.lng];
      if (!circleRef.current) {
        circleRef.current = L.circle(pos, {
          radius: nextRadius,
          color: "#3B82F6",
          weight: 2,
          fillColor: "#3B82F6",
          fillOpacity: 0.16,
        }).addTo(map);
      } else {
        circleRef.current.setLatLng(pos);
        circleRef.current.setRadius(nextRadius);
      }
    } else {
      circleRef.current?.remove();
      circleRef.current = null;
    }

    const heading = nextGps && nextDest ? bearingDeg(nextGps, nextDest) : 0;
    gpsRefMarker.current = placeMarker(
      gpsRefMarker.current,
      map,
      L,
      nextGps ? [nextGps.lat, nextGps.lng] : null,
      nextGps ? gpsPuckIcon(heading) : null,
      500,
    );

    destRefMarker.current = placeMarker(
      destRefMarker.current,
      map,
      L,
      nextDest ? [nextDest.lat, nextDest.lng] : null,
      nextDest ? destIcon(destNameRef.current ?? "") : null,
      600,
    );
  }

  function framePins(map: LeafletMap, L: LeafletNS) {
    const points: [number, number][] = [];
    const nextDest = destPointRef.current;
    const nextGps = gpsRef.current;
    if (nextDest) points.push([nextDest.lat, nextDest.lng]);
    if (nextGps) points.push([nextGps.lat, nextGps.lng]);
    map.invalidateSize();
    const circle = circleRef.current;
    if (circle) {
      const bounds = circle.getBounds();
      if (nextGps) bounds.extend([nextGps.lat, nextGps.lng]);
      map.fitBounds(bounds, {
        paddingTopLeft: [28, 28],
        paddingBottomRight: [56, 28],
        maxZoom: 16,
        animate: false,
      });
      return;
    }
    if (points.length >= 2) {
      map.fitBounds(L.latLngBounds(points), {
        paddingTopLeft: [36, 28],
        paddingBottomRight: [64, 28],
        maxZoom: 16,
        animate: false,
      });
      return;
    }
    const only = points[0];
    if (only) map.setView(only, 15);
  }

  useEffect(() => {
    let cancelled = false;
    let pressTimer: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
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
      framePins(map, L);
      const observer = new ResizeObserver(() => {
        const current = mapRef.current;
        const leaflet = window.L;
        if (!current || !leaflet) return;
        framePins(current, leaflet);
      });
      observer.observe(containerRef.current);
      resizeObserver = observer;
      requestAnimationFrame(() => map.invalidateSize());
    });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if (pressTimer != null) window.clearTimeout(pressTimer);
      circleRef.current?.remove();
      gpsRefMarker.current?.remove();
      destRefMarker.current?.remove();
      circleRef.current = null;
      gpsRefMarker.current = null;
      destRefMarker.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = window.L;
    if (!map || !L) return;
    syncOverlays(map, L);
  }, [gps, dest, destName, radiusMeters]);

  useEffect(() => {
    const map = mapRef.current;
    const L = window.L;
    if (!map || !L) return;
    const key = `${dest?.lat ?? ""},${dest?.lng ?? ""}:${gps ? 1 : 0}:${radiusMeters}:${overviewToken}`;
    if (key === framedKey.current) return;
    if (!dest && !gps) return;
    framedKey.current = key;
    syncOverlays(map, L);
    framePins(map, L);
  }, [dest, gps, radiusMeters, overviewToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !gps || !recenterToken) return;
    map.flyTo([gps.lat, gps.lng], 16);
  }, [recenterToken, gps]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !gps || !compassToken) return;
    map.flyTo([gps.lat, gps.lng], 14);
  }, [compassToken, gps]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 h-full w-full"
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
