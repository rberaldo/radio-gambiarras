// The horizon around a point picked on the planning page, worked out in the
// browser from the same relief tiles as the line of sight (about a dozen
// tiles). The listed stops come with theirs precomputed.
import { useEffect, useState } from 'preact/hooks';
import { EYE_HEIGHT_M, horizonAngles, horizonPoints } from '../../lib/radio/horizon.ts';
import type { Point } from '../../lib/repeaters/geo.ts';
import { elevations } from './elevation.ts';

export type HorizonState = { status: 'idle' } | { status: 'loading' } | { status: 'ready'; elevM: number; horizon: number[] } | { status: 'error' };

export function useHorizon(point: Point | undefined): HorizonState {
  const [state, setState] = useState<HorizonState>({ status: 'idle' });
  useEffect(() => {
    if (!point) return setState({ status: 'idle' });
    let alive = true;
    setState({ status: 'loading' });
    (async () => {
      const [elevM] = await elevations([point]);
      const horizon = horizonAngles(elevM! + EYE_HEIGHT_M, await elevations(horizonPoints(point)));
      if (alive) setState({ status: 'ready', elevM: Math.round(elevM!), horizon });
    })().catch(() => alive && setState({ status: 'error' }));
    return () => {
      alive = false;
    };
  }, [point?.lat, point?.lon]);
  return state;
}
