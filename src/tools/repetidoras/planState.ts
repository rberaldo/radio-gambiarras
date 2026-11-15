// The planning page's state in the URL: the place open (a stop's id or a
// "lat,lon" picked on the map), the outing (places in order) and the radius.
//   /repetidoras/conferir/plano?parada=pico-da-tijuca&roteiro=pico-da-tijuca;-22.97,-43.25&raio=50
import { parsePosition } from '../../lib/repeaters/vettingDraft.ts';
import type { Point } from '../../lib/repeaters/geo.ts';
import type { Stop } from '../../lib/repeaters/stops.ts';

export const PLAN_RADII = [10, 25, 50, 100];

export interface PlanState {
  open?: string;
  outing: string[];
  radiusKm: number;
}

export const DEFAULT_PLAN: PlanState = { outing: [], radiusKm: 50 };

export function readPlan(search: string): PlanState {
  const p = new URLSearchParams(search);
  const radius = Number(p.get('raio'));
  return {
    open: p.get('parada') || undefined,
    outing: (p.get('roteiro') ?? '').split(';').filter(Boolean),
    radiusKm: PLAN_RADII.includes(radius) ? radius : DEFAULT_PLAN.radiusKm,
  };
}

export function writePlan(s: PlanState): string {
  const p = new URLSearchParams();
  if (s.open) p.set('parada', s.open);
  if (s.outing.length) p.set('roteiro', s.outing.join(';'));
  if (s.radiusKm !== DEFAULT_PLAN.radiusKm) p.set('raio', String(s.radiusKm));
  const qs = p.toString().replace(/%3B/g, ';').replace(/%2C/g, ',');
  return qs ? `?${qs}` : '';
}

/** A key for a point picked on the map: three decimals, about 100 m. */
export const pointKey = (p: Point) => `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;

/** A stop, or a picked point (no horizon of its own until worked out); undefined when the key means nothing. */
export type Place = Pick<Stop, 'id' | 'name' | 'lat' | 'lon'> & Partial<Pick<Stop, 'elevM' | 'horizon' | 'note'>> & { picked?: true };

export function resolvePlace(key: string, stops: readonly Stop[]): Place | undefined {
  const stop = stops.find((s) => s.id === key);
  if (stop) return stop;
  const at = parsePosition(key);
  if (!at || at === 'invalid') return undefined;
  return { id: key, name: `Ponto ${key.replace(',', ', ')}`, ...at, picked: true };
}

/** The quick mode of the vetting sheet, around a place. */
export function quickLink(place: Pick<Place, 'name' | 'lat' | 'lon' | 'picked'>, radiusKm: number): string {
  const p = new URLSearchParams({ modo: 'perto', ponto: `${place.lat.toFixed(5)},${place.lon.toFixed(5)}`, mostrar: 'a-conferir', raio: String(radiusKm) });
  if (!place.picked) p.set('de', place.name);
  return `/repetidoras/conferir?${p}`;
}
