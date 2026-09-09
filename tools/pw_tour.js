// Walks every step of the named demos with "Show me" (or Next), the way a reader would, and reports whether each step
// advanced. Show me is paced (pointer travel, typing, slider drags, a settle pause), so the walker waits for the step
// counter to move rather than a fixed time. FA_SPEED=4 makes the tour run 4× faster; FA_SHOTS=1 saves a screenshot per step.
require('fs').mkdirSync('build/shots', { recursive: true });
const { chromium } = require('playwright');
const base = (process.env.FA_BASE || 'http://127.0.0.1:8765') + '/demo.html';
const speed = process.env.FA_SPEED || '1'; const shots = process.env.FA_SHOTS === '1';
(async () => {
  const browser = await chromium.launch();
  const ids = process.argv.slice(2);
  let failures = 0;
  for (const sid of ids) {
    const page = await browser.newPage({ viewport: { width: 1100, height: 640 } });
    await page.route('**/fonts.googleapis.com/**', r => r.abort());
    const errors = [];
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('ERR_TUNNEL') && !m.text().includes('googleapis')) errors.push(m.text().slice(0, 200)); if (m.type() === 'warning' && m.text().includes('[fa-tour]')) errors.push(m.text().slice(0, 200)); });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 300)));
    await page.goto(`${base}?s=${sid}&mode=page&speed=${speed}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.FA_TOUR, null, { timeout: 20000 });
    await page.waitForTimeout(800);
    if (shots) await page.screenshot({ path: `build/shots/${sid}-0.png` });
    console.log(`=== ${sid} (speed ${speed})`);
    const t0 = Date.now();
    for (let k = 1; k <= 30; k++) {
      const state = await page.evaluate(() => ({ step: FA_TOUR.step, finished: FA_TOUR.finished, text: (document.querySelector('.fa-tour-text') || {}).textContent }));
      if (state.finished) { console.log(`  finished after ${((Date.now() - t0) / 1000).toFixed(1)} s`); break; }
      const btn = await page.$('.fa-tour [data-tour="showme"], .fa-tour [data-tour="next"]');
      if (!btn) { console.log(`  step ${state.step}: no showme/next button`); failures++; break; }
      const ts = Date.now();
      await btn.click();
      let after;
      try {
        await page.waitForFunction(s => FA_TOUR.step !== s || FA_TOUR.finished, state.step, { timeout: 20000, polling: 100 });
        after = { ok: true };
      } catch (e) { after = { ok: false }; }
      const dt = ((Date.now() - ts) / 1000).toFixed(1);
      console.log(`  step ${state.step + 1} ${after.ok ? 'ok' : '!! did not advance'} ${dt}s: ${String(state.text).slice(0, 80)}`);
      if (shots) await page.screenshot({ path: `build/shots/${sid}-${k}.png` });
      if (!after.ok) { const toast = await page.evaluate(() => (document.querySelector('.toast') || {}).textContent); console.log('  toast:', toast); failures++; break; }
      await page.waitForTimeout(150);
    }
    if (errors.length) console.log('  errors:', errors);
    await page.close();
  }
  await browser.close();
  console.log(failures ? `${failures} demo(s) failed` : 'all demos completed');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
