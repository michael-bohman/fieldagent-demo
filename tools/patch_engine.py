"""Build <site root>/fa-engine.js from the lookalike's logic script (lookalike_logic.js, kept next to this script).

Usage: python3 tools/patch_engine.py [site root]   (default: the current directory when it holds demo.template.html,
otherwise ./fa-demos)

Every patch is an exact-match replacement that raises if the anchor text is not found once,
so the engine can be re-derived from a newer lookalike build and any drift shows up immediately.
"""
import re, sys, pathlib

here = pathlib.Path(__file__).resolve().parent
site = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ('.' if pathlib.Path('demo.template.html').exists() else 'fa-demos'))
src_path = here / 'lookalike_logic.js' if (here / 'lookalike_logic.js').exists() else pathlib.Path('lookalike_logic.js')
src = src_path.read_text(encoding='utf-8')
out = src
patches = []

def rep(old, new, count=1):
    global out
    n = out.count(old)
    if n != count:
        raise SystemExit(f'anchor found {n} times (expected {count}):\n{old[:160]}')
    out = out.replace(old, new)
    patches.append(old[:70].replace('\n', ' '))

# 0. header
rep("""   Usage: FieldAgentDemo.mount(element, DATA, { fullViewport, onEvent(name, detail), onLead(lead) → Promise|boolean })
--------------------------------------------------------------------------- */""",
"""   Usage: FieldAgentDemo.mount(element, DATA, { fullViewport, onEvent(name, detail), onLead(lead) → Promise|boolean })

   Support-documentation edition (fa-demos). Additional mount options:
     seedLayers: false      start every field with an empty Map Layers card (the tour adds layers itself)
     tips: false            no marketing hint bar and no tip cards inside the panel
     leadCapture: false     download buttons show a toast instead of the "send to my inbox" form
     blockedMessage(what)   text for the controls that are inert in the demo
     downloadMessage        text shown when a download button is pressed
   The mount result exposes render/goto/layers/addLayer/toast/setCollapsed/root/panel/FIELD for the tour layer,
   and the engine emits fine-grained events (view_changed, layer_toggled, color_mode_changed, …) so a tour can
   advance when the reader performs a step. Images are referenced by URL (DATA.img[key]) and decode on demand.
--------------------------------------------------------------------------- */""")

# 1. empty starting stack
rep("""  function defaultLayers(fid) {
    const f = FIELD[fid]; const out = [];""",
"""  function defaultLayers(fid, force = false) {
    const f = FIELD[fid]; const out = []; if (opts.seedLayers === false && !force) return out;""")

# 2. tips off
rep("""  function tip(id, html) { if (state.tipsDone.has(id)) return '';""",
"""  function tip(id, html) { if (opts.tips === false || state.tipsDone.has(id)) return '';""")

rep("""  $('hint-close').addEventListener('click', () => $('hint').remove());""",
"""  if (opts.tips === false) { const h = $('hint'); if (h) h.remove(); }
  { const hc = $('hint-close'); if (hc) hc.addEventListener('click', () => $('hint').remove()); }""")

# 3. blocked message override
rep("""  const blockedMsg = what => `${what} is part of the full FieldAgent account. This sample is view-only.`;""",
"""  const blockedMsg = what => typeof opts.blockedMessage === 'function' ? opts.blockedMessage(what) : `${what} is part of the full FieldAgent account. This sample is view-only.`;""")

# 4. downloads: toast instead of lead form
rep("""    else if (act === 'download') { openLead(t.dataset.what, t); }""",
"""    else if (act === 'download') { if (opts.leadCapture === false) { toast(opts.downloadMessage || 'Downloads work in your own FieldAgent account. This demo is view-only.'); emit('download_attempt', { what: t.dataset.what }); } else openLead(t.dataset.what, t); }""")
rep("""    else if (act === 'download') { const hadMenu = !!state.menu; openLead(t.dataset.what, t); if (hadMenu) render(true); }""",
"""    else if (act === 'download') { const hadMenu = !!state.menu; if (opts.leadCapture === false) { toast(opts.downloadMessage || 'Downloads work in your own FieldAgent account. This demo is view-only.'); emit('download_attempt', { what: t.dataset.what }); state.menu = null; } else openLead(t.dataset.what, t); if (hadMenu) render(true); }""")

# 5. fine-grained events
rep("""  function goto(view) { state.view = view; state.menu = null; render(); }""",
"""  function goto(view) { state.view = view; state.menu = null; render(); emit('view_changed', { view }); }""")
rep("""    if (act === 'search') { state.search = t.value; const scroll = panel.querySelector('.panel-scroll').scrollTop; render();""",
"""    if (act === 'search') { state.search = t.value; const scroll = panel.querySelector('.panel-scroll').scrollTop; render(); emit('search_changed', { query: state.search });""")
rep("""    else if (act === 'toggle') { e.stopPropagation(); const l = findLayer(+t.dataset.uid); l.visible = !l.visible; render(true); }""",
"""    else if (act === 'toggle') { e.stopPropagation(); const l = findLayer(+t.dataset.uid); l.visible = !l.visible; render(true); emit('layer_toggled', { visible: l.visible, layer: layerTitle(l) }); }""")
rep("""    else if (act === 'remove') { e.stopPropagation(); state.layersByField[state.fid] = layers().filter(x => x.uid !== +t.dataset.uid); render(true); }""",
"""    else if (act === 'remove') { e.stopPropagation(); state.layersByField[state.fid] = layers().filter(x => x.uid !== +t.dataset.uid); render(true); emit('layer_removed'); }""")
rep("""    else if (act === 'scale') { L.col.scale = t.dataset.scale; state.menu = null; render(true); }""",
"""    else if (act === 'scale') { L.col.scale = t.dataset.scale; state.menu = null; render(true); emit('color_scale_changed', { scale: t.dataset.scale }); }""")
rep("""    else if (act === 'mode') { L.col.mode = t.dataset.mode; render(true); }""",
"""    else if (act === 'mode') { L.col.mode = t.dataset.mode; render(true); emit('color_mode_changed', { mode: t.dataset.mode }); }""")
rep("""    else if (act === 'clip') { L.clipped = t.dataset.clip === '1'; render(true); }""",
"""    else if (act === 'clip') { L.clipped = t.dataset.clip === '1'; render(true); emit('clip_changed', { clipped: L.clipped }); }""")
rep("""    else if (act === 'includeout') { L.col.includeOut = !L.col.includeOut; render(true); }""",
"""    else if (act === 'includeout') { L.col.includeOut = !L.col.includeOut; render(true); emit('include_out_toggled', { on: L.col.includeOut }); }""")
rep("""    else if (act === 'bintable') { state.binTable = !state.binTable; render(true); }""",
"""    else if (act === 'bintable') { state.binTable = !state.binTable; render(true); emit('bin_table_toggled', { open: state.binTable }); }""")
rep("""    else if (act === 'showmore') { state.showMore = !state.showMore; render(true); }""",
"""    else if (act === 'showmore') { state.showMore = !state.showMore; render(true); emit('show_more_toggled', { open: state.showMore }); }""")
rep("""    else if (act === 'src') { state.sources[t.dataset.src] = !state.sources[t.dataset.src]; render(true); if (t.dataset.src === 'satellite' && state.sources.satellite) emit('satellite_opened'); }""",
"""    else if (act === 'src') { state.sources[t.dataset.src] = !state.sources[t.dataset.src]; render(true); emit('source_toggled', { source: t.dataset.src, on: state.sources[t.dataset.src] }); if (t.dataset.src === 'satellite' && state.sources.satellite) emit('satellite_opened'); }""")
rep("""    else if (act === 'sort') { state.sort = t.dataset.sort; state.menu = null; render(true); }""",
"""    else if (act === 'sort') { state.sort = t.dataset.sort; state.menu = null; render(true); emit('sort_changed', { sort: state.sort }); }""")
rep("""    else if (act === 'zonedone') { goto('field'); flyTo(fitField(), 600); }""",
"""    else if (act === 'zonedone') { goto('field'); flyTo(fitField(), 600); emit('zone_done'); }""")
rep("""    else if (act === 'osurvey') { state.order.survey = t.dataset.survey; state.order.picks = {}; state.order.aligned = {}; state.menu = null; render(true); }""",
"""    else if (act === 'osurvey') { state.order.survey = t.dataset.survey; state.order.picks = {}; state.order.aligned = {}; state.menu = null; render(true); emit('order_survey_selected', { survey: state.order.survey }); }""")
rep("""    else if (act === 'opick') { const k = t.dataset.key; state.order.picks[k] = !state.order.picks[k]; if (!state.order.picks[k]) delete state.order.aligned[k]; render(true); }""",
"""    else if (act === 'opick') { const k = t.dataset.key; state.order.picks[k] = !state.order.picks[k]; if (!state.order.picks[k]) delete state.order.aligned[k]; render(true); emit('order_product_toggled', { product: k, on: !!state.order.picks[k] }); }""")
rep("""    else if (act === 'oalign') { const k = t.dataset.key; state.order.aligned[k] = !state.order.aligned[k]; render(true); }""",
"""    else if (act === 'oalign') { const k = t.dataset.key; state.order.aligned[k] = !state.order.aligned[k]; render(true); emit('order_aligned_toggled', { product: k, on: !!state.order.aligned[k] }); }""")
rep("""    else if (act === 'utype') { state.upload.type = { 'Fully Stitched Mosaic': 'mosaic', 'QuickTile': 'quicktile', 'Individual Photos': 'photos' }[t.dataset.val]; render(true); }""",
"""    else if (act === 'utype') { state.upload.type = { 'Fully Stitched Mosaic': 'mosaic', 'QuickTile': 'quicktile', 'Individual Photos': 'photos' }[t.dataset.val]; render(true); emit('upload_type_changed', { type: state.upload.type }); }""")
rep("""    else if (act === 'ukind') { state.upload.kind = t.dataset.val; render(true); }""",
"""    else if (act === 'ukind') { state.upload.kind = t.dataset.val; render(true); emit('upload_kind_changed', { kind: state.upload.kind }); }""")
rep("""    else if (act === 'horizon') { state.upload.horizon = !state.upload.horizon; render(true); }""",
"""    else if (act === 'horizon') { state.upload.horizon = !state.upload.horizon; render(true); emit('upload_horizon_toggled', { on: state.upload.horizon }); }""")
rep("""    else if (act === 'drop' || act === 'usubmit') { toast('Uploads happen in your own FieldAgent account. This sample is view-only.'); }""",
"""    else if (act === 'drop' || act === 'usubmit') { toast(opts.uploadMessage || 'Uploads happen in your own FieldAgent account. This sample is view-only.'); emit('upload_attempt', { what: act }); }""")
rep("""    else if (act === 'rtoggle') { const k = t.dataset.key; state.report[k] = !state.report[k]; render(true); }""",
"""    else if (act === 'rtoggle') { const k = t.dataset.key; state.report[k] = !state.report[k]; render(true); emit('report_toggled', { key: k, on: !!state.report[k] }); }""")
rep("""    else if (act === 'paper') { state.report.paper = t.dataset.paper; state.menu = null; render(true); }""",
"""    else if (act === 'paper') { state.report.paper = t.dataset.paper; state.menu = null; render(true); emit('report_paper_changed', { paper: state.report.paper }); }""")
rep("""    else if (act === 'pnav') { const L = findLayer(p.uid); const n = photoSamples(L).length; p.idx = clamp(p.idx + (+t.dataset.dir), 0, n - 1); const smp = photoSamples(L)[p.idx]; if (!(smp.img && smp.img[p.band])) p.band = firstBand(L, smp); p.zoom = 1; renderPhoto(); dirty = true; }""",
"""    else if (act === 'pnav') { const L = findLayer(p.uid); const n = photoSamples(L).length; p.idx = clamp(p.idx + (+t.dataset.dir), 0, n - 1); const smp = photoSamples(L)[p.idx]; if (!(smp.img && smp.img[p.band])) p.band = firstBand(L, smp); p.zoom = 1; renderPhoto(); dirty = true; emit('photo_navigated', { index: p.idx }); }""")
rep("""    else if (act === 'pmeta') { p.meta = !p.meta; renderPhoto(); }""",
"""    else if (act === 'pmeta') { p.meta = !p.meta; renderPhoto(); emit('photo_metadata_toggled', { open: p.meta }); }""")
rep("""    else if (act === 'pzoom') { p.zoom = clamp(p.zoom * (t.dataset.dir === '1' ? 1.4 : 1 / 1.4), 1, 4); const im = modalEl.querySelector('.photo-stage img'); if (im) im.style.transform = `scale(${p.zoom})`; }""",
"""    else if (act === 'pzoom') { p.zoom = clamp(p.zoom * (t.dataset.dir === '1' ? 1.4 : 1 / 1.4), 1, 4); const im = modalEl.querySelector('.photo-stage img'); if (im) im.style.transform = `scale(${p.zoom})`; emit('photo_zoomed', { zoom: p.zoom }); }""")
rep("""    else if (act === 'rtitle-edit') { if (r.editTitle) { const inp = reportEl.querySelector('[data-act="rtitle"]'); if (inp && inp.value.trim()) r.title = inp.value.trim(); } r.editTitle = !r.editTitle; render(true); }""",
"""    else if (act === 'rtitle-edit') { if (r.editTitle) { const inp = reportEl.querySelector('[data-act="rtitle"]'); if (inp && inp.value.trim()) r.title = inp.value.trim(); } r.editTitle = !r.editTitle; render(true); if (!r.editTitle) emit('report_edited', { what: 'rtitle' }); else emit('report_title_editing'); }""")
# slider inputs
rep("""    else if (act === 'bins') { L.col.bins = Math.round(v); patchColorization(L); }""",
"""    else if (act === 'bins') { L.col.bins = Math.round(v); patchColorization(L); emit('bins_changed', { bins: L.col.bins }); }""")
rep("""    else if (act === 'rmin') { const [lo, hi] = vizRange(L); const gap = (hi - lo) / 100; L.col.min = Math.min(v, L.col.max - gap); t.value = L.col.min; patchColorization(L); }""",
"""    else if (act === 'rmin') { const [lo, hi] = vizRange(L); const gap = (hi - lo) / 100; L.col.min = Math.min(v, L.col.max - gap); t.value = L.col.min; patchColorization(L); emit('range_changed', { end: 'min', value: L.col.min }); }""")
rep("""    else if (act === 'rmax') { const [lo, hi] = vizRange(L); const gap = (hi - lo) / 100; L.col.max = Math.max(v, L.col.min + gap); t.value = L.col.max; patchColorization(L); }""",
"""    else if (act === 'rmax') { const [lo, hi] = vizRange(L); const gap = (hi - lo) / 100; L.col.max = Math.max(v, L.col.min + gap); t.value = L.col.max; patchColorization(L); emit('range_changed', { end: 'max', value: L.col.max }); }""")
rep("""    if (act === 'alt') { state.upload.alt = Math.round(parseFloat(t.value)); $('alt-caption').textContent = `${state.upload.alt} ft`; return; }""",
"""    if (act === 'alt') { state.upload.alt = Math.round(parseFloat(t.value)); $('alt-caption').textContent = `${state.upload.alt} ft`; emit('upload_buffer_changed', { ft: state.upload.alt }); return; }""")
# measure + collapse + fields nav
rep("""  $('ruler').addEventListener('click', () => { measuring = !measuring; measurePts = [];""",
"""  $('ruler').addEventListener('click', () => { measuring = !measuring; measurePts = []; emit('measure_toggled', { on: measuring });""")

# 6. public API for the tour layer
rep("""  return { state, openField, openFields, flyTo, openPhoto, openLead };
}""",
"""  function addLayer(spec, visible = true, open = false) {
    const L = newLayer(state.fid, spec); L.visible = visible; layers().unshift(L); ensure(L);
    if (open) { state.detailUid = L.uid; state.view = 'layer'; state.menu = null; state.binTable = false; }
    render(); return L;
  }
  return { state, openField, openFields, flyTo, openPhoto, openLead, render, goto, toast, layers, addLayer, setCollapsed, defaultLayers, root, panel, FIELD, emit, fitField, layerTitle };
}""")

# 7. menus (the Visualization and Color Scale pickers) — the tour needs to know when one opens
rep("""    else if (act === 'menu') { state.menu = state.menu === t.dataset.menu ? null : t.dataset.menu; render(true); }""",
"""    else if (act === 'menu') { state.menu = state.menu === t.dataset.menu ? null : t.dataset.menu; render(true); emit('menu_toggled', { menu: t.dataset.menu, open: state.menu === t.dataset.menu }); }""")

# 8. Import Imagery: FieldAgent Web's slider is the image buffer around the boundary, not a flight altitude, and the
#    drop zone carries no marketing line
rep("""<div class="field-label" style="margin:4px 0 0 6px">Altitude above ground</div>""",
"""<div class="field-label" style="margin:4px 0 0 6px">Image buffer around the field boundary</div>""")
rep("""<span class="na">Up to 2,000 photos per flight on Scout · calibration-panel photos in the set calibrate the stitch</span>""", "")

# 9. expose the boot promise so a tour can wait for the first field to open before it sets up its own layers
rep("""  Promise.all(first.map(loadImage)).then(() => {
    const l = $('loading'); if (l) l.remove();
    openField(f0.id, false);""",
"""  const booted = Promise.all(first.map(loadImage)).then(() => {
    const l = $('loading'); if (l) l.remove();
    openField(f0.id, false);""")
rep("""  return { state, openField, openFields, flyTo, openPhoto, openLead, render, goto, toast, layers, addLayer, setCollapsed, defaultLayers, root, panel, FIELD, emit, fitField, layerTitle };""",
"""  return { state, opts, openField, openFields, flyTo, openPhoto, openLead, render, goto, toast, layers, addLayer, setCollapsed, defaultLayers, root, panel, FIELD, emit, fitField, layerTitle, ready: booted };""")


# 7. extension hooks (fa-ext.js adds new panels without touching the generated engine)
rep("""    panel.innerHTML = state.view === 'fields' ? renderFields() : state.view === 'add' ? renderAdd() : state.view === 'layer' ? renderLayer(L) : state.view === 'zones' ? renderZones() : state.view === 'zone' ? renderZoneEdit() : state.view === 'order' ? renderOrder() : state.view === 'upload' ? renderUpload() : state.view === 'report' ? renderReportPanel() : renderField();""",
"""    const extHtml = typeof opts.renderView === 'function' ? opts.renderView(state.view) : null;
    panel.innerHTML = extHtml != null ? extHtml : state.view === 'fields' ? renderFields() : state.view === 'add' ? renderAdd() : state.view === 'layer' ? renderLayer(L) : state.view === 'zones' ? renderZones() : state.view === 'zone' ? renderZoneEdit() : state.view === 'order' ? renderOrder() : state.view === 'upload' ? renderUpload() : state.view === 'report' ? renderReportPanel() : renderField();""")
rep("""    const b = e.target.closest('[data-blocked]'); if (b) { e.stopPropagation(); toast(blockedMsg(b.dataset.blocked)); if (state.menu) { state.menu = null; render(true); } return; }""",
"""    const b = e.target.closest('[data-blocked]'); if (b) { e.stopPropagation(); if (typeof opts.onBlocked === 'function' && opts.onBlocked(b.dataset.blocked, b) === true) return; toast(blockedMsg(b.dataset.blocked)); if (state.menu) { state.menu = null; render(true); } return; }""")
rep("""    const tab = e.target.closest('.rail .tab'); if (tab) { toast(blockedMsg(tab.dataset.tab)); return; }""",
"""    const tab = e.target.closest('.rail .tab'); if (tab) { if (typeof opts.onTab === 'function' && opts.onTab(tab.dataset.tab, tab) === true) return; toast(blockedMsg(tab.dataset.tab)); return; }""")
rep("""    const act = t.dataset.act; const L = findLayer(state.detailUid);
    if (act === 'back') { goto(t.dataset.to || 'field'); }""",
"""    const act = t.dataset.act; const L = findLayer(state.detailUid);
    if (typeof opts.onAct === 'function' && opts.onAct(act, t, e) === true) return;
    if (act === 'back') { goto(t.dataset.to || 'field'); }""")
rep("""  panel.addEventListener('input', e => {
    const t = e.target.closest('[data-act]'); if (!t) return; const act = t.dataset.act;""",
"""  panel.addEventListener('input', e => {
    const t = e.target.closest('[data-act]'); if (!t) return; const act = t.dataset.act;
    if (typeof opts.onInput === 'function' && opts.onInput(act, t, e) === true) return;""")
rep("""      <section class="card"><div class="card-title"><span class="grow">Field Activities</span><button class="iconbtn white" type="button" data-blocked="Adding an activity" aria-label="Add activity">${icon('i-addcircle', 'ico sm')}</button></div><div class="muted-center">No field activities to show.</div></section>""",
"""      ${(typeof opts.renderActivities === 'function' && opts.renderActivities(f)) || `<section class="card"><div class="card-title"><span class="grow">Field Activities</span><button class="iconbtn white" type="button" data-blocked="Adding an activity" aria-label="Add activity">${icon('i-addcircle', 'ico sm')}</button></div><div class="muted-center">No field activities to show.</div></section>`}""")
rep("""    const el = $('draw-tools'); const show = state.view === 'zone'; el.hidden = !show; if (!show) return;""",
"""    const el = $('draw-tools'); const show = state.view === 'zone' || (typeof opts.drawToolsFor === 'function' && !!opts.drawToolsFor(state.view)); el.hidden = !show; if (!show) return;""")
rep("""  return { state, opts, openField, openFields, flyTo, openPhoto, openLead, render, goto, toast, layers, addLayer, setCollapsed, defaultLayers, root, panel, FIELD, emit, fitField, layerTitle, ready: booted };""",
"""  return { state, opts, openField, openFields, flyTo, openPhoto, openLead, render, goto, toast, layers, addLayer, setCollapsed, defaultLayers, root, panel, FIELD, emit, fitField, layerTitle, ready: booted,
    ui: { icon, esc, head, tip, fmtAc, curField, blockedMsg, SENSOR_LABEL, $ } };""")

# ============================================================================================================
# 10. basemaps: lazy loading, so a page only fetches the tiles its view touches; wider zoom range for fields that
#     are far apart (the Sentera Demo Account fields sit ~120 km from the Scout demo fields)
rep("""    for (const b of BASEMAPS) { const im = IMG[b.key]; if (!im) continue; const r = rectOf(b.rect); if (r.x > W || r.y > H || r.x + r.w < 0 || r.y + r.h < 0) continue; cx2.drawImage(im, r.x, r.y, r.w, r.h); }""",
"""    for (const b of BASEMAPS) { const r = rectOf(b.rect); if (r.x > W || r.y > H || r.x + r.w < 0 || r.y + r.h < 0) continue; const im = IMG[b.key];
      if (!im) { if (!o.snapshot && !LOADING[b.key]) loadImage(b.key).then(() => { dirty = true; }).catch(() => {}); continue; }
      cx2.drawImage(im, r.x, r.y, r.w, r.h); }""")
rep("""  const first = [...BASEMAPS.map(b => b.key), `${f0.id}_${s0.key}_ndvi`, `${f0.id}_${s0.key}_rgb`, `${f0.id}_${s0.key}_mask`].filter(hasImg);""",
"""  const touches = (a, b) => !(a.x1 < b.x0 || a.x0 > b.x1 || a.y1 < b.y0 || a.y0 > b.y1);
  const first = [...BASEMAPS.filter(b => touches(b.rect, f0.rect)).map(b => b.key), `${f0.id}_${s0.key}_ndvi`, `${f0.id}_${s0.key}_rgb`, `${f0.id}_${s0.key}_mask`].filter(hasImg);""")
rep("""    const z = clamp(Math.log2(Math.min((box.w - pad * 2) / w, (box.h - pad * 2) / h) / 512), 11, 19.5);""",
"""    const z = clamp(Math.log2(Math.min((box.w - pad * 2) / w, (box.h - pad * 2) / h) / 512), 8, 19.5);""")
rep("""  function setZoom(z, sx, sy) { z = clamp(z, 11, 19.5);""", """  function setZoom(z, sx, sy) { z = clamp(z, 8, 19.5);""")
rep("""const nice = [20, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000];""",
"""const nice = [20, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000, 26400, 52800, 105600, 264000];""")
rep("""el.textContent = ft >= 5280 ? (ft / 5280).toFixed(1) + ' mi' : ft + ' ft';""",
"""el.textContent = ft >= 5280 ? (ft / 5280).toFixed(ft % 5280 ? 1 : 0) + ' mi' : ft.toLocaleString() + ' ft';""")

# 11. analytics layers — FieldAgent's Stand Count / Tassel Count products: an interpolated heatmap raster (an index
#     layer with its own value range) and the individual sample points, drawn as value bubbles that open the
#     sample viewer. Data: survey.analytics = [{ id, kind: 'raster'|'samples', name, viz, props, points }].
rep("""  b5: { id: 'b5', label: 'Band 5', band: 5, index: true, range: null },
};""",
"""  b5: { id: 'b5', label: 'Band 5', band: 5, index: true, range: null },
  // analytics products: value ranges come from the survey (`ranges`) or from the sample values themselves
  stand:   { id: 'stand', label: 'Stand Count', short: 'Stand Count', index: true, range: null, dec: 0, bins: 5, mode: 'area' },
  emerg:   { id: 'emerg', label: 'Emergence', short: 'Emergence', index: true, range: null, dec: 1, bins: 5, mode: 'area', unit: '%' },
  tassel:  { id: 'tassel', label: 'Tassel Count', short: 'Tassel Count', index: true, range: null, dec: 0, bins: 5, mode: 'area' },
};""")
# world coordinates for the sample points
rep("""    surveys: f.surveys.map((s, si) => { const ph = s.photos || {}; return { ...s, dotColor: s.dotColor || DOT_COLORS[si % DOT_COLORS.length], quicktiles: s.quicktiles || [],""",
"""    surveys: f.surveys.map((s, si) => { const ph = s.photos || {}; return { ...s, dotColor: s.dotColor || DOT_COLORS[si % DOT_COLORS.length], quicktiles: s.quicktiles || [],
      analytics: (s.analytics || []).map(a => ({ ...a, points: (a.points || []).map(p => ({ ...p, w: [merc.x(p.lon), merc.y(p.lat)] })) })),""")
rep("""    photo: null,              // { uid, idx, band, meta: bool, sub: {...}, zoom }""",
"""    photo: null,              // { uid, idx, band, meta: bool, sub: {...}, zoom, kind?: 'sample' }
    excluded: {},             // sample points excluded in the sample viewer: `${fid}|${survey}|${product}|${i}` → true""")
rep("""  function imgKey(L, viz) { const v = viz || L.viz; if (L.kind === 'sat') return `${L.fid}_sat${L.date}_${v}`; if (L.kind === 'photos') return null; return""",
"""  function imgKey(L, viz) { const v = viz || L.viz; if (L.kind === 'sat') return `${L.fid}_sat${L.date}_${v}`; if (L.kind === 'photos' || L.kind === 'samples') return null; if (analyticOf(L)) return `${L.fid}_${L.survey}_${L.product}`; return""")
rep("""  function vizRange(L) { const v = VIZ[L.viz]; if (v.id === 'elev') return surveyOf(L).elevRange || [0, 1]; if (v.range) return v.range;""",
"""  function vizRange(L) { const v = VIZ[L.viz]; if (v.id === 'elev') return surveyOf(L).elevRange || [0, 1]; if (v.range) return v.range;
    if (isSamples(L)) { const vals = samplePoints(L).map(p => sampleValue(L, p)); if (vals.length) return [Math.min(...vals), Math.max(...vals)]; }""")
rep("""  function productVizOptions(L) {
    if (L.kind === 'sat') return [L.product];""",
"""  function productVizOptions(L) {
    if (L.kind === 'sat') return [L.product];
    const an = analyticOf(L); if (an) return [an.viz];""")
rep("""    if (L.kind === 'photos') { L.viz = 'photos'; L.col = null; return L; }
    if (!L.viz) { const o = productVizOptions(L); L.viz = o[0] || 'rgb'; }""",
"""    if (L.kind === 'photos') { L.viz = 'photos'; L.col = null; return L; }
    if (L.kind === 'samples') { const an = analyticOf(L) || {}; const p0 = (an.props || [])[0]; L.prop = p0 ? p0.id : 'density'; L.viz = p0 ? p0.viz : (an.viz || 'stand'); L.col = defaultCol(L); return L; }
    if (!L.viz) { const o = productVizOptions(L); L.viz = o[0] || 'rgb'; }""")
rep("""    if (L.kind === 'photos') return 'Photo Dots';
    if (L.product.startsWith('qt_')) { const q = qtOf(L); return q ? q.name : 'QuickTile'; }""",
"""    if (L.kind === 'photos') return 'Photo Dots';
    const an = analyticOf(L); if (an) return an.name;
    if (L.product.startsWith('qt_')) { const q = qtOf(L); return q ? q.name : 'QuickTile'; }""")
rep("""    const s = surveyOf(L); return `${s.name} • ${s.date}`;
  }
  const isPhotos = L => L.kind === 'photos';
  const photoSamples = L => (surveyOf(L).photos.samples || []);""",
"""    const s = surveyOf(L); return s.name ? `${s.name} • ${s.date}` : s.date;
  }
  const isPhotos = L => L.kind === 'photos';
  const photoSamples = L => (surveyOf(L).photos.samples || []);
  // ----- analytics (stand count & co.) -----
  const analyticOf = L => (L && L.survey && L.kind !== 'sat' && L.kind !== 'photos') ? ((surveyOf(L) || {}).analytics || []).find(a => a.id === L.product) || null : null;
  const isSamples = L => L.kind === 'samples';
  const samplePoints = L => { const a = analyticOf(L); return a ? (a.points || []) : []; };
  const sampleProp = L => { const a = analyticOf(L); const props = (a && a.props) || []; return props.find(p => p.id === L.prop) || props[0] || { id: 'density', label: 'Value', viz: L.viz }; };
  const sampleValue = (L, pt) => pt[sampleProp(L).id];
  const exKey = (L, pt) => `${L.fid}|${L.survey}|${L.product}|${pt.i}`;
  const isExcluded = (L, pt) => !!state.excluded[exKey(L, pt)];
  const shownPoints = L => samplePoints(L).filter(pt => !(L.hideExcluded && isExcluded(L, pt)));
  const SHIST = {};
  function sampleHist(L) {
    const pts = shownPoints(L); const sig = `${L.fid}|${L.survey}|${L.product}|${L.prop}|${pts.map(p => p.i).join(',')}`;
    if (SHIST[sig]) return SHIST[sig];
    const counts = new Uint32Array(256); let total = 0, sum = 0;
    for (const pt of pts) { const g = clamp(Math.round(v2g(L, sampleValue(L, pt))), 0, 255); counts[g]++; total++; sum += g; }
    return SHIST[sig] = { counts, total, sum };
  }
  const pointInRings = (w, rings) => { let inside = false; for (const ring of rings) { for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if (((yi > w[1]) !== (yj > w[1])) && (w[0] < (xj - xi) * (w[1] - yi) / (yj - yi) + xi)) inside = !inside; } } return inside; };
  function sampleZoneStats(L) {
    const f = FIELD[L.fid]; const pts = shownPoints(L); const agg = list => { const v = list.map(p => sampleValue(L, p)); return v.length ? { min: Math.min(...v), avg: v.reduce((a, b) => a + b, 0) / v.length, max: Math.max(...v), n: v.length } : { min: null, avg: null, max: null, n: 0 }; };
    return [{ name: 'Field Boundary', acres: f.acres, boundary: true, ...agg(pts) }, ...f.zones.map((z, zi) => ({ name: zoneName(f.id, zi), acres: z.acres, ...agg(pts.filter(p => pointInRings(p.w, z.rings))) }))];
  }""")
# the samples layer has no raster: it is always "ready", never decoded, never drawn by the raster loop
rep("""  function ready(L) { if (isPhotos(L)) return true;""", """  function ready(L) { if (isPhotos(L) || isSamples(L)) return true;""")
rep("""  async function prepareLayer(L) {
    if (isPhotos(L)) return true;""", """  async function prepareLayer(L) {
    if (isPhotos(L) || isSamples(L)) return true;""")
rep("""    if (isPhotos(L)) return; if (!hasImg(imgKey(L))) return; const key = imgKey(L) + '|' + L.viz;""",
"""    if (isPhotos(L) || isSamples(L)) return; if (!hasImg(imgKey(L))) return; const key = imgKey(L) + '|' + L.viz;""")
rep("""  function histOf(L) { const key = imgKey(L), im = IMG[key]; if (!im) return null;""",
"""  function histOf(L) { if (isSamples(L)) return sampleHist(L); const key = imgKey(L), im = IMG[key]; if (!im) return null;""")
rep("""        const L = Ls[i]; if (!L.visible || L.opacity <= 0 || isPhotos(L)) continue;""",
"""        const L = Ls[i]; if (!L.visible || L.opacity <= 0 || isPhotos(L) || isSamples(L)) continue;""")
rep("""  function layerStats(L) {
    const h = histOf(L); if (!h) return null; const key = imgKey(L); const { edges } = buildLUT(L, h); const { min, max } = L.col; const rows = [];""",
"""  function layerStats(L) {
    if (isSamples(L)) { const pts = shownPoints(L); const vals = pts.map(p => sampleValue(L, p)); const h = sampleHist(L); const { edges } = buildLUT(L, h); const { min, max } = L.col; const rows = [];
      for (let i = 0; i < edges.length - 1; i++) rows.push({ lo: edges[i], hi: edges[i + 1], count: 0 });
      for (const v of vals) { if (v < min || v > max) continue; let i = 0; while (i < rows.length - 1 && v >= edges[i + 1]) i++; rows[i].count++; }
      return { rows, acres: FIELD[L.fid].acres, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0, app: 0, count: vals.length, samples: true }; }
    const h = histOf(L); if (!h) return null; const key = imgKey(L); const { edges } = buildLUT(L, h); const { min, max } = L.col; const rows = [];""")
# value formatting: FieldAgent prints three significant digits above 1,000 (1.96k, 29.6k, 32.9k)
rep("""  const fmtV = (L, v) => v == null ? '—' : Math.abs(v) >= 1000 ? (v / 1000).toFixed(2) + 'k' : v.toFixed(decOf(L));""",
"""  const fmtV = (L, v) => v == null ? '—' : Math.abs(v) >= 100000 ? Math.round(v / 1000) + 'k' : Math.abs(v) >= 1000 ? (v / 1000).toPrecision(3) + 'k' : v.toFixed(decOf(L));""")
# bin table: sample layers count points, mosaics count acres
rep("""<td>${fmtAc(r.count * stats.app)} ac</td></tr>`).join('')}</table>`;""",
"""<td>${stats.samples ? `${r.count} sample${r.count === 1 ? '' : 's'}` : `${fmtAc(r.count * stats.app)} ac`}</td></tr>`).join('')}</table>`;""")
# the map: value bubbles, drawn after the photo dots; a white ring marks the sample open in the viewer
rep("""    } else { for (const g of FIELDS) { const bp = pathOf([g.ring]); cx2.lineWidth = 2; cx2.strokeStyle = 'rgba(0,208,255,.7)'; cx2.stroke(bp); } }
  }""",
"""      // analytics sample points: FieldAgent draws each sample as a ~40 px bubble in its class colour with the value inside
      for (let i = Ls.length - 1; i >= 0; i--) {
        const L = Ls[i]; if (!isSamples(L) || !L.visible) continue; const { lut } = buildLUT(L, histOf(L));
        const R = bubbleRadius(v.z) * (o.snapshot ? 0.85 : 1);
        cx2.save(); cx2.globalAlpha = L.opacity; cx2.font = `700 ${Math.max(9, Math.round(R * 0.6))}px Roboto, "Helvetica Neue", Arial, sans-serif`; cx2.textAlign = 'center'; cx2.textBaseline = 'middle';
        for (const pt of shownPoints(L)) {
          const [x, y] = P.toScreen(pt.w[0], pt.w[1]); if (x < -R || y < -R || x > W + R || y > H + R) continue;
          const val = sampleValue(L, pt); const packed = lut[clamp(Math.round(v2g(L, val)), 0, 255)]; const col = packed ? unpackCss(packed) : '#7a7a7a'; const ex = isExcluded(L, pt);
          cx2.beginPath(); cx2.arc(x, y, R, 0, Math.PI * 2); cx2.fillStyle = ex ? '#6b6b6b' : col; cx2.fill(); cx2.lineWidth = Math.max(1.5, R * 0.15); cx2.strokeStyle = 'rgba(0,0,0,.3)'; cx2.stroke();
          if (R >= 11) { cx2.fillStyle = '#262626'; cx2.fillText(fmtV(L, val), x, y + 0.5); }
          if (state.photo && state.photo.kind === 'sample' && state.photo.uid === L.uid && samplePoints(L)[state.photo.idx] === pt) { cx2.lineWidth = 3; cx2.strokeStyle = '#fff'; cx2.beginPath(); cx2.arc(x, y, R + 4, 0, Math.PI * 2); cx2.stroke(); }
        }
        cx2.restore();
      }
    } else { for (const g of FIELDS) { const bp = pathOf([g.ring]); cx2.lineWidth = 2; cx2.strokeStyle = 'rgba(0,208,255,.7)'; cx2.stroke(bp); } }
  }
  const bubbleRadius = z => z >= 15.2 ? 20 : z >= 13 ? 20 * (0.35 + 0.65 * (z - 13) / 2.2) : 7;""")
# clicking a bubble opens the sample viewer
rep("""    // photo dots: the nearest sampled dot within reach opens the viewer
    let best = null;""",
"""    // analytics samples: the nearest bubble under the pointer opens the sample viewer
    for (const L of layers()) { if (!isSamples(L) || !L.visible) continue; const pts = samplePoints(L); const R = bubbleRadius(view.z) + 2; let bi = -1, bd = 1e9;
      pts.forEach((pt, idx) => { if (L.hideExcluded && isExcluded(L, pt)) return; const [x, y] = toScreen(pt.w[0], pt.w[1]); const d = Math.hypot(x - sx, y - sy); if (d < R && d < bd) { bd = d; bi = idx; } });
      if (bi >= 0) { openSample(L.uid, bi); return; } }
    // photo dots: the nearest sampled dot within reach opens the viewer
    let best = null;""")
rep("""if (Math.hypot(x - sx, y - sy) < 10) { toast(`This sample carries ${photoSamples(L).length} of the ${(surveyOf(L).photos.count || pos.length).toLocaleString()} photos in this flight — the dots with a bright ring open.`); return; } } }""",
"""if (Math.hypot(x - sx, y - sy) < 10) { toast(photoSamples(L).length ? `This sample carries ${photoSamples(L).length} of the ${(surveyOf(L).photos.count || pos.length).toLocaleString()} photos in this flight — the dots with a bright ring open.` : 'The original photos of this flight are not part of this demo.'); return; } } }""")
# Add Map Layers: analytics rows (and a survey without a name is listed by its date, as FieldAgent does)
rep("""    (s.quicktiles || []).forEach(q => list.push({ id: q.id, name: q.name, key: `${f.id}_${s.key}_${q.id}`, avail: hasImg(`${f.id}_${s.key}_${q.id}`), qt: true }));
    return list;""",
"""    (s.quicktiles || []).forEach(q => list.push({ id: q.id, name: q.name, key: `${f.id}_${s.key}_${q.id}`, avail: hasImg(`${f.id}_${s.key}_${q.id}`), qt: true }));
    if ((s.analytics || []).length) { const kept = list.filter(p => p.avail);   // an analytics flight lists only what was produced for it
      s.analytics.forEach(a => kept.push({ id: a.id, name: a.name, key: a.kind === 'raster' ? `${f.id}_${s.key}_${a.id}` : null, avail: a.kind === 'raster' ? hasImg(`${f.id}_${s.key}_${a.id}`) : !!(a.points && a.points.length), analytic: a.kind, kind: a.kind === 'samples' ? 'samples' : 'drone' }));
      return kept; }
    return list;""")
rep("""      return `<section class="card"><div class="group-head">${icon('i-drone', 'ico sm')}<div class="name"><b>${esc(s.name)}</b><span>${esc(s.date)} · ${esc(SENSOR_LABEL[s.bands] || s.bands)}</span></div>""",
"""      return `<section class="card"><div class="group-head">${icon('i-drone', 'ico sm')}<div class="name"><b>${esc(s.name || s.date)}</b>${s.name ? `<span>${esc(s.date)} · ${esc(SENSOR_LABEL[s.bands] || s.bands)}</span>` : ''}</div>""")
rep("""      ${surveyProducts(f, s).map(p => p.avail ? `<div class="prod-row" data-act="pick" data-survey="${s.key}" data-product="${p.id}" role="button" tabindex="0" aria-pressed="${on('drone', s.key, p.id)}"><span class="prod-ico">${icon(p.qt ? 'i-grid' : 'i-mosaic', 'ico sm')}</span><div class="prod-name"><b>${esc(p.name)}</b>${p.sub ? `<span>${esc(p.sub)}</span>` : ''}</div><span class="radio${on('drone', s.key, p.id) ? ' on' : ''}"></span></div>`""",
"""      ${surveyProducts(f, s).map(p => p.avail ? `<div class="prod-row" data-act="pick" data-survey="${s.key}" data-product="${p.id}" data-kind="${p.kind || 'drone'}" role="button" tabindex="0" aria-pressed="${on(p.kind || 'drone', s.key, p.id)}"><span class="prod-ico">${icon(p.analytic === 'raster' ? 'i-heatmap' : p.analytic === 'samples' ? 'i-samples' : p.qt ? 'i-grid' : 'i-mosaic', 'ico sm')}</span><div class="prod-name"><b>${esc(p.name)}</b>${p.sub ? `<span>${esc(p.sub)}</span>` : ''}</div><span class="radio${on(p.kind || 'drone', s.key, p.id) ? ' on' : ''}"></span></div>`""")
rep("""    else if (act === 'pick') { const { survey, product } = t.dataset; const i = layers().findIndex(l => l.kind === 'drone' && l.survey === survey && l.product === product); if (i >= 0) layers().splice(i, 1); else { const nl = newLayer(state.fid, { kind: 'drone', survey, product }); layers().unshift(nl); ensure(nl); emit('layer_added', { kind: 'drone', survey, product }); } render(true); }""",
"""    else if (act === 'pick') { const { survey, product } = t.dataset; const kind = t.dataset.kind || 'drone'; const i = layers().findIndex(l => l.kind === kind && l.survey === survey && l.product === product); if (i >= 0) layers().splice(i, 1); else { const nl = newLayer(state.fid, { kind, survey, product }); layers().unshift(nl); ensure(nl); emit('layer_added', { kind, survey, product }); } render(true); }
    else if (act === 'sprop') { const pr = ((analyticOf(L) || {}).props || []).find(x => x.id === t.dataset.prop); if (pr) { L.prop = pr.id; L.viz = pr.viz; L.col = defaultCol(L); } state.menu = null; render(true); emit('sample_prop_changed', { prop: L.prop }); }
    else if (act === 'hideex') { L.hideExcluded = !L.hideExcluded; render(true); emit('hide_excluded_toggled', { on: !!L.hideExcluded }); }""")
# the seeded stack of an analytics-only field: the heatmap on, the individual counts hidden
rep("""    const sat = SAT.items.slice().sort((a, b) => satCode(b.date).localeCompare(satCode(a.date))).find(it => hasImg(`${fid}_sat${satCode(it.date)}_ndvi`)); if (sat) mk({ kind: 'sat', date: satCode(sat.date), product: 'ndvi', viz: 'ndvi' }, false);
    return out;""",
"""    const sat = SAT.items.slice().sort((a, b) => satCode(b.date).localeCompare(satCode(a.date))).find(it => hasImg(`${fid}_sat${satCode(it.date)}_ndvi`)); if (sat) mk({ kind: 'sat', date: satCode(sat.date), product: 'ndvi', viz: 'ndvi' }, false);
    for (const sv of f.surveys) for (const a of (sv.analytics || [])) { const avail = a.kind === 'raster' ? hasImg(`${fid}_${sv.key}_${a.id}`) : !!(a.points && a.points.length); if (avail) mk({ kind: a.kind === 'samples' ? 'samples' : 'drone', survey: sv.key, product: a.id }, a.kind === 'raster'); }
    return out;""")
# layer detail: the samples panel (Details · Colorization · Zone Statistics · Download Files) and the analytics raster details
rep("""    const s = surveyOf(L); const isQt = L.product.startsWith('qt_'); const tif = (s.tif || {})[L.product === 'ms' ? 'ms' : L.product];""",
"""    if (isSamples(L)) return renderSamplesLayer(L);
    const an = analyticOf(L);
    const s = surveyOf(L); const isQt = L.product.startsWith('qt_'); const tif = (s.tif || {})[L.product === 'ms' ? 'ms' : L.product];""")
rep("""        <div class="kv-block"><div class="k">Name</div><div class="v">${esc(isQt ? layerTitle(L) : PRODUCT_NAME[L.product] || L.product)}</div><div class="k">Survey</div><div class="v">${esc(s.name)} · ${esc(s.date)}</div><div class="k">Sensor</div><div class="v">${esc(SENSOR_LABEL[s.bands] || s.bands)}${DATA.bands[s.bands] && DATA.bands[s.bands].order.length > 3 ? ` · ${DATA.bands[s.bands].order.length} bands` : ''}</div></div>
        ${vizSelect}""",
"""        <div class="kv-block"><div class="k">Name</div><div class="v">${esc(isQt || an ? layerTitle(L) : PRODUCT_NAME[L.product] || L.product)}</div><div class="k">Survey</div><div class="v">${esc(layerSub(L).replace(' • ', ' · '))}</div>${an ? '' : `<div class="k">Sensor</div><div class="v">${esc(SENSOR_LABEL[s.bands] || s.bands)}${DATA.bands[s.bands] && DATA.bands[s.bands].order.length > 3 ? ` · ${DATA.bands[s.bands].order.length} bands` : ''}</div>`}</div>
        ${an ? `<div class="tip">${esc(an.product || an.name)}${an.code ? ` · ${esc(an.code)}` : ''} — a surface interpolated from the individual sample counts of this flight</div>${tip('analytic', 'Analytics layers colourize like any mosaic: the bins, range and colour scale below apply to the heatmap on the map, and Zone Statistics averages it per zone.')}` : vizSelect}""")
rep("""  // ----- Zones layer view (select which zones draw on the map) and Edit Zone -----
  function renderZones() {""",
"""  function renderSamplesLayer(L) {
    const f = curField(); const an = analyticOf(L) || {}; const pts = shownPoints(L); const prop = sampleProp(L); const st = layerStats(L); const unit = VIZ[L.viz].unit || '';
    const props = an.props || []; const propMenu = state.menu === 'sprop' ? `<div class="menu" role="listbox">${props.map(pr => `<div class="opt${pr.id === L.prop ? ' sel' : ''}" data-act="sprop" data-prop="${esc(pr.id)}" role="option" aria-selected="${pr.id === L.prop}">${esc(pr.label)}</div>`).join('')}</div>` : '';
    const zs = sampleZoneStats(L);
    return head(f.name, { back: 'field' }) + `<div class="panel-scroll">
      <section class="card"><div class="card-title">Details</div>
        <div class="kv-block"><div class="k">Name</div><div class="v">${esc(an.name || layerTitle(L))}</div><div class="k">Survey</div><div class="v">${esc(layerSub(L).replace(' • ', ' · '))}</div></div>
        <div class="select${state.menu === 'sprop' ? ' open' : ''}"><span class="label">Display Property:</span><button class="value" type="button" data-act="menu" data-menu="sprop" aria-haspopup="listbox" aria-expanded="${state.menu === 'sprop'}"><span>${esc(prop.label)}</span>${icon('i-drop')}</button>${propMenu}</div>
        <div class="kv-block"><div class="k">Sample Count</div><div class="v">${pts.length}</div><div class="k">Average</div><div class="v">${fmtV(L, st.avg)}${unit}</div></div>
        <div class="cb-row" data-act="hideex" role="checkbox" aria-checked="${!!L.hideExcluded}" tabindex="0"><span class="cb${L.hideExcluded ? ' on' : ''}"></span><span class="grow">Hide Excluded Data Points</span></div>
        ${tip('samples', `Every circle on the map is one sample photo, coloured by its ${esc(prop.label)}. Click a circle to open the sample viewer; <b>Display Property</b> switches the value the circles show.`)}
      </section>
      ${colorizationHtml(L)}
      <section class="card"><div class="card-title"><span class="grow">Zone Statistics</span><button class="iconbtn" type="button" data-blocked="Zone statistics options" aria-label="More">${icon('i-more', 'ico sm')}</button></div>
        ${zs.map((z, zi) => `<div class="stat-row tri" data-zi="${zi}"><div class="bar${z.boundary ? ' boundary' : ''}"></div><div class="grow"><b>${esc(z.name)}</b><span>${fmtAc(z.acres)} ac</span><div class="mam"><div><b>${fmtV(L, z.min)}${z.min == null ? '' : unit}</b><span>Minimum</span></div><div><b>${fmtV(L, z.avg)}${z.avg == null ? '' : unit}</b><span>Average</span></div><div><b>${fmtV(L, z.max)}${z.max == null ? '' : unit}</b><span>Maximum</span></div></div></div></div>`).join('')}
        ${tip('szstats', 'Minimum, average and maximum of the samples that fall inside each zone — the same numbers FieldAgent prints for the individual counts.')}</section>
      <section class="card"><div class="card-title">Download Files</div><div class="dl-sub">Layer Data</div>
        ${(an.downloads || ['GeoJSON', 'CSV', 'Shapefile']).map(fmt => `<div class="dl-row"><div class="grow"><b>${esc(fmt)}</b></div><button class="dl-btn" type="button" data-act="download" data-what="samples" data-fmt="${esc(fmt)}" aria-label="Download ${esc(fmt)}">${icon('i-download', 'ico sm')}</button></div>`).join('')}
        ${tip('sdownload', 'The individual counts export as GeoJSON, CSV or Shapefile — every sample with its density, emergence, row spacing and photo name.')}</section>
      <button class="delete-bar" type="button" disabled>Delete</button>
    </div>`;
  }
  // ----- Zones layer view (select which zones draw on the map) and Edit Zone -----
  function renderZones() {""")
# report: name analytics layers properly and keep the legend on raster layers
rep("""  function reportLayerName(L) { if (!L) return 'Map'; if (L.kind === 'sat') return layerTitle(L); if (isPhotos(L)) return 'Photo Dots'; if (L.product.startsWith('qt_')) return layerTitle(L); return PRODUCT_NAME[L.product] || L.product; }""",
"""  function reportLayerName(L) { if (!L) return 'Map'; if (L.kind === 'sat') return layerTitle(L); if (isPhotos(L)) return 'Photo Dots'; if (analyticOf(L) || L.product.startsWith('qt_')) return layerTitle(L); return PRODUCT_NAME[L.product] || L.product; }""")
rep("""    const r = state.report; const f = curField(); const top = layers().find(L => L.visible && VIZ[L.viz] && VIZ[L.viz].index && ready(L));""",
"""    const r = state.report; const f = curField(); const top = layers().find(L => L.visible && !isSamples(L) && VIZ[L.viz] && VIZ[L.viz].index && ready(L));""")
# the sample viewer: FieldAgent's photo modal with ANNOTATION tabs, Count Details and the validator-box instructions
rep("""  function closePhoto() { state.photo = null; modalEl.innerHTML = ''; dirty = true; }
  function renderPhoto() {
    const p = state.photo; if (!p) { modalEl.innerHTML = ''; return; }""",
"""  function closePhoto() { state.photo = null; modalEl.innerHTML = ''; dirty = true; }
  function openSample(uid, idx) { const L = findLayer(uid); if (!L) return; const pt = samplePoints(L)[idx]; if (!pt) return; const band = pt.img && !pt.img.ANNOTATION ? Object.keys(pt.img)[0] : 'ANNOTATION'; state.photo = { uid, idx, band, kind: 'sample', meta: false, sub: {}, zoom: 1 }; renderPhoto(); dirty = true; emit('sample_opened', { index: pt.i, file: pt.file }); }
  function renderSample(p) {
    const L = findLayer(p.uid); const pts = samplePoints(L); const pt = pts[p.idx]; const f = curField(); const tabs = ['ANNOTATION', 'ANNOTATION 2']; const key = pt.img && pt.img[p.band]; const ex = isExcluded(L, pt);
    const withImg = pts.filter(x => x.img).map(x => x.i); const rangeTxt = withImg.length ? `${withImg[0]}–${withImg[withImg.length - 1]}` : '';
    modalEl.innerHTML = `<div class="photo-modal" data-act="pclose-bg"><div class="photo-dlg sample-dlg" role="dialog" aria-label="Sample viewer" data-act="pstop">
      <button class="iconbtn white photo-close" type="button" data-act="pclose" aria-label="Close">${icon('i-close')}</button>
      <div class="band-tabs"><div class="pill">${tabs.map(b => `<button type="button" class="${b === p.band ? 'on' : ''}${pt.img && pt.img[b] ? '' : ' dim'}" data-act="pband" data-band="${esc(b)}">${esc(b)}</button>`).join('')}</div></div>
      <div class="photo-stage">${key && hasImg(key) ? `<img src="${DATA.img[key]}" alt="${esc(p.band)} view of sample ${pt.i}" style="transform:scale(${p.zoom})" draggable="false"><div class="zoomers"><button type="button" data-act="pzoom" data-dir="1" aria-label="Zoom in">+</button><button type="button" data-act="pzoom" data-dir="-1" aria-label="Zoom out">−</button></div>` : `<div class="missing">${pt.img ? `The ${esc(p.band)} view of this sample is not in the demo — try the other tab.` : `The annotated photos of samples ${rangeTxt} are in this demo. Use Next / Previous to reach one, or click a circle in that part of the field.`}</div>`}</div>
      <div class="photo-side">
        <button class="dl" type="button" data-act="download" data-what="sample" aria-label="Download">${icon('i-download', 'ico sm')}</button>
        <h2>Image Details</h2>
        <div class="kv2"><div class="full"><div class="k">Field</div><div class="v">${esc(f.name)}</div></div></div>
        <h2 class="count-h">Count Details</h2>
        <div class="kv2"><div><div class="k">Crops Detected</div><div class="v">${fmtV(L, pt.density)} / ac</div></div><div><div class="k">Row Spacing</div><div class="v">${pt.rowSpacing != null ? pt.rowSpacing.toFixed(1) + ' in' : '—'}</div></div></div>
        <h3 class="vb-title">Validator Box Instructions</h3>
        <p class="vb-text">Use the blue box overlay (1/1000th acre) to manually estimate count.</p>
        <ul class="vb-list"><li>${icon('i-rotatecw', 'ico sm')}<span>Rotate to align with rows lengthwise.</span></li><li>${icon('i-move', 'ico sm')}<span>Adjust size to match the box width to the row spacing.</span></li><li>${icon('i-addcircle', 'ico sm')}<span>Drag over a row to perform a count. Count the objects inside the box.</span></li><li>${icon('i-info', 'ico sm')}<span>Multiply count by 1,000 to estimate count per acre.</span></li></ul>
        <button class="btn-wide ghost" type="button" data-act="pexclude">${ex ? 'Include Data Point?' : 'Exclude Data Point?'}</button>
        ${tip('sample', `Each sample is one photo of the flight, counted by Sentera's model. The blue validator box is 1/1000th of an acre: count the plants inside it by hand and multiply by 1,000 to check the number. <b>Exclude Data Point</b> drops an unrepresentative sample from the statistics.`)}
      </div>
      <div class="photo-nav"><button type="button" data-act="pnav" data-dir="-1" ${p.idx === 0 ? 'disabled' : ''}>${icon('i-back')}Previous</button><span>${pt.i} / ${pts.length}</span><button type="button" data-act="pnav" data-dir="1" ${p.idx >= pts.length - 1 ? 'disabled' : ''}>Next ${icon('i-tri')}</button></div>
    </div></div>`;
  }
  function renderPhoto() {
    const p = state.photo; if (!p) { modalEl.innerHTML = ''; return; }
    if (p.kind === 'sample') { renderSample(p); return; }""")
rep("""    else if (act === 'pnav') { const L = findLayer(p.uid); const n = photoSamples(L).length; p.idx = clamp(p.idx + (+t.dataset.dir), 0, n - 1); const smp = photoSamples(L)[p.idx]; if (!(smp.img && smp.img[p.band])) p.band = firstBand(L, smp); p.zoom = 1; renderPhoto(); dirty = true; emit('photo_navigated', { index: p.idx }); }""",
"""    else if (act === 'pnav') { const L = findLayer(p.uid); const list = isSamples(L) ? samplePoints(L) : photoSamples(L); const n = list.length; p.idx = clamp(p.idx + (+t.dataset.dir), 0, n - 1); const smp = list[p.idx];
      if (isSamples(L)) { if (smp.img && !smp.img[p.band]) p.band = Object.keys(smp.img)[0]; } else if (!(smp.img && smp.img[p.band])) p.band = firstBand(L, smp);
      p.zoom = 1; renderPhoto(); dirty = true; emit(isSamples(L) ? 'sample_navigated' : 'photo_navigated', { index: isSamples(L) ? smp.i : p.idx }); }
    else if (act === 'pexclude') { const L = findLayer(p.uid); const pt = samplePoints(L)[p.idx]; if (pt) { const k = exKey(L, pt); if (state.excluded[k]) delete state.excluded[k]; else state.excluded[k] = true; renderPhoto(); render(true); emit('sample_excluded', { index: pt.i, excluded: !!state.excluded[k] }); } }""")
rep("""    else if (act === 'pband') { p.band = t.dataset.band; p.zoom = 1; renderPhoto(); emit('photo_band_changed', { band: p.band }); }""",
"""    else if (act === 'pband') { p.band = t.dataset.band; p.zoom = 1; renderPhoto(); emit(p.kind === 'sample' ? 'sample_tab_changed' : 'photo_band_changed', { band: p.band }); }""")
# public API additions for the tour layer
rep("""  return { state, opts, openField, openFields, flyTo, openPhoto, openLead, render, goto, toast, layers, addLayer, setCollapsed, defaultLayers, root, panel, FIELD, emit, fitField, layerTitle, ready: booted,
    ui: { icon, esc, head, tip, fmtAc, curField, blockedMsg, SENSOR_LABEL, $ } };""",
"""  return { state, opts, openField, openFields, flyTo, openPhoto, openSample, openLead, render, goto, toast, layers, addLayer, setCollapsed, defaultLayers, root, panel, FIELD, emit, fitField, layerTitle, ready: booted,
    ui: { icon, esc, head, tip, fmtAc, fmtV, curField, blockedMsg, SENSOR_LABEL, $, analyticOf, samplePoints, toScreen: (wx, wy) => toScreen(wx, wy), isSamples } };""")

# 12. the field a page opens on (a scenario's field), instead of always the first one
rep("""  const f0 = FIELDS[0]; const s0 = f0.surveys.find(x => hasImg(`${f0.id}_${x.key}_ndvi`)) || f0.surveys[0];""",
"""  const f0 = FIELD[opts.startField] || FIELDS[0]; state.fid = f0.id; const s0 = f0.surveys.find(x => hasImg(`${f0.id}_${x.key}_ndvi`)) || f0.surveys[0];""")

# 13. tassel count: per-product value ranges, a per-image count view, the one-tab sample viewer with "Tassels Detected",
#     the Yield Estimate card and the Opacity card of FieldAgent's tassel panel, and the Sentera 12MP sensor label
rep("""  tassel:  { id: 'tassel', label: 'Tassel Count', short: 'Tassel Count', index: true, range: null, dec: 0, bins: 5, mode: 'area' },
};""",
"""  tassel:  { id: 'tassel', label: 'Tassel Count', short: 'Tassel Count', index: true, range: null, dec: 0, bins: 5, mode: 'area' },
  tasselimg: { id: 'tasselimg', label: 'Tassels per image', short: 'Tassels per image', index: true, range: null, dec: 0, bins: 5, mode: 'area' },
};""")
rep("""const SENSOR_LABEL = { m3m: 'DJI Mavic 3 Multispectral', rgb: 'DJI Mavic 3 Enterprise (RGB)', d4k: 'Sentera Double 4K' };""",
"""const SENSOR_LABEL = { m3m: 'DJI Mavic 3 Multispectral', rgb: 'DJI Mavic 3 Enterprise (RGB)', d4k: 'Sentera Double 4K', s12: 'Sentera 12MP sensor' };""")
rep("""    if (isSamples(L)) { const vals = samplePoints(L).map(p => sampleValue(L, p)); if (vals.length) return [Math.min(...vals), Math.max(...vals)]; }""",
"""    if (isSamples(L)) { const vals = samplePoints(L).map(p => sampleValue(L, p)); if (vals.length) return [Math.min(...vals), Math.max(...vals)]; }
    { const an = analyticOf(L); if (an && an.range) return an.range; }""")
rep("""    const L = findLayer(p.uid); const pts = samplePoints(L); const pt = pts[p.idx]; const f = curField(); const tabs = ['ANNOTATION', 'ANNOTATION 2']; const key = pt.img && pt.img[p.band]; const ex = isExcluded(L, pt);""",
"""    const L = findLayer(p.uid); const pts = samplePoints(L); const pt = pts[p.idx]; const f = curField(); const an = analyticOf(L) || {}; const tabs = an.tabs || ['ANNOTATION', 'ANNOTATION 2']; const key = pt.img && pt.img[p.band]; const ex = isExcluded(L, pt);""")
rep("""        <div class="kv2"><div><div class="k">Crops Detected</div><div class="v">${fmtV(L, pt.density)} / ac</div></div><div><div class="k">Row Spacing</div><div class="v">${pt.rowSpacing != null ? pt.rowSpacing.toFixed(1) + ' in' : '—'}</div></div></div>""",
"""        <div class="kv2"><div><div class="k">${esc(an.detectedLabel || 'Crops Detected')}</div><div class="v">${fmtV(L, pt.density)} / ac</div></div><div><div class="k">Row Spacing</div><div class="v">${pt.rowSpacing != null ? pt.rowSpacing.toFixed(1) + ' in' : '—'}</div></div></div>""")
rep("""      ${colorizationHtml(L)}
      <section class="card"><div class="card-title"><span class="grow">Zone Statistics</span><button class="iconbtn" type="button" data-blocked="Zone statistics options" aria-label="More">${icon('i-more', 'ico sm')}</button></div>
        ${zs.map((z, zi) => `<div class="stat-row tri" data-zi="${zi}">""",
"""      ${an.yieldEstimate ? yieldCardHtml(L, an) : ''}
      ${colorizationHtml(L)}
      ${an.opacity ? `<section class="card"><div class="card-title">Opacity</div><div class="slider-row"><input class="fa-range" type="range" min="0" max="100" step="1" value="${Math.round(L.opacity * 100)}" data-act="opacity" aria-label="Opacity"></div><div class="slider-caption">${Math.round(L.opacity * 100)}%</div></section>` : ''}
      <section class="card"><div class="card-title"><span class="grow">Zone Statistics</span><button class="iconbtn" type="button" data-blocked="Zone statistics options" aria-label="More">${icon('i-more', 'ico sm')}</button></div>
        ${zs.map((z, zi) => `<div class="stat-row tri" data-zi="${zi}">""")

# 14. yield estimate from a Kernel Count activity (fa-ext.js keeps the activities in state.ext); the viewer reports closing
rep("""  function renderSamplesLayer(L) {""",
"""  // Tassel Count → Yield Estimate: needs a Kernel Count activity of the field (Field Activities → + → Kernel Count). The demo
  // uses the common conversion tassels/acre × kernels/ear ÷ 90,000 kernels per bushel; FieldAgent's own factor may differ.
  const KERNELS_PER_BUSHEL = 90000;
  function kernelCounts(fid) { const acts = ((state.ext || {}).activities || {})[fid] || []; return acts.filter(a => a.type === 'Kernel Count' && (a.ears || []).some(e => +e.rows > 0 && +e.per > 0)).map(a => { const ears = a.ears.filter(e => +e.rows > 0 && +e.per > 0); const kpe = ears.reduce((t, e) => t + (+e.rows) * (+e.per), 0) / ears.length; return { applied: a.applied, ears: ears.length, kpe }; }); }
  function yieldCardHtml(L, an) {
    const kcs = kernelCounts(L.fid); const docs = (opts.docsBase || 'https://support.senterasensors.com') + '/fieldagent/analytics/tassel-count';
    if (!kcs.length) return `<section class="card"><div class="card-title">Yield Estimate</div><div class="tip" style="margin-top:2px">Yield estimation requires a kernel count activity.<br><b>Please create one.</b></div><div class="tip"><a href="${esc(docs)}" target="_blank" rel="noopener" style="color:#fff;text-decoration:underline">Click here</a> to learn more about yield estimates.</div>${tip('yield', 'A tassel count becomes a yield estimate once the field has a <b>Kernel Count</b> activity in its crop season (Field Activities → + → Kernel Count, at least three ears). FieldAgent then combines tassels per acre with kernels per ear.')}</section>`;
    const sel = clamp(L.kc || 0, 0, kcs.length - 1); const kc = kcs[sel]; const st = layerStats(L); const bu = st.avg * kc.kpe / KERNELS_PER_BUSHEL;
    const fmtDate = iso => iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(5, 7)}-${iso.slice(8, 10)}-${iso.slice(0, 4)}` : (iso || '');
    const label = k => `Kernel Count · ${fmtDate(k.applied) || 'no date'} · ${k.ears} ${k.ears === 1 ? 'ear' : 'ears'}`;
    const menu = state.menu === 'ykc' ? `<div class="menu" role="listbox">${kcs.map((k, i) => `<div class="opt${i === sel ? ' sel' : ''}" data-act="ykc" data-idx="${i}" role="option">${esc(label(k))}</div>`).join('')}</div>` : '';
    return `<section class="card"><div class="card-title">Yield Estimate</div>
      <div class="select${state.menu === 'ykc' ? ' open' : ''}"><span class="label">Kernel Count Activity</span><button class="value" type="button" data-act="menu" data-menu="ykc" aria-haspopup="listbox" aria-expanded="${state.menu === 'ykc'}"><span>${esc(label(kc))}</span>${icon('i-drop')}</button>${menu}</div>
      <div class="kv-block"><div class="k">Kernels per ear</div><div class="v">${Math.round(kc.kpe).toLocaleString()}</div><div class="k">Estimated Yield</div><div class="v"><b style="font-size:16px">${Math.round(bu).toLocaleString()} bu/ac</b></div></div>
      <div class="tip">${fmtV(L, st.avg)} tassels per acre × ${Math.round(kc.kpe)} kernels per ear ÷ ${KERNELS_PER_BUSHEL.toLocaleString()} kernels per bushel — the demo's conversion; FieldAgent's estimate can use a different factor.</div>
      ${tip('yield2', 'Excluding samples or changing the kernel count updates the estimate. Re-enter kernel counts later in the season if the ears fill differently than expected.')}</section>`;
  }
  function renderSamplesLayer(L) {""")
rep("""    else if (act === 'hideex') { L.hideExcluded = !L.hideExcluded; render(true); emit('hide_excluded_toggled', { on: !!L.hideExcluded }); }""",
"""    else if (act === 'hideex') { L.hideExcluded = !L.hideExcluded; render(true); emit('hide_excluded_toggled', { on: !!L.hideExcluded }); }
    else if (act === 'ykc') { L.kc = +t.dataset.idx; state.menu = null; render(true); emit('yield_activity_selected', { index: L.kc }); }""")
rep("""  function closePhoto() { state.photo = null; modalEl.innerHTML = ''; dirty = true; }""",
"""  function closePhoto() { const was = state.photo; state.photo = null; modalEl.innerHTML = ''; dirty = true; if (was) emit(was.kind === 'sample' ? 'sample_closed' : 'photo_closed'); }""")

# 15. vector analytics ("features": the Elevation and Hydrology product's contour lines, flow lines and depressions) — drawn
#     as lines or filled polygons, colourized by a property like the sample bubbles, with FieldAgent's Details / Colorization /
#     Opacity / Download Files panel
rep("""  tasselimg: { id: 'tasselimg', label: 'Tassels per image', short: 'Tassels per image', index: true, range: null, dec: 0, bins: 5, mode: 'area' },
};""",
"""  tasselimg: { id: 'tasselimg', label: 'Tassels per image', short: 'Tassels per image', index: true, range: null, dec: 0, bins: 5, mode: 'area' },
  dem:     { id: 'dem', label: 'Elevation', short: 'Elevation', index: true, range: null, dec: 0, bins: 20, mode: 'area', scale: 'terrain' },
  hill:    { id: 'hill', label: 'Hillshade', short: 'Hillshade', index: true, range: null, sig: 3, bins: 5, mode: 'area', scale: 'gray' },
  contour: { id: 'contour', label: 'Elevation', short: 'Elevation', index: true, range: null, dec: 0, bins: 20, mode: 'area', scale: 'terrain' },
  acres:   { id: 'acres', label: 'Area (acres)', short: 'Area', index: true, range: null, sig: 3, trim: true, bins: 5, mode: 'area', scale: 'wblue' },
};""")
# number formatting: 3 significant digits (50.0 · 146 · 242) and trimmed decimals (0.04 · 7.72 · 15.4) where FieldAgent prints them
rep("""  const fmtV = (L, v) => v == null ? '—' : Math.abs(v) >= 100000 ? Math.round(v / 1000) + 'k' : Math.abs(v) >= 1000 ? (v / 1000).toPrecision(3) + 'k' : v.toFixed(decOf(L));""",
"""  const fmtV = (L, v) => { if (v == null) return '—'; if (Math.abs(v) >= 100000) return Math.round(v / 1000) + 'k'; if (Math.abs(v) >= 1000) return (v / 1000).toPrecision(3) + 'k'; const vz = VIZ[L.viz] || {}; if (vz.sig) { const t = Number(v).toPrecision(vz.sig); return vz.trim ? String(Number(t)) : t; } const t = v.toFixed(decOf(L)); return vz.trim && t.includes('.') ? t.replace(/\.?0+$/, '') : t; };""")
# world geometry for the features
rep("""      analytics: (s.analytics || []).map(a => ({ ...a, points: (a.points || []).map(p => ({ ...p, w: [merc.x(p.lon), merc.y(p.lat)] })) })),""",
"""      analytics: (s.analytics || []).map(a => ({ ...a, points: (a.points || []).map(p => ({ ...p, w: [merc.x(p.lon), merc.y(p.lat)] })), features: (a.features || []).map(ft => ({ ...ft, wr: (ft.rings || []).map(ringToWorld) })) })),""")
rep("""  const isSamples = L => L.kind === 'samples';
  const samplePoints = L => { const a = analyticOf(L); return a ? (a.points || []) : []; };""",
"""  const isSamples = L => L.kind === 'samples';
  const isFeatures = L => L.kind === 'features';
  const samplePoints = L => { const a = analyticOf(L); return a ? (a.points || []) : []; };
  const featureList = L => { const a = analyticOf(L); return a ? (a.features || []) : []; };
  const itemsOf = L => isFeatures(L) ? featureList(L) : shownPoints(L);   // the things a value belongs to: sample points or vector features""")
rep("""    const pts = shownPoints(L); const sig = `${L.fid}|${L.survey}|${L.product}|${L.prop}|${pts.map(p => p.i).join(',')}`;""",
"""    const pts = itemsOf(L); const sig = `${L.fid}|${L.survey}|${L.product}|${L.prop}|${isFeatures(L) ? pts.length : pts.map(p => p.i).join(',')}`;""")
rep("""    if (isSamples(L)) { const vals = samplePoints(L).map(p => sampleValue(L, p)); if (vals.length) return [Math.min(...vals), Math.max(...vals)]; }""",
"""    if (isSamples(L) || isFeatures(L)) { const vals = (isFeatures(L) ? featureList(L) : samplePoints(L)).map(p => sampleValue(L, p)).filter(x => typeof x === 'number'); if (vals.length) return [Math.min(...vals), Math.max(...vals)]; }""")
rep("""    if (L.kind === 'samples') { const an = analyticOf(L) || {}; const p0 = (an.props || [])[0]; L.prop = p0 ? p0.id : 'density'; L.viz = p0 ? p0.viz : (an.viz || 'stand'); L.col = defaultCol(L); return L; }""",
"""    if (L.kind === 'samples') { const an = analyticOf(L) || {}; const p0 = (an.props || [])[0]; L.prop = p0 ? p0.id : 'density'; L.viz = p0 ? p0.viz : (an.viz || 'stand'); L.col = defaultCol(L); return L; }
    if (L.kind === 'features') { const an = analyticOf(L) || {}; const p0 = (an.props || [])[0]; L.prop = p0 ? p0.id : null; L.viz = p0 && p0.viz ? p0.viz : 'rgb'; L.col = VIZ[L.viz] && VIZ[L.viz].index ? defaultCol(L) : null; if (an.opacity != null) L.opacity = an.opacity; return L; }""")
rep("""  function ready(L) { if (isPhotos(L) || isSamples(L)) return true;""", """  function ready(L) { if (isPhotos(L) || isSamples(L) || isFeatures(L)) return true;""")
rep("""    if (isPhotos(L) || isSamples(L)) return true;
    const key = imgKey(L); if (!hasImg(key)) return false;""", """    if (isPhotos(L) || isSamples(L) || isFeatures(L)) return true;
    const key = imgKey(L); if (!hasImg(key)) return false;""")
rep("""    if (isPhotos(L) || isSamples(L)) return; if (!hasImg(imgKey(L))) return; const key = imgKey(L) + '|' + L.viz;""",
"""    if (isPhotos(L) || isSamples(L) || isFeatures(L)) return; if (!hasImg(imgKey(L))) return; const key = imgKey(L) + '|' + L.viz;""")
rep("""  function histOf(L) { if (isSamples(L)) return sampleHist(L); const key = imgKey(L), im = IMG[key]; if (!im) return null;""",
"""  function histOf(L) { if (isSamples(L) || isFeatures(L)) return sampleHist(L); const key = imgKey(L), im = IMG[key]; if (!im) return null;""")
rep("""        const L = Ls[i]; if (!L.visible || L.opacity <= 0 || isPhotos(L) || isSamples(L)) continue;""",
"""        const L = Ls[i]; if (!L.visible || L.opacity <= 0 || isPhotos(L) || isSamples(L) || isFeatures(L)) continue;""")
rep("""  function imgKey(L, viz) { const v = viz || L.viz; if (L.kind === 'sat') return `${L.fid}_sat${L.date}_${v}`; if (L.kind === 'photos' || L.kind === 'samples') return null;""",
"""  function imgKey(L, viz) { const v = viz || L.viz; if (L.kind === 'sat') return `${L.fid}_sat${L.date}_${v}`; if (L.kind === 'photos' || L.kind === 'samples' || L.kind === 'features') return null;""")
rep("""    if (isSamples(L)) { const pts = shownPoints(L); const vals = pts.map(p => sampleValue(L, p)); const h = sampleHist(L); const { edges } = buildLUT(L, h); const { min, max } = L.col; const rows = [];""",
"""    if (isSamples(L) || isFeatures(L)) { const pts = itemsOf(L); const vals = pts.map(p => sampleValue(L, p)).filter(x => typeof x === 'number'); const h = sampleHist(L); const { edges } = buildLUT(L, h); const { min, max } = L.col; const rows = [];""")
rep("""      return { rows, acres: FIELD[L.fid].acres, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0, app: 0, count: vals.length, samples: true }; }""",
"""      return { rows, acres: FIELD[L.fid].acres, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0, app: 0, count: vals.length, samples: true, noun: isFeatures(L) ? ((analyticOf(L) || {}).noun || 'feature') : 'sample' }; }""")
rep("""<td>${stats.samples ? `${r.count} sample${r.count === 1 ? '' : 's'}` : `${fmtAc(r.count * stats.app)} ac`}</td></tr>`).join('')}</table>`;""",
"""<td>${stats.samples ? `${r.count} ${stats.noun || 'sample'}${r.count === 1 ? '' : 's'}` : `${fmtAc(r.count * stats.app)} ac`}</td></tr>`).join('')}</table>`;""")
# drawing: vector features sit above the rasters and below the zones
rep("""      // zones: only the ones selected in the Zones layer view, white like FieldAgent""",
"""      // vector analytics: contour lines, flow lines, depressions — coloured per feature by the layer's colorization, or by the
      // style FieldAgent exported with them (flow lines: #009dff, wider for the bigger channels)
      for (let i = Ls.length - 1; i >= 0; i--) {
        const L = Ls[i]; if (!isFeatures(L) || !L.visible || L.opacity <= 0) continue; const an = analyticOf(L) || {}; const feats = an.features || []; const st = an.style || {};
        const colorize = !!(L.col && VIZ[L.viz] && VIZ[L.viz].index); const lut = colorize ? buildLUT(L, histOf(L)).lut : null; const poly = an.geom === 'polygon';
        cx2.save(); cx2.globalAlpha = L.opacity; cx2.lineJoin = 'round'; cx2.lineCap = 'round';
        for (const ft of feats) {
          const p = new Path2D(); for (const ring of ft.wr) { ring.forEach(([wx, wy], k) => { const [x, y] = P.toScreen(wx, wy); k ? p.lineTo(x, y) : p.moveTo(x, y); }); if (poly) p.closePath(); }
          let col = ft.color || st.color || '#009dff';
          if (lut) { const val = sampleValue(L, ft); if (typeof val === 'number') { const packed = lut[clamp(Math.round(v2g(L, val)), 0, 255)]; if (!packed) continue; col = unpackCss(packed); } }
          if (poly) { cx2.fillStyle = col; cx2.fill(p, 'evenodd'); cx2.lineWidth = st.outline || 1; cx2.strokeStyle = st.outlineColor || 'rgba(255,255,255,.55)'; cx2.stroke(p); }
          else { cx2.lineWidth = (ft.width || st.width || 2) * (o.snapshot ? 0.8 : 1); cx2.strokeStyle = col; cx2.stroke(p); }
        }
        cx2.restore();
      }
      // zones: only the ones selected in the Zones layer view, white like FieldAgent""")
# Add Map Layers rows, seeding, panel, report
rep("""      s.analytics.forEach(a => kept.push({ id: a.id, name: a.name, key: a.kind === 'raster' ? `${f.id}_${s.key}_${a.id}` : null, avail: a.kind === 'raster' ? hasImg(`${f.id}_${s.key}_${a.id}`) : !!(a.points && a.points.length), analytic: a.kind, kind: a.kind === 'samples' ? 'samples' : 'drone' }));""",
"""      s.analytics.forEach(a => kept.push({ id: a.id, name: a.name, key: a.kind === 'raster' ? `${f.id}_${s.key}_${a.id}` : null, avail: a.kind === 'raster' ? hasImg(`${f.id}_${s.key}_${a.id}`) : a.kind === 'features' ? !!(a.features && a.features.length) : !!(a.points && a.points.length), analytic: a.kind === 'features' ? (a.geom === 'polygon' ? 'polygons' : 'lines') : a.kind, kind: a.kind === 'samples' ? 'samples' : a.kind === 'features' ? 'features' : 'drone' }));""")
rep("""${icon(p.analytic === 'raster' ? 'i-heatmap' : p.analytic === 'samples' ? 'i-samples' : p.qt ? 'i-grid' : 'i-mosaic', 'ico sm')}""",
"""${icon(p.analytic === 'raster' ? 'i-heatmap' : p.analytic === 'samples' ? 'i-samples' : p.analytic === 'polygons' ? 'i-polygon' : p.analytic === 'lines' ? 'i-lines' : p.qt ? 'i-grid' : 'i-mosaic', 'ico sm')}""")
rep("""    for (const sv of f.surveys) for (const a of (sv.analytics || [])) { const avail = a.kind === 'raster' ? hasImg(`${fid}_${sv.key}_${a.id}`) : !!(a.points && a.points.length); if (avail) mk({ kind: a.kind === 'samples' ? 'samples' : 'drone', survey: sv.key, product: a.id }, a.kind === 'raster'); }""",
"""    for (const sv of f.surveys) for (const a of (sv.analytics || [])) { const avail = a.kind === 'raster' ? hasImg(`${fid}_${sv.key}_${a.id}`) : a.kind === 'features' ? !!(a.features && a.features.length) : !!(a.points && a.points.length); if (avail) mk({ kind: a.kind === 'samples' ? 'samples' : a.kind === 'features' ? 'features' : 'drone', survey: sv.key, product: a.id }, a.kind === 'raster'); }""")
rep("""    if (isSamples(L)) return renderSamplesLayer(L);
    const an = analyticOf(L);""",
"""    if (isSamples(L)) return renderSamplesLayer(L);
    if (isFeatures(L)) return renderFeaturesLayer(L);
    const an = analyticOf(L);""")
rep("""  function renderSamplesLayer(L) {""",
"""  function renderFeaturesLayer(L) {
    const f = curField(); const an = analyticOf(L) || {}; const prop = sampleProp(L); const props = an.props || []; const colorize = !!(L.col && VIZ[L.viz] && VIZ[L.viz].index);
    const propMenu = state.menu === 'sprop' ? `<div class="menu" role="listbox">${props.map(pr => `<div class="opt${pr.id === L.prop ? ' sel' : ''}" data-act="sprop" data-prop="${esc(pr.id)}" role="option" aria-selected="${pr.id === L.prop}">${esc(pr.label)}</div>`).join('')}</div>` : '';
    return head(f.name, { back: 'field' }) + `<div class="panel-scroll">
      <section class="card"><div class="card-title">Details</div>
        <div class="kv-block"><div class="k">Name</div><div class="v">${esc(an.name || layerTitle(L))}</div><div class="k">Survey</div><div class="v">${esc(layerSub(L).replace(' • ', ' · '))}</div></div>
        ${props.length ? `<div class="select${state.menu === 'sprop' ? ' open' : ''}"><span class="label">Display Property:</span><button class="value" type="button" data-act="menu" data-menu="sprop" aria-haspopup="listbox" aria-expanded="${state.menu === 'sprop'}"><span>${esc(prop.label)}</span>${icon('i-drop')}</button>${propMenu}</div>` : ''}
        ${an.note ? `<div class="tip">${esc(an.note)}</div>` : ''}
        ${tip('features', `${(an.features || []).length.toLocaleString()} ${esc(an.noun || 'feature')}s drawn from the survey. ${colorize ? `Each one is coloured by its <b>${esc(prop.label)}</b> with the bins and scale below.` : 'They keep the style the product was delivered with.'}`)}
      </section>
      ${colorize ? colorizationHtml(L) : ''}
      <section class="card"><div class="card-title">Opacity</div><div class="slider-row"><input class="fa-range" type="range" min="0" max="100" step="1" value="${Math.round(L.opacity * 100)}" data-act="opacity" aria-label="Opacity"></div><div class="slider-caption">${Math.round(L.opacity * 100)}%</div></section>
      <section class="card"><div class="card-title">Download Files</div><div class="dl-sub">Layer Data</div>
        ${(an.downloads || ['GeoJSON', 'CSV', 'Shapefile']).map(fmt => `<div class="dl-row"><div class="grow"><b>${esc(fmt)}</b></div><button class="dl-btn" type="button" data-act="download" data-what="features" data-fmt="${esc(fmt)}" aria-label="Download ${esc(fmt)}">${icon('i-download', 'ico sm')}</button></div>`).join('')}
        ${tip('fdownload', 'Vector layers export as GeoJSON, CSV or Shapefile for your own GIS — the contour, flow-line and depression geometry with its attributes.')}</section>
      <button class="delete-bar" type="button" disabled>Delete</button>
    </div>`;
  }
  function renderSamplesLayer(L) {""")
rep("""    else if (act === 'sprop') { const pr = ((analyticOf(L) || {}).props || []).find(x => x.id === t.dataset.prop); if (pr) { L.prop = pr.id; L.viz = pr.viz; L.col = defaultCol(L); } state.menu = null; render(true); emit('sample_prop_changed', { prop: L.prop }); }""",
"""    else if (act === 'sprop') { const pr = ((analyticOf(L) || {}).props || []).find(x => x.id === t.dataset.prop); if (pr) { L.prop = pr.id; L.viz = pr.viz || 'rgb'; L.col = VIZ[L.viz] && VIZ[L.viz].index ? defaultCol(L) : null; } state.menu = null; render(true); emit('sample_prop_changed', { prop: L.prop }); }""")
rep("""    const r = state.report; const f = curField(); const top = layers().find(L => L.visible && !isSamples(L) && VIZ[L.viz] && VIZ[L.viz].index && ready(L));""",
"""    const r = state.report; const f = curField(); const top = layers().find(L => L.visible && !isSamples(L) && !isFeatures(L) && VIZ[L.viz] && VIZ[L.viz].index && ready(L));""")

# ---- 16. visual transitions: a layer fades onto the map when it is added or shown again (450 ms) ----
rep("""  function newLayer(fid, spec) {
    const L = { uid: uidSeq++, fid, opacity: 1, clipped: true, visible: true, ...spec };""",
"""  // A layer fades in over FADE_MS the first time it is drawn after being added or shown: L._fade is true while pending,
  // then the start time, then 0. Report snapshots ignore it.
  const FADE_MS = 450;
  const fadeOf = (L, o) => { if (o && o.snapshot) return 1; if (!L._fade) return 1; if (L._fade === true) L._fade = performance.now(); const t = (performance.now() - L._fade) / FADE_MS; if (t >= 1) { L._fade = 0; return 1; } dirty = true; return t * (2 - t); };
  function newLayer(fid, spec) {
    const L = { uid: uidSeq++, fid, opacity: 1, clipped: true, visible: true, _fade: true, ...spec };""")
rep("""        cx2.save(); cx2.globalAlpha = L.opacity; if (L.clipped || L.kind === 'sat') cx2.clip(bp); cx2.drawImage(src, r.x, r.y, r.w, r.h); cx2.restore();""",
"""        cx2.save(); cx2.globalAlpha = L.opacity * fadeOf(L, o); if (L.clipped || L.kind === 'sat') cx2.clip(bp); cx2.drawImage(src, r.x, r.y, r.w, r.h); cx2.restore();""")
rep("""        cx2.save(); cx2.globalAlpha = L.opacity; cx2.lineJoin = 'round'; cx2.lineCap = 'round';""",
"""        cx2.save(); cx2.globalAlpha = L.opacity * fadeOf(L, o); cx2.lineJoin = 'round'; cx2.lineCap = 'round';""")
rep("""        cx2.save(); cx2.globalAlpha = L.opacity; cx2.fillStyle = s.dotColor; cx2.strokeStyle = 'rgba(255,255,255,.95)'; cx2.lineWidth = 1.5;""",
"""        cx2.save(); cx2.globalAlpha = L.opacity * fadeOf(L, o); cx2.fillStyle = s.dotColor; cx2.strokeStyle = 'rgba(255,255,255,.95)'; cx2.lineWidth = 1.5;""")
rep("""        cx2.save(); cx2.globalAlpha = L.opacity; cx2.font = `700 ${Math.max(9, Math.round(R * 0.6))}px Roboto, "Helvetica Neue", Arial, sans-serif`; cx2.textAlign = 'center'; cx2.textBaseline = 'middle';""",
"""        cx2.save(); cx2.globalAlpha = L.opacity * fadeOf(L, o); cx2.font = `700 ${Math.max(9, Math.round(R * 0.6))}px Roboto, "Helvetica Neue", Arial, sans-serif`; cx2.textAlign = 'center'; cx2.textBaseline = 'middle';""")
rep("""    else if (act === 'toggle') { e.stopPropagation(); const l = findLayer(+t.dataset.uid); l.visible = !l.visible; render(true); emit('layer_toggled', { visible: l.visible, layer: layerTitle(l) }); }""",
"""    else if (act === 'toggle') { e.stopPropagation(); const l = findLayer(+t.dataset.uid); l.visible = !l.visible; if (l.visible) l._fade = true; render(true); emit('layer_toggled', { visible: l.visible, layer: layerTitle(l) }); }""")

(site / 'fa-engine.js').write_text(out, encoding='utf-8')
print(f'{len(patches)} patches applied; engine {len(out)} chars')
