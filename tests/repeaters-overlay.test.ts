import { describe, expect, it } from 'vitest';
import anatelFile from '../data/repeaters/anatel.json';
import overlayFile from '../data/repeaters/overlay.json';
import { mergeRepeaters } from '../src/lib/repeaters/merge.ts';
import { orphanedEntries, validateOverlay, type OverlayFile } from '../src/lib/repeaters/overlay.ts';
import type { AnatelRepeater, AnatelRepeatersFile } from '../src/lib/repeaters/types.ts';

const anatel: AnatelRepeater[] = [
  { id: 'PY2KJP@146.610', callsign: 'PY2KJP', band: '2m', output: 146.61, input: 146.01, municipio: 'São Paulo', uf: 'SP', ibge: 3550308, lat: -23.53, lon: -46.64, status: 'ativa', validUntil: '2031-06-05' },
  { id: 'PY2AAA@439.650', callsign: 'PY2AAA', band: '70cm', output: 439.65, input: 434.65, municipio: 'Campinas', uf: 'SP', status: 'sem-data' },
];
const ids = new Set(anatel.map((a) => a.id));
const overlay = (entries: OverlayFile['entries']): OverlayFile => ({ format: 1, entries });

describe('validateOverlay', () => {
  it('accepts a good entry', () => {
    expect(validateOverlay(overlay({ 'PY2KJP@146.610': { tone: 88.5, lat: -23.6, lon: -46.8, modes: ['FM'], source: 'PU1JAZ, teste no ar', date: '2026-11-09' } }), ids)).toEqual([]);
  });

  it('catches the usual mistakes', () => {
    const errors = validateOverlay(
      overlay({
        'PY2KJP@146.61': { source: 'x', date: '2026-11-09' },
        'PY2AAA@439.650': { tone: 88, dcs: '089', lat: -46.8, lon: -23.6, source: '', date: '09/11/2026' },
      }),
      ids,
    ).join('\n');
    expect(errors).toMatch(/PY2KJP@146.61: id deve ser/);
    expect(errors).toMatch(/tom 88 não é um tom CTCSS padrão/);
    expect(errors).toMatch(/DCS 089/);
    expect(errors).toMatch(/use tom ou DCS/);
    expect(errors).toMatch(/fora do Brasil \(latitude e longitude trocadas\?\)/);
    expect(errors).toMatch(/falta a fonte/);
    expect(errors).toMatch(/data deve ser AAAA-MM-DD/);
  });

  it('requires full details for repeaters Anatel does not list', () => {
    const errors = validateOverlay(overlay({ 'PY9NEW@145.330': { tone: 'none', municipio: 'Itu', source: 'clube', date: '2026-11-09' } }), ids).join('\n');
    expect(errors).toMatch(/informe a entrada/);
    expect(errors).toMatch(/informe município e UF/);
    expect(errors).toMatch(/informe a posição/);
  });

  it('wants a valid date with an on-air report', () => {
    expect(validateOverlay(overlay({ 'PY2KJP@146.610': { onAir: false, onAirDate: '2026-10-05', source: 'x', date: '2026-11-09' } }), ids)).toEqual([]);
    expect(validateOverlay(overlay({ 'PY2KJP@146.610': { onAirDate: '05/10/2026', source: 'x', date: '2026-11-09' } }), ids).join()).toMatch(/onAirDate/);
  });

  it('only warns about corrections for repeaters Anatel dropped, and the map skips them', () => {
    // A tone confirmed for PY2OLD, whose licence then disappeared from Anatel's file.
    const file = overlay({ 'PY2OLD@145.330': { tone: 88.5, source: 'clube', date: '2026-11-09' } });
    expect(validateOverlay(file, ids)).toEqual([]);
    expect(orphanedEntries(file, ids)).toEqual(['PY2OLD@145.330']);
    expect(mergeRepeaters(anatel, file).map((r) => r.id)).not.toContain('PY2OLD@145.330');
  });

  it('keeps the committed overlay valid if Anatel drops any one repeater', () => {
    const real = (anatelFile as AnatelRepeatersFile).repeaters.map((r) => r.id);
    const corrected = Object.keys((overlayFile as OverlayFile).entries).filter((id) => real.includes(id));
    const without = new Set(real.filter((id) => id !== corrected[0]));
    expect(validateOverlay(overlayFile as OverlayFile, without)).toEqual([]);
  });

  it('passes for the committed overlay file', () => {
    const real = new Set((anatelFile as AnatelRepeatersFile).repeaters.map((r) => r.id));
    expect(validateOverlay(overlayFile as OverlayFile, real)).toEqual([]);
  });
});

describe('mergeRepeaters', () => {
  it('uses the município seat as an approximate position and computes the shift', () => {
    const [kjp, aaa] = mergeRepeaters(anatel, overlay({}));
    expect(kjp).toEqual({
      id: 'PY2KJP@146.610', callsign: 'PY2KJP', band: '2m', output: 146.61, input: 146.01, shift: -0.6,
      municipio: 'São Paulo', uf: 'SP', position: { lat: -23.53, lon: -46.64, exact: false }, modes: [],
      license: 'ativa', validUntil: '2031-06-05',
    });
    expect(aaa!.position).toBeUndefined();
    expect(aaa!.shift).toBe(-5);
  });

  it('applies corrections and keeps their source', () => {
    const [kjp] = mergeRepeaters(anatel, overlay({ 'PY2KJP@146.610': { tone: 88.5, lat: -23.6, lon: -46.8, onAir: true, source: 'PU1JAZ', date: '2026-11-09' } }));
    expect(kjp).toMatchObject({ tone: 88.5, onAir: true, position: { lat: -23.6, lon: -46.8, exact: true }, correction: { source: 'PU1JAZ', date: '2026-11-09' } });
  });

  it('adds repeaters only the overlay knows', () => {
    const merged = mergeRepeaters(anatel, overlay({ 'PY9NEW@145.330': { input: 144.73, municipio: 'Cuiabá', uf: 'MT', lat: -15.6, lon: -56.1, tone: 'none', source: 'clube', date: '2026-11-09' } }));
    expect(merged).toHaveLength(3);
    expect(merged[2]).toMatchObject({ id: 'PY9NEW@145.330', band: '2m', shift: -0.6, license: 'nao-listada', tone: 'none', position: { exact: true } });
  });
});
