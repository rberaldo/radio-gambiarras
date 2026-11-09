// Finds a município's coordinates (its seat) by name and UF, using the
// vendored table in data/geo/municipios.json (kelvins/municipios-brasileiros,
// MIT). Names are compared without accents, case, apostrophes or hyphens.
import { readFile } from 'node:fs/promises';

export const MUNICIPIOS_PATH = 'data/geo/municipios.json';

export interface Municipio {
  ibge: number;
  nome: string;
  uf: string;
  lat: number;
  lon: number;
}

/**
 * Anatel spellings that differ from the table, as "UF|normalized Anatel
 * name" → normalized table name. Add one when the job logs an unlocated
 * município.
 */
export const ALIASES: Record<string, string> = {
  'PE|sao caitano': 'sao caetano',
};

export function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[’'`´]/g, '')
    .replace(/[-–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type MunicipioLookup = (name: string, uf: string) => Municipio | undefined;

export function municipioLookup(municipios: readonly Municipio[]): MunicipioLookup {
  const index = new Map(municipios.map((m) => [`${m.uf}|${normalizeName(m.nome)}`, m]));
  return (name, uf) => {
    const key = `${uf}|${normalizeName(name)}`;
    return index.get(key) ?? (ALIASES[key] ? index.get(`${uf}|${ALIASES[key]}`) : undefined);
  };
}

export async function loadMunicipioLookup(path = MUNICIPIOS_PATH): Promise<MunicipioLookup> {
  const file = JSON.parse(await readFile(path, 'utf8')) as { municipios: Municipio[] };
  return municipioLookup(file.municipios);
}
