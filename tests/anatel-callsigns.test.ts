import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  EXPECTED_HEADER,
  expandTaken,
  reduce,
  updateCallsigns,
  updateReleased,
} from '../scripts/anatel/callsigns.ts';
import { parseDelimited } from '../scripts/lib/csv.ts';

// Synthetic rows: every personal field holds an obviously fake marker so the
// tests can check none of it leaks into the output.
const SECRET = 'SECRETO';
function row(callsign: string, status: string, licensed = '01/02/2024', freq = '145,000 MHz'): string {
  return [
    'CPF', `***${SECRET}**`, `Fulano ${SECRET}`, `${SECRET}1`, 'Radioamador', callsign, '1', 'SP', 'Classe A',
    `Estação ${SECRET}`, 'Fixa', freq, `Cidade ${SECRET}`, 'SP', '01/01/2020', licensed, '01/01/2030', status,
  ].join(';');
}
const csv = (...rows: string[]) => `﻿${EXPECTED_HEADER.join(';')}\r\n${rows.join('\r\n')}\r\n`;

describe('parseDelimited', () => {
  it('handles BOM, CRLF, quotes and stray quotes', () => {
    expect(parseDelimited('﻿a;b\r\n"x;y";"say ""hi"""\r\nst"ray;z\r\n')).toEqual([
      ['a', 'b'],
      ['x;y', 'say "hi"'],
      ['st"ray', 'z'],
    ]);
  });
});

describe('reduce', () => {
  const sample = csv(
    row('PY2AA', 'Ativa', '23/10/2026'),
    row('PY2AA', 'Vencida'), // another station of an active callsign
    row('py2ab', 'N/I'),
    row('PU2KAA', 'Vencida'),
    row('PU2KAA', 'Vencida'),
    row('PY2ZAB', 'Ativa'),
    row('N/I', 'Ativa'),
    row('PY-2', 'Ativa'),
    row('PY2AC', 'Ativa', '01/01/2024', '"146,610 / 146,010 MHz ; 439,000 / 434,000 MHz"'),
  );

  it('keeps one record per callsign with its best status', () => {
    const { taken, counts } = reduce(sample);
    expect(taken.active).toEqual({ PY2: 'AA AB AC ZAB' });
    expect(taken.expired).toEqual({ PU2: 'KAA' });
    expect(counts).toEqual({ rows: 9, callsigns: 5, active: 4, expired: 1, rejected: 2 });
  });

  it('reports rejects and the newest licensing date', () => {
    const r = reduce(sample);
    expect(r.rejected).toEqual(['N/I', 'PY-2']);
    expect(r.newestLicensing).toBe('2026-10-23');
  });

  it('never outputs personal fields', () => {
    expect(JSON.stringify(reduce(sample))).not.toContain(SECRET);
  });

  it('fails on a changed header', () => {
    const bad = csv(row('PY2AA', 'Ativa')).replace('Indicativo', 'Indicativo de Chamada');
    expect(() => reduce(bad)).toThrow(/unexpected header/);
  });

  it('is deterministic regardless of row order', () => {
    const a = reduce(csv(row('PY2AB', 'Ativa'), row('PY2AA', 'Ativa'), row('PP1AA', 'Ativa')));
    const b = reduce(csv(row('PP1AA', 'Ativa'), row('PY2AA', 'Ativa'), row('PY2AB', 'Ativa')));
    expect(JSON.stringify(a.taken)).toBe(JSON.stringify(b.taken));
  });
});

describe('released history', () => {
  const set = (...cs: string[]) => new Set(cs);

  it('expands the taken file into callsigns', () => {
    expect(expandTaken({ format: 1, active: { PY2: 'AA AB' }, expired: { PU2: 'KAA' } })).toEqual(
      set('PY2AA', 'PY2AB', 'PU2KAA'),
    );
  });

  it('adds callsigns that disappeared, keeping the first date seen', () => {
    const r = updateReleased(set('PY2AA', 'PY2AB'), set('PY2AA'), { PP1AA: '2026-05-01' }, '2026-11-09');
    expect(r).toEqual({ PP1AA: '2026-05-01', PY2AB: '2026-11-09' });
    expect(updateReleased(set('PY2AB'), set(), r, '2026-11-10').PY2AB).toBe('2026-11-09');
  });

  it('drops callsigns that come back', () => {
    expect(updateReleased(set(), set('PY2AB'), { PY2AB: '2026-11-09' }, '2026-11-20')).toEqual({});
  });

  it('drops callsigns after one year', () => {
    const released = { PY2AB: '2025-11-09', PY2AC: '2025-11-10' };
    expect(updateReleased(set(), set(), released, '2026-11-09')).toEqual({ PY2AC: '2025-11-10' });
  });

  it('starts empty without a previous snapshot', () => {
    expect(updateReleased(undefined, set('PY2AA'), {}, '2026-11-09')).toEqual({});
  });
});

describe('updateCallsigns', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'callsigns-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const many = (n: number) => Array.from({ length: n }, (_, i) => row(`PY2${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`, 'Ativa'));

  it('writes on first run and leaves files alone when nothing changed', async () => {
    const text = csv(...many(10));
    expect((await updateCallsigns(text, dir, '2026-11-09')).changed).toBe(true);
    const meta = JSON.parse(await readFile(join(dir, 'meta.json'), 'utf8'));
    expect(meta.updatedAt).toBe('2026-11-09');

    expect((await updateCallsigns(text, dir, '2026-11-10')).changed).toBe(false);
    const after = JSON.parse(await readFile(join(dir, 'meta.json'), 'utf8'));
    expect(after.updatedAt).toBe('2026-11-09');
    expect((await readdir(dir)).sort()).toEqual(['meta.json', 'released.json', 'taken.json']);
    expect(JSON.parse(await readFile(join(dir, 'released.json'), 'utf8')).released).toEqual({});
  });

  it('records callsigns that disappear between runs', async () => {
    await updateCallsigns(csv(row('PY2AA', 'Ativa'), row('PY2AB', 'Vencida'), ...many(10)), dir, '2026-11-09');
    await updateCallsigns(csv(row('PY2AA', 'Ativa'), ...many(10)), dir, '2026-11-10');
    const released = JSON.parse(await readFile(join(dir, 'released.json'), 'utf8')).released;
    expect(released).toEqual({ PY2AB: '2026-11-10' });
  });

  it('refuses to publish when the row count collapses', async () => {
    await updateCallsigns(csv(...many(100)), dir, '2026-11-09');
    await expect(updateCallsigns(csv(...many(50)), dir, '2026-11-10')).rejects.toThrow(/refusing to publish/);
    const meta = JSON.parse(await readFile(join(dir, 'meta.json'), 'utf8'));
    expect(meta.counts.rows).toBe(100);
  });
});
