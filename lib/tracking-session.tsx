"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { distanceMeters, isInsideGeofence } from "./geofence";
import { startGeoWatch, startScreenWakeLock } from "./geo-watch";
import { useI18n } from "./i18n/provider";
import { startNearAlarm, stopNearAlarm } from "./near-alarm";
import { consumeFeature } from "./plan-api";

export type TrackingDest = {
  lat: number;
  lon: number;
  name: string;
  storeplaceUuid?: string;
};

type PersistShape = {
  dest: TrackingDest;
  radiusMeters: number;
  notifyOnExit: boolean;
  inside: boolean;
  reachedDest?: boolean;
};

const STORAGE_KEY = "da_tracking";

type TrackingContextValue = {
  active: boolean;
  dest: TrackingDest | null;
  radiusMeters: number;
  notifyOnExit: boolean;
  gps: { lat: number; lng: number } | null;
  gpsDenied: boolean;
  metersAway: number | null;
  alarming: boolean;
  mapVisible: boolean;
  start: (input: { dest: TrackingDest; radiusMeters: number; notifyOnExit: boolean }) => void;
  stop: () => void;
  dismissAlarm: () => void;
  setMapVisible: (visible: boolean) => void;
};

const TrackingContext = createContext<TrackingContextValue | null>(null);

function loadPersist(): PersistShape | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PersistShape;
    if (!data?.dest || !Number.isFinite(data.dest.lat) || !Number.isFinite(data.dest.lon)) {
      return null;
    }
    if (!localStorage.getItem(STORAGE_KEY)) {
      localStorage.setItem(STORAGE_KEY, raw);
      sessionStorage.removeItem(STORAGE_KEY);
    }
    return data;
  } catch {
    return null;
  }
}

function savePersist(data: PersistShape | null) {
  if (!data) {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  const raw = JSON.stringify(data);
  localStorage.setItem(STORAGE_KEY, raw);
  sessionStorage.removeItem(STORAGE_KEY);
}

export function TrackingProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [active, setActive] = useState(false);
  const [dest, setDest] = useState<TrackingDest | null>(null);
  const [radiusMeters, setRadiusMeters] = useState(500);
  const [notifyOnExit, setNotifyOnExit] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsDenied, setGpsDenied] = useState(false);
  const [alarming, setAlarming] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const insideRef = useRef(false);
  const reachedDestRef = useRef(false);
  const destRef = useRef<TrackingDest | null>(null);
  const radiusRef = useRef(500);
  const notifyRef = useRef(false);
  destRef.current = dest;
  radiusRef.current = radiusMeters;
  notifyRef.current = notifyOnExit;

  useEffect(() => {
    const saved = loadPersist();
    if (!saved) return;
    destRef.current = saved.dest;
    radiusRef.current = saved.radiusMeters;
    notifyRef.current = saved.notifyOnExit;
    insideRef.current = saved.inside;
    reachedDestRef.current = Boolean(saved.reachedDest) || saved.inside;
    setDest(saved.dest);
    setRadiusMeters(saved.radiusMeters);
    setNotifyOnExit(saved.notifyOnExit);
    setActive(true);
  }, []);

  const watching = active || mapVisible;

  useEffect(() => {
    if (!watching) return;
    return startGeoWatch({
      onPosition: (point) => {
        setGpsDenied(false);
        setGps((prev) => (prev && prev.lat === point.lat && prev.lng === point.lng ? prev : point));
      },
      onError: (denied) => {
        if (denied) setGpsDenied(true);
      },
    });
  }, [watching]);

  useEffect(() => {
    if (!active) return;
    return startScreenWakeLock();
  }, [active]);

  useEffect(() => {
    if (!active || !gps || !dest) return;
    const destPoint = { lat: dest.lat, lng: dest.lon };
    const inside = isInsideGeofence(gps, destPoint, radiusMeters);
    const wasInside = insideRef.current;
    insideRef.current = inside;
    if (inside) reachedDestRef.current = true;
    savePersist({
      dest,
      radiusMeters,
      notifyOnExit,
      inside,
      reachedDest: reachedDestRef.current,
    });

    if (!notifyOnExit && inside && !wasInside) {
      startNearAlarm({
        title: t("mapAlarmTitle"),
        body: `${t("mapAlarmEnterBody")}${dest.name}`,
      });
      setAlarming(true);
    } else if (!notifyOnExit && !inside && wasInside) {
      stopNearAlarm();
      setAlarming(false);
    } else if (notifyOnExit && !inside && wasInside) {
      startNearAlarm({
        title: t("mapAlarmExitTitle"),
        body: `${t("mapAlarmExitBody")}${dest.name}`,
      });
      setAlarming(true);
    } else if (notifyOnExit && inside && !wasInside) {
      stopNearAlarm();
      setAlarming(false);
    }
  }, [active, gps, dest, radiusMeters, notifyOnExit, t]);

  const start = useCallback(
    (input: { dest: TrackingDest; radiusMeters: number; notifyOnExit: boolean }) => {
      destRef.current = input.dest;
      radiusRef.current = input.radiusMeters;
      notifyRef.current = input.notifyOnExit;
      const alreadyInside = gps
        ? isInsideGeofence(gps, { lat: input.dest.lat, lng: input.dest.lon }, input.radiusMeters)
        : false;
      insideRef.current = alreadyInside;
      reachedDestRef.current = alreadyInside;
      setDest(input.dest);
      setRadiusMeters(input.radiusMeters);
      setNotifyOnExit(input.notifyOnExit);
      setActive(true);
      savePersist({
        dest: input.dest,
        radiusMeters: input.radiusMeters,
        notifyOnExit: input.notifyOnExit,
        inside: alreadyInside,
        reachedDest: alreadyInside,
      });
      if (!input.notifyOnExit && alreadyInside) {
        startNearAlarm({
          title: t("mapAlarmTitle"),
          body: `${t("mapAlarmEnterBody")}${input.dest.name}`,
        });
        setAlarming(true);
      } else {
        stopNearAlarm();
        setAlarming(false);
      }
    },
    [gps, t],
  );

  const stop = useCallback(() => {
    const shouldCharge = reachedDestRef.current;
    setActive(false);
    setAlarming(false);
    insideRef.current = false;
    reachedDestRef.current = false;
    destRef.current = null;
    setDest(null);
    savePersist(null);
    stopNearAlarm();
    if (shouldCharge) void consumeFeature("nearwake");
  }, []);

  const dismissAlarm = useCallback(() => {
    stopNearAlarm();
    setAlarming(false);
  }, []);

  const metersAway = useMemo(() => {
    if (!gps || !dest) return null;
    return distanceMeters(gps, { lat: dest.lat, lng: dest.lon });
  }, [gps, dest]);

  const value = useMemo<TrackingContextValue>(
    () => ({
      active,
      dest,
      radiusMeters,
      notifyOnExit,
      gps,
      gpsDenied,
      metersAway,
      alarming,
      mapVisible,
      start,
      stop,
      dismissAlarm,
      setMapVisible,
    }),
    [
      active,
      dest,
      radiusMeters,
      notifyOnExit,
      gps,
      gpsDenied,
      metersAway,
      alarming,
      mapVisible,
      start,
      stop,
      dismissAlarm,
    ],
  );

  return <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>;
}

export function useTracking() {
  const ctx = useContext(TrackingContext);
  if (!ctx) throw new Error("useTracking must be used within TrackingProvider");
  return ctx;
}
