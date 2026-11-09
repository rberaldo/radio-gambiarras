// Corrections arrive as GitHub issues through the form
// .github/ISSUE_TEMPLATE/correcao-repetidora.yml. This module is the single
// description of that form: the site uses it to build a prefilled link, the
// form file is generated from it (scripts/repeaters/issue-form.ts), and the
// approval workflow parses issues with it (scripts/repeaters/issue.ts).
// See docs/overlay.md.
import { formatMHz, formatShift, toneText } from './display.ts';
import type { Point } from './geo.ts';
import type { Repeater } from './merge.ts';
import { CTCSS_TONES, MODES } from './overlay.ts';

export const FORM_FILE = 'correcao-repetidora.yml';

/** Form fields: `id` names the field in the prefill URL, `label` is the heading in the issue body. */
export const FIELDS = {
  repeater: { id: 'repetidora', label: 'Repetidora' },
  context: { id: 'contexto', label: 'O que o site mostrava' },
  tone: { id: 'subtom', label: 'Subtom' },
  dcs: { id: 'dcs', label: 'Código DCS' },
  position: { id: 'posicao', label: 'Posição da repetidora' },
  modes: { id: 'modos', label: 'Modos' },
  onAir: { id: 'no-ar', label: 'Está no ar?' },
  input: { id: 'entrada', label: 'Entrada (só para repetidora nova)' },
  place: { id: 'municipio', label: 'Município/UF (só para repetidora nova)' },
  notes: { id: 'observacoes', label: 'Observações' },
  source: { id: 'fonte', label: 'Como você sabe?' },
  callsign: { id: 'indicativo', label: 'Seu indicativo' },
} as const;

/** "88,5 Hz", as the tone dropdown shows it. */
export const toneOption = (hz: number) => `${hz.toFixed(1).replace('.', ',')} Hz`;

export const TONE_OPTIONS = {
  unknown: 'Não sei',
  none: 'Nenhum: abre sem subtom',
  dcs: 'DCS: código no campo abaixo',
} as const;
export const TONE_CHOICES: readonly string[] = [TONE_OPTIONS.unknown, TONE_OPTIONS.none, TONE_OPTIONS.dcs, ...CTCSS_TONES.map(toneOption)];

export const ON_AIR_OPTIONS = { unknown: 'Não sei', yes: 'Sim, funcionando', no: 'Não, fora do ar' } as const;
export const ON_AIR_CHOICES: readonly string[] = [ON_AIR_OPTIONS.unknown, ON_AIR_OPTIONS.yes, ON_AIR_OPTIONS.no];

export const MODE_CHOICES = MODES;

export interface CorrectionLink {
  /** Repository URL, "https://github.com/owner/repo". */
  repo: string;
  /** Repeater id ("PY1BEU@147.150"); absent for a repeater the map lacks. */
  id?: string;
  /** Issue title. */
  title: string;
  /** What the site showed, so the maintainer sees the starting point. */
  context: string;
}

/** The "new issue" URL with the form prefilled. */
export function correctionUrl({ repo, id, title, context }: CorrectionLink): string {
  const params = new URLSearchParams({ template: FORM_FILE, title });
  if (id) params.set(FIELDS.repeater.id, id);
  params.set(FIELDS.context.id, context);
  return `${repo}/issues/new?${params}`;
}

const pointText = (p: Point) => `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`;

/** Link to correct a repeater on the map, with what the site shows about it. */
export function repeaterCorrection(repo: string, r: Repeater, pageUrl: string, picked?: Point): CorrectionLink {
  const position = r.position
    ? r.position.exact
      ? `exata, ${pointText(r.position)}`
      : `aproximada (sede de ${r.municipio})`
    : 'desconhecida';
  const lines = [
    `${r.callsign} em ${r.municipio}/${r.uf}`,
    `Saída ${formatMHz(r.output)} MHz, entrada ${formatMHz(r.input)} MHz (${formatShift(r.shift)})`,
    `Subtom: ${toneText(r)}`,
    `Modos: ${r.modes.length ? r.modes.join(', ') : 'desconhecidos'}`,
    `Posição: ${position}`,
  ];
  if (picked) lines.push(`Ponto escolhido no mapa: ${pointText(picked)}`);
  lines.push(pageUrl);
  return { repo, id: r.id, title: `Correção: ${r.callsign} ${formatMHz(r.output)} MHz`, context: lines.join('\n') };
}

/** Link to report a repeater the map lacks, near the chosen point. */
export function missingRepeater(repo: string, pageUrl: string, picked?: Point): CorrectionLink {
  const lines = ['Repetidora que falta no mapa.'];
  if (picked) lines.push(`Ponto escolhido no mapa: ${pointText(picked)}`);
  lines.push(pageUrl);
  return { repo, title: 'Repetidora nova: ', context: lines.join('\n') };
}
