const THAI_MOBILE = /^0[689]\d{8}$/;

export function digitsOnly(value: string, max = 10) {
  return value.replace(/\D/g, "").slice(0, max);
}

/** Keep typing 06 / 08 / 09 only; returns next value and whether prefix was rejected. */
export function nextThaiMobileInput(current: string, incoming: string) {
  const digits = digitsOnly(incoming);
  if (digits.length >= 1 && digits[0] !== "0") {
    return { value: current, invalid: true };
  }
  if (digits.length >= 2 && !["6", "8", "9"].includes(digits[1])) {
    return { value: digits.slice(0, 1), invalid: true };
  }
  return { value: digits, invalid: false };
}

export function isValidThaiMobile(value: string) {
  return THAI_MOBILE.test(digitsOnly(value));
}

export function normalizeUserPhone(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "-") return "-";
  const digits = digitsOnly(trimmed);
  if (!isValidThaiMobile(digits)) return null;
  return digits;
}
