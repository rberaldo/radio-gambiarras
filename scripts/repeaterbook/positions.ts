// One-off: better positions for the bootstrapped overlay (user's request,
// 2026-11-09). Two sources, in order of preference:
//   1. RepeaterBook GPX points that are precise (4+ decimals) and not just the
//      town centre (at least 1 km from the município seat, at most 40 km).
//   2. The site name in the note ("Local: Pico Caratuva"), looked up on
//      OpenStreetMap (Nominatim) near the town, preferring peaks and hills.
// Only touches entries marked `unverified` (or adds one for a GPX-only
// position). Nominatim answers are cached in private/ so reruns stay offline.
//   node scripts/repeaterbook/positions.ts private/worldwide_repeaters_*.gpx
import { readFile, writeFile } from 'node:fs/promises';
import { distanceKm, type Point } from '../../src/lib/repeaters/geo.ts';
import { validateOverlay, type OverlayEntry, type OverlayFile } from '../../src/lib/repeaters/overlay.ts';
import type { AnatelRepeater, AnatelRepeatersFile } from '../../src/lib/repeaters/types.ts';
import { loadMunicipioLookup, normalizeName, type MunicipioLookup } from '../anatel/municipios.ts';
import { toJson } from '../lib/json.ts';
import { SOURCE } from './import.ts';

export interface GpxPoint {
  callsign: string;
  output: number;
  lat: number;
  lon: number;
  /** Digits after the decimal point in the latitude: 2 means about 1 km. */
  decimals: number;
}

/** Waypoints of a RepeaterBook GPX: "<name>PY5OM 437.700000 437.700000</name>". */
export function parseGpx(xml: string): GpxPoint[] {
  const points: GpxPoint[] = [];
  for (const m of xml.matchAll(/<wpt lat="([-\d.]+)" lon="([-\d.]+)">[\s\S]*?<name>([^<]*)<\/name>/g)) {
    const [, lat, lon, name] = m as unknown as [string, string, string, string];
    const freqs = name.match(/\d{3}\.\d+/g);
    if (!freqs) continue;
    points.push({
      callsign: name.trim().split(/\s+/)[0]!.toUpperCase(),
      output: Number(freqs[freqs.length - 1]),
      lat: Number(lat),
      lon: Number(lon),
      decimals: lat.split('.')[1]?.length ?? 0,
    });
  }
  return points;
}

const seat = (a: AnatelRepeater): Point | undefined => (a.lat !== undefined && a.lon !== undefined ? { lat: a.lat, lon: a.lon } : undefined);

/** Precise GPX positions by Anatel id, skipping town-centre geocodes and far-off mistakes. */
export function gpxPositions(points: readonly GpxPoint[], anatel: readonly AnatelRepeater[]): Map<string, Point> {
  const out = new Map<string, Point>();
  for (const p of points) {
    if (p.decimals < 4) continue;
    const a = anatel.find((x) => x.callsign === p.callsign && Math.abs(x.output - p.output) < 0.0126);
    const s = a && seat(a);
    if (!a || !s) continue;
    const km = distanceKm(s, p);
    if (km >= 1 && km <= 40) out.set(a.id, { lat: p.lat, lon: p.lon });
  }
  return out;
}

/** Site names that are not places one can look up. */
const NOT_A_PLACE = /caixa d'água|^labre$|^g\.s\.a\.t\.?$/i;

/**
 * What to look up for a note: the site names and the town to search around.
 * "Local: Campo Magro, Morro do Cal." → town Campo Magro, sites ["Morro do Cal"].
 */
export function siteQuery(notes: string | undefined, a: AnatelRepeater, findMunicipio: MunicipioLookup): { sites: string[]; around: Point } | undefined {
  const local = /^Local: (.+?)\.(?:\s|$)/.exec(notes ?? '')?.[1];
  const s = seat(a);
  if (!local || !s) return undefined;
  const [first = '', ...rest] = local.split(', ');
  const town = findMunicipio(first, a.uf);
  const site = town ? rest.join(', ') : local;
  const around = town ? { lat: town.lat, lon: town.lon } : s;
  const sites = site
    .replace(/^metrô /i, '')
    .split(' - ')
    .map((x) => x.trim())
    .filter((x) => x && !NOT_A_PLACE.test(x));
  return sites.length ? { sites, around } : undefined;
}

export interface NominatimPlace {
  lat: string;
  lon: string;
  name: string;
  class: string;
  type: string;
}

// Peaks and hills first, then towers, places and neighbourhoods; single buildings last.
const RANK: Record<string, number> = { natural: 0, man_made: 1, tourism: 2, place: 3, boundary: 4, leisure: 5, amenity: 5, historic: 5, building: 5, office: 5 };

/** Names compared without accents, case or connectors: "Pico da Ibituruna" = "Pico do Ibituruna". */
const looseName = (s: string) => normalizeName(s).replace(/\b(de|do|da|dos|das|d)\b/g, ' ').replace(/\s+/g, ' ').trim();

/** The best match for a site name: same name, a peak or hill first, never a street. */
export function pickPlace(query: string, places: readonly NominatimPlace[], around: Point, maxKm = 40): { point: Point; place: NominatimPlace } | undefined {
  const want = looseName(query);
  const ok = places
    // A one-word name must match exactly: "Paulista" is not "Campo Limpo Paulista".
    .filter((p) => p.class in RANK && (want.includes(' ') ? looseName(p.name ?? '').includes(want) : looseName(p.name ?? '') === want))
    .map((p) => ({ p, point: { lat: Number(p.lat), lon: Number(p.lon) } }))
    .filter(({ point }) => distanceKm(point, around) <= maxKm)
    .sort((x, y) => RANK[x.p.class]! - RANK[y.p.class]!);
  return ok[0] && { point: ok[0].point, place: ok[0].p };
}

const CACHE = 'private/geocode-cache.json';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function nominatim(query: string, around: Point, cache: Record<string, NominatimPlace[]>): Promise<NominatimPlace[]> {
  const d = 0.4; // about 40 km
  const key = `${query}|${around.lat.toFixed(2)},${around.lon.toFixed(2)}`;
  if (cache[key]) return cache[key];
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    countrycodes: 'br',
    limit: '8',
    bounded: '1',
    viewbox: `${around.lon - d},${around.lat + d},${around.lon + d},${around.lat - d}`,
  });
  await sleep(1100); // Nominatim's policy: at most one request per second.
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'User-Agent': 'radio-gambiarras one-off repeater site lookup (github.com/rberaldo/radio-gambiarras)' },
  });
  if (!res.ok) throw new Error(`Nominatim ${res.status} for ${query}`);
  const places = ((await res.json()) as NominatimPlace[]).map(({ lat, lon, name, category, type }: NominatimPlace & { category?: string }) => ({
    lat,
    lon,
    name,
    class: category ?? '',
    type,
  }));
  cache[key] = places;
  return places;
}

const round5 = (n: number) => Number(n.toFixed(5));

if (import.meta.main) {
  const gpxFiles = process.argv.slice(2);
  const anatel = (JSON.parse(await readFile('data/repeaters/anatel.json', 'utf8')) as AnatelRepeatersFile).repeaters;
  const byId = new Map(anatel.map((a) => [a.id, a]));
  const overlayPath = 'data/repeaters/overlay.json';
  const overlay = JSON.parse(await readFile(overlayPath, 'utf8')) as OverlayFile;
  const cache = JSON.parse(await readFile(CACHE, 'utf8').catch(() => '{}')) as Record<string, NominatimPlace[]>;
  const findMunicipio = await loadMunicipioLookup();
  const entries: Record<string, OverlayEntry> = { ...overlay.entries };
  const editable = (id: string) => !entries[id] || entries[id].unverified;
  const counts = { gpx: 0, osm: 0, found: [] as string[], notFound: [] as string[] };

  const points = (await Promise.all(gpxFiles.map((f) => readFile(f, 'utf8')))).flatMap(parseGpx);
  for (const [id, p] of gpxPositions(points, anatel)) {
    if (!editable(id)) continue;
    const e = entries[id] ?? { source: SOURCE, date: new Date().toISOString().slice(0, 10), unverified: true };
    entries[id] = { ...e, lat: round5(p.lat), lon: round5(p.lon), source: `${SOURCE.replace(/ \(a conferir\)$/, '')}; posição do GPX (a conferir)` };
    counts.gpx++;
  }

  for (const [id, e] of Object.entries(entries)) {
    const a = byId.get(id);
    if (!a || !e.unverified || e.lat !== undefined) continue;
    const q = siteQuery(e.notes, a, findMunicipio);
    if (!q) continue;
    let found: Point | undefined;
    for (const site of q.sites) {
      const pick = pickPlace(site, await nominatim(site, q.around, cache), q.around);
      if (!pick) continue;
      found = pick.point;
      const km = distanceKm(pick.point, seat(a)!).toFixed(1);
      counts.found.push(`${id}: ${site} → ${pick.place.name} (${pick.place.class}/${pick.place.type}), ${km} km from ${a.municipio}`);
      break;
    }
    if (!found) {
      counts.notFound.push(`${id}: ${q.sites.join(' - ')}`);
      continue;
    }
    entries[id] = { ...e, lat: round5(found.lat), lon: round5(found.lon), source: `${SOURCE.replace(/ \(a conferir\)$/, '')}; posição pelo nome do local no OpenStreetMap (a conferir)` };
    counts.osm++;
  }
  await writeFile(CACHE, JSON.stringify(cache));

  const next: OverlayFile = { ...overlay, entries: Object.fromEntries(Object.keys(entries).sort().map((k) => [k, entries[k]!])) };
  const problems = validateOverlay(next, new Set(anatel.map((a) => a.id)));
  if (problems.length) throw new Error(`overlay would be invalid:\n  ${problems.join('\n  ')}`);
  await writeFile(overlayPath, toJson(next));
  console.log(`GPX positions: ${counts.gpx}; positions from site names: ${counts.osm}`);
  console.log(`found:\n  ${counts.found.join('\n  ')}`);
  if (counts.notFound.length) console.log(`site names not found:\n  ${counts.notFound.join('\n  ')}`);
}
