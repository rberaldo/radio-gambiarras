// GeoJSON for the map: repeaters as points (with flags clusters can count)
// and the selection circle.
import type { Feature, FeatureCollection, Point as GeoPoint, Polygon } from 'geojson';
import type { Point } from '../../lib/repeaters/geo.ts';
import type { Repeater } from '../../lib/repeaters/merge.ts';

export interface PointProps {
  id: string;
  callsign: string;
  band: string;
  exact: boolean;
  /** 1 when inside the selection circle, so clusters can add them up. */
  sel: 0 | 1;
}

export function repeaterPoints(repeaters: readonly Repeater[], selected: ReadonlySet<string>): FeatureCollection<GeoPoint, PointProps> {
  return {
    type: 'FeatureCollection',
    features: repeaters
      .filter((r) => r.position)
      .map((r) => ({
        type: 'Feature',
        properties: { id: r.id, callsign: r.callsign, band: r.band, exact: r.position!.exact, sel: selected.has(r.id) ? 1 : 0 },
        geometry: { type: 'Point', coordinates: [r.position!.lon, r.position!.lat] },
      })),
  };
}

/** A circle as a polygon; accurate enough on screen for radii up to a few hundred km. */
export function circlePolygon(center: Point, km: number, steps = 96): Feature<Polygon> {
  const ring: number[][] = [];
  const dLat = km / 110.574;
  const dLon = km / (111.32 * Math.cos((center.lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([center.lon + dLon * Math.cos(a), center.lat + dLat * Math.sin(a)]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

export const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
