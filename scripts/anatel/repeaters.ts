// Reduces Anatel's amateur-station CSV to the licensed 2 m and 70 cm
// repeaters: callsign, frequencies, município, UF and license status. No
// names or documents are read.
//
// CLI: node scripts/anatel/repeaters.ts [csv] [data-dir]
// Writes data-dir/anatel.json and meta.json only when the repeaters changed,
// and changes.json (repeaters added and removed, with dates) when that
// history changed. Run after fetch.ts; the daily job does both.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from '../../src/lib/callsigns/index.ts';
import {
  bandOf,
  repeaterId,
  type AnatelRepeater,
  type AnatelRepeatersFile,
  type Band,
  type LicenseStatus,
} from '../../src/lib/repeaters/types.ts';
import { brDateToIso } from '../lib/csv.ts';
import { olderThanYears, readJson, toJson } from '../lib/json.ts';
import { DEFAULT_OUT as DEFAULT_CSV } from './fetch.ts';
import { parseFrequencyField } from './frequencies.ts';
import { readStations } from './stations.ts';

export const DEFAULT_DATA_DIR = 'data/repeaters';
export const FORMAT_VERSION = 1;
/** Fail rather than publish when the number of repeater rows drops more than this. */
export const MAX_ROW_DROP = 0.2;
/** How long added and removed repeaters stay in changes.json. */
export const CHANGES_YEARS = 1;

export interface RepeatersMeta {
  source: string;
  sourceUrl: string;
  /** Date the published repeaters last changed. */
  updatedAt: string;
  counts: {
    /** Rows of type "Repetidora" in Anatel's file. */
    rows: number;
    repeaters: number;
    byBand: Record<Band, number>;
    /** Pairs on other bands (10 m, 1.25 m, 23 cm...), left out on purpose. */
    otherBands: number;
    /** Values that could not be used, logged by the job. */
    rejected: number;
  };
}

export interface ChangesFile {
  format: number;
  /** Repeater id → date we first saw it. */
  added: Record<string, string>;
  /** Repeater id → date we saw it disappear. */
  removed: Record<string, string>;
}

export interface Reduction {
  repeaters: AnatelRepeater[];
  counts: RepeatersMeta['counts'];
  rejected: string[];
}

const STATUS_RANK: Record<LicenseStatus, number> = { ativa: 0, 'sem-data': 1, vencida: 2 };

function licenseStatus(value: string): LicenseStatus {
  const v = value.trim();
  if (v === 'Ativa') return 'ativa';
  if (v === 'Vencida') return 'vencida';
  return 'sem-data';
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function reduceRepeaters(csvText: string): Reduction {
  const { rows, col } = readStations(csvText);
  const iType = col('Tipo de Estação');
  const iCall = col('Indicativo');
  const iFreq = col('Frequências de Operação da Estação');
  const iCity = col('Município da Estação');
  const iUf = col('UF da Estação');
  const iValid = col('Data de Validade da Estação');
  const iStatus = col('Status da Validade');

  const byId = new Map<string, AnatelRepeater>();
  const rejected: string[] = [];
  let repeaterRows = 0;
  let otherBands = 0;

  for (const row of rows) {
    if (row[iType]!.trim() !== 'Repetidora') continue;
    repeaterRows++;
    const callsign = parse(row[iCall]!)?.callsign;
    if (!callsign) {
      rejected.push(`indicativo inválido: ${row[iCall]}`);
      continue;
    }
    const { pairs, rejected: unreadable } = parseFrequencyField(row[iFreq]!);
    for (const piece of unreadable) rejected.push(`${callsign}: frequência ilegível "${piece}"`);
    if (pairs.length === 0 && unreadable.length === 0) rejected.push(`${callsign}: sem frequência (${row[iFreq]})`);

    for (const pair of pairs) {
      const band = bandOf(pair.output);
      if (!band) {
        // Real repeaters on other bands are expected; tiny numbers are junk ("0,147").
        if (pair.output >= 1) otherBands++;
        else rejected.push(`${callsign}: frequência sem sentido ${pair.output} / ${pair.input} MHz`);
        continue;
      }
      if (bandOf(pair.input) !== band) {
        rejected.push(`${callsign}: entrada ${pair.input} MHz fora da faixa de ${pair.output} MHz`);
        continue;
      }
      const output = round3(pair.output);
      const repeater: AnatelRepeater = {
        id: repeaterId(callsign, output),
        callsign,
        band,
        output,
        input: round3(pair.input),
        municipio: row[iCity]!.trim(),
        uf: row[iUf]!.trim().toUpperCase(),
        status: licenseStatus(row[iStatus]!),
      };
      const validUntil = brDateToIso(row[iValid]!);
      if (validUntil) repeater.validUntil = validUntil;

      // The same repeater can appear on several license rows: keep the best status.
      const known = byId.get(repeater.id);
      if (!known || STATUS_RANK[repeater.status] < STATUS_RANK[known.status]) byId.set(repeater.id, repeater);
    }
  }

  const repeaters = [...byId.values()].sort(
    (a, b) =>
      a.uf.localeCompare(b.uf) ||
      a.municipio.localeCompare(b.municipio, 'pt-BR') ||
      a.callsign.localeCompare(b.callsign) ||
      a.output - b.output,
  );
  const byBand: Record<Band, number> = { '2m': 0, '70cm': 0 };
  for (const r of repeaters) byBand[r.band]++;

  return {
    repeaters,
    counts: { rows: repeaterRows, repeaters: repeaters.length, byBand, otherBands, rejected: rejected.length },
    rejected,
  };
}

/** Records repeaters that appeared or disappeared, and forgets old entries. */
export function updateChanges(
  before: Set<string> | undefined,
  now: Set<string>,
  changes: ChangesFile,
  today: string,
): ChangesFile {
  const added = new Map(Object.entries(changes.added));
  const removed = new Map(Object.entries(changes.removed));
  if (before) {
    for (const id of now) if (!before.has(id)) {
      added.set(id, today);
      removed.delete(id);
    }
    for (const id of before) if (!now.has(id)) {
      removed.set(id, today);
      added.delete(id);
    }
  }
  const fresh = (m: Map<string, string>) =>
    Object.fromEntries([...m].filter(([, date]) => !olderThanYears(date, CHANGES_YEARS, today)).sort(([a], [b]) => a.localeCompare(b)));
  return { format: FORMAT_VERSION, added: fresh(added), removed: fresh(removed) };
}

export interface UpdateResult {
  changed: boolean;
  reduction: Reduction;
}

export async function updateRepeaters(csvText: string, dataDir: string, today: string): Promise<UpdateResult> {
  const reduction = reduceRepeaters(csvText);
  const metaPath = join(dataDir, 'meta.json');
  const dataPath = join(dataDir, 'anatel.json');
  const changesPath = join(dataDir, 'changes.json');

  const prevMeta = await readJson<RepeatersMeta>(metaPath);
  if (prevMeta && reduction.counts.rows < prevMeta.counts.rows * (1 - MAX_ROW_DROP)) {
    throw new Error(
      `repeater rows fell from ${prevMeta.counts.rows} to ${reduction.counts.rows}; refusing to publish. ` +
        `If this is real, delete ${metaPath} and run again.`,
    );
  }

  const file: AnatelRepeatersFile = { format: FORMAT_VERSION, repeaters: reduction.repeaters };
  const newData = toJson(file);
  const oldFile = await readJson<AnatelRepeatersFile>(dataPath);
  const dataChanged = !oldFile || toJson(oldFile) !== newData;

  const oldChanges = await readJson<ChangesFile>(changesPath);
  const changes = updateChanges(
    oldFile ? new Set(oldFile.repeaters.map((r) => r.id)) : undefined,
    new Set(reduction.repeaters.map((r) => r.id)),
    oldChanges ?? { format: FORMAT_VERSION, added: {}, removed: {} },
    today,
  );
  const newChanges = toJson(changes);
  const changesChanged = !oldChanges || toJson(oldChanges) !== newChanges;

  if (!dataChanged && !changesChanged) return { changed: false, reduction };

  await mkdir(dataDir, { recursive: true });
  if (changesChanged) await writeFile(changesPath, newChanges);
  if (dataChanged) {
    const meta: RepeatersMeta = {
      source: 'Anatel, dados abertos: Estações licenciadas do Serviço de Radioamador',
      sourceUrl: 'https://www.anatel.gov.br/dadosabertos/paineis_de_dados/outorga_e_licenciamento/estacoes_licenciadas.zip',
      updatedAt: today,
      counts: reduction.counts,
    };
    await writeFile(dataPath, newData);
    await writeFile(metaPath, toJson(meta));
  }
  return { changed: true, reduction };
}

if (import.meta.main) {
  const csvPath = process.argv[2] ?? DEFAULT_CSV;
  const dataDir = process.argv[3] ?? DEFAULT_DATA_DIR;
  const today = new Date().toISOString().slice(0, 10);
  const { changed, reduction } = await updateRepeaters(await readFile(csvPath, 'utf8'), dataDir, today);
  const c = reduction.counts;
  console.log(
    `repeater rows ${c.rows}; repeaters ${c.repeaters} (2 m ${c.byBand['2m']}, 70 cm ${c.byBand['70cm']}); ` +
      `other bands ${c.otherBands}; rejected ${c.rejected}`,
  );
  if (reduction.rejected.length) console.log(`rejected:\n  ${reduction.rejected.join('\n  ')}`);
  console.log(changed ? `data changed; wrote ${dataDir}` : 'data unchanged; nothing written');
}
