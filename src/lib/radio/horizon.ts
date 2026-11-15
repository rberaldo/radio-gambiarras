// The horizon around a spot: in each direction, how high the terrain nearby
// rises above the eyes of someone standing there. A summit with a clear view
// all around has a horizon at or below zero everywhere; a spot under a taller
// neighbour is blocked that way. Used to rank places to test repeaters from.
import { KM_PER_DEG_LAT, kmPerDegLon, type Point } from '../repeaters/geo.ts';
import { NEAR_KM, bulgeM } from './los.ts';

/** One direction every 5°, starting north and going clockwise. */
export const HORIZON_STEPS = 72;
/** Terrain farther than this is left out: what blocks a spot is mostly what stands next to it. */
export const HORIZON_KM = 10;
/** About three DEM pixels. */
export const HORIZON_STEP_KM = 0.05;
/** A handheld at head height. */
export const EYE_HEIGHT_M = 1.5;
/** A direction counts as open while the terrain stays at or below this, in degrees. */
export const OPEN_DEG = 1;

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** The point `km` away in a direction (0° north, clockwise), on a flat projection: fine for tens of km. */
export function destination(from: Point, bearing: number, km: number): Point {
  return {
    lat: from.lat + (km * Math.cos(rad(bearing))) / KM_PER_DEG_LAT,
    lon: from.lon + (km * Math.sin(rad(bearing))) / kmPerDegLon(from.lat),
  };
}

/** The direction from one point to another, 0–360° clockwise from north. */
export function bearingDeg(from: Point, to: Point): number {
  const dLon = rad(to.lon - from.lon);
  const y = Math.sin(dLon) * Math.cos(rad(to.lat));
  const x = Math.cos(rad(from.lat)) * Math.sin(rad(to.lat)) - Math.sin(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.cos(dLon);
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

/** The distances sampled along each direction, skipping what is next to the spot (see NEAR_KM). */
export function rayDistances(): number[] {
  const out: number[] = [];
  for (let km = NEAR_KM; km <= HORIZON_KM + 1e-9; km += HORIZON_STEP_KM) out.push(km);
  return out;
}

/** Every point whose elevation the horizon needs: direction by direction, nearest first. */
export function horizonPoints(center: Point): Point[] {
  const distances = rayDistances();
  const points: Point[] = [];
  for (let i = 0; i < HORIZON_STEPS; i++) {
    for (const km of distances) points.push(destination(center, (i * 360) / HORIZON_STEPS, km));
  }
  return points;
}

/**
 * The horizon, in degrees with one decimal, for each direction. `eyeM` is
 * the eye's height above sea level; `elevations` are those of
 * horizonPoints(), in the same order.
 */
export function horizonAngles(eyeM: number, elevations: readonly number[]): number[] {
  const distances = rayDistances();
  const horizon: number[] = [];
  for (let i = 0; i < HORIZON_STEPS; i++) {
    let highest = -90;
    distances.forEach((km, j) => {
      // How far the Earth has curved away at this distance: the bulge at the middle of a path twice as long.
      const seenM = elevations[i * distances.length + j]! - bulgeM(km, 2 * km);
      highest = Math.max(highest, deg(Math.atan2(seenM - eyeM, km * 1000)));
    });
    horizon.push(Math.round(highest * 10) / 10 || 0);
  }
  return horizon;
}

/** Whether nothing nearby stands in the way in a direction. No horizon (not worked out yet) counts as open. */
export function isOpen(horizon: readonly number[] | undefined, bearing: number): boolean {
  if (!horizon?.length) return true;
  const i = Math.round((((bearing % 360) + 360) % 360) / (360 / horizon.length)) % horizon.length;
  return horizon[i]! <= OPEN_DEG;
}

/** The share of the horizon that is open, 0–1. */
export function openShare(horizon: readonly number[]): number {
  return horizon.length ? horizon.filter((a) => a <= OPEN_DEG).length / horizon.length : 1;
}
