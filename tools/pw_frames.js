// Records a Show me as a frame sequence: node ../pw_frames.js <demo> <stepsToRun> [intervalMs] [viewport WxH]
// Frames land in build/frames/<demo>/NNN.png with the elapsed time in the file name; make a contact sheet with tools/sheet.py.
const fs = require('fs');
const { chromium } = require('playwright');
const base = (process.env.FA_BASE || 'http://127.0.0.1:8765') + '/demo.html';
const [sid = 'colorization', nSteps = '2', interval = '130', vp = '1100x640'] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number);
(async () => {
  const dir = `build/frames/${sid}`; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.goto(`${base}?s=${sid}&mode=page`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.FA_TOUR, null, { timeout: 20000 });
  await page.waitForTimeout(900);
  const t0 = Date.now(); let n = 0;
  const shot = async () => { const t = Date.now() - t0; await page.screenshot({ path: `${dir}/${String(n++).padStart(3, '0')}_${String(t).padStart(5, '0')}.png` }); };
  await shot();
  for (let k = 0; k < +nSteps; k++) {
    const step = await page.evaluate(() => FA_TOUR.step);
    const btn = await page.$('.fa-tour [data-tour="showme"], .fa-tour [data-tour="next"]'); if (!btn) break;
    await btn.click();
    const tEnd = Date.now() + 12000;
    while (Date.now() < tEnd) {
      await shot();
      const st = await page.evaluate(s => ({ moved: FA_TOUR.step !== s || FA_TOUR.finished, busy: FA_TOUR.busy }), step);
      if (st.moved) { await page.waitForTimeout(+interval); await shot(); break; }
      await page.waitForTimeout(+interval);
    }
  }
  console.log(`${n} frames in ${dir}`);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
