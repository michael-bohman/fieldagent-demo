
/* ---------------------------------------------------------------------------
   FieldAgent Scout sample fields (v3) — a lookalike of fieldagent.sentera.com's
   field view built from the real stitched mosaics, QuickTiles, satellite
   layers, zones and photos of two fields flown with a Mavic 3 Multispectral,
   a Mavic 3 Enterprise and a Sentera Double 4K. Imagery, boundaries, zones,
   statistics and photo metadata are real; sharing, ordering, uploading,
   drawing and account features are inert because this is a sample.
   Usage: FieldAgentDemo.mount(element, DATA, { fullViewport, onEvent(name, detail), onLead(lead) → Promise|boolean })

   Support-documentation edition (fa-demos). Additional mount options:
     seedLayers: false      start every field with an empty Map Layers card (the tour adds layers itself)
     tips: false            no marketing hint bar and no tip cards inside the panel
     leadCapture: false     download buttons show a toast instead of the "send to my inbox" form
     blockedMessage(what)   text for the controls that are inert in the demo
     downloadMessage        text shown when a download button is pressed
   The mount result exposes render/goto/layers/addLayer/toast/setCollapsed/root/panel/FIELD for the tour layer,
   and the engine emits fine-grained events (view_changed, layer_toggled, color_mode_changed, …) so a tour can
   advance when the reader performs a step. Images are referenced by URL (DATA.img[key]) and decode on demand.
--------------------------------------------------------------------------- */
window.FieldAgentDemo = (function () {
'use strict';

// ---------- geometry ----------
const merc = {
  x: lon => (lon + 180) / 360,
  y: lat => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2; },
  lon: x => x * 360 - 180,
  lat: y => { const n = Math.PI - 2 * Math.PI * y; return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))); },
};
const EARTH = 40075016.686, ACRE = 4046.8564224;
const rectOfBounds = b => ({ x0: merc.x(b.W), y0: merc.y(b.N), x1: merc.x(b.E), y1: merc.y(b.S) });
const rectOfExtent = e => ({ x0: merc.x(e[0]), y0: merc.y(e[3]), x1: merc.x(e[2]), y1: merc.y(e[1]) });
const ringToWorld = ring => ring.map(([lon, lat]) => [merc.x(lon), merc.y(lat)]);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const icon = (id, cls = 'ico') => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
const fmtAc = v => v.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const todayLong = () => new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

// ---------- catalog ----------
const VIZ = {
  rgb:     { id: 'rgb', label: 'RGB' },
  cir:     { id: 'cir', label: 'Color Infrared (NIR, R, G)' },
  natural: { id: 'natural', label: 'Natural Color (R, G, B)' },
  ndvi:    { id: 'ndvi', label: 'NDVI', short: 'NDVI', index: true, range: [-1, 1], dec: 2, formula: '(NIR − Red) / (NIR + Red)' },
  ndre:    { id: 'ndre', label: 'NDRE', short: 'NDRE', index: true, range: [-1, 1], dec: 2, formula: '(NIR − Red Edge) / (NIR + Red Edge)' },
  vari:    { id: 'vari', label: 'VARI', short: 'VARI', index: true, range: [-4, 4], dec: 2, formula: '(Green − Red) / (Green + Red − Blue)' },
  elev:    { id: 'elev', label: 'Elevation', short: 'Elevation', index: true, range: null, dec: 1, unit: ' m', bins: 20, mode: 'range' },
  qt:      { id: 'qt', label: 'QuickTile' },
  // the rest of FieldAgent's Visualization menu: GNDVI is a fixed −1…1 stretch like NDVI/NDRE; CIRE, CIG, NDWI, GLI and the
  // single bands are stretched to the mosaic's own min…max (range: null → the survey's `ranges`), exactly as FieldAgent does
  gndvi:   { id: 'gndvi', label: 'GNDVI', short: 'GNDVI', index: true, range: [-1, 1], dec: 2, formula: '(NIR − Green) / (NIR + Green)' },
  cire:    { id: 'cire', label: 'CIRE', short: 'CIRE', index: true, range: null, dec: 2, formula: 'NIR / Red Edge − 1 (chlorophyll index, red edge)' },
  cig:     { id: 'cig', label: 'CIG', short: 'CIG', index: true, range: null, dec: 2, formula: 'NIR / Green − 1 (chlorophyll index, green)' },
  ndwi:    { id: 'ndwi', label: 'NDWI', short: 'NDWI', index: true, range: null, dec: 2, formula: '(Green − NIR) / (Green + NIR)' },
  gli:     { id: 'gli', label: 'GLI', short: 'GLI', index: true, range: null, dec: 2, formula: '(2·Green − Red − Blue) / (2·Green + Red + Blue)' },
  b1: { id: 'b1', label: 'Band 1', band: 1, index: true, range: null }, b2: { id: 'b2', label: 'Band 2', band: 2, index: true, range: null },
  b3: { id: 'b3', label: 'Band 3', band: 3, index: true, range: null }, b4: { id: 'b4', label: 'Band 4', band: 4, index: true, range: null },
  b5: { id: 'b5', label: 'Band 5', band: 5, index: true, range: null },
  // analytics products: value ranges come from the survey (`ranges`) or from the sample values themselves
  stand:   { id: 'stand', label: 'Stand Count', short: 'Stand Count', index: true, range: null, dec: 0, bins: 5, mode: 'area' },
  emerg:   { id: 'emerg', label: 'Emergence', short: 'Emergence', index: true, range: null, dec: 1, bins: 5, mode: 'area', unit: '%' },
  tassel:  { id: 'tassel', label: 'Tassel Count', short: 'Tassel Count', index: true, range: null, dec: 0, bins: 5, mode: 'area' },
  tasselimg: { id: 'tasselimg', label: 'Tassels per image', short: 'Tassels per image', index: true, range: null, dec: 0, bins: 5, mode: 'area' },
  dem:     { id: 'dem', label: 'Elevation', short: 'Elevation', index: true, range: null, dec: 0, bins: 20, mode: 'area', scale: 'terrain' },
  hill:    { id: 'hill', label: 'Hillshade', short: 'Hillshade', index: true, range: null, sig: 3, bins: 5, mode: 'area', scale: 'gray' },
  contour: { id: 'contour', label: 'Elevation', short: 'Elevation', index: true, range: null, dec: 0, bins: 20, mode: 'area', scale: 'terrain' },
  acres:   { id: 'acres', label: 'Area (acres)', short: 'Area', index: true, range: null, sig: 3, trim: true, bins: 5, mode: 'area', scale: 'wblue' },
};
const INDEX_ORDER = ['ndvi', 'ndre', 'gndvi', 'cire', 'cig', 'ndwi', 'gli'];
// A single-band view is coloured white-to-<its own colour> — blue, olive, red, terracotta, brick — and that scale heads the
// picker for that band; indices default to Red – Yellow – Green. Measured from FieldAgent on 8 Sep 2026.
const BAND_SCALES = {
  blue:    { id: 'wblue', name: 'White – Blue', stops: ['#ffffff', '#ddd6fb', '#b3a6f7', '#8a72f2', '#7658ee'] },
  green:   { id: 'wolive', name: 'White – Olive', stops: ['#ffffff', '#e6e8d6', '#bfc59a', '#98a562', '#8b9a4d'] },
  red:     { id: 'wred', name: 'White – Red', stops: ['#ffffff', '#f9dccd', '#f1a98b', '#e8734f', '#e05a38'] },
  rededge: { id: 'wterra', name: 'White – Terracotta', stops: ['#ffffff', '#f7d2c2', '#e8a184', '#d66a4a', '#cb5c3e'] },
  nir:     { id: 'wbrick', name: 'White – Brick', stops: ['#ffffff', '#e8c9c0', '#c48876', '#8a3a28', '#4a1008'] },
};
const bandRole = name => { const n = String(name || '').toLowerCase(); return n.includes('edge') ? 'rededge' : n.includes('nir') || n.includes('infrared') ? 'nir' : n.includes('blue') ? 'blue' : n.includes('green') ? 'green' : n.includes('red') ? 'red' : 'green'; };
// FieldAgent's colour-scale picker, in its order
const SCALES = [
  { id: 'ryg',   name: 'Red – Yellow – Green', stops: ['#d7191c', '#e98c0e', '#fbff01', '#8bcb21', '#1a9641'] },
  { id: 'bryg',  name: 'Brown – Yellow – Green', stops: ['#a6611a', '#ddbe79', '#f3ee95', '#5bd239', '#0f6e00'] },
  { id: 'terrain', name: 'Terrain', stops: ['#a2f2c6', '#ecf7a2', '#1fae1f', '#0a5f0a', '#c27a1a', '#8b0f0f', '#4f2e1c', '#a7a7a7', '#f5f5f5'] },
  { id: 'reds',  name: 'White – Red', stops: ['#fff5f5', '#fdb0a8', '#fd6a5f', '#ff0000'] },
  { id: 'ryb',   name: 'Red – Yellow – Blue', stops: ['#d7191c', '#fca95e', '#fff9b7', '#88bbad', '#2b83ba'] },
  { id: 'greens',name: 'Greens', stops: ['#f7fcf5', '#a6db9f', '#4cb062', '#0c7533', '#00441b'] },
  { id: 'gray',  name: 'Black – White', stops: ['#050505', '#727272', '#fafafa'] },
  { id: 'byg',   name: 'Black – Yellow Green', stops: ['#050505', '#525719', '#a4b11b', '#eaff01'] },
  { id: 'magma', name: 'Magma', stops: ['#000004', '#441173', '#9d2e7e', '#ed6061', '#fecf92'] },
];
const scaleById = id => SCALES.find(s => s.id === id) || Object.values(BAND_SCALES).find(s => s.id === id) || SCALES[0];
const SAT_PRODUCTS = [{ id: 'ndvi', name: 'NDVI (Red, NIR)' }, { id: 'ndre', name: 'NDRE (Red Edge, NIR)' }, { id: 'rgb', name: 'RGB (Red, Green, Blue)' }];
const SENSOR_LABEL = { m3m: 'DJI Mavic 3 Multispectral', rgb: 'DJI Mavic 3 Enterprise (RGB)', d4k: 'Sentera Double 4K', s12: 'Sentera 12MP sensor' };
const DOT_COLORS = ['#6F32B4', '#F12AA9', '#DE781C', '#617A09', '#704BC7'];   // fallback photo-dot colours (FieldAgent assigns one per survey; the data carries the real ones)
const PRODUCT_NAME = { ms: 'Multispectral Mosaic', rgb: 'RGB Mosaic', elev: 'Elevation Mosaic', vari: 'VARI Mosaic' };
const BAND_TABS = { m3m: ['RGB', 'GREEN', 'NIR', 'RED', 'RED EDGE'], d4k: ['FALSE COLOR NDRE', 'NDRE', 'PRGB'], rgb: ['RGB'] };   // photo viewer tabs, as FieldAgent shows them per sensor
const DEFAULT_BAND = { m3m: 'RGB', d4k: 'PRGB', rgb: 'RGB' };
const STRETCHED_BANDS = new Set(['GREEN', 'NIR', 'RED', 'RED EDGE']);   // 16-bit band files that FieldAgent shows with "Brightness adjusted for display"

// ---------- colour maths (Lab interpolation, like chroma.js mode "lab") ----------
const hex2rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function rgb2lab([r, g, b]) {
  const f = v => { v /= 255; return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92; };
  r = f(r); g = f(g); b = f(b);
  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, y = (r * 0.2126 + g * 0.7152 + b * 0.0722), z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const t = v => v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116;
  return [116 * t(y) - 16, 500 * (t(x) - t(y)), 200 * (t(y) - t(z))];
}
function lab2rgb([L, a, bb]) {
  let y = (L + 16) / 116, x = a / 500 + y, z = y - bb / 200;
  const t = v => { const c = v * v * v; return c > 0.008856 ? c : (v - 16 / 116) / 7.787; };
  x = t(x) * 0.95047; y = t(y); z = t(z) * 1.08883;
  const r = x * 3.2406 + y * -1.5372 + z * -0.4986, g = x * -0.9689 + y * 1.8758 + z * 0.0415, b = x * 0.0557 + y * -0.2040 + z * 1.0570;
  const f = v => { v = v > 0.0031308 ? 1.055 * Math.pow(v, 1 / 2.4) - 0.055 : 12.92 * v; return Math.max(0, Math.min(255, Math.round(v * 255))); };
  return [f(r), f(g), f(b)];
}
const LAB_CACHE = new Map();
function scaleColor(scale, t) {
  let labs = LAB_CACHE.get(scale.id); if (!labs) { labs = scale.stops.map(s => rgb2lab(hex2rgb(s))); LAB_CACHE.set(scale.id, labs); }
  t = clamp(t, 0, 1); const p = t * (labs.length - 1), i = Math.min(labs.length - 2, Math.floor(p)), f = p - i;
  return lab2rgb(labs[i].map((v, k) => v + (labs[i + 1][k] - v) * f));
}
const rgbCss = c => `rgb(${c[0]},${c[1]},${c[2]})`;
const cssGradient = scale => `linear-gradient(90deg, ${scale.stops.join(', ')})`;
const LITTLE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
const pack = (c, a) => LITTLE ? ((a << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0 : ((c[0] << 24) | (c[1] << 16) | (c[2] << 8) | a) >>> 0;
const unpackCss = v => LITTLE ? `rgb(${v & 255},${(v >> 8) & 255},${(v >> 16) & 255})` : `rgb(${(v >>> 24) & 255},${(v >> 16) & 255},${(v >> 8) & 255})`;

function mount(root, DATA, opts = {}) {
  // ---------- static data ----------
  const hasImg = k => !!DATA.img[k];
  const dims = k => DATA.dims[k] || [1, 1];
  const FIELDS = DATA.fields.map(f => ({ ...f, rect: rectOfExtent(f.extent), ring: ringToWorld(f.boundary), centerW: [merc.x(f.center[0]), merc.y(f.center[1])],
    zones: (f.zones || []).map(z => ({ ...z, rings: z.rings.map(ringToWorld) })),
    surveys: f.surveys.map((s, si) => { const ph = s.photos || {}; return { ...s, dotColor: s.dotColor || DOT_COLORS[si % DOT_COLORS.length], quicktiles: s.quicktiles || [],
      analytics: (s.analytics || []).map(a => ({ ...a, points: (a.points || []).map(p => ({ ...p, w: [merc.x(p.lon), merc.y(p.lat)] })), features: (a.features || []).map(ft => ({ ...ft, wr: (ft.rings || []).map(ringToWorld) })) })),
      photos: { ...ph, positions: (ph.positions || []).map(([lon, lat]) => [merc.x(lon), merc.y(lat)]), samples: (ph.samples || []).filter(sm => sm.lon != null && sm.lat != null).map(sm => ({ ...sm, w: [merc.x(sm.lon), merc.y(sm.lat)] })) } }; }) }));
  const FIELD = Object.fromEntries(FIELDS.map(f => [f.id, f]));
  const BASEMAPS = (DATA.basemaps || []).filter(b => hasImg(b.key)).map(b => ({ ...b, rect: rectOfBounds(b.bounds) }))
    .sort((a, b) => ((b.rect.x1 - b.rect.x0) * (b.rect.y1 - b.rect.y0)) - ((a.rect.x1 - a.rect.x0) * (a.rect.y1 - a.rect.y0)));   // coarse first, fine on top
  const SAT = DATA.satellite || { items: [] };
  const satCode = d => d.slice(0, 2) + d.slice(3, 5);
  function acrePerPx(fid, key) { const f = FIELD[fid]; const [w] = dims(key); const lat = (f.extent[1] + f.extent[3]) / 2; const m = EARTH * Math.cos(lat * Math.PI / 180) * (f.rect.x1 - f.rect.x0) / w; return m * m / ACRE; }
  const isTouch = matchMedia('(pointer: coarse)').matches;
  const isPortraitPhone = () => matchMedia('(max-width: 700px) and (orientation: portrait)').matches;
  let store = {}; try { store = JSON.parse(localStorage.getItem('fa-demo') || '{}') || {}; } catch (e) { store = {}; }
  const remember = () => { try { localStorage.setItem('fa-demo', JSON.stringify({ tips: [...state.tipsDone] })); } catch (e) { /* storage may be unavailable */ } };

  // ---------- state ----------
  let uidSeq = 1;
  const state = {
    view: 'field',            // fields | field | add | layer | zones | zone | order | upload | report
    fid: FIELDS[0].id, detailUid: null, layersByField: {}, seeded: {},
    showMore: false, binTable: false, menu: null,
    sources: { surveys: true, satellite: false },
    search: '', sort: 'az',
    zonesOn: {},              // fid → array of zone indexes shown on the map (FieldAgent: selected in the Zones layer view)
    zoneEdit: null, zoneNames: {},
    order: { survey: null, picks: {}, aligned: {} },
    upload: { type: 'photos', alt: 400, horizon: false, kind: 'RGB' },
    report: { paper: 'Letter', title: 'Field Report', editTitle: false, summary: '', editSummary: false, imgTitle: '', editImg: false, note: '', editNote: false, showLogo: false, showContact: false, legend: true, zoneStats: true, secOpen: { logo: true, contact: true, map: true } },
    photo: null,              // { uid, idx, band, meta: bool, sub: {...}, zoom, kind?: 'sample' }
    excluded: {},             // sample points excluded in the sample viewer: `${fid}|${survey}|${product}|${i}` → true
    lead: null, leads: [],    // the "send this dataset to my inbox" form (every download button opens it) and what it collected
    tipsDone: new Set(Array.isArray(store.tips) ? store.tips : []),
    collapsed: false, sheetH: null,
  };
  const layers = () => state.layersByField[state.fid] || (state.layersByField[state.fid] = []);
  const curField = () => FIELD[state.fid];
  const findLayer = uid => layers().find(l => l.uid === uid);
  const zonesOn = fid => state.zonesOn[fid || state.fid] || (state.zonesOn[fid || state.fid] = []);
  const zoneName = (fid, zi) => (state.zoneNames[fid + ':' + zi]) || FIELD[fid].zones[zi].name;

  function surveyOf(L) { return FIELD[L.fid].surveys.find(s => s.key === L.survey); }
  function satItemOf(L) { return SAT.items.find(i => satCode(i.date) === L.date); }
  function imgKey(L, viz) { const v = viz || L.viz; if (L.kind === 'sat') return `${L.fid}_sat${L.date}_${v}`; if (L.kind === 'photos' || L.kind === 'samples' || L.kind === 'features') return null; if (analyticOf(L)) return `${L.fid}_${L.survey}_${L.product}`; return `${L.fid}_${L.survey}_${L.product.startsWith('qt_') ? L.product : v}`; }
  function maskId(L) { return L.kind === 'sat' ? `${L.fid}_boundary` : L.product.startsWith('qt_') ? `${L.fid}_${L.survey}_${L.product}_mask` : `${L.fid}_${L.survey}_mask`; }
  function vizRange(L) { const v = VIZ[L.viz]; if (v.id === 'elev') return surveyOf(L).elevRange || [0, 1]; if (v.range) return v.range;
    if (isSamples(L) || isFeatures(L)) { const vals = (isFeatures(L) ? featureList(L) : samplePoints(L)).map(p => sampleValue(L, p)).filter(x => typeof x === 'number'); if (vals.length) return [Math.min(...vals), Math.max(...vals)]; }
    { const an = analyticOf(L); if (an && an.range) return an.range; } const r = (surveyOf(L).ranges || {})[v.id]; return r || [0, 1]; }
  // decimals: fixed per index; single bands print reflectance (0–1) with three, digital numbers (0–4000) with none
  function decOf(L) { const v = VIZ[L.viz]; return v.dec != null ? v.dec : 2; }
  function bandNames(L) { const s = surveyOf(L); return s && DATA.bands[s.bands] ? DATA.bands[s.bands].order : []; }
  // label of a visualization for this layer's sensor: the band views carry the sensor's band names ("Green (560 nm)")
  function vizLabel(L, viz) { const v = VIZ[viz || L.viz]; if (!v) return viz; if (v.band) return bandNames(L)[v.band - 1] || v.label; return v.label; }
  function vizShort(L, viz) { const v = VIZ[viz || L.viz]; if (v.band) return (bandNames(L)[v.band - 1] || v.label).replace(/\s*\(.*\)$/, ''); return v.short || v.label; }
  function bandScale(L) { const v = VIZ[L.viz]; return v && v.band ? BAND_SCALES[bandRole(bandNames(L)[v.band - 1])] : null; }
  const scalesFor = L => { const b = bandScale(L); return b ? [b, ...SCALES] : SCALES; };   // the picker: the band's own scale first, then FieldAgent's nine
  function defaultCol(L) { const v = VIZ[L.viz]; const [lo, hi] = vizRange(L); const b = bandScale(L); return { bins: v.bins || 5, min: lo, max: hi, mode: v.mode || 'area', scale: b ? b.id : (v.scale || 'ryg'), includeOut: false }; }
  const MS_VIZ = ['cir', 'natural', ...INDEX_ORDER, 'b1', 'b2', 'b3', 'b4', 'b5'];
  function productVizOptions(L) {
    if (L.kind === 'sat') return [L.product];
    const an = analyticOf(L); if (an) return [an.viz];
    if (L.product === 'ms') return MS_VIZ.filter(v => hasImg(imgKey(L, v)));
    if (L.product === 'qt_ndre') return ['ndre'];   // the NDRE QuickTile is an index raster (−1…1) and colourizes like the mosaic
    if (L.product.startsWith('qt_')) return ['qt'];
    return [L.product];
  }
  // A layer fades in over FADE_MS the first time it is drawn after being added or shown: L._fade is true while pending,
  // then the start time, then 0. Report snapshots ignore it.
  const FADE_MS = 450;
  const fadeOf = (L, o) => { if (o && o.snapshot) return 1; if (!L._fade) return 1; if (L._fade === true) L._fade = performance.now(); const t = (performance.now() - L._fade) / FADE_MS; if (t >= 1) { L._fade = 0; return 1; } dirty = true; return t * (2 - t); };
  function newLayer(fid, spec) {
    const L = { uid: uidSeq++, fid, opacity: 1, clipped: true, visible: true, _fade: true, ...spec };
    if (L.kind === 'photos') { L.viz = 'photos'; L.col = null; return L; }
    if (L.kind === 'samples') { const an = analyticOf(L) || {}; const p0 = (an.props || [])[0]; L.prop = p0 ? p0.id : 'density'; L.viz = p0 ? p0.viz : (an.viz || 'stand'); L.col = defaultCol(L); return L; }
    if (L.kind === 'features') { const an = analyticOf(L) || {}; const p0 = (an.props || [])[0]; L.prop = p0 ? p0.id : null; L.viz = p0 && p0.viz ? p0.viz : 'rgb'; L.col = VIZ[L.viz] && VIZ[L.viz].index ? defaultCol(L) : null; if (an.opacity != null) L.opacity = an.opacity; return L; }
    if (!L.viz) { const o = productVizOptions(L); L.viz = o[0] || 'rgb'; }
    L.col = VIZ[L.viz] && VIZ[L.viz].index ? defaultCol(L) : null;
    return L;
  }
  function setViz(L, viz) { if (L.viz === viz) return; L.viz = viz; L.col = VIZ[viz].index ? defaultCol(L) : null; }
  function qtOf(L) { return (surveyOf(L).quicktiles || []).find(q => q.id === L.product); }
  function layerTitle(L) {
    if (L.kind === 'sat') return `Satellite ${VIZ[L.viz].short || VIZ[L.viz].label}`;
    if (L.kind === 'photos') return 'Photo Dots';
    const an = analyticOf(L); if (an) return an.name;
    if (L.product.startsWith('qt_')) { const q = qtOf(L); return q ? q.name : 'QuickTile'; }
    const name = PRODUCT_NAME[L.product] || L.product;
    return L.product === 'ms' && L.viz !== 'cir' ? `${name} · ${vizLabel(L)}` : name;
  }
  function layerSub(L) {
    if (L.kind === 'sat') { const it = satItemOf(L); return `Sentinel-2 • ${it.date} • ${it.clear}% clear`; }
    const s = surveyOf(L); return s.name ? `${s.name} • ${s.date}` : s.date;
  }
  const isPhotos = L => L.kind === 'photos';
  const photoSamples = L => (surveyOf(L).photos.samples || []);
  // ----- analytics (stand count & co.) -----
  const analyticOf = L => (L && L.survey && L.kind !== 'sat' && L.kind !== 'photos') ? ((surveyOf(L) || {}).analytics || []).find(a => a.id === L.product) || null : null;
  const isSamples = L => L.kind === 'samples';
  const isFeatures = L => L.kind === 'features';
  const samplePoints = L => { const a = analyticOf(L); return a ? (a.points || []) : []; };
  const featureList = L => { const a = analyticOf(L); return a ? (a.features || []) : []; };
  const itemsOf = L => isFeatures(L) ? featureList(L) : shownPoints(L);   // the things a value belongs to: sample points or vector features
  const sampleProp = L => { const a = analyticOf(L); const props = (a && a.props) || []; return props.find(p => p.id === L.prop) || props[0] || { id: 'density', label: 'Value', viz: L.viz }; };
  const sampleValue = (L, pt) => pt[sampleProp(L).id];
  const exKey = (L, pt) => `${L.fid}|${L.survey}|${L.product}|${pt.i}`;
  const isExcluded = (L, pt) => !!state.excluded[exKey(L, pt)];
  const shownPoints = L => samplePoints(L).filter(pt => !(L.hideExcluded && isExcluded(L, pt)));
  const SHIST = {};
  function sampleHist(L) {
    const pts = itemsOf(L); const sig = `${L.fid}|${L.survey}|${L.product}|${L.prop}|${isFeatures(L) ? pts.length : pts.map(p => p.i).join(',')}`;
    if (SHIST[sig]) return SHIST[sig];
    const counts = new Uint32Array(256); let total = 0, sum = 0;
    for (const pt of pts) { const g = clamp(Math.round(v2g(L, sampleValue(L, pt))), 0, 255); counts[g]++; total++; sum += g; }
    return SHIST[sig] = { counts, total, sum };
  }
  const pointInRings = (w, rings) => { let inside = false; for (const ring of rings) { for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if (((yi > w[1]) !== (yj > w[1])) && (w[0] < (xj - xi) * (w[1] - yi) / (yj - yi) + xi)) inside = !inside; } } return inside; };
  function sampleZoneStats(L) {
    const f = FIELD[L.fid]; const pts = shownPoints(L); const agg = list => { const v = list.map(p => sampleValue(L, p)); return v.length ? { min: Math.min(...v), avg: v.reduce((a, b) => a + b, 0) / v.length, max: Math.max(...v), n: v.length } : { min: null, avg: null, max: null, n: 0 }; };
    return [{ name: 'Field Boundary', acres: f.acres, boundary: true, ...agg(pts) }, ...f.zones.map((z, zi) => ({ name: zoneName(f.id, zi), acres: z.acres, ...agg(pts.filter(p => pointInRings(p.w, z.rings))) }))];
  }

  // ---------- imagery (decoded lazily) ----------
  const IMG = {}, LOADING = {}, COMPOSITE = {}, IDX = {}, MASK = {}, MASK_CANVAS = {}, RASTER = {}, HIST = {};
  const COLOR_CACHE = new Map();
  function loadImage(key) {
    if (IMG[key]) return Promise.resolve(IMG[key]);
    if (LOADING[key]) return LOADING[key];
    const src = DATA.img[key]; if (!src) return Promise.reject(new Error('missing image ' + key));
    return LOADING[key] = new Promise((res, rej) => { const im = new Image(); im.onload = () => { IMG[key] = im; delete LOADING[key]; res(im); }; im.onerror = () => { delete LOADING[key]; rej(new Error('decode failed ' + key)); }; im.src = src; });
  }
  function readGray(im) {
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(im, 0, 0); const px = x.getImageData(0, 0, c.width, c.height).data; const g = new Uint8Array(c.width * c.height);
    for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = px[j];
    return { w: c.width, h: c.height, gray: g };
  }
  function polygonRaster(id, rings, rect, w, h) {
    const k = `${id}|${w}|${h}`; if (RASTER[k]) return RASTER[k];
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true });
    x.fillStyle = '#fff'; x.beginPath();
    rings.forEach(ring => { ring.forEach(([wx, wy], i) => { const px = (wx - rect.x0) / (rect.x1 - rect.x0) * w, py = (wy - rect.y0) / (rect.y1 - rect.y0) * h; i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.closePath(); });
    x.fill('evenodd');
    const px = x.getImageData(0, 0, w, h).data; const m = new Uint8Array(w * h);
    for (let i = 0, j = 0; i < m.length; i++, j += 4) m[i] = px[j] > 127 ? 1 : 0;
    return RASTER[k] = m;
  }
  const boundaryRaster = (fid, w, h) => polygonRaster(`${fid}_boundary`, [FIELD[fid].ring], FIELD[fid].rect, w, h);
  const zoneRaster = (fid, zi, w, h) => polygonRaster(`${fid}_zone${zi}`, FIELD[fid].zones[zi].rings, FIELD[fid].rect, w, h);
  async function getMask(L, w, h) {
    const id = maskId(L); const k = `${id}|${w}|${h}`;
    if (MASK[k]) return MASK[k];
    if (L.kind === 'sat' || !hasImg(id)) { const fallback = L.product && L.product.startsWith('qt_') && hasImg(`${L.fid}_${L.survey}_mask`) ? `${L.fid}_${L.survey}_mask` : null;
      if (!fallback) return MASK[k] = boundaryRaster(L.fid, w, h);
      const im0 = await loadImage(fallback); return MASK[k] = maskFromImage(im0, w, h); }
    const im = await loadImage(id); return MASK[k] = maskFromImage(im, w, h);
  }
  function maskFromImage(im, w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true });
    x.imageSmoothingEnabled = false; x.drawImage(im, 0, 0, w, h); const px = x.getImageData(0, 0, w, h).data; const m = new Uint8Array(w * h);
    for (let i = 0, j = 0; i < m.length; i++, j += 4) m[i] = px[j] > 127 ? 1 : 0;
    return m;
  }
  function maskCanvas(k, m, w, h) {
    if (MASK_CANVAS[k]) return MASK_CANVAS[k];
    const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
    const id = x.createImageData(w, h); const u32 = new Uint32Array(id.data.buffer);
    for (let i = 0; i < m.length; i++) u32[i] = m[i] ? 0xffffffff : 0;
    x.putImageData(id, 0, 0); return MASK_CANVAS[k] = c;
  }
  async function prepareLayer(L) {
    if (isPhotos(L) || isSamples(L) || isFeatures(L)) return true;
    const key = imgKey(L); if (!hasImg(key)) return false;
    const im = await loadImage(key); const w = im.naturalWidth, h = im.naturalHeight;
    const m = await getMask(L, w, h); const mk = `${maskId(L)}|${w}|${h}`;
    if (VIZ[L.viz] && VIZ[L.viz].index) {
      if (!IDX[key]) IDX[key] = readGray(im);
      const hk = `${key}|${mk}`;
      if (!HIST[hk]) { const g = IDX[key].gray, b = boundaryRaster(L.fid, w, h); const counts = new Uint32Array(256); let total = 0, sum = 0;
        for (let i = 0; i < g.length; i++) if (m[i] && b[i]) { counts[g[i]]++; total++; sum += g[i]; }
        HIST[hk] = { counts, total, sum }; }
    } else if (!COMPOSITE[key]) {
      const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
      x.drawImage(im, 0, 0); x.globalCompositeOperation = 'destination-in'; x.drawImage(maskCanvas(mk, m, w, h), 0, 0);
      COMPOSITE[key] = c;
    }
    return true;
  }
  const PREPARING = new Set();
  function ensure(L) {
    if (isPhotos(L) || isSamples(L) || isFeatures(L)) return; if (!hasImg(imgKey(L))) return; const key = imgKey(L) + '|' + L.viz; if (PREPARING.has(key)) return; PREPARING.add(key);
    prepareLayer(L).then(ok => { PREPARING.delete(key); if (ok) { dirty = true; if (state.view === 'layer' && state.detailUid === L.uid) render(true); } })
      .catch(err => { PREPARING.delete(key); console.error(err); toast('This layer could not be decoded in your browser.'); });
  }
  function ready(L) { if (isPhotos(L) || isSamples(L) || isFeatures(L)) return true; const key = imgKey(L); if (!hasImg(key)) return false; const im = IMG[key]; if (!im) return false; const mk = `${maskId(L)}|${im.naturalWidth}|${im.naturalHeight}`; return VIZ[L.viz] && VIZ[L.viz].index ? !!(IDX[key] && HIST[`${key}|${mk}`]) : !!COMPOSITE[key]; }
  function histOf(L) { if (isSamples(L) || isFeatures(L)) return sampleHist(L); const key = imgKey(L), im = IMG[key]; if (!im) return null; return HIST[`${key}|${maskId(L)}|${im.naturalWidth}|${im.naturalHeight}`] || null; }

  // ---------- colorization ----------
  function g2v(L, g) { const [lo, hi] = vizRange(L); return lo + g / 255 * (hi - lo); }
  function v2g(L, v) { const [lo, hi] = vizRange(L); return (v - lo) / (hi - lo) * 255; }
  function binEdges(L, hist) {
    const { bins, min, max, mode } = L.col; const edges = [min];
    if (mode === 'area' && hist) {
      const gmin = Math.ceil(v2g(L, min)), gmax = Math.floor(v2g(L, max)); let n = 0;
      for (let g = gmin; g <= gmax; g++) n += hist.counts[g];
      let acc = 0, k = 1;
      for (let g = gmin; g <= gmax && k < bins; g++) { acc += hist.counts[g]; while (k < bins && acc >= n * k / bins) { edges.push(Math.min(max, g2v(L, g + 0.5))); k++; } }
      while (edges.length < bins) edges.push(max);
    } else { for (let i = 1; i < bins; i++) edges.push(min + (max - min) * i / bins); }
    edges.push(max); return edges;
  }
  function binColors(L) { const sc = scaleById(L.col.scale); const n = L.col.bins; return Array.from({ length: n }, (_, i) => scaleColor(sc, n === 1 ? 0.5 : i / (n - 1))); }
  function buildLUT(L, hist) {
    const edges = binEdges(L, hist), colors = binColors(L); const { min, max, includeOut } = L.col; const lut = new Uint32Array(256);
    for (let g = 0; g < 256; g++) {
      const v = g2v(L, g); let c = null;
      if (v < min) c = includeOut ? colors[0] : null; else if (v > max) c = includeOut ? colors[colors.length - 1] : null;
      else { let i = 0; while (i < edges.length - 2 && v >= edges[i + 1]) i++; c = colors[i]; }
      lut[g] = c ? pack(c, 255) : 0;
    }
    return { lut, edges, colors };
  }
  function colorizedCanvas(L) {
    const key = imgKey(L), c = L.col, idx = IDX[key]; if (!idx) return null;
    const sig = `${key}|${c.bins}|${c.min}|${c.max}|${c.mode}|${c.scale}|${c.includeOut}`;
    if (COLOR_CACHE.has(sig)) return COLOR_CACHE.get(sig);
    const { lut } = buildLUT(L, histOf(L)); const m = MASK[`${maskId(L)}|${idx.w}|${idx.h}`]; const g = idx.gray;
    const cv = document.createElement('canvas'); cv.width = idx.w; cv.height = idx.h; const x = cv.getContext('2d');
    const id = x.createImageData(idx.w, idx.h); const u32 = new Uint32Array(id.data.buffer);
    for (let i = 0; i < g.length; i++) u32[i] = m[i] ? lut[g[i]] : 0;
    x.putImageData(id, 0, 0);
    if (COLOR_CACHE.size > 14) COLOR_CACHE.delete(COLOR_CACHE.keys().next().value);
    COLOR_CACHE.set(sig, cv); return cv;
  }
  function layerStats(L) {
    if (isSamples(L) || isFeatures(L)) { const pts = itemsOf(L); const vals = pts.map(p => sampleValue(L, p)).filter(x => typeof x === 'number'); const h = sampleHist(L); const { edges } = buildLUT(L, h); const { min, max } = L.col; const rows = [];
      for (let i = 0; i < edges.length - 1; i++) rows.push({ lo: edges[i], hi: edges[i + 1], count: 0 });
      for (const v of vals) { if (v < min || v > max) continue; let i = 0; while (i < rows.length - 1 && v >= edges[i + 1]) i++; rows[i].count++; }
      return { rows, acres: FIELD[L.fid].acres, avg: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0, app: 0, count: vals.length, samples: true, noun: isFeatures(L) ? ((analyticOf(L) || {}).noun || 'feature') : 'sample' }; }
    const h = histOf(L); if (!h) return null; const key = imgKey(L); const { edges } = buildLUT(L, h); const { min, max } = L.col; const rows = [];
    for (let i = 0; i < edges.length - 1; i++) rows.push({ lo: edges[i], hi: edges[i + 1], count: 0 });
    for (let g = 0; g < 256; g++) { const v = g2v(L, g), n = h.counts[g]; if (!n || v < min || v > max) continue; let i = 0; while (i < rows.length - 1 && v >= edges[i + 1]) i++; rows[i].count += n; }
    // "By Area" classes are equal shares by definition, and that is what FieldAgent prints (3.13 ac × 5); the 8-bit bins can only approximate it
    if (L.col.mode === 'area') { const inRange = rows.reduce((a, r) => a + r.count, 0); rows.forEach(r => { r.count = inRange / rows.length; }); }
    const app = acrePerPx(L.fid, key);
    return { rows, acres: h.total * app, avg: h.total ? g2v(L, h.sum / h.total) : 0, app };
  }
  const ZSTAT = {};
  function zoneStats(L, indexes) {
    const key = imgKey(L), idx = IDX[key]; if (!idx) return []; const f = FIELD[L.fid]; const m = MASK[`${maskId(L)}|${idx.w}|${idx.h}`];
    return indexes.map(zi => { const z = f.zones[zi]; const k = `${key}|${maskId(L)}|${zi}`; if (ZSTAT[k] === undefined) { const zr = zoneRaster(f.id, zi, idx.w, idx.h); let n = 0, s = 0; for (let i = 0; i < zr.length; i++) if (zr[i] && m[i]) { n++; s += idx.gray[i]; } ZSTAT[k] = n ? s / n : null; }
      return { name: zoneName(f.id, zi), acres: z.acres, avg: ZSTAT[k] == null ? null : g2v(L, ZSTAT[k]) }; });
  }
  const fmtV = (L, v) => { if (v == null) return '—'; if (Math.abs(v) >= 100000) return Math.round(v / 1000) + 'k'; if (Math.abs(v) >= 1000) return (v / 1000).toPrecision(3) + 'k'; const vz = VIZ[L.viz] || {}; if (vz.sig) { const t = Number(v).toPrecision(vz.sig); return vz.trim ? String(Number(t)) : t; } const t = v.toFixed(decOf(L)); return vz.trim && t.includes('.') ? t.replace(/\.?0+$/, '') : t; };   // 0.38 · 7.55 · 1.96k, as FieldAgent prints them

  // ---------- DOM skeleton ----------
  root.classList.add('fa-app'); if (isTouch) root.classList.add('touch');
  if (opts.fullViewport) { root.style.height = '100vh'; root.style.height = '100dvh'; }
  root.innerHTML = `
    <nav class="rail" aria-label="FieldAgent">
      <svg class="logo" aria-label="Sentera"><use href="#i-logo" fill="#799B3E"/></svg>
      <button class="tab active" type="button" data-tab="Fields" data-nav="fields">${icon('i-fields')}Fields</button>
      <button class="tab" type="button" data-tab="Flight Tasks">${icon('i-drone')}Flight Tasks</button>
      <button class="tab" type="button" data-tab="Orders">${icon('i-orders')}Orders</button>
      <button class="tab" type="button" data-tab="Grower Management">${icon('i-people')}Grower<br>Management</button>
      <button class="tab" type="button" data-tab="Account">${icon('i-account')}Account</button>
    </nav>
    <div class="phone-bar"><svg class="logo" aria-label="Sentera"><use href="#i-logo" fill="#799B3E"/></svg><div class="title" data-role="phone-title"></div><button class="fields-btn" type="button" data-nav="fields">${icon('i-fields')}Fields</button></div>
    <div class="panel-wrap"><div class="sheet-handle" data-role="sheet" aria-label="Drag to resize"></div><div class="panel" data-role="panel"></div></div>
    <button class="collapse" type="button" data-role="collapse" aria-label="Collapse panel">${icon('i-chevrons')}</button>
    <div class="map" data-role="map">
      <canvas data-role="canvas"></canvas>
      <div class="pins" data-role="pins"></div>
      <div class="loading" data-role="loading"><div class="spin"></div>Loading field imagery…</div>
      <div class="org"><div class="select"><span class="label">Select Organization</span><button class="value" type="button" data-blocked="Switching organizations"><span>${esc(DATA.orgName || 'FieldAgent Scout Demo')}</span>${icon('i-drop')}</button></div></div>
      <div class="ctrl-tr">
        <button class="avatar" type="button" data-blocked="Account" aria-label="Account">${icon('i-account')}</button>
        <button class="ruler" type="button" data-role="ruler" aria-label="Measure distance">${icon('i-ruler')}</button>
      </div>
      <div class="draw-tools" data-role="draw-tools" hidden></div>
      <div class="measure-out" data-role="measure" hidden></div>
      <button class="locate" type="button" data-role="locate" aria-label="Recenter on field">${icon('i-locate')}</button>
      <div class="scale" data-role="scalebar">500 ft</div>
      <button class="street" type="button" data-blocked="The street basemap" aria-label="Toggle street map"><div class="thumb"></div><span>Street</span></button>
      <div class="attrib"><a href="https://www.mapbox.com/about/maps/" target="_blank" rel="noopener">© Mapbox</a> | <a href="https://www.maxar.com/" target="_blank" rel="noopener">© Maxar</a> | © Sentera</div>
      <div class="hint" data-role="hint">${icon('i-info')}<div>This is a working preview of FieldAgent with two real fields. Open <b>Map Layers</b> to add flights and satellite dates, click a layer name to change its visualization, and use the back arrow to switch fields.</div><button type="button" data-role="hint-close" aria-label="Dismiss">${icon('i-close', 'ico sm')}</button></div>
      <div class="toast" data-role="toast"></div>
      <div class="report-stage" data-role="report" hidden></div>
    </div>
    <div class="rotate-hint" data-role="rotate">${icon('i-rotate')}<div>FieldAgent is built for a desktop screen. Rotate your phone for the full layout, or browse the field with the sheet below.</div><button type="button" data-role="rotate-close" aria-label="Dismiss">${icon('i-close', 'ico sm')}</button></div>
    <div data-role="modal"></div>
    <div data-role="lead"></div>`;
  const $ = role => root.querySelector(`[data-role="${role}"]`);
  const panel = $('panel'), mapEl = $('map'), canvas = $('canvas'), ctx = canvas.getContext('2d'), pinsEl = $('pins'), modalEl = $('modal'), reportEl = $('report'), leadEl = $('lead');
  let toastT = null;
  function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200); }
  const blockedMsg = what => typeof opts.blockedMessage === 'function' ? opts.blockedMessage(what) : `${what} is part of the full FieldAgent account. This sample is view-only.`;
  const emit = (name, detail) => { try { if (typeof opts.onEvent === 'function') opts.onEvent(name, detail || {}); } catch (e) { /* analytics must never break the demo */ } };

  // ---------- map engine ----------
  const view = { cx: FIELDS[0].centerW[0], cy: FIELDS[0].centerW[1], z: 15 };
  let dpr = 1, cssW = 0, cssH = 0, dirty = true, anim = null;
  function resize() { const r = mapEl.getBoundingClientRect(); cssW = Math.max(1, r.width); cssH = Math.max(1, r.height); dpr = Math.min(2, window.devicePixelRatio || 1); canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr); dirty = true; }
  const scalePx = v => 512 * Math.pow(2, (v || view).z);
  const proj = (v, W, H) => ({ toScreen: (wx, wy) => [(wx - v.cx) * scalePx(v) + W / 2, (wy - v.cy) * scalePx(v) + H / 2] });
  const toScreen = (wx, wy) => proj(view, cssW, cssH).toScreen(wx, wy);
  const toWorld = (sx, sy) => [(sx - cssW / 2) / scalePx() + view.cx, (sy - cssH / 2) / scalePx() + view.cy];
  function visibleBox() {
    const box = { x: 0, y: 0, w: cssW, h: cssH };
    if (isPortraitPhone()) { const pw = root.querySelector('.panel-wrap').getBoundingClientRect(); const mr = mapEl.getBoundingClientRect(); box.y = 52; box.h = Math.max(120, pw.top - mr.top - 52); }
    return box;
  }
  function fitView(rect, pad = 48, W = cssW, H = cssH, box = visibleBox()) {
    const w = rect.x1 - rect.x0, h = rect.y1 - rect.y0;
    const z = clamp(Math.log2(Math.min((box.w - pad * 2) / w, (box.h - pad * 2) / h) / 512), 8, 19.5);
    const s = 512 * Math.pow(2, z); const cx = (rect.x0 + rect.x1) / 2, cy = (rect.y0 + rect.y1) / 2;
    return { cx: cx - (box.x + box.w / 2 - W / 2) / s, cy: cy - (box.y + box.h / 2 - H / 2) / s, z };
  }
  function fitField(fid = state.fid, pad) { const f = FIELD[fid]; const p = pad != null ? pad : isPortraitPhone() ? 22 : cssW < 900 ? 40 : 72; return fitView(f.rect, p); }
  function fitAllFields() { const r = { x0: Math.min(...FIELDS.map(f => f.rect.x0)), y0: Math.min(...FIELDS.map(f => f.rect.y0)), x1: Math.max(...FIELDS.map(f => f.rect.x1)), y1: Math.max(...FIELDS.map(f => f.rect.y1)) }; return fitView(r, 90); }
  function jumpTo(t) { view.cx = t.cx; view.cy = t.cy; view.z = t.z; anim = null; dirty = true; }
  function flyTo(t, dur = 1100) {
    const from = { cx: view.cx, cy: view.cy, z: view.z }; const dist = Math.hypot(t.cx - from.cx, t.cy - from.cy) * scalePx();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || dist < 2) { jumpTo(t); return; }
    anim = { t0: performance.now(), dur, from, to: t, bump: Math.min(2.2, Math.log2(1 + dist / Math.max(cssW, cssH))) }; dirty = true;
  }
  function stepAnim(now) { if (!anim) return; const t = clamp((now - anim.t0) / anim.dur, 0, 1), e = easeInOut(t); view.cx = anim.from.cx + (anim.to.cx - anim.from.cx) * e; view.cy = anim.from.cy + (anim.to.cy - anim.from.cy) * e; view.z = anim.from.z + (anim.to.z - anim.from.z) * e - anim.bump * Math.sin(Math.PI * t); dirty = true; if (t >= 1) anim = null; }
  const dotRadius = z => z >= 17 ? 6 : z >= 15.5 ? 4.5 : 3;
  // Draws the scene into any context: the live map and the report snapshot share it.
  function drawScene(cx2, v, W, H, o = {}) {
    const P = proj(v, W, H); const rectOf = wr => { const [x0, y0] = P.toScreen(wr.x0, wr.y0), [x1, y1] = P.toScreen(wr.x1, wr.y1); return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; };
    const pathOf = rings => { const p = new Path2D(); rings.forEach(ring => { ring.forEach(([wx, wy], i) => { const [x, y] = P.toScreen(wx, wy); i ? p.lineTo(x, y) : p.moveTo(x, y); }); p.closePath(); }); return p; };
    cx2.fillStyle = '#04070e'; cx2.fillRect(0, 0, W, H); cx2.imageSmoothingEnabled = true; cx2.imageSmoothingQuality = 'high';
    for (const b of BASEMAPS) { const r = rectOf(b.rect); if (r.x > W || r.y > H || r.x + r.w < 0 || r.y + r.h < 0) continue; const im = IMG[b.key];
      if (!im) { if (!o.snapshot && !LOADING[b.key]) loadImage(b.key).then(() => { dirty = true; }).catch(() => {}); continue; }
      cx2.drawImage(im, r.x, r.y, r.w, r.h); }
    const f = curField(); const fieldMode = state.view !== 'fields';
    if (fieldMode) {
      const r = rectOf(f.rect); const bp = pathOf([f.ring]); const Ls = layers();
      for (let i = Ls.length - 1; i >= 0; i--) {
        const L = Ls[i]; if (!L.visible || L.opacity <= 0 || isPhotos(L) || isSamples(L) || isFeatures(L)) continue;
        if (!ready(L)) { if (!o.snapshot) ensure(L); continue; }
        const src = VIZ[L.viz] && VIZ[L.viz].index ? colorizedCanvas(L) : COMPOSITE[imgKey(L)]; if (!src) continue;
        cx2.save(); cx2.globalAlpha = L.opacity * fadeOf(L, o); if (L.clipped || L.kind === 'sat') cx2.clip(bp); cx2.drawImage(src, r.x, r.y, r.w, r.h); cx2.restore();
      }
      // vector analytics: contour lines, flow lines, depressions — coloured per feature by the layer's colorization, or by the
      // style FieldAgent exported with them (flow lines: #009dff, wider for the bigger channels)
      for (let i = Ls.length - 1; i >= 0; i--) {
        const L = Ls[i]; if (!isFeatures(L) || !L.visible || L.opacity <= 0) continue; const an = analyticOf(L) || {}; const feats = an.features || []; const st = an.style || {};
        const colorize = !!(L.col && VIZ[L.viz] && VIZ[L.viz].index); const lut = colorize ? buildLUT(L, histOf(L)).lut : null; const poly = an.geom === 'polygon';
        cx2.save(); cx2.globalAlpha = L.opacity * fadeOf(L, o); cx2.lineJoin = 'round'; cx2.lineCap = 'round';
        for (const ft of feats) {
          const p = new Path2D(); for (const ring of ft.wr) { ring.forEach(([wx, wy], k) => { const [x, y] = P.toScreen(wx, wy); k ? p.lineTo(x, y) : p.moveTo(x, y); }); if (poly) p.closePath(); }
          let col = ft.color || st.color || '#009dff';
          if (lut) { const val = sampleValue(L, ft); if (typeof val === 'number') { const packed = lut[clamp(Math.round(v2g(L, val)), 0, 255)]; if (!packed) continue; col = unpackCss(packed); } }
          if (poly) { cx2.fillStyle = col; cx2.fill(p, 'evenodd'); cx2.lineWidth = st.outline || 1; cx2.strokeStyle = st.outlineColor || 'rgba(255,255,255,.55)'; cx2.stroke(p); }
          else { cx2.lineWidth = (ft.width || st.width || 2) * (o.snapshot ? 0.8 : 1); cx2.strokeStyle = col; cx2.stroke(p); }
        }
        cx2.restore();
      }
      // zones: only the ones selected in the Zones layer view, white like FieldAgent
      const on = zonesOn(f.id); const editing = state.view === 'zone' ? state.zoneEdit : null;
      on.concat(editing != null && !on.includes(editing) ? [editing] : []).forEach(zi => { const z = f.zones[zi]; const p = pathOf(z.rings); const sel = editing === zi; cx2.save(); cx2.fillStyle = sel ? 'rgba(255,255,255,.3)' : 'rgba(255,255,255,.16)'; cx2.fill(p, 'evenodd'); cx2.lineWidth = sel ? 3 : 2; cx2.strokeStyle = 'rgba(255,255,255,.92)'; cx2.stroke(p); cx2.restore(); });
      cx2.lineWidth = 4; cx2.strokeStyle = '#00d0ff'; cx2.lineJoin = 'round'; cx2.stroke(bp);
      // photo dots on top, like FieldAgent's scatterplot layer
      for (let i = Ls.length - 1; i >= 0; i--) {
        const L = Ls[i]; if (!isPhotos(L) || !L.visible) continue; const s = surveyOf(L); const pos = s.photos.positions || []; const rad = dotRadius(v.z) * (o.snapshot ? 0.8 : 1);
        cx2.save(); cx2.globalAlpha = L.opacity * fadeOf(L, o); cx2.fillStyle = s.dotColor; cx2.strokeStyle = 'rgba(255,255,255,.95)'; cx2.lineWidth = 1.5;
        for (const p of pos) { const [x, y] = P.toScreen(p[0], p[1]); if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue; cx2.beginPath(); cx2.arc(x, y, rad, 0, Math.PI * 2); cx2.fill(); cx2.stroke(); }
        cx2.lineWidth = 2.5;
        for (const smp of photoSamples(L)) { const [x, y] = P.toScreen(smp.w[0], smp.w[1]); cx2.beginPath(); cx2.arc(x, y, rad + 1.5, 0, Math.PI * 2); cx2.fill(); cx2.stroke(); }
        if (state.photo && state.photo.uid === L.uid) { const smp = photoSamples(L)[state.photo.idx]; if (smp) { const [x, y] = P.toScreen(smp.w[0], smp.w[1]); cx2.fillStyle = 'rgba(0,208,255,.45)'; cx2.beginPath(); cx2.arc(x, y, rad + 9, 0, Math.PI * 2); cx2.fill(); } }
        cx2.restore();
      }
      // analytics sample points: FieldAgent draws each sample as a ~40 px bubble in its class colour with the value inside
      for (let i = Ls.length - 1; i >= 0; i--) {
        const L = Ls[i]; if (!isSamples(L) || !L.visible) continue; const { lut } = buildLUT(L, histOf(L));
        const R = bubbleRadius(v.z) * (o.snapshot ? 0.85 : 1);
        cx2.save(); cx2.globalAlpha = L.opacity * fadeOf(L, o); cx2.font = `700 ${Math.max(9, Math.round(R * 0.6))}px Roboto, "Helvetica Neue", Arial, sans-serif`; cx2.textAlign = 'center'; cx2.textBaseline = 'middle';
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
  const bubbleRadius = z => z >= 15.2 ? 20 : z >= 13 ? 20 * (0.35 + 0.65 * (z - 13) / 2.2) : 7;
  function draw() { dirty = false; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); drawScene(ctx, view, cssW, cssH); drawMeasure(); updateScaleBar(); updatePins(); }
  function frame(now) { stepAnim(now); if (dirty) draw(); requestAnimationFrame(frame); }
  function updateScaleBar() {
    const mpp = EARTH * Math.cos(merc.lat(view.cy) * Math.PI / 180) / scalePx(); const ftPerPx = mpp * 3.28084; const nice = [20, 50, 100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000, 26400, 52800, 105600, 264000];
    let ft = nice[0]; for (const n of nice) if (n / ftPerPx <= 100) ft = n;
    const el = $('scalebar'); el.style.width = Math.round(ft / ftPerPx) + 'px'; el.textContent = ft >= 5280 ? (ft / 5280).toFixed(ft % 5280 ? 1 : 0) + ' mi' : ft.toLocaleString() + ' ft';
  }
  function updatePins() {
    if (state.view !== 'fields') { if (pinsEl.childElementCount) pinsEl.innerHTML = ''; return; }
    if (!pinsEl.childElementCount) pinsEl.innerHTML = FIELDS.map(f => `<div class="pin" data-pin="${f.id}" role="button" tabindex="0" aria-label="Open ${esc(f.name)}"><svg><use href="#i-pin"/></svg></div><div class="pin-label" data-pinlabel="${f.id}">${esc(f.name)}</div>`).join('');
    for (const f of FIELDS) { const [x, y] = toScreen(f.centerW[0], f.centerW[1]); const p = pinsEl.querySelector(`[data-pin="${f.id}"]`), l = pinsEl.querySelector(`[data-pinlabel="${f.id}"]`); p.style.left = x + 'px'; p.style.top = y + 'px'; l.style.left = x + 'px'; l.style.top = y + 'px'; }
  }
  let drag = null; const pointers = new Map(); let pinch = null;
  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, [e.clientX, e.clientY]); anim = null;
    if (pointers.size === 1) { drag = { x: e.clientX, y: e.clientY, moved: false }; canvas.classList.add('grabbing'); }
    else if (pointers.size === 2) { const p = [...pointers.values()]; pinch = { d: Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]), z: view.z }; drag = null; } });
  canvas.addEventListener('pointermove', e => { if (!pointers.has(e.pointerId)) return; pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && pointers.size === 2) { const p = [...pointers.values()]; const d = Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]); const r = canvas.getBoundingClientRect(); setZoom(pinch.z + Math.log2(d / pinch.d), (p[0][0] + p[1][0]) / 2 - r.left, (p[0][1] + p[1][1]) / 2 - r.top); return; }
    if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    view.cx -= dx / scalePx(); view.cy -= dy / scalePx(); drag.x = e.clientX; drag.y = e.clientY; dirty = true; });
  function endPointer(e) { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; if (pointers.size === 0) { if (drag && !drag.moved) onMapClick(e); drag = null; canvas.classList.remove('grabbing'); } }
  canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('wheel', e => { e.preventDefault(); anim = null; const r = canvas.getBoundingClientRect(); setZoom(view.z - e.deltaY * (e.deltaMode ? 0.05 : 0.0025), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  canvas.addEventListener('dblclick', e => { const r = canvas.getBoundingClientRect(); setZoom(view.z + 1, e.clientX - r.left, e.clientY - r.top); });
  function setZoom(z, sx, sy) { z = clamp(z, 8, 19.5); const [wx, wy] = toWorld(sx, sy); view.z = z; const [nx, ny] = toWorld(sx, sy); view.cx += wx - nx; view.cy += wy - ny; dirty = true; }
  if (window.ResizeObserver) new ResizeObserver(() => resize()).observe(mapEl); else window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(() => { resize(); if (state.view !== 'fields') jumpTo(fitField()); }, 300));

  let measuring = false, measurePts = [];
  $('ruler').addEventListener('click', () => { measuring = !measuring; measurePts = []; emit('measure_toggled', { on: measuring }); $('ruler').classList.toggle('on', measuring); const m = $('measure'); m.hidden = !measuring; m.textContent = isTouch ? 'Tap two points on the map to measure.' : 'Click two points on the map to measure.'; canvas.style.cursor = measuring ? 'crosshair' : ''; dirty = true; });
  function onMapClick(e) {
    const r = canvas.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top;
    if (measuring) { const [wx, wy] = toWorld(sx, sy); if (measurePts.length >= 2) measurePts = []; measurePts.push([wx, wy]);
      if (measurePts.length === 2) { const [a, b] = measurePts; const lat = merc.lat((a[1] + b[1]) / 2); const m = Math.hypot(b[0] - a[0], b[1] - a[1]) * EARTH * Math.cos(lat * Math.PI / 180); $('measure').textContent = `${(m * 3.28084).toFixed(0)} ft  ·  ${m.toFixed(0)} m`; } else $('measure').textContent = 'Now the second point.'; dirty = true; return; }
    if (state.view === 'fields') { const P = proj(view, cssW, cssH); for (const f of FIELDS) { const p = new Path2D(); f.ring.forEach(([wx, wy], i) => { const [x, y] = P.toScreen(wx, wy); i ? p.lineTo(x, y) : p.moveTo(x, y); }); p.closePath(); if (ctx.isPointInPath(p, sx * dpr, sy * dpr)) { openField(f.id); return; } } return; }
    // analytics samples: the nearest bubble under the pointer opens the sample viewer
    for (const L of layers()) { if (!isSamples(L) || !L.visible) continue; const pts = samplePoints(L); const R = bubbleRadius(view.z) + 2; let bi = -1, bd = 1e9;
      pts.forEach((pt, idx) => { if (L.hideExcluded && isExcluded(L, pt)) return; const [x, y] = toScreen(pt.w[0], pt.w[1]); const d = Math.hypot(x - sx, y - sy); if (d < R && d < bd) { bd = d; bi = idx; } });
      if (bi >= 0) { openSample(L.uid, bi); return; } }
    // photo dots: the nearest sampled dot within reach opens the viewer
    let best = null;
    for (const L of layers()) { if (!isPhotos(L) || !L.visible) continue; photoSamples(L).forEach((smp, idx) => { const [x, y] = toScreen(smp.w[0], smp.w[1]); const d = Math.hypot(x - sx, y - sy); if (d < 14 && (!best || d < best.d)) best = { d, L, idx }; }); }
    if (best) { openPhoto(best.L.uid, best.idx); return; }
    for (const L of layers()) { if (!isPhotos(L) || !L.visible) continue; const pos = surveyOf(L).photos.positions || []; for (const p of pos) { const [x, y] = toScreen(p[0], p[1]); if (Math.hypot(x - sx, y - sy) < 10) { toast(photoSamples(L).length ? `This sample carries ${photoSamples(L).length} of the ${(surveyOf(L).photos.count || pos.length).toLocaleString()} photos in this flight — the dots with a bright ring open.` : 'The original photos of this flight are not part of this demo.'); return; } } }
  }
  function drawMeasure() { if (!measuring || !measurePts.length) return; ctx.save(); ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    const pts = measurePts.map(p => toScreen(p[0], p[1])); ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); ctx.setLineDash([]); pts.forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 5, 0, Math.PI * 2); ctx.fill(); }); ctx.restore(); }

  // ---------- navigation ----------
  function defaultLayers(fid, force = false) {
    const f = FIELD[fid]; const out = []; if (opts.seedLayers === false && !force) return out; const s = f.surveys.find(x => hasImg(`${fid}_${x.key}_ndvi`)) || f.surveys[0]; if (!s) return out;
    const mk = (spec, visible) => { const L = newLayer(fid, spec); L.visible = visible; out.push(L); };
    // A representative stack, top to bottom: the NDVI a subscriber looks at first, the flight's photo dots and RGB
    // beneath it, then hidden rows to switch on — the earlier date for comparison, elevation, the QuickTile and the
    // latest clear satellite pass.
    if (hasImg(`${fid}_${s.key}_ndvi`)) mk({ kind: 'drone', survey: s.key, product: 'ms', viz: 'ndvi' }, true);
    if ((s.photos.positions || []).length) mk({ kind: 'photos', survey: s.key, product: 'photos' }, false);
    if (hasImg(`${fid}_${s.key}_rgb`)) mk({ kind: 'drone', survey: s.key, product: 'rgb' }, true);
    const other = f.surveys.find(x => x !== s && x.bands === s.bands && hasImg(`${fid}_${x.key}_ndvi`)); if (other) mk({ kind: 'drone', survey: other.key, product: 'ms', viz: 'ndvi' }, false);
    if (hasImg(`${fid}_${s.key}_elev`)) mk({ kind: 'drone', survey: s.key, product: 'elev' }, false);
    const qt = (s.quicktiles || []).find(q => hasImg(`${fid}_${s.key}_${q.id}`)); if (qt) mk({ kind: 'drone', survey: s.key, product: qt.id }, false);
    const sat = SAT.items.slice().sort((a, b) => satCode(b.date).localeCompare(satCode(a.date))).find(it => hasImg(`${fid}_sat${satCode(it.date)}_ndvi`)); if (sat) mk({ kind: 'sat', date: satCode(sat.date), product: 'ndvi', viz: 'ndvi' }, false);
    for (const sv of f.surveys) for (const a of (sv.analytics || [])) { const avail = a.kind === 'raster' ? hasImg(`${fid}_${sv.key}_${a.id}`) : a.kind === 'features' ? !!(a.features && a.features.length) : !!(a.points && a.points.length); if (avail) mk({ kind: a.kind === 'samples' ? 'samples' : a.kind === 'features' ? 'features' : 'drone', survey: sv.key, product: a.id }, a.kind === 'raster'); }
    return out;
  }
  function openField(fid, animate = true) {
    state.fid = fid; state.view = 'field'; state.menu = null; state.detailUid = null; state.zoneEdit = null;
    if (!state.seeded[fid]) { state.seeded[fid] = true; state.layersByField[fid] = defaultLayers(fid); }
    layers().forEach(ensure); render(); const t = fitField(fid); animate ? flyTo(t) : jumpTo(t);
    if (isPortraitPhone() && state.collapsed) setCollapsed(false); if (animate) emit('field_opened', { field: fid });
  }
  function openFields() { state.view = 'fields'; state.menu = null; state.detailUid = null; render(); flyTo(fitAllFields(), 900); emit('fields_list_opened'); }
  function setCollapsed(c) {
    state.collapsed = c; root.classList.toggle('collapsed', c);
    if (isPortraitPhone()) root.style.setProperty('--sheet-h', c ? '22px' : (state.sheetH || '42%'));
    setTimeout(resize, 40); setTimeout(() => { resize(); if (isPortraitPhone() && state.view !== 'fields') flyTo(fitField(), 450); }, 280);
  }
  function goto(view) { state.view = view; state.menu = null; render(); emit('view_changed', { view }); }

  // ---------- tips (demo annotations; dismissible, remembered per browser) ----------
  function tip(id, html) { if (opts.tips === false || state.tipsDone.has(id)) return ''; return `<div class="tip-card" data-tip="${id}">${icon('i-info')}<div>${html}</div><button type="button" data-act="tipclose" data-tip="${id}" aria-label="Dismiss tip">${icon('i-close', 'ico xs')}</button></div>`; }

  // ---------- panel rendering ----------
  function head(title, o = {}) {
    const back = o.back === 'fields' ? `<button class="back" type="button" data-nav="fields" aria-label="Back to fields">${icon('i-back')}</button>` : o.back ? `<button class="back" type="button" data-act="back" data-to="${o.back}" aria-label="Back">${icon('i-back')}</button>` : '';
    return `<div class="panel-head">${back}<h1${back ? '' : ' style="padding-left:8px"'}>${esc(title)}</h1>${o.share ? `<button class="iconbtn" type="button" data-blocked="Sharing" aria-label="Share field">${icon('i-share')}</button>` : ''}${o.add ? `<button class="iconbtn white" type="button" data-blocked="Adding a field" aria-label="Add field">${icon('i-plus')}</button>` : ''}</div>${o.sub ? `<div class="subtitle">${esc(o.sub)}</div>` : ''}`;
  }
  function renderFields() {
    const q = state.search.trim().toLowerCase(); let list = FIELDS.filter(f => !q || f.name.toLowerCase().includes(q));
    list = list.slice().sort((a, b) => state.sort === 'za' ? b.name.localeCompare(a.name) : state.sort === 'acres' ? b.acres - a.acres : a.name.localeCompare(b.name));
    const sortName = { az: 'Field Name', za: 'Field Name (Z–A)', acres: 'Acres' }[state.sort];
    const sortMenu = state.menu === 'sort' ? `<div class="menu" role="listbox">${Object.entries({ az: 'Field Name', za: 'Field Name (Z–A)', acres: 'Acres' }).map(([k, v]) => `<div class="opt${state.sort === k ? ' sel' : ''}" data-act="sort" data-sort="${k}" role="option">${v}</div>`).join('')}</div>` : '';
    const seasonMenu = state.menu === 'season' ? `<div class="menu" role="listbox"><div class="opt sel" data-act="season" role="option">All</div><div class="opt" data-act="season" role="option">2026</div><div class="opt" data-act="season" role="option">2025</div><div class="opt" data-act="season" role="option">2024</div></div>` : '';
    return head('Fields', { add: true, share: true }) + `<div class="panel-scroll">
      <div class="search"><input type="search" placeholder="Search" value="${esc(state.search)}" data-act="search" aria-label="Search fields">${icon('i-search', 'ico sm')}</div>
      <div class="selects">
        <div class="select${state.menu === 'sort' ? ' open' : ''}" style="margin:0"><span class="label">Sort By</span><button class="value" type="button" data-act="menu" data-menu="sort" aria-haspopup="listbox"><span>${sortName}</span>${icon('i-drop')}</button>${sortMenu}</div>
        <div class="select${state.menu === 'season' ? ' open' : ''}" style="margin:0"><span class="label">Crop Season</span><button class="value" type="button" data-act="menu" data-menu="season" aria-haspopup="listbox"><span>All</span>${icon('i-drop')}</button>${seasonMenu}</div>
      </div>
      <div class="showing">Showing ${list.length} of ${FIELDS.length} Fields</div>
      <section class="card" style="padding:4px 12px">${list.length ? list.map(f => `<div class="field-row${f.id === state.fid ? ' active' : ''}" data-act="open" data-fid="${f.id}" role="button" tabindex="0"><div class="bar"></div><div class="grow"><b>${esc(f.name)}</b><span>${fmtAc(f.acres)} ac · ${f.surveys.length} surveys</span></div>${icon('i-tri', 'ico sm')}</div>`).join('') : '<div class="muted-center">No fields match your search.</div>'}</section>
      ${tip('fields', 'Every field you fly lives here, with all of its flights, mosaics, satellite passes and zones filed by date. Click a field — or its pin on the map — to open it.')}
    </div>`;
  }
  function thumbsHtml(f) {
    const s = f.surveys[0] || { key: '' }; const keys = [];
    const push = (k, viz) => { if (hasImg(k) && keys.length < 5) keys.push({ k, viz }); };
    push(`${f.id}_${s.key}_rgb`); push(`${f.id}_${s.key}_ndvi`, 'ndvi'); push(`${f.id}_${s.key}_cir`); push(`${f.id}_${s.key}_elev`, 'elev'); (s.quicktiles || []).forEach(q => push(`${f.id}_${s.key}_${q.id}`)); push(`${f.id}_${s.key}_ndre`, 'ndre');
    return `<div class="thumbs" data-act="add" role="button" tabindex="0">${keys.map(o => `<canvas data-thumb="${o.k}" data-viz="${o.viz || ''}" width="58" height="52"></canvas>`).join('')}<div class="cta">Click ${icon('i-layers')} to add a map layer.</div></div>`;
  }
  async function fillThumbs() {
    for (const c of panel.querySelectorAll('canvas[data-thumb]')) {
      const key = c.dataset.thumb, viz = c.dataset.viz; try {
        const im = await loadImage(key); let src = im;
        if (viz) { const parts = key.split('_'); const L = newLayer(parts[0], { kind: 'drone', survey: parts[1], product: viz === 'elev' ? 'elev' : 'ms', viz }); await prepareLayer(L); src = colorizedCanvas(L) || im; }
        const x = c.getContext('2d'); const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight; const cw = Math.min(w, h) * 0.45, ch = cw * 52 / 58;
        x.drawImage(src, (w - cw) / 2, (h - ch) / 2, cw, ch, 0, 0, 58, 52);
      } catch (e) { /* thumbnail stays as a placeholder */ }
    }
  }
  function renderField() {
    const f = curField(); const Ls = layers();
    const rows = Ls.length ? Ls.map((L, i) => `<div class="layer-row${L.visible ? '' : ' hidden-layer'}" data-uid="${L.uid}" data-index="${i}" data-act="detail" tabindex="0" role="button" aria-label="${esc(layerTitle(L))}">
        ${isPhotos(L) ? `<span class="pbar" style="background:${surveyOf(L).dotColor}"></span>` : `<span class="drag-handle" data-handle="1" title="Drag to reorder">${icon('i-drag', 'ico sm')}</span>`}
        <div class="layer-name"><b>${esc(layerTitle(L))}</b><span>${esc(layerSub(L))}</span></div>
        <div class="row-actions"><button class="iconbtn" type="button" data-act="toggle" data-uid="${L.uid}" aria-label="${L.visible ? 'Hide' : 'Show'} layer">${icon(L.visible ? 'i-eye' : 'i-eyeoff', 'ico sm')}</button><button class="iconbtn" type="button" data-act="remove" data-uid="${L.uid}" aria-label="Remove layer">${icon('i-cancel', 'ico sm')}</button></div></div>`).join('') : thumbsHtml(f);
    const on = zonesOn(f.id);
    const zones = on.map(zi => { const z = f.zones[zi]; return `<div class="zone-row pick" data-act="zone" data-zi="${zi}" role="button" tabindex="0"><div class="bar"></div><div class="grow"><b>${esc(zoneName(f.id, zi))}</b><span>${fmtAc(z.acres)} ac</span></div></div>`; }).join('');
    const zoneMenu = state.menu === 'zmore' ? `<div class="menu" role="menu" style="left:auto;right:0;width:220px">${['GeoJSON', 'Shapefile', 'CSV', 'KML'].map(t => `<div class="opt" data-act="download" data-what="zones" data-fmt="${t}" role="menuitem">Download as ${t}</div>`).join('')}</div>` : '';
    return head(f.name, { back: 'fields', share: true }) + `<div class="panel-scroll">
      <section class="card"><div class="card-title"><span class="grow">Field Details</span><button class="iconbtn" type="button" data-blocked="Editing field details" aria-label="Edit field">${icon('i-edit', 'ico sm')}</button></div>
        <div class="kv"><div class="field-label">Grower</div><div class="field-value">${esc(f.grower || 'Not Specified')}</div><div class="field-label">Farm</div><div class="field-value">${esc(f.farm || 'Not Specified')}</div>
        ${state.showMore ? `<div class="field-label">Area</div><div class="field-value">${fmtAc(f.acres)} ac</div><div class="field-label">State</div><div class="field-value">${esc(f.state || 'Not Specified')}</div><div class="field-label">City</div><div class="field-value">${esc(f.city || 'Not Specified')}</div><div class="field-label">Surveys</div><div class="field-value">${f.surveys.length} flights · ${f.surveys.reduce((a, s) => a + (s.photos.count || 0), 0).toLocaleString()} photos</div>` : ''}
        <button class="showmore${state.showMore ? ' open' : ''}" type="button" data-act="showmore">${icon('i-tri')}${state.showMore ? 'Show Less' : 'Show More'}</button></div></section>
      <section class="card"><div class="card-title"><span class="grow">Notifications</span><button class="iconbtn white" type="button" data-blocked="Notifications" aria-label="Notifications">${icon('i-bell', 'ico sm')}</button></div><div class="muted-center">No notifications at this time.</div></section>
      <section class="card"><div class="card-title"><span class="grow">Map Layers</span><button class="iconbtn white" type="button" data-act="add" aria-label="Add map layers">${icon('i-layers', 'ico sm')}</button></div><div data-role="layer-list">${rows}</div>
        ${tip('layers', 'Layers stack like cards: the top row draws on top of the map. Drag <b>⋮⋮</b> to reorder, use the eye to hide a layer and <b>×</b> to remove it. Click a layer\'s name to change its visualization, colours and opacity.')}</section>
      <section class="card" style="padding:8px"><div class="actions">
        <button class="btn span primary" type="button" data-act="upload">${icon('i-upload')}Import Imagery</button>
        <button class="btn primary" type="button" data-blocked="Order Analytics">${icon('i-flask')}Order Analytics</button>
        <button class="btn primary" type="button" data-act="order">${icon('i-grid')}Order Mosaics</button>
        <button class="btn primary" type="button" data-blocked="Soil Properties">${icon('i-shovel')}Soil Properties</button>
        <button class="btn${Ls.length ? ' primary' : ''}" type="button" data-act="${Ls.length ? 'report' : 'report-empty'}">${icon('i-report')}Create Report</button></div></section>
      <section class="card"><div class="card-title"><span class="grow">Zones</span><button class="iconbtn white" type="button" data-act="zones" aria-label="Zone layers">${icon('i-layers', 'ico sm')}</button><button class="iconbtn white" type="button" data-blocked="Drawing a new zone" aria-label="Add zone">${icon('i-addcircle', 'ico sm')}</button><div class="select" style="margin:0;display:inline-block"><button class="iconbtn" type="button" data-act="menu" data-menu="zmore" aria-label="More">${icon('i-more', 'ico sm')}</button>${zoneMenu}</div></div>
        <div class="zone-row"><div class="bar boundary"></div><div class="grow"><b>Field Boundary</b><span>${fmtAc(f.acres)} ac</span></div></div>${zones}
        ${f.zones.length ? tip('zones', `${f.zones.length} zones are drawn on this field. Click the layers icon above to switch them on; a zone name opens it for editing, and every mosaic then reports statistics per zone.`) : ''}</section>
      ${(typeof opts.renderActivities === 'function' && opts.renderActivities(f)) || `<section class="card"><div class="card-title"><span class="grow">Field Activities</span><button class="iconbtn white" type="button" data-blocked="Adding an activity" aria-label="Add activity">${icon('i-addcircle', 'ico sm')}</button></div><div class="muted-center">No field activities to show.</div></section>`}
    </div>`;
  }
  function surveyProducts(f, s) {
    const mk = (id, name, sub) => { const key = `${f.id}_${s.key}_${id === 'ms' ? (hasImg(`${f.id}_${s.key}_cir`) ? 'cir' : 'ndvi') : id}`; return { id, name, sub, key, avail: hasImg(key) }; };
    const list = s.bands === 'rgb' ? [mk('vari', 'VARI Mosaic'), mk('elev', 'Elevation Mosaic'), mk('rgb', 'RGB Mosaic')] : [mk('ms', 'Multispectral Mosaic', s.bands === 'd4k' ? '5 bands' : '4 bands'), mk('elev', 'Elevation Mosaic'), mk('rgb', 'RGB Mosaic')];
    (s.quicktiles || []).forEach(q => list.push({ id: q.id, name: q.name, key: `${f.id}_${s.key}_${q.id}`, avail: hasImg(`${f.id}_${s.key}_${q.id}`), qt: true }));
    if ((s.analytics || []).length) { const kept = list.filter(p => p.avail);   // an analytics flight lists only what was produced for it
      s.analytics.forEach(a => kept.push({ id: a.id, name: a.name, key: a.kind === 'raster' ? `${f.id}_${s.key}_${a.id}` : null, avail: a.kind === 'raster' ? hasImg(`${f.id}_${s.key}_${a.id}`) : a.kind === 'features' ? !!(a.features && a.features.length) : !!(a.points && a.points.length), analytic: a.kind === 'features' ? (a.geom === 'polygon' ? 'polygons' : 'lines') : a.kind, kind: a.kind === 'samples' ? 'samples' : a.kind === 'features' ? 'features' : 'drone' }));
      return kept; }
    return list;
  }
  function renderAdd() {
    const f = curField(); const Ls = layers(); const on = (kind, a, b) => Ls.some(L => L.kind === kind && (kind === 'sat' ? L.date === a && L.product === b : kind === 'photos' ? L.survey === a : L.survey === a && L.product === b));
    const surveys = state.sources.surveys ? f.surveys.map(s => { const ph = s.photos || {}; const phAvail = !!(ph.positions && ph.positions.length);
      return `<section class="card"><div class="group-head">${icon('i-drone', 'ico sm')}<div class="name"><b>${esc(s.name || s.date)}</b>${s.name ? `<span>${esc(s.date)} · ${esc(SENSOR_LABEL[s.bands] || s.bands)}</span>` : ''}</div><button class="iconbtn" type="button" data-blocked="Flight notes" aria-label="Notes">${icon('i-doc', 'ico sm')}</button><button class="iconbtn" type="button" data-blocked="Survey options" aria-label="More">${icon('i-more', 'ico sm')}</button></div>
      ${surveyProducts(f, s).map(p => p.avail ? `<div class="prod-row" data-act="pick" data-survey="${s.key}" data-product="${p.id}" data-kind="${p.kind || 'drone'}" role="button" tabindex="0" aria-pressed="${on(p.kind || 'drone', s.key, p.id)}"><span class="prod-ico">${icon(p.analytic === 'raster' ? 'i-heatmap' : p.analytic === 'samples' ? 'i-samples' : p.analytic === 'polygons' ? 'i-polygon' : p.analytic === 'lines' ? 'i-lines' : p.qt ? 'i-grid' : 'i-mosaic', 'ico sm')}</span><div class="prod-name"><b>${esc(p.name)}</b>${p.sub ? `<span>${esc(p.sub)}</span>` : ''}</div><span class="radio${on(p.kind || 'drone', s.key, p.id) ? ' on' : ''}"></span></div>`
        : `<div class="prod-row off" title="Not included in this sample"><span class="prod-ico">${icon(p.qt ? 'i-grid' : 'i-mosaic', 'ico sm')}</span><div class="prod-name"><b>${esc(p.name)}</b><span class="na">Not in this sample</span></div><span class="radio off"></span></div>`).join('')}
      ${phAvail ? `<div class="prod-row photos" data-act="pickphotos" data-survey="${s.key}" role="button" tabindex="0" aria-pressed="${on('photos', s.key)}"><span class="bar" style="background:${s.dotColor}"></span><span class="prod-ico">${icon('i-camera', 'ico sm')}</span><div class="prod-name"><b>Photo Dots</b><span>${(ph.count || ph.positions.length).toLocaleString()} photos</span></div><span class="radio${on('photos', s.key) ? ' on' : ''}"></span></div>`
        : `<div class="prod-row photos off" title="Photo positions are not included in this sample"><span class="bar" style="background:${s.dotColor}"></span><span class="prod-ico">${icon('i-camera', 'ico sm')}</span><div class="prod-name"><b>Photo Dots</b><span>${(ph.count || 0).toLocaleString()} photos</span><span class="na">Not in this sample</span></div><span class="radio off"></span></div>`}
      </section>`; }).join('') : '';
    const sats = state.sources.satellite ? (SAT.items.length ? SAT.items.slice().sort((a, b) => satCode(b.date).localeCompare(satCode(a.date))).map(it => { const code = satCode(it.date); const avail = SAT_PRODUCTS.map(p => hasImg(`${f.id}_sat${code}_${p.id}`));
      return `<section class="card"><div class="group-head">${icon('i-satellite', 'ico sm')}<div class="name"><b>${esc(it.date)}</b><span>Sentinel-2 · tile ${esc(SAT.tile || '')}</span></div><span class="cloud" title="Clear-sky share of the scene">${icon('i-sun', 'ico xs')}${it.clear}%</span></div>
        ${SAT_PRODUCTS.map((p, i) => avail[i] ? `<div class="prod-row" data-act="picksat" data-date="${code}" data-product="${p.id}" role="button" tabindex="0" aria-pressed="${on('sat', code, p.id)}"><span class="prod-ico">${icon('i-satellite', 'ico sm')}</span><div class="prod-name"><b>${esc(p.name)}</b></div><span class="radio${on('sat', code, p.id) ? ' on' : ''}"></span></div>`
          : `<div class="prod-row off"><span class="prod-ico">${icon('i-satellite', 'ico sm')}</span><div class="prod-name"><b>${esc(p.name)}</b><span class="na">Not in this sample</span></div><span class="radio off"></span></div>`).join('')}</section>`; }).join('')
      + `<div class="sample-note">FieldAgent lists every Sentinel-2 pass over the field (every two to three days) with its clear-sky percentage. This sample carries the ${SAT.items.length} clearest dates of the season.</div>` : '<div class="sample-note">No satellite dates are included in this sample yet.</div>') : '';
    return head(f.name, { back: 'field', sub: 'Add Map Layers' }) + `<div class="panel-scroll">
      <div class="source-toggles"><div class="card"><div class="toggle-line${state.sources.surveys ? ' on' : ''}" data-act="src" data-src="surveys" role="switch" aria-checked="${state.sources.surveys}" tabindex="0"><span class="switch${state.sources.surveys ? ' on' : ''}"></span>Surveys</div><div class="toggle-line" data-blocked="Flight Logs"><span class="switch"></span>Flight Logs</div></div>
        <div class="card"><div class="toggle-line${state.sources.satellite ? ' on' : ''}" data-act="src" data-src="satellite" role="switch" aria-checked="${state.sources.satellite}" tabindex="0">${icon('i-satellite', 'ico xs')}<span class="switch${state.sources.satellite ? ' on' : ''}"></span>Satellite</div></div></div>
      ${tip('add', 'Every flight is a <b>survey</b>. Tick a product to add it to the map — mosaics are the stitched output, QuickTiles the quick preview that appears on import, Photo Dots the individual photos. Switch on <b>Satellite</b> for the Sentinel-2 dates between flights.')}
      ${surveys}${sats}</div>`;
  }
  function histSvg(L) {
    const h = histOf(L); const [lo, hi] = vizRange(L); const NB = 64; const bars = new Float64Array(NB); let peak = 0;
    if (h) for (let g = 0; g < 256; g++) { const b = Math.min(NB - 1, Math.floor(g / 256 * NB)); bars[b] += h.counts[g]; }
    for (let i = 0; i < NB; i++) peak = Math.max(peak, bars[i]);
    const { lut } = buildLUT(L, h); const colorOfG = g => { const v = lut[g]; return v ? unpackCss(v) : null; };
    const W = 320, Hh = 84, x0 = 6, plotW = W - 12;
    const barSvg = Array.from({ length: NB }, (_, i) => { const g = Math.round((i + 0.5) / NB * 255); const c = colorOfG(g) || '#3a3a3a'; const hh = peak ? bars[i] / peak * (Hh - 4) : 0; return `<rect x="${(x0 + i / NB * plotW).toFixed(1)}" y="${(Hh - hh).toFixed(1)}" width="${(plotW / NB + 0.3).toFixed(2)}" height="${hh.toFixed(1)}" fill="${c}"/>`; }).join('');
    const ticks = [lo, (lo + hi) / 2, hi].map((v, i) => { const x = x0 + i / 2 * plotW; return `<text x="${x}" y="${Hh + 14}" fill="#9b9b9b" font-size="10" text-anchor="${i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}">${fmtV(L, v)}${VIZ[L.viz].unit || ''}</text>`; }).join('');
    return `<svg class="hist" data-role="hist" viewBox="0 0 ${W} ${Hh + 18}" preserveAspectRatio="none" aria-hidden="true"><line x1="${x0}" x2="${W - 6}" y1="${Hh}" y2="${Hh}" stroke="#4a4a4a"/>${barSvg}${ticks}</svg>`;
  }
  const pct = (L, v) => { const [lo, hi] = vizRange(L); return (v - lo) / (hi - lo) * 100; };
  function chipsHtml(L) { const { min, max } = L.col; return `<span class="chip" style="left:${pct(L, min)}%">${fmtV(L, min)}</span><span class="chip" style="left:${pct(L, max)}%">${fmtV(L, max)}</span>`; }
  function binTableHtml(L) {
    if (!state.binTable) return ''; const stats = layerStats(L); if (!stats) return ''; const colors = binColors(L);
    return `<table class="bin-table">${stats.rows.map((r, i) => `<tr><td><span class="sw" style="background:${rgbCss(colors[i])}"></span>${fmtV(L, r.lo)} – ${fmtV(L, r.hi)}${VIZ[L.viz].unit || ''}</td><td>${stats.samples ? `${r.count} ${stats.noun || 'sample'}${r.count === 1 ? '' : 's'}` : `${fmtAc(r.count * stats.app)} ac`}</td></tr>`).join('')}</table>`;
  }
  function patchColorization(L) {
    const h = $('hist'); if (h) h.outerHTML = histSvg(L);
    const c = $('range-chips'); if (c) c.innerHTML = chipsHtml(L);
    const f = $('range-fill'); if (f) { const l = pct(L, L.col.min), r = pct(L, L.col.max); f.style.left = l + '%'; f.style.width = (r - l) + '%'; }
    const b = $('bins-caption'); if (b) b.textContent = `${L.col.bins} bins`;
    const t = $('bin-table-wrap'); if (t) t.innerHTML = binTableHtml(L);
    dirty = true;
  }
  function vizMenuHtml(L) {
    const s = surveyOf(L); const bands = DATA.bands[s.bands] || { order: [] }; const have = new Set(productVizOptions(L));
    const groups = [{ title: 'Composites', items: [VIZ.cir, VIZ.natural] }, { title: 'Indices', items: INDEX_ORDER.map(id => VIZ[id]) }, { title: 'Bands', items: bands.order.map((b, i) => ({ id: 'b' + (i + 1), label: b })) }];
    // FieldAgent greys out what the sensor cannot produce: without a blue band there is no Natural Color and no GLI
    const unavailable = new Set(bands[ 'natural' ] === false ? ['natural'] : []); if (bands.gli === false) unavailable.add('gli');
    return `<div class="menu" role="listbox" style="max-height:min(560px, 70vh)">${groups.map(g => `<div class="sub">${g.title}</div>${g.items.map(i => { const ok = have.has(i.id); const off = unavailable.has(i.id); return `<div class="opt${i.id === L.viz ? ' sel' : ''}${ok ? '' : ' dis'}" ${ok ? `data-act="viz" data-viz="${i.id}"` : ''} role="option" aria-selected="${i.id === L.viz}" ${ok ? '' : `title="${off ? 'This sensor has no blue band' : 'Not included in this sample'}"`}>${esc(i.label)}${ok || off ? '' : '<span class="na-tag">not in sample</span>'}</div>`; }).join('')}`).join('')}</div>`;
  }
  function colorizationHtml(L) {
    const [lo, hi] = vizRange(L); const { min, max, bins } = L.col; const step = ((hi - lo) / 200).toPrecision(2); const sc = scaleById(L.col.scale);
    const scaleMenu = state.menu === 'scale' ? `<div class="menu" role="listbox">${scalesFor(L).map(s => `<div class="opt${s.id === L.col.scale ? ' sel' : ''}" data-act="scale" data-scale="${s.id}" role="option" title="${esc(s.name)}"><div class="grad" style="background:${cssGradient(s)}"></div></div>`).join('')}</div>` : '';
    return `<section class="card"><div class="card-title">Colorization</div>
      ${tip('color', 'Colorization is live: the <b>bins</b> slider sets how many classes, the two handles stretch the value range, <b>By Area</b> makes every class cover the same acreage, <b>By Range</b> uses equal value steps. The colour scale and out-of-range switch apply instantly on the map.')}
      <div class="slider-row"><input class="fa-range" type="range" min="2" max="20" step="1" value="${bins}" data-act="bins" aria-label="Number of bins"></div><div class="slider-caption" data-role="bins-caption">${bins} bins</div>
      ${histSvg(L)}
      <div class="dual"><div class="track"></div><div class="fill" data-role="range-fill" style="left:${pct(L, min)}%;width:${pct(L, max) - pct(L, min)}%"></div><input type="range" min="${lo}" max="${hi}" step="${step}" value="${min}" data-act="rmin" aria-label="Minimum value"><input type="range" min="${lo}" max="${hi}" step="${step}" value="${max}" data-act="rmax" aria-label="Maximum value"></div>
      <div class="chips" data-role="range-chips">${chipsHtml(L)}</div>
      <div class="seg"><button type="button" class="${L.col.mode === 'area' ? 'on' : ''}" data-act="mode" data-mode="area">By Area</button><button type="button" class="${L.col.mode === 'range' ? 'on' : ''}" data-act="mode" data-mode="range">By Range</button><button type="button" class="${L.col.mode === 'custom' ? 'on' : ''}" data-act="mode" data-mode="custom">Custom</button></div>
      <div class="select${state.menu === 'scale' ? ' open' : ''}"><span class="label">Color Scale</span><button class="value" type="button" data-act="menu" data-menu="scale" aria-haspopup="listbox" aria-expanded="${state.menu === 'scale'}"><span class="grad" style="background:${cssGradient(sc)}"></span>${icon('i-drop')}</button>${scaleMenu}</div>
      <div class="toggle-row" data-act="includeout" role="switch" aria-checked="${L.col.includeOut}" tabindex="0"><span class="switch${L.col.includeOut ? ' on' : ''}"></span>Include Out-of-Range Values</div>
      <button class="showmore${state.binTable ? ' open' : ''}" type="button" data-act="bintable" style="margin-left:6px">${icon('i-tri')}${state.binTable ? 'Show Less' : 'Show More'}</button><div data-role="bin-table-wrap">${binTableHtml(L)}</div>
    </section>`;
  }
  function zoneStatsHtml(L, stats) {
    const zs = zoneStats(L, FIELD[L.fid].zones.map((_, i) => i)); const unit = VIZ[L.viz].unit || '';
    return `<section class="card"><div class="card-title"><span class="grow">Zone Statistics</span><button class="iconbtn" type="button" data-blocked="Zone statistics options" aria-label="More">${icon('i-more', 'ico sm')}</button></div>
      <div class="stat-row"><div class="bar boundary"></div><div class="grow"><b>Field Boundary</b><span>${fmtAc(stats.acres)} ac covered</span></div><div class="avg"><b>${fmtV(L, stats.avg)}${unit}</b><span>Average</span></div></div>
      ${zs.map(z => `<div class="stat-row"><div class="bar"></div><div class="grow"><b>${esc(z.name)}</b><span>${fmtAc(z.acres)} ac</span></div><div class="avg"><b>${fmtV(L, z.avg)}${z.avg == null ? '' : unit}</b><span>Average</span></div></div>`).join('')}
      ${FIELD[L.fid].zones.length ? tip('zstats', 'Every zone of the field is averaged here for the layer you are looking at — the Zones card only decides which ones are drawn on the map.') : ''}</section>`;
  }
  function renderLayer(L) {
    const f = curField(); const isIndex = !!(VIZ[L.viz] && VIZ[L.viz].index); const loaded = ready(L); if (!loaded) ensure(L);
    const stats = isIndex && loaded ? layerStats(L) : null;
    const opacity = `<section class="card"><div class="card-title">Opacity</div><div class="slider-row"><input class="fa-range" type="range" min="0" max="100" step="1" value="${Math.round(L.opacity * 100)}" data-act="opacity" aria-label="Opacity"></div><div class="slider-caption">${Math.round(L.opacity * 100)}%</div>
      ${tip('opacity', 'Opacity blends this layer with whatever sits below it in the stack — drop an index to ~50% over the RGB mosaic to see which rows drive the pattern, or fade between two dates.')}</section>`;
    if (L.kind === 'sat') {
      const it = satItemOf(L);
      return head(f.name, { back: 'field' }) + `<div class="panel-scroll">
        <section class="card"><div class="card-title">Satellite Layer Details</div>
          <div class="kv-block"><div class="k">Name</div><div class="v">${esc(layerTitle(L))}</div><div class="k">Date</div><div class="v">${esc(it.date)}</div><div class="k">Source</div><div class="v">Sentinel-2 L2A · ${esc(it.item)}</div><div class="k">Clear sky</div><div class="v">${it.clear}% of the scene</div></div>
          ${VIZ[L.viz].formula ? `<div class="tip">${esc(VIZ[L.viz].formula)} · 10 m pixels, resampled</div>` : ''}
          ${tip('sat', 'Satellite layers are clipped to the field boundary and listed with the clear-sky percentage of each pass, so you can watch the crop between drone flights without flying.')}</section>
        ${isIndex ? (stats ? colorizationHtml(L) + zoneStatsHtml(L, stats) : '<section class="card"><div class="muted-center">Decoding layer…</div></section>') : ''}
        ${opacity}<button class="delete-bar" type="button" disabled>Delete</button></div>`;
    }
    if (isPhotos(L)) {
      const s = surveyOf(L); const n = photoSamples(L).length;
      return head(f.name, { back: 'field' }) + `<div class="panel-scroll">
        <section class="card"><div class="card-title">Photo Dots</div>
          <div class="kv-block"><div class="k">Survey</div><div class="v">${esc(s.name)} · ${esc(s.date)}</div><div class="k">Photos</div><div class="v">${(s.photos.count || (s.photos.positions || []).length).toLocaleString()} photos from ${esc(SENSOR_LABEL[s.bands] || s.bands)}</div></div>
          ${tip('photos', `Each dot is where a photo was taken. Click a dot with a bright ring to open the photo viewer — ${n} photos of this flight are in the sample, with their EXIF and XMP metadata as FieldAgent shows them.`)}</section>
        ${n ? `<section class="card"><div class="card-title">Sample photos</div>${photoSamples(L).map((smp, i) => `<div class="prod-row" data-act="openphoto" data-uid="${L.uid}" data-idx="${i}" role="button" tabindex="0"><span class="prod-ico">${icon('i-camera', 'ico sm')}</span><div class="prod-name"><b>${esc(smp.details && smp.details.time ? `${smp.details.date}, ${smp.details.time}` : `Photo ${smp.i}`)}</b><span>${esc(smp.file || `${smp.i} / ${s.photos.count || ''}`)}</span></div>${icon('i-tri', 'ico sm')}</div>`).join('')}</section>` : ''}
        ${opacity}<button class="delete-bar" type="button" disabled>Delete</button></div>`;
    }
    if (isSamples(L)) return renderSamplesLayer(L);
    if (isFeatures(L)) return renderFeaturesLayer(L);
    const an = analyticOf(L);
    const s = surveyOf(L); const isQt = L.product.startsWith('qt_'); const tif = (s.tif || {})[L.product === 'ms' ? 'ms' : L.product];
    const vizNote = VIZ[L.viz].formula ? `<div class="tip">${esc(VIZ[L.viz].formula)}</div>` : VIZ[L.viz].band ? `<div class="tip">Single band, stretched to this mosaic's range ${fmtV(L, vizRange(L)[0])}–${fmtV(L, vizRange(L)[1])}${vizRange(L)[1] > 50 ? ' (digital numbers)' : ' reflectance'}</div>` : '';
    const vizSelect = L.product === 'ms' ? `<div class="select${state.menu === 'viz' ? ' open' : ''}"><span class="label">Visualization</span><button class="value" type="button" data-act="menu" data-menu="viz" aria-haspopup="listbox" aria-expanded="${state.menu === 'viz'}"><span>${esc(vizLabel(L))}</span>${icon('i-drop')}</button>${state.menu === 'viz' ? vizMenuHtml(L) : ''}</div>${vizNote}${tip('viz', `One multispectral mosaic, every view: <b>Visualization</b> switches between the composites, the ${INDEX_ORDER.length} vegetation indices and each single band of the ${esc(SENSOR_LABEL[s.bands] || s.bands)} without re-processing anything.`)}` : L.product === 'vari' ? `<div class="tip">${esc(VIZ.vari.formula)} — a crop-health index computed from the RGB camera</div>` : L.product === 'elev' ? `<div class="tip">Digital surface model from the same flight · ${fmtV(L, (s.elevRange || [0, 0])[0])}–${fmtV(L, (s.elevRange || [0, 0])[1])} m</div>${tip('elev', 'The elevation mosaic is a digital surface model: terrain, and crop height on top of it — which is why the plots stand out.')}` : isQt ? `<div class="tip">QuickTiles are generated from the raw photos on import — a quick look at the flight before the stitched mosaics finish.</div>` : '';
    return head(f.name, { back: 'field' }) + `<div class="panel-scroll">
      <section class="card"><div class="card-title">${isQt ? 'QuickTile Details' : 'Mosaic Details'}</div>
        <div class="kv-block"><div class="k">Name</div><div class="v">${esc(isQt || an ? layerTitle(L) : PRODUCT_NAME[L.product] || L.product)}</div><div class="k">Survey</div><div class="v">${esc(layerSub(L).replace(' • ', ' · '))}</div>${an ? '' : `<div class="k">Sensor</div><div class="v">${esc(SENSOR_LABEL[s.bands] || s.bands)}${DATA.bands[s.bands] && DATA.bands[s.bands].order.length > 3 ? ` · ${DATA.bands[s.bands].order.length} bands` : ''}</div>`}</div>
        ${an ? `<div class="tip">${esc(an.product || an.name)}${an.code ? ` · ${esc(an.code)}` : ''} — a surface interpolated from the individual sample counts of this flight</div>${tip('analytic', 'Analytics layers colourize like any mosaic: the bins, range and colour scale below apply to the heatmap on the map, and Zone Statistics averages it per zone.')}` : vizSelect}
      </section>
      ${isIndex ? (stats ? colorizationHtml(L) + `<section class="card"><div class="card-title">Display Mode</div><div class="seg"><button type="button" class="on">Imagery</button><button type="button" data-blocked="Zone Rx (Beta)">Zone Rx (Beta)</button></div></section>` + zoneStatsHtml(L, stats) : '<section class="card"><div class="muted-center">Decoding layer…</div></section>') : ''}
      <section class="card"><div class="card-title">Clip to Field Boundary</div><div class="seg"><button type="button" class="${L.clipped ? 'on' : ''}" data-act="clip" data-clip="1">Clipped</button><button type="button" class="${L.clipped ? '' : 'on'}" data-act="clip" data-clip="0">Unclipped</button></div></section>
      ${opacity}
      ${isQt ? '' : `<section class="card"><div class="card-title">Download Files</div><div class="dl-row"><div class="grow"><b>TIF File</b><span>${esc(tif || 'GeoTIFF')}</span></div><button class="dl-btn" type="button" data-act="download" data-what="tif" aria-label="Download TIF">${icon('i-download', 'ico sm')}</button></div>
        ${tip('download', 'Every mosaic downloads as a full-resolution GeoTIFF for your own GIS or agronomy software. In this sample the button sends the file to your inbox instead.')}</section>`}
      <button class="delete-bar" type="button" disabled>Delete</button>
    </div>`;
  }
  // Tassel Count → Yield Estimate: needs a Kernel Count activity of the field (Field Activities → + → Kernel Count). The demo
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
  function renderFeaturesLayer(L) {
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
  function renderSamplesLayer(L) {
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
      ${an.yieldEstimate ? yieldCardHtml(L, an) : ''}
      ${colorizationHtml(L)}
      ${an.opacity ? `<section class="card"><div class="card-title">Opacity</div><div class="slider-row"><input class="fa-range" type="range" min="0" max="100" step="1" value="${Math.round(L.opacity * 100)}" data-act="opacity" aria-label="Opacity"></div><div class="slider-caption">${Math.round(L.opacity * 100)}%</div></section>` : ''}
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
  function renderZones() {
    const f = curField(); const on = zonesOn(f.id); const total = f.acres + on.reduce((a, zi) => a + f.zones[zi].acres, 0);
    return head(f.name, { back: 'field' }) + `<div class="panel-scroll">
      <section class="card"><div class="card-title"><span class="grow">Zones</span><button class="iconbtn white" type="button" data-blocked="Drawing a new zone" aria-label="Add zone">${icon('i-addcircle', 'ico sm')}</button></div><div class="hr"></div>
        <div class="zone-row"><div class="bar boundary"></div><div class="grow"><b>Field Boundary</b><span>${fmtAc(f.acres)} ac</span></div><span class="check on"></span></div>
        ${f.zones.map((z, zi) => `<div class="zone-row pick${on.includes(zi) ? ' on' : ''}" data-act="zonetoggle" data-zi="${zi}" role="checkbox" aria-checked="${on.includes(zi)}" tabindex="0"><div class="bar"></div><div class="grow"><b>${esc(zoneName(f.id, zi))}</b><span>${fmtAc(z.acres)} ac</span></div><span class="check${on.includes(zi) ? ' on' : ''}"></span></div>`).join('')}
        <div class="zone-total">Total selected area: ${fmtAc(total)} ac</div>
        ${tip('zonesel', 'Tick a zone to draw it on the map. Selected zones stay on across layers and dates, and their averages appear in every mosaic\'s Zone Statistics.')}</section>
      ${f.zones.length ? '' : '<div class="sample-note">This field has no zones yet. In FieldAgent the + button draws rectangles, polygons or circles, or imports a shapefile.</div>'}
    </div>`;
  }
  function renderZoneEdit() {
    const f = curField(); const zi = state.zoneEdit; const z = f.zones[zi];
    return head(f.name, { back: 'field' }) + `<div class="panel-scroll">
      <section class="card"><div class="card-title">Edit Zone</div>
        <label class="textfield"><span class="label">Zone Name *</span><input type="text" value="${esc(zoneName(f.id, zi))}" data-act="zonename" data-zi="${zi}"></label>
        <label class="textfield"><span class="label">Date</span><input type="text" value="${esc(z.date || todayShort())}" data-act="notes"></label>
        <button class="btn-wide blue" type="button" data-act="zonedone">Done</button>
        <button class="btn-wide red" type="button" data-blocked="Deleting a zone">Delete</button>
        ${tip('zoneedit', `${z.rings.length > 1 ? `This zone is ${z.rings.length} plots drawn as one zone — ` : 'Zones are drawn once — '}the tools on the map redraw, move, rotate, cut or erase the shape. The name and date save with the field.`)}</section>
    </div>`;
  }
  const todayShort = () => { const d = new Date(); return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`; };
  function renderDrawTools() {
    const el = $('draw-tools'); const show = state.view === 'zone' || (typeof opts.drawToolsFor === 'function' && !!opts.drawToolsFor(state.view)); el.hidden = !show; if (!show) return;
    el.innerHTML = [['i-rect', 'Draw Rectangle'], ['i-polygon', 'Draw Polygon'], ['i-circle', 'Draw Circle'], ['i-move', 'Move'], ['i-rotatecw', 'Rotate'], ['i-edit', 'Edit', true], ['i-cut', 'Cut'], ['i-erase', 'Erase']].map(([ic, lab, on]) => `<button type="button" class="${on ? 'on' : ''}" ${on ? '' : `data-blocked="${esc(lab)}"`}>${icon(ic)}${esc(lab)}</button>`).join('');
  }
  // ----- Order Mosaics -----
  function renderOrder() {
    const f = curField(); const OM = DATA.orderMosaics; const o = state.order; const s = o.survey ? f.surveys.find(x => x.key === o.survey) : null;
    const enabled = s ? new Set(OM.enabledBySensor[s.bands] || []) : new Set();
    const surveyMenu = state.menu === 'osurvey' ? `<div class="menu" role="listbox">${f.surveys.map(x => `<div class="opt${o.survey === x.key ? ' sel' : ''}" data-act="osurvey" data-survey="${x.key}" role="option">${esc(x.name)} • ${esc(x.date)}</div>`).join('')}</div>` : '';
    const sections = OM.sections.map(sec => `<div class="order-sec"><div class="order-sec-title">${esc(sec.title)}${sec.info ? `<button class="iconbtn" type="button" data-act="info" data-info="${esc(sec.info)}" aria-label="About ${esc(sec.title)}">${icon('i-info', 'ico xs')}</button>` : ''}</div>
      ${sec.products.map(p => { const en = s && enabled.has(p.key); const on = !!o.picks[p.key]; return `<div class="cb-row${en ? '' : ' dis'}" data-act="${en ? 'opick' : 'oinfo'}" data-key="${p.key}" role="checkbox" aria-checked="${on}" tabindex="0"><span class="cb${on ? ' on' : ''}"></span><span class="grow">${esc(p.label)}</span></div>
        ${on ? `<div class="cb-row nested" data-act="oalign" data-key="${p.key}" role="checkbox" aria-checked="${!!o.aligned[p.key]}" tabindex="0"><span class="cb${o.aligned[p.key] ? ' on' : ''}"></span><span class="grow">Precision Aligned</span><button class="iconbtn" type="button" data-act="info" data-info="${esc(OM.precisionAlignedInfo)}" aria-label="About precision alignment">${icon('i-info', 'ico xs')}</button></div>` : ''}`; }).join('')}</div>`).join('');
    const picked = OM.sections.flatMap(sec => sec.products).filter(p => o.picks[p.key]);
    return head('Order Mosaics', { back: 'field' }) + `<div class="panel-scroll">
      <section class="card"><div class="card-title">${icon('i-grid', 'ico sm')}<span class="grow">Order Mosaics</span></div>
        <div class="select${state.menu === 'osurvey' ? ' open' : ''}"><span class="label">Select Survey *</span><button class="value" type="button" data-act="menu" data-menu="osurvey" aria-haspopup="listbox"><span>${s ? `${esc(s.name)} • ${esc(s.date)}` : '<span style="color:#6b6b6b">Choose a survey</span>'}</span>${icon('i-drop')}</button>${surveyMenu}</div>
        ${s ? `<div class="tip">${(s.photos.count || 0).toLocaleString()} photos · ${esc(SENSOR_LABEL[s.bands] || s.bands)}. Products this sensor can't produce are greyed out, exactly as in FieldAgent.</div>` : tip('order', 'This is the ordering screen a subscriber uses after an upload: pick the flight, tick the products, submit. Scout covers every product listed here — no per-mosaic charge.')}
        ${sections}</section>
      <section class="card"><div class="card-title">${icon('i-cart', 'ico sm')}<span class="grow">Order Summary</span></div>
        ${picked.length ? picked.map(p => `<div class="sum-row"><b>${esc(p.catalog)}</b><span>${esc(p.code)}${p.variant ? ` · Variant: ${esc(p.variant)}` : ''}${o.aligned[p.key] ? ' · Precision Aligned' : ''}</span></div>`).join('') : '<div class="muted-center">No Products Selected</div>'}</section>
      <button class="submit-bar${picked.length ? ' on' : ''}" type="button" data-act="osubmit" ${picked.length ? '' : 'disabled'}>Submit</button>
      <div class="sample-note">Stitched orthomosaics usually finish within hours; QuickTiles appear on the map as soon as the upload lands.</div>
    </div>`;
  }
  // ----- Import Imagery -----
  function renderUpload() {
    const II = DATA.importImagery; const u = state.upload;
    const radios = (o, cur, act) => o.map(op => `<div class="radio-row" data-act="${act}" data-val="${esc(op)}" role="radio" aria-checked="${cur === op}" tabindex="0"><span class="rd${cur === op ? ' on' : ''}"></span>${esc(op)}</div>`).join('');
    const typeMap = { 'Fully Stitched Mosaic': 'mosaic', 'QuickTile': 'quicktile', 'Individual Photos': 'photos' };
    const curType = Object.keys(typeMap).find(k => typeMap[k] === u.type);
    const photos = `<section class="card"><div class="card-title">Flight Details</div>
        <div class="field-label" style="margin:4px 0 0 6px">Image buffer around the field boundary</div>
        <div class="slider-row"><input class="fa-range" type="range" min="${II.individualPhotos.altitudeSlider.min}" max="${II.individualPhotos.altitudeSlider.max}" step="${II.individualPhotos.altitudeSlider.step}" value="${u.alt}" data-act="alt" aria-label="Altitude"></div><div class="slider-caption" data-role="alt-caption">${u.alt} ft</div>
        <div class="cb-row" data-act="horizon" role="checkbox" aria-checked="${u.horizon}" tabindex="0"><span class="cb${u.horizon ? ' on' : ''}"></span><span class="grow">${esc(II.individualPhotos.checkbox)}</span></div>
        <label class="textfield"><span class="label">Survey Notes</span><textarea rows="2" placeholder="Optional" data-act="notes"></textarea></label></section>
      <section class="card dropzone" data-act="drop" role="button" tabindex="0">${icon('i-upload')}<b>Add JPEG or TIFF photos</b><span>Drop files here to upload.</span></section>`;
    const mosaic = `<section class="card"><div class="card-title">${esc(II.stitchedOrQuickTile.kind.label)}</div>${radios(II.stitchedOrQuickTile.kind.options, u.kind, 'ukind')}</section>
      <section class="card"><div class="card-title">Layer Details</div>
        <label class="textfield"><span class="label">Mosaic Name *</span><input type="text" placeholder="e.g. NDVI 09-04" data-act="notes"></label>
        <label class="textfield"><span class="label">When was this layer captured?</span><input type="date" data-act="notes"></label>
        <label class="textfield"><span class="label">Survey Notes</span><textarea rows="2" placeholder="Optional" data-act="notes"></textarea></label></section>
      <section class="card dropzone" data-act="drop" role="button" tabindex="0">${icon('i-upload')}<b>Add a mosaic and referencing files if necessary</b><span>Drop files here to upload.</span><span class="na">GeoTIFF, or an image with its world file</span></section>`;
    return head('Import Imagery', { back: 'field' }) + `<div class="panel-scroll">
      <section class="card"><div class="card-title">${esc(II.dataType.label)}</div>${radios(II.dataType.options, curType, 'utype')}
        ${tip('upload', 'Uploading is the whole workflow: drop the flight\'s photos here from a browser, and Scout stitches them in the cloud. QuickTiles show up within minutes, the orthomosaics within hours.')}</section>
      ${u.type === 'photos' ? photos : mosaic}
      <button class="submit-bar" type="button" data-act="usubmit" disabled>Upload</button>
      <div class="sample-note">${u.type === 'photos' ? 'Individual photos are stitched in the cloud into the RGB, multispectral and elevation mosaics you saw in Map Layers.' : 'Already-stitched mosaics and QuickTiles are georeferenced and filed under the field and date you choose.'}</div>
    </div>`;
  }
  // ----- Create Report -----
  function renderReportPanel() {
    const r = state.report; const f = curField();
    const sec = (id, title, body) => `<div class="rsec${r.secOpen[id] ? '' : ' closed'}"><div class="rsec-title" data-act="rsec" data-sec="${id}" role="button" tabindex="0"><span>${title}</span>${icon('i-expand')}</div><div class="rsec-body">${body}</div></div>`;
    const paperMenu = state.menu === 'paper' ? `<div class="menu" role="listbox">${['Letter', 'A4'].map(p => `<div class="opt${r.paper === p ? ' sel' : ''}" data-act="paper" data-paper="${p}" role="option">${p}</div>`).join('')}</div>` : '';
    return head(f.name, { back: 'field' }) + `<div class="panel-scroll" style="gap:12px">
      <div class="select${state.menu === 'paper' ? ' open' : ''}" style="margin:12px 6px 0"><span class="label" style="background:var(--fa-bg)">Paper Size</span><button class="value" type="button" data-act="menu" data-menu="paper" aria-haspopup="listbox"><span>${esc(r.paper)}</span>${icon('i-drop')}</button>${paperMenu}</div>
      <section class="card">${sec('logo', 'Logo', `<div class="toggle-row" data-act="rtoggle" data-key="showLogo" role="switch" aria-checked="${r.showLogo}" tabindex="0"><span class="switch${r.showLogo ? ' on' : ''}"></span>Show Logo</div>
        ${r.showLogo ? `<div class="tip" style="padding:0 6px 6px">Upload a JPEG or PNG file of your logo with a max size of 300 KB.</div><div class="upload-box" data-blocked="Uploading a logo">${icon('i-upload')}Drag &amp; Drop File Here or <b>Upload File</b><br><span style="font-size:10.5px">For best results, upload a logo that is at least 350px wide or 117px tall.</span></div><label class="textfield"><span class="label">Logo Name</span><input type="text" placeholder="Logo Name" data-act="notes"></label><div class="two-btns"><button type="button" data-act="rtoggle" data-key="showLogo">Cancel</button><button type="button" class="dis">Save Logo</button></div>` : ''}`)}</section>
      <section class="card">${sec('contact', 'Contact Details', `<div class="hr"></div><div class="toggle-row" data-act="rtoggle" data-key="showContact" role="switch" aria-checked="${r.showContact}" tabindex="0"><span class="switch${r.showContact ? ' on' : ''}"></span>Show Contact Details</div>
        ${r.showContact ? `<div class="contact-row"><span class="rd on"></span><span class="grow">Contact Details 1</span><button class="iconbtn" type="button" data-blocked="Editing contact details" aria-label="Edit">${icon('i-edit', 'ico xs')}</button><button class="iconbtn" type="button" data-blocked="Expanding contact details" aria-label="Expand">${icon('i-expand', 'ico xs')}</button></div><button class="add-link" type="button" data-blocked="Adding a contact">${icon('i-addcircle')}Add Contact</button><div style="clear:both"></div>` : ''}`)}</section>
      <section class="card">${sec('map', 'Map', `<div class="toggle-row" data-act="rtoggle" data-key="legend" role="switch" aria-checked="${r.legend}" tabindex="0"><span class="switch${r.legend ? ' on' : ''}"></span>Show Legend</div><div class="toggle-row" data-act="rtoggle" data-key="zoneStats" role="switch" aria-checked="${r.zoneStats}" tabindex="0"><span class="switch${r.zoneStats ? ' on' : ''}"></span>Show Zone Statistics</div>`)}</section>
      ${tip('report', 'Reports pull the layers currently on the map into a PDF: title, summary, the map with its legend, a note, your logo and contact details. Zone Statistics is a sample extra. Everything on the page is editable in place.')}
      <div class="panel-divider"></div>
      <button class="download-bar" type="button" data-act="download" data-what="report">${icon('i-download')}Download Report</button>
    </div>`;
  }
  function reportDateRange() { const Ls = layers().filter(L => L.visible); const dates = Ls.map(L => L.kind === 'sat' ? satItemOf(L).date : surveyOf(L).date).map(d => ({ d, t: new Date(d.slice(6, 10), +d.slice(0, 2) - 1, +d.slice(3, 5)).getTime() })); if (!dates.length) return ''; dates.sort((a, b) => a.t - b.t); return `${dates[0].d} to ${dates[dates.length - 1].d}`; }
  // FieldAgent's report names the map after the product ("Multispectral Mosaic"), whatever visualization is on it
  function reportLayerName(L) { if (!L) return 'Map'; if (L.kind === 'sat') return layerTitle(L); if (isPhotos(L)) return 'Photo Dots'; if (analyticOf(L) || L.product.startsWith('qt_')) return layerTitle(L); return PRODUCT_NAME[L.product] || L.product; }
  function renderReportPage() {
    const r = state.report; const f = curField(); const top = layers().find(L => L.visible && !isSamples(L) && !isFeatures(L) && VIZ[L.viz] && VIZ[L.viz].index && ready(L));
    const editBox = (label, value, act, textarea) => `<div class="editbox"><span class="lab">${label}</span>${textarea ? `<textarea data-act="${act}" placeholder="Click here and start typing to add your ${label.replace('Edit ', '').toLowerCase()}">${esc(value)}</textarea>` : `<input type="text" data-act="${act}" value="${esc(value)}" placeholder="Click here and start typing to edit your ${label.replace('Edit ', '').toLowerCase()}">`}<div class="edit-actions"><button type="button" data-act="rcancel" data-what="${act}">${icon('i-close')}Cancel</button><button type="button" data-act="rsave" data-what="${act}">${icon('i-check')}Save</button></div></div>`;
    const stats = top ? layerStats(top) : null; const unit = top ? (VIZ[top.viz].unit || '') : '';
    // legend, as FieldAgent prints it: a bar of equal segments in the class colours right under the map, each segment
    // labelled with its value range and its acreage
    const legend = r.legend && top && stats ? (() => { const colors = binColors(top); return `<div class="legend-bar">${stats.rows.map((row, i) => `<div class="cell"><div class="swatch" style="background:${colors[i]}"></div><div class="lab">${fmtV(top, row.lo)} - ${fmtV(top, row.hi)}${unit}<span>${fmtAc(row.count * stats.app)} ac</span></div></div>`).join('')}</div>`; })() : '';
    // zone statistics (a sample extra, in the report's own table style): field boundary and every zone, averaged on the top index layer
    const zstats = r.zoneStats && top && stats ? (() => { const zs = zoneStats(top, f.zones.map((_, i) => i)); return `<div class="zstats"><div class="sec">ZONE STATISTICS · ${esc(reportLayerName(top))}${top.product === 'ms' ? ' · ' + esc(vizLabel(top)) : ''}</div><table class="details zones">
      <tr><td>Field Boundary</td><td>${fmtAc(stats.acres)} ac covered</td><td class="num">${fmtV(top, stats.avg)}${unit}</td></tr>
      ${zs.map(z => `<tr><td>${esc(z.name)}</td><td>${fmtAc(z.acres)} ac</td><td class="num">${fmtV(top, z.avg)}${z.avg == null ? '' : unit}</td></tr>`).join('')}</table></div>`; })() : '';
    const first = layers().find(L => L.visible);
    return `<div class="report-page${r.paper === 'A4' ? ' a4' : ''}">
      ${r.showLogo ? '<div class="logo-slot"><div class="box">Your logo</div><span>Logo appears here once uploaded.</span></div>' : ''}
      <h1>${r.editTitle ? `<input type="text" value="${esc(r.title)}" data-act="rtitle" aria-label="Report title">` : esc(r.title)}<button class="pencil" type="button" data-act="rtitle-edit" aria-label="Edit title">${icon(r.editTitle ? 'i-check' : 'i-edit')}</button></h1>
      <div class="date">${todayLong()}</div>
      ${r.showContact ? '<div class="contact">Contact Details 1 — name, company, phone and email print here.</div>' : ''}
      <div class="sec">FIELD DETAILS</div>
      <table class="details"><tr><td>Field</td><td>${esc(f.name)}</td></tr><tr><td>Area</td><td>${fmtAc(f.acres)} ac</td></tr></table>
      ${r.editSummary ? `<div class="summary"><h3>Summary</h3>${editBox('Edit Summary', r.summary, 'rsummary', true)}</div>` : r.summary ? `<div class="summary"><h3>Summary</h3><p>${esc(r.summary)}</p></div>` : `<button class="gbtn" type="button" data-act="rsummary-edit">${icon('i-addcircle')}Add Summary</button>`}
      <div class="maphead"><span class="ttl">${esc(r.imgTitle || reportLayerName(top || first))}</span>${reportDateRange() ? `<span class="rng">${esc(reportDateRange())}</span>` : ''}${r.editImg ? '' : `<button class="pencil sm" type="button" data-act="rimg-edit" aria-label="Edit image title">${icon('i-edit')}</button>`}</div>
      ${r.editImg ? editBox('Edit Image Title', r.imgTitle, 'rimg', false) : ''}
      <div class="mapimg"><canvas data-role="report-canvas" width="1096" height="530"></canvas><span class="mapbox-tag"><i></i>mapbox</span></div>
      ${legend}${zstats}
      ${r.editNote ? editBox('Edit Note', r.note, 'rnote', true) : r.note ? `<p class="note">${esc(r.note)}</p>` : `<button class="gbtn" type="button" data-act="rnote-edit" style="margin-top:12px">${icon('i-addcircle')}Add Note</button>`}
      <div class="foot"><span class="wm"><svg class="ico"><use href="#i-logo"/></svg><b>Field</b><span>Agent</span></span><span>Page 1 of 1</span></div>
    </div>`;
  }
  function paintReportCanvas() {
    const c = reportEl.querySelector('[data-role="report-canvas"]'); if (!c) return; const x = c.getContext('2d'); const W = c.width, H = c.height;
    const f = curField(); const v = fitView(f.rect, Math.round(W * 0.1), W, H, { x: 0, y: 0, w: W, h: H });   // FieldAgent leaves ~a fifth of the snapshot to the surroundings
    x.setTransform(1, 0, 0, 1, 0, 0); drawScene(x, v, W, H, { snapshot: true });
    x.lineWidth = 4; // boundary already drawn; nothing else
  }
  let lastScroll = 0;
  function render(keepScroll) {
    const sc = panel.querySelector('.panel-scroll'); if (keepScroll && sc) lastScroll = sc.scrollTop;
    const L = state.view === 'layer' ? findLayer(state.detailUid) : null; if (state.view === 'layer' && !L) state.view = 'field';
    if (state.view === 'zone' && (state.zoneEdit == null || !curField().zones[state.zoneEdit])) state.view = 'field';
    if (state.view === 'report' && !layers().length) state.view = 'field';
    const extHtml = typeof opts.renderView === 'function' ? opts.renderView(state.view) : null;
    panel.innerHTML = extHtml != null ? extHtml : state.view === 'fields' ? renderFields() : state.view === 'add' ? renderAdd() : state.view === 'layer' ? renderLayer(L) : state.view === 'zones' ? renderZones() : state.view === 'zone' ? renderZoneEdit() : state.view === 'order' ? renderOrder() : state.view === 'upload' ? renderUpload() : state.view === 'report' ? renderReportPanel() : renderField();
    const sc2 = panel.querySelector('.panel-scroll'); if (keepScroll && sc2) sc2.scrollTop = lastScroll;
    const t = $('phone-title'); if (t) t.textContent = state.view === 'fields' ? 'Fields' : curField().name;
    renderDrawTools();
    reportEl.hidden = state.view !== 'report'; root.classList.toggle('report-mode', state.view === 'report');
    if (state.view === 'report') { reportEl.innerHTML = renderReportPage(); paintReportCanvas(); }
    if (state.view === 'field' && panel.querySelector('canvas[data-thumb]')) fillThumbs();
    dirty = true;
  }

  // ---------- photo viewer ----------
  function firstBand(L, smp, prefer) { const want = prefer || DEFAULT_BAND[surveyOf(L).bands] || 'RGB'; if (smp.img && smp.img[want]) return want; const tabs = BAND_TABS[surveyOf(L).bands] || ['RGB']; return tabs.find(b => smp.img && smp.img[b]) || Object.keys(smp.img || {})[0] || want; }
  function openPhoto(uid, idx) { const L = findLayer(uid); if (!L) return; const smp = photoSamples(L)[idx]; if (!smp) return; state.photo = { uid, idx, band: firstBand(L, smp), meta: false, sub: {}, zoom: 1 }; renderPhoto(); dirty = true; emit('photo_opened', { survey: L.survey, photo: smp.i }); }
  function closePhoto() { const was = state.photo; state.photo = null; modalEl.innerHTML = ''; dirty = true; if (was) emit(was.kind === 'sample' ? 'sample_closed' : 'photo_closed'); }
  function openSample(uid, idx) { const L = findLayer(uid); if (!L) return; const pt = samplePoints(L)[idx]; if (!pt) return; const band = pt.img && !pt.img.ANNOTATION ? Object.keys(pt.img)[0] : 'ANNOTATION'; state.photo = { uid, idx, band, kind: 'sample', meta: false, sub: {}, zoom: 1 }; renderPhoto(); dirty = true; emit('sample_opened', { index: pt.i, file: pt.file }); }
  function renderSample(p) {
    const L = findLayer(p.uid); const pts = samplePoints(L); const pt = pts[p.idx]; const f = curField(); const an = analyticOf(L) || {}; const tabs = an.tabs || ['ANNOTATION', 'ANNOTATION 2']; const key = pt.img && pt.img[p.band]; const ex = isExcluded(L, pt);
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
        <div class="kv2"><div><div class="k">${esc(an.detectedLabel || 'Crops Detected')}</div><div class="v">${fmtV(L, pt.density)} / ac</div></div><div><div class="k">Row Spacing</div><div class="v">${pt.rowSpacing != null ? pt.rowSpacing.toFixed(1) + ' in' : '—'}</div></div></div>
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
    if (p.kind === 'sample') { renderSample(p); return; } const L = findLayer(p.uid); const s = surveyOf(L); const list = photoSamples(L); const smp = list[p.idx]; const d = (smp.detailsBy && smp.detailsBy[p.band]) || smp.details || {}; const meta = (smp.metaBy && smp.metaBy[p.band]) || smp.meta || {};
    const tabs = BAND_TABS[s.bands] || ['RGB']; const key = smp.img && smp.img[p.band]; const isMs = STRETCHED_BANDS.has(p.band); const total = (s.photos.positions || []).length || s.photos.count || list.length;
    const table = rows => `<table class="meta-table"><tr><th>Name</th><th>Value</th></tr>${(rows || []).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>`;
    const subs = ['exif', 'file', 'gps', 'xmp'].map(k => `<div class="meta-sub${p.sub[k] ? ' open' : ''}" data-act="psub" data-sub="${k}" role="button" tabindex="0">${esc(k)}${icon('i-tri')}</div>${p.sub[k] ? ((meta[k] || []).length ? table(meta[k]) : '<div class="tip">Not in this sample.</div>') : ''}`).join('');
    modalEl.innerHTML = `<div class="photo-modal" data-act="pclose-bg"><div class="photo-dlg" role="dialog" aria-label="Photo viewer" data-act="pstop">
      <button class="iconbtn white photo-close" type="button" data-act="pclose" aria-label="Close">${icon('i-close')}</button>
      <div class="band-tabs">${tabs.length > 1 ? `<div class="pill">${tabs.map(b => `<button type="button" class="${b === p.band ? 'on' : ''}${smp.img && smp.img[b] ? '' : ' dim'}" data-act="pband" data-band="${esc(b)}">${esc(b)}</button>`).join('')}</div>` : ''}</div>
      <div class="photo-stage">${key && hasImg(key) ? `<img src="${DATA.img[key]}" alt="${esc(p.band)} photo ${smp.i}" style="transform:scale(${p.zoom})" draggable="false"><div class="zoomers"><button type="button" data-act="pzoom" data-dir="1" aria-label="Zoom in">+</button><button type="button" data-act="pzoom" data-dir="-1" aria-label="Zoom out">−</button></div>` : `<div class="missing">${key ? 'Loading…' : `The ${esc(p.band)} image for this photo is not in the sample${smp.img && Object.keys(smp.img).length ? ' — pick another band above' : ''}.`}</div>`}</div>
      <div class="photo-side">
        <button class="dl" type="button" data-act="download" data-what="photo" aria-label="Download">${icon('i-download', 'ico sm')}</button>
        <h2>Image Details</h2>
        <div class="when"><span>${esc(d.date || s.date)}</span><span>${esc(d.time || '')}</span></div>
        ${isMs ? `<div class="note">${icon('i-info')}<span>Brightness adjusted for display</span></div>` : ''}
        <div class="kv2"><div class="full"><div class="k">Field</div><div class="v">${esc(curField().name)}</div></div><div><div class="k">Camera Make</div><div class="v">${esc(d.make || '—')}</div></div><div><div class="k">Camera Model</div><div class="v">${esc(d.model || '—')}</div></div></div>
        <div class="meta-head${p.meta ? ' open' : ''}" data-act="pmeta" role="button" tabindex="0">Image Metadata ${icon('i-tri')}</div>
        ${p.meta ? subs : ''}
        ${tip('photo', `FieldAgent opens every photo of the flight straight from the map. This sample carries ${list.length} per survey — the dots with a bright ring — with the sensor's band tabs above the image and the file's full EXIF/XMP under <b>Image Metadata</b>.`)}
      </div>
      <div class="photo-nav"><button type="button" data-act="pnav" data-dir="-1" ${p.idx === 0 ? 'disabled' : ''}>${icon('i-back')}Previous</button><span>${smp.i} / ${total.toLocaleString()}</span><button type="button" data-act="pnav" data-dir="1" ${p.idx >= list.length - 1 ? 'disabled' : ''}>Next ${icon('i-tri')}</button></div>
    </div></div>`;
  }

  // ---------- "send this dataset to my inbox" (every download button in the sample opens it) ----------
  // Copy lives here so it is easy to tune. The form emits lead_captured {email, dataset…}; the page hosting the sample
  // forwards it to the CRM with the onLead option (see the WordPress block) — the sample itself never sends email.
  const LEAD_COPY = {
    title: 'Send this dataset to your inbox',
    intro: { tif: 'Enter your email and we will send you a download link for this GeoTIFF — the same full-resolution file a Scout subscriber downloads from this button.',
             zones: 'Enter your email and we will send you the zones of this field as a download link.',
             photo: 'Enter your email and we will send you a download link for the original photo.',
             report: 'Enter your email and we will send you this report as a PDF.' },
    button: 'Send me the download link', sending: 'Sending…',
    fine: 'We use your email to send the file and to tell you how FieldAgent Scout works. No mailing lists.',
    done: 'On its way — check your inbox for the download link.',
    error: 'That did not go through. Please check the address and try again.',
  };
  function datasetFor(what, t) {
    const f = curField(); const L = findLayer(state.detailUid);
    if (what === 'tif' && L) { const s = surveyOf(L); const tif = (s.tif || {})[L.product === 'ms' ? 'ms' : L.product]; return { kind: 'tif', title: PRODUCT_NAME[L.product] || L.product, sub: `${s.name} • ${s.date}`, file: `GeoTIFF${tif ? ' · ' + tif : ''}`, field: f.name, survey: s.key, product: L.product }; }
    if (what === 'zones') { const fmt = (t && t.dataset.fmt) || 'GeoJSON'; return { kind: 'zones', title: `Zones of ${f.name}`, sub: `${f.zones.length} zones · ${fmtAc(f.acres)} ac`, file: `${fmt} file`, field: f.name, format: fmt }; }
    if (what === 'photo' && state.photo) { const PL = findLayer(state.photo.uid); const s = surveyOf(PL); const smp = photoSamples(PL)[state.photo.idx]; return { kind: 'photo', title: `Photo ${smp.i} · ${state.photo.band}`, sub: `${s.name} • ${s.date}`, file: smp.file || 'Original image', field: f.name, survey: s.key, product: 'photo' }; }
    if (what === 'report') return { kind: 'report', title: state.report.title || 'Field Report', sub: `${f.name} · ${reportDateRange() || todayLong()}`, file: `PDF · ${state.report.paper}`, field: f.name, product: 'report' };
    return null;
  }
  function openLead(what, t) { const d = datasetFor(what, t); if (!d) return; state.menu = null; state.lead = { dataset: d, email: '', busy: false, sent: false, error: '' }; renderLead(); emit('lead_form_opened', { kind: d.kind, dataset: d.title, field: d.field }); }
  function closeLead() { state.lead = null; leadEl.innerHTML = ''; }
  const emailOk = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  function renderLead() {
    const l = state.lead; if (!l) { leadEl.innerHTML = ''; return; } const d = l.dataset;
    leadEl.innerHTML = `<div class="lead-modal" data-act="lclose-bg"><div class="lead-dlg" role="dialog" aria-modal="true" aria-label="${esc(LEAD_COPY.title)}" data-act="lstop">
      <button class="iconbtn white lead-close" type="button" data-act="lclose" aria-label="Close">${icon('i-close')}</button>
      <h2>${esc(LEAD_COPY.title)}</h2>
      <div class="dataset">${icon(d.kind === 'photo' ? 'i-camera' : d.kind === 'report' ? 'i-report' : d.kind === 'zones' ? 'i-polygon' : 'i-mosaic')}<div><b>${esc(d.title)}</b><span>${esc(d.sub)}</span><span class="file">${esc(d.file)}</span></div></div>
      ${l.sent ? `<div class="done">${icon('i-check')}<div><b>${esc(LEAD_COPY.done)}</b><span>${esc(d.file)} → ${esc(l.email)}</span></div></div><button class="btn-wide blue" type="button" data-act="lclose">Back to the field</button>`
      : `<p>${esc(LEAD_COPY.intro[d.kind] || LEAD_COPY.intro.tif)}</p>
      <label class="textfield"><span class="label">Email *</span><input type="email" inputmode="email" autocomplete="email" placeholder="you@farm.com" value="${esc(l.email)}" data-act="lemail" ${l.busy ? 'disabled' : ''} aria-invalid="${!!l.error}"></label>
      ${l.error ? `<div class="err">${esc(l.error)}</div>` : ''}
      <button class="btn-wide blue${l.busy ? ' disabled' : ''}" type="button" data-act="lsend" ${l.busy ? 'disabled' : ''}>${esc(l.busy ? LEAD_COPY.sending : LEAD_COPY.button)}</button>
      <div class="fine">${esc(LEAD_COPY.fine)}</div>`}
    </div></div>`;
    if (!l.sent && !l.busy) { const inp = leadEl.querySelector('[data-act="lemail"]'); if (inp) inp.focus(); }
  }
  async function sendLead() {
    const l = state.lead; if (!l || l.busy) return; const inp = leadEl.querySelector('[data-act="lemail"]'); l.email = (inp ? inp.value : l.email).trim();
    if (!emailOk(l.email)) { l.error = 'Please enter a valid email address.'; renderLead(); return; }
    l.error = ''; l.busy = true; renderLead();
    const lead = { email: l.email, kind: l.dataset.kind, dataset: l.dataset.title, detail: l.dataset.sub, file: l.dataset.file, field: l.dataset.field, survey: l.dataset.survey || null, product: l.dataset.product || l.dataset.format || null, at: new Date().toISOString() };
    let ok = true;
    try { if (typeof opts.onLead === 'function') { const r = await opts.onLead(lead); ok = r !== false; } } catch (e) { ok = false; }
    if (!state.lead || state.lead !== l) return;   // closed meanwhile
    l.busy = false;
    if (!ok) { l.error = LEAD_COPY.error; renderLead(); return; }
    l.sent = true; state.leads.push(lead); renderLead(); emit('lead_captured', lead);
  }
  leadEl.addEventListener('click', e => {
    const t = e.target.closest('[data-act]'); if (!t) return; const act = t.dataset.act;
    if (act === 'lclose' || (act === 'lclose-bg' && e.target === t)) closeLead(); else if (act === 'lsend') sendLead();
  });
  leadEl.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); closeLead(); } if (e.key === 'Enter' && e.target.matches('[data-act="lemail"]')) { e.preventDefault(); sendLead(); } });
  leadEl.addEventListener('input', e => { if (e.target.matches('[data-act="lemail"]') && state.lead) { state.lead.email = e.target.value; if (state.lead.error) { state.lead.error = ''; const err = leadEl.querySelector('.err'); if (err) err.remove(); } } });

  // ---------- events ----------
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-blocked]'); if (b) { e.stopPropagation(); if (typeof opts.onBlocked === 'function' && opts.onBlocked(b.dataset.blocked, b) === true) return; toast(blockedMsg(b.dataset.blocked)); if (state.menu) { state.menu = null; render(true); } return; }
    const nav = e.target.closest('[data-nav]'); if (nav) { openFields(); return; }
    const pin = e.target.closest('[data-pin]'); if (pin) { openField(pin.dataset.pin); return; }
    const tab = e.target.closest('.rail .tab'); if (tab) { if (typeof opts.onTab === 'function' && opts.onTab(tab.dataset.tab, tab) === true) return; toast(blockedMsg(tab.dataset.tab)); return; }
    const tc = e.target.closest('[data-act="tipclose"]'); if (tc) { state.tipsDone.add(tc.dataset.tip); remember(); const card = tc.closest('.tip-card'); if (card) card.remove(); return; }
  });
  // modal + report stage share one handler because both live outside the panel
  function outsideHandler(e) {
    const t = e.target.closest('[data-act]'); if (!t) return; const act = t.dataset.act; const p = state.photo; const r = state.report;
    if (act === 'pclose' || (act === 'pclose-bg' && e.target === t)) { closePhoto(); }
    else if (act === 'download') { if (opts.leadCapture === false) { toast(opts.downloadMessage || 'Downloads work in your own FieldAgent account. This demo is view-only.'); emit('download_attempt', { what: t.dataset.what }); } else openLead(t.dataset.what, t); }
    else if (act === 'pband') { p.band = t.dataset.band; p.zoom = 1; renderPhoto(); emit(p.kind === 'sample' ? 'sample_tab_changed' : 'photo_band_changed', { band: p.band }); }
    else if (act === 'pmeta') { p.meta = !p.meta; renderPhoto(); emit('photo_metadata_toggled', { open: p.meta }); }
    else if (act === 'psub') { p.sub[t.dataset.sub] = !p.sub[t.dataset.sub]; renderPhoto(); }
    else if (act === 'pzoom') { p.zoom = clamp(p.zoom * (t.dataset.dir === '1' ? 1.4 : 1 / 1.4), 1, 4); const im = modalEl.querySelector('.photo-stage img'); if (im) im.style.transform = `scale(${p.zoom})`; emit('photo_zoomed', { zoom: p.zoom }); }
    else if (act === 'pnav') { const L = findLayer(p.uid); const list = isSamples(L) ? samplePoints(L) : photoSamples(L); const n = list.length; p.idx = clamp(p.idx + (+t.dataset.dir), 0, n - 1); const smp = list[p.idx];
      if (isSamples(L)) { if (smp.img && !smp.img[p.band]) p.band = Object.keys(smp.img)[0]; } else if (!(smp.img && smp.img[p.band])) p.band = firstBand(L, smp);
      p.zoom = 1; renderPhoto(); dirty = true; emit(isSamples(L) ? 'sample_navigated' : 'photo_navigated', { index: isSamples(L) ? smp.i : p.idx }); }
    else if (act === 'pexclude') { const L = findLayer(p.uid); const pt = samplePoints(L)[p.idx]; if (pt) { const k = exKey(L, pt); if (state.excluded[k]) delete state.excluded[k]; else state.excluded[k] = true; renderPhoto(); render(true); emit('sample_excluded', { index: pt.i, excluded: !!state.excluded[k] }); } }
    else if (act === 'rtitle-edit') { if (r.editTitle) { const inp = reportEl.querySelector('[data-act="rtitle"]'); if (inp && inp.value.trim()) r.title = inp.value.trim(); } r.editTitle = !r.editTitle; render(true); if (!r.editTitle) emit('report_edited', { what: 'rtitle' }); else emit('report_title_editing'); }
    else if (act === 'rsummary-edit') { r.editSummary = true; render(true); }
    else if (act === 'rimg-edit') { r.editImg = true; render(true); }
    else if (act === 'rnote-edit') { r.editNote = true; render(true); }
    else if (act === 'rcancel') { const w = t.dataset.what; if (w === 'rsummary') r.editSummary = false; if (w === 'rimg') r.editImg = false; if (w === 'rnote') r.editNote = false; render(true); }
    else if (act === 'rsave') { const w = t.dataset.what; const inp = reportEl.querySelector(`[data-act="${w}"]`); const val = inp ? inp.value.trim() : ''; if (w === 'rsummary') { r.summary = val; r.editSummary = false; } if (w === 'rimg') { r.imgTitle = val; r.editImg = false; } if (w === 'rnote') { r.note = val; r.editNote = false; } render(true); emit('report_edited', { what: w }); }
  }
  modalEl.addEventListener('click', outsideHandler); reportEl.addEventListener('click', outsideHandler);
  modalEl.addEventListener('keydown', e => { if (e.key === 'Escape') closePhoto(); if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button]')) { e.preventDefault(); e.target.click(); } });
  panel.addEventListener('click', e => {
    if (e.target.closest('[data-blocked]') || e.target.closest('[data-nav]') || e.target.closest('[data-act="tipclose"]')) return;
    const t = e.target.closest('[data-act]'); if (!t) { if (state.menu) { state.menu = null; render(true); } return; }
    const act = t.dataset.act; const L = findLayer(state.detailUid);
    if (typeof opts.onAct === 'function' && opts.onAct(act, t, e) === true) return;
    if (act === 'back') { goto(t.dataset.to || 'field'); }
    else if (act === 'open') { openField(t.dataset.fid); }
    else if (act === 'add') { goto('add'); emit('add_layers_opened', { field: state.fid }); }
    else if (act === 'order') { goto('order'); emit('order_mosaics_opened'); }
    else if (act === 'upload') { goto('upload'); emit('import_imagery_opened'); }
    else if (act === 'report') { goto('report'); emit('report_opened'); }
    else if (act === 'report-empty') { toast('Add a map layer first — a report prints the layers that are on the map.'); }
    else if (act === 'zones') { goto('zones'); emit('zones_opened'); }
    else if (act === 'zone') { state.zoneEdit = +t.dataset.zi; goto('zone'); const pts = curField().zones[state.zoneEdit].rings.flat(); const rr = { x0: Math.min(...pts.map(q => q[0])), y0: Math.min(...pts.map(q => q[1])), x1: Math.max(...pts.map(q => q[0])), y1: Math.max(...pts.map(q => q[1])) }; flyTo(fitView(rr, isPortraitPhone() ? 40 : 140), 700); emit('zone_opened'); }
    else if (act === 'zonetoggle') { const zi = +t.dataset.zi; const on = zonesOn(); const i = on.indexOf(zi); if (i >= 0) on.splice(i, 1); else on.push(zi); render(true); emit('zone_toggled', { on: i < 0 }); }
    else if (act === 'zonedone') { goto('field'); flyTo(fitField(), 600); emit('zone_done'); }
    else if (act === 'showmore') { state.showMore = !state.showMore; render(true); emit('show_more_toggled', { open: state.showMore }); }
    else if (act === 'src') { state.sources[t.dataset.src] = !state.sources[t.dataset.src]; render(true); emit('source_toggled', { source: t.dataset.src, on: state.sources[t.dataset.src] }); if (t.dataset.src === 'satellite' && state.sources.satellite) emit('satellite_opened'); }
    else if (act === 'pick') { const { survey, product } = t.dataset; const kind = t.dataset.kind || 'drone'; const i = layers().findIndex(l => l.kind === kind && l.survey === survey && l.product === product); if (i >= 0) layers().splice(i, 1); else { const nl = newLayer(state.fid, { kind, survey, product }); layers().unshift(nl); ensure(nl); emit('layer_added', { kind, survey, product }); } render(true); }
    else if (act === 'sprop') { const pr = ((analyticOf(L) || {}).props || []).find(x => x.id === t.dataset.prop); if (pr) { L.prop = pr.id; L.viz = pr.viz || 'rgb'; L.col = VIZ[L.viz] && VIZ[L.viz].index ? defaultCol(L) : null; } state.menu = null; render(true); emit('sample_prop_changed', { prop: L.prop }); }
    else if (act === 'hideex') { L.hideExcluded = !L.hideExcluded; render(true); emit('hide_excluded_toggled', { on: !!L.hideExcluded }); }
    else if (act === 'ykc') { L.kc = +t.dataset.idx; state.menu = null; render(true); emit('yield_activity_selected', { index: L.kc }); }
    else if (act === 'pickphotos') { const { survey } = t.dataset; const i = layers().findIndex(l => l.kind === 'photos' && l.survey === survey); if (i >= 0) layers().splice(i, 1); else { layers().unshift(newLayer(state.fid, { kind: 'photos', survey, product: 'photos' })); emit('layer_added', { kind: 'photos', survey }); } render(true); }
    else if (act === 'picksat') { const { date, product } = t.dataset; const i = layers().findIndex(l => l.kind === 'sat' && l.date === date && l.product === product); if (i >= 0) layers().splice(i, 1); else { const nl = newLayer(state.fid, { kind: 'sat', date, product, viz: product }); layers().unshift(nl); ensure(nl); emit('layer_added', { kind: 'satellite', date, product }); } render(true); }
    else if (act === 'detail') { if (e.target.closest('[data-handle]')) return; state.detailUid = +t.dataset.uid; state.view = 'layer'; state.menu = null; state.binTable = false; render(); emit('layer_details_opened', { layer: layerTitle(findLayer(state.detailUid)) }); }
    else if (act === 'toggle') { e.stopPropagation(); const l = findLayer(+t.dataset.uid); l.visible = !l.visible; if (l.visible) l._fade = true; render(true); emit('layer_toggled', { visible: l.visible, layer: layerTitle(l) }); }
    else if (act === 'remove') { e.stopPropagation(); state.layersByField[state.fid] = layers().filter(x => x.uid !== +t.dataset.uid); render(true); emit('layer_removed'); }
    else if (act === 'menu') { state.menu = state.menu === t.dataset.menu ? null : t.dataset.menu; render(true); emit('menu_toggled', { menu: t.dataset.menu, open: state.menu === t.dataset.menu }); }
    else if (act === 'viz') { setViz(L, t.dataset.viz); state.menu = null; ensure(L); render(true); emit('visualization_changed', { viz: t.dataset.viz }); }
    else if (act === 'scale') { L.col.scale = t.dataset.scale; state.menu = null; render(true); emit('color_scale_changed', { scale: t.dataset.scale }); }
    else if (act === 'mode') { L.col.mode = t.dataset.mode; render(true); emit('color_mode_changed', { mode: t.dataset.mode }); }
    else if (act === 'clip') { L.clipped = t.dataset.clip === '1'; render(true); emit('clip_changed', { clipped: L.clipped }); }
    else if (act === 'includeout') { L.col.includeOut = !L.col.includeOut; render(true); emit('include_out_toggled', { on: L.col.includeOut }); }
    else if (act === 'bintable') { state.binTable = !state.binTable; render(true); emit('bin_table_toggled', { open: state.binTable }); }
    else if (act === 'openphoto') { openPhoto(+t.dataset.uid, +t.dataset.idx); }
    else if (act === 'sort') { state.sort = t.dataset.sort; state.menu = null; render(true); emit('sort_changed', { sort: state.sort }); }
    else if (act === 'season') { state.menu = null; render(true); }
    else if (act === 'osurvey') { state.order.survey = t.dataset.survey; state.order.picks = {}; state.order.aligned = {}; state.menu = null; render(true); emit('order_survey_selected', { survey: state.order.survey }); }
    else if (act === 'opick') { const k = t.dataset.key; state.order.picks[k] = !state.order.picks[k]; if (!state.order.picks[k]) delete state.order.aligned[k]; render(true); emit('order_product_toggled', { product: k, on: !!state.order.picks[k] }); }
    else if (act === 'oalign') { const k = t.dataset.key; state.order.aligned[k] = !state.order.aligned[k]; render(true); emit('order_aligned_toggled', { product: k, on: !!state.order.aligned[k] }); }
    else if (act === 'oinfo') { toast(state.order.survey ? 'This product is not available for the selected sensor.' : 'Select a survey first.'); }
    else if (act === 'info') { e.stopPropagation(); toast(t.dataset.info); }
    else if (act === 'osubmit') { toast('Orders are submitted from your own FieldAgent account. This sample does not place orders.'); emit('order_submit_attempt'); }
    else if (act === 'utype') { state.upload.type = { 'Fully Stitched Mosaic': 'mosaic', 'QuickTile': 'quicktile', 'Individual Photos': 'photos' }[t.dataset.val]; render(true); emit('upload_type_changed', { type: state.upload.type }); }
    else if (act === 'ukind') { state.upload.kind = t.dataset.val; render(true); emit('upload_kind_changed', { kind: state.upload.kind }); }
    else if (act === 'horizon') { state.upload.horizon = !state.upload.horizon; render(true); emit('upload_horizon_toggled', { on: state.upload.horizon }); }
    else if (act === 'drop' || act === 'usubmit') { toast(opts.uploadMessage || 'Uploads happen in your own FieldAgent account. This sample is view-only.'); emit('upload_attempt', { what: act }); }
    else if (act === 'rsec') { const k = t.dataset.sec; state.report.secOpen[k] = !state.report.secOpen[k]; render(true); }
    else if (act === 'rtoggle') { const k = t.dataset.key; state.report[k] = !state.report[k]; render(true); emit('report_toggled', { key: k, on: !!state.report[k] }); }
    else if (act === 'paper') { state.report.paper = t.dataset.paper; state.menu = null; render(true); emit('report_paper_changed', { paper: state.report.paper }); }
    else if (act === 'download') { const hadMenu = !!state.menu; if (opts.leadCapture === false) { toast(opts.downloadMessage || 'Downloads work in your own FieldAgent account. This demo is view-only.'); emit('download_attempt', { what: t.dataset.what }); state.menu = null; } else openLead(t.dataset.what, t); if (hadMenu) render(true); }
  });
  panel.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button],[role=switch],[role=checkbox],[role=radio],[role=option]')) { e.preventDefault(); e.target.click(); } });
  panel.addEventListener('input', e => {
    const t = e.target.closest('[data-act]'); if (!t) return; const act = t.dataset.act;
    if (typeof opts.onInput === 'function' && opts.onInput(act, t, e) === true) return;
    if (act === 'search') { state.search = t.value; const scroll = panel.querySelector('.panel-scroll').scrollTop; render(); emit('search_changed', { query: state.search }); const inp = panel.querySelector('[data-act="search"]'); inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); panel.querySelector('.panel-scroll').scrollTop = scroll; return; }
    if (act === 'alt') { state.upload.alt = Math.round(parseFloat(t.value)); $('alt-caption').textContent = `${state.upload.alt} ft`; emit('upload_buffer_changed', { ft: state.upload.alt }); return; }
    if (act === 'zonename') { state.zoneNames[state.fid + ':' + t.dataset.zi] = t.value; dirty = true; return; }
    const L = findLayer(state.detailUid); if (!L) return; const v = parseFloat(t.value);
    if (act === 'opacity') { L.opacity = v / 100; t.parentElement.nextElementSibling.textContent = `${Math.round(v)}%`; dirty = true; if (!L._opEmitted) { L._opEmitted = true; emit('opacity_changed'); } }
    else if (act === 'bins') { L.col.bins = Math.round(v); patchColorization(L); emit('bins_changed', { bins: L.col.bins }); }
    else if (act === 'rmin') { const [lo, hi] = vizRange(L); const gap = (hi - lo) / 100; L.col.min = Math.min(v, L.col.max - gap); t.value = L.col.min; patchColorization(L); emit('range_changed', { end: 'min', value: L.col.min }); }
    else if (act === 'rmax') { const [lo, hi] = vizRange(L); const gap = (hi - lo) / 100; L.col.max = Math.max(v, L.col.min + gap); t.value = L.col.max; patchColorization(L); emit('range_changed', { end: 'max', value: L.col.max }); }
  });
  // Drag-to-reorder in the Map Layers list: the row follows the pointer, the others slide out of the way, and the
  // new order is committed on release — any row can go to any position.
  panel.addEventListener('pointerdown', e => {
    const h = e.target.closest('[data-handle]'); if (!h) return; e.preventDefault();
    const row = h.closest('.layer-row'); const list = row.parentElement; const rows = [...list.querySelectorAll('.layer-row')]; const from = rows.indexOf(row);
    const rects = rows.map(r => r.getBoundingClientRect()); const startY = e.clientY; let target = from;
    h.setPointerCapture(e.pointerId); row.classList.add('dragging'); rows.forEach(r => { if (r !== row) r.classList.add('shift'); });
    const move = ev => {
      const dy = ev.clientY - startY; row.style.transform = `translateY(${dy}px)`; const cy = rects[from].top + rects[from].height / 2 + dy;
      target = from; for (let i = 0; i < rects.length; i++) { const mid = rects[i].top + rects[i].height / 2; if (i < from && cy < mid) { target = Math.min(target, i); } if (i > from && cy > mid) target = Math.max(target, i); }
      rows.forEach((r, i) => { if (i === from) return; let s = 0; if (target < from && i >= target && i < from) s = rects[from].height; if (target > from && i <= target && i > from) s = -rects[from].height; r.style.transform = s ? `translateY(${s}px)` : ''; });
    };
    const up = () => { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
      rows.forEach(r => { r.style.transform = ''; r.classList.remove('shift', 'dragging'); });
      if (target !== from) { const Ls = layers(); const [l] = Ls.splice(from, 1); Ls.splice(target, 0, l); emit('layers_reordered'); } render(true); };
    h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
  });
  $('collapse').addEventListener('click', () => setCollapsed(!state.collapsed));
  $('locate').addEventListener('click', () => flyTo(state.view === 'fields' ? fitAllFields() : fitField(), 700));
  if (opts.tips === false) { const h = $('hint'); if (h) h.remove(); }
  { const hc = $('hint-close'); if (hc) hc.addEventListener('click', () => $('hint').remove()); }
  $('rotate-close').addEventListener('click', () => $('rotate').classList.add('hidden'));
  setTimeout(() => { const r = $('rotate'); if (r) r.classList.add('hidden'); }, 14000);
  { const handle = $('sheet'); const wrap = root.querySelector('.panel-wrap'); let sd = null;
    handle.addEventListener('pointerdown', e => { handle.setPointerCapture(e.pointerId); sd = { y: e.clientY, h: wrap.getBoundingClientRect().height, moved: false }; wrap.classList.add('dragging'); root.classList.add('sheet-dragging'); });
    handle.addEventListener('pointermove', e => { if (!sd) return; const dy = sd.y - e.clientY; if (Math.abs(dy) > 4) sd.moved = true; const h = clamp(sd.h + dy, 22, root.clientHeight * 0.88); root.style.setProperty('--sheet-h', h + 'px'); if (state.collapsed && h > 40) { state.collapsed = false; root.classList.remove('collapsed'); } });
    const end = () => { if (!sd) return; wrap.classList.remove('dragging'); root.classList.remove('sheet-dragging'); const h = wrap.getBoundingClientRect().height;
      if (!sd.moved) setCollapsed(!state.collapsed); else if (h < 60) { state.sheetH = null; setCollapsed(true); } else { state.sheetH = h + 'px'; state.collapsed = false; root.classList.remove('collapsed'); resize(); if (state.view !== 'fields') flyTo(fitField(), 450); }
      sd = null; };
    handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end); }

  // ---------- boot ----------
  resize(); render(); requestAnimationFrame(frame);
  const f0 = FIELD[opts.startField] || FIELDS[0]; state.fid = f0.id; const s0 = f0.surveys.find(x => hasImg(`${f0.id}_${x.key}_ndvi`)) || f0.surveys[0];
  const touches = (a, b) => !(a.x1 < b.x0 || a.x0 > b.x1 || a.y1 < b.y0 || a.y0 > b.y1);
  const first = [...BASEMAPS.filter(b => touches(b.rect, f0.rect)).map(b => b.key), `${f0.id}_${s0.key}_ndvi`, `${f0.id}_${s0.key}_rgb`, `${f0.id}_${s0.key}_mask`].filter(hasImg);
  jumpTo(fitField(f0.id));
  const booted = Promise.all(first.map(loadImage)).then(() => {
    const l = $('loading'); if (l) l.remove();
    openField(f0.id, false);
    // warm the layers of every field's default stack (and their masks) in the background; everything else — the other
    // indices, bands, QuickTiles, satellite dates, photos — decodes on demand when it is added to the map
    const warm = [];
    for (const f of FIELDS) for (const L of defaultLayers(f.id)) { const k = imgKey(L); if (k) { warm.push(k); warm.push(maskId(L)); } }
    const rest = [...new Set(warm)].filter(k => hasImg(k) && !IMG[k]); let i = 0;
    const next = () => { if (i >= rest.length) return; loadImage(rest[i++]).catch(() => {}).then(() => setTimeout(next, 30)); }; setTimeout(next, 800);
  }).catch(err => { console.error(err); const l = $('loading'); if (l) l.textContent = 'The imagery could not be decoded in this browser.'; });

  function addLayer(spec, visible = true, open = false) {
    const L = newLayer(state.fid, spec); L.visible = visible; layers().unshift(L); ensure(L);
    if (open) { state.detailUid = L.uid; state.view = 'layer'; state.menu = null; state.binTable = false; }
    render(); return L;
  }
  return { state, opts, openField, openFields, flyTo, openPhoto, openSample, openLead, render, goto, toast, layers, addLayer, setCollapsed, defaultLayers, root, panel, FIELD, emit, fitField, layerTitle, ready: booted,
    ui: { icon, esc, head, tip, fmtAc, fmtV, curField, blockedMsg, SENSOR_LABEL, $, analyticOf, samplePoints, toScreen: (wx, wy) => toScreen(wx, wy), isSamples } };
}
return { mount };
})();

