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
  return raw.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e] ?? m),
  );
}

function attr(attrs: string, name: string): number {
  const m = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`).exec(attrs);
  return m ? Number(m[1]) : NaN;
}

/** Points of every <tag ...> inside `block`, e.g. all trkpt of a segment. */
function points(block: string, tag: string): Point[] {
  const out: Point[] = [];
  for (const m of block.matchAll(new RegExp(`<(?:\\w+:)?${tag}\\b([^>]*)>`, 'g'))) out.push({ lat: attr(m[1]!, 'lat'), lon: attr(m[1]!, 'lon') });
  return out;
}

const NAME = /<(?:\w+:)?name>([\s\S]*?)<\/(?:\w+:)?name>/;

const blocks = (xml: string, tag: string) => [...xml.matchAll(new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, 'g'))].map((m) => m[1]!);

export const looksLikeGpx = (fileName: string, content: string) => /\.gpx$/i.test(fileName) || /<gpx[\s>]/.test(content.slice(0, 2000));

export function parseGpx(xml: string): Track | undefined {
  const tracks = blocks(xml, 'trk');
  const routes = blocks(xml, 'rte');
  const lines = [...tracks.flatMap((t) => blocks(t, 'trkseg').map((s) => points(s, 'trkpt'))), ...routes.map((r) => points(r, 'rtept'))];
  // The first track's or route's own name (before its points, so not a point's name), else the file's.
  const ownName = (block: string) => NAME.exec(block.split(/<(?:\w+:)?(?:trkseg|rtept)\b/)[0]!)?.[1];
  const metadata = blocks(xml, 'metadata')[0];
  const name = [...tracks, ...routes].map(ownName).find(Boolean) ?? (metadata && NAME.exec(metadata)?.[1]);
  return cleanTrack(name === undefined ? undefined : text(name), lines);
}
