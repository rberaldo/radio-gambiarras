import { describe, expect, it } from 'vitest';
import { metaPages } from '../src/site';
import { toolHref, tools } from '../src/tools';

describe('tool registry', () => {
  it('has unique slugs', () => {
    const slugs = tools.map((t) => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('uses URL-safe slugs', () => {
    for (const t of tools) expect(t.slug).toMatch(/^[a-z0-9-]+$/);
  });

  it('does not collide with meta pages', () => {
    const metaPaths = new Set(metaPages.map((p) => p.href));
    for (const t of tools) expect(metaPaths.has(`/${t.slug}`)).toBe(false);
  });

  it('gives external tools a URL', () => {
    for (const t of tools.filter((t) => t.status === 'external')) {
      expect(t.externalUrl).toMatch(/^https:\/\//);
    }
  });

  it('links only to tools that can be opened', () => {
    expect(toolHref({ slug: 'x', title: '', description: '', icon: '', status: 'soon' })).toBeUndefined();
    expect(toolHref({ slug: 'x', title: '', description: '', icon: '', status: 'available' })).toBe('/x');
  });
});
