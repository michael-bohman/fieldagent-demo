/* ---------------------------------------------------------------------------
   FieldAgent guided demos — tour layer.
   Sits on top of the FieldAgentDemo engine (fa-engine.js). A scenario is a list of steps; each step names the
   control the reader should use (a CSS selector inside the demo), the engine event that proves they did it,
   and optionally how "Show me" performs the step for them. The engine is untouched: the tour only reads the
   DOM the engine renders, highlights the target, and listens to the events the engine already emits.

   "Show me" is paced so a reader can follow it: a pointer glides from the button to the control, pauses on it,
   presses (a ripple marks the click), sliders are dragged rather than set, text is typed, menus stay open for a
   beat before the option is chosen, and the finished action stays on screen before the next step card appears.
   Custom steps get the same primitives through the `bot` argument: showMe(app, root, bot) may return a promise.

   FieldAgentTour.start(app, scenario, { docsBase, framed, onEvent }) → controller
   FieldAgentTour.speed — 1 = normal; 2 = twice as fast; 0.5 = half speed (every wait scales)
--------------------------------------------------------------------------- */
window.FieldAgentTour = (function () {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ICON = {
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11 17h2v-6h-2v6zm1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 9h2V7h-2v2z"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>',
    playall: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 6h2v12H4zm4 0 10 6-10 6z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
    restart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>',
    open: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>',
    book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg>',
    cursor: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3v16.6l4.5-4.1 3 6.8 3.4-1.5-3-6.6h6.6z"/></svg>',
  };

  // ---- pacing: every wait in a Show me is one of these (ms at speed 1) ----
  const PACE = {
    travel: 560, travelMin: 300, travelMax: 820,  // pointer glide, scaled by distance (travel ≈ 420 px)
    hover: 480,          // pause on the control before pressing
    press: 190,          // press-down before the click fires
    release: 280,        // the pointer stays on the control after the click
    reveal: 380,         // pause after hovering a row reveals its hidden buttons (eye, ×)
    menu: 760,           // an opened menu is shown for this long before the option is chosen
    slider: 1100, sliderMin: 620,   // slider drag for a full-range travel, scaled by distance
    key: 62,             // per typed character
    gap: 420,            // between two parts of one Show me (second field, next ear…)
    settle: 1200,        // the finished action stays on screen before the next step card appears
    settleManual: 700,   // … when the reader did the step themselves
    read: 1500, readPerChar: 24, readMax: 5200,   // Play all: time to read a card before its action runs
  };
  const api = { start, speed: 1, PACE };
  const ms = v => api.speed > 0 ? Math.max(0, Math.round(v / api.speed)) : 0;
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const CANCEL = Symbol('fa-tour-cancelled');
  const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  function start(app, scenario, options = {}) {
    const root = app.root; const panel = app.panel; const mapEl = root.querySelector('.map');
    const docsBase = options.docsBase || 'https://support.senterasensors.com';
    const framed = !!options.framed;
    const steps = scenario.steps || [];
    let i = 0, finished = false, done = new Set(), raf = 0, scrolledFor = -1, destroyed = false, rendered = -1, viewKey = null, photoOpen = !!app.state.photo, overlay = root.querySelector('.x-overlay');
    const modalEl = root.querySelector('[data-role="modal"]');
    let run = null;            // the active Show me: { tok, promise }
    let showing = false;       // a Show me ran for the current step (longer settle than a manual action)
    let autoplay = false, autoT = 0;
    let ptrHideT = 0, px = 0, py = 0;

    // ---- DOM ----
    const card = document.createElement('div'); card.className = 'fa-tour'; card.setAttribute('role', 'region'); card.setAttribute('aria-label', 'Guided demo'); card.setAttribute('aria-live', 'polite');
    const spot = document.createElement('div'); spot.className = 'fa-tour-spot'; spot.hidden = true;
    const badge = document.createElement('div'); badge.className = 'fa-tour-badge'; badge.textContent = 'Interactive demo';
    const ptr = document.createElement('div'); ptr.className = 'fa-tour-ptr'; ptr.setAttribute('aria-hidden', 'true'); ptr.innerHTML = ICON.cursor;
    mapEl.appendChild(card); root.appendChild(spot); root.appendChild(ptr); mapEl.appendChild(badge);

    const cur = () => steps[i];
    const find = t => typeof t === 'string' ? root.querySelector(t) : typeof t === 'function' ? (t(app, root) || null) : t || null;
    const targetEl = step => step && step.target ? find(step.target) : null;
    const highlightEl = step => {
      if (!step) return null;
      if (step.highlight) return root.querySelector(step.highlight) || targetEl(step);
      return targetEl(step);
    };
    const rootRect = () => root.getBoundingClientRect();

    function docsLink(link) {
      const path = link.path || '';
      if (/^https?:/.test(path)) return `<a class="fa-tour-link" href="${esc(path)}" target="_blank" rel="noopener">${ICON.open}${esc(link.label)}</a>`;
      if (framed) return `<button type="button" class="fa-tour-link" data-tour="nav" data-path="${esc(path)}">${ICON.book}${esc(link.label)}</button>`;
      return `<a class="fa-tour-link" href="${esc(docsBase + path)}" target="_blank" rel="noopener">${ICON.book}${esc(link.label)}</a>`;
    }

    function render() {
      if (destroyed) return;
      const s = cur();
      const swap = rendered !== i || finished; rendered = finished ? -2 : i;
      card.classList.remove('busy', 'stepdone');
      if (!steps.length) {
        card.innerHTML = `<div class="fa-tour-head"><span class="fa-tour-kicker">Try it</span><span class="fa-tour-title">${esc(scenario.title)}</span></div>
          <div class="fa-tour-text">${scenario.intro || ''}</div>
          ${(scenario.finish && scenario.finish.links || []).length ? `<div class="fa-tour-links">${scenario.finish.links.map(docsLink).join('')}</div>` : ''}
          <button type="button" class="fa-tour-x" data-tour="hide" aria-label="Hide">×</button>`;
        card.classList.remove('done');
        return;
      }
      if (finished) {
        const f = scenario.finish || {};
        card.classList.add('done');
        card.innerHTML = `<div class="fa-tour-head"><span class="fa-tour-kicker">${ICON.check} Done</span><span class="fa-tour-title">${esc(scenario.title)}</span></div>
          <div class="fa-tour-text">${f.text || 'That is the whole workflow. Keep exploring the demo, or go back to the guide.'}</div>
          ${(f.links || []).length ? `<div class="fa-tour-links">${f.links.map(docsLink).join('')}</div>` : ''}
          <div class="fa-tour-actions"><button type="button" class="fa-tour-btn ghost" data-tour="restart">${ICON.restart}Start again</button><button type="button" class="fa-tour-btn ghost" data-tour="replay">${ICON.playall}Play it again</button></div>
          <button type="button" class="fa-tour-x" data-tour="hide" aria-label="Hide">×</button>`;
        if (swap) animateIn();
        return;
      }
      card.classList.remove('done');
      const canShow = s.showMe !== false && (s.target || s.demo);
      const playable = steps.length > 1 && steps.some(st => st.showMe !== false && (st.target || st.demo || st.info));
      card.innerHTML = `<div class="fa-tour-head${playable && !autoplay ? ' has-play' : ''}"><span class="fa-tour-kicker">Step ${i + 1} of ${steps.length}</span><span class="fa-tour-title">${esc(scenario.title)}</span></div>
        <div class="fa-tour-progress" aria-hidden="true">${steps.map((_, k) => `<i class="${k < i ? 'past' : k === i ? 'now' : ''}"></i>`).join('')}</div>
        <div class="fa-tour-text">${s.text}</div>
        ${s.note ? `<div class="fa-tour-note">${ICON.info}<span>${s.note}</span></div>` : ''}
        <div class="fa-tour-actions">
          ${autoplay ? `<button type="button" class="fa-tour-btn primary" data-tour="pause">${ICON.pause}Pause</button>` : s.info ? `<button type="button" class="fa-tour-btn primary" data-tour="next">Next</button>` : canShow ? `<button type="button" class="fa-tour-btn primary" data-tour="showme"><span class="lbl">${ICON.play}Show me</span><span class="lbl-busy">Showing…</span></button>` : ''}
          ${!s.info && !autoplay ? `<button type="button" class="fa-tour-btn ghost" data-tour="skip">Skip step</button>` : ''}
          ${i > 0 && !autoplay ? `<button type="button" class="fa-tour-btn ghost" data-tour="restart" aria-label="Start again">${ICON.restart}</button>` : ''}
        </div>
        ${playable && !autoplay ? `<button type="button" class="fa-tour-play" data-tour="playall" title="Run every remaining step for me">${ICON.playall}Play all</button>` : ''}
        <button type="button" class="fa-tour-x" data-tour="hide" aria-label="Hide">×</button>`;
      scrolledFor = -1;
      if (swap) animateIn();
      if (autoplay) scheduleAuto();
    }
    function animateIn() { if (reduced()) return; card.classList.remove('swap'); void card.offsetWidth; card.classList.add('swap'); }

    // ---- spotlight follows the target every frame (the engine re-renders the panel often) ----
    function frame() {
      if (destroyed) return;
      raf = requestAnimationFrame(frame);
      root.classList.toggle('tour-modal', !!app.state.photo); root.classList.toggle('tour-dialog', !!root.querySelector('.x-overlay'));
      // a new panel view slides in, and a viewer or dialog pops in (the engine swaps their HTML in one go)
      const vk = app.state.view + '|' + app.state.detailUid;
      if (viewKey !== null && vk !== viewKey && !reduced()) { panel.classList.remove('fa-view-in'); void panel.offsetWidth; panel.classList.add('fa-view-in'); setTimeout(() => panel.classList.remove('fa-view-in'), 420); }
      viewKey = vk;
      const ph = !!app.state.photo; if (ph && !photoOpen && modalEl) { modalEl.classList.add('fa-modal-in'); setTimeout(() => modalEl.classList.remove('fa-modal-in'), 480); } photoOpen = ph;
      const ov = root.querySelector('.x-overlay'); if (ov && ov !== overlay) { ov.classList.add('fa-modal-in'); setTimeout(() => ov.classList.remove('fa-modal-in'), 480); } overlay = ov;
      const s = cur();
      if (finished || !s || !steps.length || card.classList.contains('hidden')) { spot.hidden = true; return; }
      const el = highlightEl(s);
      if (!el || (el.offsetParent === null && !el.closest('.row-actions'))) { spot.hidden = true; return; }
      const rr = rootRect(); let r = el.getBoundingClientRect();
      if (el.closest('.row-actions') && r.width === 0) { const row = el.closest('.layer-row'); if (row) r = row.getBoundingClientRect(); }
      // bring the target into view once per step (before clipping, or an off-screen target would never scroll)
      const sc = el.closest('.panel-scroll, .photo-side');
      if (scrolledFor !== i && sc) { scrolledFor = i; try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { el.scrollIntoView(); } }
      // clip to the scroll container so the ring never floats outside the panel
      if (sc) { const cr = sc.getBoundingClientRect(); if (r.bottom < cr.top + 4 || r.top > cr.bottom - 4) { spot.hidden = true; return; } }
      spot.hidden = false;
      spot.style.left = (r.left - rr.left - 4) + 'px'; spot.style.top = (r.top - rr.top - 4) + 'px';
      spot.style.width = (r.width + 8) + 'px'; spot.style.height = (r.height + 8) + 'px';
      spot.style.borderRadius = getComputedStyle(el).borderRadius === '50%' ? '50%' : '8px';
    }

    // ---- the demo pointer ----
    function setPtr(x, y) { px = x; py = y; ptr.style.transform = `translate3d(${x}px, ${y}px, 0)`; }
    const ptrDur = d => ptr.style.setProperty('--fa-ptr-dur', d + 'ms');
    function ptrShowAt(x, y) { clearTimeout(ptrHideT); ptrDur(0); setPtr(x, y); void ptr.offsetWidth; ptr.classList.add('show'); }
    function hidePtr() { clearTimeout(ptrHideT); ptr.classList.remove('show', 'press', 'grab'); hoverOff(); }
    function schedulePtrHide(delay) { clearTimeout(ptrHideT); ptrHideT = setTimeout(hidePtr, delay); }
    const sleep = (t, tok) => new Promise((res, rej) => setTimeout(() => tok.ok ? res() : rej(CANCEL), t));
    const wait = (v, tok) => sleep(ms(v), tok);
    async function ptrMove(x, y, tok) {
      if (!tok.ok) throw CANCEL;
      const d = Math.hypot(x - px, y - py);
      const dur = reduced() ? 0 : ms(Math.min(PACE.travelMax, Math.max(PACE.travelMin, PACE.travel * Math.min(1.5, d / 420))));
      ptrDur(dur); setPtr(x, y); await sleep(dur + 20, tok);
    }
    function ripple(x, y) { const rp = document.createElement('i'); rp.className = 'fa-tour-rip'; rp.style.left = x + 'px'; rp.style.top = y + 'px'; root.appendChild(rp); setTimeout(() => rp.remove(), 700); }
    function hoverOn(el) { el.classList.add('fa-tour-hover'); const row = el.closest('.layer-row, .field-row'); if (row) row.classList.add('fa-tour-hover'); }
    function hoverOff() { root.querySelectorAll('.fa-tour-hover').forEach(e => e.classList.remove('fa-tour-hover')); }
    // where on the element the pointer lands: rows on their name, text fields at their start, everything else in the middle
    function aim(el, where) {
      const r = el.getBoundingClientRect(), rr = rootRect(); let x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (where === 'left' || el.matches('input:not([type=range]):not([type=checkbox]), textarea')) x = r.left + Math.min(r.width / 2, 44);
      else if (el.matches('.layer-row, .field-row, .opt')) x = r.left + Math.min(r.width * 0.45, 150);
      return [x - rr.left, y - rr.top];
    }
    // scroll a control into view inside its panel or menu and give the scroll time to finish
    async function reveal(el, tok) {
      const sc = el.closest('.panel-scroll, .photo-side, .menu'); if (!sc) return;
      const r = el.getBoundingClientRect(), c = sc.getBoundingClientRect();
      if (r.top >= c.top + 6 && r.bottom <= c.bottom - 6) return;
      try { el.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }); } catch (e) { el.scrollIntoView(); }
      await sleep(reduced() ? 40 : ms(440), tok);
    }
    async function pressAt(x, y, tok, fn) {
      ptr.classList.add('press'); await wait(PACE.press, tok);
      ripple(x, y); if (fn) fn();
      await sleep(Math.min(140, ms(140)), tok); ptr.classList.remove('press');
    }

    // the primitives a Show me is made of; custom steps receive them as `bot`
    function makeBot(tok) {
      const bot = {
        cancelled: () => !tok.ok,
        find,
        wait: v => wait(v, tok),
        // move to a control, pause, press it. Hidden row buttons (eye, ×) are revealed by hovering the row first.
        async click(target, o = {}) {
          const el = find(target); if (!el) return false;
          const row = el.closest('.layer-row');
          if (row && el.closest('.row-actions')) { await reveal(row, tok); await ptrMove(...aim(row), tok); hoverOn(row); await wait(PACE.reveal, tok); }
          else await reveal(el, tok);
          const [x, y] = aim(el, o.at); await ptrMove(x, y, tok); hoverOn(el); await wait(o.hover != null ? o.hover : PACE.hover, tok);
          await pressAt(x, y, tok, () => { if (o.click === false) return; const live = root.contains(el) ? el : typeof target === 'string' ? find(target) : null; if (live) live.click(); });
          hoverOff(); await wait(o.release != null ? o.release : PACE.release, tok);
          return true;
        },
        // open a select, leave it open long enough to read, then choose the option
        async pick(menuSel, optSel) {
          if (!await bot.click(menuSel, { release: 0 })) return false;
          await wait(PACE.menu, tok);
          const opt = find(optSel); if (!opt) return false;
          return bot.click(opt, { hover: PACE.hover * 0.8 });
        },
        // click into a field and type its text one character at a time (date and time fields are set in one go)
        async type(target, text) {
          const sel = typeof target === 'string' ? target : null; let el = find(target); if (!el) return false;
          await reveal(el, tok); const [x, y] = aim(el, 'left'); await ptrMove(x, y, tok); hoverOn(el); await wait(PACE.hover * 0.45, tok);
          await pressAt(x, y, tok, () => el.focus()); hoverOff();
          ptrDur(ms(220)); setPtr(x + 34, y + 16);   // step aside so the text stays readable
          const whole = /^(date|time|month|week|datetime-local|color)$/.test(el.type || '');
          if (whole || reduced()) { el.value = String(text); fire(el, 'input'); fire(el, 'change'); await wait(PACE.gap * 0.6, tok); return true; }
          const str = String(text); el.value = '';
          for (let k = 1; k <= str.length; k++) {
            if (!root.contains(el)) { if (!sel) return false; el = root.querySelector(sel); if (!el) return false; el.focus(); }
            el.value = str.slice(0, k); fire(el, 'input');
            await wait(PACE.key + (k % 4 === 0 ? 30 : 0), tok);
          }
          if (root.contains(el)) fire(el, 'change');
          await wait(PACE.gap * 0.4, tok); return true;
        },
        // drag a range input to a value: the pointer grabs the thumb and moves with it while the engine updates live
        async slide(target, value) {
          const sel = typeof target === 'string' ? target : null; let el = find(target); if (!el) return false;
          await reveal(el, tok);
          const min = parseFloat(el.min) || 0, max = isNaN(parseFloat(el.max)) ? 100 : parseFloat(el.max), from = parseFloat(el.value);
          const to = Math.min(max, Math.max(min, parseFloat(value)));
          const thumb = (e, v) => { const r = e.getBoundingClientRect(), rr = rootRect(); const pad = 7; const f = (v - min) / (max - min || 1); return [r.left - rr.left + pad + f * (r.width - 2 * pad), r.top - rr.top + r.height / 2]; };
          const [x0, y0] = thumb(el, from); await ptrMove(x0, y0, tok); hoverOn(el); await wait(PACE.hover, tok);
          ptr.classList.add('grab'); await wait(150, tok);
          const dur = reduced() ? 0 : ms(Math.max(PACE.sliderMin, PACE.slider * Math.abs(to - from) / (max - min || 1)));
          ptrDur(0);
          const t0 = performance.now();
          await new Promise((res, rej) => {
            const tick = now => {
              if (!tok.ok) return rej(CANCEL);
              if (!root.contains(el)) { el = sel ? root.querySelector(sel) : null; if (!el) return res(); }
              const t = dur ? Math.min(1, (now - t0) / dur) : 1;
              el.value = from + (to - from) * ease(t); fire(el, 'input');
              const [nx, ny] = thumb(el, parseFloat(el.value)); setPtr(nx, ny);
              if (t < 1) requestAnimationFrame(tick); else res();
            };
            requestAnimationFrame(tick);
          });
          if (root.contains(el)) { el.value = to; fire(el, 'input'); fire(el, 'change'); const [nx, ny] = thumb(el, parseFloat(el.value)); setPtr(nx, ny); }
          ptr.classList.remove('grab'); hoverOff(); await wait(PACE.release, tok); return true;
        },
        // click a sample bubble on the map: the pointer goes to the bubble, presses, and the viewer opens
        async sample(uid, idx) {
          const L = app.layers().find(l => l.uid === uid); if (!L) return false;
          const pt = (app.ui.samplePoints(L) || [])[idx]; if (!pt) return false;
          const mr = mapEl.getBoundingClientRect(), rr = rootRect(); const [sx, sy] = app.ui.toScreen(pt.w[0], pt.w[1]);
          const x = mr.left - rr.left + sx, y = mr.top - rr.top + sy;
          const hit = document.elementFromPoint(mr.left + sx, mr.top + sy);
          const visible = sx > 10 && sy > 10 && sx < mr.width - 10 && sy < mr.height - 10 && hit && mapEl.contains(hit) && !hit.closest('.fa-tour, .fa-tour-badge');
          if (visible) { await ptrMove(x, y, tok); await wait(PACE.hover, tok); await pressAt(x, y, tok, () => app.openSample(uid, idx)); }
          else app.openSample(uid, idx);
          await wait(PACE.release, tok); return true;
        },
      };
      return bot;
    }

    async function runStep(s, bot) {
      if (typeof s.showMe === 'function') { await s.showMe(app, root, bot); return; }
      const el = targetEl(s);
      if (!el) { app.toast('That control is not on the screen right now. Use the back arrow to return to the field view.'); return; }
      if (el.matches('input[type=range]')) { await bot.slide(typeof s.target === 'string' ? s.target : el, s.demo && s.demo.value != null ? s.demo.value : el.max); return; }
      if (el.matches('input, textarea') && s.demo && s.demo.text != null) { await bot.type(typeof s.target === 'string' ? s.target : el, s.demo.text); return; }
      await bot.click(el);
    }

    function cancelRun() { if (run) { run.tok.ok = false; run = null; } ptr.classList.remove('press', 'grab'); hoverOff(); card.classList.remove('busy'); }
    function showMe(fromEl) {
      const s = cur(); if (!s || finished) return Promise.resolve();
      cancelRun(); showing = true;
      const tok = { ok: true }; const bot = makeBot(tok);
      // the pointer sets off from the button the reader pressed
      if (!ptr.classList.contains('show')) {
        const b = fromEl || card.querySelector('[data-tour="showme"], [data-tour="pause"]'); const rr = rootRect();
        if (b) { const r = b.getBoundingClientRect(); ptrShowAt(r.left - rr.left + r.width / 2, r.top - rr.top + r.height / 2); }
        else { const r = card.getBoundingClientRect(); ptrShowAt(r.left - rr.left + r.width / 2, r.top - rr.top + 20); }
      } else clearTimeout(ptrHideT);
      card.classList.add('busy'); const idx = i;
      const p = (async () => { await wait(90, tok); await runStep(s, bot); })()
        .catch(e => { if (e !== CANCEL) console.warn('[fa-tour] Show me failed', e); })
        .then(() => { if (run && run.tok === tok) { run = null; if (!done.has(idx)) card.classList.remove('busy'); schedulePtrHide(ms(PACE.settle) + 900); } });   // the button stays "Showing…" through the settle pause when the step is done
      run = { tok, promise: p };
      return p;
    }

    function markDone() {
      card.classList.add('stepdone');
      const k = card.querySelector('.fa-tour-kicker'); if (k) k.innerHTML = `${ICON.check} Step ${i + 1} done`;
      const now = card.querySelector('.fa-tour-progress .now'); if (now) { now.classList.remove('now'); now.classList.add('past', 'pop'); }
      spot.classList.add('ok');
    }
    function advance(delay) {
      const idx = i; if (done.has(idx)) return; done.add(idx);
      const go = () => {
        if (destroyed || i !== idx) return;
        const d = delay != null ? delay : ms(showing ? PACE.settle : PACE.settleManual);
        if (d > 0) markDone();
        setTimeout(() => {
          if (destroyed || i !== idx) return;
          spot.classList.remove('ok'); showing = false; hidePtr();
          i++; if (i >= steps.length) { finished = true; autoplay = false; emitOut('demo_finished', { scenario: scenario.id }); } else emitOut('demo_step', { scenario: scenario.id, step: i + 1 });
          render();
        }, d);
      };
      if (run) run.promise.then(go); else go();
    }

    // ---- Play all: read the card, run its Show me, and so on to the end ----
    function scheduleAuto() {
      clearTimeout(autoT); const s = cur(); if (!autoplay || finished || !s) return;
      const text = (s.text || '').replace(/<[^>]+>/g, ''); const t = ms(Math.min(PACE.readMax, PACE.read + PACE.readPerChar * text.length));
      autoT = setTimeout(() => {
        if (!autoplay || finished || cur() !== s) return;
        if (s.info || s.showMe === false || !(s.target || s.demo)) { done.delete(i); advance(ms(PACE.settleManual)); return; }
        showMe().then(() => { if (autoplay && cur() === s && !done.has(i)) setTimeout(() => { if (autoplay && cur() === s && !done.has(i)) { done.delete(i); advance(ms(PACE.settleManual)); } }, ms(1600)); });   // the action did not produce the step's event: move on anyway
      }, t);
    }
    function playAll(from0) { if (from0) { i = 0; finished = false; done = new Set(); resetDemo(); } autoplay = true; render(); emitOut('demo_autoplay', { scenario: scenario.id, step: i + 1 }); }
    function pauseAll() { autoplay = false; clearTimeout(autoT); cancelRun(); hidePtr(); render(); }

    function onEvent(name, detail) {
      emitOut(name, detail);
      const s = cur(); if (!s || finished) return;
      const want = s.event; if (!want) return;
      const names = Array.isArray(want) ? want : [want];
      if (!names.includes(name)) return;
      if (typeof s.match === 'function' && !s.match(detail || {}, app)) return;
      advance(s.delay != null ? s.delay : undefined);
    }
    function emitOut(name, detail) { try { if (typeof options.onEvent === 'function') options.onEvent(name, detail || {}); } catch (e) { /* never break the demo */ } }

    // steps without an engine event advance when the target is clicked
    root.addEventListener('click', e => {
      const s = cur(); if (!s || finished || s.event || s.info) return;
      const t = typeof s.target === 'string' ? e.target.closest(s.target) : null; if (t) advance();
    }, true);

    card.addEventListener('click', e => {
      const b = e.target.closest('[data-tour]'); if (!b) return; const a = b.dataset.tour;
      if (a === 'showme') { if (!run) showMe(b); }
      else if (a === 'next' || a === 'skip') { cancelRun(); hidePtr(); done.delete(i); advance(0); }
      else if (a === 'restart') restart();
      else if (a === 'playall') playAll(false);
      else if (a === 'replay') playAll(true);
      else if (a === 'pause') pauseAll();
      else if (a === 'hide') { if (autoplay) pauseAll(); card.classList.add('hidden'); badge.classList.add('show'); }
      else if (a === 'nav') { if (framed) window.parent.postMessage({ action: { action: '@webframe.navigate', path: b.dataset.path } }, '*'); else window.open(docsBase + b.dataset.path, '_blank', 'noopener'); }
    });
    badge.addEventListener('click', () => { card.classList.remove('hidden'); badge.classList.remove('show'); });

    function resetDemo() { if (typeof scenario.reset === 'function') scenario.reset(app); else defaultReset(); }
    function restart() {
      autoplay = false; clearTimeout(autoT); cancelRun(); hidePtr(); spot.classList.remove('ok');
      i = 0; finished = false; done = new Set(); showing = false; resetDemo(); render(); emitOut('demo_restarted', { scenario: scenario.id });
    }
    function defaultReset() {
      const fid = scenario.field || app.state.fid;
      app.state.seeded[fid] = false; app.state.layersByField[fid] = []; app.state.zonesOn[fid] = []; app.state.sources = { surveys: true, satellite: false }; app.state.photo = null; if (app.ext) app.ext.reset(fid);
      app.openField(fid, false); if (typeof scenario.setup === 'function') scenario.setup(app);
    }

    // ---- boot ----
    if (typeof scenario.setup === 'function') scenario.setup(app);
    render(); raf = requestAnimationFrame(frame);
    emitOut('demo_started', { scenario: scenario.id });
    return {
      next: () => { cancelRun(); done.delete(i); advance(0); }, restart, showMe: () => showMe(), playAll: () => playAll(false), pause: pauseAll, onEvent,
      destroy() { destroyed = true; autoplay = false; clearTimeout(autoT); cancelRun(); cancelAnimationFrame(raf); card.remove(); spot.remove(); ptr.remove(); badge.remove(); root.querySelectorAll('.fa-tour-rip').forEach(r => r.remove()); },
      get step() { return i; }, get finished() { return finished; }, get busy() { return !!run; }, get autoplay() { return autoplay; },
    };
  }

  return api;
})();
