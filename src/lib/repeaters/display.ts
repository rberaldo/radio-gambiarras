// How repeater fields read in Portuguese, shared by the list, the detail
// panel and anything else that shows a repeater.
import type { Repeater } from './merge.ts';

const pt = (n: number, digits: number) => n.toFixed(digits).replace('.', ',');

/** 146.61 → "146,610". */
export const formatMHz = (mhz: number) => pt(mhz, 3);

/** −0.6 → "−0,600"; 5 → "+5,000"; 0 → "simplex". */
export function formatShift(shift: number): string {
  if (shift === 0) return 'simplex';
  return `${shift > 0 ? '+' : '−'}${pt(Math.abs(shift), 3)}`;
}

/** "88,5 Hz", "DCS 023", "nenhum" or "desconhecido". */
export function toneText(r: Pick<Repeater, 'tone' | 'dcs'>): string {
  if (typeof r.tone === 'number') return `${pt(r.tone, 1)} Hz`;
  if (r.dcs) return `DCS ${r.dcs}`;
  if (r.tone === 'none') return 'nenhum';
  return 'desconhecido';
}

export const LICENSE_TEXT: Record<Repeater['license'], string> = {
  ativa: 'licença ativa',
  'sem-data': 'licença sem data de validade',
  vencida: 'licença vencida',
  'nao-listada': 'não listada na Anatel',
};

/** "12,3 km". */
export const formatKm = (km: number) => `${pt(km, 1)} km`;

export const BAND_TEXT: Record<Repeater['band'], string> = { '2m': '2 m', '70cm': '70 cm' };
