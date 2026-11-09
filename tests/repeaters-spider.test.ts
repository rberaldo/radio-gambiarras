import { describe, expect, it } from 'vitest';
import type { Feature, Point as GeoPoint } from 'geojson';
import { shouldFanOut } from '../src/tools/repetidoras/mapSpider.ts';
import { spiderOffsets } from '../src/tools/repetidoras/spider.ts';

const dist = ([ax, ay]: [number, number], [bx, by]: [number, number]) => Math.hypot(ax - bx, ay - by);
const minGap = (pts: [number, number][]) => {
  let min = Infinity;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) min = Math.min(min, dist(pts[i]!, pts[j]!));
  return min;
};

describe('spiderOffsets', () => {
  it('gives one offset per marker', () => {
    for (const n of [0, 1, 2, 8, 9, 25, 60]) expect(spiderOffsets(n)).toHaveLength(n);
  });

  it('puts a few on a circle, clear of the centre', () => {
    const pts = spiderOffsets(5);
    const radii = pts.map((p) => dist(p, [0, 0]));
    for (const r of radii) expect(r).toBeCloseTo(radii[0]!, 0);
    expect(radii[0]).toBeGreaterThanOrEqual(18);
  });

  it('keeps markers apart so each can be clicked', () => {
    for (const n of [2, 3, 8, 9, 22, 25, 60]) expect(minGap(spiderOffsets(n))).toBeGreaterThanOrEqual(20);
  });

  it('keeps a big stack within reach on a phone', () => {
    const far = Math.max(...spiderOffsets(25).map((p) => dist(p, [0, 0])));
    expect(far).toBeLessThan(140);
  });
});

describe('shouldFanOut', () => {
  const at = (lon: number, lat: number): Feature<GeoPoint> => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lon, lat] } });

  it('fans out a group sharing one spot, at any zoom', () => {
    expect(shouldFanOut([at(-43.2, -22.9), at(-43.2, -22.9)], 9)).toBe(true);
  });

  it('zooms in on a group that will split', () => {
    expect(shouldFanOut([at(-43.2, -22.9), at(-43.1, -22.9)], 9)).toBe(false);
  });

  it('fans out when even the deepest zoom would not split it', () => {
    expect(shouldFanOut([at(-43.2, -22.9), at(-43.20001, -22.9)], 18)).toBe(true);
  });
});
