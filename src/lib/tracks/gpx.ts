// GPX: recorded tracks (<trk><trkseg><trkpt>) and planned routes
// (<rte><rtept>). Waypoints (<wpt>) are ignored. Read with regular
// expressions rather than DOMParser so it also runs in tests and workers;
// GPX is simple and machine-written, so this is enough.
import type { Point } from '../repeaters/geo.ts';
import { cleanTrack, type Track } from './track.ts';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function text(raw: string): string {
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(raw);
  if (cdata) return cdata[1]!;
  return raw.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] !== '#') return ENTITIES[e] ?? m;
    const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1));
    // A broken reference stays as written rather than failing the whole file.
    return code <= 0x10ffff ? String.fromCodePoint(code) : m;
  });
}

/** A number attribute; NaN when missing or blank (Number('') would be 0, a point off Africa). */
function attr(attrs: string, name: string): number {
  const value = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`).exec(attrs)?.[1]?.trim();
  return value ? Number(value) : NaN;
}

/** Points of every <tag ...> inside `block`, e.g. all trkpt of a segment. */
function points(block: string, tag: string): Point[] {
  const out: Point[] = [];
  for (const m of block.matchAll(new RegExp(`<(?:\\w+:)?${tag}\\b([^>]*)>`, 'g'))) out.push({ lat: attr(m[1]!, 'lat'), lon: attr(m[1]!, 'lon') });
  return out;
}

const NAME = /<(?:\w+:)?name>([\s\S]*?)<\/(?:\w+:)?name>/;

const blocks = (xml: string, tag: string) => [...xml.matchAll(new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, 'g'))].map((m) => m[1]!);

/** The file is GPX by its content (a <gpx> root near the start), whatever its name. */
export const isGpx = (content: string) => /<(?:\w+:)?gpx[\s>]/.test(content.slice(0, 4000));

export const hasWaypoints = (content: string) => /<(?:\w+:)?wpt\b/.test(content);

/**
 * One track: its name. Several ("Dia 1", "Dia 2"): the file's own name if it
 * has one, else theirs joined ("Dia 1 + Dia 2", "Dia 1 + Dia 2 + mais 3").
 */
function trailName(names: readonly string[], fileName: string | undefined): string | undefined {
  if (names.length <= 1) return names[0] ?? fileName;
  if (fileName?.trim()) return fileName;
  return names.length === 2 ? names.join(' + ') : `${names[0]} + ${names[1]} + mais ${names.length - 2}`;
}

export function parseGpx(source: string): Track | undefined {
  // Commented-out points are not part of the trail.
  const xml = source.replace(/<!--[\s\S]*?-->/g, '');
  const tracks = blocks(xml, 'trk');
  const routes = blocks(xml, 'rte');
  const lines = [...tracks.flatMap((t) => blocks(t, 'trkseg').map((s) => points(s, 'trkpt'))), ...routes.map((r) => points(r, 'rtept'))];
  // A track's own name sits before its points (so it is not a point's name).
  const ownName = (block: string) => NAME.exec(block.split(/<(?:\w+:)?(?:trkseg|rtept)\b/)[0]!)?.[1];
  const names = [...new Set([...tracks, ...routes].map(ownName).filter((n): n is string => !!n).map((n) => text(n).trim()))].filter(Boolean);
  const metadata = blocks(xml, 'metadata')[0];
  const fileName = metadata && NAME.exec(metadata)?.[1];
  return cleanTrack(trailName(names, fileName === undefined ? undefined : text(fileName)), lines);
}
