// The repeater map: MapLibre with the Gaia-like base style (mapStyle.ts) and
// our layers (mapLayers.ts): grouped repeater markers, the selection circle
// or a trail with its corridor, the open repeater, and stacked groups that
// fan out on click (mapSpider.ts). The map is created once; everything else
// is synced from props. Left click picks a point, right click clears.
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
import type { Track } from '../../lib/tracks/track.ts';
import { EMPTY, circleBounds, circlePolygon, corridorCircles, pointFeature, repeaterPoints } from './mapData.ts';
import { CLICKABLE_CLUSTERS, FIT, MAX_ZOOM, POINT_LAYERS, SPIDER_LAYERS, addRepeaterLayers } from './mapLayers.ts';
import { closeSpider, openSpider, shouldFanOut, type Spider } from './mapSpider.ts';
import { BASE_STYLE_URL, BRAZIL_BOUNDS, DEM_MAX_ZOOM, DEM_URL, RELIEF_ATTRIBUTION, buildStyle } from './mapStyle.ts';

maplibregl.setWorkerUrl(workerUrl);

/** Where the map should move to; a new object moves it again. */
export interface Focus {
  center?: Point;
  radiusKm?: number;
  zoom?: number;
  /** Fit these instead: [[west, south], [east, north]], e.g. a whole trail. */
  bounds?: [[number, number], [number, number]];
}

interface Props {
  repeaters: readonly Repeater[];
  /** A trail dropped on the map; drawn with a corridor `radiusKm` wide on each side. */
  track?: Track;
  /** Repeaters inside the circle or corridor. */
  inside: ReadonlySet<string>;
  center?: Point;
  radiusKm: number;
  /** Repeater whose details are open, outlined on the map. */
  activeId?: string;
  focus?: Focus;
  onPick: (point: Point) => void;
  /** Right click: forget the picked point or trail. */
  onClear: () => void;
  onSelect: (id: string) => void;
}

/** Map options that show `focus`, or all of Brazil. */
function initialView(focus: Focus | undefined): Partial<maplibregl.MapOptions> {
  if (focus?.bounds) return { bounds: focus.bounds, fitBoundsOptions: FIT };
  if (focus?.center) return { bounds: circleBounds(focus.center, focus.radiusKm ?? 50) };
  return { bounds: BRAZIL_BOUNDS };
}

const setSource = (map: maplibregl.Map, id: string, data: FeatureCollection) => (map.getSource(id) as GeoJSONSource).setData(data);

export function RepeaterMap({ repeaters, track, inside, center, radiusKm, activeId, focus, onPick, onClear, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  // Handlers change every render; the map's listeners read the latest ones.
  const handlers = useRef({ onPick, onClear, onSelect });
  handlers.current = { onPick, onClear, onSelect };
  // The focus the map was created with, so the focus effect does not move it again.
  const createdWith = useRef(focus);

  // The fanned-out group, if any; state so the open repeater's ring can follow it.
  const [spider, setSpider] = useState<Spider>();
  const spiderRef = useRef<Spider | undefined>(undefined);
  // Bumped whenever a fan-out would be stale (new data, a zoom, a fold), so a slow group click gives up.
  const spiderTurn = useRef(0);
  const unspider = () => {
    spiderTurn.current++;
    if (!spiderRef.current || !mapRef.current) return;
    closeSpider(mapRef.current);
    spiderRef.current = undefined;
    setSpider(undefined);
  };

  useEffect(() => {
    let cancelled = false;
    let map: maplibregl.Map | undefined;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && unspider();
    (async () => {
      const dem = new mlcontour.DemSource({ url: DEM_URL, encoding: 'terrarium', maxzoom: DEM_MAX_ZOOM, worker: true });
      dem.setupMaplibre(maplibregl);
      const res = await fetch(BASE_STYLE_URL);
      if (!res.ok) throw new Error(`estilo do mapa: HTTP ${res.status}`);
      const base = (await res.json()) as StyleSpecification;
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
      map = new maplibregl.Map({
        container: container.current,
        style,
        ...initialView(createdWith.current),
        maxBounds: BRAZIL_BOUNDS,
        minZoom: 3,
        maxZoom: MAX_ZOOM,
        // North stays up: the compass is hidden, and the right button clears instead of rotating.
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        attributionControl: { compact: true, customAttribution: RELIEF_ATTRIBUTION },
      });
      mapRef.current = map;
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

      map.on('load', () => {
        if (!map) return;
        addRepeaterLayers(map);
        // The credits start collapsed (an "i" button), so they do not cover the map on phones.
        map.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
        setReady(true);
      });

      // A group splits by zooming in; one that cannot (its repeaters share a spot) fans out instead.
      const onGroup = async (e: MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!map || !f || map.queryRenderedFeatures(e.point, { layers: SPIDER_LAYERS }).length) return;
        const turn = ++spiderTurn.current;
        const clusterId = f.properties.cluster_id as number;
        const hub = (f.geometry as GeoPoint).coordinates as [number, number];
        const source = map.getSource('repeaters') as GeoJSONSource;
        try {
          const [zoom, leaves] = await Promise.all([source.getClusterExpansionZoom(clusterId), source.getClusterLeaves(clusterId, 1000, 0)]);
          if (turn !== spiderTurn.current) return;
          const points = leaves as Parameters<typeof shouldFanOut>[0];
          if (!shouldFanOut(points, zoom)) return void map.easeTo({ center: hub, zoom });
          if (spiderRef.current) closeSpider(map);
          spiderRef.current = openSpider(map, clusterId, hub, points);
          setSpider(spiderRef.current);
        } catch {
          // The group vanished (new data) while its repeaters were being fetched.
        }
      };
      for (const layer of CLICKABLE_CLUSTERS) map.on('click', layer, onGroup);
      for (const layer of POINT_LAYERS) {
        map.on('click', layer, (e: MapLayerMouseEvent) => {
          const id = e.features?.[0]?.properties.id as string | undefined;
          if (id) handlers.current.onSelect(id);
        });
      }
      map.on('click', (e: MapMouseEvent) => {
        if (!map || map.queryRenderedFeatures(e.point, { layers: [...CLICKABLE_CLUSTERS, ...POINT_LAYERS] }).length) return;
        // The first click elsewhere only folds a fanned-out group back.
        if (spiderRef.current) {
          unspider();
          return;
        }
        handlers.current.onPick({ lat: e.lngLat.lat, lon: e.lngLat.lng });
      });
      map.on('contextmenu', (e: MapMouseEvent) => {
        e.preventDefault();
        // Android fires this on a long press while panning: clearing then would be an accident.
        if ((e.originalEvent as PointerEvent).pointerType === 'touch') return;
        unspider();
        handlers.current.onClear();
      });
      // Fanned-out markers sit at screen distances, which a zoom would break.
      map.on('zoomstart', unspider);
      map.getContainer().addEventListener('keydown', onKey);
      for (const layer of [...CLICKABLE_CLUSTERS, ...POINT_LAYERS]) {
        map.on('mouseenter', layer, () => (map!.getCanvas().style.cursor = 'pointer'));
        map.on('mouseleave', layer, () => (map!.getCanvas().style.cursor = ''));
      }
    })().catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
      map?.getContainer().removeEventListener('keydown', onKey);
      map?.remove();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    // Group ids change with the data, so a fanned-out group folds back.
    unspider();
    setSource(mapRef.current!, 'repeaters', repeaterPoints(repeaters, inside));
  }, [ready, repeaters, inside]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current!;
    setSource(map, 'circle', center ? { type: 'FeatureCollection', features: [circlePolygon(center, radiusKm)] } : EMPTY);
    setSource(map, 'center', center ? { type: 'FeatureCollection', features: [pointFeature([center.lon, center.lat])] } : EMPTY);
  }, [ready, center?.lat, center?.lon, radiusKm]);

  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current!;
    const line: FeatureCollection = track
      ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'MultiLineString', coordinates: track.lines.map((l) => l.map((p) => [p.lon, p.lat])) } }] }
      : EMPTY;
    setSource(map, 'track', line);
    setSource(map, 'track-corridor', track ? corridorCircles(track.lines, radiusKm) : EMPTY);
  }, [ready, track, radiusKm]);

  useEffect(() => {
    if (!ready) return;
    const r = activeId ? repeaters.find((x) => x.id === activeId) : undefined;
    // In a fanned-out group the ring goes around the repeater's fanned-out marker.
    const at = (activeId && spider?.positions.get(activeId)) || (r?.position ? ([r.position.lon, r.position.lat] as [number, number]) : undefined);
    setSource(mapRef.current!, 'active', at ? { type: 'FeatureCollection', features: [pointFeature(at)] } : EMPTY);
  }, [ready, activeId, repeaters, spider]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !focus || focus === createdWith.current) return;
    if (focus.bounds) map.fitBounds(focus.bounds, FIT);
    else if (!focus.center) return;
    else if (focus.zoom !== undefined) map.flyTo({ center: [focus.center.lon, focus.center.lat], zoom: focus.zoom });
    else map.fitBounds(circleBounds(focus.center, focus.radiusKm ?? radiusKm), { padding: 24, maxZoom: FIT.maxZoom });
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
