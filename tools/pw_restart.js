require('fs').mkdirSync('build/shots', { recursive: true });
const { chromium } = require('playwright');
const base = (process.env.FA_BASE || 'http://127.0.0.1:8765') + '/demo.html';
(async () => {
  const browser = await chromium.launch();
  for (const sid of process.argv.slice(2)) {
    const page = await browser.newPage({ viewport: { width: 1100, height: 640 } });
    await page.route('**/fonts.googleapis.com/**', r => r.abort());
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 300)));
    await page.goto(`${base}?s=${sid}&mode=page&speed=8`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.FA_TOUR, null, { timeout: 20000 });
    await page.waitForTimeout(600);
    const snap = async label => console.log(`  [${label}]`, JSON.stringify(await page.evaluate(() => ({ step: FA_TOUR.step, fin: FA_TOUR.finished, view: FA_APP.state.view, layers: FA_APP.layers().map(l => (l.product || l.kind) + (l.visible ? "" : "(hidden)")), zones: FA_APP.state.zonesOn[FA_APP.state.fid], text: (document.querySelector('.fa-tour-text') || {}).textContent?.slice(0, 60) }))));
    console.log(`=== ${sid}`); await snap('start');
    for (let k = 0; k < 12; k++) {
      const st = await page.evaluate(() => ({ fin: FA_TOUR.finished }));
      if (st.fin) break;
      const btn = await page.$('.fa-tour [data-tour="showme"], .fa-tour [data-tour="next"]');
      if (!btn) break; await btn.click(); await page.waitForTimeout(1100);
    }
    await snap('finished');
    const rb = await page.$('.fa-tour [data-tour="restart"]'); if (rb) { await rb.click(); await page.waitForTimeout(900); }
    await snap('after restart');
    // do the first step again after restart
    const btn = await page.$('.fa-tour [data-tour="showme"], .fa-tour [data-tour="next"]'); if (btn) { await btn.click(); await page.waitForTimeout(1100); }
    await snap('after step 1 again');
    await page.screenshot({ path: `build/shots/restart-${sid}.png` });
    // mid-tour restart: go to step 3 then restart
    await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => window.FA_TOUR, null, { timeout: 20000 }); await page.waitForTimeout(600);
    for (let k = 0; k < 2; k++) { const b = await page.$('.fa-tour [data-tour="showme"], .fa-tour [data-tour="next"]'); if (b) { await b.click(); await page.waitForTimeout(1100); } }
    await snap('mid-tour'); const rb2 = await page.$('.fa-tour [data-tour="restart"]'); if (rb2) { await rb2.click(); await page.waitForTimeout(900); } await snap('mid-tour restart');
    console.log('  errors:', errors);
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
