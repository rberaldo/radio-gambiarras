import { describe, expect, it } from 'vitest';
import { applyChecks, validateChecks } from '../src/lib/repeaters/vetting.ts';
import { buildExport, checkToDraft, draftToCheck, isEdited, parsePosition } from '../src/lib/repeaters/vettingDraft.ts';

describe('parsePosition', () => {
  it('reads the usual ways a position is written', () => {
    expect(parsePosition('-22.95, -43.21')).toEqual({ lat: -22.95, lon: -43.21 });
    expect(parsePosition('-22.951234567,-43.2')).toEqual({ lat: -22.95123, lon: -43.2 });
    expect(parsePosition('-22,95 -43,21')).toEqual({ lat: -22.95, lon: -43.21 });
    expect(parsePosition('-22,95; -43,21')).toEqual({ lat: -22.95, lon: -43.21 });
    expect(parsePosition('  ')).toBeUndefined();
    expect(parsePosition('Pico da Tijuca')).toBe('invalid');
  });
});

describe('draft rows', () => {
  it('count as edited only when they say something', () => {
    expect(isEdited({ date: '2026-11-11', how: 'escuta' })).toBe(false);
    expect(isEdited({ date: '2026-11-11', comment: ' ' })).toBe(false);
    expect(isEdited({ date: '2026-11-11', result: 'abriu' })).toBe(true);
  });

  it('turn into checks, and back', () => {
    const { check, problems } = draftToCheck({
      date: '2026-11-11',
      result: 'abriu',
      how: 'relato',
      reporter: ' PY1ZZ ',
      tone: '88.5',
      position: '-22.95, -43.21',
      modes: ['FM'],
      comment: 'sinal forte',
    });
    expect(problems).toEqual([]);
    expect(check).toEqual({ date: '2026-11-11', result: 'abriu', how: 'relato', reporter: 'PY1ZZ', tone: 88.5, lat: -22.95, lon: -43.21, modes: ['FM'], comment: 'sinal forte' });
    expect(draftToCheck(checkToDraft(check)).check).toEqual(check);
    expect(draftToCheck(checkToDraft({ date: '2026-11-11', dcs: '023' })).check).toEqual({ date: '2026-11-11', dcs: '023' });
  });

  it('report bad cells', () => {
    expect(draftToCheck({ date: '2026-11-11', tone: 'dcs', dcs: '089', position: 'ali' }).problems).toEqual([
      'código DCS deve ter três dígitos de 0 a 7',
      'posição deve ser "latitude, longitude", como -22.95, -43.21',
    ]);
  });
});

describe('buildExport', () => {
  it('exports edited rows only, in a file the apply script accepts', () => {
    const { file, problems } = buildExport(
      {
        'PY1BB@439.650': { date: '2026-11-11', result: 'fora-do-ar' },
        'PY1AA@146.610': { date: '2026-11-11', result: 'abriu', tone: 'none' },
        'PY1CC@145.230': { date: '2026-11-11' },
        'PY1DD@145.290': { date: '2026-11-11', position: 'aqui' },
      },
      new Date('2026-11-11T20:00:00Z'),
    );
    expect(Object.keys(file.checks)).toEqual(['PY1AA@146.610', 'PY1BB@439.650']);
    expect(Object.keys(problems)).toEqual(['PY1DD@145.290']);
    expect(validateChecks(JSON.parse(JSON.stringify(file)))).toEqual([]);
    expect(applyChecks({ format: 1, entries: {} }, file.checks).file.entries['PY1BB@439.650']).toMatchObject({ onAir: false, checked: '2026-11-11' });
  });
});
