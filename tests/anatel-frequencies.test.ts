import { describe, expect, it } from 'vitest';
import { parseBrazilianNumber, parseFrequencyField } from '../scripts/anatel/frequencies.ts';
import { bandOf, repeaterId } from '../src/lib/repeaters/types.ts';

describe('parseBrazilianNumber', () => {
  it.each([
    ['146,610', 146.61],
    ['1.287,800', 1287.8],
    ['29,690', 29.69],
    ['0,147', 0.147],
    ['14.477,000', 14477],
    ['439', 439],
  ])('%s → %d', (text, n) => expect(parseBrazilianNumber(text)).toBe(n));

  it.each(['', 'abc', '1,2,3', '12.34,5'])('rejects %j', (t) => expect(parseBrazilianNumber(t)).toBeUndefined());
});

describe('parseFrequencyField', () => {
  it('reads a single pair', () => {
    expect(parseFrequencyField('146,610 / 146,010 MHz')).toEqual({ pairs: [{ output: 146.61, input: 146.01 }], rejected: [] });
  });

  it('reads several pairs, quotes and thousands separators', () => {
    const r = parseFrequencyField('147,120 / 147,720 MHz ; 1.287,600 / 1.275,600 MHz ; "439,650 / 434,650 MHz"');
    expect(r.pairs).toEqual([
      { output: 147.12, input: 147.72 },
      { output: 1287.6, input: 1275.6 },
      { output: 439.65, input: 434.65 },
    ]);
  });

  it('handles a trailing stray quote', () => {
    expect(parseFrequencyField('146,970 / 146,370 MHz ; 439,525 / 434,525 MHz"').pairs).toHaveLength(2);
  });

  it('returns nothing for N/I and empty values', () => {
    expect(parseFrequencyField('N/I')).toEqual({ pairs: [], rejected: [] });
    expect(parseFrequencyField('')).toEqual({ pairs: [], rejected: [] });
  });

  it('reports pieces it cannot read', () => {
    expect(parseFrequencyField('145,370 / ? MHz').rejected).toEqual(['145,370 / ? MHz']);
  });

  it('keeps junk numbers for the caller to filter by band', () => {
    expect(parseFrequencyField('145,370 / 14.477,000 MHz').pairs).toEqual([{ output: 145.37, input: 14477 }]);
    expect(parseFrequencyField('0,147 / 0,146 MHz').pairs).toEqual([{ output: 0.147, input: 0.146 }]);
  });
});

describe('bands and ids', () => {
  it('classifies 2 m and 70 cm only', () => {
    expect(bandOf(146.61)).toBe('2m');
    expect(bandOf(439.65)).toBe('70cm');
    expect(bandOf(224.22)).toBeUndefined();
    expect(bandOf(0.147)).toBeUndefined();
  });

  it('builds stable ids', () => {
    expect(repeaterId('PY2KJP', 146.61)).toBe('PY2KJP@146.610');
  });
});
