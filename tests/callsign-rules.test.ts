import { describe, expect, it } from 'vitest';
import {
  ALL_BLOCKS,
  UFS,
  blockById,
  blockSize,
  blocksFor,
  classify,
  indexInBlock,
  isForbiddenSuffix,
  normalize,
  parse,
  suffixAt,
  suffixes,
  ufOf,
  type Uf,
} from '../src/lib/callsigns';

// Tabela II of Ato 3448, copied independently of rules-data.ts so the data is
// checked against the source rather than against itself.
const TABLE: Record<Uf, { ab: string[]; c: [string, string, string][] }> = {
  AC: { ab: ['PT8'], c: [['PU8', 'J', 'L']] },
  AL: { ab: ['PP7'], c: [['PU7', 'A', 'D']] },
  AP: { ab: ['PQ8'], c: [['PU8', 'G', 'I']] },
  AM: { ab: ['PP8'], c: [['PU8', 'A', 'C']] },
  BA: { ab: ['PY6'], c: [['PU6', 'J', 'Y']] },
  CE: { ab: ['PT7'], c: [['PU7', 'M', 'P']] },
  DF: { ab: ['PT2'], c: [['PU2', 'A', 'E']] },
  ES: { ab: ['PP1'], c: [['PU1', 'A', 'I']] },
  GO: { ab: ['PP2'], c: [['PU2', 'F', 'H']] },
  MA: { ab: ['PR8'], c: [['PU8', 'M', 'O']] },
  MT: { ab: ['PY9'], c: [['PU9', 'O', 'Y']] },
  MS: { ab: ['PT9'], c: [['PU9', 'A', 'N']] },
  MG: { ab: ['PY4'], c: [['PU4', 'A', 'Y']] },
  PB: { ab: ['PR7'], c: [['PU7', 'E', 'H']] },
  PR: { ab: ['PY5'], c: [['PU5', 'M', 'Y']] },
  PA: { ab: ['PY8'], c: [['PU8', 'W', 'Y']] },
  PE: { ab: ['PY7'], c: [['PU7', 'R', 'Y']] },
  PI: { ab: ['PS8'], c: [['PU8', 'P', 'S']] },
  RJ: { ab: ['PY1'], c: [['PU1', 'J', 'Y']] },
  RN: { ab: ['PS7'], c: [['PU7', 'I', 'L']] },
  RS: { ab: ['PY3'], c: [['PU3', 'A', 'Y']] },
  RO: { ab: ['PW8'], c: [['PU8', 'D', 'F']] },
  RR: { ab: ['PV8'], c: [['PU8', 'T', 'V']] },
  SC: { ab: ['PP5'], c: [['PU5', 'A', 'L']] },
  SP: { ab: ['PY2', 'PR2'], c: [['PU2', 'K', 'Y'], ['PV2', 'K', 'Y']] },
  SE: { ab: ['PP6'], c: [['PU6', 'A', 'I']] },
  TO: { ab: ['PQ2'], c: [['PU2', 'I', 'J']] },
};

const prev = (ch: string) => String.fromCharCode(ch.charCodeAt(0) - 1);
const next = (ch: string) => String.fromCharCode(ch.charCodeAt(0) + 1);

describe('normalize and parse', () => {
  it('normalizes case, spaces and separators', () => {
    expect(normalize('  py2-ab c ')).toBe('PY2ABC');
  });

  it('parses well-formed callsigns', () => {
    expect(parse('py2abc')).toEqual({ callsign: 'PY2ABC', prefix: 'PY2', digit: 2, suffix: 'ABC' });
    expect(parse('PT2AA')).toMatchObject({ prefix: 'PT2', suffix: 'AA' });
  });

  it.each(['', 'N/I', 'PY2A', 'PY2ABCD', 'P2ABC', 'PYXABC', 'PY2AÇA', '1Y2ABC'])('rejects %j', (raw) => {
    expect(parse(raw)).toBeNull();
  });
});

describe('prefix table', () => {
  it('covers all 27 federative units', () => {
    expect(UFS).toHaveLength(27);
    expect(new Set(UFS)).toEqual(new Set(Object.keys(TABLE)));
  });

  describe.each(Object.entries(TABLE) as [Uf, (typeof TABLE)[Uf]][])('%s', (uf, row) => {
    it.each(row.ab)('maps A/B prefix %s, 2 and 3 letters', (prefix) => {
      expect(ufOf(`${prefix}AA`)).toBe(uf);
      expect(ufOf(`${prefix}ZZ`)).toBe(uf);
      expect(ufOf(`${prefix}AAA`)).toBe(uf);
      expect(ufOf(`${prefix}YZZ`)).toBe(uf);
      expect(classify(`${prefix}AB`)?.licenseClass).toBe('AB');
    });

    it.each(row.c)('maps class C block %s %s–%s at its boundaries', (prefix, from, to) => {
      expect(classify(`${prefix}${from}AA`)).toMatchObject({ uf, licenseClass: 'C', kind: 'regular' });
      expect(classify(`${prefix}${to}ZZ`)).toMatchObject({ uf, licenseClass: 'C', kind: 'regular' });
      if (from > 'A') expect(ufOf(`${prefix}${prev(from)}ZZ`)).not.toBe(uf);
      if (to < 'Y') expect(ufOf(`${prefix}${next(to)}AA`)).not.toBe(uf);
    });

    it('has the expected blocks', () => {
      expect(blocksFor(uf, 'AB')).toHaveLength(row.ab.length * 2);
      expect(blocksFor(uf, 'C').map((b) => [b.prefix, ...b.first])).toEqual(row.c);
    });
  });

  it('gives São Paulo two prefixes for every class', () => {
    expect(ufOf('PY2AA')).toBe('SP');
    expect(ufOf('PR2AA')).toBe('SP');
    expect(ufOf('PU2KAA')).toBe('SP');
    expect(ufOf('PV2KAA')).toBe('SP');
    expect(ufOf('PV2JAA')).toBeNull();
  });

  it('assigns every class C letter of a region to at most one state', () => {
    const seen = new Map<string, Uf>();
    for (const b of ALL_BLOCKS.filter((b) => b.licenseClass === 'C' && b.uf)) {
      for (let i = 0; i < 26; i++) {
        const letter = String.fromCharCode(65 + i);
        if (letter < b.first[0] || letter > b.first[1]) continue;
        const key = b.prefix + letter;
        expect(seen.get(key), key).toBeUndefined();
        seen.set(key, b.uf!);
      }
    }
  });

  it('does not map 2-letter class C suffixes', () => {
    expect(classify('PU2KA')).toBeNull();
  });
});

describe('blocks', () => {
  it('has 676 two-letter and 16,900 three-letter suffixes per A/B prefix', () => {
    const [two, three] = blocksFor('RJ', 'AB');
    expect(blockSize(two!)).toBe(676);
    expect(blockSize(three!)).toBe(16_900);
  });

  it('sizes class C blocks by their letter range', () => {
    expect(blockSize(blocksFor('TO', 'C')[0]!)).toBe(2 * 676);
    expect(blockSize(blocksFor('MG', 'C')[0]!)).toBe(25 * 676);
  });

  it('enumerates suffixes in alphabetical order', () => {
    const block = blocksFor('TO', 'C')[0]!;
    const all = [...suffixes(block)];
    expect(all).toHaveLength(blockSize(block));
    expect(all[0]).toBe('IAA');
    expect(all[1]).toBe('IAB');
    expect(all[26]).toBe('IBA');
    expect(all.at(-1)).toBe('JZZ');
    expect([...all].sort()).toEqual(all);
  });

  it('round-trips suffixAt and indexInBlock', () => {
    for (const block of ALL_BLOCKS) {
      const size = blockSize(block);
      for (const i of [0, 1, 25, 26, size - 1].filter((i) => i < size)) {
        expect(indexInBlock(block, suffixAt(block, i))).toBe(i);
      }
    }
  });

  it('rejects suffixes outside the block', () => {
    const block = blocksFor('TO', 'C')[0]!;
    expect(indexInBlock(block, 'HZZ')).toBe(-1);
    expect(indexInBlock(block, 'KAA')).toBe(-1);
    expect(indexInBlock(block, 'IA')).toBe(-1);
    expect(() => suffixAt(block, blockSize(block))).toThrow(RangeError);
  });

  it('has unique ids', () => {
    expect(new Set(ALL_BLOCKS.map((b) => b.id)).size).toBe(ALL_BLOCKS.length);
    expect(blockById('PY2-2')?.uf).toBe('SP');
  });
});

describe('forbidden suffixes', () => {
  it.each(['DDD', 'SNM', 'SOS', 'SVH', 'TTT', 'XXX', 'PAN', 'RRR', 'QAA', 'QRZ', 'QZZ'])('forbids %s', (s) => {
    expect(isForbiddenSuffix(s)).toBe(true);
  });

  it.each(['QA', 'QZ', 'SO', 'ABC', 'PAM', 'RAA'])('allows %s', (s) => {
    expect(isForbiddenSuffix(s)).toBe(false);
  });

  it('classifies forbidden callsigns in their block', () => {
    expect(classify('PY2SOS')).toMatchObject({ kind: 'forbidden', uf: 'SP' });
    expect(classify('PU2QRZ')).toMatchObject({ kind: 'forbidden', uf: 'SP' });
    expect(classify('PY2QA')).toMatchObject({ kind: 'regular', uf: 'SP' });
  });
});

describe('foreigners', () => {
  it('reserves the Z series of A/B prefixes', () => {
    expect(classify('PY2ZAB')).toMatchObject({ kind: 'foreigner', licenseClass: 'AB', uf: 'SP' });
    expect(classify('PY2ZAB')?.block).toBeUndefined();
  });

  it('recognizes class C foreigners without a single state', () => {
    const c = classify('PU2ZAB');
    expect(c).toMatchObject({ kind: 'foreigner', licenseClass: 'C' });
    expect(c?.uf).toBeUndefined();
  });

  it('keeps 2-letter Z suffixes as regular', () => {
    expect(classify('PY2ZZ')).toMatchObject({ kind: 'regular', uf: 'SP' });
  });
});

describe('islands', () => {
  it('maps island blocks by their place letter', () => {
    expect(classify('PY0FA')).toMatchObject({ island: 'F', licenseClass: 'AB', kind: 'regular' });
    expect(classify('PY0FAA')).toMatchObject({ island: 'F', licenseClass: 'AB' });
    expect(classify('PU0AAB')).toMatchObject({ island: 'A', licenseClass: 'C' });
    expect(ufOf('PY0FA')).toBeNull();
  });

  it('rejects unknown place letters', () => {
    expect(classify('PY0BA')).toBeNull();
  });

  it('recognizes island foreigners', () => {
    expect(classify('PY0ZFA')).toMatchObject({ kind: 'foreigner', island: 'F' });
  });
});

describe('outside the rules', () => {
  it.each(['ZV2ABC', 'PX2AB', 'PU2A', 'PP0AB'])('returns null for %s', (cs) => {
    expect(classify(cs)).toBeNull();
  });
});
