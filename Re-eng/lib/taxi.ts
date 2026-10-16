export type TaxiFareLine = { label: string; amountBaht: number };

export type TaxiFareResult = {
  distanceLines: TaxiFareLine[];
  distanceSubtotal: number;
  trafficBaht: number;
  appSurcharge: number;
  airportSurcharge: number;
  totalBaht: number;
};

/** อัตราค่าแท็กซี่ กรมการขนส่งทางบก ม.ค. 2566 — ตรงกับ `taxi_fare_calculator.dart` */
export function computeTaxiFare(input: {
  distanceKm: number;
  trafficMinutes?: number;
  appBookingSurcharge?: boolean;
  airportSurcharge?: boolean;
}): TaxiFareResult {
  const dist = distanceFareDetailed(input.distanceKm);
  const trafficBaht = Math.max(0, input.trafficMinutes ?? 0) * 3;
  const appSurcharge = input.appBookingSurcharge ? 20 : 0;
  const airportSurcharge = input.airportSurcharge ? 50 : 0;
  return {
    ...dist,
    trafficBaht,
    appSurcharge,
    airportSurcharge,
    totalBaht: dist.distanceSubtotal + trafficBaht + appSurcharge + airportSurcharge,
  };
}

function distanceFareDetailed(distanceKm: number): {
  distanceLines: TaxiFareLine[];
  distanceSubtotal: number;
} {
  const lines: TaxiFareLine[] = [];
  if (distanceKm <= 0) return { distanceLines: lines, distanceSubtotal: 0 };

  let remaining = distanceKm;
  let subtotal = 0;
  lines.push({ label: "กิโลเมตรแรก (ไม่เกิน 1 กม.)", amountBaht: 40 });
  subtotal += 40;
  remaining -= 1;
  if (remaining <= 0) return { distanceLines: lines, distanceSubtotal: subtotal };

  function addSegment(maxKm: number, rate: number, label: string) {
    if (remaining <= 0) return;
    const use = Math.min(remaining, maxKm);
    const amt = use * rate;
    lines.push({ label, amountBaht: amt });
    subtotal += amt;
    remaining -= use;
  }

  addSegment(9, 6.5, "กม.ที่ 2–10 (กม.ละ 6.50 บาท)");
  addSegment(10, 7, "กม.ที่ 11–20 (กม.ละ 7.00 บาท)");
  addSegment(20, 8, "กม.ที่ 21–40 (กม.ละ 8.00 บาท)");
  addSegment(20, 8.5, "กม.ที่ 41–60 (กม.ละ 8.50 บาท)");
  addSegment(20, 9, "กม.ที่ 61–80 (กม.ละ 9.00 บาท)");
  if (remaining > 0) {
    const amt = remaining * 10.5;
    lines.push({ label: "เกิน 80 กม. (กม.ละ 10.50 บาท)", amountBaht: amt });
    subtotal += amt;
  }
  return { distanceLines: lines, distanceSubtotal: subtotal };
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function toRad(d: number) {
  return (d * Math.PI) / 180;
}

/** Google encoded polyline (precision 1e5) — ใช้วาดเส้นบนแผนที่ */
export function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}
