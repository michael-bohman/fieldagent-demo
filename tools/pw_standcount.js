// Walk the stand-count demo with the tour's own "Show me" button, screenshot every step, report console/page errors.
require('fs').mkdirSync('build/shots', { recursive: true });
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 660 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.route('**/fonts.googleapis.com/**', r => r.abort());
  const errors = []; page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 300)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
  const base = process.env.FA_BASE || 'http://127.0.0.1:8765';
  await page.goto(base + '/demo.html?s=stand-count&mode=page', { waitUntil: 'load' });
  await page.waitForFunction(() => window.FA_TOUR, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  const info = await page.evaluate(() => ({ fid: FA_APP.state.fid, view: FA_APP.state.view, fields: FA_APP.state.fid, z: +document.querySelector('.fa-app .scalebar, #scalebar') ? 1 : 0, layers: FA_APP.layers().length }));
  console.log('boot', JSON.stringify(info));
  await page.screenshot({ path: 'build/shots/sc-00-intro.png' });
  // start the tour (intro card → Start)
  const start = await page.$('.fa-tour [data-tour="start"], .fa-tour [data-tour="next"]'); if (start) { await start.click(); await page.waitForTimeout(500); }
  const nSteps = await page.evaluate(() => FA_SCENARIOS['stand-count'].steps.length);
  for (let k = 0; k < nSteps; k++) {
    const stepBefore = await page.evaluate(() => FA_TOUR.step);
    const btn = await page.$('.fa-tour [data-tour="showme"]');
    if (!btn) { console.log(`step ${k + 1}: no Show me button`, await page.evaluate(() => document.querySelector('.fa-tour .fa-tour-text')?.textContent)); break; }
    await btn.click();
    await page.waitForTimeout(900);
    const stepAfter = await page.evaluate(() => ({ step: FA_TOUR.step, finished: FA_TOUR.finished, text: document.querySelector('.fa-tour .fa-tour-text')?.textContent.slice(0, 90) }));
    await page.screenshot({ path: `build/shots/sc-${String(k + 1).padStart(2, '0')}.png` });
    console.log(`step ${k + 1}: ${stepBefore} -> ${stepAfter.step}${stepAfter.finished ? ' (finished)' : ''} | ${stepAfter.text}`);
    if (stepAfter.step === stepBefore && !stepAfter.finished) { console.log('  !! step did not advance'); }
    if (stepAfter.finished) break;
  }
  // a few extra states: heatmap panel, the Add Map Layers list, fields overview
  { const x = await page.$('.photo-close'); if (x) await x.click(); } await page.waitForTimeout(300);
  await page.evaluate(() => { const L = FA_APP.layers().find(l => l.product === 'standheat'); L.visible = true; FA_APP.state.detailUid = L.uid; FA_APP.goto('layer'); });
  await page.waitForTimeout(800); await page.screenshot({ path: 'build/shots/sc-heatmap-panel.png' });
  const stats = await page.evaluate(() => { const L = FA_APP.layers().find(l => l.product === 'standheat'); const panel = document.querySelector('.fa-app .panel'); return [...panel.querySelectorAll('.stat-row')].map(r => r.textContent.replace(/\s+/g, ' ').trim()); });
  console.log('heatmap zone stats:', stats);
  await page.evaluate(() => { const L = FA_APP.layers().find(l => l.kind === 'samples'); FA_APP.state.detailUid = L.uid; FA_APP.goto('layer'); });
  await page.waitForTimeout(500);
  const sstats = await page.evaluate(() => [...document.querySelectorAll('.fa-app .panel .stat-row')].map(r => r.textContent.replace(/\s+/g, ' ').trim()));
  console.log('samples zone stats:', sstats);
  await page.evaluate(() => { FA_APP.goto('add'); }); await page.waitForTimeout(400); await page.screenshot({ path: 'build/shots/sc-add.png' });
  await page.evaluate(() => { FA_APP.openFields ? FA_APP.openFields() : FA_APP.goto('fields'); }); await page.waitForTimeout(1800); await page.screenshot({ path: 'build/shots/sc-fields.png' });
  await page.evaluate(() => { FA_APP.openField('f3', false); FA_APP.setCollapsed(true); });
  await page.waitForTimeout(600);
  for (const z of [14, 12, 10, 8.5]) { await page.evaluate(zz => { FA_APP.state.view; const v = FA_APP; /* zoom via wheel on the canvas */ }, z); }
  const canvas = await page.$('.fa-app canvas'); const bb = await canvas.boundingBox();
  for (let k = 0; k < 4; k++) { await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); for (let j = 0; j < 8; j++) await page.mouse.wheel(0, 100); await page.waitForTimeout(1500); await page.screenshot({ path: `build/shots/sc-zoom-${k}.png` }); }
  console.log('errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
