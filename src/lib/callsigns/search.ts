// Callsign search: full or partial callsigns, bare suffixes, and wildcards
// (? for one letter, * for any run), plus near misses for a taken callsign.
//
// Query rules:
// - With a digit, the part up to the digit matches the prefix and the rest
//   the suffix ("PY2AB", "P?2AB", "Y2AB").
// - Without a digit, the whole query matches the suffix ("RBR", "*RB").
// - Without wildcards, the suffix part matches from the start ("PY2RB" also
//   finds PY2RBA…); with wildcards, the whole suffix must match.
import { ALL_BLOCKS, classify, indexInBlock, isForbiddenSuffix, normalize, parse, type Block, type LicenseClass } from './rules.ts';
import type { Uf } from './rules-data.ts';
import { STATUS_INFO, statusOf, type CallsignIndex } from './status.ts';
import type { Cell } from './view.ts';

export interface SearchScope {
  licenseClass: LicenseClass;
  /** Omit to search every state. */
  uf?: Uf;
}

export interface ParsedQuery {
  prefix: RegExp;
  suffix: RegExp;
  /** Set when the query is one complete callsign without wildcards. */
  exact?: string;
}

const ALLOWED = /^[A-Z0-9?*]+$/;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const toRegexBody = (pattern: string) => pattern.replace(/\?/g, '[A-Z]').replace(/\*/g, '[A-Z]*');

/** Turns a query into prefix and suffix patterns, or null if it cannot match anything. */
export function parseQuery(raw: string): ParsedQuery | null {
  const q = normalize(raw);
  if (!q || !ALLOWED.test(q)) return null;
  const wildcard = /[?*]/.test(q);
  const digitAt = q.search(/\d/);

  let prefixPart = '';
  let suffixPart = q;
  if (digitAt >= 0) {
    prefixPart = q.slice(0, digitAt + 1);
    suffixPart = q.slice(digitAt + 1);
    if (/\d/.test(suffixPart) || /\d/.test(prefixPart.slice(0, -1))) return null;
  }

  const prefixBody = prefixPart
    ? `${prefixPart.length < 3 && !prefixPart.includes('*') ? '[A-Z]*' : ''}${toRegexBody(prefixPart)}`
    : '[A-Z]{2}\\d';
  const suffixBody = toRegexBody(suffixPart);

  return {
    prefix: new RegExp(`^${prefixBody}$`),
    suffix: new RegExp(wildcard ? `^${suffixBody}$` : `^${suffixBody}`),
    exact: !wildcard && parse(q) ? q : undefined,
  };
}

/** Every possible suffix of each length, alphabetical. */
const ALL_SUFFIXES: Record<2 | 3, string[]> = { 2: [], 3: [] };
for (const a of LETTERS) {
  for (const b of LETTERS) {
    ALL_SUFFIXES[2].push(a + b);
    for (const c of LETTERS) ALL_SUFFIXES[3].push(a + b + c);
  }
}

const byPrefix = (a: Block, b: Block) => a.prefix.localeCompare(b.prefix) || a.first[0].localeCompare(b.first[0]);

function scopeBlocks(scope: SearchScope): Block[] {
  return ALL_BLOCKS.filter(
    (b) => b.uf !== undefined && b.licenseClass === scope.licenseClass && (scope.uf === undefined || b.uf === scope.uf),
  ).sort(byPrefix);
}

export interface SearchResult {
  /** Matches in the scope: requestable first, each group alphabetical. */
  cells: Cell[];
  /** The callsign itself when the query is a complete callsign, whatever the scope. */
  exact?: Cell;
}

function cellFor(callsign: string, index: CallsignIndex): Cell {
  const { suffix } = parse(callsign)!;
  return { callsign, suffix, status: statusOf(callsign, index) };
}

export function search(raw: string, scope: SearchScope, index: CallsignIndex): SearchResult | null {
  const query = parseQuery(raw);
  if (!query) return null;

  const matching = { 2: ALL_SUFFIXES[2].filter((s) => query.suffix.test(s)), 3: ALL_SUFFIXES[3].filter((s) => query.suffix.test(s)) };
  const free: Cell[] = [];
  const other: Cell[] = [];
  for (const block of scopeBlocks(scope)) {
    if (!query.prefix.test(block.prefix)) continue;
    for (const suffix of matching[block.length]) {
      if (indexInBlock(block, suffix) < 0) continue;
      const callsign = block.prefix + suffix;
      const status = statusOf(callsign, index, isForbiddenSuffix(suffix) ? 'forbidden' : 'regular');
      (STATUS_INFO[status].requestable ? free : other).push({ callsign, suffix, status });
    }
  }

  return { cells: [...free, ...other], exact: query.exact ? cellFor(query.exact, index) : undefined };
}

/**
 * Suffixes close to a given one, closest first: two neighbours swapped
 * (keeps the callsign's feel), then one letter changed starting from the
 * last (people tend to keep their opening letters), then other orders.
 */
function variants(suffix: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < suffix.length - 1; i++) out.push(suffix.slice(0, i) + suffix[i + 1] + suffix[i] + suffix.slice(i + 2));
  for (let i = suffix.length - 1; i >= 0; i--) {
    for (const letter of LETTERS) out.push(suffix.slice(0, i) + letter + suffix.slice(i + 1));
  }
  out.push(...permutations(suffix));
  return out;
}

/** How many suggestions each kind gets before the rest fill the remaining slots. */
const NEAR_MISS_SHARE = { sameBlock: 12, longer: 6, otherPrefix: 6 };

/**
 * Requestable callsigns close to a given one, in three groups: variants in
 * the same block; the same callsign with one more letter (PY2RB → PY2RBA);
 * and the same suffix and its variants under the state's other prefixes
 * (PY2RB → PR2RB). Full blocks are common (São Paulo's 2-letter PY2 block
 * has a handful free), so the last two groups matter.
 */
export function nearMisses(raw: string, index: CallsignIndex, limit = 24): Cell[] {
  const c = classify(raw);
  if (!c?.block) return [];
  const { block, prefix, suffix } = c;
  const seen = new Set<string>([c.callsign]);

  const collect = (candidates: Iterable<[Block, string]>): Cell[] => {
    const cells: Cell[] = [];
    for (const [b, s] of candidates) {
      const callsign = b.prefix + s;
      if (seen.has(callsign) || indexInBlock(b, s) < 0 || isForbiddenSuffix(s)) continue;
      seen.add(callsign);
      const cell = cellFor(callsign, index);
      if (STATUS_INFO[cell.status].requestable) cells.push(cell);
      if (cells.length >= limit) break;
    }
    // Clearly free before possibly in quarantine; the sort is stable, so closeness order stays.
    return cells.sort((x, y) => Number(y.status === 'livre') - Number(x.status === 'livre'));
  };

  const siblings = ALL_BLOCKS.filter(
    (b) => b.uf === block.uf && b.island === block.island && b.licenseClass === block.licenseClass && b.length === block.length && b.prefix !== prefix,
  );
  const longer = ALL_BLOCKS.filter((b) => b.prefix === prefix && b.length === suffix.length + 1);

  const groups = [
    { share: NEAR_MISS_SHARE.sameBlock, cells: collect(variants(suffix).map((s) => [block, s])) },
    { share: NEAR_MISS_SHARE.longer, cells: collect(longer.flatMap((b) => [...LETTERS].map((l): [Block, string] => [b, suffix + l]))) },
    {
      share: NEAR_MISS_SHARE.otherPrefix,
      cells: collect(siblings.flatMap((b) => [suffix, ...variants(suffix)].map((s): [Block, string] => [b, s]))),
    },
  ];

  // Each group gets its share; slots a group cannot fill go to the others in order.
  const result = groups.flatMap((g) => g.cells.slice(0, g.share));
  for (const g of groups) {
    for (const cell of g.cells.slice(g.share)) {
      if (result.length >= limit) break;
      result.push(cell);
    }
  }
  return result.slice(0, limit);
}

function permutations(s: string): string[] {
  if (s.length <= 1) return [s];
  const out = new Set<string>();
  for (let i = 0; i < s.length; i++) {
    for (const rest of permutations(s.slice(0, i) + s.slice(i + 1))) out.add(s[i] + rest);
  }
  return [...out];
}
