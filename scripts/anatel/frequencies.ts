// Parses Anatel's free-text "Frequências de Operação da Estação" field into
// output/input pairs. Real values include several pairs separated by ";",
// stray quotes, thousands separators ("1.287,800"), "N/I", and junk such as
// "0,147 / 0,146" or "14.477,000".

export interface FrequencyPair {
  /** First value: what the repeater transmits. */
  output: number;
  /** Second value: what it listens on. */
  input: number;
}

export interface ParsedFrequencies {
  pairs: FrequencyPair[];
  /** Pieces that could not be read as a pair, for the reject log. */
  rejected: string[];
}

/** "1.287,800" → 1287.8; "146,610" → 146.61. */
export function parseBrazilianNumber(text: string): number | undefined {
  const t = text.trim();
  if (!/^\d{1,3}(\.\d{3})*(,\d+)?$|^\d+(,\d+)?$/.test(t)) return undefined;
  return Number(t.replace(/\./g, '').replace(',', '.'));
}

export function parseFrequencyField(raw: string): ParsedFrequencies {
  const result: ParsedFrequencies = { pairs: [], rejected: [] };
  const text = raw.replace(/"/g, '').trim();
  if (!text || text === 'N/I') return result;
  for (const piece of text.split(';')) {
    const m = /^\s*([\d.,]+)\s*\/\s*([\d.,]+)\s*MHz\s*$/i.exec(piece);
    const output = m ? parseBrazilianNumber(m[1]!) : undefined;
    const input = m ? parseBrazilianNumber(m[2]!) : undefined;
    if (output === undefined || input === undefined) result.rejected.push(piece.trim());
    else result.pairs.push({ output, input });
  }
  return result;
}
