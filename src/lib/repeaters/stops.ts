// Places to test repeaters from ("paradas"): reachable spots with a wide
// view, each with its horizon worked out ahead of time by
// scripts/stops/build.ts. A stop is worth what it adds to the vetting: the
// repeaters around it that still need a check, the nearer the better, and
// much less when the stop is blocked in their direction. Most repeaters are
// only placed at their town's seat, so this is a guide, not a prediction.
import { HORIZON_STEPS, bearingDeg, isOpen } from '../radio/horizon.ts';
import { distanceKm, type Nearby, type Point } from './geo.ts';
import type { Repeater } from './merge.ts';
import { vettingStatus } from './vetting.ts';

export interface Stop extends Point {
  id: string;
  name: string;
  /** Ground elevation, metres above sea level. */
  elevM: number;
  /** Degrees above eye level in HORIZON_STEPS directions (see horizon.ts); missing while not worked out. */
  horizon?: number[];
  /** How to get there, in Portuguese. */
  note?: string;
}

export interface StopsFile {
  format: 1;
  source: string;
  updatedAt: string;
  stops: Stop[];
}

/** Repeaters this close count in full; from here the weight falls to FAR_WEIGHT at the radius. */
export const FULL_KM = 15;
export const FAR_WEIGHT = 0.3;
/** A repeater behind nearby terrain may still open (its antenna is on a hill), but do not count on it. */
export const BLOCKED_WEIGHT = 0.25;

/** Worth a trip: never checked, checked long ago, failed since, or reported off the air without confirmation. */
export function needsCheck(r: Repeater, today: Date = new Date()): boolean {
  const status = vettingStatus(r, today);
  return status !== 'recente' && status !== 'fora-do-ar';
}

export interface Covered {
  repeater: Repeater;
  distanceKm: number;
  /** Direction from the stop, 0–360° clockwise from north. */
  bearing: number;
  /** Nothing near the stop stands in that direction. */
  open: boolean;
  /** What this repeater adds to the stop's score, 0–1. */
  weight: number;
}

/** The repeaters within reach of a stop, nearest first. Pass only those that need a check. */
export function coverage(stop: Pick<Stop, 'lat' | 'lon' | 'horizon'>, repeaters: readonly Repeater[], radiusKm: number): Covered[] {
  const found: Covered[] = [];
  for (const repeater of repeaters) {
    if (!repeater.position) continue;
    const km = distanceKm(stop, repeater.position);
    if (km > radiusKm) continue;
    const bearing = bearingDeg(stop, repeater.position);
    // On top of the repeater's (often approximate) spot there is no direction to speak of.
    const open = km < 1 || isOpen(stop.horizon, bearing);
    const near = km <= FULL_KM || radiusKm <= FULL_KM ? 1 : 1 - ((1 - FAR_WEIGHT) * (km - FULL_KM)) / (radiusKm - FULL_KM);
    found.push({ repeater, distanceKm: km, bearing, open, weight: near * (open ? 1 : BLOCKED_WEIGHT) });
  }
  return found.sort((a, b) => a.distanceKm - b.distanceKm || a.repeater.id.localeCompare(b.repeater.id));
}

export interface Ranked<S> {
  stop: S;
  covered: Covered[];
  /** The sum of the weights of everything it covers. */
  score: number;
  /** What it adds to the stops already chosen: a repeater counts only for what it gains over them. */
  gain: number;
}

/** Every stop with its coverage, the one that adds most to `chosen` first. */
export function rankStops<S extends Pick<Stop, 'id' | 'lat' | 'lon' | 'horizon'>>(
  stops: readonly S[],
  chosen: readonly Pick<Stop, 'lat' | 'lon' | 'horizon'>[],
  repeaters: readonly Repeater[],
  radiusKm: number,
): Ranked<S>[] {
  const best = new Map<string, number>();
  for (const s of chosen) {
    for (const c of coverage(s, repeaters, radiusKm)) best.set(c.repeater.id, Math.max(best.get(c.repeater.id) ?? 0, c.weight));
  }
  return stops
    .map((stop) => {
      const covered = coverage(stop, repeaters, radiusKm);
      let score = 0;
      let gain = 0;
      for (const c of covered) {
        score += c.weight;
        gain += Math.max(0, c.weight - (best.get(c.repeater.id) ?? 0));
      }
      return { stop, covered, score, gain };
    })
    .sort((a, b) => b.gain - a.gain || b.score - a.score || a.stop.id.localeCompare(b.stop.id));
}

/**
 * Everything an outing reaches, each repeater once, under the stop that
 * hears it best (the earlier stop on a tie): stop by stop, nearest first.
 * For the outing's CHIRP file, so the channels come in the order of the day.
 */
export function outingRepeaters(stops: readonly Pick<Stop, 'lat' | 'lon' | 'horizon'>[], repeaters: readonly Repeater[], radiusKm: number): Nearby[] {
  const best = new Map<string, { stop: number; covered: Covered }>();
  stops.forEach((s, i) => {
    for (const c of coverage(s, repeaters, radiusKm)) {
      const old = best.get(c.repeater.id);
      if (!old || c.weight > old.covered.weight) best.set(c.repeater.id, { stop: i, covered: c });
    }
  });
  return [...best.values()]
    .sort((a, b) => a.stop - b.stop || a.covered.distanceKm - b.covered.distanceKm || a.covered.repeater.id.localeCompare(b.covered.repeater.id))
    .map(({ covered }) => ({ repeater: covered.repeater, distanceKm: covered.distanceKm }));
}

/** "NE", "S"…: the eight winds, as Portuguese abbreviates them. */
export function compass(bearing: number): string {
  return ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'][Math.round((((bearing % 360) + 360) % 360) / 45) % 8]!;
}

/** Problems in a stops file, as readable messages; empty when it can be published. */
export function validateStops(file: StopsFile): string[] {
  const problems: string[] = [];
  if (file.format !== 1) problems.push('formato desconhecido');
  if (!file.stops.length) problems.push('nenhuma parada');
  const seen = new Set<string>();
  for (const s of file.stops) {
    const where = s.id || s.name || '(sem nome)';
    if (!/^[a-z0-9-]+$/.test(s.id ?? '')) problems.push(`${where}: id inválido`);
    if (seen.has(s.id)) problems.push(`${where}: id repetido`);
    seen.add(s.id);
    if (!s.name?.trim()) problems.push(`${where}: sem nome`);
    if (!(s.lat >= -34 && s.lat <= 6 && s.lon >= -74 && s.lon <= -28)) problems.push(`${where}: fora do Brasil`);
    if (!Number.isFinite(s.elevM)) problems.push(`${where}: sem altitude`);
    if (s.horizon?.length !== HORIZON_STEPS || !s.horizon.every((a) => Number.isFinite(a) && a >= -90 && a <= 90)) problems.push(`${where}: horizonte inválido`);
  }
  return problems;
}
