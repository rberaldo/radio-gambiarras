// Line of sight between two antennas over a terrain profile: the straight
// line, the Earth's bulge (with the usual 4/3 radio horizon) and the first
// Fresnel zone, the space around the line the signal needs mostly clear.
// An estimate: VHF and UHF also bend around hills, weaker.
import { distanceKm, type Point } from '../repeaters/geo.ts';

/** Earth radius in metres, and the standard atmosphere's effective-radius factor. */
const EARTH_M = 6_371_008.8;
const K = 4 / 3;

/** The share of the first Fresnel zone that should be clear for a solid path. */
const CLEAR_SHARE = 0.6;

/**
 * Obstacles this close to either end are left out. The elevation data is a
 * surface model (roofs and treetops count), so the building next to you would
 * otherwise "block" everything, and you can always step past it.
 */
export const NEAR_KM = 0.25;

export interface ProfilePoint {
  /** From the first end, in km. */
  km: number;
  /** Ground elevation, metres above sea level. */
  elevM: number;
}

export type Verdict = 'livre' | 'limite' | 'bloqueada';

export interface LosResult {
  verdict: Verdict;
  lengthKm: number;
  /** Where the terrain comes closest to (or through) the line. */
  worst: { km: number; elevM: number; clearanceM: number; fresnelM: number };
}

/** Points every `stepKm` (or closer) from a to b, both ends included. */
export function samplePath(a: Point, b: Point, stepKm: number): Point[] {
  const n = Math.max(2, Math.ceil(distanceKm(a, b) / stepKm) + 1);
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
  });
}

/** How far the Earth bulges up between the ends, in metres, `km` along a path of `lengthKm`. */
export function bulgeM(km: number, lengthKm: number): number {
  return (km * 1000 * (lengthKm - km) * 1000) / (2 * K * EARTH_M);
}

/** Radius of the first Fresnel zone in metres, `km` along a path of `lengthKm`. */
export function fresnelM(km: number, lengthKm: number, freqMHz: number): number {
  const wavelength = 299.792458 / freqMHz;
  const d1 = km * 1000;
  const d2 = (lengthKm - km) * 1000;
  return d1 <= 0 || d2 <= 0 ? 0 : Math.sqrt((wavelength * d1 * d2) / (d1 + d2));
}

/** Height of the straight line between the two antennas, `km` along. */
export function lineM(profile: readonly ProfilePoint[], km: number, fromHeightM: number, toHeightM: number): number {
  const first = profile[0]!;
  const last = profile[profile.length - 1]!;
  const a = first.elevM + fromHeightM;
  const b = last.elevM + toHeightM;
  return a + ((b - a) * km) / last.km;
}

/**
 * The verdict for a profile from one antenna to the other:
 * livre — line and 60% of the Fresnel zone clear; limite — the line is clear
 * but terrain enters the zone (expect a weak or fading signal); bloqueada —
 * terrain crosses the line.
 */
export function lineOfSight(profile: readonly ProfilePoint[], fromHeightM: number, toHeightM: number, freqMHz: number): LosResult {
  const lengthKm = profile[profile.length - 1]!.km;
  // Standing next to the antenna: nothing in between.
  if (!(lengthKm > 0)) return { verdict: 'livre', lengthKm: 0, worst: { km: 0, elevM: profile[0]!.elevM, clearanceM: Infinity, fresnelM: 0 } };
  let worst = { km: 0, elevM: profile[0]!.elevM, clearanceM: Infinity, fresnelM: 0 };
  let worstShare = Infinity;
  for (const p of profile.slice(1, -1)) {
    if (p.km < NEAR_KM || p.km > lengthKm - NEAR_KM) continue;
    const clearanceM = lineM(profile, p.km, fromHeightM, toHeightM) - (p.elevM + bulgeM(p.km, lengthKm));
    const zone = fresnelM(p.km, lengthKm, freqMHz);
    const share = zone ? clearanceM / zone : clearanceM >= 0 ? Infinity : -Infinity;
    if (share < worstShare) {
      worstShare = share;
      worst = { km: p.km, elevM: p.elevM, clearanceM, fresnelM: zone };
    }
  }
  const verdict: Verdict = worst.clearanceM < 0 ? 'bloqueada' : worstShare < CLEAR_SHARE ? 'limite' : 'livre';
  return { verdict, lengthKm, worst };
}
