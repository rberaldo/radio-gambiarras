// Fanning out a group whose repeaters share one spot ("spiderfy"): the
// decision, and drawing it on the map. Offsets come from spider.ts.
import type { Feature, FeatureCollection, Point as GeoPoint } from 'geojson';
import type * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';
import { EMPTY, pointFeature } from './mapData.ts';
import { CLUSTER_LAYERS, MAX_ZOOM, SPIDER_SOURCES } from './mapLayers.ts';
import { spiderOffsets } from './spider.ts';

/** A group fanned out: where it came from and where each repeater was drawn. */
export interface Spider {
  clusterId: number;
  positions: ReadonlyMap<string, [number, number]>;
}

/**
 * Whether a clicked group should fan out rather than zoom in: when its
 * repeaters share one position (zooming never splits them), or when even the
 * deepest zoom would not split it.
 */
export function shouldFanOut(leaves: readonly Feature<GeoPoint>[], expansionZoom: number): boolean {
  if (expansionZoom > MAX_ZOOM) return true;
  const [x0, y0] = leaves[0]?.geometry.coordinates ?? [];
  return leaves.every(({ geometry: { coordinates: [x, y] } }) => x === x0 && y === y0);
}

/** Draws the group's repeaters around `hub`, hiding its badge meanwhile. */
export function openSpider(map: maplibregl.Map, clusterId: number, hub: [number, number], leaves: readonly Feature<GeoPoint>[]): Spider {
  const sorted = [...leaves].sort((a, b) => String(a.properties?.id).localeCompare(String(b.properties?.id)));
  const c = map.project(hub);
  const positions = new Map<string, [number, number]>();
  const markers = spiderOffsets(sorted.length).map(([dx, dy], i) => {
    const at = map.unproject([c.x + dx, c.y + dy]);
    const xy: [number, number] = [at.lng, at.lat];
    positions.set(String(sorted[i]!.properties?.id), xy);
    return pointFeature(xy, sorted[i]!.properties ?? {});
  });
  const legs: FeatureCollection = {
    type: 'FeatureCollection',
    features: markers.map((m) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [hub, m.geometry.coordinates] } })),
  };
  (map.getSource('spider') as GeoJSONSource).setData({ type: 'FeatureCollection', features: markers });
  (map.getSource('spider-legs') as GeoJSONSource).setData(legs);
  (map.getSource('spider-hub') as GeoJSONSource).setData({ type: 'FeatureCollection', features: [pointFeature(hub)] });
  for (const [layer, filter] of Object.entries(CLUSTER_LAYERS)) map.setFilter(layer, ['all', filter, ['!=', ['get', 'cluster_id'], clusterId]]);
  return { clusterId, positions };
}

export function closeSpider(map: maplibregl.Map) {
  for (const id of SPIDER_SOURCES) (map.getSource(id) as GeoJSONSource | undefined)?.setData(EMPTY);
  for (const [layer, filter] of Object.entries(CLUSTER_LAYERS)) map.setFilter(layer, filter);
}
