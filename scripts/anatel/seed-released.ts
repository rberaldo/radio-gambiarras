// One-off: seeds the quarantine history from an older list of callsigns in
// use. Callsigns on that list and absent from the current snapshot dropped
// out at some unknown date since, so each may still be in quarantine for up
// to a year after the current data's date.
//
// Used once on 2026-11-09 with the 2025-04-09 snapshot from
// https://github.com/hmagarotto/anatel-indicativo-livre (used.txt).
//
// CLI: node scripts/anatel/seed-released.ts <list.txt> <snapshot-date> <source> [data-dir]
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from '../../src/lib/callsigns/index.ts';
import {
  DEFAULT_DATA_DIR,
  FORMAT_VERSION,
  QUARANTINE_YEARS,
  expandTaken,
  toJson,
  type MetaFile,
  type ReleasedFile,
  type SeededGroup,
  type TakenFile,
} from './callsigns.ts';

export function buildSeed(
  oldList: string,
  now: Set<string>,
  dataDate: string,
  snapshotDate: string,
  source: string,
): SeededGroup {
  const gone = new Set<string>();
  for (const line of oldList.split(/\r?\n/)) {
    const parsed = parse(line);
    if (parsed && !now.has(parsed.callsign)) gone.add(parsed.callsign);
  }
  return {
    source,
    snapshotDate,
    until: `${Number(dataDate.slice(0, 4)) + QUARANTINE_YEARS}${dataDate.slice(4)}`,
    callsigns: [...gone].sort().join(' '),
  };
}

if (import.meta.main) {
  const [listPath, snapshotDate, source, dataDir = DEFAULT_DATA_DIR] = process.argv.slice(2);
  if (!listPath || !snapshotDate || !source) {
    console.error('Usage: node scripts/anatel/seed-released.ts <list.txt> <snapshot-date> <source> [data-dir]');
    process.exit(1);
  }
  const taken = JSON.parse(await readFile(join(dataDir, 'taken.json'), 'utf8')) as TakenFile;
  const meta = JSON.parse(await readFile(join(dataDir, 'meta.json'), 'utf8')) as MetaFile;
  const releasedPath = join(dataDir, 'released.json');
  const released = JSON.parse(await readFile(releasedPath, 'utf8')) as ReleasedFile;

  const dataDate = meta.newestLicensing ?? meta.updatedAt;
  const seeded = buildSeed(await readFile(listPath, 'utf8'), expandTaken(taken), dataDate, snapshotDate, source);
  await writeFile(releasedPath, toJson({ format: FORMAT_VERSION, released: released.released, seeded }));
  console.log(`seeded ${seeded.callsigns.split(' ').filter(Boolean).length} callsigns, until ${seeded.until}`);
}
