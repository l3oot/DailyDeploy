import { api } from "./api";

export type ToiletBounds = {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
};

export const TOILET_PLACE_TYPES = ["mall", "gas", "food"] as const;
export type ToiletPlaceType = (typeof TOILET_PLACE_TYPES)[number];

export type ToiletLocation = {
  toiletUuid: string;
  placeToilet: string;
  placeType: string;
  addressToilet: string;
  cleanToilet: boolean;
  freeToilet: boolean;
  accessibleToilet: boolean;
  attendantToilet: boolean;
  diaperToilet: boolean;
  genderSplitToilet: boolean;
  tissueToilet: boolean;
  paperToilet: boolean;
  photosToilet: string[];
  photoCount: number;
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

export type CreateToiletInput = {
  placeToilet: string;
  placeType: string;
  addressToilet: string;
  cleanToilet: boolean;
  freeToilet: boolean;
  accessibleToilet: boolean;
  attendantToilet: boolean;
  diaperToilet: boolean;
  genderSplitToilet: boolean;
  tissueToilet: boolean;
  paperToilet: boolean;
  photosToilet: string[];
  latitudeToilet: number;
  longitudeToilet: number;
  openHoursToilet: string | null;
};

function readInt(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

function readBool(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function readPhotos(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
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
  const bidet = String(json.bidetToilet ?? json.BidetToilet ?? "");
  const photos = readPhotos(json.photosToilet ?? json.PhotosToilet);
  const priceRaw = json.priceToilet ?? json.PriceToilet;
  const price = priceRaw == null || priceRaw === "" ? null : readNum(priceRaw);
  const cleanScore = readInt(json.cleanScoreToilet ?? json.CleanScoreToilet);
  return {
    toiletUuid: uuid,
    placeToilet: String(json.placeToilet ?? json.PlaceToilet ?? ""),
    placeType: String(json.placeType ?? json.PlaceType ?? ""),
    addressToilet: String(json.addressToilet ?? json.AddressToilet ?? ""),
    cleanToilet: readBool(json.cleanToilet ?? json.CleanToilet) || cleanScore > 0,
    freeToilet: readBool(json.freeToilet ?? json.FreeToilet) || price === 0,
    accessibleToilet: readBool(json.accessibleToilet ?? json.AccessibleToilet),
    attendantToilet: readBool(json.attendantToilet ?? json.AttendantToilet),
    diaperToilet: readBool(json.diaperToilet ?? json.DiaperToilet),
    genderSplitToilet: readBool(json.genderSplitToilet ?? json.GenderSplitToilet),
    tissueToilet: readBool(json.tissueToilet ?? json.TissueToilet) || bidet.includes("ทิชชู่"),
    paperToilet: readBool(json.paperToilet ?? json.PaperToilet),
    photosToilet: photos,
    photoCount: readInt(json.photoCount ?? json.PhotoCount, photos.length),
    cleanScoreToilet: cleanScore,
    bidetToilet: bidet,
    priceToilet: price == null ? 0 : Math.round(price),
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

export async function fetchToiletLocation(toiletUuid: string) {
  const res = await api<unknown>(`/api/v1/toilet/location/${encodeURIComponent(toiletUuid)}`);
  if (!res.body.isSuccess) return null;
  return parseToiletLocation(res.body.data);
}

export async function createToiletLocation(input: CreateToiletInput) {
  return writeToilet("POST", input);
}
