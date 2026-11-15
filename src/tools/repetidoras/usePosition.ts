// Where the person is, followed while `active`: the browser's location,
// refreshed as they move. Nothing is asked for until it is needed.
import { useEffect, useState } from 'preact/hooks';
import type { Point } from '../../lib/repeaters/geo.ts';

export type PositionState = { status: 'off' } | { status: 'waiting' } | { status: 'ready'; point: Point; accuracyM: number } | { status: 'error'; message: string };

const MESSAGES: Record<number, string> = {
  1: 'o navegador não deu permissão para usar sua localização',
  2: 'não foi possível descobrir sua localização',
  3: 'a localização demorou demais',
};

export function usePosition(active: boolean): PositionState {
  const [state, setState] = useState<PositionState>({ status: 'off' });
  useEffect(() => {
    if (!active) return setState({ status: 'off' });
    if (!navigator.geolocation) return setState({ status: 'error', message: 'este navegador não informa a localização' });
    setState((old) => (old.status === 'ready' ? old : { status: 'waiting' }));
    const id = navigator.geolocation.watchPosition(
      (pos) => setState({ status: 'ready', point: { lat: pos.coords.latitude, lon: pos.coords.longitude }, accuracyM: pos.coords.accuracy }),
      (err) => setState((old) => (old.status === 'ready' ? old : { status: 'error', message: MESSAGES[err.code] ?? err.message })),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [active]);
  return state;
}
