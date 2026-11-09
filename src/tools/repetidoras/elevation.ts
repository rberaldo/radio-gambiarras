// Ground elevation for points, read from the same Mapterhorn tiles the map
// uses for relief (zoom 12, about 18 m per pixel over Brazil). Tiles are
// fetched on demand and kept, so a second profile in the same area is free.
// Tiles over the sea return 404: those points count as sea level.
import { terrariumElevation, tilePixel } from '../../lib/dem/terrarium.ts';
import type { Point } from '../../lib/repeaters/geo.ts';
import { DEM_MAX_ZOOM, DEM_URL } from './mapStyle.ts';

const SIZE = 512;
/** About 30 MB of pixels at most; the oldest tiles go first. */
const MAX_TILES = 30;
const tiles = new Map<string, Promise<Uint8ClampedArray | null>>();

async function readTile(z: number, x: number, y: number): Promise<Uint8ClampedArray | null> {
  const res = await fetch(DEM_URL.replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y)));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`relevo: HTTP ${res.status}`);
  const bitmap = await createImageBitmap(await res.blob());
  const canvas = typeof OffscreenCanvas === 'undefined' ? Object.assign(document.createElement('canvas'), { width: SIZE, height: SIZE }) : new OffscreenCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, SIZE, SIZE).data;
}

function tile(z: number, x: number, y: number): Promise<Uint8ClampedArray | null> {
  const key = `${z}/${x}/${y}`;
  let t = tiles.get(key);
  if (!t) {
    t = readTile(z, x, y);
    // A failed fetch is not kept, so a later try can succeed.
    t.catch(() => tiles.delete(key));
    tiles.set(key, t);
    if (tiles.size > MAX_TILES) tiles.delete(tiles.keys().next().value!);
  }
  return t;
}

/** Elevation in metres for each point, in order. */
export async function elevations(points: readonly Point[]): Promise<number[]> {
  const at = points.map((p) => tilePixel(p, DEM_MAX_ZOOM, SIZE));
  const keys = [...new Set(at.map((a) => `${a.x}/${a.y}`))];
  const loaded = new Map(await Promise.all(keys.map(async (k) => [k, await tile(DEM_MAX_ZOOM, ...(k.split('/').map(Number) as [number, number]))] as const)));
  return at.map(({ x, y, px, py }) => {
    const data = loaded.get(`${x}/${y}`);
    if (!data) return 0;
    const i = (py * SIZE + px) * 4;
    return terrariumElevation(data[i]!, data[i + 1]!, data[i + 2]!);
  });
}
