import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reduceRepeaters, updateChanges, updateRepeaters } from '../scripts/anatel/repeaters.ts';
import { EXPECTED_HEADER } from '../scripts/anatel/stations.ts';

// Synthetic rows; personal fields hold a marker so the test can check none leak.
const SECRET = 'SECRETO';
function row(callsign: string, freq: string, opts: { type?: string; city?: string; uf?: string; status?: string; valid?: string } = {}) {
  return [
    'CPF', `***${SECRET}**`, `Fulano ${SECRET}`, `${SECRET}1`, 'Radioamador', callsign, '1', 'SP', 'Classe A',
    `Estação ${SECRET}`, opts.type ?? 'Repetidora', freq, opts.city ?? 'São Paulo', opts.uf ?? 'SP',
    '01/01/2020', '01/01/2024', opts.valid ?? '01/01/2030', opts.status ?? 'Ativa',
  ].join(';');
}
const csv = (...rows: string[]) => `﻿${EXPECTED_HEADER.join(';')}\r\n${rows.join('\r\n')}\r\n`;

describe('reduceRepeaters', () => {
  const sample = csv(
    row('PY2KJP', '146,610 / 146,010 MHz', { status: 'Ativa', valid: '05/06/2031' }),
    row('PY2KJP', '146,610 / 146,010 MHz', { status: 'N/I' }), // same repeater, another license row
    row('PY2AAA', '"147,120 / 147,720 MHz ; 1.287,600 / 1.275,600 MHz ; 439,650 / 434,650 MHz"', { city: 'Campinas' }),
    row('PY3BBB', '145,370 / 14.477,000 MHz', { uf: 'RS', city: 'Porto Alegre' }),
    row('PY3CCC', '0,147 / 0,146 MHz', { uf: 'RS', city: 'Pelotas' }),
    row('PY4DDD', 'N/I', { uf: 'MG', city: 'Belo Horizonte' }),
    row('PP5EEE', '145,900 / 145,900 MHz', { uf: 'Pr', city: 'Curitiba', status: 'Vencida' }),
    row('PY1FFF', '146,700 / 146,100 MHz', { type: 'Fixa', uf: 'RJ' }), // not a repeater
    row('X', '146,700 / 146,100 MHz'),
  );
  const r = reduceRepeaters(sample);
  const ids = r.repeaters.map((x) => x.id);

  it('keeps 2 m and 70 cm pairs, one record per callsign and output', () => {
    expect(ids).toEqual(['PP5EEE@145.900', 'PY2AAA@147.120', 'PY2AAA@439.650', 'PY2KJP@146.610']);
  });

  it('computes fields and keeps the best license status', () => {
    const kjp = r.repeaters.find((x) => x.id === 'PY2KJP@146.610')!;
    expect(kjp).toEqual({
      id: 'PY2KJP@146.610', callsign: 'PY2KJP', band: '2m', output: 146.61, input: 146.01,
      municipio: 'São Paulo', uf: 'SP', status: 'ativa', validUntil: '2031-06-05',
    });
    const uhf = r.repeaters.find((x) => x.id === 'PY2AAA@439.650')!;
    expect(uhf).toMatchObject({ band: '70cm', output: 439.65, input: 434.65 });
  });

  it('normalizes the UF and keeps zero-shift pairs', () => {
    expect(r.repeaters.find((x) => x.callsign === 'PP5EEE')).toMatchObject({ uf: 'PR', input: 145.9, status: 'vencida' });
  });

  it('counts other bands and logs junk', () => {
    expect(r.counts).toEqual({ rows: 8, repeaters: 4, byBand: { '2m': 3, '70cm': 1 }, otherBands: 1, rejected: 4 });
    expect(r.rejected.join('\n')).toMatch(/PY3BBB: entrada 14477 MHz fora da faixa/);
    expect(r.rejected.join('\n')).toMatch(/PY3CCC: frequência sem sentido/);
    expect(r.rejected.join('\n')).toMatch(/PY4DDD: sem frequência/);
    expect(r.rejected.join('\n')).toMatch(/indicativo inválido: X/);
  });

  it('never outputs personal fields', () => {
    expect(JSON.stringify(r)).not.toContain(SECRET);
  });
});

describe('updateChanges', () => {
  const set = (...ids: string[]) => new Set(ids);
  const empty = { format: 1, added: {}, removed: {} };

  it('records nothing on the first run', () => {
    expect(updateChanges(undefined, set('A'), empty, '2026-11-09')).toEqual(empty);
  });

  it('records additions and removals with the date', () => {
    const c = updateChanges(set('A', 'B'), set('B', 'C'), empty, '2026-11-10');
    expect(c).toEqual({ format: 1, added: { C: '2026-11-10' }, removed: { A: '2026-11-10' } });
  });

  it('moves a repeater between lists when it comes back or goes again', () => {
    const c = updateChanges(set('B'), set('A', 'B'), { format: 1, added: {}, removed: { A: '2026-11-10' } }, '2026-11-20');
    expect(c).toEqual({ format: 1, added: { A: '2026-11-20' }, removed: {} });
  });

  it('forgets entries after a year', () => {
    const c = updateChanges(set('A'), set('A'), { format: 1, added: { A: '2025-11-09' }, removed: { Z: '2025-11-10' } }, '2026-11-09');
    expect(c).toEqual({ format: 1, added: {}, removed: { Z: '2025-11-10' } });
  });
});

describe('updateRepeaters', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'repeaters-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const many = (n: number) => Array.from({ length: n }, (_, i) => row(`PY2A${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`, '146,610 / 146,010 MHz'));

  it('writes once, then only when something changed', async () => {
    expect((await updateRepeaters(csv(...many(10)), dir, '2026-11-09')).changed).toBe(true);
    expect((await updateRepeaters(csv(...many(10)), dir, '2026-11-10')).changed).toBe(false);
    expect((await updateRepeaters(csv(...many(11)), dir, '2026-11-11')).changed).toBe(true);
    const changes = JSON.parse(await readFile(join(dir, 'changes.json'), 'utf8'));
    expect(Object.values(changes.added)).toEqual(['2026-11-11']);
  });

  it('refuses to publish when repeater rows collapse', async () => {
    await updateRepeaters(csv(...many(100)), dir, '2026-11-09');
    await expect(updateRepeaters(csv(...many(50)), dir, '2026-11-10')).rejects.toThrow(/refusing to publish/);
  });
});
