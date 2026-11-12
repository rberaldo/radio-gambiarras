// Merges an export from the vetting sheet (/repetidoras/conferir) into
// data/repeaters/overlay.json and prints what changed, plus the comments.
// Leaves the overlay untouched when the export or the result is invalid.
//   node scripts/repeaters/apply-checks.ts private/conferencias-2026-11-11.json
import { readFile, writeFile } from 'node:fs/promises';
import { validateOverlay, type OverlayFile } from '../../src/lib/repeaters/overlay.ts';
import type { AnatelRepeatersFile } from '../../src/lib/repeaters/types.ts';
import { applyChecks, validateChecks, type ChecksFile } from '../../src/lib/repeaters/vetting.ts';
import { toJson } from '../lib/json.ts';

const OVERLAY = 'data/repeaters/overlay.json';
const ANATEL = 'data/repeaters/anatel.json';

const path = process.argv[2];
if (!path) {
  console.error('uso: node scripts/repeaters/apply-checks.ts <arquivo de conferências>');
  process.exit(1);
}

const fail = (problems: string[]) => {
  console.error(`Nada aplicado:\n  ${problems.join('\n  ')}`);
  process.exit(1);
};

const checks = JSON.parse(await readFile(path, 'utf8')) as ChecksFile;
const problems = validateChecks(checks);
if (problems.length) fail(problems);

const overlay = JSON.parse(await readFile(OVERLAY, 'utf8')) as OverlayFile;
const anatel = JSON.parse(await readFile(ANATEL, 'utf8')) as AnatelRepeatersFile;
const { file, outcomes } = applyChecks(overlay, checks.checks);
const invalid = validateOverlay(file, new Set(anatel.repeaters.map((r) => r.id)));
if (invalid.length) fail(invalid);

await writeFile(OVERLAY, toJson(file));
for (const o of outcomes) {
  console.log(`${o.id}: ${o.applied.length ? o.applied.join('; ') : 'nada a aplicar'}`);
  if (o.comment) console.log(`  comentário: ${o.comment}`);
}
console.log(`${outcomes.length} conferências lidas de ${path}.`);
