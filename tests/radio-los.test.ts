import { describe, expect, it } from 'vitest';
import { terrariumElevation, tilePixel } from '../src/lib/dem/terrarium.ts';
import { distanceKm } from '../src/lib/repeaters/geo.ts';
import { bulgeM, fresnelM, lineOfSight, samplePath, type ProfilePoint } from '../src/lib/radio/los.ts';

/** A profile of `lengthKm` with flat ground at `ground` m and a hill of `hill` m at `atKm`. */
const profile = (lengthKm: number, ground: number, hill = 0, atKm = lengthKm / 2): ProfilePoint[] =>
  Array.from({ length: 101 }, (_, i) => {
    const km = (lengthKm * i) / 100;
    return { km, elevM: ground + (Math.abs(km - atKm) < lengthKm / 200 ? hill : 0) };
  });

describe('radio geometry', () => {
  it('bulges about 13 m halfway along 30 km (4/3 Earth)', () => {
    expect(bulgeM(15, 30)).toBeCloseTo(13.2, 0);
    expect(bulgeM(0, 30)).toBe(0);
  });

  it('gives the textbook Fresnel radius', () => {
    // 2 m band, 30 km path, halfway: sqrt(2.07 × 15000 × 15000 / 30000) ≈ 124 m.
    expect(fresnelM(15, 30, 145)).toBeCloseTo(124.5, 0);
    // 70 cm is narrower.
    expect(fresnelM(15, 30, 439)).toBeLessThan(75);
  });
});

describe('lineOfSight', () => {
  it('is clear between two hilltops over a valley', () => {
    const p = profile(20, 0).map((x, i, all) => (i === 0 || i === all.length - 1 ? { ...x, elevM: 900 } : x));
    expect(lineOfSight(p, 1.5, 15, 145).verdict).toBe('livre');
  });

  it('is blocked by a ridge higher than the line, and says where', () => {
    const r = lineOfSight(profile(20, 100, 400, 8), 1.5, 15, 145);
    expect(r.verdict).toBe('bloqueada');
    expect(r.worst.km).toBeCloseTo(8, 0);
    expect(r.worst.elevM).toBe(500);
  });

  it('is at the limit when terrain enters the Fresnel zone but not the line', () => {
    // Antennas on 300 m hills, 20 km apart: the line passes about 308 m up halfway. A 250 m hump
    // (plus 6 m of Earth bulge) leaves about 52 m, less than 60% of the 101 m Fresnel radius.
    const hills = profile(20, 0, 250, 10).map((x, i, all) => (i === 0 || i === all.length - 1 ? { ...x, elevM: 300 } : x));
    const r = lineOfSight(hills, 1.5, 15, 145);
    expect(r.verdict).toBe('limite');
    expect(r.worst.clearanceM).toBeGreaterThan(0);
  });

  it('counts the Earth bulge: flat ground blocks a long, low path', () => {
    expect(lineOfSight(profile(60, 0), 1.5, 15, 145).verdict).toBe('bloqueada');
  });
});

describe('paths and tiles', () => {
  it('samples a path at least every step, ends included', () => {
    const a = { lat: -22.9, lon: -43.2 };
    const b = { lat: -22.9, lon: -43.0 };
    const pts = samplePath(a, b, 0.03);
    expect(pts[0]).toEqual(a);
    expect(pts[pts.length - 1]).toEqual(b);
    expect(distanceKm(pts[0]!, pts[1]!)).toBeLessThanOrEqual(0.03);
  });

  it('finds the tile and pixel of a point', () => {
    // Zoom 1, 512 px: the origin sits on the corner of four tiles.
    expect(tilePixel({ lat: 0, lon: 0 }, 1, 512)).toEqual({ x: 1, y: 1, px: 0, py: 0 });
    const rio = tilePixel({ lat: -22.9, lon: -43.2 }, 12, 512);
    expect(rio.x).toBe(1556);
    expect(rio.y).toBe(2315);
  });

  it('decodes Terrarium colours', () => {
    expect(terrariumElevation(128, 0, 0)).toBe(0);
    expect(terrariumElevation(130, 70, 128)).toBeCloseTo(582.5, 1);
  });
});

describe('lineOfSight edge cases', () => {
  it('is clear when you stand at the antenna', () => {
    expect(lineOfSight([{ km: 0, elevM: 500 }, { km: 0, elevM: 500 }], 1.5, 15, 145).verdict).toBe('livre');
  });
});

describe('obstacles next to either end', () => {
  it('are ignored: you can step past the building next to you', () => {
    const p = Array.from({ length: 101 }, (_, i) => ({ km: i * 0.2, elevM: i === 0 || i === 100 ? 900 : i === 1 ? 960 : 100 }));
    expect(lineOfSight(p, 1.5, 15, 145).verdict).toBe('livre');
  });
});
