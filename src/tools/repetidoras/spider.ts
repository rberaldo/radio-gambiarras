// Fanning out repeaters that share one spot (usually a town seat), the way
// Leaflet.markercluster's "spiderfy" does: a circle for a few, a spiral for
// many. Offsets are in screen pixels from the shared point.

/** Up to this many go on a circle; more go on a spiral. */
const CIRCLE_MAX = 8;
/** Pixels between neighbours on the circle. */
const CIRCLE_SPACING = 26;
const SPIRAL_START = 14;
/** Pixels between neighbours along the spiral. */
const SPIRAL_SPACING = 26;
/** Arms end up 2π × this apart (about 22 px): just clear of a marker, so 25 fit within 100 px. */
const SPIRAL_GROWTH = 3.5;

/** Screen offsets [x, y] for `n` markers around a point, nearest first. */
export function spiderOffsets(n: number): [number, number][] {
  if (n <= 0) return [];
  if (n <= CIRCLE_MAX) {
    // Big enough that neighbours sit CIRCLE_SPACING apart, never closer than the spiral start.
    const radius = Math.max(SPIRAL_START + 6, (CIRCLE_SPACING * n) / (2 * Math.PI));
    const step = (2 * Math.PI) / n;
    // Start at the top so a pair sits side by side, not one under the pin.
    return Array.from({ length: n }, (_, i) => polar(radius, -Math.PI / 2 + i * step));
  }
  const out: [number, number][] = [];
  let radius = SPIRAL_START;
  let angle = 0;
  for (let i = 0; i < n; i++) {
    angle += SPIRAL_SPACING / radius + i * 0.0005;
    out.push(polar(radius, angle));
    radius += (2 * Math.PI * SPIRAL_GROWTH) / angle;
  }
  return out;
}

function polar(r: number, a: number): [number, number] {
  return [round(r * Math.cos(a)), round(r * Math.sin(a))];
}

const round = (x: number) => Math.round(x * 10) / 10;
