# FieldAgent guided demos — update package 8 (support-site links) — includes package 7 (paced Show me)

Package 8 changes only the addresses the demos link back to. The documentation now lives at
`https://support.senterasensors.com/fieldagent-documentation-updates`, and GitBook builds each page's URL from the
SUMMARY.md group heading plus the file name (`## View and analyze` + `view/map-layers.md` →
`/view-and-analyze/map-layers`), so the demos' *Back to the guide* link and the finish-card links now use
`/fieldagent-documentation-updates/<group>/<page>` for all 27 pages they point at (checked against the site's page
list). The space path is one constant, `SPACE`, at the top of `scenarios.js` — change it there when the content
moves to its final address. Files changed since package 7: `scenarios.js`, `demo.html` (from `demo.template.html`),
`index.html`, `README.md`, `tools/build.py`, and this README + SETUP.md. The pages in the docs repository need no
change: their links are relative and GitBook resolves them.

Package 7 (also in this zip):

- `fieldagent-demos/` — the complete contents of the `fieldagent-demo` GitHub Pages repository. Copy everything inside
  it over your local `fieldagent-demo` folder (replace files), commit, push. New in this version:
  - **Show me is slow enough to follow.** A pointer glides from the button to the control, rests on it with
    FieldAgent's hover state, presses (a ripple marks the click) and stays a moment. Menus stay open before the option
    is chosen; sliders are dragged with the map, histogram and caption updating as the thumb moves; text is typed a
    character at a time; the eye and × of a layer row are revealed by hovering the row first; a sample bubble on the map
    is pointed at before its viewer opens. When the step is done the card shows *Step N done* and the spotlight turns
    solid, and the result stays on screen for 1.2 s before the next card fades in. A simple click step now takes about
    3 s from *Show me* to the next card, a menu pick about 5 s (before: everything happened within a third of a second).
  - **Transitions in the demo UI:** a new panel view slides in, the photo / sample viewer and the dialogs pop in, menus
    fade in, a layer fades onto the map when it is added or shown again, the spotlight ring glides from one target to
    the next, and the step card fades in.
  - **Play all** (top-right of the card) runs every remaining step this way, with a reading pause before each one;
    *Pause* stops it. The finish card offers *Play it again*.
  - `?speed=2` on a demo URL runs everything twice as fast, `?speed=0.5` at half speed — handy for checking a page.
    The timings live in `PACE` at the top of `fa-tour.js`. `prefers-reduced-motion` keeps the pauses but drops the
    glides, ripples and slide-ins.
  - For demo authors: custom steps receive the paced primitives as a third argument, `showMe: async (app, root, bot)`
    — `bot.click`, `bot.pick`, `bot.type`, `bot.slide`, `bot.sample`, `bot.wait` — and the `pickMenu` / `typeInto`
    shorthands in `scenarios.js` use them. Two engine patches (132 now): the layer fade-in and `ui.toScreen` for
    pointing at map features.
  - `tools/pw_tour.js` waits for each step to advance instead of a fixed second (`FA_SPEED=4` to run faster,
    `FA_SHOTS=1` for screenshots); `tools/pw_frames.js` + `tools/sheet.py` record a Show me as a contact sheet.
  Changed files: `fa-tour.js`, `fa-tour.css`, `scenarios.js`, `fa-engine.js` (+ `tools/patch_engine.py`),
  `demo.template.html` → `demo.html`, `README.md`, `tools/pw_*.js`, `tools/pw_frames.js`, `tools/sheet.py`.
  No data or image changes since package 6.
- `fa-demos-integration/` — unchanged since package 6 (the 22-entry demo picker). Nothing to republish.
- `SETUP.md` — the setup guide (unchanged apart from the note on pacing and `?speed=` in Part 5).
