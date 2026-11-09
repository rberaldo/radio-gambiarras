// Distances on the Earth and "repeaters around a point".
import type { Repeater } from './merge.ts';

export interface Point {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_KM = 6371.0088;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in km (haversine). */
export function distanceKm(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface Nearby {
  repeater: Repeater;
  distanceKm: number;
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
