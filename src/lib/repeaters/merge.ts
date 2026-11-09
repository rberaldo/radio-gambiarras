// Combines Anatel's licensed repeaters with the overlay into the records
// the map shows and exports.
import type { Mode, OverlayEntry, OverlayFile } from './overlay.ts';
import { bandOf, type AnatelRepeater, type Band, type LicenseStatus } from './types.ts';

export interface Repeater {
  id: string;
  callsign: string;
  band: Band;
  output: number;
  input: number;
  /** input − output in MHz: −0.6, +5, 0 for simplex. */
  shift: number;
  municipio: string;
  uf: string;
  /** Where to draw it. "exact" comes from the overlay; otherwise it is the município's seat. */
  position?: { lat: number; lon: number; exact: boolean };
  /** CTCSS tone in Hz, "none" when known to need none, undefined when unknown. */
  tone?: number | 'none';
  dcs?: string;
  /** Known modes; empty when unknown. */
  modes: Mode[];
  onAir?: boolean;
  /** Anatel license status, or "nao-listada" for repeaters only the overlay knows. */
  license: LicenseStatus | 'nao-listada';
  validUntil?: string;
  notes?: string;
  /** Overlay source and date, when corrections were applied. */
  correction?: { source: string; date: string };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

function apply(base: Omit<Repeater, 'shift'>, e: OverlayEntry | undefined): Repeater {
  const r: Repeater = { ...base, shift: round3(base.input - base.output) };
  if (!e) return r;
  if (e.lat !== undefined && e.lon !== undefined) r.position = { lat: e.lat, lon: e.lon, exact: true };
  if (e.tone !== undefined) r.tone = e.tone;
  if (e.dcs !== undefined) r.dcs = e.dcs;
  if (e.modes) r.modes = e.modes;
  if (e.onAir !== undefined) r.onAir = e.onAir;
  if (e.notes) r.notes = e.notes;
  r.correction = { source: e.source, date: e.date };
  return r;
}

/**
 * Anatel's repeaters with overlay corrections applied, plus overlay-only
 * repeaters. Assumes the overlay passed validateOverlay.
 */
export function mergeRepeaters(anatel: readonly AnatelRepeater[], overlay: OverlayFile): Repeater[] {
  const merged = anatel.map((a) =>
    apply(
      {
        id: a.id,
        callsign: a.callsign,
        band: a.band,
        output: a.output,
        input: a.input,
        municipio: a.municipio,
        uf: a.uf,
        position: a.lat !== undefined && a.lon !== undefined ? { lat: a.lat, lon: a.lon, exact: false } : undefined,
        modes: [],
        license: a.status,
        validUntil: a.validUntil,
      },
      overlay.entries[a.id],
    ),
  );

  const known = new Set(anatel.map((a) => a.id));
  for (const [id, e] of Object.entries(overlay.entries)) {
    if (known.has(id)) continue;
    const [callsign, freq] = id.split('@') as [string, string];
    const output = Number(freq);
    merged.push(
      apply(
        {
          id,
          callsign,
          band: bandOf(output)!,
          output,
          input: e.input!,
          municipio: e.municipio!,
          uf: e.uf!,
          modes: [],
          license: 'nao-listada',
        },
        e,
      ),
    );
  }
  // Drop undefined fields so the output stays compact and stable.
  return merged.map((r) => JSON.parse(JSON.stringify(r)) as Repeater);
}
