# fa-demos — guided FieldAgent Web demos for the support site

A static site. Each page is an interactive, view-only copy of FieldAgent Web built from a real field, with a
step-by-step guide for one feature. Readers follow the steps in the copy of the app, or press *Show me* and watch
each step happen. Nothing they do touches real data, and nothing needs a sign-in.

It is hosted on GitHub Pages and shown on support pages through the `fieldagent-demo` GitBook integration (a
`webframe` block), with a link out to the full-size page under each block.

## URLs

| URL | What it shows |
| --- | --- |
| `demo.html?s=<id>&mode=page` | The demo full size, with a top bar (title, demo picker, *Back to the guide* link to the matching support page). Use for link-outs. |
| `demo.html?s=<id>&mode=embed` | The demo alone, for framing. Speaks the GitBook webframe protocol (`@webframe.ready`, `@webframe.resize` 16:10, switches demos on `{ state: { scenario } }`). |
| `index.html` | Catalogue of the demos with their support pages and embed URLs. |

Without `mode`, a framed page behaves as `embed` and a top-level page as `page`. A host page may preset
`window.FA_MODE` before the scripts run.

Demo ids: `field-view`, `find-a-field`, `map-layers`, `colorization`, `compare-dates`, `zones`, `satellite`,
`photo-dots`, `order-mosaic`, `import-imagery`, `report`, `download-data`, `elevation`, `quicktile`, `edit-field`,
`crop-season`, `share-field`, `order-analytics`, `stand-count`, `tassel-count`, `hydrology`, `create-field`.

## Files

| File | Role |
| --- | --- |
| `demo.html` | Built page (from `demo.template.html`). Loads the files below. |
| `fa-engine.js` | The FieldAgent lookalike engine, support edition: `FieldAgentDemo.mount(root, DATA, opts)`. Generated from the lookalike's logic script by `patch_engine.py` (132 exact-match patches: options `seedLayers`, `tips`, `leadCapture`, `blockedMessage`, `downloadMessage`, `uploadMessage`; ~30 fine-grained events; a small API for the tour). Do not edit by hand — change the patch script and regenerate. |
| `fa-style.css` | FieldAgent design tokens and the lookalike's styles (single dark theme, as the product). |
| `fa-ext.js`, `fa-ext.css` | Extension panels the generated engine leaves inert: Edit Field, Add a Field Activity (crop seasons and activities), Share Field / Share Fields, Order Analytics. Wired through the engine's `opts.renderView / onBlocked / onAct / onInput / renderActivities / drawToolsFor` hooks. |
| `fa-tour.js`, `fa-tour.css` | The guided-demo layer: coach card, progress, spotlight that follows the target, *Show me* / *Skip step* / *Start again* / *Play all*, finish card with links to the support pages. *Show me* is paced and animated (see *How Show me moves* below); the file also adds the UI transitions — panel views slide in, viewers and dialogs pop in, menus fade in — and the engine fades a layer onto the map when it is added. |
| `scenarios.js` | The 22 demos as data (`window.FA_SCENARIOS`). Adding a demo is adding an entry here. |
| `data/fa-data.js` | Field, surveys, catalog text and the image manifest (`img` keys → files under `img/`, `dims`). |
| `img/` | 194 JPEG/PNG tiles: mosaics, QuickTiles, photo thumbnails, satellite dates, basemaps (10 MB). Decoded on demand. |
| `sprite.svg.html` | Icon sprite (Material icons + the FieldAgent mark). |
| `index.html` | Catalogue (generated). |
| `tools/` | Build and test scripts and the lookalike's original logic script (the engine's source). |

## Build

`demo.html` and `index.html` are generated from `demo.template.html` and `scenarios.js`; the engine is generated from
the lookalike's logic script. The tools live in `tools/` and need Python 3 only. Run them from the repository root:

```bash
python3 tools/patch_engine.py    # only when the lookalike engine source (tools/lookalike_logic.js) changed
python3 tools/build.py           # demo.html, index.html, and build/fa-demos-preview.html (single file, ignored by Git)
```

Editing `scenarios.js` alone needs no build: `demo.html` loads it directly.

`tools/pw_tour.js` drives every demo end to end in headless Chromium through *Show me* and reports whether each step
advanced (and how long it took). Start `python3 -m http.server 8765` in the repository root, then
`node tools/pw_tour.js map-layers zones …` (once: `npm i playwright` and `npx playwright install chromium`).
`FA_SPEED=4` runs the paced tour four times faster, `FA_SHOTS=1` saves a screenshot per step to `build/shots/`.
`pw_restart.js`, `pw_switch.js` and `pw_views.js` cover *Start again*, switching demos, and the embed and phone
viewports (they open the demos with `&speed=8`); `pw_frames.js <demo> <steps>` records a Show me as a frame sequence
and `tools/sheet.py` lays the frames out as a contact sheet, which is how the pacing was tuned. All 21 demos pass.

## Hosting on GitHub Pages

The repository root is the site (Settings → Pages → Deploy from a branch → main, / (root)). `.nojekyll` makes Pages
copy the files as they are. GitHub Pages allows framing, so the GitBook block can embed the pages. See `SETUP.md` in
the package for the full sequence, including the GitBook integration.

## Writing a demo

A scenario is data:

```js
S['zones'] = {
  id: 'zones', title: 'Compare zones with zone statistics', page: PAGE.zones, field: F, seedLayers: false,
  setup(app) { app.addLayer(ndvi, true, false); },      // state before step 1 (also used by Start again)
  steps: [
    { text: 'In the <b>Zones</b> card, click the layers icon …', target: '[data-act="zones"]', event: 'zones_opened' },
    { text: 'Tick <b>Zone 1</b>.', target: '[data-act="zonetoggle"][data-zi="0"]', event: 'zone_toggled' },
    …
    { text: 'Scroll to <b>Zone Statistics</b> …', target: 'section.card:has(.stat-row)', info: true },
  ],
  finish: { text: '…', links: [{ label: 'Zones and zone statistics', path: PAGE.zones }] },
};
```

- `target` is a CSS selector inside the demo (or a function returning an element). The spotlight follows it and
  *Show me* clicks it. `highlight` overrides what the ring surrounds.
- `event` (or an array) is the engine event that proves the reader did the step; `match(detail)` narrows it.
- `demo: { value }` drags a slider to the value, `demo: { text }` types into a field; `showMe: async fn(app, root, bot)`
  performs a custom sequence with the paced primitives (`bot.click(sel)`, `bot.pick(menuSel, optSel)`,
  `bot.type(sel, text)`, `bot.slide(sel, value)`, `bot.sample(layerUid, index)`, `bot.wait(ms)` — all return promises,
  so chain them with `await`); `showMe: false` hides the button; `info: true` makes a read-only step with *Next*.
  `pickMenu(menuSel, optSel)` and `typeInto(bot, sel, text)` in `scenarios.js` are shorthands for the two common cases.
- `note` adds a callout under the text (for example that uploads are disabled in the demo).
- `seedLayers: false` starts the field with an empty Map Layers card so the demo adds layers itself.
- `page` is the support page the demo belongs to; the top bar's *Back to the guide* and the finish links use it. Paths
  come from the `PAGE` map at the top of `scenarios.js`, built as `SPACE + '/<group>/<page>'`, where `SPACE` is the path
  of the FieldAgent space on support.senterasensors.com (today `/fieldagent-documentation-updates`; change that one
  constant when the content moves). GitBook forms a page's URL from the SUMMARY.md group heading and the file name —
  `## View and analyze` + `view/map-layers.md` → `/view-and-analyze/map-layers` — so the folder name is not part of it.
  A demo never links to the page it sits on. The links are plain anchors: inside the GitBook block they target the
  top window (GitBook's webframe is not sandboxed, and it ignores `@webframe.*` messages from frames that are not on
  its own integration hosts, so a message-based navigation cannot work from GitHub Pages); full size they open the
  page in a new tab.

Every control the reader could use in the real app works the same way in the copy: the guide only watches and
highlights. Controls that would change real data (orders, uploads, downloads, sharing) show a short message
instead.

## How Show me moves

*Show me* is deliberately slow enough to follow. A pointer sets off from the button the reader pressed, glides to
the control (about half a second across the panel), rests on it with FieldAgent's own hover state, presses — a
ripple marks the click — and stays a moment before the tour moves on. Menus stay open for three quarters of a second
before the option is chosen; sliders are dragged, with the map, histogram and caption updating as the thumb moves;
text is typed a character at a time (dates are set whole); hidden row buttons such as the eye are revealed by hovering
the row first; a sample bubble on the map is pointed at before its viewer opens. When the engine reports the step
done, the card shows *Step N done*, the spotlight turns solid, and the result stays on screen for 1.2 s before the
next card fades in. *Play all* runs the remaining steps this way with a reading pause before each one; *Pause*
stops it. The timings live in `PACE` at the top of `fa-tour.js`, and `?speed=2` on a demo URL (or
`FieldAgentTour.speed = 2` before the tour starts) runs everything twice as fast — `?speed=0.5` at half speed.
`prefers-reduced-motion` keeps the pauses but drops the glides, ripples and slide-ins.

## Hosting notes

- Plain static files; no build step at deploy time; no server code.
- Must be served over HTTPS and must not send `X-Frame-Options` or a `frame-ancestors` policy that excludes
  GitBook, or the embedded block will be blank. GitHub Pages and Cloudflare Pages send neither by default.
- `img/` is immutable content — long cache lifetimes are safe. `demo.html` and the JS/CSS should revalidate.
- `<meta name="robots" content="noindex">` keeps the demos out of search results; the support pages are the entry
  point.
- `window.FA_ANALYTICS(name, detail)` receives `demo_started`, `demo_step`, `demo_finished`, `demo_restarted` and
  the engine's own events, for a page-view tool later.
