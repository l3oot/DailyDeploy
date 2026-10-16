export const OPEN_HOURS_MASK = "__:__-__:__";

const DIGIT_SLOTS = [0, 1, 3, 4, 6, 7, 9, 10];

export function isValidOpenHours24hPrefix(digits: string): boolean {
  const len = digits.length;
  if (len === 0) return true;
  if (len >= 1 && Number(digits[0]) > 2) return false;
  if (len >= 2 && Number(digits.slice(0, 2)) > 23) return false;
  if (len >= 3 && Number(digits[2]) > 5) return false;
  if (len >= 4 && Number(digits.slice(2, 4)) > 59) return false;
  if (len >= 5 && Number(digits[4]) > 2) return false;
  if (len >= 6 && Number(digits.slice(4, 6)) > 23) return false;
  if (len >= 7 && Number(digits[6]) > 5) return false;
  if (len >= 8 && Number(digits.slice(6, 8)) > 59) return false;
  return true;
}

export function digitsFromOpenHours(text: string): string {
  return text.replace(/[^0-9]/g, "").slice(0, 8);
}

export function filterValidOpenHoursDigits(proposed: string): string {
  let out = "";
  for (const ch of proposed) {
    if (out.length >= 8) break;
    const cand = `${out}${ch}`;
    if (isValidOpenHours24hPrefix(cand)) out = cand;
  }
  return out;
}

export function formatOpenHoursMask(digitsOnly: string): string {
  const take = digitsOnly.slice(0, 8);
  const chars = ["_", "_", ":", "_", "_", "-", "_", "_", ":", "_", "_"];
  for (let i = 0; i < take.length; i++) chars[DIGIT_SLOTS[i]!] = take[i]!;
  return chars.join("");
}

export function nextOpenHoursValue(prev: string, next: string): string {
  const oldDigits = digitsFromOpenHours(prev);
  let digits = digitsFromOpenHours(next);
  const deleting = next.length < prev.length;
  if (deleting && digits.length === oldDigits.length && oldDigits.length > 0) {
    digits = oldDigits.slice(0, -1);
  }
  return formatOpenHoursMask(filterValidOpenHoursDigits(digits));
}

export function openHoursForPayload(raw: string): string | null {
  const s = raw.trim();
  if (!s || s === OPEN_HOURS_MASK) return "";
  const digits = digitsFromOpenHours(s);
  if (!digits) return "";
  if (digits.length < 8) return "";
  const d = digits.slice(0, 8);
  if (d.length !== 8 || !isValidOpenHours24hPrefix(d)) return null;
  return `${d.slice(0, 2)}:${d.slice(2, 4)}-${d.slice(4, 6)}:${d.slice(6, 8)}`;
}
