import { describe, expect, it } from 'vitest';
import { mergeRepeaters } from '../src/lib/repeaters/merge.ts';
import { validateOverlay, type OverlayFile } from '../src/lib/repeaters/overlay.ts';
import type { AnatelRepeater } from '../src/lib/repeaters/types.ts';
import { applyChecks, howText, validateChecks, vettingStatus, type ChecksFile } from '../src/lib/repeaters/vetting.ts';

const anatel: AnatelRepeater[] = [
  { id: 'PY1AA@146.610', callsign: 'PY1AA', band: '2m', output: 146.61, input: 146.01, municipio: 'Rio de Janeiro', uf: 'RJ', lat: -22.9, lon: -43.2, status: 'ativa' },
  { id: 'PY1BB@439.650', callsign: 'PY1BB', band: '70cm', output: 439.65, input: 434.65, municipio: 'Niterói', uf: 'RJ', status: 'ativa' },
];
const ids = new Set(anatel.map((a) => a.id));
const overlay = (entries: OverlayFile['entries']): OverlayFile => ({ format: 1, entries });
const imported = { source: 'Importação inicial de 2026-11-09 (a conferir)', date: '2026-11-09', unverified: true as const, tone: 88.5 };
const today = new Date('2026-11-11T12:00:00Z');

describe('vettingStatus', () => {
  it('ages a check: recent up to 90 days, then old', () => {
    expect(vettingStatus({}, today)).toBe('nunca');
    expect(vettingStatus({ checked: '2026-11-11' }, today)).toBe('recente');
    expect(vettingStatus({ checked: '2026-08-13' }, today)).toBe('recente'); // 90 days
    expect(vettingStatus({ checked: '2026-08-12' }, today)).toBe('antiga'); // 91 days
  });

  it('lets off the air win over any check, and never go stale', () => {
    expect(vettingStatus({ onAir: false, checked: '2026-11-11' }, today)).toBe('fora-do-ar');
    expect(vettingStatus({ onAir: false }, today)).toBe('fora-do-ar');
    expect(vettingStatus({ onAir: false, checked: '2020-01-01' }, today)).toBe('fora-do-ar');
  });
});

describe('overlay check fields', () => {
  it('are validated and reach the merged repeater', () => {
    const good = overlay({ 'PY1AA@146.610': { source: 'Conferência (teste no ar)', date: '2026-11-11', checked: '2026-11-11', checkedHow: 'teste no ar' } });
    expect(validateOverlay(good, ids)).toEqual([]);
    expect(mergeRepeaters(anatel, good)[0]).toMatchObject({ checked: '2026-11-11', checkedHow: 'teste no ar' });
    const bad = overlay({ 'PY1AA@146.610': { source: 'x', date: '2026-11-11', checked: '11/11/2026', checkedHow: ' ' } });
    expect(validateOverlay(bad, ids).join('\n')).toMatch(/checked deve ser AAAA-MM-DD[\s\S]*checkedHow/);
  });
});

describe('validateChecks', () => {
  const file = (checks: ChecksFile['checks']): ChecksFile => ({ format: 1, kind: 'conferencias', exportedAt: '2026-11-11T20:00:00Z', checks });

  it('accepts a good export', () => {
    expect(validateChecks(file({ 'PY1AA@146.610': { date: '2026-11-11', result: 'abriu', how: 'teste', tone: 88.5, modes: ['FM'] } }))).toEqual([]);
  });

  it('rejects other files and bad rows', () => {
    expect(validateChecks({ format: 1, entries: {} })).toEqual(['não é um arquivo de conferências (formato 1)']);
    const errors = validateChecks(file({ 'PY1AA@146.61': { date: 'ontem', result: 'talvez' as never, tone: 88, dcs: '089', lat: -22 } })).join('\n');
    expect(errors).toMatch(/id deve ser/);
    expect(errors).toMatch(/data deve ser/);
    expect(errors).toMatch(/resultado talvez/);
    expect(errors).toMatch(/tom 88/);
    expect(errors).toMatch(/DCS 089/);
    expect(errors).toMatch(/latitude e longitude vão juntas/);
  });
});

describe('applyChecks', () => {
  it('records an on-air test on a repeater with no overlay entry', () => {
    const { file, outcomes } = applyChecks(overlay({}), { 'PY1BB@439.650': { date: '2026-11-11', result: 'abriu', tone: 'none' } });
    expect(file.entries['PY1BB@439.650']).toEqual({
      source: 'Conferência (teste no ar)',
      date: '2026-11-11',
      onAir: true,
      onAirDate: '2026-11-11',
      checked: '2026-11-11',
      checkedHow: 'teste no ar',
      tone: 'none',
    });
    expect(outcomes[0]!.applied).toEqual(['no ar (teste no ar)', 'subtom nenhum']);
    expect(validateOverlay(file, ids)).toEqual([]);
  });

  it('confirms an import without a position, clearing unverified', () => {
    const { file } = applyChecks(overlay({ 'PY1AA@146.610': imported }), { 'PY1AA@146.610': { date: '2026-11-11', result: 'abriu', how: 'escuta' } });
    const e = file.entries['PY1AA@146.610']!;
    expect(e.unverified).toBeUndefined();
    expect(e).toMatchObject({ tone: 88.5, checked: '2026-11-11', checkedHow: 'escuta', source: 'Conferência (escuta)' });
  });

  it('keeps an import unverified while its position is unconfirmed', () => {
    const before = overlay({ 'PY1AA@146.610': { ...imported, lat: -22.95, lon: -43.21 } });
    const kept = applyChecks(before, { 'PY1AA@146.610': { date: '2026-11-11', result: 'abriu' } }).file.entries['PY1AA@146.610']!;
    expect(kept).toMatchObject({ unverified: true, source: imported.source, date: '2026-11-09', checked: '2026-11-11' });
    expect(mergeRepeaters(anatel, { format: 1, entries: { 'PY1AA@146.610': kept } })[0]!.position?.probable).toBe(true);
    const placed = applyChecks(before, { 'PY1AA@146.610': { date: '2026-11-11', result: 'abriu', lat: -22.96, lon: -43.22 } }).file.entries['PY1AA@146.610']!;
    expect(placed.unverified).toBeUndefined();
    expect(placed).toMatchObject({ lat: -22.96, lon: -43.22 });
  });

  it('marks off the air on a report, and swaps tone and DCS', () => {
    const before = overlay({ 'PY1AA@146.610': { source: 'x', date: '2026-01-01', dcs: '023', checked: '2026-10-01', checkedHow: 'teste no ar' } });
    const { file, outcomes } = applyChecks(before, {
      'PY1AA@146.610': { date: '2026-11-11', result: 'fora-do-ar', how: 'relato', reporter: 'PY1ZZ', tone: 88.5, comment: ' desligada para manutenção ' },
    });
    expect(file.entries['PY1AA@146.610']).toMatchObject({ onAir: false, onAirDate: '2026-11-11', tone: 88.5, checkedHow: 'relato de PY1ZZ' });
    expect(file.entries['PY1AA@146.610']!.dcs).toBeUndefined();
    expect(outcomes).toEqual([
      { id: 'PY1AA@146.610', applied: ['fora do ar (relato de PY1ZZ)', 'subtom 88.5'], comment: 'desligada para manutenção' },
    ]);
  });

  it('describes how a check was made', () => {
    expect(howText({})).toBe('teste no ar');
    expect(howText({ how: 'relato', reporter: '  ' })).toBe('relato de terceiro');
  });
});
