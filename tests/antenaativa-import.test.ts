import { describe, expect, it } from 'vitest';
import { expandTown, findAnatel, importTones, parseList } from '../scripts/antenaativa/import.ts';
import { municipioLookup } from '../scripts/anatel/municipios.ts';
import { SOURCE } from '../scripts/repeaterbook/import.ts';
import type { AnatelRepeater } from '../src/lib/repeaters/types.ts';

const find = municipioLookup([
  { ibge: 1, nome: 'Feira de Santana', uf: 'BA', lat: -12.2, lon: -38.9 },
  { ibge: 2, nome: 'Coração de Maria', uf: 'BA', lat: -12.2, lon: -38.7 },
  { ibge: 3, nome: 'Entre Rios', uf: 'BA', lat: -11.9, lon: -38.0 },
  { ibge: 4, nome: 'Macapá', uf: 'AP', lat: 0.03, lon: -51.0 },
  { ibge: 5, nome: 'Santa Rita do Passa Quatro', uf: 'SP', lat: -21.7, lon: -47.4 },
]);

// The layout pdftotext prints, with a wrapped town touching two rows.
const TEXT = `
Amapá                                                2 REPETIDORAS · 1 CIDADE
 CIDADE         FREQUÊNCIA (MHZ)            DUPLEX     OFFSET          MODO    SUBTOM
 Macapá       VHF    146.210           DUP+        600 kHz      FM          88.5Hz


 Macapá       VHF    146.620           DUP-        600 kHz      FM          82,5 Hz

Bahia                                         3 REPETIDORAS · 3 CIDADES
 CIDADE             FREQUÊNCIA (MHZ)      DUPLEX      OFFSET         MODO        SUBTOM
 Feira de
                    VHF   146.970         DUP+        600 kHz        FM          88.5Hz
 Santana


 Coração de         UHF   439.500         DUP-        5 MHz          FM          —
 Maria
 Entre Rios         VHF   145.270         DUP-        600 kHz        FM          123.0Hz
`;

const rep = (id: string, municipio: string, uf: string): AnatelRepeater =>
  ({ id, callsign: id.split('@')[0], output: Number(id.split('@')[1]), input: 0, municipio, uf }) as AnatelRepeater;

describe('parseList', () => {
  it('reads rows by state and joins wrapped town names', () => {
    expect(parseList(TEXT, find)).toEqual([
      { uf: 'AP', city: 'Macapá', output: 146.21, tone: '88.5Hz' },
      { uf: 'AP', city: 'Macapá', output: 146.62, tone: '82,5 Hz' },
      { uf: 'BA', city: 'Feira de Santana', output: 146.97, tone: '88.5Hz' },
      { uf: 'BA', city: 'Coração de Maria', output: 439.5, tone: '—' },
      { uf: 'BA', city: 'Entre Rios', output: 145.27, tone: '123.0Hz' },
    ]);
  });
});

describe('expandTown', () => {
  it('spells out abbreviations', () => {
    expect(expandTown('Sta. Rita do Passa Quatro')).toBe('Santa Rita do Passa Quatro');
    expect(expandTown('N. Sra. do Socorro')).toBe('Nossa Senhora do Socorro');
  });
});

describe('findAnatel', () => {
  const anatel = [rep('PY6AA@146.970', 'Feira de Santana', 'BA'), rep('PY6BB@146.970', 'Entre Rios', 'BA')];
  it('needs the same town and frequency', () => {
    expect(findAnatel({ uf: 'BA', city: 'Feira de Santana', output: 146.97, tone: '' }, anatel, find)?.id).toBe('PY6AA@146.970');
    expect(findAnatel({ uf: 'BA', city: 'Coração de Maria', output: 146.97, tone: '' }, anatel, find)).toBeUndefined();
  });
  it('gives up when two repeaters share town and frequency', () => {
    const two = [...anatel, rep('PY6CC@146.970', 'Feira de Santana', 'BA')];
    expect(findAnatel({ uf: 'BA', city: 'Feira de Santana', output: 146.97, tone: '' }, two, find)).toBeUndefined();
  });
});

describe('importTones', () => {
  const rows = parseList(TEXT, find);
  const anatel = [rep('PQ8AA@146.210', 'Macapá', 'AP'), rep('PQ8BB@146.620', 'Macapá', 'AP'), rep('PY6AA@146.970', 'Feira de Santana', 'BA'), rep('PY6ER@145.270', 'Entre Rios', 'BA')];

  it('adds unverified tones and never changes one already there', () => {
    const existing = {
      'PY6AA@146.970': { tone: 100, source: SOURCE, date: '2026-11-09', unverified: true as const },
      'PY6ER@145.270': { notes: 'Local: Serra.', source: SOURCE, date: '2026-11-09', unverified: true as const },
    };
    const { entries, counts } = importTones(rows, anatel, existing, '2026-11-10', find);
    expect(entries).toEqual({
      'PQ8AA@146.210': { source: SOURCE, date: '2026-11-10', unverified: true, tone: 88.5 },
      'PQ8BB@146.620': { source: SOURCE, date: '2026-11-10', unverified: true, tone: 82.5 },
      'PY6ER@145.270': { notes: 'Local: Serra.', source: SOURCE, date: '2026-11-09', unverified: true, tone: 123 },
    });
    expect(counts.keptExisting).toBe(1);
  });

  it('leaves checked entries alone', () => {
    const existing = { 'PQ8AA@146.210': { notes: 'Conferida.', source: 'PY8XX', date: '2026-11-01' } };
    expect(importTones(rows, anatel, existing, '2026-11-10', find).entries['PQ8AA@146.210']).toBeUndefined();
  });
});
