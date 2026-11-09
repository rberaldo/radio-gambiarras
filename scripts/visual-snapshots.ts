// Visual regression check for refactors: capture full-page screenshots of a
// fixed set of pages and states, then compare two captures.
//
//   node scripts/visual-snapshots.ts capture <base-url> <out-dir>
//   node scripts/visual-snapshots.ts compare <dir-a> <dir-b>
//
// Capture before and after a change that should not alter the look; compare
// reports every screenshot whose pixels differ. BROWSER=webkit uses Safari's
// engine. Keep the output in a scratch directory, not in the repository.
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';

export const PAGES: [name: string, path: string][] = [
  ['home', '/'],
  ['sobre', '/sobre'],
  ['404', '/nao-existe'],
  ['ind-grid', '/indicativos'],
  ['ind-search', '/indicativos?classe=ab&q=PY2RB'],
  ['ind-quarantine', '/indicativos?mostrar=quarentena&ind=PU1JAZ'],
  ['ind-empty', '/indicativos?mostrar=livres&q=QQQ'],
  ['aprs-grid', '/aprs'],
  ['aprs-search', '/aprs?q=casa&simbolo=%2F-'],
  ['aprs-empty', '/aprs?q=xyzzy'],
];

const VIEWPORTS = [
  { tag: 'desktop', width: 1280, height: 860 },
  { tag: 'tablet', width: 800, height: 900 },
  { tag: 'phone', width: 375, height: 900 },
];

// Hide what changes between runs (the clock) and stop animations.
const STABILIZE = '.taskbar__clock{visibility:hidden} *{transition:none!important;animation:none!important}';

async function capture(base: string, outDir: string) {
  await mkdir(outDir, { recursive: true });
  const engine = process.env.BROWSER === 'webkit' ? webkit : chromium;
  const browser = await engine.launch();
  try {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();
      for (const [name, path] of PAGES) {
        await page.goto(new URL(path, base).href, { waitUntil: 'networkidle' });
        await page.addStyleTag({ content: STABILIZE });
        await page.waitForTimeout(250);
        await page.screenshot({ path: join(outDir, `${name}-${vp.tag}.png`), fullPage: true });
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`captured ${PAGES.length * VIEWPORTS.length} screenshots in ${outDir}`);
}

async function compare(a: string, b: string) {
  const files = (await readdir(a)).filter((f) => f.endsWith('.png')).sort();
  const differ: string[] = [];
  for (const f of files) {
    const [x, y] = await Promise.all([readFile(join(a, f)), readFile(join(b, f)).catch(() => undefined)]);
    if (!y || !x.equals(y)) differ.push(f);
  }
  if (differ.length === 0) {
    console.log(`all ${files.length} screenshots identical`);
    return;
  }
  console.log(`${differ.length} of ${files.length} differ:\n  ${differ.join('\n  ')}`);
  console.log('Inspect with: magick compare -metric AE <a> <b> diff.png');
  process.exitCode = 1;
}

const [command, x, y] = process.argv.slice(2);
if (command === 'capture' && x && y) await capture(x, y);
else if (command === 'compare' && x && y) await compare(x, y);
else {
  console.error('Usage: visual-snapshots.ts capture <base-url> <out-dir> | compare <dir-a> <dir-b>');
  process.exit(1);
}
