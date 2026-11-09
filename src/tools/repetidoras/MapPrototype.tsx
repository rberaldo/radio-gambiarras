// Map prototype (roadmap M3.6): the Gaia-like style with every repeater and
// a click-to-select 50 km circle, so the look can be judged before the tool
// is built. Throwaway: the real tool replaces it in M3.7.
import type { Feature, FeatureCollection, Point as GeoPoint, Polygon } from 'geojson';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, MapLayerMouseEvent, MapMouseEvent, StyleSpecification } from 'maplibre-gl';
import mlcontour from 'maplibre-contour';
import 'maplibre-gl/dist/maplibre-gl.css';
// The bundler moves MapLibre's code, so its worker is bundled separately and pointed to explicitly.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useEffect, useRef, useState } from 'preact/hooks';
import anatel from '../../../data/repeaters/anatel.json';
import neighbours from '../../../data/geo/vizinhos.json';
import overlay from '../../../data/repeaters/overlay.json';
import { withinRadius, type Point } from '../../lib/repeaters/geo.ts';
import { mergeRepeaters } from '../../lib/repeaters/merge.ts';
import type { OverlayFile } from '../../lib/repeaters/overlay.ts';
import type { AnatelRepeatersFile } from '../../lib/repeaters/types.ts';
import { BASE_STYLE_URL, BRAZIL_BOUNDS, DEM_MAX_ZOOM, DEM_URL, RELIEF_ATTRIBUTION, buildStyle } from './mapStyle.ts';

maplibregl.setWorkerUrl(workerUrl);

const REPEATERS = mergeRepeaters((anatel as AnatelRepeatersFile).repeaters, overlay as OverlayFile);
const RADIUS_KM = 50;

/** Repeaters as map points; `sel` is 1 for those inside the current circle, so clusters can count them. */
function toGeoJson(selected: ReadonlySet<string> = new Set()): FeatureCollection<GeoPoint> {
  return {
    type: 'FeatureCollection',
    features: REPEATERS.filter((r) => r.position).map((r) => ({
      type: 'Feature',
      properties: { id: r.id, callsign: r.callsign, band: r.band, exact: r.position!.exact, sel: selected.has(r.id) ? 1 : 0 },
      geometry: { type: 'Point', coordinates: [r.position!.lon, r.position!.lat] },
    })),
  };
}

/** A circle as a polygon, good enough on screen for radii up to a few hundred km. */
function circle(center: Point, km: number, steps = 96): Feature<Polygon> {
  const ring: number[][] = [];
  const dLat = km / 110.574;
  const dLon = km / (111.32 * Math.cos((center.lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    ring.push([center.lon + dLon * Math.cos(a), center.lat + dLat * Math.sin(a)]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

export default function MapPrototype() {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Carregando o mapa…');

  useEffect(() => {
    let map: maplibregl.Map | undefined;
    let cancelled = false;

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

      map = new maplibregl.Map({
        container: container.current,
        style,
        bounds: BRAZIL_BOUNDS,
        maxBounds: BRAZIL_BOUNDS,
        minZoom: 3,
        attributionControl: { compact: true, customAttribution: RELIEF_ATTRIBUTION },
      });
      // Prototype only: lets automated screenshots move the map.
      (window as unknown as { __map?: maplibregl.Map }).__map = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');

      map.on('load', () => {
        if (!map) return;
        map.addSource('repeaters', {
          type: 'geojson',
          data: toGeoJson(),
          cluster: true,
          clusterRadius: 28,
          clusterMaxZoom: 14,
          // Each cluster counts how many of its repeaters are inside the circle.
          clusterProperties: { sel: ['+', ['get', 'sel']] },
        });
        map.addSource('selection', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

        map.addLayer({ id: 'selection-fill', type: 'fill', source: 'selection', paint: { 'fill-color': '#000080', 'fill-opacity': 0.08 } });
        map.addLayer({ id: 'selection-line', type: 'line', source: 'selection', paint: { 'line-color': '#000080', 'line-width': 2, 'line-dasharray': [2, 1] } });
        map.addLayer({
          id: 'clusters',
          type: 'circle',
          source: 'repeaters',
          filter: ['has', 'point_count'],
          paint: {
            // All inside: green; some inside: green ring; none: white.
            'circle-color': ['case', ['==', ['get', 'sel'], ['get', 'point_count']], '#008000', '#ffffff'],
            'circle-stroke-color': ['case', ['>', ['get', 'sel'], 0], '#008000', '#000080'],
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
          },
          paint: {
            'text-color': ['case', ['==', ['get', 'sel'], ['get', 'point_count']], '#ffffff', ['>', ['get', 'sel'], 0], '#006400', '#000080'],
          },
        });
        map.addLayer({
          id: 'repeater-points',
          type: 'circle',
          source: 'repeaters',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-radius': ['case', ['==', ['get', 'sel'], 1], 7, 6],
            'circle-color': ['case', ['==', ['get', 'sel'], 1], '#008000', ['get', 'exact'], '#000080', '#ffffff'],
            'circle-stroke-color': ['case', ['==', ['get', 'sel'], 1], '#ffffff', '#000080'],
            'circle-stroke-width': 2,
          },
        });
        setStatus(`${REPEATERS.length} repetidoras. Clique num lugar para ver as que estão a até ${RADIUS_KM} km.`);
      });

      map.on('click', 'clusters', async (e: MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!map || !f) return;
        const zoom = await (map.getSource('repeaters') as GeoJSONSource).getClusterExpansionZoom(f.properties.cluster_id as number);
        map.easeTo({ center: (f.geometry as GeoPoint).coordinates as [number, number], zoom: Math.min(zoom, 14) });
      });

      map.on('click', (e: MapMouseEvent) => {
        if (!map || map.queryRenderedFeatures(e.point, { layers: ['clusters'] }).length) return;
        const center = { lat: e.lngLat.lat, lon: e.lngLat.lng };
        const near = withinRadius(REPEATERS, center, RADIUS_KM);
        (map.getSource('selection') as GeoJSONSource).setData(circle(center, RADIUS_KM));
        (map.getSource('repeaters') as GeoJSONSource).setData(toGeoJson(new Set(near.map((n) => n.repeater.id))));
        const exact = near.filter((n) => n.repeater.position?.exact).length;
        setStatus(
          `${near.length} repetidoras a até ${RADIUS_KM} km de ${center.lat.toFixed(4)}, ${center.lon.toFixed(4)}` +
            (near.length ? ` (${exact} com posição exata). Mais próxima: ${near[0]!.repeater.callsign}, ${near[0]!.distanceKm.toFixed(1).replace('.', ',')} km.` : '.'),
        );
      });
    })().catch((err: unknown) => setStatus(`Erro ao carregar o mapa: ${err instanceof Error ? err.message : String(err)}`));

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, []);

  return (
    <div class="map-proto">
      <p class="tool-summary" aria-live="polite">
        {status}
      </p>
      <div ref={container} class="map-proto__map" role="region" aria-label="Mapa de repetidoras" />
    </div>
  );
}
