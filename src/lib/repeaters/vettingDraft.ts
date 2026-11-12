// The vetting sheet's rows as typed (strings from inputs and dropdowns), and
// their conversion to and from the Check records the export carries.
import { CTCSS_TONES, type Mode } from './overlay.ts';
import type { Check, CheckHow, CheckResult, ChecksFile } from './vetting.ts';

export interface RowDraft {
  date: string;
  result?: CheckResult;
  how?: CheckHow;
  reporter?: string;
  /** Tone dropdown: "" keeps what is there, "none", "dcs" (code in `dcs`) or Hz ("88.5"). */
  tone?: string;
  dcs?: string;
  /** "lat, lon" as typed or pasted from a map. */
  position?: string;
  modes?: Mode[];
  comment?: string;
}

const NUMBER = String.raw`(-?\d{1,3}(?:[.,]\d+)?)`;
const POSITION = new RegExp(String.raw`^\s*${NUMBER}\s*[,;\s]\s*${NUMBER}\s*$`);
const num = (s: string) => Number(s.replace(',', '.'));

/** "-22.95, -43.21" or "-22,95 -43,21" → a point with 5 decimals; "invalid" when it cannot be read. */
export function parsePosition(text: string | undefined): { lat: number; lon: number } | 'invalid' | undefined {
  if (!text?.trim()) return undefined;
  const m = POSITION.exec(text);
  if (!m) return 'invalid';
  const round = (n: number) => Math.round(n * 1e5) / 1e5;
  return { lat: round(num(m[1]!)), lon: round(num(m[2]!)) };
}

/** Whether the row says anything beyond its default date and method. */
export function isEdited(d: RowDraft | undefined): boolean {
  return !!d && !!(d.result || d.tone || d.position?.trim() || d.modes?.length || d.comment?.trim());
}

/** The check a row describes, or what is wrong with it. */
export function draftToCheck(d: RowDraft): { check: Check; problems: string[] } {
  const problems: string[] = [];
  const check: Check = { date: d.date };
  if (d.result) check.result = d.result;
  if (d.how && d.how !== 'teste') check.how = d.how;
  if (d.how === 'relato' && d.reporter?.trim()) check.reporter = d.reporter.trim();
  if (d.tone === 'none') check.tone = 'none';
  else if (d.tone === 'dcs') {
    const code = d.dcs?.trim() ?? '';
    if (/^[0-7]{3}$/.test(code)) check.dcs = code;
    else problems.push('código DCS deve ter três dígitos de 0 a 7');
  } else if (d.tone) {
    const hz = Number(d.tone);
    if (CTCSS_TONES.includes(hz)) check.tone = hz;
    else problems.push(`subtom ${d.tone} desconhecido`);
  }
  const at = parsePosition(d.position);
  if (at === 'invalid') problems.push('posição deve ser "latitude, longitude", como -22.95, -43.21');
  else if (at) Object.assign(check, at);
  if (d.modes?.length) check.modes = d.modes;
  if (d.comment?.trim()) check.comment = d.comment.trim();
  return { check, problems };
}

/** A row for a check read back from an export. */
export function checkToDraft(c: Check): RowDraft {
  const d: RowDraft = { date: c.date };
  if (c.result) d.result = c.result;
  if (c.how) d.how = c.how;
  if (c.reporter) d.reporter = c.reporter;
  if (c.tone !== undefined) d.tone = String(c.tone);
  if (c.dcs) Object.assign(d, { tone: 'dcs', dcs: c.dcs });
  if (c.lat !== undefined && c.lon !== undefined) d.position = `${c.lat}, ${c.lon}`;
  if (c.modes?.length) d.modes = c.modes;
  if (c.comment) d.comment = c.comment;
  return d;
}

/** The export of every edited row, and the problems keyed by repeater id. */
export function buildExport(drafts: Record<string, RowDraft>, now: Date): { file: ChecksFile; problems: Record<string, string[]> } {
  const checks: ChecksFile['checks'] = {};
  const problems: Record<string, string[]> = {};
  for (const id of Object.keys(drafts).sort()) {
    const d = drafts[id]!;
    if (!isEdited(d)) continue;
    const out = draftToCheck(d);
    if (out.problems.length) problems[id] = out.problems;
    else checks[id] = out.check;
  }
  return { file: { format: 1, kind: 'conferencias', exportedAt: now.toISOString(), checks }, problems };
}
