// Fewer points, same shape: Douglas–Peucker on a local flat projection.
// A phone log of 50,000 points becomes a few hundred, which is all a 10 km
// corridor or a link needs.
import type { Point } from '../repeaters/geo.ts';
import type { Track } from './track.ts';

const KM_PER_DEG_LAT = 110.574;

/** Distance in km from p to the segment a–b, all in a local flat projection. */
function offsetKm(p: Point, a: Point, b: Point, kmPerDegLon: number): number {
  const ax = a.lon * kmPerDegLon;
  const ay = a.lat * KM_PER_DEG_LAT;
  const dx = b.lon * kmPerDegLon - ax;
  const dy = b.lat * KM_PER_DEG_LAT - ay;
  const px = p.lon * kmPerDegLon - ax;
  const py = p.lat * KM_PER_DEG_LAT - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, (px * dx + py * dy) / len2)) : 0;
  return Math.hypot(px - t * dx, py - t * dy);
}

export function simplifyLine(line: readonly Point[], toleranceKm: number): Point[] {
  if (line.length <= 2) return [...line];
  const kmPerDegLon = 111.32 * Math.cos((line[0]!.lat * Math.PI) / 180);
  const keep = new Uint8Array(line.length);
  keep[0] = keep[line.length - 1] = 1;
  // Iterative, so a long log cannot overflow the stack.
  const stack: [number, number][] = [[0, line.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let worst = -1;
    let worstKm = toleranceKm;
    for (let i = first + 1; i < last; i++) {
      const km = offsetKm(line[i]!, line[first]!, line[last]!, kmPerDegLon);
      if (km > worstKm) {
        worst = i;
        worstKm = km;
      }
    }
    if (worst > 0) {
      keep[worst] = 1;
      stack.push([first, worst], [worst, last]);
    }
  }
  return line.filter((_, i) => keep[i]);
}

export function simplifyTrack(track: Track, toleranceKm: number): Track {
  return { ...track, lines: track.lines.map((l) => simplifyLine(l, toleranceKm)) };
}
