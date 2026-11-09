// A trail in a shareable link, after the "#" (never sent to any server):
//   /repetidoras?raio=20#trilha=<polyline>,<polyline>&nome=Pico%20Paraná
// Lines are Google's encoded polyline format (5 decimals, about 1 m), joined
// by commas. The trail is simplified until the link stays short.
import type { Point } from '../repeaters/geo.ts';
import { simplifyTrack } from './simplify.ts';
import { cleanTrack, type Track } from './track.ts';

/** Links much longer than this get cut by chat apps and some browsers. */
export const MAX_LINK_CHARS = 3000;

function encodeNumber(n: number): string {
  let v = n < 0 ? ~(n << 1) : n << 1;
  let out = '';
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  return out + String.fromCharCode(v + 63);
}

export function encodeLine(line: readonly Point[]): string {
  let lat = 0;
  let lon = 0;
  let out = '';
  for (const p of line) {
    const la = Math.round(p.lat * 1e5);
    const lo = Math.round(p.lon * 1e5);
    out += encodeNumber(la - lat) + encodeNumber(lo - lon);
    lat = la;
    lon = lo;
  }
  return out;
}

export function decodeLine(s: string): Point[] | undefined {
  const values: number[] = [];
  let shift = 0;
  let acc = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i) - 63;
    if (c < 0 || c > 63) return undefined;
    acc |= (c & 0x1f) << shift;
    shift += 5;
    if (c < 0x20) {
      values.push(acc & 1 ? ~(acc >> 1) : acc >> 1);
      acc = 0;
      shift = 0;
    }
  }
  if (shift || values.length % 2) return undefined;
  const line: Point[] = [];
  let lat = 0;
  let lon = 0;
  for (let i = 0; i < values.length; i += 2) {
    lat += values[i]!;
    lon += values[i + 1]!;
    line.push({ lat: lat / 1e5, lon: lon / 1e5 });
  }
  return line;
}

const encodeTrack = (t: Track) => t.lines.map(encodeLine).join(',');

/**
 * The trail as it goes in a link: simplified just enough to fit. Results
 * are computed on this version, so whoever opens the link sees the same list.
 */
export function shareableTrack(track: Track): Track {
  for (const toleranceKm of [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2]) {
    const t = simplifyTrack(track, toleranceKm);
    if (encodeTrack(t).length <= MAX_LINK_CHARS) return t;
  }
  return simplifyTrack(track, 5);
}

/** "#trilha=…&nome=…" for a trail already made shareable. */
export function writeTrackHash(track: Track): string {
  const p = new URLSearchParams({ trilha: encodeTrack(track) });
  if (track.name) p.set('nome', track.name.slice(0, 120));
  return `#${p}`;
}

export function readTrackHash(hash: string): Track | undefined {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const encoded = p.get('trilha');
  if (!encoded) return undefined;
  const lines = encoded.split(',').map(decodeLine);
  if (lines.some((l) => !l)) return undefined;
  return cleanTrack(p.get('nome') ?? undefined, lines as Point[][]);
}
