import { describe, expect, it } from 'vitest';
import data from '../data/aprs/symbols.json';
import { SHEET_COLUMNS, SHEET_ROWS, cellOf, fold, searchSymbols, symbolsFrom, type AprsSymbolsFile } from '../src/lib/aprs/symbols.ts';

const symbols = symbolsFrom(data as AprsSymbolsFile);
const codes = (q: string, table?: '/' | '\\') => searchSymbols(symbols, q, table).map((s) => s.code);

describe('symbol data', () => {
  it('has the imported symbols', () => {
    expect(symbols).toHaveLength(159);
    expect(symbols.filter((s) => s.table === '/')).toHaveLength(86);
  });

  it('has unique codes, real characters and a description for each', () => {
    expect(new Set(symbols.map((s) => s.code)).size).toBe(symbols.length);
    for (const s of symbols) {
      expect(s.char).toMatch(/^[!-~]$/);
      expect(s.description.trim()).not.toBe('');
      expect(() => cellOf(s.char)).not.toThrow();
    }
  });

  it('keeps the six alternate codes the old Portuguese file broke', () => {
    for (const ch of 'bfnrtv') expect(symbols.some((s) => s.code === `\\${ch}`)).toBe(true);
  });
});

describe('cellOf', () => {
  it('maps characters to sheet cells', () => {
    expect(cellOf('!')).toEqual({ column: 0, row: 0 });
    expect(cellOf('>')).toEqual({ column: 13, row: 1 }); // index 29
    expect(cellOf('0')).toEqual({ column: 15, row: 0 }); // index 15
    expect(cellOf('1')).toEqual({ column: 0, row: 1 });
    expect(cellOf('~')).toEqual({ column: 13, row: 5 }); // index 93
  });

  it('rejects characters outside the sheet', () => {
    expect(() => cellOf(' ')).toThrow(RangeError);
    expect(() => cellOf('ab')).toThrow(RangeError);
    expect(SHEET_COLUMNS * SHEET_ROWS).toBe(96);
  });
});

describe('searchSymbols', () => {
  it('returns everything for an empty query, optionally one table', () => {
    expect(codes('')).toHaveLength(159);
    expect(codes('', '\\').every((c) => c.startsWith('\\'))).toBe(true);
  });

  it('finds a symbol by its full code', () => {
    expect(codes('/>')).toEqual(['/>']);
    expect(codes('\\v')).toEqual(['\\v']);
  });

  it('finds both tables by the character alone, before description matches', () => {
    const r = codes('>');
    expect(r.slice(0, 2).sort()).toEqual(['/>', '\\>']);
  });

  it('matches description words ignoring case and accents, in any order', () => {
    expect(codes('carro')).toContain('/>');
    expect(codes('CARRO')).toEqual(codes('carro'));
    expect(codes('estacao').length).toBeGreaterThan(0);
    expect(codes('estacao')).toEqual(codes('estação'));
    expect(codes('banheiros')).toContain('\\r');
  });

  it('requires every word to start a description word', () => {
    const r = searchSymbols(symbols, 'nuvem funil');
    expect(r.map((s) => s.code)).toEqual(['\\f']);
    expect(codes('funil nuvem')).toEqual(['\\f']);
    expect(codes('arro')).not.toContain('/>');
  });

  it('respects the table filter', () => {
    expect(codes('carro', '\\')).not.toContain('/>');
  });

  it('returns nothing for unknown words', () => {
    expect(codes('xyzzy')).toEqual([]);
  });
});

describe('fold', () => {
  it('drops accents and case', () => {
    expect(fold('Estação Névoa')).toBe('estacao nevoa');
  });
});
