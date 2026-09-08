require('fs').mkdirSync('build/shots', { recursive: true });
const { chromium } = require('playwright');
const base = (process.env.FA_BASE || 'http://127.0.0.1:8765') + '/demo.html';
(async () => {
  const browser = await chromium.launch();
  const ids = process.argv.slice(2);
  for (const sid of ids) {
    const page = await browser.newPage({ viewport: { width: 1100, height: 640 } });
    await page.route('**/fonts.googleapis.com/**', r => r.abort());
    const errors = [];
    page.on('console', m => { if (m.type()==='error' && !m.text().includes('ERR_TUNNEL') && !m.text().includes('googleapis')) errors.push(m.text().slice(0,200)); });
    page.on('pageerror', e => errors.push('pageerror: '+e.message.slice(0,300)));
    await page.goto(`${base}?s=${sid}&mode=page`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.FA_TOUR, null, { timeout: 20000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `build/shots/${sid}-0.png` });
    console.log(`=== ${sid}`);
    for (let k = 1; k <= 12; k++) {
      const state = await page.evaluate(() => ({ step: FA_TOUR.step, finished: FA_TOUR.finished, text: (document.querySelector('.fa-tour-text')||{}).textContent }));
      console.log(`  step ${state.step} finished=${state.finished}: ${String(state.text).slice(0,90)}`);
      if (state.finished) break;
      const btn = await page.$('.fa-tour [data-tour="showme"], .fa-tour [data-tour="next"]');
      if (!btn) { console.log('  no showme/next button'); break; }
      await btn.click();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `build/shots/${sid}-${k}.png` });
      const after = await page.evaluate(() => ({step: FA_TOUR.step, fin: FA_TOUR.finished}));
      if (after.step === state.step && !after.fin) { console.log('  !! step did not advance'); const toast = await page.evaluate(() => document.querySelector('.toast')?.textContent); console.log('  toast:', toast); break; }
    }
    console.log('  errors:', errors);
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
