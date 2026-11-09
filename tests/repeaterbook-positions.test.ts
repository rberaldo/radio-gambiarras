import { describe, expect, it } from 'vitest';
import { gpxPositions, parseGpx, pickPlace, siteQuery, type NominatimPlace } from '../scripts/repeaterbook/positions.ts';
import { municipioLookup } from '../scripts/anatel/municipios.ts';
import type { AnatelRepeater } from '../src/lib/repeaters/types.ts';

const anatel = (over: Partial<AnatelRepeater> = {}): AnatelRepeater =>
  ({ id: 'PY1ZZZ@147.150', callsign: 'PY1ZZZ', band: '2m', output: 147.15, input: 147.75, municipio: 'Petrópolis', uf: 'RJ', status: 'ativa', lat: -22.505, lon: -43.178, ...over }) as AnatelRepeater;

const wpt = (lat: string, lon: string, name: string) => `<wpt lat="${lat}" lon="${lon}">\n\n    <name>${name}</name>\n    <cmt>x</cmt></wpt>`;

describe('parseGpx', () => {
  it('reads callsign, output and precision from both name styles', () => {
    const xml = `<gpx>${wpt('-25.42', '-49.27', 'PY5ZZZ 437.700000 437.700000')}${wpt('-22.43000000', '-46.57', 'py4zzz Monte Sião 145.200000-')}</gpx>`;
    expect(parseGpx(xml)).toEqual([
      { callsign: 'PY5ZZZ', output: 437.7, lat: -25.42, lon: -49.27, decimals: 2 },
      { callsign: 'PY4ZZZ', output: 145.2, lat: -22.43, lon: -46.57, decimals: 8 },
    ]);
  });
});

describe('gpxPositions', () => {
  const p = (lat: number, lon: number, decimals = 6) => ({ callsign: 'PY1ZZZ', output: 147.15, lat, lon, decimals });

  it('keeps precise points away from the town centre', () => {
    expect(gpxPositions([p(-22.45, -43.1)], [anatel()]).get('PY1ZZZ@147.150')).toEqual({ lat: -22.45, lon: -43.1 });
  });

  it('drops rounded points, town-centre geocodes and far-off mistakes', () => {
    expect(gpxPositions([p(-22.45, -43.1, 2)], [anatel()]).size).toBe(0);
    expect(gpxPositions([p(-22.506, -43.179)], [anatel()]).size).toBe(0);
    expect(gpxPositions([p(-15.0, -41.9)], [anatel()]).size).toBe(0);
  });
});

describe('siteQuery', () => {
  const find = municipioLookup([
    { ibge: 1, nome: 'Petrópolis', uf: 'RJ', lat: -22.505, lon: -43.178 },
    { ibge: 2, nome: 'Teresópolis', uf: 'RJ', lat: -22.41, lon: -42.97 },
  ]);

  it('takes the site and searches around the right town', () => {
    expect(siteQuery('Local: Pico do Cuca.', anatel(), find)).toEqual({ sites: ['Pico do Cuca'], around: { lat: -22.505, lon: -43.178 } });
    expect(siteQuery('Local: Teresópolis, Alto do Soberbo. Ligada a EchoLink.', anatel(), find)).toEqual({
      sites: ['Alto do Soberbo'],
      around: { lat: -22.41, lon: -42.97 },
    });
  });

  it('skips notes with only a town or no place', () => {
    expect(siteQuery('Local: Teresópolis.', anatel(), find)).toBeUndefined();
    expect(siteQuery("Local: Caixa d'água.", anatel(), find)).toBeUndefined();
    expect(siteQuery('Ligada a EchoLink.', anatel(), find)).toBeUndefined();
  });
});

describe('pickPlace', () => {
  const around = { lat: -18.85, lon: -41.95 };
  const place = (name: string, cls: string, lat = '-18.88', lon = '-41.98'): NominatimPlace => ({ name, class: cls, type: 'x', lat, lon });

  it('prefers peaks and ignores connectors in names', () => {
    const pick = pickPlace('Pico do Ibituruna', [place('Pico da Ibituruna', 'boundary', '-18.9'), place('Pico da Ibituruna', 'natural')], around);
    expect(pick?.point).toEqual({ lat: -18.88, lon: -41.98 });
  });

  it('never picks streets, other names or far places', () => {
    expect(pickPlace('Morro do Cristo', [place('Morro do Cristo', 'highway')], around)).toBeUndefined();
    expect(pickPlace('Paulista', [place('Campo Limpo Paulista', 'boundary')], around)).toBeUndefined();
    expect(pickPlace('Pico X', [place('Pico X', 'natural', '-15.0')], around)).toBeUndefined();
  });
});
