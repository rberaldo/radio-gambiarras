// APRS symbols: types, where each one sits on hessu's sprite sheets, and
// search. The data lives in data/aprs/symbols.json (see docs/data-sources.md).

/** "/" is the primary table, "\" the alternate one. */
export type AprsTable = '/' | '\\';

export interface AprsSymbolEntry {
  table: AprsTable;
  /** One printable ASCII character, "!" to "~". */
  char: string;
  description: string;
}

export interface AprsSymbolsFile {
  source: string;
  imported: string;
  symbols: AprsSymbolEntry[];
}

export interface AprsSymbol extends AprsSymbolEntry {
  /** Table + character, the two characters typed in a position report. */
  code: string;
}

export const TABLE_NAMES: Record<AprsTable, string> = { '/': 'primária', '\\': 'alternativa' };

/** Sheet layout: 16 × 6 cells per table, in character order from "!". */
export const SHEET_COLUMNS = 16;
export const SHEET_ROWS = 6;
export const FIRST_CHAR = 33;

export function symbolsFrom(file: AprsSymbolsFile): AprsSymbol[] {
  return file.symbols.map((s) => ({ ...s, code: s.table + s.char }));
}

/** Column and row of a character's cell on its table's sheet. */
export function cellOf(char: string): { column: number; row: number } {
  const index = char.charCodeAt(0) - FIRST_CHAR;
  if (char.length !== 1 || index < 0 || index >= SHEET_COLUMNS * SHEET_ROWS) {
    throw new RangeError(`no sheet cell for ${JSON.stringify(char)}`);
  }
  return { column: index % SHEET_COLUMNS, row: Math.floor(index / SHEET_COLUMNS) };
}

/** Lowercase without accents, so "estacao" finds "Estação". */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

const words = (text: string) => fold(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/**
 * Symbols matching a query, best first:
 * - a two-character code such as "/>" matches only that symbol;
 * - a single character matches the symbols with that character in either
 *   table (e.g. ">");
 * - otherwise every word of the query must start a word of the description,
 *   in any order ("posto gas" finds "Posto de gasolina").
 * Code and character matches come before description matches; a single
 * letter matches both ways. An empty query returns everything.
 */
export function searchSymbols(symbols: readonly AprsSymbol[], raw: string, table?: AprsTable): AprsSymbol[] {
  const pool = table ? symbols.filter((s) => s.table === table) : [...symbols];
  const q = raw.trim();
  if (!q) return pool;

  // A table character followed by one more is a code, not words.
  if (q.length === 2 && (q[0] === '/' || q[0] === '\\')) return pool.filter((s) => s.code === q);

  const exact = q.length === 1 ? pool.filter((s) => s.char === q) : [];

  const terms = words(q);
  const byDescription =
    terms.length === 0
      ? []
      : pool.filter((s) => {
          if (exact.includes(s)) return false;
          const desc = words(s.description);
          return terms.every((t) => desc.some((w) => w.startsWith(t)));
        });

  return [...exact, ...byDescription];
}
