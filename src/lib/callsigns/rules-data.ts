// Callsign formation rules as data. Transcribed from Ato Anatel nº 3448 of
// 11/03/2026, section 12 and Tabelas II and III (see docs/callsign-rules.md).
// When Anatel changes the rules, edit this file and the source below.

export const RULES_SOURCE = {
  act: 'Ato Anatel nº 3.448',
  date: '2026-03-11',
  inForce: '2026-03-13',
  url: 'https://www.gov.br/anatel/pt-br/assuntos/noticias/anatel-simplifica-regras-e-fortalece-o-radioamadorismo-no-brasil/ato-3448-2026.pdf/@@download/file',
} as const;

export const UF_NAMES = {
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapá',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',
  PA: 'Pará',
  PB: 'Paraíba',
  PR: 'Paraná',
  PE: 'Pernambuco',
  PI: 'Piauí',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul',
  RO: 'Rondônia',
  RR: 'Roraima',
  SC: 'Santa Catarina',
  SP: 'São Paulo',
  SE: 'Sergipe',
  TO: 'Tocantins',
} as const;

export type Uf = keyof typeof UF_NAMES;

export const UFS = Object.keys(UF_NAMES).sort() as Uf[];

/** A first-letter range, inclusive. */
export type LetterRange = readonly [from: string, to: string];

/**
 * Classes A and B (Tabela II): prefix + 2 letters (AA–ZZ) or 3 letters
 * (AAA–YZZ; the Z series is for foreigners).
 */
export const AB_PREFIXES: Record<Uf, readonly string[]> = {
  AC: ['PT8'],
  AL: ['PP7'],
  AP: ['PQ8'],
  AM: ['PP8'],
  BA: ['PY6'],
  CE: ['PT7'],
  DF: ['PT2'],
  ES: ['PP1'],
  GO: ['PP2'],
  MA: ['PR8'],
  MT: ['PY9'],
  MS: ['PT9'],
  MG: ['PY4'],
  PA: ['PY8'],
  PB: ['PR7'],
  PR: ['PY5'],
  PE: ['PY7'],
  PI: ['PS8'],
  RJ: ['PY1'],
  RN: ['PS7'],
  RS: ['PY3'],
  RO: ['PW8'],
  RR: ['PV8'],
  SC: ['PP5'],
  SP: ['PY2', 'PR2'],
  SE: ['PP6'],
  TO: ['PQ2'],
};

/**
 * Class C (Tabela II): prefix + 3 letters, the first letter in the state's
 * range. São Paulo has two prefixes.
 */
export const C_BLOCKS: Record<Uf, readonly { prefix: string; first: LetterRange }[]> = {
  AC: [{ prefix: 'PU8', first: ['J', 'L'] }],
  AL: [{ prefix: 'PU7', first: ['A', 'D'] }],
  AP: [{ prefix: 'PU8', first: ['G', 'I'] }],
  AM: [{ prefix: 'PU8', first: ['A', 'C'] }],
  BA: [{ prefix: 'PU6', first: ['J', 'Y'] }],
  CE: [{ prefix: 'PU7', first: ['M', 'P'] }],
  DF: [{ prefix: 'PU2', first: ['A', 'E'] }],
  ES: [{ prefix: 'PU1', first: ['A', 'I'] }],
  GO: [{ prefix: 'PU2', first: ['F', 'H'] }],
  MA: [{ prefix: 'PU8', first: ['M', 'O'] }],
  MT: [{ prefix: 'PU9', first: ['O', 'Y'] }],
  MS: [{ prefix: 'PU9', first: ['A', 'N'] }],
  MG: [{ prefix: 'PU4', first: ['A', 'Y'] }],
  PA: [{ prefix: 'PU8', first: ['W', 'Y'] }],
  PB: [{ prefix: 'PU7', first: ['E', 'H'] }],
  PR: [{ prefix: 'PU5', first: ['M', 'Y'] }],
  PE: [{ prefix: 'PU7', first: ['R', 'Y'] }],
  PI: [{ prefix: 'PU8', first: ['P', 'S'] }],
  RJ: [{ prefix: 'PU1', first: ['J', 'Y'] }],
  RN: [{ prefix: 'PU7', first: ['I', 'L'] }],
  RS: [{ prefix: 'PU3', first: ['A', 'Y'] }],
  RO: [{ prefix: 'PU8', first: ['D', 'F'] }],
  RR: [{ prefix: 'PU8', first: ['T', 'V'] }],
  SC: [{ prefix: 'PU5', first: ['A', 'L'] }],
  SP: [
    { prefix: 'PU2', first: ['K', 'Y'] },
    { prefix: 'PV2', first: ['K', 'Y'] },
  ],
  SE: [{ prefix: 'PU6', first: ['A', 'I'] }],
  TO: [{ prefix: 'PU2', first: ['I', 'J'] }],
};

/** Oceanic islands and Antarctica (Tabela III). The code is the first suffix letter. */
export const ISLANDS = {
  F: 'Fernando de Noronha',
  S: 'São Pedro e São Paulo',
  T: 'Trindade',
  R: 'Atol das Rocas',
  M: 'Martim Vaz',
  A: 'Antártida',
} as const;

export type IslandCode = keyof typeof ISLANDS;

export const ISLAND_PREFIXES = { AB: 'PY0', C: 'PU0' } as const;

/** First suffix letter reserved for foreigners (item 12.10.4). */
export const FOREIGNER_LETTER = 'Z';

/**
 * Suffixes that may not be assigned (item 12.2). The Ato also forbids the
 * series QAA–QZZ. "No todo ou em parte" is read as applying to 3-letter
 * suffixes; 2-letter suffixes starting with Q are not excluded by the text.
 */
export const FORBIDDEN_SUFFIXES: ReadonlySet<string> = new Set(['DDD', 'SNM', 'SOS', 'SVH', 'TTT', 'XXX', 'PAN', 'RRR']);
export const FORBIDDEN_SERIES_LETTER = 'Q';
