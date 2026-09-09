require('fs').mkdirSync('build/shots', { recursive: true });
const { chromium, devices } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const shots = [
    { name: 'embed-800', vp: { width: 800, height: 500 }, url: 'demo.html?s=map-layers&mode=embed' },
    { name: 'embed-640', vp: { width: 640, height: 400 }, url: 'demo.html?s=colorization&mode=embed' },
    { name: 'fieldview-page', vp: { width: 1100, height: 640 }, url: 'demo.html?s=field-view&mode=page' },
    { name: 'phone-portrait', vp: { width: 390, height: 844 }, mobile: true, url: 'demo.html?s=zones&mode=page&speed=8' },
    { name: 'phone-landscape', vp: { width: 844, height: 390 }, mobile: true, url: 'demo.html?s=zones&mode=page&speed=8' },
    { name: 'index', vp: { width: 1100, height: 800 }, url: 'index.html' },
  ];
  for (const s of shots) {
    const ctx = await browser.newContext({ viewport: s.vp, isMobile: !!s.mobile, hasTouch: !!s.mobile, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.route('**/fonts.googleapis.com/**', r => r.abort());
    const errors = []; page.on('pageerror', e => errors.push(e.message.slice(0, 200)));
    await page.goto((process.env.FA_BASE || 'http://127.0.0.1:8765') + '/' + s.url, { waitUntil: 'load' });
    if (s.url.startsWith('demo')) { await page.waitForFunction(() => window.FA_TOUR, null, { timeout: 20000 }); await page.waitForTimeout(700); }
    await page.screenshot({ path: `build/shots/view-${s.name}.png` });
    if (s.name.startsWith('phone')) { const b = await page.$('.fa-tour [data-tour="showme"]'); if (b) { await b.click(); await page.waitForTimeout(1000); await page.screenshot({ path: `build/shots/view-${s.name}-2.png` }); } }
    console.log(s.name, 'errors:', errors);
    await ctx.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
