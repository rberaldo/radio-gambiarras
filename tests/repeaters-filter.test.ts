import { describe, expect, it } from 'vitest';
import { filterRepeaters, offAirLast, placesOf } from '../src/lib/repeaters/filter.ts';
import type { Repeater } from '../src/lib/repeaters/merge.ts';

const r = (id: string, over: Partial<Repeater> = {}): Repeater =>
  ({ id, callsign: id, band: '2m', output: 146.61, input: 146.01, shift: -0.6, municipio: 'Rio de Janeiro', uf: 'RJ', modes: [], license: 'ativa', ...over }) as Repeater;

describe('filterRepeaters', () => {
  const all = [r('fm'), r('dmr', { modes: ['DMR'] }), r('mixed', { modes: ['FM', 'DMR'], band: '70cm' })];
  it('filters by band and mode; mixed ones count as both', () => {
    expect(filterRepeaters(all, 'todas', 'fm').map((x) => x.id)).toEqual(['fm', 'mixed']);
    expect(filterRepeaters(all, 'todas', 'digital').map((x) => x.id)).toEqual(['dmr', 'mixed']);
    expect(filterRepeaters(all, '70cm', 'todos').map((x) => x.id)).toEqual(['mixed']);
  });
});

describe('offAirLast', () => {
  it('moves repeaters reported off the air to the end, keeping order', () => {
    const near = ['a', 'b', 'c', 'd'].map((id, i) => ({ repeater: r(id, i % 2 ? { onAir: false } : {}), distanceKm: i }));
    expect(offAirLast(near).map((n) => n.repeater.id)).toEqual(['a', 'c', 'b', 'd']);
  });
});

describe('placesOf', () => {
  it('lists towns by their seat, sorted', () => {
    const seat = { lat: -22.9, lon: -43.2, exact: false };
    const places = placesOf([r('x', { municipio: 'Niterói', position: seat }), r('y', { position: seat }), r('z', { municipio: 'Angra', position: { ...seat, exact: true } })]);
    expect([...places.keys()]).toEqual(['Niterói/RJ', 'Rio de Janeiro/RJ']);
  });
});
