// Reduces Anatel's amateur-station CSV to the callsigns in use and their
// status. Only the callsign, the license status and the licensing date are
// read; names, CPF/CNPJ, Fistel numbers and cities never leave this script.
//
// CLI: node scripts/anatel/callsigns.ts [csv] [data-dir]
// Writes data-dir/taken.json and meta.json only when the callsigns changed,
// and released.json (callsigns that disappeared) when that history changed.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from '../../src/lib/callsigns/index.ts';
import {
  FORMAT_VERSION,
  expandTaken,
  type MetaFile,
  type ReleasedFile,
  type SeededGroup,
  type TakenFile,
} from '../../src/lib/callsigns/data.ts';
import { brDateToIso, parseDelimited } from '../lib/csv.ts';
import { DEFAULT_OUT as DEFAULT_CSV } from './fetch.ts';

export const DEFAULT_DATA_DIR = 'data/callsigns';

export const EXPECTED_HEADER = [
  'Tipo de Identificação',
  'CNPJ ou CPF',
  'Nome da Entidade',
  'Fistel do Serviço da Estação',
  'Serviço',
  'Indicativo',
  'Número da Estação',
  'UF da Entidade',
  'COER',
  'Nome da Estação',
  'Tipo de Estação',
  'Frequências de Operação da Estação',
  'Município da Estação',
  'UF da Estação',
  'Data do Primeiro Licenciamento',
  'Data do Último Licenciamento',
  'Data de Validade da Estação',
  'Status da Validade',
] as const;

/** Fail rather than publish when the row count drops more than this. */
export const MAX_ROW_DROP = 0.2;

export { FORMAT_VERSION, expandTaken, type MetaFile, type ReleasedFile, type SeededGroup, type TakenFile };

export interface Reduction {
  taken: TakenFile;
  counts: MetaFile['counts'];
  newestLicensing?: string;
  rejected: string[];
}

type Status = 'active' | 'expired';

export function reduce(csvText: string): Reduction {
  const [header, ...rows] = parseDelimited(csvText, ';');
  const got = (header ?? []).map((h) => h.trim());
  if (got.length !== EXPECTED_HEADER.length || got.some((h, i) => h !== EXPECTED_HEADER[i])) {
    throw new Error(`unexpected header:\n  got      ${got.join(' | ')}\n  expected ${EXPECTED_HEADER.join(' | ')}`);
  }
  const col = (name: (typeof EXPECTED_HEADER)[number]) => EXPECTED_HEADER.indexOf(name);
  const iCall = col('Indicativo');
  const iStatus = col('Status da Validade');
  const iLicensed = col('Data do Último Licenciamento');

  const statuses = new Map<string, Status>();
  const rejected: string[] = [];
  let newestLicensing: string | undefined;

  for (const row of rows) {
    if (row.length !== EXPECTED_HEADER.length) {
      rejected.push(`(row with ${row.length} columns)`);
      continue;
    }
    const parsed = parse(row[iCall]!);
    if (!parsed) {
      rejected.push(row[iCall]!);
      continue;
    }
    const status: Status = row[iStatus]!.trim() === 'Vencida' ? 'expired' : 'active';
    if (statuses.get(parsed.callsign) !== 'active') statuses.set(parsed.callsign, status);

    const licensed = brDateToIso(row[iLicensed]!);
    if (licensed && (!newestLicensing || licensed > newestLicensing)) newestLicensing = licensed;
  }

  const groups: Record<Status, Map<string, string[]>> = { active: new Map(), expired: new Map() };
  for (const [callsign, status] of statuses) {
    const { prefix, suffix } = parse(callsign)!;
    const list = groups[status].get(prefix) ?? [];
    list.push(suffix);
    groups[status].set(prefix, list);
  }
  const serialize = (m: Map<string, string[]>) =>
    Object.fromEntries([...m].sort(([a], [b]) => a.localeCompare(b)).map(([p, s]) => [p, s.sort().join(' ')]));

  const active = [...statuses.values()].filter((s) => s === 'active').length;
  return {
    taken: { format: FORMAT_VERSION, active: serialize(groups.active), expired: serialize(groups.expired) },
    counts: { rows: rows.length, callsigns: statuses.size, active, expired: statuses.size - active, rejected: rejected.length },
    newestLicensing,
    rejected,
  };
}

/** Stable serialization, so identical data gives identical bytes. */
export const toJson = (value: unknown) => `${JSON.stringify(value, null, 1)}\n`;

async function readJson<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw err;
  }
}

export interface UpdateResult {
  changed: boolean;
  reduction: Reduction;
}

/** Writes taken.json and meta.json when the callsigns changed; guards against bad downloads. */
export async function updateCallsigns(csvText: string, dataDir: string, today: string): Promise<UpdateResult> {
  const reduction = reduce(csvText);
  const prevMeta = await readJson<MetaFile>(join(dataDir, 'meta.json'));
  if (prevMeta && reduction.counts.rows < prevMeta.counts.rows * (1 - MAX_ROW_DROP)) {
    throw new Error(
      `row count fell from ${prevMeta.counts.rows} to ${reduction.counts.rows}; refusing to publish. ` +
        'If this is real, delete data/callsigns/meta.json and run again.',
    );
  }

  const takenPath = join(dataDir, 'taken.json');
  const releasedPath = join(dataDir, 'released.json');
  const oldTaken = await readJson<TakenFile>(takenPath);
  const oldReleased = await readJson<ReleasedFile>(releasedPath);

  const newTakenJson = toJson(reduction.taken);
  const takenChanged = !oldTaken || toJson(oldTaken) !== newTakenJson;

  // With no previous snapshot there is nothing to compare against, so the
  // history starts empty.
  const released = updateReleased(
    oldTaken ? expandTaken(oldTaken) : undefined,
    expandTaken(reduction.taken),
    oldReleased?.released ?? {},
    today,
  );
  const seeded = oldReleased?.seeded && updateSeeded(oldReleased.seeded, expandTaken(reduction.taken), today);
  const newReleasedJson = toJson({
    format: FORMAT_VERSION,
    released,
    ...(seeded ? { seeded } : {}),
  } satisfies ReleasedFile);
  const releasedChanged = !oldReleased || toJson(oldReleased) !== newReleasedJson;

  if (!takenChanged && !releasedChanged) return { changed: false, reduction };

  await mkdir(dataDir, { recursive: true });
  if (releasedChanged) await writeFile(releasedPath, newReleasedJson);
  if (takenChanged) {
    const meta: MetaFile = {
      source: 'Anatel, dados abertos: Estações licenciadas do Serviço de Radioamador',
      sourceUrl: 'https://www.anatel.gov.br/dadosabertos/paineis_de_dados/outorga_e_licenciamento/estacoes_licenciadas.zip',
      updatedAt: today,
      newestLicensing: reduction.newestLicensing,
      counts: reduction.counts,
    };
    await writeFile(takenPath, newTakenJson);
    await writeFile(join(dataDir, 'meta.json'), toJson(meta));
  }
  return { changed: true, reduction };
}

/** Drops seeded callsigns that are taken again, and the whole group once it expires. */
export function updateSeeded(group: SeededGroup, now: Set<string>, today: string): SeededGroup | undefined {
  if (today >= group.until) return undefined;
  const callsigns = group.callsigns.split(' ').filter((cs) => cs && !now.has(cs));
  return { ...group, callsigns: callsigns.join(' ') };
}

/** How long a released callsign stays in the history. */
export const QUARANTINE_YEARS = 1;

const addYears = (isoDate: string, years: number) => `${Number(isoDate.slice(0, 4)) + years}${isoDate.slice(4)}`;

/**
 * Adds callsigns that were taken before and are gone now, drops those that
 * came back, and drops those released more than a year ago.
 */
export function updateReleased(
  before: Set<string> | undefined,
  now: Set<string>,
  released: Record<string, string>,
  today: string,
): Record<string, string> {
  const next = new Map(Object.entries(released));
  if (before) for (const cs of before) if (!now.has(cs) && !next.has(cs)) next.set(cs, today);
  for (const [cs, date] of next) {
    if (now.has(cs) || addYears(date, QUARANTINE_YEARS) <= today) next.delete(cs);
  }
  return Object.fromEntries([...next].sort(([a], [b]) => a.localeCompare(b)));
}

if (import.meta.main) {
  const csvPath = process.argv[2] ?? DEFAULT_CSV;
  const dataDir = process.argv[3] ?? DEFAULT_DATA_DIR;
  const today = new Date().toISOString().slice(0, 10);
  const { changed, reduction } = await updateCallsigns(await readFile(csvPath, 'utf8'), dataDir, today);
  const c = reduction.counts;
  console.log(`rows ${c.rows}, callsigns ${c.callsigns} (${c.active} active, ${c.expired} expired), rejected ${c.rejected}`);
  console.log(`newest licensing date: ${reduction.newestLicensing ?? 'none'}`);
  if (reduction.rejected.length) console.log(`rejected values: ${reduction.rejected.join(', ')}`);
  console.log(changed ? `data changed; wrote ${dataDir}` : 'data unchanged; nothing written');
}
