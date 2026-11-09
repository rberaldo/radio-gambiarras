// Reading Anatel's amateur-station CSV (Estacoes_Radioamador.csv): the
// expected columns and a header check shared by every reduction (callsigns,
// repeaters). Only read the columns you need; the file also holds names and
// documents, which must never be written anywhere.
import { parseDelimited } from '../lib/csv.ts';

export const EXPECTED_HEADER = [
  'Tipo de Identificação',
  'CNPJ ou CPF',
  'Nome da Entidade',
  'Fistel do Serviço da Estação',
  'Serviço',
  'Indicativo',
  'Número da Estação',
  'UF da Entidade',
  'COER',
  'Nome da Estação',
  'Tipo de Estação',
  'Frequências de Operação da Estação',
  'Município da Estação',
  'UF da Estação',
  'Data do Primeiro Licenciamento',
  'Data do Último Licenciamento',
  'Data de Validade da Estação',
  'Status da Validade',
] as const;

export type Column = (typeof EXPECTED_HEADER)[number];

export interface StationRows {
  /** Data rows that have exactly the expected number of columns. */
  rows: string[][];
  /** Number of data rows, including malformed ones. */
  total: number;
  /** Rows with the wrong number of columns. */
  malformed: number;
  /** Index of a column, for row[col('Indicativo')]. */
  col: (name: Column) => number;
}

/** Parses the CSV and fails loudly if Anatel changed the columns. */
export function readStations(csvText: string): StationRows {
  const [header, ...rows] = parseDelimited(csvText, ';');
  const got = (header ?? []).map((h) => h.trim());
  if (got.length !== EXPECTED_HEADER.length || got.some((h, i) => h !== EXPECTED_HEADER[i])) {
    throw new Error(`unexpected header:\n  got      ${got.join(' | ')}\n  expected ${EXPECTED_HEADER.join(' | ')}`);
  }
  const wellFormed = rows.filter((r) => r.length === EXPECTED_HEADER.length);
  return {
    rows: wellFormed,
    total: rows.length,
    malformed: rows.length - wellFormed.length,
    col: (name) => EXPECTED_HEADER.indexOf(name),
  };
}
