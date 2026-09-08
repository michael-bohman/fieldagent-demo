/* ---------------------------------------------------------------------------
   FieldAgent guided demos — tour layer.
   Sits on top of the FieldAgentDemo engine (fa-engine.js). A scenario is a list of steps; each step names the
   control the reader should use (a CSS selector inside the demo), the engine event that proves they did it,
   and optionally how "Show me" performs the step for them. The engine is untouched: the tour only reads the
   DOM the engine renders, highlights the target, and listens to the events the engine already emits.

   FieldAgentTour.start(app, scenario, { docsBase, framed, onFinish }) → controller
--------------------------------------------------------------------------- */
window.FieldAgentTour = (function () {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ICON = {
    info: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M11 17h2v-6h-2v6zm1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 9h2V7h-2v2z"/></svg>',
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>',
    restart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>',
    open: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>',
    book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/></svg>',
  };

  function start(app, scenario, options = {}) {
    const root = app.root; const panel = app.panel; const mapEl = root.querySelector('.map');
    const docsBase = options.docsBase || 'https://support.senterasensors.com';
    const framed = !!options.framed;
    const steps = scenario.steps || [];
    let i = 0, finished = false, done = new Set(), raf = 0, observer = null, scrolledFor = -1, destroyed = false;

    // ---- DOM ----
    const card = document.createElement('div'); card.className = 'fa-tour'; card.setAttribute('role', 'region'); card.setAttribute('aria-label', 'Guided demo'); card.setAttribute('aria-live', 'polite');
    const spot = document.createElement('div'); spot.className = 'fa-tour-spot'; spot.hidden = true;
    const badge = document.createElement('div'); badge.className = 'fa-tour-badge'; badge.textContent = 'Interactive demo';
    mapEl.appendChild(card); root.appendChild(spot); mapEl.appendChild(badge);

    const cur = () => steps[i];
    const targetEl = step => {
      if (!step || !step.target) return null;
      if (typeof step.target === 'function') return step.target(app, root) || null;
      return root.querySelector(step.target);
    };
    const highlightEl = step => {
      if (!step) return null;
      if (step.highlight) return root.querySelector(step.highlight) || targetEl(step);
      return targetEl(step);
    };

    function docsLink(link) {
      const path = link.path || '';
      if (/^https?:/.test(path)) return `<a class="fa-tour-link" href="${esc(path)}" target="_blank" rel="noopener">${ICON.open}${esc(link.label)}</a>`;
      if (framed) return `<button type="button" class="fa-tour-link" data-tour="nav" data-path="${esc(path)}">${ICON.book}${esc(link.label)}</button>`;
      return `<a class="fa-tour-link" href="${esc(docsBase + path)}" target="_blank" rel="noopener">${ICON.book}${esc(link.label)}</a>`;
    }

    function render() {
      if (destroyed) return;
      const s = cur();
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
          <div class="fa-tour-actions"><button type="button" class="fa-tour-btn ghost" data-tour="restart">${ICON.restart}Start again</button></div>
          <button type="button" class="fa-tour-x" data-tour="hide" aria-label="Hide">×</button>`;
        return;
      }
      card.classList.remove('done');
      const canShow = s.showMe !== false && (s.target || s.demo);
      card.innerHTML = `<div class="fa-tour-head"><span class="fa-tour-kicker">Step ${i + 1} of ${steps.length}</span><span class="fa-tour-title">${esc(scenario.title)}</span></div>
        <div class="fa-tour-progress" aria-hidden="true">${steps.map((_, k) => `<i class="${k < i ? 'past' : k === i ? 'now' : ''}"></i>`).join('')}</div>
        <div class="fa-tour-text">${s.text}</div>
        ${s.note ? `<div class="fa-tour-note">${ICON.info}<span>${s.note}</span></div>` : ''}
        <div class="fa-tour-actions">
          ${s.info ? `<button type="button" class="fa-tour-btn primary" data-tour="next">Next</button>` : canShow ? `<button type="button" class="fa-tour-btn primary" data-tour="showme">${ICON.play}Show me</button>` : ''}
          ${!s.info ? `<button type="button" class="fa-tour-btn ghost" data-tour="skip">Skip step</button>` : ''}
          ${i > 0 ? `<button type="button" class="fa-tour-btn ghost" data-tour="restart" aria-label="Start again">${ICON.restart}</button>` : ''}
        </div>
        <button type="button" class="fa-tour-x" data-tour="hide" aria-label="Hide">×</button>`;
      scrolledFor = -1;
    }

    // ---- spotlight follows the target every frame (the engine re-renders the panel often) ----
    function frame() {
      if (destroyed) return;
      raf = requestAnimationFrame(frame);
      root.classList.toggle('tour-modal', !!app.state.photo); root.classList.toggle('tour-dialog', !!root.querySelector('.x-overlay'));
      const s = cur();
      if (finished || !s || !steps.length || card.classList.contains('hidden')) { spot.hidden = true; return; }
      const el = highlightEl(s);
      if (!el || (el.offsetParent === null && !el.closest('.row-actions'))) { spot.hidden = true; return; }
      const rr = root.getBoundingClientRect(); let r = el.getBoundingClientRect();
      if (el.closest('.row-actions') && r.width === 0) { const row = el.closest('.layer-row'); if (row) r = row.getBoundingClientRect(); }
      // bring the target into view once per step (before clipping, or an off-screen target would never scroll)
      const sc = el.closest('.panel-scroll');
      if (scrolledFor !== i && sc) { scrolledFor = i; try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { el.scrollIntoView(); } }
      // clip to the scroll container so the ring never floats outside the panel
      if (sc) { const cr = sc.getBoundingClientRect(); if (r.bottom < cr.top + 4 || r.top > cr.bottom - 4) { spot.hidden = true; return; } }
      spot.hidden = false;
      spot.style.left = (r.left - rr.left - 4) + 'px'; spot.style.top = (r.top - rr.top - 4) + 'px';
      spot.style.width = (r.width + 8) + 'px'; spot.style.height = (r.height + 8) + 'px';
      spot.style.borderRadius = getComputedStyle(el).borderRadius === '50%' ? '50%' : '8px';
    }

    function advance(delay = 350) {
      const idx = i; if (done.has(idx)) return; done.add(idx);
      setTimeout(() => { if (destroyed || i !== idx) return; i++; if (i >= steps.length) { finished = true; emitOut('demo_finished', { scenario: scenario.id }); } else emitOut('demo_step', { scenario: scenario.id, step: i + 1 }); render(); }, delay);
    }

    function showMe() {
      const s = cur(); if (!s) return;
      if (typeof s.showMe === 'function') { s.showMe(app, root); return; }
      const el = targetEl(s);
      if (!el) { app.toast('That control is not on the screen right now. Use the back arrow to return to the field view.'); return; }
      if (el.matches('input[type=range]')) {
        const v = s.demo && s.demo.value != null ? s.demo.value : el.max; el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return;
      }
      if (el.matches('input, textarea') && s.demo && s.demo.text != null) { el.focus(); el.value = s.demo.text; el.dispatchEvent(new Event('input', { bubbles: true })); return; }
      el.click();
    }

    function onEvent(name, detail) {
      emitOut(name, detail);
      const s = cur(); if (!s || finished) return;
      const want = s.event; if (!want) return;
      const names = Array.isArray(want) ? want : [want];
      if (!names.includes(name)) return;
      if (typeof s.match === 'function' && !s.match(detail || {}, app)) return;
      advance(s.delay != null ? s.delay : 350);
    }
    function emitOut(name, detail) { try { if (typeof options.onEvent === 'function') options.onEvent(name, detail || {}); } catch (e) { /* never break the demo */ } }

    // steps without an engine event advance when the target is clicked
    root.addEventListener('click', e => {
      const s = cur(); if (!s || finished || s.event || s.info) return;
      const t = typeof s.target === 'string' ? e.target.closest(s.target) : null; if (t) advance();
    }, true);

    card.addEventListener('click', e => {
      const b = e.target.closest('[data-tour]'); if (!b) return; const a = b.dataset.tour;
      if (a === 'showme') showMe();
      else if (a === 'next' || a === 'skip') { done.delete(i); advance(0); }
      else if (a === 'restart') restart();
      else if (a === 'hide') { card.classList.add('hidden'); badge.classList.add('show'); }
      else if (a === 'nav') { if (framed) window.parent.postMessage({ action: { action: '@webframe.navigate', path: b.dataset.path } }, '*'); else window.open(docsBase + b.dataset.path, '_blank', 'noopener'); }
    });
    badge.addEventListener('click', () => { card.classList.remove('hidden'); badge.classList.remove('show'); });

    function restart() {
      i = 0; finished = false; done = new Set(); if (typeof scenario.reset === 'function') scenario.reset(app); else defaultReset(); render(); emitOut('demo_restarted', { scenario: scenario.id });
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
    return { next: () => advance(0), restart, showMe, onEvent, destroy() { destroyed = true; cancelAnimationFrame(raf); card.remove(); spot.remove(); badge.remove(); }, get step() { return i; }, get finished() { return finished; } };
  }

  return { start };
})();
