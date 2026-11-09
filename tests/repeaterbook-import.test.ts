import { describe, expect, it } from 'vitest';
import { applyCorrection } from '../scripts/repeaters/issue.ts';
import { SOURCE, importRows, readModes, readRows, siteNote, standardTone, type RbRow } from '../scripts/repeaterbook/import.ts';
import { mergeRepeaters } from '../src/lib/repeaters/merge.ts';
import { validateOverlay } from '../src/lib/repeaters/overlay.ts';
import type { AnatelRepeater } from '../src/lib/repeaters/types.ts';

const anatel = (over: Partial<AnatelRepeater>): AnatelRepeater =>
  ({ id: 'PY1ZZZ@147.150', callsign: 'PY1ZZZ', band: '2m', output: 147.15, input: 147.75, municipio: 'Petrópolis', uf: 'RJ', status: 'ativa', lat: -22.5, lon: -43.18, ...over }) as AnatelRepeater;
const row = (over: Partial<RbRow>): RbRow => ({ output: 147.15, input: 147.75, tone: '', callsign: 'PY1ZZZ', location: 'Petrópolis', modes: 'FM', ...over });
const DATE = '2026-11-09';

describe('readRows', () => {
  it('reads the export columns and unescapes HTML', () => {
    const csv =
      '﻿Output Freq,Input Freq,Offset,Uplink Tone,Downlink Tone,Call,"Location",County,State,Modes,Digital Access\n' +
      '147.15000,147.750000,,88.5,,py1zzz,"Petrópolis - Caixa D&amp;#039;água",,Brazil,FM ,\n';
    expect(readRows(csv)).toEqual([{ output: 147.15, input: 147.75, tone: '88.5', callsign: 'PY1ZZZ', location: "Petrópolis - Caixa D'água", modes: 'FM' }]);
  });
});

describe('standardTone', () => {
  it('snaps typed tones to the standard ones and drops the rest', () => {
    expect(standardTone('88.5')).toBe(88.5);
    expect(standardTone('74')).toBe(74.4);
    expect(standardTone('103')).toBe(103.5);
    expect(standardTone('1750')).toBeUndefined();
    expect(standardTone('')).toBeUndefined();
  });
});

describe('readModes', () => {
  it('maps modes and keeps links apart', () => {
    expect(readModes('FM DMR EchoLink')).toEqual({ modes: ['FM', 'DMR'], links: ['EchoLink'] });
    expect(readModes('DSTAR')).toEqual({ modes: ['D-STAR'], links: [] });
    expect(readModes('EchoLink')).toEqual({ modes: ['FM'], links: ['EchoLink'] });
  });
});

describe('siteNote', () => {
  it('keeps the site name, fixing case and English', () => {
    expect(siteNote('Petrópolis - PICO DO CUCA', 'Petrópolis')).toBe('Local: Pico do Cuca');
    expect(siteNote('Petrópolis - Top of Water Tank', 'Petrópolis')).toBe("Local: Caixa d'água");
    expect(siteNote('Petrópolis - Mountain', 'Petrópolis')).toBeUndefined();
  });

  it('ignores states in the site slot and the same town spelled differently', () => {
    expect(siteNote('Petropolis - RJ', 'Petrópolis')).toBeUndefined();
    expect(siteNote('Campinas - São Paulo', 'Campinas')).toBeUndefined();
  });

  it('names another town only when it is near', () => {
    expect(siteNote('Mariana - Morro X', 'Ouro Preto')).toBe('Local: Mariana, Morro X');
    expect(siteNote('Paraty', 'Três Rios', () => false)).toBeUndefined();
  });
});

describe('importRows', () => {
  it('imports tone, modes and site for matching repeaters, marked unverified', () => {
    const { entries, counts } = importRows([row({ tone: '88.5', location: 'Petrópolis - Pico do Cuca' })], [anatel({})], {}, DATE);
    expect(entries).toEqual({
      'PY1ZZZ@147.150': { source: SOURCE, date: DATE, unverified: true, tone: 88.5, modes: ['FM'], notes: 'Local: Pico do Cuca.' },
    });
    expect(counts).toMatchObject({ rows: 1, matched: 1, added: 1 });
  });

  it('matches within half a channel and ignores other repeaters', () => {
    const { entries } = importRows([row({ output: 147.155, tone: '100' }), row({ callsign: 'PY9XXX', tone: '100' }), row({ output: 146.61, tone: '100' })], [anatel({})], {}, DATE);
    expect(Object.keys(entries)).toEqual(['PY1ZZZ@147.150']);
  });

  it('skips rows that say nothing beyond FM', () => {
    expect(importRows([row({})], [anatel({})], {}, DATE).entries).toEqual({});
  });

  it('keeps digital modes without a tone', () => {
    expect(importRows([row({ modes: 'DMR' })], [anatel({})], {}, DATE).entries['PY1ZZZ@147.150']?.modes).toEqual(['DMR']);
  });

  it('drops a tone two rows disagree on', () => {
    const { entries, counts } = importRows([row({ tone: '88.5', modes: 'DMR' }), row({ tone: '100' })], [anatel({})], {}, DATE);
    expect(entries['PY1ZZZ@147.150']?.tone).toBeUndefined();
    expect(counts.conflictingTones).toBe(1);
  });

  it('never touches a repeater someone corrected', () => {
    const existing = { 'PY1ZZZ@147.150': { tone: 100, source: 'PU1JAZ', date: '2026-11-01' } };
    const { entries, counts } = importRows([row({ tone: '88.5' })], [anatel({})], existing, DATE);
    expect(entries).toEqual({});
    expect(counts.skippedCorrected).toBe(1);
  });
});

describe('unverified entries', () => {
  const overlay = { format: 1, entries: { 'PY1ZZZ@147.150': { tone: 88.5, source: SOURCE, date: DATE, unverified: true } } };

  it('validate and show their data without a source line', () => {
    expect(validateOverlay(overlay, new Set(['PY1ZZZ@147.150']))).toEqual([]);
    const [r] = mergeRepeaters([anatel({})], overlay);
    expect(r?.tone).toBe(88.5);
    expect(r?.correction).toBeUndefined();
  });

  it('become verified when a correction is approved', () => {
    const next = applyCorrection(overlay, 'PY1ZZZ@147.150', { onAir: true, source: 'PU1JAZ', date: DATE });
    expect(next.entries['PY1ZZZ@147.150']).toEqual({ tone: 88.5, onAir: true, source: 'PU1JAZ', date: DATE });
  });
});
