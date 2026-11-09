// Elevation tiles in the Terrarium encoding (Mapterhorn, AWS Terrain Tiles):
// which tile and pixel hold a point, and the elevation a pixel's colour means.
import type { Point } from '../repeaters/geo.ts';

/** Where a point falls in the Web Mercator tile grid at zoom `z`, for tiles `size` pixels wide. */
export function tilePixel(p: Point, z: number, size: number): { x: number; y: number; px: number; py: number } {
  const n = 2 ** z;
  const lat = (p.lat * Math.PI) / 180;
  const fx = ((p.lon + 180) / 360) * n;
  const fy = ((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * n;
  const x = Math.floor(fx);
  const y = Math.floor(fy);
  return { x, y, px: Math.min(size - 1, Math.floor((fx - x) * size)), py: Math.min(size - 1, Math.floor((fy - y) * size)) };
}

/** Metres above sea level for a Terrarium pixel. */
export const terrariumElevation = (r: number, g: number, b: number) => r * 256 + g + b / 256 - 32768;
