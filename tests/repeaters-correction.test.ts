import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIELDS, TONE_OPTIONS, correctionUrl, missingRepeater, repeaterCorrection } from '../src/lib/repeaters/correction.ts';
import type { Repeater } from '../src/lib/repeaters/merge.ts';
import { validateOverlay, type OverlayFile } from '../src/lib/repeaters/overlay.ts';
import { FORM_PATH, renderIssueForm } from '../scripts/repeaters/issue-form.ts';
import { applyCorrection, correctionFromIssue, normalizeId, parseIssueBody, type FormAnswers } from '../scripts/repeaters/issue.ts';

const meta = { author: 'fulano', number: 7, date: '2026-11-09' };

/** An issue body as GitHub writes it from the form. */
function body(answers: Partial<Record<keyof typeof FIELDS, string>>): string {
  return Object.entries(FIELDS)
    .map(([key, f]) => `### ${f.label}\n\n${answers[key as keyof typeof FIELDS] ?? '_No response_'}`)
    .join('\n\n');
}

const MODES_FM_DMR = '- [X] FM\n- [X] DMR\n- [ ] D-STAR\n- [ ] Fusion\n- [ ] NXDN\n- [ ] P25\n- [ ] M17';

const repeater: Repeater = {
  id: 'PY1ZZZ@147.150',
  callsign: 'PY1ZZZ',
  band: '2m',
  output: 147.15,
  input: 147.75,
  shift: 0.6,
  municipio: 'Petrópolis',
  uf: 'RJ',
  position: { lat: -22.505, lon: -43.178, exact: false },
  modes: [],
  license: 'ativa',
};

describe('issue form', () => {
  it('is the committed file (regenerate with node scripts/repeaters/issue-form.ts)', () => {
    expect(readFileSync(FORM_PATH, 'utf8')).toBe(renderIssueForm());
  });
});

describe('parseIssueBody', () => {
  it('reads every answer, with "_No response_" as empty', () => {
    const a = parseIssueBody(body({ repeater: 'PY1ZZZ@147.150', tone: '88,5 Hz', notes: 'Linha 1\n\n### Não é um campo\nLinha 3' }));
    expect(a.repeater).toBe('PY1ZZZ@147.150');
    expect(a.tone).toBe('88,5 Hz');
    expect(a.dcs).toBe('');
    expect(a.notes).toBe('Linha 1\n\n### Não é um campo\nLinha 3');
  });

  it('accepts Windows line endings', () => {
    expect(parseIssueBody(body({ repeater: 'PY1ZZZ@147.150' }).replace(/\n/g, '\r\n')).repeater).toBe('PY1ZZZ@147.150');
  });

  it('refuses a field title typed inside an answer', () => {
    const answers = parseIssueBody(body({ repeater: 'PY1ZZZ@147.150', tone: '88,5 Hz', source: 'teste', notes: `x\n\n### ${FIELDS.tone.label}\n\n${TONE_OPTIONS.none}` }));
    expect(answers.repeated).toEqual([FIELDS.tone.label]);
    const r = correctionFromIssue(answers, meta);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.problems.join(' ')).toMatch(/aparece mais de uma vez/);
  });
});

describe('normalizeId', () => {
  it('fixes case, spaces, decimal commas and missing decimals', () => {
    expect(normalizeId('py1zzz @ 147,15')).toBe('PY1ZZZ@147.150');
    expect(normalizeId('PY1ZZZ@439.1')).toBe('PY1ZZZ@439.100');
    expect(normalizeId('PY1ZZZ 147.150')).toBeUndefined();
  });
});

describe('correctionFromIssue', () => {
  const read = (answers: FormAnswers) => correctionFromIssue(answers, meta);

  it('takes a callsign only if it looks like one', () => {
    const ok = read({ repeater: 'PY1ZZZ@147.150', tone: '88,5 Hz', source: 'teste', callsign: 'pu2abc/p' });
    expect(ok.ok && ok.entry.source).toMatch(/^PU2ABC\/P: /);
    const bad = read({ repeater: 'PY1ZZZ@147.150', tone: '88,5 Hz', source: 'teste', callsign: 'x'.repeat(3000) + '\n@OCTOCAT' });
    expect(bad.ok).toBe(false);
  });

  it('builds an entry with tone, position, modes, on air and notes', () => {
    const r = read(
      parseIssueBody(
        body({
          repeater: 'PY1ZZZ@147.150',
          tone: '88,5 Hz',
          position: '22°27\'17"S 43°10\'22"W',
          modes: MODES_FM_DMR,
          onAir: 'Sim, funcionando',
          notes: 'Morro do Cuca',
          source: 'Testei no ar\nontem.',
          callsign: 'pu1zzz',
        }),
      ),
    );
    expect(r).toEqual({
      ok: true,
      id: 'PY1ZZZ@147.150',
      entry: {
        source: 'PU1ZZZ: Testei no ar ontem. (issue #7)',
        date: '2026-11-09',
        tone: 88.5,
        lat: -22.45472,
        lon: -43.17278,
        modes: ['FM', 'DMR'],
        onAir: true,
        notes: 'Morro do Cuca',
      },
    });
  });

  it('credits the GitHub user without a callsign', () => {
    const r = read({ repeater: 'PY1ZZZ@147.150', tone: TONE_OPTIONS.none, source: 'clube' });
    expect(r.ok && r.entry.source).toBe('@fulano: clube (issue #7)');
    expect(r.ok && r.entry.tone).toBe('none');
  });

  it('reads DCS and pads the code', () => {
    const r = read({ repeater: 'PY1ZZZ@147.150', tone: TONE_OPTIONS.dcs, dcs: '23', source: 'x' });
    expect(r.ok && r.entry.dcs).toBe('023');
    expect(r.ok && r.entry.tone).toBeUndefined();
  });

  it('reads a new repeater', () => {
    const r = read({ repeater: 'PY1ZZZ@146.610', input: '146,010', place: 'Teresópolis/rj', position: '-22,41 -42,97', source: 'x' });
    expect(r.ok && r.entry).toMatchObject({ input: 146.01, municipio: 'Teresópolis', uf: 'RJ', lat: -22.41, lon: -42.97 });
  });

  it('explains what it cannot read', () => {
    const r = read({ repeater: 'PY1ZZZ 147', tone: TONE_OPTIONS.dcs, position: 'no morro', place: 'Petrópolis', source: '' });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.problems).toEqual([
      '"PY1ZZZ 147" não parece INDICATIVO@saída, como PY1BEU@147.150',
      'falta dizer como você sabe',
      'escolheu DCS mas não informou o código',
      'posição "no morro" não reconhecida: use latitude e longitude, como -22,4547 -43,1729',
      'município "Petrópolis" deve ser Cidade/UF, como Petrópolis/RJ',
    ]);
  });

  it('refuses an issue that says nothing', () => {
    const r = read({ repeater: 'PY1ZZZ@147.150', tone: TONE_OPTIONS.unknown, onAir: 'Não sei', source: 'x' });
    expect(!r.ok && r.problems).toEqual(['a sugestão não traz nenhuma informação: preencha ao menos um campo']);
  });
});

describe('applyCorrection', () => {
  const file: OverlayFile = {
    format: 1,
    entries: { 'PY2ZZZ@146.610': { dcs: '023', lat: -23.6, lon: -46.8, source: 'a', date: '2026-01-01' } },
  };

  it('keeps earlier fields and lets a tone replace DCS', () => {
    const next = applyCorrection(file, 'PY2ZZZ@146.610', { tone: 88.5, source: 'b', date: '2026-11-09' });
    expect(next.entries['PY2ZZZ@146.610']).toEqual({ tone: 88.5, lat: -23.6, lon: -46.8, source: 'b', date: '2026-11-09' });
  });

  it('adds new entries in sorted order', () => {
    const next = applyCorrection(file, 'PY1ZZZ@147.150', { onAir: true, source: 'c', date: '2026-11-09' });
    expect(Object.keys(next.entries)).toEqual(['PY1ZZZ@147.150', 'PY2ZZZ@146.610']);
    expect(validateOverlay(next, new Set(['PY1ZZZ@147.150', 'PY2ZZZ@146.610']))).toEqual([]);
  });
});

describe('correction links', () => {
  it('prefill the form with the repeater and what the site shows', () => {
    const link = repeaterCorrection('https://github.com/o/r', repeater, 'https://site/repetidoras?rep=x', { lat: -22.5, lon: -43.2 });
    const url = new URL(correctionUrl(link));
    expect(url.pathname).toBe('/o/r/issues/new');
    expect(url.searchParams.get('template')).toBe('correcao-repetidora.yml');
    expect(url.searchParams.get('title')).toBe('Correção: PY1ZZZ 147,150 MHz');
    expect(url.searchParams.get(FIELDS.repeater.id)).toBe('PY1ZZZ@147.150');
    expect(url.searchParams.get(FIELDS.context.id)).toBe(
      [
        'PY1ZZZ em Petrópolis/RJ',
        'Saída 147,150 MHz, entrada 147,750 MHz (+0,600)',
        'Subtom: desconhecido',
        'Modos: desconhecidos',
        'Posição: aproximada (sede de Petrópolis)',
        'Ponto escolhido no mapa: -22.50000, -43.20000',
        'https://site/repetidoras?rep=x',
      ].join('\n'),
    );
  });

  it('leave the repeater blank for a missing one', () => {
    const url = new URL(correctionUrl(missingRepeater('https://github.com/o/r', 'https://site/repetidoras')));
    expect(url.searchParams.has(FIELDS.repeater.id)).toBe(false);
    expect(url.searchParams.get('title')).toBe('Repetidora nova: ');
  });

  it('leave a trail out of the page address', () => {
    const link = missingRepeater('https://github.com/o/r', 'https://site/repetidoras?raio=20#trilha=abc&nome=x');
    expect(link.context).toContain('https://site/repetidoras?raio=20');
    expect(link.context).not.toContain('trilha');
  });
});
