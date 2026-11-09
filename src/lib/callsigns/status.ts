// What the tool tells a person about a callsign. Anatel's data always wins
// over the rules: a callsign listed as in use is taken even if the rules
// would call it reserved.
import { expandGroups, type ReleasedFile, type TakenFile } from './data.ts';
import { classify } from './rules.ts';

export type Status =
  /** Listed by Anatel with status Ativa or N/I. */
  | 'em-uso'
  /** Listed, but every station's license is expired. Still taken. */
  | 'vencida'
  /** We saw it disappear less than a year ago. */
  | 'quarentena'
  /** In use in an older snapshot and gone now, release date unknown. */
  | 'quarentena-incerta'
  /** Forbidden suffix, or reserved for foreigners. */
  | 'reservado'
  /** Allowed by the rules and not found anywhere above. */
  | 'livre'
  /** Not a callsign the rules can produce. */
  | 'invalido';

export interface StatusInfo {
  label: string;
  /** Short explanation for the detail panel. */
  description: string;
  /** Whether someone could plausibly request it. */
  requestable: boolean;
}

export const STATUS_INFO: Record<Status, StatusInfo> = {
  'em-uso': {
    label: 'em uso',
    description: 'Consta na base da Anatel com licença ativa.',
    requestable: false,
  },
  vencida: {
    label: 'licença vencida',
    description: 'Consta na base da Anatel, mas com todas as licenças vencidas. Continua atribuído.',
    requestable: false,
  },
  quarentena: {
    label: 'em quarentena (provável)',
    description:
      'Saiu da base da Anatel há menos de um ano. Indicativos cancelados ficam reservados por um ano, e o antigo titular pode recuperá-lo nesse período.',
    requestable: false,
  },
  'quarentena-incerta': {
    label: 'pode estar em quarentena',
    description:
      'Estava em uso em abril de 2025 e não consta mais na base. Não sabemos quando saiu, então pode ainda estar no período de um ano de reserva.',
    requestable: true,
  },
  reservado: {
    label: 'reservado',
    description: 'As regras da Anatel não permitem este sufixo, ou ele é reservado a estrangeiros.',
    requestable: false,
  },
  livre: {
    label: 'livre (provável)',
    description: 'Permitido pelas regras e não encontrado na base da Anatel. Quem decide é a Anatel.',
    requestable: true,
  },
  invalido: {
    label: 'fora das regras',
    description: 'Este indicativo não pode ser formado pelas regras atuais da Anatel.',
    requestable: false,
  },
};

/** The loaded data, indexed for fast lookups. */
export interface CallsignIndex {
  active: ReadonlySet<string>;
  expired: ReadonlySet<string>;
  /** Callsign to the date we saw it disappear. */
  released: ReadonlyMap<string, string>;
  seeded: ReadonlySet<string>;
}

export function buildIndex(taken: TakenFile, released: ReleasedFile): CallsignIndex {
  return {
    active: expandGroups(taken.active),
    expired: expandGroups(taken.expired),
    released: new Map(Object.entries(released.released)),
    seeded: new Set(released.seeded?.callsigns.split(' ').filter(Boolean) ?? []),
  };
}

/**
 * The status of a normalized callsign. `kind` can be passed when the caller
 * already knows it is a regular or forbidden suffix in a block, which skips
 * classification in hot loops such as the grid.
 */
export function statusOf(callsign: string, index: CallsignIndex, kind?: 'regular' | 'forbidden'): Status {
  if (index.active.has(callsign)) return 'em-uso';
  if (index.expired.has(callsign)) return 'vencida';
  if (index.released.has(callsign)) return 'quarentena';
  if (index.seeded.has(callsign)) return 'quarentena-incerta';
  const k = kind ?? classify(callsign)?.kind;
  if (k === undefined) return 'invalido';
  if (k === 'forbidden' || k === 'foreigner') return 'reservado';
  return 'livre';
}
