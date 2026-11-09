// A trail read from a file: one or more lines of points (a GPX file can hold
// several tracks and segments; gaps between them are not joined).
import type { Point } from '../repeaters/geo.ts';
import { distanceKm } from '../repeaters/geo.ts';

export interface Track {
  /** Name from the file, if it has one ("Travessia Petrópolis–Teresópolis"). */
  name?: string;
  /** Each line has at least two points. */
  lines: Point[][];
}

/** Total length in km, gaps between lines not counted. */
export function trackLengthKm(track: Track): number {
  let km = 0;
  for (const line of track.lines) for (let i = 1; i < line.length; i++) km += distanceKm(line[i - 1]!, line[i]!);
  return km;
}

/** South-west and north-east corners, as [[lon, lat], [lon, lat]] for the map. */
export function trackBounds(track: Track): [[number, number], [number, number]] {
  let [w, s, e, n] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const line of track.lines) {
    for (const p of line) {
      w = Math.min(w, p.lon);
      e = Math.max(e, p.lon);
      s = Math.min(s, p.lat);
      n = Math.max(n, p.lat);
    }
  }
  return [
    [w, s],
    [e, n],
  ];
}

/** Keeps lines with at least two valid points; undefined when nothing is left. */
export function cleanTrack(name: string | undefined, lines: Point[][]): Track | undefined {
  const valid = (p: Point) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
  const kept = lines.map((l) => l.filter(valid)).filter((l) => l.length >= 2);
  if (!kept.length) return undefined;
  const clean = name?.trim();
  return clean ? { name: clean, lines: kept } : { lines: kept };
}
