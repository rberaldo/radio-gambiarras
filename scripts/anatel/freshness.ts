// Warns when Anatel's data looks frozen: the newest licensing date in the
// published snapshot is older than a threshold. In GitHub Actions the
// warning becomes an annotation on the run.
//
// CLI: node scripts/anatel/freshness.ts [data-dir] [max-age-days]
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DEFAULT_DATA_DIR, type MetaFile } from './callsigns.ts';

export const DEFAULT_MAX_AGE_DAYS = 14;

/** Days between two ISO dates (yyyy-mm-dd). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function freshnessWarning(meta: MetaFile, today: string, maxAgeDays = DEFAULT_MAX_AGE_DAYS): string | undefined {
  if (!meta.newestLicensing) return 'Anatel data has no licensing dates; check the source.';
  const age = daysBetween(meta.newestLicensing, today);
  if (age <= maxAgeDays) return undefined;
  return (
    `Newest licensing date in Anatel's data is ${meta.newestLicensing}, ${age} days ago. ` +
    'The upstream file may be frozen; recently assigned callsigns can show as free.'
  );
}

if (import.meta.main) {
  const dataDir = process.argv[2] ?? DEFAULT_DATA_DIR;
  const maxAge = Number(process.argv[3] ?? DEFAULT_MAX_AGE_DAYS);
  const meta = JSON.parse(await readFile(join(dataDir, 'meta.json'), 'utf8')) as MetaFile;
  const warning = freshnessWarning(meta, new Date().toISOString().slice(0, 10), maxAge);
  if (warning) console.log(process.env.GITHUB_ACTIONS ? `::warning title=Dados da Anatel parados::${warning}` : warning);
  else console.log(`Anatel data is fresh (newest licensing date ${meta.newestLicensing}).`);
}
