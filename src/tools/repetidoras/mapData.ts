// GeoJSON for the map: repeaters as points (with flags clusters can count)
// and the selection circle.
import type { Feature, FeatureCollection, Point as GeoPoint, Polygon } from 'geojson';
import { isDigital } from '../../lib/repeaters/display.ts';
import { distanceKm, type Point } from '../../lib/repeaters/geo.ts';
import type { Repeater } from '../../lib/repeaters/merge.ts';

export interface PointProps {
  id: string;
  callsign: string;
  band: string;
  exact: boolean;
  /** Known to carry a digital mode: drawn as a diamond. */
  digital: boolean;
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
        properties: { id: r.id, callsign: r.callsign, band: r.band, exact: r.position!.exact, digital: isDigital(r), sel: selected.has(r.id) ? 1 : 0 },
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

/**
 * A trail's corridor as circles spaced along it, at most a quarter radius
 * apart, so their union is within 1% of the true outline. Drawn in one
 * fill-extrusion layer, whose opacity applies to the layer as a whole, so
 * overlaps (every circle, an out-and-back trail) do not darken.
 */
export function corridorCircles(lines: readonly (readonly Point[])[], km: number, maxCircles = 1500): FeatureCollection<Polygon> {
  const centers: Point[] = [];
  let lengthKm = 0;
  for (const line of lines) for (let i = 1; i < line.length; i++) lengthKm += distanceKm(line[i - 1]!, line[i]!);
  const step = Math.max(km / 4, lengthKm / maxCircles);
  for (const line of lines) {
    centers.push(line[0]!);
    let since = 0;
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1]!;
      const b = line[i]!;
      const d = distanceKm(a, b);
      // Fill the piece with evenly spaced centers, carrying the leftover into the next one.
      let at = step - since;
      while (at <= d) {
        const t = at / d;
        centers.push({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t });
        at += step;
      }
      since = d - (at - step);
    }
    centers.push(line[line.length - 1]!);
  }
  return { type: 'FeatureCollection', features: centers.map((c) => circlePolygon(c, km, 48)) };
}

export const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
