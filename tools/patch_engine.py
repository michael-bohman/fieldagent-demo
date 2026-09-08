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

(site / 'fa-engine.js').write_text(out, encoding='utf-8')
print(f'{len(patches)} patches applied; engine {len(out)} chars')
