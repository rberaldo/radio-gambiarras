// The repeater map's state in the query string. Defaults are left out.
// Example: /repetidoras?lat=-22.9497&lon=-43.2851&raio=50&banda=2m&modo=digital&rep=PY1BAB%40147.030
import type { Band } from '../../lib/repeaters/types.ts';

export type BandChoice = 'todas' | Band;
/** FM includes repeaters of unknown mode; mixed FM + digital ones are in both. */
export type ModeChoice = 'todos' | 'fm' | 'digital';

export const RADIUS = { min: 10, max: 150, step: 5, default: 50 } as const;

export interface MapState {
  /** Point the radius is measured from; absent until the user picks one. */
  lat?: number;
  lon?: number;
  radiusKm: number;
  band: BandChoice;
  mode: ModeChoice;
  /** Id of the repeater whose details are open. */
  selected?: string;
}

export const DEFAULT_STATE: MapState = { radiusKm: RADIUS.default, band: 'todas', mode: 'todos' };

const inBrazilBox = (lat: number, lon: number) => lat >= -35.5 && lat <= 7 && lon >= -75.5 && lon <= -27.5;

export function readState(search: string): MapState {
  const p = new URLSearchParams(search);
  const state: MapState = { ...DEFAULT_STATE };
  const lat = Number(p.get('lat'));
  const lon = Number(p.get('lon'));
  if (p.has('lat') && p.has('lon') && Number.isFinite(lat) && Number.isFinite(lon) && inBrazilBox(lat, lon)) {
    state.lat = lat;
    state.lon = lon;
  }
  const raio = Number(p.get('raio'));
  if (Number.isFinite(raio) && raio >= RADIUS.min && raio <= RADIUS.max) state.radiusKm = Math.round(raio);
  const banda = p.get('banda');
  if (banda === '2m' || banda === '70cm') state.band = banda;
  const modo = p.get('modo');
  if (modo === 'fm' || modo === 'digital') state.mode = modo;
  const rep = p.get('rep');
  if (rep && /^[A-Z0-9]{4,7}@\d{2,3}\.\d{3}$/.test(rep)) state.selected = rep;
  return state;
}

export function writeState(state: MapState): string {
  const p = new URLSearchParams();
  if (state.lat !== undefined && state.lon !== undefined) {
    p.set('lat', state.lat.toFixed(4));
    p.set('lon', state.lon.toFixed(4));
  }
  if (state.radiusKm !== DEFAULT_STATE.radiusKm) p.set('raio', String(state.radiusKm));
  if (state.band !== DEFAULT_STATE.band) p.set('banda', state.band);
  if (state.mode !== DEFAULT_STATE.mode) p.set('modo', state.mode);
  if (state.selected) p.set('rep', state.selected);
  const qs = p.toString();
  return qs ? `?${qs}` : '';
}
