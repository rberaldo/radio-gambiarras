// One-off bootstrap of the overlay from the maintainer's own RepeaterBook
// CSV exports (decided with the user on 2026-11-09). Takes only what the
// public submitted there: CTCSS tone, modes, and the site name as a note,
// and only for repeaters Anatel lists (same callsign and output frequency).
// Unmatched rows are ignored. Entries a person already corrected are never
// touched. New entries are marked `unverified` for a later manual check.
// The CSVs stay in private/ (gitignored) and are never committed.
//   node scripts/repeaterbook/import.ts private/RB_*.csv
import { readFile, writeFile } from 'node:fs/promises';
import { CTCSS_TONES, validateOverlay, type Mode, type OverlayEntry, type OverlayFile } from '../../src/lib/repeaters/overlay.ts';
import type { AnatelRepeater, AnatelRepeatersFile } from '../../src/lib/repeaters/types.ts';
import { distanceKm } from '../../src/lib/repeaters/geo.ts';
import { loadMunicipioLookup } from '../anatel/municipios.ts';
import { parseDelimited } from '../lib/csv.ts';
import { toJson } from '../lib/json.ts';

/** A town RepeaterBook names instead of Anatel's is kept as a note only within this distance. */
const NEAR_TOWN_KM = 60;

export const SOURCE = 'Importação inicial de 2026-11-09 (a conferir)';

export interface RbRow {
  output: number;
  input: number;
  tone: string;
  callsign: string;
  location: string;
  modes: string;
}

const HTML_ENTITIES: Record<string, string> = { '&amp;': '&', '&#039;': "'", '&quot;': '"', '&lt;': '<', '&gt;': '>' };
/** RepeaterBook double-escapes some text ("D&amp;#039;água"). */
function unescape(s: string): string {
  let out = s;
  for (let i = 0; i < 2; i++) out = out.replace(/&(amp|#039|quot|lt|gt);/g, (m) => HTML_ENTITIES[m] ?? m);
  return out;
}

export function readRows(csv: string): RbRow[] {
  const [header, ...rows] = parseDelimited(csv.replace(/^﻿/, ''), ',');
  const col = (name: string) => {
    const i = header!.indexOf(name);
    if (i < 0) throw new Error(`RepeaterBook CSV without column "${name}"`);
    return i;
  };
  const c = { out: col('Output Freq'), inp: col('Input Freq'), tone: col('Uplink Tone'), call: col('Call'), loc: col('Location'), modes: col('Modes') };
  return rows
    .filter((r) => r.length >= header!.length)
    .map((r) => ({
      output: Number(r[c.out]),
      input: Number(r[c.inp]),
      tone: r[c.tone]!.trim(),
      callsign: r[c.call]!.trim().toUpperCase(),
      location: unescape(r[c.loc]!).replace(/\s+/g, ' ').trim(),
      modes: r[c.modes]!.trim(),
    }));
}

/** A standard CTCSS tone from what was typed ("88.5", "74" → 74.4), or undefined (blank, 1750 Hz burst). */
export function standardTone(raw: string): number | undefined {
  const hz = Number(raw);
  if (!raw || !Number.isFinite(hz)) return undefined;
  const nearest = CTCSS_TONES.reduce((a, b) => (Math.abs(b - hz) < Math.abs(a - hz) ? b : a));
  return Math.abs(nearest - hz) <= 0.6 ? nearest : undefined;
}

const MODE_MAP: Record<string, Mode> = { FM: 'FM', DMR: 'DMR', DSTAR: 'D-STAR', 'D-STAR': 'D-STAR', FUSION: 'Fusion', YSF: 'Fusion', NXDN: 'NXDN', P25: 'P25', M17: 'M17' };
const LINKS: Record<string, string> = { ECHOLINK: 'EchoLink', IRLP: 'IRLP', ALLSTAR: 'AllStar', WIRES: 'WIRES-X' };

export function readModes(raw: string): { modes: Mode[]; links: string[] } {
  const modes = new Set<Mode>();
  const links: string[] = [];
  for (const token of raw.toUpperCase().split(/[\s,/]+/).filter(Boolean)) {
    if (MODE_MAP[token]) modes.add(MODE_MAP[token]);
    else if (LINKS[token]) links.push(LINKS[token]);
  }
  // A linked node with no mode listed is an FM repeater.
  if (modes.size === 0 && links.length) modes.add('FM');
  return { modes: [...modes], links };
}

/** Site names that are English, truncated or not a place: cleaned by hand. "" drops it. */
const SITE_FIXES: Record<string, string> = {
  'Top of Water Tank': "Caixa d'água",
  Mountain: '',
  'Itatiaia Mount': 'Morro Itatiaia',
  'Harmonia Lake': 'Lago Harmonia',
  Building: '',
  Towell: '',
  'Pátio da': '',
  'Bairro nova lima 695m': 'Bairro Nova Lima, 695 m',
  'headquarter-Carrao Metro': 'metrô Carrão',
  'Cambuí - in front of Riviera Bakery': 'Cambuí',
  'BARREIRO - VINHEDO LOUVEIRA': 'Barreiro',
};

/** States written where the site should be ("Campinas - São Paulo", "Artur Nogueira - SP"). */
const STATE_NAMES = /^([A-Z]{2}|São Paulo|Santa Catarina|Rio de Janeiro|Minas Gerais|Paraná|Bahia)$/i;

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(de|do|da|dos|das)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** "PICO DO IBITURUNA" → "Pico do Ibituruna"; short acronyms (LABRE) stay. */
function tidyCase(s: string): string {
  if (s !== s.toUpperCase() || !/\s/.test(s)) return s;
  return s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, sp: string, ch: string) => sp + ch.toUpperCase()).replace(/\b(Do|Da|De|Dos|Das)\b/g, (w) => w.toLowerCase());
}

/**
 * The note for where the repeater is: "Local: Pico Caratuva", or the town
 * RepeaterBook gives when it differs from Anatel's ("Local: Mariana").
 */
export function siteNote(location: string, municipio: string, isNearTown: (town: string) => boolean = () => true): string | undefined {
  const [town = '', ...rest] = location.split(' - ');
  let site = rest.join(' - ').trim();
  if (site in SITE_FIXES) site = SITE_FIXES[site]!;
  if (STATE_NAMES.test(site)) site = '';
  site = tidyCase(site);
  // Another town only helps when it is a neighbour; a far one is more likely a mistake.
  const otherTown = fold(town) && fold(town) !== fold(municipio) && isNearTown(town.trim()) ? tidyCase(town.trim()) : '';
  const parts = [otherTown, site].filter(Boolean);
  return parts.length ? `Local: ${parts.join(', ')}` : undefined;
}

/** The Anatel repeater a row describes: same callsign, output within half a 25 kHz channel. */
function findAnatel(row: RbRow, byCallsign: Map<string, AnatelRepeater[]>): AnatelRepeater | undefined {
  const candidates = (byCallsign.get(row.callsign) ?? []).filter((a) => Math.abs(a.output - row.output) < 0.0126);
  return candidates.sort((a, b) => Math.abs(a.output - row.output) - Math.abs(b.output - row.output))[0];
}

export interface ImportResult {
  entries: Record<string, OverlayEntry>;
  counts: { rows: number; matched: number; added: number; skippedCorrected: number; conflictingTones: number };
}

/** Overlay entries for the rows that match Anatel and carry something useful. */
export function importRows(
  rows: readonly RbRow[],
  anatel: readonly AnatelRepeater[],
  existing: OverlayFile['entries'],
  date: string,
  /** Whether a town RepeaterBook names is close to Anatel's município for this repeater. */
  nearTown: (town: string, a: AnatelRepeater) => boolean = () => true,
): ImportResult {
  const byCallsign = new Map<string, AnatelRepeater[]>();
  for (const a of anatel) byCallsign.set(a.callsign, [...(byCallsign.get(a.callsign) ?? []), a]);

  // Rows for the same repeater are combined; disagreeing tones cancel out.
  const grouped = new Map<string, { anatel: AnatelRepeater; rows: RbRow[] }>();
  for (const row of rows) {
    const a = findAnatel(row, byCallsign);
    if (!a) continue;
    grouped.set(a.id, { anatel: a, rows: [...(grouped.get(a.id)?.rows ?? []), row] });
  }

  const counts = { rows: rows.length, matched: grouped.size, added: 0, skippedCorrected: 0, conflictingTones: 0 };
  const entries: Record<string, OverlayEntry> = {};
  for (const [id, { anatel: a, rows: rs }] of grouped) {
    if (existing[id] && !existing[id].unverified) {
      counts.skippedCorrected++;
      continue;
    }
    const tones = new Set(rs.map((r) => standardTone(r.tone)).filter((t): t is number => t !== undefined));
    if (tones.size > 1) counts.conflictingTones++;
    const modes = new Set<Mode>();
    const links = new Set<string>();
    for (const r of rs) {
      const m = readModes(r.modes);
      m.modes.forEach((x) => modes.add(x));
      m.links.forEach((x) => links.add(x));
    }
    const notes = [...new Set(rs.map((r) => siteNote(r.location, a.municipio, (town) => nearTown(town, a))).filter(Boolean))];
    if (links.size) notes.push(`Ligada a ${[...links].join(', ')}.`);

    const entry: OverlayEntry = { source: SOURCE, date, unverified: true };
    if (tones.size === 1) entry.tone = [...tones][0]!;
    // Plain "FM" is RepeaterBook's default; keep modes only when they say more.
    const onlyFm = modes.size === 1 && modes.has('FM');
    if (modes.size && (!onlyFm || entry.tone !== undefined || notes.length)) entry.modes = [...modes];
    if (notes.length) entry.notes = notes.map((n) => (n!.endsWith('.') ? n : `${n}.`)).join(' ');

    if (entry.tone === undefined && !entry.notes && (!entry.modes || onlyFm)) continue;
    entries[id] = entry;
    counts.added++;
  }
  return { entries, counts };
}

if (import.meta.main) {
  const files = process.argv.slice(2);
  if (!files.length) throw new Error('usage: node scripts/repeaterbook/import.ts private/RB_*.csv');
  const rows = (await Promise.all(files.map((f) => readFile(f, 'utf8')))).flatMap(readRows);
  const anatel = (JSON.parse(await readFile('data/repeaters/anatel.json', 'utf8')) as AnatelRepeatersFile).repeaters;
  const overlayPath = 'data/repeaters/overlay.json';
  const overlay = JSON.parse(await readFile(overlayPath, 'utf8')) as OverlayFile;
  const findMunicipio = await loadMunicipioLookup();
  const nearTown = (town: string, a: AnatelRepeater) => {
    const m = findMunicipio(town, a.uf);
    return !!m && a.lat !== undefined && a.lon !== undefined && distanceKm(m, { lat: a.lat, lon: a.lon }) <= NEAR_TOWN_KM;
  };
  const { entries, counts } = importRows(rows, anatel, overlay.entries, new Date().toISOString().slice(0, 10), nearTown);
  const merged = { ...overlay.entries, ...entries };
  const next: OverlayFile = { ...overlay, entries: Object.fromEntries(Object.keys(merged).sort().map((k) => [k, merged[k]!])) };
  const problems = validateOverlay(next, new Set(anatel.map((a) => a.id)));
  if (problems.length) throw new Error(`overlay would be invalid:\n  ${problems.join('\n  ')}`);
  await writeFile(overlayPath, toJson(next));
  console.log(counts);
}
