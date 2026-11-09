import { describe, expect, it } from 'vitest';
import { parseCoordinates } from '../src/lib/repeaters/coordinates.ts';
import { DEFAULT_STATE, readState, writeState } from '../src/tools/repetidoras/urlState.ts';

describe('map URL state', () => {
  it('leaves defaults out', () => {
    expect(writeState(DEFAULT_STATE)).toBe('');
    expect(readState('')).toEqual(DEFAULT_STATE);
  });

  it('round-trips a point, radius, band and selection', () => {
    const state = { lat: -22.9497, lon: -43.2851, radiusKm: 80, band: '2m' as const, selected: 'PY1BAB@147.030' };
    const qs = writeState(state);
    expect(qs).toBe('?lat=-22.9497&lon=-43.2851&raio=80&banda=2m&rep=PY1BAB%40147.030');
    expect(readState(qs)).toEqual(state);
  });

  it('ignores junk and points outside Brazil', () => {
    expect(readState('?lat=48.85&lon=2.35&raio=999&banda=6m&rep=x')).toEqual(DEFAULT_STATE);
    expect(readState('?lat=-22.9')).toEqual(DEFAULT_STATE);
  });
});

describe('parseCoordinates', () => {
  it.each([
    ['-22.9497, -43.2851', -22.9497, -43.2851],
    ['-22,9497 -43,2851', -22.9497, -43.2851],
    ['-22,9497; -43,2851', -22.9497, -43.2851],
    ['22.9497 S 43.2851 W', -22.9497, -43.2851],
    ['22.9497S 43.2851O', -22.9497, -43.2851],
  ])('reads %j', (text, lat, lon) => {
    expect(parseCoordinates(text)).toEqual({ lat, lon });
  });

  it('reads degrees, minutes and seconds', () => {
    const c = parseCoordinates(`22°56'59"S 43°17'06"W`)!;
    expect(c.lat).toBeCloseTo(-22.9497, 3);
    expect(c.lon).toBeCloseTo(-43.285, 3);
  });

  it.each(['', 'Rio de Janeiro', '-22.9', '200, 10', '1 2 3'])('rejects %j', (t) => expect(parseCoordinates(t)).toBeUndefined());
});

import { circlePolygon, repeaterPoints } from '../src/tools/repetidoras/mapData.ts';
import { distanceKm } from '../src/lib/repeaters/geo.ts';
import type { Repeater } from '../src/lib/repeaters/merge.ts';

describe('map data', () => {
  const r = (id: string, position?: Repeater['position']): Repeater => ({
    id, callsign: id.split('@')[0]!, band: '2m', output: 146.61, input: 146.01, shift: -0.6, municipio: 'X', uf: 'RJ', position, modes: [], license: 'ativa',
  });

  it('turns positioned repeaters into points flagged when selected', () => {
    const fc = repeaterPoints([r('A@146.610', { lat: -22, lon: -43, exact: true }), r('B@146.610')], new Set(['A@146.610']));
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]!.properties).toEqual({ id: 'A@146.610', callsign: 'A', band: '2m', exact: true, sel: 1 });
    expect(fc.features[0]!.geometry.coordinates).toEqual([-43, -22]);
  });

  it('draws a circle at the right distance', () => {
    const center = { lat: -22.95, lon: -43.28 };
    const ring = circlePolygon(center, 50).geometry.coordinates[0]!;
    for (const [lon, lat] of ring.filter((_, i) => i % 12 === 0)) {
      expect(distanceKm(center, { lat: lat!, lon: lon! })).toBeGreaterThan(49);
      expect(distanceKm(center, { lat: lat!, lon: lon! })).toBeLessThan(51);
    }
  });
});
