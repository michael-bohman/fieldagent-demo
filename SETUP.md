# Setting up the FieldAgent demos: GitHub Pages + the GitBook integration

*FieldAgent Support Site Update · 8 September 2026 (updated 9 September: repository `fieldagent-demo`, 22 demos, three Sentera Demo Account fields)*

This is the hands-on sequence for options B and C from the investigation report: host the demo site on GitHub Pages, publish the private `fieldagent-demo` GitBook integration, install it on the FieldAgent space, and put demos on pages with a full-size link under each one. The package `fieldagent-demos-setup.zip` contains two folders: `fieldagent-demos/` (the complete GitHub repository for the site) and `fa-demos-integration/` (the integration, published from your machine with the GitBook CLI).

Everything below assumes the GitHub account `michael-bohman` and the repository name `fieldagent-demo`, which gives the site the address `https://michael-bohman.github.io/fieldagent-demo`. The integration is pre-configured for that address. If you use another account, organization or repository name, the address changes accordingly, and step 6 says where to update it.

## Part 1 — Host the site on GitHub Pages

1. **Create the repository in GitHub Desktop.** File → New Repository… Name: `fieldagent-demo`. Local Path: your usual `~/Documents/GitHub`. Leave "Initialize this repository with a README" unchecked. Create Repository.

2. **Copy the site in.** In Finder, open the `fieldagent-demos/` folder from the zip, select everything inside it (including the hidden `.nojekyll` and `.gitignore` — press ⌘⇧. to show hidden files) and copy it into `~/Documents/GitHub/fieldagent-demo`. GitHub Desktop now lists about 200 changed files.

3. **Commit and publish.** Summary: `FieldAgent guided demos`. Commit to main, then Publish repository. Untick **Keep this code private**: GitHub Pages on a free account only publishes public repositories, and the site is public in any case. Everything in this repository is served to the web; it contains only the demo code, the demo field's imagery, and the build tools.

4. **Turn on Pages.** On github.com open the repository → Settings → Pages. Under *Build and deployment* choose Source: **Deploy from a branch**, Branch: **main**, folder **/ (root)**, then Save. The Actions tab shows a "pages build and deployment" run; it takes about a minute. The page then shows the address `https://michael-bohman.github.io/fieldagent-demo/`.

5. **Check it.** Open these three:
   - `https://michael-bohman.github.io/fieldagent-demo/index.html` — the catalogue.
   - `https://michael-bohman.github.io/fieldagent-demo/demo.html?s=map-layers&mode=page` — a demo full size, with the top bar and the *Back to the guide* link.
   - `https://michael-bohman.github.io/fieldagent-demo/demo.html?s=zones&mode=embed` — the same demo without the bar, as the block will frame it.
   Press *Show me* a few times. Try one on your phone.

6. **If the address is different** (another account, organization or repository name), change it in three places before Part 2, and use it wherever this guide shows the address:
   - `fa-demos-integration/gitbook-manifest.yaml` → first `urlUnfurl` entry (keep the `/**`).
   - `fa-demos-integration/gitbook-manifest.yaml` → `configurations.space.properties.demo_host.default`.
   - `fa-demos-integration/src/index.tsx` → `DEFAULT_HOST`.

A custom domain such as `demo.senterasensors.com` can come later without republishing anything but the integration's default: ask whoever manages Sentera's DNS for a CNAME `demo` → `michael-bohman.github.io`, enter the domain under Settings → Pages → Custom domain, tick Enforce HTTPS, then change the *Demo host* setting on the space installation (Part 3) and the link-out URLs on the pages.

## Part 2 — Publish the integration

You need Node 18 or newer (`node -v` in Terminal; if it is missing, install the LTS from nodejs.org) and a GitBook account that is an admin of the Sentera organization.

```bash
cd ~/Downloads/fieldagent-demos-setup/fa-demos-integration   # wherever you unzipped it
npm install
npx gitbook login
npx gitbook whoami
npx gitbook integration check .
npx gitbook integration publish .
```

`gitbook login` opens the browser to sign in; the CLI keeps the token in its own config. (The alternative is a personal access token from https://app.gitbook.com/account/developer and `npx gitbook auth --token=<token>`; never paste a token into a chat or commit it.) `check` validates the manifest and builds the code — it passes as shipped. `publish` registers the integration under the Sentera organization, private, and ends by printing an **install link**.

Two things that can come back from `publish`: if it reports that the name `fieldagent-demo` is already taken by another integration, change `name:` in `gitbook-manifest.yaml` (for example `sentera-fieldagent-demo`) and publish again — the code-fence language `fieldagent-demo` under `markdown.codeblock` can stay as it is; and if it complains about the organization, sign out and back in with the account that administers Sentera.

Re-run `npx gitbook integration publish .` after any later change to the integration. `npx gitbook integration dev .` proxies the installed integration to your machine for live development, once it is published and installed.

## Part 3 — Install it on the FieldAgent space

1. Open the install link from the `publish` output. Choose the Sentera organization. Install it on the **FieldAgent** space (the Web & Desktop space); the integration is `target: space`, so it is installed per space. The same integration can also be reached from the GitBook app: open the space, then Integrations, where private integrations of your organization are listed.
2. After installation the space settings form for the integration shows one field, **Demo host**. Leave the default (the GitHub Pages address) or enter the address from Part 1, without a trailing slash. Save.
3. In the editor, type `/` on an empty line and look for **FieldAgent demo**. Insert it: the demo picker, a live frame and the *Use this demo* button appear. Pick *Compare zones with zone statistics*, press *Use this demo*, reload the page — the block should keep the choice.
4. Paste `https://michael-bohman.github.io/fieldagent-demo/demo.html?s=zones&mode=page` on an empty line: it should turn into the block.

If a frame stays blank while the same URL opens fine in a tab, the host is refusing to be framed; GitHub Pages does not do that, so this would point at a wrong address in *Demo host*.

## Part 4 — Put demos on the pages

Install the integration (Part 3) before merging Markdown that contains demo blocks. Git Sync turns a fenced block whose language is `fieldagent-demo` into the block only when the integration is installed on the space; otherwise it stays a plain code block until the file is next changed.

Under the page's lead paragraph, before the first heading, write the block and the full-size link:

````markdown
```fieldagent-demo
zones
```

<a href="https://michael-bohman.github.io/fieldagent-demo/demo.html?s=zones&mode=page" class="button secondary">Open this demo full size</a>
````

The body of the fence is the demo id. The full-size link is option C: it works on phones, in the GitBook mobile layout, and if the frame ever fails. A plain Markdown link is fine too; the button form is GitBook's own syntax for its Buttons block and survives Git Sync.

| Page (in `fieldagent/`) | Demo id |
| --- | --- |
| get-started/tour-of-fieldagent-web.md | `field-view` |
| fields/find-a-field.md | `find-a-field` |
| view/map-layers.md | `map-layers` |
| view/colorization-and-visualization.md | `colorization` |
| analytics/crop-health-mosaics.md | `compare-dates` |
| view/zones-and-zone-statistics.md | `zones` |
| analytics/satellite-imagery.md | `satellite` |
| view/photo-dots-and-image-viewer.md | `photo-dots` |
| ordering/order-a-mosaic.md | `order-mosaic` |
| imagery/import-imagery-in-fieldagent-web.md | `import-imagery` |
| exports/create-a-report.md | `report` |
| exports/download-and-export-data.md | `download-data` |
| analytics/elevation-mosaic.md | `elevation` |
| imagery/quicktiles-and-mosaics.md | `quicktile` |
| fields/edit-or-delete-a-field.md | `edit-field` |
| fields/crop-seasons-and-field-activities.md | `crop-season` |
| fields/share-a-field.md | `share-field` |
| ordering/order-analytics.md | `order-analytics` |
| analytics/stand-count.md | `stand-count` (field f3, Sentera Demo Account) |
| analytics/tassel-count.md | `tassel-count` (field f4, the same field flown after tasseling) |
| analytics/elevation-and-hydrology.md (new page) | `hydrology` (field f5) |
| fields/create-a-field.md | `create-field` |

Verify with one page first: put the block on a branch, open the pull request, and look at the GitBook preview — the frame should render at 16:10 and *Show me* should drive the copy of FieldAgent. While you are there, run the two-minute test from the report for the record: add `{% embed url="https://michael-bohman.github.io/fieldagent-demo/demo.html?s=zones&mode=embed" %}` on a scratch page and see whether GitBook shows a frame or a link card. If it shows a frame, plain embeds would do and the integration becomes optional; the expectation is a card.

## Part 5 — Day-to-day

- **When the documentation moves to its final address** (for example from `/fieldagent-documentation-updates` to `/fieldagent`): change the one `SPACE` constant at the top of `scenarios.js`, commit, push. Every *Back to the guide* and finish-card link in the demos follows it; the pages themselves need nothing, since their links are relative.
- **Change a demo's steps or add a demo:** edit `scenarios.js` in the site repository, commit, push. Pages redeploys in about a minute; no build step is needed because `demo.html` loads `scenarios.js` directly. Add the new id to `DEMOS` in `fa-demos-integration/src/index.tsx` so it appears in the editor's picker, and republish the integration.
- **Change the shell (`demo.template.html`) or regenerate the engine:** run `python3 tools/build.py` (and `python3 tools/patch_engine.py` first if the engine source changed) from the repository root, then commit. The build also writes a single-file preview to `build/` (ignored by Git).
- **Test everything:** `python3 -m http.server 8765` in the repository root and `node tools/pw_tour.js map-layers zones …` in a second Terminal (`npm i playwright` and `npx playwright install chromium` once). The walker waits for each step to advance and prints how long it took; `FA_SPEED=4` runs the paced tour faster, `FA_SHOTS=1` saves a screenshot per step to `build/shots/`.
- **Pacing:** *Show me* is animated and paced (pointer, hover, click ripple, dragged sliders, typed text, a 1.2 s pause on the finished step). To check a page quickly, add `&speed=2` (or `speed=4`) to the demo URL; `speed=0.5` slows it down. The timings are the `PACE` table at the top of `fa-tour.js`; change them there and push — no build needed. *Play all* in the card's top-right corner runs a whole demo hands-free.
- **The block caches its rendered output for an hour** (`setCache` in `src/index.tsx`); the demo inside the frame is always live from GitHub Pages.
- **Analytics later:** the demo page calls `window.FA_ANALYTICS(name, detail)` for `demo_started`, `demo_step`, `demo_finished`, `demo_restarted`, `demo_autoplay` and the engine's own events, so a page-view tool can be attached without touching the tour.

## Part 6 — Adding a field from the Sentera Demo Account

The stand-count field (`f3`) was built from what FieldAgent Web itself hands out, without touching its API. The same
recipe works for the other demo-account fields (Tassel Count, Elevation and Hydrology, the Farm Progress Show field):

1. **Geometry.** Zones card → ⋯ → *Download as GeoJSON* with every zone ticked in the Zones layer view: one file with
   the field boundary and each zone (name, acres). `tools/capture/build_f3.py` reads it.
2. **Rasters.** Open the layer, *Download Files → TIF*. `tools/capture/georaster.py <tif> <boundary.geojson> <prefix>
   --gray lo hi` warps it to a Web Mercator PNG on the field's bounding box (values lo…hi → 0…255) plus a nodata mask;
   the value range goes into the survey's `ranges` in `fa-data.js`.
3. **Sample points.** Individual layer → *Download Files → GeoJSON* (and CSV). The export order is the viewer's order
   (`18 / 41` is feature 18). Properties used: `Plant Density (per acre)`, `Emergence (%)`, `RowSpacing` (cm → in),
   `ImageName`.
4. **Sample photos.** Open a sample, capture the image area of ANNOTATION and ANNOTATION 2 (the +/− buttons were
   painted out from neighbouring pixels), name them `ph_<field>_<survey>_<n>_a1|a2.jpg`.
5. **Basemaps.** Collapse the panel, hide every layer, and capture the map at several zoom levels as 2× zoomed
   regions of the overlay-free part of the map (x 200–1150 of a 1512-wide window). `tools/capture/basemaps.py`
   stitches the tiles and georeferences each level: from the cyan boundary where it is large, otherwise from the
   scale bar (`.mapboxgl-ctrl-scale` width and text) and the point under the cursor, which wheel zoom keeps fixed.
   Every other level is enough (the engine draws the finest basemap that touches the view on top of the coarser ones);
   include one level wide enough to hold every field of the demo for the Fields overview.
6. **Data.** `build_f3.py` / `build_f4.py` / `build_f5.py` write the fields into `data/fa-data.js` and copies the images into `img/`; a field's survey
   carries `analytics: [{ id, kind: 'raster' | 'samples' | 'features', name, viz, range, props, points, features, geom, style, opacity }]`, and the engine lists them under
   the survey in Add Map Layers. Then `python3 tools/build.py`, `node tools/pw_standcount.js` for a check, commit,
   push.

Reference values printed by FieldAgent Web for each layer (averages, zone minimum/maximum) are kept in the field's
`refStats` so a rebuild can be checked against them.
