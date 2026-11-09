// Fewer points, same shape: Douglas–Peucker on a local flat projection.
// A phone log of 50,000 points becomes a few hundred, which is all a 10 km
// corridor or a link needs.
import { KM_PER_DEG_LAT, kmPerDegLon, toSegment, type Point } from '../repeaters/geo.ts';
import type { Track } from './track.ts';

/**
 * Drops points closer than `toleranceKm` to the last one kept: one cheap pass
 * that takes most of a dense or jittery log away before Douglas–Peucker,
 * whose cost grows fast with noise. The last point always stays.
 */
function thin(line: readonly Point[], toleranceKm: number, kx: number): Point[] {
  const out = [line[0]!];
  const max2 = toleranceKm * toleranceKm;
  for (let i = 1; i < line.length - 1; i++) {
    const p = line[i]!;
    const last = out[out.length - 1]!;
    const dx = (p.lon - last.lon) * kx;
    const dy = (p.lat - last.lat) * KM_PER_DEG_LAT;
    if (dx * dx + dy * dy > max2) out.push(p);
  }
  out.push(line[line.length - 1]!);
  return out;
}

export function simplifyLine(source: readonly Point[], toleranceKm: number): Point[] {
  if (source.length <= 2) return [...source];
  const kx = kmPerDegLon(source[0]!.lat);
  const line = thin(source, toleranceKm, kx);
  const keep = new Uint8Array(line.length);
  keep[0] = keep[line.length - 1] = 1;
  // Iterative, so a long log cannot overflow the stack.
  const stack: [number, number][] = [[0, line.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let worst = -1;
    let worstKm = toleranceKm;
    for (let i = first + 1; i < last; i++) {
      const { km } = toSegment(line[i]!, line[first]!, line[last]!, kx);
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
