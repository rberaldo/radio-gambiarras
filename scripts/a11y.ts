// Runs axe-core accessibility checks on pages at desktop and phone widths.
// Usage: node scripts/a11y.ts <base-url> <path> [path...]
// Exits non-zero when any violation is found.
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';

const [base, ...paths] = process.argv.slice(2);
if (!base || paths.length === 0) {
  console.error('Usage: node scripts/a11y.ts <base-url> <path> [path...]');
  process.exit(1);
}

const widths = [1280, 375];
let failures = 0;

const browser = await chromium.launch();
try {
  for (const width of widths) {
    const context = await browser.newContext({ viewport: { width, height: 800 } });
    const page = await context.newPage();
    for (const path of paths) {
      await page.goto(new URL(path, base).href, { waitUntil: 'networkidle' });
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      console.log(`${path} @ ${width}px: ${violations.length} violation(s)`);
      for (const v of violations) {
        failures++;
        console.log(`  [${v.impact}] ${v.id}: ${v.help}`);
        for (const node of v.nodes.slice(0, 5)) console.log(`    ${node.target.join(' ')}`);
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

process.exit(failures ? 1 : 0);
