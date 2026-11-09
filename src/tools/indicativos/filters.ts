// The "Mostrar" options of the callsign tool and which statuses each keeps.
import type { Status } from '../../lib/callsigns/index.ts';
import type { SegmentedOption } from '../../ui/Segmented.tsx';
import type { Show } from './urlState.ts';

const SHOW_STATUSES: Record<Show, readonly Status[] | undefined> = {
  todos: undefined,
  livres: ['livre'],
  quarentena: ['livre', 'quarentena-incerta', 'quarentena'],
};

export const SHOW_OPTIONS: readonly SegmentedOption<Show>[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'livres', label: 'Livres' },
  { value: 'quarentena', label: 'Livres ou em quarentena' },
];

/** Keeps only the items whose status the chosen option shows. */
export function applyShow<T extends { status: Status }>(items: readonly T[], show: Show): readonly T[] {
  const keep = SHOW_STATUSES[show];
  return keep ? items.filter((i) => keep.includes(i.status)) : items;
}
