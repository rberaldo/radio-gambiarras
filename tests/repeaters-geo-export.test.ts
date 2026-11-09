import { describe, expect, it } from 'vitest';
import { CHIRP_HEADER, chirpCsv, isFm, spreadsheetCsv } from '../src/lib/repeaters/export.ts';
import { distanceKm, withinRadius } from '../src/lib/repeaters/geo.ts';
import type { Repeater } from '../src/lib/repeaters/merge.ts';

const base = (over: Partial<Repeater>): Repeater => ({
  id: 'PY2KJP@146.610', callsign: 'PY2KJP', band: '2m', output: 146.61, input: 146.01, shift: -0.6,
  municipio: 'São Paulo', uf: 'SP', position: { lat: -23.55, lon: -46.63, exact: false }, modes: [], license: 'ativa', ...over,
});

describe('distanceKm', () => {
  it('measures great-circle distances', () => {
    const rio = { lat: -22.9068, lon: -43.1729 };
    const sp = { lat: -23.5505, lon: -46.6333 };
    expect(distanceKm(rio, sp)).toBeGreaterThan(355);
    expect(distanceKm(rio, sp)).toBeLessThan(362);
    expect(distanceKm(rio, rio)).toBe(0);
  });
});

describe('withinRadius', () => {
  const center = { lat: -22.9068, lon: -43.1729 }; // Rio
  const repeaters = [
    base({ id: 'FAR', position: { lat: -23.55, lon: -46.63, exact: false } }), // São Paulo, ~360 km
    base({ id: 'NEAR', position: { lat: -22.95, lon: -43.21, exact: true } }), // a few km
    base({ id: 'MID', position: { lat: -22.52, lon: -43.18, exact: false } }), // Petrópolis-ish, ~43 km
    base({ id: 'NOPOS', position: undefined }),
  ];

  it('keeps repeaters inside the radius, nearest first', () => {
    expect(withinRadius(repeaters, center, 50).map((n) => n.repeater.id)).toEqual(['NEAR', 'MID']);
    expect(withinRadius(repeaters, center, 10).map((n) => n.repeater.id)).toEqual(['NEAR']);
    expect(withinRadius(repeaters, center, 400)).toHaveLength(3);
  });
});

describe('spreadsheetCsv', () => {
  it('writes a Brazilian-Excel-friendly table', () => {
    const csv = spreadsheetCsv([{ repeater: base({ tone: 88.5, notes: 'Pico; alto', correction: { source: 'PU1JAZ', date: '2026-11-09' } }), distanceKm: 12.345 }]);
    expect(csv.startsWith('﻿Sigla;Indicativo;Saída (MHz);')).toBe(true);
    const row = csv.split('\r\n')[1]!;
    expect(row).toContain('SP;PY2KJP;146,610;146,010;-0,600;88,5;;;São Paulo;SP;-23,55000;-46,63000;aproximada (sede do município);12,3;ativa');
    expect(row).toContain('"Pico; alto"');
    expect(row).toContain('PU1JAZ (2026-11-09)');
  });

  it('says when the tone is unknown or not needed', () => {
    const row = (r: Repeater) => spreadsheetCsv([{ repeater: r, distanceKm: 1 }]).split('\r\n')[1]!.split(';')[5];
    expect(row(base({}))).toBe('desconhecido');
    expect(row(base({ tone: 'none' }))).toBe('nenhum');
  });
});

describe('chirpCsv', () => {
  const lines = (rs: Repeater[]) => chirpCsv(rs.map((repeater) => ({ repeater, distanceKm: 1 }))).trimEnd().split('\r\n');

  it('starts with the 21-column header and keeps every row at 21 cells', () => {
    const out = lines([base({ tone: 88.5 }), base({ id: 'B', callsign: 'PY2B', notes: 'x' })]);
    expect(out[0]).toBe(CHIRP_HEADER);
    for (const l of out.slice(1)) expect(l.replace(/"[^"]*"/g, '').split(',')).toHaveLength(21);
  });

  it('writes minus shift with a tone', () => {
    expect(lines([base({ tone: 88.5 })])[1]).toBe('1,SP 2KJP,146.610000,-,0.600000,Tone,88.5,88.5,023,NN,023,Tone->Tone,FM,5.00,,50W,São Paulo/SP; posição aproximada,,,,');
  });

  it('writes plus shift, simplex and DCS', () => {
    expect(lines([base({ output: 147.18, input: 147.78, shift: 0.6 })])[1]).toMatch(/^1,SP 2KJP,147\.180000,\+,0\.600000,,/);
    expect(lines([base({ output: 145.9, input: 145.9, shift: 0 })])[1]).toMatch(/^1,SP 2KJP,145\.900000,,0\.000000,,/);
    expect(lines([base({ dcs: '754' })])[1]).toMatch(/,DTCS,88\.5,88\.5,754,NN,754,/);
  });

  it('fills unknown tones with CHIRP defaults and says so in the comment', () => {
    const row = lines([base({ position: { lat: 1, lon: 1, exact: true } })])[1]!;
    expect(row).toContain(',,88.5,88.5,023,NN,023,Tone->Tone,FM,');
    expect(row).toContain('São Paulo/SP; subtom desconhecido');
    expect(row).not.toContain('posição aproximada');
  });

  it('numbers channels from 1 and skips digital-only repeaters', () => {
    const out = lines([base({}), base({ id: 'D', callsign: 'PY2DMR', modes: ['DMR'] }), base({ id: 'E', callsign: 'PY2E', modes: ['FM', 'DMR'] })]);
    expect(out.slice(1).map((l) => l.split(',').slice(0, 2).join(','))).toEqual(['1,SP 2KJP', '2,SP 2E']);
    expect(isFm(base({ modes: ['D-STAR'] }))).toBe(false);
  });

  it('uses dot decimals only', () => {
    expect(chirpCsv([{ repeater: base({ tone: 123 }), distanceKm: 1 }])).not.toMatch(/\d,\d{3}\b.*MHz/);
  });
});

describe('exports along a trail', () => {
  const rows = [{ repeater: base({ tone: 88.5 }), distanceKm: 4.24, alongKm: 12.36 }];

  it('adds the km along the trail to the spreadsheet', () => {
    const [header, row] = spreadsheetCsv(rows).replace(/^﻿/, '').trimEnd().split('\r\n');
    const cols = header!.split(';');
    expect(cols).toContain('Distância da trilha (km)');
    expect(row!.split(';')[cols.indexOf('Km da trilha')]).toBe('12,4');
  });

  it('starts the CHIRP comment with the km along the trail', () => {
    expect(chirpCsv(rows)).toContain(',km 12 da trilha; São Paulo/SP;');
  });
});

describe('spreadsheet safety', () => {
  it('keeps contributed text from running as a formula', () => {
    const csv = spreadsheetCsv([{ repeater: base({ notes: '=HYPERLINK("http://x","y")', correction: { source: '@evil', date: '2026-11-09' } }), distanceKm: 1 }]);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"",""y"")"`);
    expect(csv).toContain("'@evil (2026-11-09)");
    // Negative coordinates stay numbers.
    expect(csv).toMatch(/;-23,/);
  });
});

describe('repeaters reported off the air', () => {
  it('stay out of the CHIRP file but in the spreadsheet', () => {
    const rows = [
      { repeater: base({ tone: 88.5 }), distanceKm: 1 },
      { repeater: base({ id: 'X', callsign: 'PY2OFF', onAir: false, onAirDate: '2026-10-05' }), distanceKm: 2 },
    ];
    expect(chirpCsv(rows).trimEnd().split('\r\n')).toHaveLength(2);
    expect(spreadsheetCsv(rows)).toContain('PY2OFF');
  });
});
