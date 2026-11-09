import { describe, expect, it } from 'vitest';
import { alongTrack, distanceKm } from '../src/lib/repeaters/geo.ts';
import type { Repeater } from '../src/lib/repeaters/merge.ts';
import { parseGpx } from '../src/lib/tracks/gpx.ts';
import { MAX_LINK_CHARS, decodeLine, encodeLine, readTrackHash, shareableTrack, writeTrackHash } from '../src/lib/tracks/link.ts';
import { TrackError, readTrack } from '../src/lib/tracks/read.ts';
import { simplifyLine } from '../src/lib/tracks/simplify.ts';
import { trackLengthKm } from '../src/lib/tracks/track.ts';

const GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Arquivo</name></metadata>
  <wpt lat="-22.5" lon="-43.0"><name>Cume</name></wpt>
  <trk>
    <name><![CDATA[Travessia Petrópolis–Teresópolis]]></name>
    <trkseg>
      <trkpt lat="-22.50" lon="-43.20"><ele>800</ele><name>ponto</name></trkpt>
      <trkpt lon="-43.10" lat='-22.45'/>
    </trkseg>
    <trkseg><trkpt lat="-22.40" lon="-43.00"></trkpt><trkpt lat="-22.40" lon="-42.95"></trkpt></trkseg>
  </trk>
</gpx>`;

describe('parseGpx', () => {
  it('reads track segments, ignores waypoints, takes the track name', () => {
    const t = parseGpx(GPX)!;
    expect(t.name).toBe('Travessia Petrópolis–Teresópolis');
    expect(t.lines).toEqual([
      [
        { lat: -22.5, lon: -43.2 },
        { lat: -22.45, lon: -43.1 },
      ],
      [
        { lat: -22.4, lon: -43 },
        { lat: -22.4, lon: -42.95 },
      ],
    ]);
  });

  it('reads planned routes and entity-encoded names', () => {
    const t = parseGpx('<gpx><rte><name>Pico &amp; Vale</name><rtept lat="1" lon="2"/><rtept lat="1.1" lon="2.1"/></rte></gpx>')!;
    expect(t.name).toBe('Pico & Vale');
    expect(t.lines).toHaveLength(1);
  });

  it('handles namespaced tags, comments, blank coordinates and broken names', () => {
    const t = parseGpx(`<gpx:gpx><gpx:trk><gpx:name>Pico &#99999999; Paraná</gpx:name><gpx:trkseg>
      <gpx:trkpt lat="-25.2" lon="-48.8"/><!-- <gpx:trkpt lat="5" lon="5"/> -->
      <gpx:trkpt lat="" lon=" "/><gpx:trkpt lat=" -25.3 " lon="-48.9"/>
    </gpx:trkseg><gpx:trkseg/></gpx:trk></gpx:gpx>`)!;
    expect(t.name).toBe('Pico &#99999999; Paraná');
    expect(t.lines).toEqual([
      [
        { lat: -25.2, lon: -48.8 },
        { lat: -25.3, lon: -48.9 },
      ],
    ]);
  });

  it('gives nothing for waypoints only', () => {
    expect(parseGpx('<gpx><wpt lat="1" lon="2"/></gpx>')).toBeUndefined();
  });
});

describe('readTrack', () => {
  it('names the problem precisely', () => {
    expect(() => readTrack('trilha.gpx', 'não sou xml')).toThrow(/não parece GPX/);
    expect(() => readTrack('vazio.gpx', '<gpx></gpx>')).toThrow(/não tem nenhuma trilha ou rota/);
    expect(() => readTrack('pontos.gpx', '<gpx><wpt lat="1" lon="2"/></gpx>')).toThrow(/só tem pontos soltos/);
  });

  it('names a file of several tracks by the file, or by all of them', () => {
    const trk = (n: string) => `<trk><name>${n}</name><trkseg><trkpt lat="1" lon="2"/><trkpt lat="1.1" lon="2"/></trkseg></trk>`;
    expect(parseGpx(`<gpx>${trk('Dia 1')}${trk('Dia 2')}</gpx>`)!.name).toBe('Dia 1 + Dia 2');
    expect(parseGpx(`<gpx>${trk('A')}${trk('B')}${trk('C')}${trk('D')}</gpx>`)!.name).toBe('A + B + mais 2');
    expect(parseGpx(`<gpx><metadata><name>Travessia</name></metadata>${trk('Dia 1')}${trk('Dia 2')}</gpx>`)!.name).toBe('Travessia');
  });

  it('explains unknown formats and files without a trail', () => {
    expect(() => readTrack('foto.jpg', 'xyz')).toThrow(TrackError);
    expect(readTrack('sem-extensao', GPX).lines).toHaveLength(2);
  });
});

describe('simplifyLine', () => {
  it('drops points that do not change the shape', () => {
    const line = Array.from({ length: 1001 }, (_, i) => ({ lat: -22 + i * 0.0001 + (i % 2) * 0.000001, lon: -43 }));
    expect(simplifyLine(line, 0.01)).toEqual([line[0], line[1000]]);
  });

  it('keeps corners', () => {
    const line = [
      { lat: 0, lon: 0 },
      { lat: 0, lon: 0.5 },
      { lat: 0, lon: 1 },
      { lat: 1, lon: 1 },
    ];
    expect(simplifyLine(line, 0.1)).toEqual([line[0], line[2], line[3]]);
  });
});

describe('links', () => {
  it('encodes lines like Google polylines', () => {
    // Google's documented example.
    const line = [
      { lat: 38.5, lon: -120.2 },
      { lat: 40.7, lon: -120.95 },
      { lat: 43.252, lon: -126.453 },
    ];
    expect(encodeLine(line)).toBe('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(decodeLine('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual(line);
    expect(decodeLine('_p~iF~ps|U_')).toBeUndefined();
  });

  it('round-trips a trail with its name', () => {
    const t = parseGpx(GPX)!;
    expect(readTrackHash(writeTrackHash(t))).toEqual(t);
    expect(readTrackHash('#outra=1')).toBeUndefined();
    expect(readTrackHash('#trilha=%20%20')).toBeUndefined();
  });

  it('simplifies a long log until the link, as written, is short', () => {
    // A wiggly 40 km log with 20,000 points, in two pieces.
    const line = Array.from({ length: 20000 }, (_, i) => ({ lat: -22.5 + i * 0.000018, lon: -43 + Math.sin(i / 7) * 0.0004 }));
    const shared = shareableTrack({ name: 'Longa', lines: [line.slice(0, 10000), line.slice(10000)] });
    expect(writeTrackHash(shared).length).toBeLessThanOrEqual(MAX_LINK_CHARS);
    expect(trackLengthKm(shared)).toBeGreaterThan(39);
  });

  it('rejects damaged links instead of drawing nonsense', () => {
    expect(decodeLine('_p~iF~ps|U_ulL')).toBeUndefined();
    expect(decodeLine('ab c')).toBeUndefined();
    expect(readTrackHash('#trilha=_p~iF~ps|U_ulLnnqC,abc')).toBeUndefined();
  });
});

describe('alongTrack', () => {
  const rep = (id: string, lat: number, lon: number) => ({ id, position: { lat, lon, exact: true } }) as Repeater;
  // A trail heading east along the equator for about 111 km.
  const trail = [[{ lat: 0, lon: 0 }, { lat: 0, lon: 0.5 }, { lat: 0, lon: 1 }]];

  it('finds repeaters near any part of the trail, in walking order', () => {
    const found = alongTrack([rep('far-end', 0.05, 0.9), rep('start', -0.05, 0.05), rep('off', 0.5, 0.5)], trail, 10);
    expect(found.map((f) => f.repeater.id)).toEqual(['start', 'far-end']);
    expect(found[0]!.distanceKm).toBeCloseTo(distanceKm({ lat: -0.05, lon: 0.05 }, { lat: 0, lon: 0.05 }), 1);
    expect(found[1]!.alongKm).toBeCloseTo(100.2, 0);
  });

  it('counts walking distance across several lines and ignores zero-length pieces', () => {
    const lines = [
      [
        { lat: 0, lon: 0 },
        { lat: 0, lon: 0 },
        { lat: 0, lon: 0.5 },
      ],
      [
        { lat: 1, lon: 0.5 },
        { lat: 1, lon: 1 },
      ],
    ];
    const found = alongTrack([rep('second', 1.02, 0.75), rep('first', 0.02, 0.25)], lines, 5);
    expect(found.map((f) => f.repeater.id)).toEqual(['first', 'second']);
    expect(found[1]!.alongKm).toBeCloseTo(0.75 * 111.2, 0);
  });

  it('works on a trail crossing the equator', () => {
    const trail = [[{ lat: -0.5, lon: -50 }, { lat: 0.5, lon: -50 }]];
    expect(alongTrack([rep('north', 0.4, -50.05), rep('south', -0.4, -49.95)], trail, 10).map((f) => f.repeater.id)).toEqual(['south', 'north']);
  });

  it('measures past the ends of the trail as distance from the end', () => {
    const [f] = alongTrack([rep('beyond', 0, 1.05)], trail, 10);
    expect(f!.alongKm).toBeCloseTo(111.3, 0);
    expect(f!.distanceKm).toBeCloseTo(5.6, 1);
  });
});
