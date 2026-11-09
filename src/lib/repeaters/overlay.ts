// The overlay: corrections the site's maintainer approved (tone, exact
// position, modes, on-air status) and repeaters Anatel does not list. Kept
// by hand in data/repeaters/overlay.json, never touched by the daily job.
// See docs/overlay.md.
import { BANDS, bandOf } from './types.ts';

export type Mode = 'FM' | 'DMR' | 'D-STAR' | 'Fusion' | 'NXDN' | 'P25' | 'M17';
export const MODES: readonly Mode[] = ['FM', 'DMR', 'D-STAR', 'Fusion', 'NXDN', 'P25', 'M17'];

/** The 50 standard CTCSS tones, in Hz. */
export const CTCSS_TONES: readonly number[] = [
  67.0, 69.3, 71.9, 74.4, 77.0, 79.7, 82.5, 85.4, 88.5, 91.5, 94.8, 97.4, 100.0, 103.5, 107.2, 110.9, 114.8, 118.8, 123.0,
  127.3, 131.8, 136.5, 141.3, 146.2, 151.4, 156.7, 159.8, 162.2, 165.5, 167.9, 171.3, 173.8, 177.3, 179.9, 183.5, 186.2,
  189.9, 192.8, 196.6, 199.5, 203.5, 206.5, 210.7, 218.1, 225.7, 229.1, 233.6, 241.8, 250.3, 254.1,
];

export interface OverlayEntry {
  /** CTCSS tone in Hz to open the repeater, or "none" when it needs none. Absent: unknown. */
  tone?: number | 'none';
  /** DCS code, three octal digits ("023"). */
  dcs?: string;
  /** Exact position of the repeater (its site, not the town). */
  lat?: number;
  lon?: number;
  modes?: Mode[];
  /** Whether it was confirmed on the air (true) or off the air (false). */
  onAir?: boolean;
  notes?: string;
  /** Only for repeaters Anatel does not list: */
  input?: number;
  municipio?: string;
  uf?: string;
  /** Where this information came from (a person, a club, a test on the air). Required. */
  source: string;
  /** When it was confirmed, ISO date. Required. */
  date: string;
  /**
   * Imported in bulk and not yet checked by the maintainer. The site does not
   * show it; approving a correction for the repeater clears it.
   */
  unverified?: boolean;
}

export interface OverlayFile {
  format: number;
  /** Repeater id ("PY2KJP@146.610") → corrections. */
  entries: Record<string, OverlayEntry>;
}

/** Generous box around Brazil, including the oceanic islands. */
const BRAZIL = { minLat: -35.5, maxLat: 7.0, minLon: -75.5, maxLon: -27.5 };
const ID = /^([A-Z0-9]{4,7})@(\d{2,3}\.\d{3})$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UFS = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));

/**
 * An entry for a repeater Anatel no longer lists, which does not describe a
 * repeater of its own (no input, município or UF): a correction left behind
 * when a licence lapsed or a repeater was renumbered. The site skips it; the
 * maintainer decides whether to delete it or complete it as a new repeater.
 */
export const isOrphan = (id: string, e: OverlayEntry, anatelIds: ReadonlySet<string>) =>
  !anatelIds.has(id) && e.input === undefined && e.municipio === undefined && e.uf === undefined;

/** Ids of orphaned entries (see isOrphan), for a warning: they never block a build. */
export function orphanedEntries(file: OverlayFile, anatelIds: ReadonlySet<string>): string[] {
  return Object.entries(file.entries)
    .filter(([id, e]) => isOrphan(id, e, anatelIds))
    .map(([id]) => id);
}

/**
 * Problems in an overlay file, as readable messages ("PY2KJP@146.610: tom 88
 * não é um tom CTCSS padrão"). `anatelIds` are the repeaters Anatel lists;
 * entries for other repeaters must say where they are and their input,
 * unless they are orphans (see isOrphan), which are only warned about.
 */
export function validateOverlay(file: OverlayFile, anatelIds: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  if (file.format !== 1) errors.push(`formato ${file.format} desconhecido`);
  for (const [id, e] of Object.entries(file.entries)) {
    const err = (msg: string) => errors.push(`${id}: ${msg}`);
    const m = ID.exec(id);
    if (!m) {
      err('id deve ser INDICATIVO@frequência com 3 casas, como PY2KJP@146.610');
      continue;
    }
    const output = Number(m[2]);
    const band = bandOf(output);
    if (!band) err(`saída ${output} MHz fora de 2 m e 70 cm`);
    if (!e.source?.trim()) err('falta a fonte (source)');
    if (!e.date || !ISO_DATE.test(e.date) || Number.isNaN(Date.parse(e.date))) err('data deve ser AAAA-MM-DD');
    if (e.tone !== undefined && e.tone !== 'none' && !CTCSS_TONES.includes(e.tone)) err(`tom ${e.tone} não é um tom CTCSS padrão`);
    if (e.dcs !== undefined && !/^[0-7]{3}$/.test(e.dcs)) err(`DCS ${e.dcs} deve ter três dígitos octais`);
    if (e.tone !== undefined && e.tone !== 'none' && e.dcs !== undefined) err('use tom ou DCS, não os dois');
    if ((e.lat === undefined) !== (e.lon === undefined)) err('latitude e longitude vão juntas');
    if (e.lat !== undefined && e.lon !== undefined) {
      if (e.lat < BRAZIL.minLat || e.lat > BRAZIL.maxLat || e.lon < BRAZIL.minLon || e.lon > BRAZIL.maxLon) {
        err(`posição ${e.lat}, ${e.lon} fora do Brasil (latitude e longitude trocadas?)`);
      }
    }
    if (e.unverified !== undefined && e.unverified !== true) err('unverified só pode ser true (ou ausente)');
    if (e.modes) for (const mode of e.modes) if (!MODES.includes(mode)) err(`modo ${mode} desconhecido`);
    if (!anatelIds.has(id) && !isOrphan(id, e, anatelIds)) {
      if (e.input === undefined || (band && bandOf(e.input) !== band)) err(`não está na Anatel: informe a entrada (input) na faixa de ${band ? BANDS[band].label : '?'}`);
      if (!e.municipio?.trim() || !e.uf || !UFS.has(e.uf)) err('não está na Anatel: informe município e UF');
      if (e.lat === undefined) err('não está na Anatel: informe a posição (lat, lon)');
    }
  }
  return errors;
}
