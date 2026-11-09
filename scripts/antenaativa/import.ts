// One-off: CTCSS tones from the Antena Ativa repeater list, saved as a PDF
// by the maintainer (decided with the user on 2026-11-09). The list has no
// callsigns, so a row is used only when its town and output frequency match
// exactly one Anatel repeater. Only tones are taken, and only for repeaters
// whose overlay entry has none: a tone already there (from the RepeaterBook
// import or a person) is never changed. New tones are `unverified`.
// The PDF and its text stay in private/ (gitignored).
//   pdftotext -layout private/antenaativa.pdf private/antenaativa.txt
//   node scripts/antenaativa/import.ts private/antenaativa.txt
import { readFile, writeFile } from 'node:fs/promises';
import { validateOverlay, type OverlayEntry, type OverlayFile } from '../../src/lib/repeaters/overlay.ts';
import type { AnatelRepeater, AnatelRepeatersFile } from '../../src/lib/repeaters/types.ts';
import { loadMunicipioLookup, normalizeName, type MunicipioLookup } from '../anatel/municipios.ts';
import { toJson } from '../lib/json.ts';
import { SOURCE, standardTone } from '../repeaterbook/import.ts';

export interface ListRow {
  uf: string;
  city: string;
  output: number;
  /** As printed: "88.5Hz", "82,5 Hz", "—", or empty when the table has no tone column. */
  tone: string;
}

const STATES: Record<string, string> = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE', 'distrito federal': 'DF',
  'espirito santo': 'ES', goias: 'GO', maranhao: 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS',
  'minas gerais': 'MG', para: 'PA', paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI',
  'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO', roraima: 'RR',
  'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
};

/** Abbreviations the list uses in town names. */
const ABBREVIATIONS: [RegExp, string][] = [
  [/\bN\.\s*Sra\.\s*/g, 'Nossa Senhora '],
  [/\bSta\.\s*/g, 'Santa '],
  [/\bSto\.\s*/g, 'Santo '],
  [/\bGov\.\s*/g, 'Governador '],
  [/\bPresid\.\s*/g, 'Presidente '],
  [/\bEsp\.\s*/g, 'Espírito '],
  [/\bCorr\.\s*/g, 'Córrego '],
  [/\bG\.\s*/g, 'Grande '],
  [/\bS\.\s*/g, 'São '],
];

export const expandTown = (name: string): string => ABBREVIATIONS.reduce((s, [re, to]) => s.replace(re, to), name.trim());

const ROW = /^\s*(.*?)\s*\b(?:VHF|UHF|OTHER)\s+(\d+\.\d+)\s+(.*)$/;
const HEADER = /^\s*(\S.*?)\s{2,}\d+\s+REPETIDORAS?\b/;
const blank = (s: string | undefined) => !s?.trim();

/**
 * Rows of the list as `pdftotext -layout` prints it: a header per state, then
 * "Town  VHF  146.940  DUP-  600 kHz  FM  67.0Hz". A long town name wraps
 * around its row, on the lines touching it: "Feira de" above, "Santana" below.
 */
export function parseList(text: string, findMunicipio: MunicipioLookup): ListRow[] {
  const lines = text.split('\n');
  const rows: ListRow[] = [];
  let uf = '';
  let pending = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (blank(line)) continue;
    const header = HEADER.exec(line);
    if (header) {
      uf = STATES[normalizeName(header[1]!)] ?? '';
      pending = '';
      continue;
    }
    if (!uf || /CIDADE\s+FREQU/.test(line)) continue;
    const row = ROW.exec(line);
    if (row) {
      const columns = row[3]!.trim().split(/\s{2,}/);
      rows.push({ uf, city: [pending, row[1]].filter(Boolean).join(' '), output: Number(row[2]), tone: columns[3] ?? '' });
      pending = '';
      continue;
    }
    const piece = line.trim();
    const prev = rows.at(-1);
    const touchesPrev = prev && ROW.test(lines[i - 1] ?? '');
    const touchesNext = ROW.test(lines[i + 1] ?? '');
    // Touching both rows: it ends the previous town only if that makes it a real town.
    const endsPrev = touchesPrev && (!touchesNext || (!findMunicipio(expandTown(prev.city), uf) && !!findMunicipio(expandTown(`${prev.city} ${piece}`), uf)));
    if (endsPrev) prev.city += ` ${piece}`;
    else if (touchesNext || !blank(lines[i + 1])) pending = [pending, piece].filter(Boolean).join(' ');
  }
  return rows;
}

/** The single Anatel repeater in the same town on the same output frequency. */
export function findAnatel(row: ListRow, anatel: readonly AnatelRepeater[], findMunicipio: MunicipioLookup): AnatelRepeater | undefined {
  const town = findMunicipio(expandTown(row.city), row.uf);
  if (!town) return undefined;
  const hits = anatel.filter((a) => a.uf === row.uf && Math.abs(a.output - row.output) < 0.0005 && findMunicipio(a.municipio, a.uf)?.ibge === town.ibge);
  return hits.length === 1 ? hits[0] : undefined;
}

export interface ImportResult {
  entries: Record<string, OverlayEntry>;
  counts: { rows: number; withTone: number; matched: number; added: number; keptExisting: number };
}

export function importTones(
  rows: readonly ListRow[],
  anatel: readonly AnatelRepeater[],
  existing: OverlayFile['entries'],
  date: string,
  findMunicipio: MunicipioLookup,
): ImportResult {
  const counts = { rows: rows.length, withTone: 0, matched: 0, added: 0, keptExisting: 0 };
  const tones = new Map<string, Set<number>>();
  for (const row of rows) {
    const tone = standardTone(row.tone.replace(/\s*hz$/i, '').replace(',', '.'));
    if (tone === undefined) continue;
    counts.withTone++;
    const a = findAnatel(row, anatel, findMunicipio);
    if (!a) continue;
    counts.matched++;
    tones.set(a.id, (tones.get(a.id) ?? new Set()).add(tone));
  }
  const entries: Record<string, OverlayEntry> = {};
  for (const [id, set] of tones) {
    const e = existing[id];
    // Rows that disagree with each other cancel out; a tone already there wins.
    if (set.size !== 1) continue;
    if (e && (!e.unverified || e.tone !== undefined || e.dcs !== undefined)) {
      counts.keptExisting++;
      continue;
    }
    entries[id] = { ...(e ?? { source: SOURCE, date, unverified: true }), tone: [...set][0]! };
    counts.added++;
  }
  return { entries, counts };
}

if (import.meta.main) {
  const file = process.argv[2];
  if (!file) throw new Error('usage: node scripts/antenaativa/import.ts private/antenaativa.txt');
  const findMunicipio = await loadMunicipioLookup();
  const rows = parseList(await readFile(file, 'utf8'), findMunicipio);
  if (rows.length < 500) throw new Error(`only ${rows.length} rows: is this the full list?`);
  const anatel = (JSON.parse(await readFile('data/repeaters/anatel.json', 'utf8')) as AnatelRepeatersFile).repeaters;
  const overlayPath = 'data/repeaters/overlay.json';
  const overlay = JSON.parse(await readFile(overlayPath, 'utf8')) as OverlayFile;
  const { entries, counts } = importTones(rows, anatel, overlay.entries, new Date().toISOString().slice(0, 10), findMunicipio);
  const merged = { ...overlay.entries, ...entries };
  const next: OverlayFile = { ...overlay, entries: Object.fromEntries(Object.keys(merged).sort().map((k) => [k, merged[k]!])) };
  const problems = validateOverlay(next, new Set(anatel.map((a) => a.id)));
  if (problems.length) throw new Error(`overlay would be invalid:\n  ${problems.join('\n  ')}`);
  await writeFile(overlayPath, toJson(next));
  console.log(counts);
}
