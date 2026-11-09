// Applies an approved correction issue to data/repeaters/overlay.json.
// Run by .github/workflows/correcoes.yml; the issue arrives in environment
// variables (never interpolated into shell code). Writes a Markdown reply for
// the issue to RESULT_FILE and the repeater id to GITHUB_OUTPUT. Exits 1,
// leaving the overlay untouched, when the issue cannot be applied.
//   ISSUE_BODY=... ISSUE_NUMBER=12 ISSUE_AUTHOR=login RESULT_FILE=out.md node scripts/repeaters/apply-issue.ts
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { validateOverlay, type OverlayFile } from '../../src/lib/repeaters/overlay.ts';
import type { AnatelRepeatersFile } from '../../src/lib/repeaters/types.ts';
import { toJson } from '../lib/json.ts';
import { applyCorrection, correctionFromIssue, parseIssueBody } from './issue.ts';

const OVERLAY = 'data/repeaters/overlay.json';
const ANATEL = 'data/repeaters/anatel.json';

const { ISSUE_BODY = '', ISSUE_NUMBER = '0', ISSUE_AUTHOR = '', RESULT_FILE, GITHUB_OUTPUT } = process.env;

async function reply(text: string) {
  console.log(text);
  if (RESULT_FILE) await writeFile(RESULT_FILE, `${text}\n`);
}

const failure = (problems: string[]) =>
  [
    'Não consegui aplicar esta correção:',
    '',
    ...problems.map((p) => `- ${p}`),
    '',
    'Edite a issue para corrigir e adicione o rótulo `aprovada` de novo.',
  ].join('\n');

const parsed = correctionFromIssue(parseIssueBody(ISSUE_BODY), {
  author: ISSUE_AUTHOR,
  number: Number(ISSUE_NUMBER),
  date: new Date().toISOString().slice(0, 10),
});
if (!parsed.ok) {
  await reply(failure(parsed.problems));
  process.exit(1);
}

const overlay = JSON.parse(await readFile(OVERLAY, 'utf8')) as OverlayFile;
const anatel = JSON.parse(await readFile(ANATEL, 'utf8')) as AnatelRepeatersFile;
const next = applyCorrection(overlay, parsed.id, parsed.entry);
const problems = validateOverlay(next, new Set(anatel.repeaters.map((r) => r.id)));
if (problems.length) {
  await reply(failure(problems));
  process.exit(1);
}

await writeFile(OVERLAY, toJson(next));
if (GITHUB_OUTPUT) await appendFile(GITHUB_OUTPUT, `id=${parsed.id}\n`);
await reply(
  [
    `Aplicada em \`${OVERLAY}\`. O mapa mostra a correção depois da próxima publicação do site, em poucos minutos. Obrigado!`,
    '',
    '```json',
    JSON.stringify({ [parsed.id]: next.entries[parsed.id] }, null, 2),
    '```',
  ].join('\n'),
);
