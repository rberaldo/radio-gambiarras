// Pixel-art icons, drawn for this site. Each icon is a 16×16 grid of palette
// characters; `.` is transparent. Render with `iconSvg` and scale with
// `image-rendering: pixelated` so the pixels stay crisp.

const palette: Record<string, string> = {
  k: '#000000',
  w: '#ffffff',
  g: '#c0c0c0',
  d: '#808080',
  b: '#000080',
  c: '#00a8a8',
  r: '#e00000',
  y: '#ffff00',
};

export const ICON_SIZE = 16;

const icons = {
  // Handheld radio with radio waves; the site icon.
  site: [
    '...k............',
    '...k.k.k........',
    '...k..k.k.......',
    '...k.k.k........',
    '...kkkkkkkk.....',
    '...kddddddk.....',
    '...kdccccdk.....',
    '...kdccccdk.....',
    '...kddddddk.....',
    '...kdkdkddk.....',
    '...kddddddk.....',
    '...kdkdkddk.....',
    '...kddddddk.....',
    '...kdkdkddk.....',
    '...kddddddk.....',
    '...kkkkkkkk.....',
  ],
  // Tux, for the start button.
  tux: [
    '......kkkk......',
    '.....kkkkkk.....',
    '.....kwkkwk.....',
    '.....kkkkkk.....',
    '.....kyyyyk.....',
    '....kkyyyykk....',
    '....kwwyywwk....',
    '...kwwwwwwwwk...',
    '...kwwwwwwwwk...',
    '..kkwwwwwwwwkk..',
    '..kkwwwwwwwwkk..',
    '..kkwwwwwwwwkk..',
    '...kwwwwwwwwk...',
    '..yyykwwwwkyyy..',
    '.yyyyykkkkyyyyy.',
    '................',
  ],
  // Licence card reading "PY".
  indicativos: [
    '................',
    '................',
    'kkkkkkkkkkkkkkk.',
    'kbbbbbbbbbbbbbkd',
    'kbbbbbbbbbbbbbkd',
    'kwwwwwwwwwwwwwkd',
    'kwwkkwwkwkwwwwkd',
    'kwwkwkwkwkwwwwkd',
    'kwwkkwwwkwwwwwkd',
    'kwwkwwwwkwwwwwkd',
    'kwwkwwwwkwwwwwkd',
    'kwwddddddddddwkd',
    'kwwwwwwwwwwwwwkd',
    'kkkkkkkkkkkkkkkd',
    '.ddddddddddddddd',
    '................',
  ],
  // Lattice tower with a red beacon and waves.
  repetidoras: [
    '.......rr.......',
    '.k.....kk.....k.',
    'k..k...kk...k..k',
    'k.k...kkkk...k.k',
    'k..k..k..k..k..k',
    '.k....k..k....k.',
    '......kkkk......',
    '.....k.kk.k.....',
    '.....kk..kk.....',
    '.....kkkkkk.....',
    '....k.k..k.k....',
    '....kk....kk....',
    '....kkkkkkkk....',
    '...k.k....k.k...',
    '...kk......kk...',
    '..dddddddddddd..',
  ],
  // Map pin over the ground.
  aprs: [
    '................',
    '.....kkkkk......',
    '....krrrrrk.....',
    '...krrwwrrrk....',
    '...krwwrrrrk....',
    '...krrrkrrrk....',
    '...krrkkkrrk....',
    '...krrrkrrrk....',
    '....krrrrrk.....',
    '....krrrrrk.....',
    '.....krrrk......',
    '.....krrrk......',
    '......krk.......',
    '...cccckcccc....',
    '..cccccccccccc..',
    '...cccccccccc...',
  ],
} satisfies Record<string, readonly string[]>;

export type IconName = keyof typeof icons;

export const iconNames = Object.keys(icons) as IconName[];

export function isIconName(name: string): name is IconName {
  return Object.hasOwn(icons, name);
}

export function iconGrid(name: IconName): readonly string[] {
  return icons[name];
}

/** Valid palette characters, for tests. */
export const paletteChars = new Set(['.', ...Object.keys(palette)]);

/** An SVG string with one rect per run of same-colored pixels in a row. */
export function iconSvg(name: IconName, attrs = ''): string {
  const rects: string[] = [];
  icons[name].forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x]!;
      let end = x + 1;
      while (row[end] === ch) end++;
      const fill = palette[ch];
      if (fill) rects.push(`<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${fill}"/>`);
      x = end;
    }
  });
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}" ` +
    `shape-rendering="crispEdges" ${attrs}>${rects.join('')}</svg>`
  );
}
