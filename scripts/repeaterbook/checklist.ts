// Writes private/conferir.md: every overlay entry still marked `unverified`,
// grouped by state and town, with what to check and a link to it on the map.
// Regenerate it as entries get confirmed (an approved correction clears the
// flag). The file stays in private/ (gitignored).
//   node scripts/repeaterbook/checklist.ts
import { readFile, writeFile } from 'node:fs/promises';
import { formatMHz, formatShift, toneText } from '../../src/lib/repeaters/display.ts';
import type { OverlayEntry, OverlayFile } from '../../src/lib/repeaters/overlay.ts';
import type { AnatelRepeater, AnatelRepeatersFile } from '../../src/lib/repeaters/types.ts';

const SITE = 'https://radio-gambiarras.netlify.app';
const OUT = 'private/conferir.md';

function positionText(e: OverlayEntry): string {
  if (e.lat === undefined) return 'posição: sede do município';
  if (e.source.includes('GPX')) return `posição provável (GPX): ${e.lat}, ${e.lon}`;
  if (e.source.includes('OpenStreetMap')) return `posição provável (nome do local): ${e.lat}, ${e.lon}`;
  return `posição: ${e.lat}, ${e.lon}`;
}

export function checklistLine(id: string, e: OverlayEntry, a: AnatelRepeater): string {
  const lat = e.lat ?? a.lat;
  const lon = e.lon ?? a.lon;
  const link = lat !== undefined && lon !== undefined ? `${SITE}/repetidoras?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&raio=30&rep=${encodeURIComponent(id)}` : '';
  const digitalOnly = e.modes && !e.modes.includes('FM');
  const facts = [
    `subtom ${toneText(e)}`,
    e.modes ? `modos ${e.modes.join(', ')}${digitalOnly ? ' (só digital, oculta no mapa)' : ''}` : '',
    positionText(e),
    e.notes ?? '',
  ].filter(Boolean);
  const head = `**${a.callsign} ${formatMHz(a.output)}** (${formatShift(a.input - a.output)})`;
  return `- [ ] ${head}: ${facts.join(' · ')}${link ? ` · [mapa](${link})` : ''}`;
}

if (import.meta.main) {
  const anatel = (JSON.parse(await readFile('data/repeaters/anatel.json', 'utf8')) as AnatelRepeatersFile).repeaters;
  const byId = new Map(anatel.map((a) => [a.id, a]));
  const overlay = JSON.parse(await readFile('data/repeaters/overlay.json', 'utf8')) as OverlayFile;
  const rows = Object.entries(overlay.entries)
    .filter(([, e]) => e.unverified)
    .map(([id, e]) => ({ id, e, a: byId.get(id)! }))
    .filter((r) => r.a)
    .sort((x, y) => x.a.uf.localeCompare(y.a.uf) || x.a.municipio.localeCompare(y.a.municipio, 'pt') || x.a.output - y.a.output);

  const lines = [
    '# Repetidoras a conferir',
    '',
    `${rows.length} entradas da importação inicial ainda não conferidas. Gerado em ${new Date().toISOString().slice(0, 10)} por \`node scripts/repeaterbook/checklist.ts\`.`,
    '',
    'Para cada uma: confirme o subtom (no ar ou com quem mantém), os modos e o local da antena.',
    'Para registrar: use "Sugerir correção" no mapa e aprove a issue (o rótulo `aprovada` tira a marca de não conferida),',
    'ou edite `data/repeaters/overlay.json` à mão e apague `"unverified": true`. Depois gere esta lista de novo.',
  ];
  let uf = '';
  let town = '';
  for (const { id, e, a } of rows) {
    if (a.uf !== uf) {
      uf = a.uf;
      town = '';
      lines.push('', `## ${uf} (${rows.filter((r) => r.a.uf === uf).length})`);
    }
    if (a.municipio !== town) {
      town = a.municipio;
      lines.push('', `### ${town}`, '');
    }
    lines.push(checklistLine(id, e, a));
  }
  await writeFile(OUT, `${lines.join('\n')}\n`);
  console.log(`wrote ${OUT}: ${rows.length} repeaters to check`);
}
