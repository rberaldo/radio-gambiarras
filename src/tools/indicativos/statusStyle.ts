// How each status looks in the grid. Every status has a marker as well as a
// style, so they can be told apart without color.
import type { Status } from '../../lib/callsigns/index.ts';

export const STATUS_MARK: Record<Status, string> = {
  livre: '',
  'em-uso': '',
  vencida: '†',
  quarentena: '◷',
  reservado: '✕',
  invalido: '',
};

/** Order of the legend. */
export const LEGEND_ORDER: Status[] = ['livre', 'quarentena', 'em-uso', 'vencida', 'reservado'];
