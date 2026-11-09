// Narrowing the repeater list by the map's filters, and the town list for
// the place box.
import { isDigital } from './display.ts';
import { isFm } from './export.ts';
import type { Point } from './geo.ts';
import type { Repeater } from './merge.ts';
import type { Band } from './types.ts';

export type BandChoice = 'todas' | Band;
/** FM includes repeaters of unknown mode; mixed FM + digital ones are in both. */
export type ModeChoice = 'todos' | 'fm' | 'digital';

const MODE_TEST: Record<ModeChoice, (r: Repeater) => boolean> = { todos: () => true, fm: isFm, digital: isDigital };

export function filterRepeaters(repeaters: readonly Repeater[], band: BandChoice, mode: ModeChoice): Repeater[] {
  return repeaters.filter((r) => (band === 'todas' || r.band === band) && MODE_TEST[mode](r));
}

/** "Município/UF" → its seat, sorted by name, from the repeaters placed at their seat. */
export function placesOf(repeaters: readonly Repeater[]): Map<string, Point> {
  const places = new Map<string, Point>();
  for (const r of repeaters) {
    if (r.position && !r.position.exact) places.set(`${r.municipio}/${r.uf}`, { lat: r.position.lat, lon: r.position.lon });
  }
  return new Map([...places].sort(([a], [b]) => a.localeCompare(b, 'pt-BR')));
}
