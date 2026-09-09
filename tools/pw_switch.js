require('fs').mkdirSync('build/shots', { recursive: true });
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 640 } });
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  const errors = []; page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 300)));
  await page.goto((process.env.FA_BASE || 'http://127.0.0.1:8765') + '/demo.html?s=map-layers&mode=page&speed=8', { waitUntil: 'load' });
  await page.waitForFunction(() => window.FA_TOUR, null, { timeout: 20000 }); await page.waitForTimeout(500);
  const snap = async label => console.log(`  [${label}]`, JSON.stringify(await page.evaluate(() => ({ step: FA_TOUR.step, view: FA_APP.state.view, layers: FA_APP.layers().map(l => (l.product || l.kind) + (l.visible ? '' : '(h)')), zones: FA_APP.state.zonesOn[FA_APP.state.fid], title: document.title, text: (document.querySelector('.fa-tour-text') || {}).textContent?.slice(0, 50) }))));
  await snap('map-layers');
  // advance two steps, then switch scenarios through the select
  for (let k = 0; k < 2; k++) { const b = await page.$('.fa-tour [data-tour="showme"]'); if (b) { await b.click(); await page.waitForTimeout(1000); } }
  await snap('map-layers step 2');
  for (const next of Object.keys(await page.evaluate(() => window.FA_SCENARIOS)).filter(k => k !== 'map-layers')) {
    await page.selectOption('#demo-pick', next); await page.waitForTimeout(900);
    await snap('switch → ' + next);
    if (next === 'report') { await page.screenshot({ path: 'build/shots/switch-report.png' }); }
    // run the whole scenario after switching to ensure it still passes
    for (let k = 0; k < 10; k++) { const fin = await page.evaluate(() => FA_TOUR.finished); if (fin) break; const b = await page.$('.fa-tour [data-tour="showme"], .fa-tour [data-tour="next"]'); if (!b) break; await b.click(); await page.waitForTimeout(1000); }
    const r = await page.evaluate(() => ({ step: FA_TOUR.step, fin: FA_TOUR.finished }));
    console.log('     ran →', JSON.stringify(r));
  }
  console.log('errors:', errors);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
