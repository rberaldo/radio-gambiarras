// Brazilian amateur callsign rules: parsing, blocks and classification.
// The tables live in rules-data.ts; this module only interprets them.
import {
  AB_PREFIXES,
  C_BLOCKS,
  FORBIDDEN_SERIES_LETTER,
  FORBIDDEN_SUFFIXES,
  FOREIGNER_LETTER,
  ISLAND_PREFIXES,
  ISLANDS,
  UFS,
  type IslandCode,
  type LetterRange,
  type Uf,
} from './rules-data.ts';

/** Classes A and B share every block, so the rules only distinguish two. */
export type LicenseClass = 'AB' | 'C';

/**
 * A contiguous range of callsigns: one prefix, one suffix length, and a
 * range for the suffix's first letter (the other letters run A–Z).
 */
export interface Block {
  id: string;
  prefix: string;
  length: 2 | 3;
  first: LetterRange;
  licenseClass: LicenseClass;
  uf?: Uf;
  island?: IslandCode;
}

export interface ParsedCallsign {
  callsign: string;
  prefix: string;
  digit: number;
  suffix: string;
}

export type CallsignKind = 'regular' | 'forbidden' | 'foreigner';

export interface Classification extends ParsedCallsign {
  kind: CallsignKind;
  licenseClass: LicenseClass;
  /** The block for regular and forbidden callsigns; absent for foreigners. */
  block?: Block;
  /** Absent when the callsign belongs to no single state (islands, class C foreigners). */
  uf?: Uf;
  island?: IslandCode;
}

const A = 'A'.charCodeAt(0);
const letterIndex = (ch: string) => ch.charCodeAt(0) - A;
const letterAt = (i: number) => String.fromCharCode(A + i);

/** Uppercases and strips spaces, hyphens and slashes. Does not validate. */
export function normalize(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s\-/]+/g, '');
}

const CALLSIGN_RE = /^([A-Z]{2}(\d))([A-Z]{2,3})$/;

/** Splits a callsign into prefix, digit and suffix, or returns null if malformed. */
export function parse(raw: string): ParsedCallsign | null {
  const callsign = normalize(raw);
  const m = CALLSIGN_RE.exec(callsign);
  if (!m) return null;
  return { callsign, prefix: m[1]!, digit: Number(m[2]), suffix: m[3]! };
}

export function isForbiddenSuffix(suffix: string): boolean {
  return FORBIDDEN_SUFFIXES.has(suffix) || (suffix.length === 3 && suffix[0] === FORBIDDEN_SERIES_LETTER);
}

function buildBlocks(): Block[] {
  const blocks: Block[] = [];
  for (const uf of UFS) {
    for (const prefix of AB_PREFIXES[uf]) {
      blocks.push({ id: `${prefix}-2`, prefix, length: 2, first: ['A', 'Z'], licenseClass: 'AB', uf });
      blocks.push({ id: `${prefix}-3`, prefix, length: 3, first: ['A', 'Y'], licenseClass: 'AB', uf });
    }
    for (const { prefix, first } of C_BLOCKS[uf]) {
      blocks.push({ id: `${prefix}-${first[0]}${first[1]}`, prefix, length: 3, first, licenseClass: 'C', uf });
    }
  }
  for (const island of Object.keys(ISLANDS) as IslandCode[]) {
    const ab = ISLAND_PREFIXES.AB;
    const c = ISLAND_PREFIXES.C;
    blocks.push({ id: `${ab}${island}-2`, prefix: ab, length: 2, first: [island, island], licenseClass: 'AB', island });
    blocks.push({ id: `${ab}${island}-3`, prefix: ab, length: 3, first: [island, island], licenseClass: 'AB', island });
    blocks.push({ id: `${c}${island}-3`, prefix: c, length: 3, first: [island, island], licenseClass: 'C', island });
  }
  return blocks;
}

/** Every block of regular callsigns, states first, then islands. */
export const ALL_BLOCKS: readonly Block[] = buildBlocks();

const blocksById = new Map(ALL_BLOCKS.map((b) => [b.id, b]));

export function blockById(id: string): Block | undefined {
  return blocksById.get(id);
}

/** The blocks a holder of the given class may request in a state. */
export function blocksFor(uf: Uf, licenseClass: LicenseClass): Block[] {
  return ALL_BLOCKS.filter((b) => b.uf === uf && b.licenseClass === licenseClass);
}

export function blockSize(block: Block): number {
  const firstCount = letterIndex(block.first[1]) - letterIndex(block.first[0]) + 1;
  return firstCount * 26 ** (block.length - 1);
}

/** The suffix at a position in the block, in alphabetical order. */
export function suffixAt(block: Block, index: number): string {
  if (!Number.isInteger(index) || index < 0 || index >= blockSize(block)) {
    throw new RangeError(`index ${index} outside block ${block.id}`);
  }
  let rest = index;
  const letters: string[] = [];
  for (let i = block.length - 1; i > 0; i--) {
    letters.unshift(letterAt(rest % 26));
    rest = Math.floor(rest / 26);
  }
  letters.unshift(letterAt(letterIndex(block.first[0]) + rest));
  return letters.join('');
}

/** The position of a suffix in the block, or -1 if it is not in it. */
export function indexInBlock(block: Block, suffix: string): number {
  if (suffix.length !== block.length || !/^[A-Z]+$/.test(suffix)) return -1;
  const first = letterIndex(suffix[0]!);
  const from = letterIndex(block.first[0]);
  if (first < from || first > letterIndex(block.first[1])) return -1;
  let index = first - from;
  for (let i = 1; i < suffix.length; i++) index = index * 26 + letterIndex(suffix[i]!);
  return index;
}

export function* suffixes(block: Block): Generator<string> {
  const size = blockSize(block);
  for (let i = 0; i < size; i++) yield suffixAt(block, i);
}

function findBlock(prefix: string, suffix: string): Block | undefined {
  return ALL_BLOCKS.find((b) => b.prefix === prefix && indexInBlock(b, suffix) >= 0);
}

const AB_PREFIX_UF = new Map<string, Uf>(UFS.flatMap((uf) => AB_PREFIXES[uf].map((p) => [p, uf] as const)));
const C_PREFIXES = new Set(UFS.flatMap((uf) => C_BLOCKS[uf].map((b) => b.prefix)));

/**
 * Where a callsign sits in the rules: its block, state and class, and
 * whether it is regular, forbidden or reserved for foreigners. Returns null
 * for well-formed callsigns outside every block (legacy, special, typos).
 */
export function classify(raw: string): Classification | null {
  const parsed = parse(raw);
  if (!parsed) return null;
  const { prefix, suffix } = parsed;

  const block = findBlock(prefix, suffix);
  if (block) {
    return {
      ...parsed,
      kind: isForbiddenSuffix(suffix) ? 'forbidden' : 'regular',
      licenseClass: block.licenseClass,
      block,
      uf: block.uf,
      island: block.island,
    };
  }

  if (suffix.length === 3 && suffix[0] === FOREIGNER_LETTER) {
    const abUf = AB_PREFIX_UF.get(prefix);
    if (abUf) return { ...parsed, kind: 'foreigner', licenseClass: 'AB', uf: abUf };
    if (C_PREFIXES.has(prefix)) return { ...parsed, kind: 'foreigner', licenseClass: 'C' };
    const island = suffix[1] as IslandCode;
    if (Object.hasOwn(ISLANDS, island)) {
      if (prefix === ISLAND_PREFIXES.AB) return { ...parsed, kind: 'foreigner', licenseClass: 'AB', island };
      if (prefix === ISLAND_PREFIXES.C) return { ...parsed, kind: 'foreigner', licenseClass: 'C', island };
    }
  }

  return null;
}

/** The state a callsign belongs to, derived from the rules (never from Anatel's UF columns). */
export function ufOf(raw: string): Uf | null {
  return classify(raw)?.uf ?? null;
}
