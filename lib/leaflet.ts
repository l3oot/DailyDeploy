export const BANGKOK: [number, number] = [13.7563, 100.5018];
export const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
export const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";

export type LeafletBounds = {
  getSouth: () => number;
  getNorth: () => number;
  getWest: () => number;
  getEast: () => number;
};

export type LeafletMap = {
  setView: (latlng: [number, number], zoom?: number) => LeafletMap;
  flyTo: (latlng: [number, number], zoom?: number) => LeafletMap;
  fitBounds: (bounds: unknown, opts?: { padding?: [number, number] }) => LeafletMap;
  getBounds: () => LeafletBounds;
  invalidateSize: () => void;
  remove: () => void;
  on: (event: string, handler: (e: { latlng: { lat: number; lng: number } }) => void) => void;
  off: (event: string) => void;
};

export type LeafletMarker = {
  setLatLng: (latlng: [number, number]) => void;
  remove: () => void;
  on: (event: string, handler: () => void) => LeafletMarker;
};

export type LeafletCircle = {
  setLatLng: (latlng: [number, number]) => void;
  setRadius: (meters: number) => void;
  remove: () => void;
};

export type LeafletPolyline = {
  remove: () => void;
  getBounds: () => unknown;
};

export type LeafletNS = {
  map: (el: HTMLElement, opts?: Record<string, unknown>) => LeafletMap;
  tileLayer: (url: string, opts?: Record<string, unknown>) => { addTo: (map: LeafletMap) => void };
  marker: (
    latlng: [number, number],
    opts?: Record<string, unknown>,
  ) => LeafletMarker & { addTo: (map: LeafletMap) => LeafletMarker };
  circle: (
    latlng: [number, number],
    opts?: Record<string, unknown>,
  ) => LeafletCircle & { addTo: (map: LeafletMap) => LeafletCircle };
  polyline: (
    latlngs: [number, number][],
    opts?: Record<string, unknown>,
  ) => LeafletPolyline & { addTo: (map: LeafletMap) => LeafletPolyline };
  latLngBounds: (latlngs: [number, number][]) => unknown;
  divIcon: (opts: Record<string, unknown>) => unknown;
};

type LeafletWindow = Window & { L?: LeafletNS };

function leafletWindow() {
  return window as LeafletWindow;
}

let leafletPromise: Promise<LeafletNS> | null = null;

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (leafletWindow().L) resolve();
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

export function loadLeaflet() {
  const existing = leafletWindow().L;
  if (existing) return Promise.resolve(existing);
  if (!leafletPromise) {
    loadCss(LEAFLET_CSS);
    leafletPromise = loadScript(LEAFLET_JS).then(() => {
      const L = leafletWindow().L;
      if (!L) throw new Error("Leaflet failed to load");
      return L;
    });
  }
  return leafletPromise;
}
