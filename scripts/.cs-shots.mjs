import { chromium } from 'playwright';
const out = process.argv[2];
const pages = [
  ['grid', '/indicativos'],
  ['search', '/indicativos?classe=ab&q=PY2RB'],
  ['quar', '/indicativos?mostrar=quarentena&ind=PU1JAZ'],
  ['empty', '/indicativos?mostrar=livres&q=QQQ'],
];
const b = await chromium.launch();
for (const [w, h, tag] of [[1280, 860, 'd'], [800, 900, 'm'], [375, 900, 'p']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  for (const [name, path] of pages) {
    await page.goto('http://localhost:4322' + path, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: '.taskbar__clock{visibility:hidden} *{transition:none!important;animation:none!important}' });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/${name}-${tag}.png`, fullPage: true });
  }
  await ctx.close();
}
await b.close();
