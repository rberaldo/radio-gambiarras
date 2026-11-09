import { describe, expect, it } from 'vitest';
import { blockCells, blockChoices, buildIndex, countStatuses } from '../src/lib/callsigns';

const index = buildIndex(
  { format: 1, active: { PQ2: 'AA AB IAA' }, expired: { PQ2: 'AC' } },
  { format: 1, released: { PQ2AD: '2026-11-01' } },
);

describe('blockChoices', () => {
  it('filters by suffix length', () => {
    expect(blockChoices('SP', 'AB').map((b) => b.id)).toEqual(['PY2-2', 'PY2-3', 'PR2-2', 'PR2-3']);
    expect(blockChoices('SP', 'AB', 3).map((b) => b.id)).toEqual(['PY2-3', 'PR2-3']);
    expect(blockChoices('SP', 'C').map((b) => b.prefix)).toEqual(['PU2', 'PV2']);
  });
});

describe('blockCells', () => {
  const [two] = blockChoices('TO', 'AB', 2);
  const cells = blockCells(two!, index);

  it('lists every callsign in order with its status', () => {
    expect(cells).toHaveLength(676);
    expect(cells.slice(0, 5).map((c) => [c.callsign, c.status])).toEqual([
      ['PQ2AA', 'em-uso'],
      ['PQ2AB', 'em-uso'],
      ['PQ2AC', 'vencida'],
      ['PQ2AD', 'quarentena'],
      ['PQ2AE', 'livre'],
    ]);
  });

  it('marks forbidden suffixes in 3-letter blocks', () => {
    const [three] = blockChoices('TO', 'AB', 3);
    const q = blockCells(three!, index).filter((c) => c.suffix.startsWith('Q'));
    expect(q).toHaveLength(676);
    expect(q.every((c) => c.status === 'reservado')).toBe(true);
  });

  it('counts statuses', () => {
    const counts = countStatuses(cells);
    expect(counts['em-uso']).toBe(2);
    expect(counts.vencida).toBe(1);
    expect(counts.quarentena).toBe(1);
    expect(counts.livre).toBe(672);
  });
});
