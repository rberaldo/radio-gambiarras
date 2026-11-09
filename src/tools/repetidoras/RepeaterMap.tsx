// The repeater map: MapLibre with the Gaia-like style (mapStyle.ts),
// clustered repeater markers, the selection circle and the open repeater.
// Created once; everything else is synced from props.
import type { FeatureCollection, Point as GeoPoint } from 'geojson';
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
      img.data.set([parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16), 255], i);
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
  onSelect: (id: string) => void;
}

function addRepeaterLayers(map: maplibregl.Map) {
  map.addSource('repeaters', {
    type: 'geojson',
    data: EMPTY,
    cluster: true,
    clusterRadius: 28,
    clusterMaxZoom: 14,
    // Each cluster counts how many of its repeaters are inside the circle.
    clusterProperties: { sel: ['+', ['get', 'sel']] },
  });
  map.addSource('circle', { type: 'geojson', data: EMPTY });
  map.addSource('active', { type: 'geojson', data: EMPTY });
  map.addSource('center', { type: 'geojson', data: EMPTY });
  map.addImage('center-pin', pinImage(), { pixelRatio: 2 });

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
    filter: ['has', 'point_count'],
    paint: {
      // All inside: green; some inside: green ring; none: white.
      'circle-color': ['case', ['==', ['get', 'sel'], ['get', 'point_count']], COLORS.green, COLORS.white],
      'circle-stroke-color': ['case', ['>', ['get', 'sel'], 0], COLORS.green, COLORS.navy],
      'circle-stroke-width': ['case', ['>', ['get', 'sel'], 0], 3, 2],
      'circle-radius': ['step', ['get', 'point_count'], 11, 10, 14, 50, 18],
    },
  });
  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'repeaters',
    filter: ['has', 'point_count'],
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
      'text-color': ['case', ['==', ['get', 'sel'], ['get', 'point_count']], COLORS.white, ['>', ['get', 'sel'], 0], COLORS.darkGreen, COLORS.navy],
    },
  });
  map.addLayer({
    id: 'repeater-points',
    type: 'circle',
    source: 'repeaters',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-radius': ['case', ['==', ['get', 'sel'], 1], 7, 6],
      // Exact positions are filled, approximate ones (município seat) hollow.
      'circle-color': ['case', ['==', ['get', 'sel'], 1], COLORS.green, ['get', 'exact'], COLORS.navy, COLORS.white],
      'circle-stroke-color': ['case', ['==', ['get', 'sel'], 1], COLORS.white, COLORS.navy],
      'circle-stroke-width': 2,
    },
  });
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

export function RepeaterMap({ repeaters, inside, center, radiusKm, activeId, focus, onPick, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  // Handlers change every render; the map's listeners read the latest ones.
  const handlers = useRef({ onPick, onSelect });
  handlers.current = { onPick, onSelect };

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
      map.on('click', 'clusters', async (e: MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!map || !f) return;
        const zoom = await (map.getSource('repeaters') as GeoJSONSource).getClusterExpansionZoom(f.properties.cluster_id as number);
        map.easeTo({ center: (f.geometry as GeoPoint).coordinates as [number, number], zoom: Math.min(zoom, 15) });
      });
      map.on('click', 'repeater-points', (e: MapLayerMouseEvent) => {
        const id = e.features?.[0]?.properties.id as string | undefined;
        if (id) handlers.current.onSelect(id);
      });
      map.on('click', (e: MapMouseEvent) => {
        if (!map || map.queryRenderedFeatures(e.point, { layers: ['clusters', 'repeater-points'] }).length) return;
        handlers.current.onPick({ lat: e.lngLat.lat, lon: e.lngLat.lng });
      });
      for (const layer of ['clusters', 'repeater-points']) {
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
    if (ready) (mapRef.current!.getSource('repeaters') as GeoJSONSource).setData(repeaterPoints(repeaters, inside));
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
    const data: FeatureCollection = r?.position
      ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [r.position.lon, r.position.lat] } }] }
      : EMPTY;
    (mapRef.current!.getSource('active') as GeoJSONSource).setData(data);
  }, [ready, activeId, repeaters]);

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
