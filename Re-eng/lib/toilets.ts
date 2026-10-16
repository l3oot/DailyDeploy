import { api } from "./api";

export type ToiletBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

export type ToiletLocation = {
  toiletUuid: string;
  placeToilet: string;
  cleanScoreToilet: number;
  bidetToilet: string;
  priceToilet: number;
  quantityToilet: number;
  avgScoreToilet: number;
  commentToilet: string;
  latitudeToilet: number;
  longitudeToilet: number;
  statusToilet: string;
  safeToilet: number;
  openHoursToilet: string;
  userUuid: string;
  userName: string;
};

export type ToiletWritePayload = {
  placeToilet: string;
  cleanScoreToilet: number;
  bidetToilet: string;
  priceToilet: number;
  quantityToilet: number;
  avgScoreToilet: number;
  commentToilet: string | null;
  latitudeToilet: number;
  longitudeToilet: number;
  statusToilet: string;
  safeToilet: number;
  openHoursToilet: string;
};

export type CreateToiletInput = ToiletWritePayload;

function readInt(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

function readNum(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function parseToiletLocation(raw: unknown): ToiletLocation | null {
  if (!raw || typeof raw !== "object") return null;
  const json = raw as Record<string, unknown>;
  const uuid = String(json.toiletUuid ?? json.ToiletUuid ?? "").trim();
  const lat = readNum(json.latitudeToilet ?? json.LatitudeToilet);
  const lng = readNum(json.longitudeToilet ?? json.LongitudeToilet);
  if (!uuid || lat == null || lng == null) return null;
  return {
    toiletUuid: uuid,
    placeToilet: String(json.placeToilet ?? json.PlaceToilet ?? ""),
    cleanScoreToilet: readInt(json.cleanScoreToilet ?? json.CleanScoreToilet),
    bidetToilet: String(json.bidetToilet ?? json.BidetToilet ?? ""),
    priceToilet: readInt(json.priceToilet ?? json.PriceToilet),
    quantityToilet: readInt(json.quantityToilet ?? json.QuantityToilet, 1),
    avgScoreToilet: readInt(json.avgScoreToilet ?? json.AvgScoreToilet),
    commentToilet: String(json.commentToilet ?? json.CommentToilet ?? ""),
    latitudeToilet: lat,
    longitudeToilet: lng,
    statusToilet: String(json.statusToilet ?? json.StatusToilet ?? ""),
    safeToilet: readInt(json.safeToilet ?? json.SafeToilet),
    openHoursToilet: String(json.openHoursToilet ?? json.OpenHoursToilet ?? ""),
    userUuid: String(json.userUuid ?? json.UserUuid ?? ""),
    userName: String(json.userName ?? json.user_name ?? json.UserName ?? ""),
  };
}

export function starCountFromStoredScore(score: number) {
  if (score <= 5) return Math.max(0, Math.min(5, score));
  return Math.max(0, Math.min(5, Math.round((score * 5) / 10)));
}

export function dashIfEmpty(value: string | null | undefined) {
  const t = value?.trim() ?? "";
  return t ? t : "-";
}

export async function fetchToiletCount() {
  const res = await api<number>("/api/v1/toilet/location/count");
  if (!res.body.isSuccess || typeof res.body.data !== "number") return null;
  return res.body.data;
}

export async function fetchToiletLocations(bounds: ToiletBounds) {
  const params = new URLSearchParams({
    minLat: String(bounds.minLat),
    maxLat: String(bounds.maxLat),
    minLng: String(bounds.minLng),
    maxLng: String(bounds.maxLng),
  });
  const res = await api<unknown[]>(`/api/v1/toilet/location?${params.toString()}`);
  if (!res.body.isSuccess || !Array.isArray(res.body.data)) return [];
  return res.body.data.map(parseToiletLocation).filter((row): row is ToiletLocation => row != null);
}

async function writeToilet(method: "POST" | "PUT", input: Record<string, unknown>) {
  const res = await api<unknown>("/api/v1/toilet/location", {
    method,
    body: JSON.stringify(input),
  });
  return {
    ok: res.body.isSuccess && res.status >= 200 && res.status < 300,
    status: res.status,
    message: res.body.message || res.body.errorMessage || "",
  };
}

export async function createToiletLocation(input: CreateToiletInput) {
  return writeToilet("POST", input);
}

export async function updateToiletLocation(input: ToiletWritePayload & { toiletUuid: string }) {
  return writeToilet("PUT", input);
}
