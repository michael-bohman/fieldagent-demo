// Play all: presses the button and waits for the demo to finish, logging each step change with its time.
const { chromium } = require('playwright');
const base = (process.env.FA_BASE || 'http://127.0.0.1:8765') + '/demo.html';
const [sid = 'zones', speed = '1'] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1100, height: 640 } });
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.text().includes('[fa-tour]')) errors.push(m.text()); });
  await page.goto(`${base}?s=${sid}&mode=page&speed=${speed}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.FA_TOUR, null, { timeout: 20000 }); await page.waitForTimeout(600);
  const t0 = Date.now(); await page.click('.fa-tour [data-tour="playall"]');
  let last = -1; const tEnd = Date.now() + 120000;
  while (Date.now() < tEnd) {
    const st = await page.evaluate(() => ({ step: FA_TOUR.step, fin: FA_TOUR.finished, auto: FA_TOUR.autoplay, busy: FA_TOUR.busy }));
    if (st.step !== last) { console.log(`  ${((Date.now() - t0) / 1000).toFixed(1)}s step ${st.step + 1} autoplay=${st.auto}`); last = st.step; }
    if (st.fin) { console.log(`  finished in ${((Date.now() - t0) / 1000).toFixed(1)} s`); break; }
    await page.waitForTimeout(200);
  }
  await page.screenshot({ path: `build/shots/${sid}-autoplay-end.png` });
  console.log('errors:', errors); await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
