// Screenshot a Show me mid-flight: node ../pw_midshot.js <demo> <WxH> <mode> <stepsBefore> <delaysMs,comma>
const { chromium } = require('playwright');
const base = (process.env.FA_BASE || 'http://127.0.0.1:8765') + '/demo.html';
const [sid, vp = '800x500', mode = 'embed', before = '0', delays = '900'] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number);
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: W, height: H }, hasTouch: W < 500, isMobile: W < 500 });
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  await page.goto(`${base}?s=${sid}&mode=${mode}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.FA_TOUR, null, { timeout: 20000 }); await page.waitForTimeout(700);
  for (let k = 0; k < +before; k++) { const s = await page.evaluate(() => FA_TOUR.step); await page.click('.fa-tour [data-tour="showme"], .fa-tour [data-tour="next"]'); await page.waitForFunction(x => FA_TOUR.step !== x || FA_TOUR.finished, s, { timeout: 20000 }); await page.waitForTimeout(300); }
  await page.click('.fa-tour [data-tour="showme"], .fa-tour [data-tour="next"]');
  let t = 0; for (const d of delays.split(',').map(Number)) { await page.waitForTimeout(d - t); t = d; await page.screenshot({ path: `build/shots/mid-${sid}-${vp}-${d}.png` }); }
  await browser.close(); console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
