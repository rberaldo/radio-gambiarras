// Vetting: the maintainer checks repeaters on the air and records when. The
// status each repeater shows comes from the overlay's onAir and checked
// fields. Checks are made in a hidden sheet (/repetidoras/conferir), exported
// as JSON and merged into the overlay by scripts/repeaters/apply-checks.ts.
// See docs/overlay.md.
import { daysSince } from '../format.ts';
import type { Repeater } from './merge.ts';
import { CTCSS_TONES, MODES, type Mode, type OverlayEntry, type OverlayFile } from './overlay.ts';

export type VettingStatus = 'fora-do-ar' | 'recente' | 'antiga' | 'nunca';

/** A check this many days old or less counts as recent. */
export const RECENT_DAYS = 90;

/** Off the air wins and never goes stale; otherwise the age of the last check. */
export function vettingStatus(r: Pick<Repeater, 'onAir' | 'checked'>, today: Date = new Date()): VettingStatus {
  if (r.onAir === false) return 'fora-do-ar';
  if (!r.checked) return 'nunca';
  return daysSince(r.checked, today) <= RECENT_DAYS ? 'recente' : 'antiga';
}

export const VETTING_TEXT: Record<VettingStatus, string> = {
  'fora-do-ar': 'fora do ar',
  recente: 'conferida',
  antiga: 'conferida há mais de 3 meses',
  nunca: 'nunca conferida',
};

/** "Não abriu" counts as off the air (the maintainer's call, 2026-11-11). */
export type CheckResult = 'abriu' | 'fora-do-ar';
export type CheckHow = 'teste' | 'escuta' | 'relato';

export const CHECK_RESULTS: Record<CheckResult, string> = { abriu: 'Abriu', 'fora-do-ar': 'Não abriu / fora do ar' };
export const CHECK_HOWS: Record<CheckHow, string> = { teste: 'Teste meu no ar', escuta: 'Escuta', relato: 'Relato de terceiro' };

/** One row of the vetting sheet: what the maintainer found on a given day. */
export interface Check {
  date: string;
  result?: CheckResult;
  /** Absent means "teste". */
  how?: CheckHow;
  /** Who reported it, for "relato". */
  reporter?: string;
  tone?: number | 'none';
  dcs?: string;
  lat?: number;
  lon?: number;
  modes?: Mode[];
  /** For the maintainer and whoever applies the file; never published. */
  comment?: string;
}

export interface ChecksFile {
  format: 1;
  kind: 'conferencias';
  exportedAt: string;
  /** Repeater id → its check. */
  checks: Record<string, Check>;
}

/** "teste no ar", "escuta", "relato de PY1ABC". */
export function howText(c: Pick<Check, 'how' | 'reporter'>): string {
  if (c.how === 'escuta') return 'escuta';
  if (c.how === 'relato') return c.reporter?.trim() ? `relato de ${c.reporter.trim()}` : 'relato de terceiro';
  return 'teste no ar';
}

const ID = /^[A-Z0-9]{4,7}@\d{2,3}\.\d{3}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (v: unknown) => typeof v === 'string' && ISO_DATE.test(v) && !Number.isNaN(Date.parse(v));

/** Problems in an exported file, as readable messages; empty when it can be applied. */
export function validateChecks(file: unknown): string[] {
  const f = file as Partial<ChecksFile> | null;
  if (!f || typeof f !== 'object' || f.kind !== 'conferencias' || f.format !== 1) return ['não é um arquivo de conferências (formato 1)'];
  if (!f.checks || typeof f.checks !== 'object') return ['falta a lista de conferências (checks)'];
  const errors: string[] = [];
  for (const [id, c] of Object.entries(f.checks)) {
    const err = (msg: string) => errors.push(`${id}: ${msg}`);
    if (!ID.test(id)) err('id deve ser INDICATIVO@frequência com 3 casas');
    if (!isDate(c.date)) err('data deve ser AAAA-MM-DD');
    if (c.result !== undefined && !(c.result in CHECK_RESULTS)) err(`resultado ${c.result} desconhecido`);
    if (c.how !== undefined && !(c.how in CHECK_HOWS)) err(`"como" ${c.how} desconhecido`);
    if (c.tone !== undefined && c.tone !== 'none' && !CTCSS_TONES.includes(c.tone)) err(`tom ${c.tone} não é um tom CTCSS padrão`);
    if (c.dcs !== undefined && !/^[0-7]{3}$/.test(c.dcs)) err(`DCS ${c.dcs} deve ter três dígitos octais`);
    if (c.tone !== undefined && c.dcs !== undefined) err('use tom ou DCS, não os dois');
    if ((c.lat === undefined) !== (c.lon === undefined)) err('latitude e longitude vão juntas');
    if (c.lat !== undefined && (typeof c.lat !== 'number' || typeof c.lon !== 'number')) err('latitude e longitude devem ser números');
    if (c.modes !== undefined && (!Array.isArray(c.modes) || c.modes.some((m) => !MODES.includes(m)))) err('modos desconhecidos');
  }
  return errors;
}

/** What applying one check did, for the summary the script prints. */
export interface CheckOutcome {
  id: string;
  /** Plain description: "abriu (teste no ar), subtom 88,5". */
  applied: string[];
  comment?: string;
}

/**
 * The overlay with the checks applied. A result sets onAir and the check
 * date; a report from someone else counts as a check. Tone, position and modes replace
 * what was there. An imported (`unverified`) entry stays so while its
 * imported position is not confirmed, so the map keeps calling it "provável".
 */
export function applyChecks(file: OverlayFile, checks: Record<string, Check>): { file: OverlayFile; outcomes: CheckOutcome[] } {
  const entries = { ...file.entries };
  const outcomes: CheckOutcome[] = [];
  for (const [id, c] of Object.entries(checks)) {
    const before: OverlayEntry | undefined = entries[id];
    const e: OverlayEntry = { ...(before ?? { source: '', date: c.date }) };
    const how = howText(c);
    const applied: string[] = [];

    if (c.result) {
      e.onAir = c.result === 'abriu';
      e.onAirDate = c.date;
      e.checked = c.date;
      e.checkedHow = how;
      applied.push(`${c.result === 'abriu' ? 'no ar' : 'fora do ar'} (${how})`);
    }
    if (c.tone !== undefined) {
      e.tone = c.tone;
      delete e.dcs;
      applied.push(`subtom ${c.tone === 'none' ? 'nenhum' : c.tone}`);
    }
    if (c.dcs !== undefined) {
      e.dcs = c.dcs;
      delete e.tone;
      applied.push(`DCS ${c.dcs}`);
    }
    if (c.lat !== undefined && c.lon !== undefined) {
      e.lat = c.lat;
      e.lon = c.lon;
      applied.push(`posição ${c.lat}, ${c.lon}`);
    }
    if (c.modes?.length) {
      e.modes = c.modes;
      applied.push(`modos ${c.modes.join(', ')}`);
    }

    if (applied.length) {
      // While an imported position is unconfirmed, the import's source still describes it.
      const keepsImportedPosition = before?.unverified && before.lat !== undefined && c.lat === undefined;
      if (!keepsImportedPosition) {
        delete e.unverified;
        e.source = `Conferência (${how})`;
        e.date = c.date;
      }
      entries[id] = e;
    }
    outcomes.push({ id, applied, ...(c.comment?.trim() && { comment: c.comment.trim() }) });
  }
  // Sorted keys keep diffs small and the file stable.
  const sorted = Object.fromEntries(Object.keys(entries).sort().map((k) => [k, entries[k]!]));
  return { file: { ...file, entries: sorted }, outcomes };
}
