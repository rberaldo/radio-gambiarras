// Turns a correction issue (the form in .github/ISSUE_TEMPLATE) into an
// overlay entry. GitHub writes a form's answers into the issue body as
// "### <label>" sections; empty answers read "_No response_".
import { parseCoordinates } from '../../src/lib/repeaters/coordinates.ts';
import { FIELDS, MODE_CHOICES, ON_AIR_OPTIONS, TONE_OPTIONS } from '../../src/lib/repeaters/correction.ts';
import type { Mode, OverlayEntry, OverlayFile } from '../../src/lib/repeaters/overlay.ts';

type FieldKey = keyof typeof FIELDS;
export type FormAnswers = Partial<Record<FieldKey, string>>;

const NO_RESPONSE = '_No response_';

/** The answers in an issue body, by field. Unknown headings stay part of the previous answer. */
export function parseIssueBody(body: string): FormAnswers {
  const byLabel = new Map<string, FieldKey>(Object.entries(FIELDS).map(([key, f]) => [f.label, key as FieldKey]));
  const answers: FormAnswers = {};
  let current: FieldKey | undefined;
  let lines: string[] = [];
  const flush = () => {
    if (!current) return;
    const text = lines.join('\n').trim();
    answers[current] = text === NO_RESPONSE ? '' : text;
  };
  for (const line of body.replace(/\r\n/g, '\n').split('\n')) {
    const heading = /^###\s+(.+?)\s*$/.exec(line);
    const key = heading ? byLabel.get(heading[1]!) : undefined;
    if (key) {
      flush();
      current = key;
      lines = [];
    } else {
      lines.push(line);
    }
  }
  flush();
  return answers;
}

/** "PY1BEU @ 147,15" → "PY1BEU@147.150", or undefined. */
export function normalizeId(raw: string): string | undefined {
  const m = /^([A-Z0-9]{4,7})@(\d{2,3}(?:\.\d{1,4})?)$/.exec(raw.toUpperCase().replace(/\s+/g, '').replace(',', '.'));
  return m ? `${m[1]}@${Number(m[2]).toFixed(3)}` : undefined;
}

const parseMHz = (raw: string) => {
  const t = raw.trim().replace(',', '.').replace(/\s*mhz$/i, '');
  return /^\d{2,3}(\.\d+)?$/.test(t) ? Number(t) : undefined;
};

export interface IssueMeta {
  /** GitHub login of whoever opened the issue. */
  author: string;
  number: number;
  /** Approval date, ISO. */
  date: string;
}

export type ParsedCorrection = { ok: true; id: string; entry: OverlayEntry } | { ok: false; problems: string[] };

/** The overlay entry an issue asks for, or the reasons it cannot be read. */
export function correctionFromIssue(answers: FormAnswers, meta: IssueMeta): ParsedCorrection {
  const problems: string[] = [];
  const id = normalizeId(answers.repeater ?? '');
  if (!id) problems.push(`"${answers.repeater ?? ''}" não parece INDICATIVO@saída, como PY1BEU@147.150`);

  const how = (answers.source ?? '').replace(/\s+/g, ' ').trim();
  if (!how) problems.push('falta dizer como você sabe');
  const who = (answers.callsign ?? '').trim().toUpperCase() || `@${meta.author}`;
  const entry: OverlayEntry = { source: `${who}: ${how.slice(0, 200)} (issue #${meta.number})`, date: meta.date };

  const tone = (answers.tone ?? '').trim();
  const dcs = (answers.dcs ?? '').trim();
  if (tone === TONE_OPTIONS.none) entry.tone = 'none';
  else if (tone && tone !== TONE_OPTIONS.unknown && tone !== TONE_OPTIONS.dcs) {
    const hz = Number(tone.replace(/\s*Hz$/i, '').replace(',', '.'));
    if (Number.isFinite(hz)) entry.tone = hz;
    else problems.push(`subtom "${tone}" não reconhecido`);
  }
  if (dcs) {
    if (/^[0-7]{1,3}$/.test(dcs)) entry.dcs = dcs.padStart(3, '0');
    else problems.push(`DCS "${dcs}" deve ter até três dígitos de 0 a 7`);
  } else if (tone === TONE_OPTIONS.dcs) {
    problems.push('escolheu DCS mas não informou o código');
  }

  const position = (answers.position ?? '').trim();
  if (position) {
    const p = parseCoordinates(position);
    if (p) {
      entry.lat = Number(p.lat.toFixed(5));
      entry.lon = Number(p.lon.toFixed(5));
    } else problems.push(`posição "${position}" não reconhecida: use latitude e longitude, como -22,4547 -43,1729`);
  }

  const modes = MODE_CHOICES.filter((m) => new RegExp(`^- \\[[xX]\\] ${m.replace('-', '\\-')}$`, 'm').test(answers.modes ?? ''));
  if (modes.length) entry.modes = modes as Mode[];

  const onAir = (answers.onAir ?? '').trim();
  if (onAir === ON_AIR_OPTIONS.yes) entry.onAir = true;
  else if (onAir === ON_AIR_OPTIONS.no) entry.onAir = false;

  const input = (answers.input ?? '').trim();
  if (input) {
    const mhz = parseMHz(input);
    if (mhz !== undefined) entry.input = mhz;
    else problems.push(`entrada "${input}" não é uma frequência em MHz`);
  }
  const place = (answers.place ?? '').trim();
  if (place) {
    const m = /^(.+?)\s*[/-]\s*([A-Za-z]{2})$/.exec(place);
    if (m) {
      entry.municipio = m[1]!;
      entry.uf = m[2]!.toUpperCase();
    } else problems.push(`município "${place}" deve ser Cidade/UF, como Petrópolis/RJ`);
  }

  const notes = (answers.notes ?? '').trim();
  if (notes) entry.notes = notes.slice(0, 500);

  const informative = ['tone', 'dcs', 'lat', 'modes', 'onAir', 'notes', 'input'].some((k) => k in entry);
  if (!informative && !problems.length) problems.push('a sugestão não traz nenhuma informação: preencha ao menos um campo');

  return problems.length || !id ? { ok: false, problems } : { ok: true, id, entry };
}

/**
 * The overlay with a correction applied. Fields the issue leaves blank keep
 * their earlier value; a tone replaces a DCS code and vice versa.
 */
export function applyCorrection(file: OverlayFile, id: string, entry: OverlayEntry): OverlayFile {
  const merged: OverlayEntry = { ...file.entries[id], ...entry };
  if (entry.tone !== undefined) delete merged.dcs;
  if (entry.dcs !== undefined) delete merged.tone;
  // The maintainer approved it, so it is no longer an unchecked import.
  delete merged.unverified;
  const entries = { ...file.entries, [id]: merged };
  // Sorted keys keep diffs small and the file stable.
  return { ...file, entries: Object.fromEntries(Object.keys(entries).sort().map((k) => [k, entries[k]!])) };
}
