// Shapes of the repeater data, shared by the pipeline that writes
// data/repeaters/ and the site that reads it.

export type Band = '2m' | '70cm';

export const BANDS: Record<Band, { label: string; min: number; max: number }> = {
  '2m': { label: '2 m', min: 144, max: 148 },
  '70cm': { label: '70 cm', min: 430, max: 440 },
};

/** Anatel's "Status da Validade", simplified. */
export type LicenseStatus = 'ativa' | 'sem-data' | 'vencida';

/** One repeater as Anatel licenses it: a callsign transmitting on one output frequency. */
export interface AnatelRepeater {
  /** Stable key: callsign + output frequency, e.g. "PY2KJP@146.610". */
  id: string;
  callsign: string;
  band: Band;
  /** MHz the repeater transmits on (what you listen to). */
  output: number;
  /** MHz the repeater listens on (what you transmit on). */
  input: number;
  municipio: string;
  uf: string;
  status: LicenseStatus;
  /** "Data de Validade da Estação", ISO date, when Anatel gives one. */
  validUntil?: string;
}

export interface AnatelRepeatersFile {
  format: number;
  repeaters: AnatelRepeater[];
}

/** Callsign-and-frequency key used everywhere (data files, overlay, URLs). */
export function repeaterId(callsign: string, output: number): string {
  return `${callsign}@${output.toFixed(3)}`;
}

export function bandOf(mhz: number): Band | undefined {
  for (const [band, range] of Object.entries(BANDS) as [Band, (typeof BANDS)[Band]][]) {
    if (mhz >= range.min && mhz <= range.max) return band;
  }
  return undefined;
}
