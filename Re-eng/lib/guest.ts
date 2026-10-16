const KEY = "da_guest";

export function isGuest(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) === "1";
}

export function setGuest(value: boolean) {
  if (value) window.localStorage.setItem(KEY, "1");
  else window.localStorage.removeItem(KEY);
}
