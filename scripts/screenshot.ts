// Takes desktop and phone screenshots of pages, for checking UI work.
// Usage: node scripts/screenshot.ts <base-url> <out-dir> <path> [path...]
// Example: node scripts/screenshot.ts http://localhost:4321 /tmp/shots / /componentes
// BROWSER=webkit uses Safari's engine (the site's author browses with Safari).
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, webkit } from 'playwright';

const [base, outDir, ...paths] = process.argv.slice(2);
if (!base || !outDir || paths.length === 0) {
  console.error('Usage: node scripts/screenshot.ts <base-url> <out-dir> <path> [path...]');
  process.exit(1);
}

const viewports = [
  { name: 'desktop', width: 1280, height: 900, deviceScaleFactor: 1 },
  { name: 'phone', width: 375, height: 740, deviceScaleFactor: 2 },
];

await mkdir(outDir, { recursive: true });
const engine = process.env.BROWSER === 'webkit' ? webkit : chromium;
const browser = await engine.launch();
try {
  for (const vp of viewports) {
    const page = await browser.newPage({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.deviceScaleFactor,
    });
    for (const path of paths) {
      await page.goto(new URL(path, base).href, { waitUntil: 'networkidle' });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      const slug = path.replace(/^\/|\/$/g, '').replace(/\//g, '_') || 'home';
      const file = join(outDir, `${slug}-${vp.name}${engine === webkit ? '-webkit' : ''}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`${file}${overflow ? '  WARNING: horizontal overflow' : ''}`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
