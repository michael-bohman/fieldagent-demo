// Records a demo's Show me steps to a webm: node ../pw_video.js <demo> <steps> [WxH] → build/video/<demo>.webm
const fs = require('fs'); const path = require('path');
const { chromium } = require('playwright');
const base = (process.env.FA_BASE || 'http://127.0.0.1:8765') + '/demo.html';
const [sid = 'colorization', nSteps = '3', vp = '1100x640'] = process.argv.slice(2); const [W, H] = vp.split('x').map(Number);
(async () => {
  const dir = 'build/video'; fs.mkdirSync(dir, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir, size: { width: W, height: H } } });
  const page = await ctx.newPage(); await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.goto(`${base}?s=${sid}&mode=page`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.FA_TOUR, null, { timeout: 20000 }); await page.waitForTimeout(1200);
  for (let k = 0; k < +nSteps; k++) {
    const step = await page.evaluate(() => FA_TOUR.step);
    const btn = await page.$('.fa-tour [data-tour="showme"], .fa-tour [data-tour="next"]'); if (!btn) break;
    // move the real mouse onto the button and click it, so the recording shows a reader pressing Show me
    const bb = await btn.boundingBox(); await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 12 }); await page.waitForTimeout(250); await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
    await page.waitForFunction(s => FA_TOUR.step !== s || FA_TOUR.finished, step, { timeout: 25000 });
    await page.waitForTimeout(900);
  }
  await page.waitForTimeout(600);
  const video = page.video(); await ctx.close(); const src = await video.path(); const dst = path.join(dir, `${sid}.webm`); fs.renameSync(src, dst); console.log(dst);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
