// Pixel-art images for the map, drawn into ImageData (crisp at pixelRatio 2,
// no image files to load).

const rgba = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16), 255];

// The clicked point, as a pushpin (X outline, R head, W shine); the needle's tip is the point.
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
/** Device pixels per pin pixel; shown at pixelRatio 2. */
const PIN_SCALE = 4;

export function pinImage(colors: { outline: string; head: string; shine: string }): ImageData {
  const w = PIN[0]!.length * PIN_SCALE;
  const h = PIN.length * PIN_SCALE;
  const img = new ImageData(w, h);
  const rgb: Record<string, string> = { X: colors.outline, R: colors.head, W: colors.shine };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = rgb[PIN[Math.floor(y / PIN_SCALE)]![Math.floor(x / PIN_SCALE)]!];
      if (c) img.data.set(rgba(c), (y * w + x) * 4);
    }
  }
  return img;
}

/**
 * A diamond, for digital repeaters and all-digital groups. `half` is the
 * half-diagonal and `width` the outline, in device pixels (shown at
 * pixelRatio 2, so 4 means 2 CSS pixels, like the circles' outline).
 */
export function diamondImage(half: number, fill: string, line: string, width = 4): ImageData {
  const size = half * 2 + 1;
  const img = new ImageData(size, size);
  const inner = half - Math.round(width * Math.SQRT2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.abs(x - half) + Math.abs(y - half);
      if (d <= half) img.data.set(rgba(d > inner ? line : fill), (y * size + x) * 4);
    }
  }
  return img;
}
