import { describe, expect, it } from 'vitest';
import { buildIndex, nearMisses, parseQuery, search } from '../src/lib/callsigns';

const index = buildIndex(
  { format: 1, active: { PY2: 'RB RBA RBR ABC', PQ2: 'RB', PU2: 'KRB' }, expired: {} },
  { format: 1, released: { PY2BRA: '2026-11-01' } },
);

const calls = (q: string, scope: Parameters<typeof search>[1]) => search(q, scope, index)?.cells.map((c) => c.callsign) ?? null;

describe('parseQuery', () => {
  it('rejects junk', () => {
    expect(parseQuery('')).toBeNull();
    expect(parseQuery('PY2!')).toBeNull();
    expect(parseQuery('PY2A1')).toBeNull();
  });

  it('flags complete callsigns as exact', () => {
    expect(parseQuery('py2 rb')?.exact).toBe('PY2RB');
    expect(parseQuery('PY2R?')?.exact).toBeUndefined();
    expect(parseQuery('RBR')?.exact).toBeUndefined();
  });
});

describe('search', () => {
  it('finds a callsign and everything that starts with it', () => {
    const r = calls('PY2RB', { licenseClass: 'AB', uf: 'SP' })!;
    expect(r).toContain('PY2RB');
    expect(r).toContain('PY2RBZ');
    expect(r).not.toContain('PY2RC');
    expect(r).toHaveLength(1 + 26);
  });

  it('lists requestable callsigns first', () => {
    const r = search('PY2RB', { licenseClass: 'AB', uf: 'SP' }, index)!;
    const statuses = r.cells.map((c) => c.status);
    expect(statuses.slice(0, 24).every((s) => s === 'livre')).toBe(true);
    expect(statuses.slice(-3)).toEqual(['em-uso', 'em-uso', 'em-uso']);
  });

  it('matches a bare suffix across all states', () => {
    const r = calls('RBR', { licenseClass: 'AB' })!;
    expect(r).toContain('PY2RBR');
    expect(r).toContain('PR2RBR');
    expect(r).toContain('PT8RBR');
    expect(r.every((c) => c.endsWith('RBR'))).toBe(true);
    expect(r).toHaveLength(28);
  });

  it('supports ? and *', () => {
    expect(calls('PY2?BC', { licenseClass: 'AB', uf: 'SP' })).toHaveLength(25); // no Z: foreigners
    const ends = calls('*RB', { licenseClass: 'AB', uf: 'TO' })!;
    expect(ends).toContain('PQ2RB');
    expect(ends).toContain('PQ2ARB');
    expect(ends.every((c) => c.endsWith('RB'))).toBe(true);
  });

  it('respects the class C letter ranges', () => {
    const r = calls('PU2?RB', { licenseClass: 'C', uf: 'TO' })!;
    expect(r).toEqual(['PU2IRB', 'PU2JRB']);
  });

  it('matches a partial prefix', () => {
    const r = calls('Y2RBR', { licenseClass: 'AB' })!;
    expect(r).toEqual(['PY2RBR']);
  });

  it('returns the exact callsign even outside the scope', () => {
    const r = search('PU2KRB', { licenseClass: 'AB', uf: 'SP' }, index)!;
    expect(r.cells).toHaveLength(0);
    expect(r.exact).toMatchObject({ callsign: 'PU2KRB', status: 'em-uso' });
  });

  it('is fast across every state', () => {
    const t0 = performance.now();
    for (const q of ['A', 'RB', '*A', 'P?2??A']) search(q, { licenseClass: 'AB' }, index);
    expect((performance.now() - t0) / 4).toBeLessThan(100);
  });
});

describe('nearMisses', () => {
  it('suggests free callsigns one step away', () => {
    const r = nearMisses('PY2RBR', index).map((c) => c.callsign);
    expect(r).toContain('PY2RRB'); // swap
    expect(r).toContain('PY2RBB'); // one letter changed, last letter first
    expect(r).not.toContain('PY2RBA'); // taken
    expect(r).not.toContain('PY2BRA'); // in quarantine
    expect(r).not.toContain('PY2RBR');
    expect(r).toHaveLength(24);
  });

  it('keeps class C suggestions inside the state', () => {
    expect(nearMisses('PU2JRB', index).every((c) => /^PU2[IJ]/.test(c.callsign))).toBe(true);
  });

  it('looks beyond a full block: longer callsigns and the other prefix', () => {
    // Every 2-letter PY2 callsign is taken.
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const full = [...letters].flatMap((a) => [...letters].map((b) => a + b)).join(' ');
    const crowded = buildIndex({ format: 1, active: { PY2: full }, expired: {} }, { format: 1, released: {} });
    const r = nearMisses('PY2RB', crowded).map((c) => c.callsign);
    expect(r).toHaveLength(24);
    expect(r.slice(0, 3)).toEqual(['PY2RBA', 'PY2RBB', 'PY2RBC']);
    expect(r).toContain('PR2RB');
    expect(r).toContain('PR2BR');
    expect(r.every((c) => c.startsWith('PY2RB') || c.startsWith('PR2'))).toBe(true);
  });

  it('mixes the groups when every group has room', () => {
    const r = nearMisses('PY2RB', index).map((c) => c.callsign);
    expect(r.filter((c) => /^PY2..$/.test(c))).toHaveLength(12);
    expect(r.filter((c) => /^PY2RB.$/.test(c))).toHaveLength(6);
    expect(r.filter((c) => c.startsWith('PR2'))).toHaveLength(6);
  });

  it('returns nothing for callsigns outside the rules', () => {
    expect(nearMisses('PX2AB', index)).toEqual([]);
  });
});

describe('nearMisses ordering', () => {
  it('puts clearly free callsigns before possibly quarantined ones', () => {
    const idx = buildIndex(
      { format: 1, active: { PY2: 'RB' }, expired: {} },
      { format: 1, released: {}, seeded: { source: 's', snapshotDate: '2025-04-09', until: '2027-10-23', callsigns: 'PY2BR' } },
    );
    const sameBlock = nearMisses('PY2RB', idx).filter((c) => /^PY2..$/.test(c.callsign));
    expect(sameBlock[0]!.status).toBe('livre');
    // With enough clearly free variants, the uncertain one is left out.
    expect(sameBlock.map((c) => c.callsign)).not.toContain('PY2BR');
  });
});
