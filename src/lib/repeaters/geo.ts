// Distances on the Earth and "repeaters around a point".
import type { Repeater } from './merge.ts';

export interface Point {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_KM = 6371.0088;
const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Km per degree on the same sphere as distanceKm, for flat projections over
 * short distances (a trail piece, a circle on the map), so all agree.
 */
export const KM_PER_DEG_LAT = (Math.PI * EARTH_RADIUS_KM) / 180;
export const kmPerDegLon = (lat: number) => KM_PER_DEG_LAT * Math.cos(rad(lat));

/**
 * Where p falls on the segment a–b, in a flat projection with `kx` km per
 * degree of longitude: the distance in km and the fraction t along it (0–1).
 */
export function toSegment(p: Point, a: Point, b: Point, kx: number): { km: number; t: number } {
  const dx = (b.lon - a.lon) * kx;
  const dy = (b.lat - a.lat) * KM_PER_DEG_LAT;
  const px = (p.lon - a.lon) * kx;
  const py = (p.lat - a.lat) * KM_PER_DEG_LAT;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, (px * dx + py * dy) / len2)) : 0;
  return { km: Math.hypot(px - t * dx, py - t * dy), t };
}

/** Great-circle distance in km (haversine). */
export function distanceKm(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface Nearby {
  repeater: Repeater;
  /** From the point, or from the nearest spot on a trail. */
  distanceKm: number;
  /** Along a trail: km from its start to the spot nearest the repeater. */
  alongKm?: number;
}

/**
 * Repeaters within `radiusKm` of a trail, in walking order (by where along
 * the trail they come closest), then nearest first. Each line piece is
 * measured on a flat projection around its own latitude, which is accurate
 * to well under 1% at these distances.
 */
export function alongTrack(repeaters: readonly Repeater[], lines: readonly (readonly Point[])[], radiusKm: number): Nearby[] {
  interface Piece {
    a: Point;
    b: Point;
    kx: number;
    startKm: number;
    lengthKm: number;
  }
  const pieces: Piece[] = [];
  let total = 0;
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1]!;
      const b = line[i]!;
      const kx = kmPerDegLon((a.lat + b.lat) / 2);
      const lengthKm = Math.hypot((b.lon - a.lon) * kx, (b.lat - a.lat) * KM_PER_DEG_LAT);
      pieces.push({ a, b, kx, startKm: total, lengthKm });
      total += lengthKm;
    }
    for (const p of line) {
      w = Math.min(w, p.lon);
      e = Math.max(e, p.lon);
      s = Math.min(s, p.lat);
      n = Math.max(n, p.lat);
    }
  }
  // A box around the whole trail rules out most of the country at once.
  const padLat = radiusKm / KM_PER_DEG_LAT;
  const padLon = radiusKm / kmPerDegLon(Math.max(Math.abs(s), Math.abs(n)));

  const found: Nearby[] = [];
  for (const repeater of repeaters) {
    const p = repeater.position;
    if (!p || p.lat < s - padLat || p.lat > n + padLat || p.lon < w - padLon || p.lon > e + padLon) continue;
    let best = Infinity;
    let bestAlong = 0;
    for (const q of pieces) {
      const { km, t } = toSegment(p, q.a, q.b, q.kx);
      if (km < best) {
        best = km;
        bestAlong = q.startKm + t * q.lengthKm;
      }
    }
    if (best <= radiusKm) found.push({ repeater, distanceKm: best, alongKm: bestAlong });
  }
  return found.sort((x, y) => x.alongKm! - y.alongKm! || x.distanceKm - y.distanceKm || x.repeater.id.localeCompare(y.repeater.id));
}

/** Repeaters within a radius of a point, nearest first. Repeaters without a position are left out. */
export function withinRadius(repeaters: readonly Repeater[], center: Point, radiusKm: number): Nearby[] {
  const found: Nearby[] = [];
  for (const repeater of repeaters) {
    if (!repeater.position) continue;
    const d = distanceKm(center, repeater.position);
    if (d <= radiusKm) found.push({ repeater, distanceKm: d });
  }
  return found.sort((a, b) => a.distanceKm - b.distanceKm || a.repeater.id.localeCompare(b.repeater.id));
}
