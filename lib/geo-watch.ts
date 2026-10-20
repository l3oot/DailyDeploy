export type GeoPoint = { lat: number; lng: number };

type StartGeoWatchInput = {
  onPosition: (point: GeoPoint) => void;
  onError?: (denied: boolean) => void;
};

const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
};

const RESUME_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 10_000,
  timeout: 20_000,
};

const HIDDEN_POLL_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 5_000,
  timeout: 8_000,
};

const HIDDEN_POLL_MS = 15_000;

function readPoint(pos: GeolocationPosition): GeoPoint {
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

/**
 * Geolocation API watcher that survives app switches:
 * - no timeout on watchPosition (timeout is what kills GPS when the OS pauses it)
 * - restart watch + getCurrentPosition when the page is visible again
 * - while hidden, poll getCurrentPosition in case JS is only throttled, not frozen
 */
export function startGeoWatch(input: StartGeoWatchInput): () => void {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    input.onError?.(true);
    return () => undefined;
  }

  const geo = navigator.geolocation;
  let watchId: number | null = null;
  let stopped = false;
  let denied = false;
  let inflight = false;
  let requestGen = 0;
  let retryTimer: number | null = null;
  let pollTimer: number | null = null;
  let retryMs = 1_000;

  function applyPosition(pos: GeolocationPosition) {
    retryMs = 1_000;
    input.onPosition(readPoint(pos));
  }

  function stopWatch() {
    if (watchId == null) return;
    geo.clearWatch(watchId);
    watchId = null;
  }

  function clearRetry() {
    if (retryTimer == null) return;
    window.clearTimeout(retryTimer);
    retryTimer = null;
  }

  function handleError(err: GeolocationPositionError, source: "watch" | "oneshot") {
    if (stopped) return;
    const hidden = document.visibilityState !== "visible";
    // iOS often reports PERMISSION_DENIED while backgrounded even when granted.
    if (err.code === err.PERMISSION_DENIED && !hidden) {
      denied = true;
      stopWatch();
      clearRetry();
      input.onError?.(true);
      return;
    }
    if (hidden || source === "oneshot") return;
    input.onError?.(false);
    scheduleRestart();
  }

  function requestOnce(options: PositionOptions) {
    if (stopped || denied || inflight) return;
    inflight = true;
    const gen = ++requestGen;
    geo.getCurrentPosition(
      (pos) => {
        if (gen !== requestGen) return;
        inflight = false;
        if (!stopped) applyPosition(pos);
      },
      (err) => {
        if (gen !== requestGen) return;
        inflight = false;
        handleError(err, "oneshot");
      },
      options,
    );
  }

  function startWatch() {
    if (stopped || denied) return;
    stopWatch();
    try {
      watchId = geo.watchPosition(applyPosition, (err) => handleError(err, "watch"), WATCH_OPTIONS);
    } catch {
      scheduleRestart();
    }
  }

  function scheduleRestart() {
    if (stopped || denied || retryTimer != null) return;
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      startWatch();
      requestOnce(RESUME_OPTIONS);
      retryMs = Math.min(retryMs * 2, 15_000);
    }, retryMs);
  }

  function onForeground() {
    if (stopped || denied) return;
    if (document.visibilityState && document.visibilityState !== "visible") return;
    inflight = false;
    requestGen += 1;
    startWatch();
    requestOnce(RESUME_OPTIONS);
  }

  function pollWhileHidden() {
    if (stopped || denied) return;
    if (document.visibilityState === "visible") return;
    requestOnce(HIDDEN_POLL_OPTIONS);
  }

  startWatch();
  requestOnce(RESUME_OPTIONS);
  pollTimer = window.setInterval(pollWhileHidden, HIDDEN_POLL_MS);

  document.addEventListener("visibilitychange", onForeground);
  document.addEventListener("resume", onForeground);
  window.addEventListener("focus", onForeground);
  window.addEventListener("pageshow", onForeground);
  window.addEventListener("online", onForeground);

  return () => {
    stopped = true;
    stopWatch();
    clearRetry();
    if (pollTimer != null) window.clearInterval(pollTimer);
    document.removeEventListener("visibilitychange", onForeground);
    document.removeEventListener("resume", onForeground);
    window.removeEventListener("focus", onForeground);
    window.removeEventListener("pageshow", onForeground);
    window.removeEventListener("online", onForeground);
  };
}

type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
};

export function startScreenWakeLock(): () => void {
  const nav = navigator as Navigator & {
    wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
  };
  let lock: WakeLockSentinelLike | null = null;
  let stopped = false;

  async function acquire() {
    if (stopped || document.visibilityState !== "visible") return;
    try {
      lock = (await nav.wakeLock?.request("screen")) ?? null;
    } catch {
      lock = null;
    }
  }

  void acquire();
  document.addEventListener("visibilitychange", acquire);

  return () => {
    stopped = true;
    document.removeEventListener("visibilitychange", acquire);
    if (lock && !lock.released) void lock.release();
    lock = null;
  };
}
