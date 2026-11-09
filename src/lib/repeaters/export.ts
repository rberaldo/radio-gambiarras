// Downloads: a spreadsheet for people and a CSV CHIRP can import into a radio.
// The CHIRP format follows docs/chirp-csv.md exactly.
import type { Nearby } from './geo.ts';
import type { Repeater } from './merge.ts';

/** Quotes a CSV field when it contains the delimiter, a quote or a line break. */
function field(value: string, delimiter: string): string {
  return value.includes(delimiter) || /["\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const ptNumber = (n: number, digits: number) => n.toFixed(digits).replace('.', ',');

const LICENSE_LABELS: Record<Repeater['license'], string> = {
  ativa: 'ativa',
  'sem-data': 'sem data de validade',
  vencida: 'vencida',
  'nao-listada': 'não listada na Anatel',
};

function toneLabel(r: Repeater): string {
  if (r.tone === 'none') return 'nenhum';
  if (typeof r.tone === 'number') return ptNumber(r.tone, 1);
  return r.dcs ? '' : 'desconhecido';
}

/**
 * Spreadsheet for Brazilian Excel and LibreOffice: ";" between fields,
 * decimal commas, UTF-8 with a byte-order mark so accents survive.
 */
export function spreadsheetCsv(rows: readonly Nearby[]): string {
  const d = ';';
  const header = [
    'Indicativo', 'Saída (MHz)', 'Entrada (MHz)', 'Deslocamento (MHz)', 'Subtom (Hz)', 'DCS', 'Modos', 'Município', 'UF',
    'Latitude', 'Longitude', 'Posição', 'Distância (km)', 'Licença', 'Validade', 'No ar', 'Observações', 'Fonte da correção',
  ];
  const lines = rows.map(({ repeater: r, distanceKm }) =>
    [
      r.callsign,
      ptNumber(r.output, 3),
      ptNumber(r.input, 3),
      ptNumber(r.shift, 3),
      toneLabel(r),
      r.dcs ?? '',
      r.modes.join(' '),
      r.municipio,
      r.uf,
      r.position ? ptNumber(r.position.lat, 5) : '',
      r.position ? ptNumber(r.position.lon, 5) : '',
      r.position ? (r.position.exact ? 'exata' : 'aproximada (sede do município)') : 'desconhecida',
      ptNumber(distanceKm, 1),
      LICENSE_LABELS[r.license],
      r.validUntil ?? '',
      r.onAir === undefined ? '' : r.onAir ? 'sim' : 'não',
      r.notes ?? '',
      r.correction ? `${r.correction.source} (${r.correction.date})` : '',
    ]
      .map((v) => field(v, d))
      .join(d),
  );
  return `﻿${[header.join(d), ...lines].join('\r\n')}\r\n`;
}

export const CHIRP_HEADER =
  'Location,Name,Frequency,Duplex,Offset,Tone,rToneFreq,cToneFreq,DtcsCode,DtcsPolarity,RxDtcsCode,CrossMode,Mode,TStep,Skip,Power,Comment,URCALL,RPT1CALL,RPT2CALL,DVCODE';

/** Whether a repeater can be programmed as an analog FM channel. Unknown modes count as FM (most are). */
export const isFm = (r: Repeater) => r.modes.length === 0 || r.modes.includes('FM');

/**
 * CHIRP generic CSV for the FM repeaters among `rows`, numbered from
 * `firstChannel`. Every row has all 21 columns, dot decimals, and CHIRP's
 * own filler values where a setting does not apply (blank cells make CHIRP
 * reject the row).
 */
export function chirpCsv(rows: readonly Nearby[], firstChannel = 1): string {
  const lines = rows
    .map((n) => n.repeater)
    .filter(isFm)
    .map((r, i) => {
      const duplex = r.shift > 0 ? '+' : r.shift < 0 ? '-' : '';
      let toneMode = '';
      let rTone = 88.5;
      let dcs = '023';
      if (typeof r.tone === 'number') {
        toneMode = 'Tone';
        rTone = r.tone;
      } else if (r.dcs) {
        toneMode = 'DTCS';
        dcs = r.dcs;
      }
      const toneNote = r.tone === undefined && !r.dcs ? 'subtom desconhecido' : '';
      const comment = [`${r.municipio}/${r.uf}`, toneNote, r.position && !r.position.exact ? 'posição aproximada' : '']
        .filter(Boolean)
        .join('; ');
      return [
        String(firstChannel + i),
        r.callsign,
        r.output.toFixed(6),
        duplex,
        Math.abs(r.shift).toFixed(6),
        toneMode,
        rTone.toFixed(1),
        rTone.toFixed(1),
        dcs,
        'NN',
        dcs,
        'Tone->Tone',
        'FM',
        '5.00',
        '',
        '50W',
        comment,
        '',
        '',
        '',
        '',
      ]
        .map((v) => field(v, ','))
        .join(',');
    });
  return `${[CHIRP_HEADER, ...lines].join('\r\n')}\r\n`;
}
