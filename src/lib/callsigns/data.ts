// Shapes of the files in data/callsigns/, shared by the pipeline that writes
// them (scripts/anatel/callsigns.ts) and the site that reads them.

export const FORMAT_VERSION = 1;

/**
 * Callsigns in use. Suffixes are grouped by prefix and space-separated to
 * keep the file small. "active" holds callsigns with any station whose
 * status is Ativa or N/I; "expired" those whose every station is Vencida.
 * Both mean the callsign is taken.
 */
export interface TakenFile {
  format: number;
  active: Record<string, string>;
  expired: Record<string, string>;
}

/**
 * Callsigns that disappeared from Anatel's file, with the date we first saw
 * them missing. A cancelled callsign stays reserved for one year (Ato 3448,
 * item 12.1.1), so these are probably in quarantine.
 */
export interface ReleasedFile {
  format: number;
  released: Record<string, string>;
}

export interface MetaFile {
  source: string;
  sourceUrl: string;
  /** Date the published callsigns last changed. */
  updatedAt: string;
  /** Newest "Data do Último Licenciamento" in the data: how fresh Anatel's file is. */
  newestLicensing?: string;
  counts: { rows: number; callsigns: number; active: number; expired: number; rejected: number };
}

/** All callsigns in a prefix-grouped record. */
export function expandGroups(groups: Record<string, string>, into = new Set<string>()): Set<string> {
  for (const [prefix, suffixes] of Object.entries(groups)) {
    for (const suffix of suffixes.split(' ')) if (suffix) into.add(prefix + suffix);
  }
  return into;
}

export function expandTaken(taken: TakenFile): Set<string> {
  return expandGroups(taken.expired, expandGroups(taken.active));
}
