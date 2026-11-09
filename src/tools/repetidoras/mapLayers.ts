// The map's own sources, images and layers, on top of the base style
// (mapStyle.ts). Added once when the style has loaded; RepeaterMap only
// fills the sources and toggles filters afterwards.
import type * as maplibregl from 'maplibre-gl';
import { EMPTY } from './mapData.ts';
import { diamondImage, pinImage } from './markerImages.ts';

type Expr = maplibregl.ExpressionSpecification;

/**
 * MapLibre paints with plain colors, not CSS variables, so these mirror the
 * tokens: navy is --c-select / --m-select, green --m-free, purple --m-trail.
 */
export const COLORS = {
  navy: '#000080',
  green: '#008000',
  darkGreen: '#006400',
  purple: '#800080',
  white: '#ffffff',
  gold: '#ffcc00',
  red: '#cc0000',
  black: '#000000',
};

/** The deepest zoom. Stacks stay grouped up to here, so they never hide behind one marker. */
export const MAX_ZOOM = 17;

/** How the map frames a trail or a link's area. */
export const FIT = { padding: 48, maxZoom: 13 };

/** Layers with one clickable repeater per feature. */
export const SPIDER_LAYERS = ['spider-points', 'spider-diamonds'];
export const POINT_LAYERS = ['repeater-points', 'repeater-diamonds', ...SPIDER_LAYERS];
export const SPIDER_SOURCES = ['spider', 'spider-legs', 'spider-hub'];

// One visual meaning per trait (decided with the user, 2026-11-09):
//   shape: circle = FM, diamond = digital (a group: diamond only when all are digital)
//   fill:  solid = known site, hollow = town seat
//   color: green = inside the circle or corridor, navy = outside
const SEL: Expr = ['==', ['get', 'sel'], 1];
const LINE: Expr = ['case', SEL, COLORS.green, COLORS.navy];

const CLUSTER: Expr = ['has', 'point_count'];
const ALL_DIGITAL: Expr = ['==', ['get', 'dig'], ['get', 'point_count']];
const SOME_DIGITAL: Expr = ['all', ['>', ['get', 'dig'], 0], ['<', ['get', 'dig'], ['get', 'point_count']]];
const ALL_IN: Expr = ['==', ['get', 'sel'], ['get', 'point_count']];
const SOME_IN: Expr = ['>', ['get', 'sel'], 0];

/** Layers drawing group badges, with their filters; a fanned-out group is hidden from all of them. */
export const CLUSTER_LAYERS: Record<string, Expr> = {
  clusters: ['all', CLUSTER, ['!', ALL_DIGITAL]],
  'cluster-diamonds': ['all', CLUSTER, ALL_DIGITAL],
  'cluster-notch': ['all', CLUSTER, SOME_DIGITAL],
  'cluster-count': CLUSTER,
};
export const CLICKABLE_CLUSTERS = ['clusters', 'cluster-diamonds'];

/** One repeater per marker: circles for FM, diamonds for digital. */
function addMarkerLayers(map: maplibregl.Map, prefix: string, source: string, filter: Expr) {
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

function addImages(map: maplibregl.Map) {
  const at2x = { pixelRatio: 2 };
  map.addImage('center-pin', pinImage({ outline: COLORS.black, head: COLORS.red, shine: COLORS.white }), at2x);
  for (const [where, line] of [['in', COLORS.green], ['out', COLORS.navy]] as const) {
    map.addImage(`diamond-${where}-exact`, diamondImage(21, line, line), at2x);
    map.addImage(`diamond-${where}-approx`, diamondImage(21, COLORS.white, line), at2x);
  }
  // Group badges at 15 CSS px half-diagonal (the smallest circle badge), scaled up with icon-size.
  map.addImage('cluster-diamond-all', diamondImage(30, COLORS.green, COLORS.green, 6), at2x);
  map.addImage('cluster-diamond-some', diamondImage(30, COLORS.white, COLORS.green, 6), at2x);
  map.addImage('cluster-diamond-none', diamondImage(30, COLORS.white, COLORS.navy, 4), at2x);
  map.addImage('cluster-notch', diamondImage(11, COLORS.navy, COLORS.white, 3), at2x);
}

const ICON_ALWAYS = { 'icon-allow-overlap': true, 'icon-ignore-placement': true } as const;

export function addRepeaterLayers(map: maplibregl.Map) {
  map.addSource('repeaters', {
    type: 'geojson',
    data: EMPTY,
    cluster: true,
    clusterRadius: 28,
    clusterMaxZoom: MAX_ZOOM,
    // Each group counts how many of its repeaters are inside the area, and how many are digital.
    clusterProperties: { sel: ['+', ['get', 'sel']], dig: ['+', ['case', ['get', 'digital'], 1, 0]] },
  });
  for (const id of ['circle', 'track', 'track-corridor', 'active', 'center', ...SPIDER_SOURCES]) map.addSource(id, { type: 'geojson', data: EMPTY });
  addImages(map);

  map.addLayer({ id: 'circle-fill', type: 'fill', source: 'circle', paint: { 'fill-color': COLORS.navy, 'fill-opacity': 0.08 } });
  map.addLayer({ id: 'circle-line', type: 'line', source: 'circle', paint: { 'line-color': COLORS.navy, 'line-width': 2, 'line-dasharray': [2, 1] } });
  // A trail's corridor: flat extrusions, because their opacity is the layer's, so overlaps do not darken.
  map.addLayer({
    id: 'track-corridor',
    type: 'fill-extrusion',
    source: 'track-corridor',
    paint: { 'fill-extrusion-color': COLORS.navy, 'fill-extrusion-opacity': 0.1, 'fill-extrusion-height': 1, 'fill-extrusion-vertical-gradient': false },
  });
  const round = { 'line-join': 'round', 'line-cap': 'round' } as const;
  map.addLayer({ id: 'track-casing', type: 'line', source: 'track', layout: round, paint: { 'line-color': COLORS.white, 'line-width': 6 } });
  map.addLayer({ id: 'track-line', type: 'line', source: 'track', layout: round, paint: { 'line-color': COLORS.purple, 'line-width': 3 } });
  // Under the badges, so a group on the same spot keeps its count readable.
  map.addLayer({ id: 'center-pin', type: 'symbol', source: 'center', layout: { 'icon-image': 'center-pin', 'icon-anchor': 'bottom', ...ICON_ALWAYS } });

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
      'circle-radius': ['step', ['get', 'point_count'], 11, 10, 14, 50, 18],
    },
  });
  map.addLayer({
    id: 'cluster-diamonds',
    type: 'symbol',
    source: 'repeaters',
    filter: CLUSTER_LAYERS['cluster-diamonds'],
    layout: {
      'icon-image': ['case', ALL_IN, 'cluster-diamond-all', SOME_IN, 'cluster-diamond-some', 'cluster-diamond-none'],
      // A diamond needs about 1.35× a circle's radius to look as big.
      'icon-size': ['step', ['get', 'point_count'], 1, 10, 1.25, 50, 1.6],
      ...ICON_ALWAYS,
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
      ...ICON_ALWAYS,
    },
  });
  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'repeaters',
    filter: CLUSTER_LAYERS['cluster-count'],
    layout: {
      // "2/4" when only some of the group is inside the area.
      'text-field': [
        'case',
        ['all', SOME_IN, ['!', ALL_IN]],
        ['concat', ['to-string', ['get', 'sel']], '/', ['to-string', ['get', 'point_count']]],
        ['get', 'point_count_abbreviated'],
      ],
      'text-font': ['Noto Sans Bold'],
      'text-size': 11,
      'text-allow-overlap': true,
    },
    paint: { 'text-color': ['case', ALL_IN, COLORS.white, SOME_IN, COLORS.darkGreen, COLORS.navy] },
  });
  addMarkerLayers(map, 'repeater', 'repeaters', ['!', CLUSTER]);

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
