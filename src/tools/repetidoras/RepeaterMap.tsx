// The repeater map: MapLibre with the Gaia-like style (mapStyle.ts),
// clustered repeater markers, the selection circle and the open repeater.
// Created once; everything else is synced from props.
import type { Feature, FeatureCollection, Point as GeoPoint } from 'geojson';
import mlcontour from 'maplibre-contour';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, MapLayerMouseEvent, MapMouseEvent, StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// The bundler moves MapLibre's code, so its worker is bundled separately and pointed to explicitly.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useEffect, useRef, useState } from 'preact/hooks';
import neighbours from '../../../data/geo/vizinhos.json';
import type { Point } from '../../lib/repeaters/geo.ts';
import type { Repeater } from '../../lib/repeaters/merge.ts';
import { EMPTY, circlePolygon, repeaterPoints } from './mapData.ts';
import { spiderOffsets } from './spider.ts';
import { BASE_STYLE_URL, BRAZIL_BOUNDS, DEM_MAX_ZOOM, DEM_URL, RELIEF_ATTRIBUTION, buildStyle } from './mapStyle.ts';

maplibregl.setWorkerUrl(workerUrl);

const COLORS = { navy: '#000080', green: '#008000', darkGreen: '#006400', white: '#ffffff', gold: '#ffcc00', red: '#cc0000', black: '#000000' };

// The clicked point, as a pixel-art pushpin (X outline, R red, W white); the needle's tip is the point.
const PIN = [
  '...XXXXX...',
  '..XRRRRRX..',
  '.XRRRRRRRX.',
  '.XRRWWWRRX.',
  'XRRWWWWWRRX',
  'XRRWWWWWRRX',
  'XRRWWWWWRRX',
  '.XRRWWWRRX.',
  '.XRRRRRRRX.',
  '..XRRRRRX..',
  '..XRRRRRX..',
  '...XRRRX...',
  '....XXX....',
  // A long needle, so the head clears a repeater badge on the same spot.
  ...Array<string>(12).fill('.....X.....'),
];
const PIN_SCALE = 4; // device pixels per pin pixel, shown at pixelRatio 2

function pinImage(): ImageData {
  const w = PIN[0]!.length * PIN_SCALE;
  const h = PIN.length * PIN_SCALE;
  const img = new ImageData(w, h);
  const rgb: Record<string, string> = { X: COLORS.black, R: COLORS.red, W: COLORS.white };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = rgb[PIN[Math.floor(y / PIN_SCALE)]![Math.floor(x / PIN_SCALE)]!];
      if (!c) continue;
      const i = (y * w + x) * 4;
      img.data.set(rgba(c), i);
    }
  }
  return img;
}

const rgba = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255];

/**
 * A diamond for digital repeaters and all-digital groups. `half` is the
 * half-diagonal and `width` the outline, in device pixels (shown at
 * pixelRatio 2, so 4 means 2 CSS pixels, like the circles' outline).
 */
function diamondImage(half: number, fill: string, line: string, width = 4): ImageData {
  const size = half * 2 + 1;
  const img = new ImageData(size, size);
  const inner = half - Math.round(width * Math.SQRT2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.abs(x - half) + Math.abs(y - half);
      if (d > half) continue;
      img.data.set(rgba(d > inner ? line : fill), (y * size + x) * 4);
    }
  }
  return img;
}

/** Where the map should move to; a new object moves it again. */
export interface Focus {
  center: Point;
  radiusKm?: number;
  zoom?: number;
}

interface Props {
  repeaters: readonly Repeater[];
  /** Repeaters inside the circle. */
  inside: ReadonlySet<string>;
  center?: Point;
  radiusKm: number;
  /** Repeater whose details are open, outlined on the map. */
  activeId?: string;
  focus?: Focus;
  onPick: (point: Point) => void;
  /** Right click: forget the picked point. */
  onClear: () => void;
  onSelect: (id: string) => void;
}

/** Layers with one clickable repeater per feature. */
const POINT_LAYERS = ['repeater-points', 'repeater-diamonds', 'spider-points', 'spider-diamonds'];

/** The deepest zoom. Stacks stay grouped up to here, so they never hide behind one marker. */
const MAX_ZOOM = 17;

const CLUSTER_FILTER: maplibregl.ExpressionSpecification = ['has', 'point_count'];

// One visual meaning per trait (decided with the user, 2026-11-09):
//   shape: circle = FM, diamond = digital (a group: diamond only when all are digital)
//   fill:  solid = known site, hollow = town seat
//   color: green = inside the selection circle, navy = outside
const SEL: maplibregl.ExpressionSpecification = ['==', ['get', 'sel'], 1];
const LINE: maplibregl.ExpressionSpecification = ['case', SEL, COLORS.green, COLORS.navy];

/** One repeater per marker: circles for FM, diamonds for digital. */
function addMarkerLayers(map: maplibregl.Map, prefix: string, source: string, filter: maplibregl.ExpressionSpecification) {
  map.addLayer({
    id: `${prefix}-points`,
    type: 'circle',
    source,
    filter: ['all', filter, ['!', ['get', 'digital']]],
    paint: {
      'circle-radius': 6,
      'circle-color': ['case', ['get', 'exact'], LINE, COLORS.white],
      'circle-stroke-color': LINE,
      'circle-stroke-width': 2,
    },
  });
  map.addLayer({
    id: `${prefix}-diamonds`,
    type: 'symbol',
    source,
    filter: ['all', filter, ['get', 'digital']],
    layout: {
      'icon-image': ['concat', 'diamond-', ['case', SEL, 'in', 'out'], '-', ['case', ['get', 'exact'], 'exact', 'approx']],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
}

/** Group badges: circles, or diamonds when every repeater in the group is digital. */
const ALL_DIGITAL: maplibregl.ExpressionSpecification = ['==', ['get', 'dig'], ['get', 'point_count']];
const SOME_DIGITAL: maplibregl.ExpressionSpecification = ['all', ['>', ['get', 'dig'], 0], ['<', ['get', 'dig'], ['get', 'point_count']]];
const ALL_IN: maplibregl.ExpressionSpecification = ['==', ['get', 'sel'], ['get', 'point_count']];
const SOME_IN: maplibregl.ExpressionSpecification = ['>', ['get', 'sel'], 0];
/** Badge radius in CSS pixels by group size. */
const BADGE_RADIUS: maplibregl.ExpressionSpecification = ['step', ['get', 'point_count'], 11, 10, 14, 50, 18];

/** Layers drawing group badges, with their own filters; a fanned-out group is hidden from all of them. */
const CLUSTER_LAYERS: Record<string, maplibregl.ExpressionSpecification> = {
  clusters: ['all', CLUSTER_FILTER, ['!', ALL_DIGITAL]],
  'cluster-diamonds': ['all', CLUSTER_FILTER, ALL_DIGITAL],
  'cluster-notch': ['all', CLUSTER_FILTER, SOME_DIGITAL],
  'cluster-count': CLUSTER_FILTER,
};
const CLICKABLE_CLUSTERS = ['clusters', 'cluster-diamonds'];

function addRepeaterLayers(map: maplibregl.Map) {
  map.addSource('repeaters', {
    type: 'geojson',
    data: EMPTY,
    cluster: true,
    clusterRadius: 28,
    clusterMaxZoom: MAX_ZOOM,
    // Each cluster counts how many of its repeaters are inside the circle, and how many are digital.
    clusterProperties: { sel: ['+', ['get', 'sel']], dig: ['+', ['case', ['get', 'digital'], 1, 0]] },
  });
  map.addSource('circle', { type: 'geojson', data: EMPTY });
  map.addSource('active', { type: 'geojson', data: EMPTY });
  map.addSource('center', { type: 'geojson', data: EMPTY });
  map.addSource('spider', { type: 'geojson', data: EMPTY });
  map.addSource('spider-legs', { type: 'geojson', data: EMPTY });
  map.addSource('spider-hub', { type: 'geojson', data: EMPTY });
  map.addImage('center-pin', pinImage(), { pixelRatio: 2 });
  for (const [where, line] of [['in', COLORS.green], ['out', COLORS.navy]] as const) {
    map.addImage(`diamond-${where}-exact`, diamondImage(21, line, line), { pixelRatio: 2 });
    map.addImage(`diamond-${where}-approx`, diamondImage(21, COLORS.white, line), { pixelRatio: 2 });
  }
  // Group badges at the size of the smallest circle badge, scaled up with icon-size.
  map.addImage('cluster-diamond-all', diamondImage(30, COLORS.green, COLORS.green, 6), { pixelRatio: 2 });
  map.addImage('cluster-diamond-some', diamondImage(30, COLORS.white, COLORS.green, 6), { pixelRatio: 2 });
  map.addImage('cluster-diamond-none', diamondImage(30, COLORS.white, COLORS.navy, 4), { pixelRatio: 2 });
  map.addImage('cluster-notch', diamondImage(11, COLORS.navy, COLORS.white, 3), { pixelRatio: 2 });

  map.addLayer({ id: 'circle-fill', type: 'fill', source: 'circle', paint: { 'fill-color': COLORS.navy, 'fill-opacity': 0.08 } });
  map.addLayer({ id: 'circle-line', type: 'line', source: 'circle', paint: { 'line-color': COLORS.navy, 'line-width': 2, 'line-dasharray': [2, 1] } });
  // Under the badges, so a cluster on the same spot keeps its count readable.
  map.addLayer({
    id: 'center-pin',
    type: 'symbol',
    source: 'center',
    layout: { 'icon-image': 'center-pin', 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-ignore-placement': true },
  });
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'repeaters',
    filter: CLUSTER_LAYERS.clusters,
    paint: {
      // All inside: green; some inside: green ring; none: white.
      'circle-color': ['case', ALL_IN, COLORS.green, COLORS.white],
      'circle-stroke-color': ['case', SOME_IN, COLORS.green, COLORS.navy],
      'circle-stroke-width': ['case', SOME_IN, 3, 2],
      'circle-radius': BADGE_RADIUS,
    },
  });
  map.addLayer({
    id: 'cluster-diamonds',
    type: 'symbol',
    source: 'repeaters',
    filter: CLUSTER_LAYERS['cluster-diamonds'],
    layout: {
      'icon-image': ['case', ALL_IN, 'cluster-diamond-all', SOME_IN, 'cluster-diamond-some', 'cluster-diamond-none'],
      // The image is 15 px across its half-diagonal; diamonds need about 1.35× a circle's radius to look as big.
      'icon-size': ['step', ['get', 'point_count'], 1, 10, 1.25, 50, 1.6],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
  // Some digital in a mixed group: a small diamond on the badge's upper right.
  map.addLayer({
    id: 'cluster-notch',
    type: 'symbol',
    source: 'repeaters',
    filter: CLUSTER_LAYERS['cluster-notch'],
    layout: {
      'icon-image': 'cluster-notch',
      'icon-offset': ['step', ['get', 'point_count'], ['literal', [9, -9]], 10, ['literal', [11, -11]], 50, ['literal', [14, -14]]],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });
  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'repeaters',
    filter: CLUSTER_LAYERS['cluster-count'],
    layout: {
      // "2/4" when only some of the cluster is inside the circle.
      'text-field': [
        'case',
        ['all', ['>', ['get', 'sel'], 0], ['<', ['get', 'sel'], ['get', 'point_count']]],
        ['concat', ['to-string', ['get', 'sel']], '/', ['to-string', ['get', 'point_count']]],
        ['get', 'point_count_abbreviated'],
      ],
      'text-font': ['Noto Sans Bold'],
      'text-size': 11,
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': ['case', ALL_IN, COLORS.white, SOME_IN, COLORS.darkGreen, COLORS.navy],
    },
  });
  addMarkerLayers(map, 'repeater', 'repeaters', ['!', ['has', 'point_count']]);
  // A stack fanned out: thin legs to the shared point, then the markers.
  map.addLayer({ id: 'spider-legs', type: 'line', source: 'spider-legs', paint: { 'line-color': COLORS.navy, 'line-width': 1.5 } });
  map.addLayer({
    id: 'spider-hub',
    type: 'circle',
    source: 'spider-hub',
    paint: { 'circle-radius': 4, 'circle-color': COLORS.navy, 'circle-stroke-color': COLORS.white, 'circle-stroke-width': 1.5 },
  });
  addMarkerLayers(map, 'spider', 'spider', ['literal', true]);
  map.addLayer({
    id: 'active-point',
    type: 'circle',
    source: 'active',
    paint: { 'circle-radius': 11, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': COLORS.gold, 'circle-stroke-width': 3 },
  });
}

/** Bounds that show a circle of `km` around a point. */
function circleBounds(c: Point, km: number): [[number, number], [number, number]] {
  const dLat = km / 110.574;
  const dLon = km / (111.32 * Math.cos((c.lat * Math.PI) / 180));
  return [
    [c.lon - dLon, c.lat - dLat],
    [c.lon + dLon, c.lat + dLat],
  ];
}

/** A stack fanned out: the cluster it came from and where each repeater was drawn. */
interface Spider {
  clusterId: number;
  positions: ReadonlyMap<string, [number, number]>;
}

const SPIDER_LAYERS = ['spider-points', 'spider-diamonds'];
const SPIDER_SOURCES = ['spider', 'spider-legs', 'spider-hub'];

const pointFeature = (coordinates: [number, number], properties: Record<string, unknown> = {}): Feature<GeoPoint> => ({
  type: 'Feature',
  properties,
  geometry: { type: 'Point', coordinates },
});

/** Fans out a cluster's repeaters around its point, hiding the cluster badge meanwhile. */
async function openSpider(map: maplibregl.Map, clusterId: number, hub: [number, number]): Promise<Spider> {
  const source = map.getSource('repeaters') as GeoJSONSource;
  const leaves = (await source.getClusterLeaves(clusterId, 1000, 0)) as Feature<GeoPoint>[];
  leaves.sort((a, b) => String(a.properties?.id).localeCompare(String(b.properties?.id)));
  const c = map.project(hub);
  const positions = new Map<string, [number, number]>();
  const markers = spiderOffsets(leaves.length).map(([dx, dy], i) => {
    const at = map.unproject([c.x + dx, c.y + dy]);
    const xy: [number, number] = [at.lng, at.lat];
    positions.set(String(leaves[i]!.properties?.id), xy);
    return pointFeature(xy, leaves[i]!.properties ?? {});
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

function closeSpider(map: maplibregl.Map) {
  for (const id of SPIDER_SOURCES) (map.getSource(id) as GeoJSONSource | undefined)?.setData(EMPTY);
  for (const [layer, filter] of Object.entries(CLUSTER_LAYERS)) map.setFilter(layer, filter);
}

export function RepeaterMap({ repeaters, inside, center, radiusKm, activeId, focus, onPick, onClear, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  // Handlers change every render; the map's listeners read the latest ones.
  const handlers = useRef({ onPick, onClear, onSelect });
  handlers.current = { onPick, onClear, onSelect };
  // The fanned-out stack, if any; state so the open repeater's ring can follow it.
  const [spider, setSpider] = useState<Spider>();
  const spiderRef = useRef<Spider | undefined>(undefined);
  spiderRef.current = spider;
  const unspider = () => {
    if (!spiderRef.current || !mapRef.current) return;
    closeSpider(mapRef.current);
    spiderRef.current = undefined;
    setSpider(undefined);
  };

  useEffect(() => {
    let cancelled = false;
    let map: maplibregl.Map | undefined;
    (async () => {
      const dem = new mlcontour.DemSource({ url: DEM_URL, encoding: 'terrarium', maxzoom: DEM_MAX_ZOOM, worker: true });
      dem.setupMaplibre(maplibregl);
      const base = (await (await fetch(BASE_STYLE_URL)).json()) as StyleSpecification;
      if (cancelled || !container.current) return;
      const style = buildStyle(base, {
        demUrl: dem.sharedDemProtocolUrl,
        contourUrl: dem.contourProtocolUrl({
          thresholds: { 11: [100, 500], 12: [50, 250], 13: [20, 100], 14: [20, 100], 15: [10, 50] },
          elevationKey: 'ele',
          levelKey: 'level',
          contourLayer: 'contours',
          overzoom: 1,
        }),
        neighbours: neighbours as never,
      });
      const initial = focus ? { bounds: circleBounds(focus.center, focus.radiusKm ?? 50) } : { bounds: BRAZIL_BOUNDS };
      map = new maplibregl.Map({
        container: container.current,
        style,
        ...initial,
        maxBounds: BRAZIL_BOUNDS,
        minZoom: 3,
        maxZoom: MAX_ZOOM,
        // North stays up: the compass is hidden, and the right button clears the point instead of rotating.
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        attributionControl: { compact: true, customAttribution: RELIEF_ATTRIBUTION },
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

      map.on('load', () => {
        if (!map) return;
        addRepeaterLayers(map);
        // The credits start collapsed (an "i" button), so they do not cover the map on phones.
        map.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
        setReady(true);
      });
      // A cluster splits by zooming in; one that cannot (its repeaters share a spot) fans out instead.
      const onCluster = async (e: MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!map || !f || map.queryRenderedFeatures(e.point, { layers: SPIDER_LAYERS }).length) return;
        const clusterId = f.properties.cluster_id as number;
        const hub = (f.geometry as GeoPoint).coordinates as [number, number];
        const source = map.getSource('repeaters') as GeoJSONSource;
        const [zoom, leaves] = await Promise.all([source.getClusterExpansionZoom(clusterId), source.getClusterLeaves(clusterId, 1000, 0)]);
        const [x0, y0] = (leaves[0]!.geometry as GeoPoint).coordinates;
        const together = leaves.every((l) => {
          const [x, y] = (l.geometry as GeoPoint).coordinates;
          return x === x0 && y === y0;
        });
        if (!together && zoom <= MAX_ZOOM) {
          map.easeTo({ center: hub, zoom });
          return;
        }
        if (spiderRef.current) closeSpider(map);
        const opened = await openSpider(map, clusterId, hub);
        spiderRef.current = opened;
        setSpider(opened);
      };
      for (const layer of CLICKABLE_CLUSTERS) map.on('click', layer, onCluster);
      for (const layer of POINT_LAYERS) {
        map.on('click', layer, (e: MapLayerMouseEvent) => {
          const id = e.features?.[0]?.properties.id as string | undefined;
          if (id) handlers.current.onSelect(id);
        });
      }
      map.on('click', (e: MapMouseEvent) => {
        if (!map || map.queryRenderedFeatures(e.point, { layers: [...CLICKABLE_CLUSTERS, ...POINT_LAYERS] }).length) return;
        // The first click elsewhere only folds a fanned-out stack back.
        if (spiderRef.current) return unspider();
        handlers.current.onPick({ lat: e.lngLat.lat, lon: e.lngLat.lng });
      });
      map.on('contextmenu', (e: MapMouseEvent) => {
        e.preventDefault();
        unspider();
        handlers.current.onClear();
      });
      map.touchZoomRotate.disableRotation();
      // Fanned-out markers sit at screen distances, which a zoom would break.
      map.on('zoomstart', unspider);
      map.getContainer().addEventListener('keydown', (e) => e.key === 'Escape' && unspider());
      for (const layer of [...CLICKABLE_CLUSTERS, ...POINT_LAYERS]) {
        map.on('mouseenter', layer, () => (map!.getCanvas().style.cursor = 'pointer'));
        map.on('mouseleave', layer, () => (map!.getCanvas().style.cursor = ''));
      }
    })().catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    // Cluster ids change with the data, so a fanned-out stack folds back.
    unspider();
    (mapRef.current!.getSource('repeaters') as GeoJSONSource).setData(repeaterPoints(repeaters, inside));
  }, [ready, repeaters, inside]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current!;
    (map.getSource('circle') as GeoJSONSource).setData(center ? circlePolygon(center, radiusKm) : EMPTY);
    const pin: FeatureCollection = center
      ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [center.lon, center.lat] } }] }
      : EMPTY;
    (map.getSource('center') as GeoJSONSource).setData(pin);
  }, [ready, center?.lat, center?.lon, radiusKm]);

  useEffect(() => {
    if (!ready) return;
    const r = activeId ? repeaters.find((x) => x.id === activeId) : undefined;
    // In a fanned-out stack the ring goes around the repeater's fanned-out marker.
    const at = (activeId && spider?.positions.get(activeId)) ?? (r?.position ? ([r.position.lon, r.position.lat] as [number, number]) : undefined);
    const data: FeatureCollection = at ? { type: 'FeatureCollection', features: [pointFeature(at)] } : EMPTY;
    (mapRef.current!.getSource('active') as GeoJSONSource).setData(data);
  }, [ready, activeId, repeaters, spider]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !focus) return;
    if (focus.zoom !== undefined) map.flyTo({ center: [focus.center.lon, focus.center.lat], zoom: focus.zoom });
    else map.fitBounds(circleBounds(focus.center, focus.radiusKm ?? radiusKm), { padding: 24, maxZoom: 13 });
  }, [ready, focus]);

  return (
    <div class="rp-map">
      <div ref={container} class="rp-map__canvas" role="region" aria-label="Mapa de repetidoras" />
      {error && (
        <p class="rp-map__error" role="alert">
          Não foi possível carregar o mapa ({error}). A lista e os downloads continuam funcionando.
        </p>
      )}
    </div>
  );
}
