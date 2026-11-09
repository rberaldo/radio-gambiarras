// Line of sight from where the person is (the picked point, or the nearest
// spot on their trail) to repeaters whose antenna site is known. Repeaters
// placed at their town seat get no verdict: a town square says nothing
// about a hilltop antenna.
import { useEffect, useState } from 'preact/hooks';
import { distanceKm, type Nearby, type Point } from '../../lib/repeaters/geo.ts';
import type { Repeater } from '../../lib/repeaters/merge.ts';
import { lineOfSight, samplePath, type LosResult, type ProfilePoint } from '../../lib/radio/los.ts';
import { elevations } from './elevation.ts';

/** Assumed heights above ground (decided with the user): a handheld, and a repeater on a short mast. */
export const YOU_HEIGHT_M = 1.5;
export const REPEATER_HEIGHT_M = 15;
/** About two DEM pixels: finer would only repeat the same values. */
const STEP_KM = 0.03;
/** Verdicts for the list are worked out for at most this many repeaters, nearest first. */
const LIST_MAX = 40;

export interface Profile {
  profile: ProfilePoint[];
  result: LosResult;
}

/** A repeater's antenna site, when known (exact or probable); undefined for a town seat. */
export const antennaSite = (r: Repeater): Point | undefined => (r.position?.exact ? r.position : undefined);

export async function computeProfile(from: Point, r: Repeater): Promise<Profile | undefined> {
  const site = antennaSite(r);
  if (!site) return undefined;
  const points = samplePath(from, site, STEP_KM);
  const elev = await elevations(points);
  const lengthKm = distanceKm(from, site);
  const profile = elev.map((elevM, i) => ({ km: (lengthKm * i) / (points.length - 1), elevM }));
  return { profile, result: lineOfSight(profile, YOU_HEIGHT_M, REPEATER_HEIGHT_M, r.output) };
}

/** Where a line of sight to this repeater starts: the trail's nearest spot, else the picked point. */
export const losFrom = (n: Pick<Nearby, 'nearest'> | undefined, center: Point | undefined) => n?.nearest ?? center;

/** The profile for one repeater, for the detail panel. */
export function useProfile(r: Repeater, from: Point | undefined) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'done'; value: Profile } | { status: 'error' }>({ status: 'loading' });
  useEffect(() => {
    if (!from || !antennaSite(r)) return;
    let alive = true;
    setState({ status: 'loading' });
    computeProfile(from, r)
      .then((value) => alive && value && setState({ status: 'done', value }))
      .catch(() => alive && setState({ status: 'error' }));
    return () => {
      alive = false;
    };
  }, [r.id, from?.lat, from?.lon]);
  return state;
}

/** Verdicts for the list, filled in as they are worked out, one repeater at a time. */
export function useListLineOfSight(nearby: readonly Nearby[], center: Point | undefined): ReadonlyMap<string, LosResult> {
  const [verdicts, setVerdicts] = useState<ReadonlyMap<string, LosResult>>(new Map());
  useEffect(() => {
    let alive = true;
    setVerdicts(new Map());
    const todo = nearby.filter((n) => antennaSite(n.repeater) && losFrom(n, center)).slice(0, LIST_MAX);
    (async () => {
      for (const n of todo) {
        try {
          const p = await computeProfile(losFrom(n, center)!, n.repeater);
          if (!alive) return;
          if (p) setVerdicts((old) => new Map(old).set(n.repeater.id, p.result));
        } catch {
          // No relief data now (offline, tile server down): the row just shows no verdict.
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [nearby, center?.lat, center?.lon]);
  return verdicts;
}
