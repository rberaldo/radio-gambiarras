import { describe, expect, it } from 'vitest';
import { ICON_SIZE, iconGrid, iconNames, iconSvg, isIconName, paletteChars } from '../src/lib/icons';
import { tools } from '../src/tools';

describe('icons', () => {
  it.each(iconNames)('%s is a square grid of palette characters', (name) => {
    const grid = iconGrid(name);
    expect(grid).toHaveLength(ICON_SIZE);
    for (const row of grid) {
      expect(row).toHaveLength(ICON_SIZE);
      for (const ch of row) expect(paletteChars.has(ch)).toBe(true);
    }
  });

  it('exists for every tool in the registry', () => {
    for (const tool of tools) expect(isIconName(tool.icon)).toBe(true);
  });

  it('renders runs as single rects and skips transparency', () => {
    const svg = iconSvg('site');
    expect(svg).toContain('<rect x="3" y="4" width="8" height="1" fill="#000000"/>');
    expect(svg).not.toContain('fill="undefined"');
  });
});
