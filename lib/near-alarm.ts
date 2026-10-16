const V_KEY = "da_notify_vibration";
const S_KEY = "da_notify_sound";
const ALARM_SRC = "/sound/alarm.mp3";

let vibeTimer: number | null = null;
let player: HTMLAudioElement | null = null;

function vibrationOn() {
  return typeof window !== "undefined" && window.localStorage.getItem(V_KEY) !== "false";
}

function soundOn() {
  return typeof window !== "undefined" && window.localStorage.getItem(S_KEY) !== "false";
}

export async function requestAlarmPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  return (await Notification.requestPermission()) === "granted";
}

function startVibrationLoop() {
  stopVibrationLoop();
  if (!vibrationOn() || !navigator.vibrate) return;
  navigator.vibrate(400);
  vibeTimer = window.setInterval(() => navigator.vibrate?.(400), 900);
}

function stopVibrationLoop() {
  if (vibeTimer != null) {
    window.clearInterval(vibeTimer);
    vibeTimer = null;
  }
  navigator.vibrate?.(0);
}

function startSoundLoop() {
  stopSoundLoop();
  if (!soundOn() || typeof window === "undefined") return;
  const audio = new Audio(ALARM_SRC);
  audio.loop = true;
  audio.preload = "auto";
  player = audio;
  void audio.play().catch(() => {
    /* autoplay blocked until a user gesture — start tracking is a click */
  });
}

function stopSoundLoop() {
  if (!player) return;
  player.pause();
  player.currentTime = 0;
  player.src = "";
  player = null;
}

export function startNearAlarm(input: { title: string; body: string }) {
  if (typeof window === "undefined") return;
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(input.title, { body: input.body, tag: "nearwake-alarm" });
    } catch {
      /* Safari / insecure context */
    }
  }
  startVibrationLoop();
  startSoundLoop();
}

export function stopNearAlarm() {
  stopVibrationLoop();
  stopSoundLoop();
}
