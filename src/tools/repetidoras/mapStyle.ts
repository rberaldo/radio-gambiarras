// A Gaia GPS-like topographic style for Brazil, built on OpenFreeMap's
// "Liberty" style: warm paper land, soft water and vegetation, Portuguese
// labels, multidirectional hillshade, labelled contour lines and peaks with
// elevations, and the neighbouring countries faded so Brazil stands out.
// Sources and attribution: docs/data-sources.md ("Map services").
import type { MultiPolygon } from 'geojson';
import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl';

export const BASE_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
export const DEM_URL = 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp';
export const DEM_MAX_ZOOM = 12;
export const RELIEF_ATTRIBUTION =
  'Relevo © <a href="https://mapterhorn.com/attribution" target="_blank" rel="noopener">Mapterhorn</a> (Copernicus GLO-30)';

/** Generous box around Brazil, including the oceanic islands. */
export const BRAZIL_BOUNDS: [[number, number], [number, number]] = [
  [-75.5, -35.5],
  [-27.5, 7.0],
];

const PALETTE = {
  land: '#f4f1e8',
  water: '#a6cbe6',
  waterway: '#86b6dc',
  wood: '#cfe3bd',
  grass: '#e2ecd2',
  park: '#d3e6c2',
  residential: '#ebe6dc',
  contour: '#a87d52',
  contourIndex: '#8c6239',
  peak: '#6b4526',
  mask: '#e6e2d8',
};

/** Portuguese name when OpenStreetMap has one, else the local name. */
const PT_NAME: ExpressionSpecification = ['coalesce', ['get', 'name:pt'], ['get', 'name']];

/** Layers of the base style we do not want (blurry raster relief, 3D buildings). */
const DROP = new Set(['natural_earth', 'building-3d']);

const RECOLOR: Record<string, Record<string, unknown>> = {
  background: { 'background-color': PALETTE.land },
  water: { 'fill-color': PALETTE.water },
  waterway_river: { 'line-color': PALETTE.waterway },
  waterway_other: { 'line-color': PALETTE.waterway },
  waterway_tunnel: { 'line-color': PALETTE.waterway },
  landcover_wood: { 'fill-color': PALETTE.wood, 'fill-opacity': 0.8 },
  landcover_grass: { 'fill-color': PALETTE.grass, 'fill-opacity': 0.6 },
  park: { 'fill-color': PALETTE.park, 'fill-opacity': 0.6 },
  landuse_residential: { 'fill-color': PALETTE.residential },
};

export interface StyleOptions {
  /** URL of the shared DEM protocol (maplibre-contour), used by the hillshade. */
  demUrl: string;
  /** URL template of the contour vector tiles (maplibre-contour). */
  contourUrl: string;
  /**
   * Land of Brazil's neighbours as a GeoJSON MultiPolygon, faded so Brazil
   * stands out. Only land: fading "everything but Brazil" would also grey
   * the sea and bays such as Guanabara.
   */
  neighbours: MultiPolygon;
}

export function buildStyle(base: StyleSpecification, opts: StyleOptions): StyleSpecification {
  const layers: LayerSpecification[] = [];
  for (const layer of base.layers) {
    if (DROP.has(layer.id)) continue;
    const l = structuredClone(layer) as LayerSpecification & { paint?: Record<string, unknown>; layout?: Record<string, unknown> };
    if (RECOLOR[l.id]) l.paint = { ...l.paint, ...RECOLOR[l.id] };
    // Only name labels switch to Portuguese; road shields show numbers ("ref").
    if (l.type === 'symbol' && JSON.stringify(l.layout?.['text-field'] ?? '').includes('name')) l.layout!['text-field'] = PT_NAME;
    layers.push(l);
  }

  // Relief, contours and the mask go below the first label layer.
  const firstSymbol = layers.findIndex((l) => l.type === 'symbol');
  const relief: LayerSpecification[] = [
    {
      id: 'hillshade',
      type: 'hillshade',
      source: 'dem',
      paint: {
        'hillshade-method': 'multidirectional',
        // Soft when zoomed out (whole states), stronger in the mountains.
        // Elevation data stops at zoom 12, so the shading softens beyond it.
        'hillshade-exaggeration': ['interpolate', ['linear'], ['zoom'], 5, 0.12, 9, 0.25, 12, 0.35, 14, 0.25],
        'hillshade-shadow-color': '#6e6c7d',
        'hillshade-highlight-color': '#ffffff',
        'hillshade-accent-color': '#5e5a50',
      },
    } as LayerSpecification,
    {
      id: 'contours',
      type: 'line',
      source: 'contours',
      'source-layer': 'contours',
      minzoom: 11,
      paint: {
        'line-color': ['match', ['get', 'level'], 1, PALETTE.contourIndex, PALETTE.contour],
        'line-opacity': ['match', ['get', 'level'], 1, 0.6, 0.35],
        'line-width': ['match', ['get', 'level'], 1, 1.1, 0.6],
      },
    },
    {
      id: 'neighbours-fade',
      type: 'fill',
      source: 'neighbours',
      paint: { 'fill-color': PALETTE.mask, 'fill-opacity': 0.75 },
    },
  ];
  layers.splice(firstSymbol, 0, ...relief);

  layers.push(
    {
      id: 'contour-labels',
      type: 'symbol',
      source: 'contours',
      'source-layer': 'contours',
      minzoom: 12,
      filter: ['==', ['get', 'level'], 1],
      layout: {
        'symbol-placement': 'line',
        'text-field': ['concat', ['number-format', ['get', 'ele'], { locale: 'pt-BR' }], ' m'],
        'text-font': ['Noto Sans Regular'],
        'text-size': 10,
      },
      paint: { 'text-color': PALETTE.contourIndex, 'text-halo-color': PALETTE.land, 'text-halo-width': 1.2 },
    },
    {
      id: 'peaks',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'mountain_peak',
      minzoom: 9,
      filter: ['has', 'ele'],
      layout: {
        'text-field': ['concat', '▲ ', ['coalesce', ['get', 'name:pt'], ['get', 'name']], '\n', ['number-format', ['get', 'ele'], { locale: 'pt-BR' }], ' m'],
        'text-font': ['Noto Sans Bold'],
        'text-size': 11,
        'text-anchor': 'top',
        'symbol-sort-key': ['-', 0, ['get', 'ele']],
      },
      paint: { 'text-color': PALETTE.peak, 'text-halo-color': PALETTE.land, 'text-halo-width': 1.5 },
    },
  );

  return {
    ...base,
    sources: {
      ...Object.fromEntries(Object.entries(base.sources).filter(([id]) => id !== 'ne2_shaded')),
      dem: { type: 'raster-dem', tiles: [opts.demUrl], tileSize: 512, maxzoom: DEM_MAX_ZOOM, encoding: 'terrarium', bounds: [-75.5, -35.5, -27.5, 7.0] },
      contours: { type: 'vector', tiles: [opts.contourUrl], maxzoom: 15 },
      neighbours: { type: 'geojson', data: opts.neighbours },
    },
    layers,
  };
}
