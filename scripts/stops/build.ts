// Works out each stop's ground elevation and horizon from Mapterhorn's
// relief tiles and writes data/repeaters/stops.json for the planning page.
// Positions come from OpenStreetMap; a summit is moved to the highest point
// nearby, since a map's peak and the relief's highest pixel rarely coincide.
// A stop whose altitude is far from the known one is flagged: check its
// position before trusting its horizon. Run by hand after
// editing a list; leaves the previous file in place when anything looks wrong.
//   node scripts/stops/build.ts
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { DEM_MAX_ZOOM, DEM_TILE_SIZE as SIZE, DEM_URL, terrariumElevation, tilePixel } from '../../src/lib/dem/terrarium.ts';
import { EYE_HEIGHT_M, horizonAngles, horizonPoints, openShare } from '../../src/lib/radio/horizon.ts';
import { KM_PER_DEG_LAT, kmPerDegLon, type Point } from '../../src/lib/repeaters/geo.ts';
import { validateStops, type Stop, type StopsFile } from '../../src/lib/repeaters/stops.ts';
import { toJson } from '../lib/json.ts';

const LISTS = ['scripts/stops/rj.json'];
const OUT = 'data/repeaters/stops.json';
/** How far a summit may move (unless the list says), and the grid it is searched on. */
const SNAP_M = 300;
const SNAP_STEP_M = 15;
/** The relief is a 30 m model, smoothed: a needle like the Corcovado comes out 60–80 m lower. */
const ELEV_TOLERANCE_M = 100;

interface ListedStop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  summit?: boolean;
  snapM?: number;
  /** From OpenStreetMap, to catch a wrong position. */
  knownElevM?: number;
  note?: string;
}

const tiles = new Map<string, Promise<Buffer | null>>();

async function readTile(x: number, y: number): Promise<Buffer | null> {
  const url = DEM_URL.replace('{z}', String(DEM_MAX_ZOOM)).replace('{x}', String(x)).replace('{y}', String(y));
  const res = await fetch(url);
  // Tiles over the sea are missing: sea level.
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const { data, info } = await sharp(Buffer.from(await res.arrayBuffer())).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== SIZE || info.height !== SIZE) throw new Error(`${url}: ${info.width}×${info.height}, esperava ${SIZE}×${SIZE}`);
  return data;
}

function tile(x: number, y: number): Promise<Buffer | null> {
  const key = `${x}/${y}`;
  if (!tiles.has(key)) tiles.set(key, readTile(x, y));
  return tiles.get(key)!;
}

async function elevations(points: readonly Point[]): Promise<number[]> {
  const at = points.map((p) => tilePixel(p, DEM_MAX_ZOOM, SIZE));
  await Promise.all([...new Set(at.map((a) => `${a.x}/${a.y}`))].map((k) => tile(...(k.split('/').map(Number) as [number, number]))));
  return Promise.all(
    at.map(async ({ x, y, px, py }) => {
      const data = await tile(x, y);
      if (!data) return 0;
      const i = (py * SIZE + px) * 4;
      return terrariumElevation(data[i]!, data[i + 1]!, data[i + 2]!);
    }),
  );
}

/** The highest point within `radiusM`, and its elevation. */
async function summit(p: Point, radiusM: number): Promise<{ at: Point; elevM: number }> {
  const grid: Point[] = [p];
  const steps = Math.round(radiusM / SNAP_STEP_M);
  for (let i = -steps; i <= steps; i++) {
    for (let j = -steps; j <= steps; j++) {
      if (Math.hypot(i, j) > steps) continue;
      grid.push({ lat: p.lat + (i * SNAP_STEP_M) / 1000 / KM_PER_DEG_LAT, lon: p.lon + (j * SNAP_STEP_M) / 1000 / kmPerDegLon(p.lat) });
    }
  }
  const elev = await elevations(grid);
  let best = 0;
  for (let k = 1; k < grid.length; k++) if (elev[k]! > elev[best]!) best = k;
  return { at: grid[best]!, elevM: elev[best]! };
}

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;

const stops: Stop[] = [];
const doubtful: string[] = [];
for (const path of LISTS) {
  const list = JSON.parse(await readFile(path, 'utf8')) as { stops: ListedStop[] };
  for (const s of list.stops) {
    const { at, elevM } = s.summit ? await summit(s, s.snapM ?? SNAP_M) : { at: { lat: s.lat, lon: s.lon }, elevM: (await elevations([s]))[0]! };
    const horizon = horizonAngles(elevM + EYE_HEIGHT_M, await elevations(horizonPoints(at)));
    const stop: Stop = { id: s.id, name: s.name, lat: round(at.lat, 5), lon: round(at.lon, 5), elevM: Math.round(elevM), horizon };
    if (s.note) stop.note = s.note;
    stops.push(stop);
    const moved = Math.round(Math.hypot((at.lat - s.lat) * KM_PER_DEG_LAT, (at.lon - s.lon) * kmPerDegLon(s.lat)) * 1000);
    const off = s.knownElevM === undefined ? 0 : stop.elevM - s.knownElevM;
    if (Math.abs(off) > ELEV_TOLERANCE_M) doubtful.push(`${s.name}: ${stop.elevM} m no relevo, ${s.knownElevM} m no mapa`);
    console.log(`${s.name}: ${stop.elevM} m${s.knownElevM === undefined ? '' : ` (mapa: ${s.knownElevM} m)`}, horizonte ${Math.round(openShare(horizon) * 100)}% aberto${moved ? `, movido ${moved} m` : ''}`);
  }
}

if (doubtful.length) {
  console.error(`Altitude longe da conhecida (posição errada?); nada escrito:\n  ${doubtful.join('\n  ')}`);
  process.exit(1);
}

const file: StopsFile = {
  format: 1,
  source: 'Posições do OpenStreetMap; altitude e horizonte do relevo Mapterhorn (Copernicus GLO-30)',
  updatedAt: new Date().toISOString().slice(0, 10),
  stops,
};
const problems = validateStops(file);
if (problems.length) {
  console.error(`Nada escrito:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
await writeFile(OUT, toJson(file));
console.log(`${stops.length} paradas em ${OUT} (${tiles.size} blocos de relevo lidos).`);
