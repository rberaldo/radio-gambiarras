import { describe, expect, it } from 'vitest';
import { HORIZON_STEPS, bearingDeg, destination, horizonAngles, horizonPoints, isOpen, openShare, rayDistances } from '../src/lib/radio/horizon.ts';
import { distanceKm } from '../src/lib/repeaters/geo.ts';
import type { Repeater } from '../src/lib/repeaters/merge.ts';
import { BLOCKED_WEIGHT, FAR_WEIGHT, compass, coverage, needsCheck, outingRepeaters, rankStops, validateStops, type Stop, type StopsFile } from '../src/lib/repeaters/stops.ts';
import { quickResult } from '../src/lib/repeaters/vettingDraft.ts';
import stopsFile from '../data/repeaters/stops.json';

const tijuca = { lat: -22.9437, lon: -43.2866 };
const today = new Date('2026-11-15T12:00:00Z');

const repeater = (id: string, at: { lat: number; lon: number } | undefined, extra: Partial<Repeater> = {}): Repeater => ({
  id,
  callsign: id.split('@')[0]!,
  band: '2m',
  output: 146.61,
  input: 146.01,
  shift: -0.6,
  municipio: 'Rio de Janeiro',
  uf: 'RJ',
  position: at && { ...at, exact: false },
  modes: [],
  license: 'ativa',
  ...extra,
});

describe('directions', () => {
  it('goes the right way and the right distance', () => {
    for (const bearing of [0, 45, 90, 180, 270]) {
      const p = destination(tijuca, bearing, 10);
      expect(distanceKm(tijuca, p)).toBeCloseTo(10, 1);
      expect(bearingDeg(tijuca, p)).toBeCloseTo(bearing, 0);
    }
  });

  it('names the eight winds in Portuguese', () => {
    expect([0, 44, 90, 135, 180, 225, 270, 315, 359].map(compass)).toEqual(['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO', 'N']);
  });
});

describe('horizon', () => {
  const perRay = rayDistances().length;

  it('samples every direction, nearest first', () => {
    const points = horizonPoints(tijuca);
    expect(points).toHaveLength(HORIZON_STEPS * perRay);
    expect(distanceKm(tijuca, points[0]!)).toBeCloseTo(rayDistances()[0]!, 2);
  });

  it('dips below level on a summit above flat ground', () => {
    const horizon = horizonAngles(1000, new Array(HORIZON_STEPS * perRay).fill(0));
    expect(horizon.every((a) => a < -5)).toBe(true);
    expect(openShare(horizon)).toBe(1);
  });

  it('sees a taller neighbour in its direction only', () => {
    const elev = new Array(HORIZON_STEPS * perRay).fill(0);
    // A 600 m ridge 2 km east (direction 18 of 72 is 90°).
    const at = rayDistances().findIndex((km) => km >= 2);
    elev[18 * perRay + at] = 600;
    const horizon = horizonAngles(100, elev);
    expect(horizon[18]).toBeCloseTo(14, 0);
    expect(isOpen(horizon, 90)).toBe(false);
    expect(isOpen(horizon, 92)).toBe(false); // rounds to the same direction
    expect(isOpen(horizon, 270)).toBe(true);
    expect(openShare(horizon)).toBeCloseTo(71 / 72);
  });

  it('counts everything as open without a horizon', () => {
    expect(isOpen(undefined, 123)).toBe(true);
  });
});

describe('stops', () => {
  const blockedEast = Array.from({ length: HORIZON_STEPS }, (_, i) => (i >= 12 && i <= 24 ? 10 : -3));
  const stop = { lat: tijuca.lat, lon: tijuca.lon, horizon: blockedEast };

  it('weighs repeaters by distance and by what stands in the way', () => {
    const near = repeater('PY1A@146.610', destination(tijuca, 0, 4));
    const far = repeater('PY1B@146.670', destination(tijuca, 0, 49.9));
    const behind = repeater('PY1C@146.730', destination(tijuca, 90, 6));
    const out = repeater('PY1D@146.790', destination(tijuca, 0, 52));
    const nowhere = repeater('PY1E@146.850', undefined);
    const covered = coverage(stop, [far, behind, near, out, nowhere], 50);
    expect(covered.map((c) => c.repeater.id)).toEqual(['PY1A@146.610', 'PY1C@146.730', 'PY1B@146.670']);
    expect(covered[0]!.weight).toBe(1);
    expect(covered[1]!.open).toBe(false);
    expect(covered[1]!.weight).toBe(BLOCKED_WEIGHT);
    expect(covered[2]!.weight).toBeCloseTo(FAR_WEIGHT, 2);
  });

  it('ranks by what a stop adds to those already chosen', () => {
    const north = [1, 2, 3].map((i) => repeater(`PY1N${i}@146.610`, destination(tijuca, 0, 3 + i)));
    const farSouth = destination(tijuca, 180, 120);
    const south = [repeater('PY1S1@146.610', destination(farSouth, 0, 2)), repeater('PY1S2@146.610', destination(farSouth, 90, 2))];
    const stops = [
      { id: 'a', ...tijuca },
      { id: 'b', lat: tijuca.lat + 0.01, lon: tijuca.lon },
      { id: 'c', ...farSouth },
    ];
    const all = [...north, ...south];
    const alone = rankStops(stops, [], all, 50);
    expect(alone.map((r) => r.stop.id)).toEqual(['a', 'b', 'c']);
    expect(alone[0]!.score).toBe(3);
    expect(alone[1]!.score).toBe(3);
    // With "a" chosen, "b" adds almost nothing and "c" comes first.
    const ranked = rankStops(stops, [stops[0]!], all, 50);
    expect(ranked[0]!.stop.id).toBe('c');
    expect(ranked[0]!.gain).toBe(2);
    expect(ranked.find((r) => r.stop.id === 'b')!.gain).toBeLessThan(0.1);
  });

  it('lists an outing stop by stop, each repeater once, under the stop that hears it best', () => {
    const second = destination(tijuca, 90, 40);
    const a = repeater('PY1A@146.610', destination(tijuca, 0, 2));
    const shared = repeater('PY1B@146.670', destination(tijuca, 90, 35)); // 35 km from the first, 5 from the second
    const c = repeater('PY1C@146.730', destination(second, 90, 3));
    const ids = outingRepeaters([{ ...tijuca }, second], [c, shared, a], 50).map((n) => n.repeater.id);
    // The shared one goes with the second stop, after the nearer PY1C.
    expect(ids).toEqual(['PY1A@146.610', 'PY1C@146.730', 'PY1B@146.670']);
    expect(outingRepeaters([{ ...tijuca }, second], [c, shared, a], 50)[2]!.distanceKm).toBeCloseTo(5, 0);
  });

  it('leaves out repeaters checked lately or known to be off the air', () => {
    const r = (extra: Partial<Repeater>) => repeater('PY1A@146.610', tijuca, extra);
    expect(needsCheck(r({}), today)).toBe(true);
    expect(needsCheck(r({ checked: '2026-11-01' }), today)).toBe(false);
    expect(needsCheck(r({ checked: '2026-01-01' }), today)).toBe(true);
    expect(needsCheck(r({ checked: '2026-11-01', failed: '2026-11-10' }), today)).toBe(true);
    expect(needsCheck(r({ onAir: false }), today)).toBe(false);
  });

  it('accepts the committed stops and rejects broken ones', () => {
    expect(validateStops(stopsFile as StopsFile)).toEqual([]);
    const bad: Stop = { id: 'Pico!', name: '', lat: 10, lon: -43, elevM: Number.NaN, horizon: [1] };
    const problems = validateStops({ format: 1, source: '', updatedAt: '', stops: [bad, bad] });
    expect(problems.join('\n')).toMatch(/id inválido[\s\S]*sem nome[\s\S]*fora do Brasil[\s\S]*sem altitude[\s\S]*horizonte inválido[\s\S]*id repetido/);
  });
});

describe('quickResult', () => {
  it('records the result today, from here, and takes it back on a second tap', () => {
    expect(quickResult(undefined, 'abriu', '2026-11-15', '-22.944, -43.287')).toEqual({ result: 'abriu', date: '2026-11-15', from: '-22.944, -43.287' });
    expect(quickResult({ date: '2026-11-15', from: 'Pico da Tijuca' }, 'nao-abriu', '2026-11-15', '-22.944, -43.287')).toEqual({ result: 'nao-abriu', date: '2026-11-15' });
    expect(quickResult({ date: '2026-11-15', result: 'abriu' }, 'abriu', '2026-11-15')).toEqual({ result: undefined });
  });
});
