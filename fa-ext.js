/* ---------------------------------------------------------------------------
   FieldAgent guided demos — extension panels.
   Adds the FieldAgent Web screens the generated engine leaves inert: Edit Field, Add a Field Activity (crop seasons
   and activities), Share Field / Share Fields, and Order Analytics. The engine exposes hooks for this
   (opts.renderView, onBlocked, onAct, onInput, onTab, renderActivities, drawToolsFor) so the engine itself stays a
   generated file. Everything here changes demo state only; nothing leaves the browser.

   FieldAgentExt.install(app, DATA) → app.ext = { reset(fid) }
--------------------------------------------------------------------------- */
window.FieldAgentExt = (function () {
  'use strict';

  const CROP_TYPES = ['Alfalfa', 'Barley', 'Canola', 'Corn', 'Cotton', 'Potato', 'Rice', 'Soybean', 'Sugar Beet', 'Wheat', 'Other'];
  const ACTIVITY_TYPES = ['Plant', 'Irrigate', 'Kernel Count'];
  const RATE_UNITS = ['seeds/acre', 'lbs/acre'];
  const US_STATES = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'];
  // Field-scale analytics a Scout/Advisor/Advanced account can order, with the details each one needs
  const ANALYTICS = [
    { key: 'stand', label: 'Field Scale Stand Count', code: '71301-00', crop: true, planter: true },
    { key: 'stand-uni', label: 'Field Scale Stand Count with Uniformity', code: '71301-01', crop: true, planter: true },
    { key: 'stand-weed', label: 'Field Scale Stand Count and Weed Pressure (Beta)', code: '', crop: true, planter: true },
    { key: 'tassel', label: 'Field Scale Tassel Count', code: '71302-00', crop: false, planter: true },
    { key: 'canopy', label: 'Field Scale Spot Scout Canopy Cover', code: '71304-00', crop: false, planter: false },
  ];
  const CROPS = ['Corn', 'Cotton', 'Soybean'];
  const UNIT_SYSTEMS = ['Imperial', 'Metric'];

  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const fmtDate = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${m}-${d}-${y}`; };
  const isEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());

  function install(app, DATA) {
    const { state, opts, ui, render, goto, toast, emit, root, panel } = app;
    const { icon, esc, head, tip, fmtAc, curField } = ui;
    const X = state.ext = state.ext || { seasons: {}, activities: {}, edit: null, act: null, share: null, order: null };
    // a field may come with real crop seasons and activities (fa-data.js: field.seasons / field.activities); the demo starts from those
    const seed = fid => { const f = (DATA.fields || []).find(x => x.id === fid) || {}; return { seasons: (f.seasons || []).map(s => ({ ...s })), activities: (f.activities || []).map(a => ({ ...a, ears: a.ears || [] })) }; };
    const seasonsOf = fid => (X.seasons[fid] = X.seasons[fid] || seed(fid).seasons);
    const activitiesOf = fid => (X.activities[fid] = X.activities[fid] || seed(fid).activities);

    // ---- shared form pieces (same classes the engine uses) ----
    const textfield = (label, act, value, o = {}) => `<label class="textfield"><span class="label">${esc(label)}</span><${o.textarea ? 'textarea rows="2"' : `input type="${o.type || 'text'}"`} data-act="${act}" ${o.placeholder ? `placeholder="${esc(o.placeholder)}"` : ''} ${o.textarea ? '' : `value="${esc(value == null ? '' : value)}"`}${o.min != null ? ` min="${o.min}"` : ''}${o.step ? ` step="${o.step}"` : ''}>${o.textarea ? esc(value || '') : ''}${o.textarea ? '</textarea>' : ''}</label>`;
    const select = (label, menuKey, act, options, cur, o = {}) => `<div class="select${state.menu === menuKey ? ' open' : ''}"><span class="label">${esc(label)}</span><button class="value" type="button" data-act="menu" data-menu="${menuKey}" aria-haspopup="listbox"><span>${cur != null && cur !== '' ? esc(o.labelOf ? o.labelOf(cur) : cur) : `<span style="color:#6b6b6b">${esc(o.placeholder || 'Choose')}</span>`}</span>${icon('i-drop')}</button>${state.menu === menuKey ? `<div class="menu" role="listbox">${options.map(op => { const val = typeof op === 'string' ? op : op.val; const lab = typeof op === 'string' ? op : op.label; return `<div class="opt${cur === val ? ' sel' : ''}" data-act="${act}" data-val="${esc(val)}" role="option">${esc(lab)}</div>`; }).join('')}</div>` : ''}</div>`;

    // =============================== Edit Field ===============================
    function openEditField() {
      const f = curField();
      X.edit = { name: f.name, grower: f.grower || '', farm: f.farm || '', address: f.address || '', city: f.city || '', country: f.country || 'United States', state: f.state || '', zip: f.zip || '', confirmDelete: false };
      goto('editfield'); emit('field_edit_opened', { field: f.id });
    }
    function renderEditField() {
      const f = curField(); const d = X.edit || {};
      return head(f.name, { back: 'field' }) + `<div class="panel-scroll">
        <section class="card"><div class="card-title">Edit Field</div>
          ${textfield('Name *', 'ef-name', d.name)}
          ${textfield('Grower', 'ef-grower', d.grower)}
          ${textfield('Farm', 'ef-farm', d.farm)}
          ${textfield('Address', 'ef-address', d.address)}
          ${textfield('City', 'ef-city', d.city)}
          ${textfield('Country', 'ef-country', d.country)}
          ${select('Select State', 'x-state', 'x-state', US_STATES, d.state, { placeholder: 'Select State' })}
          ${textfield('Postal Code', 'ef-zip', d.zip)}
          <button class="btn-wide blue" type="button" data-act="ef-save" ${d.name && d.name.trim() ? '' : 'disabled'}>Save</button>
          <button class="btn-wide red" type="button" data-act="ef-delete">${d.confirmDelete ? 'Delete — click again to confirm' : 'Delete'}</button>
          ${tip('editfield', 'The tools on the right edge of the map edit the boundary: <b>Edit</b> drags the red points, <b>Cut</b> removes an area, the shape tools add to it. In this demo the details save, the boundary stays as it is.')}</section>
      </div>`;
    }
    function saveEditField() {
      const f = curField(); const d = X.edit; if (!d || !d.name.trim()) return;
      Object.assign(f, { name: d.name.trim(), grower: d.grower.trim(), farm: d.farm.trim(), address: d.address.trim(), city: d.city.trim(), country: d.country.trim(), state: d.state, zip: d.zip.trim() });
      X.edit = null; goto('field'); toast('Field details saved — in this demo only.'); emit('field_saved', { field: f.id, grower: f.grower, farm: f.farm });
    }

    // ============================ Create New Field ============================
    // FieldAgent Web's /new page: a Partner Fields card (import from a connected partner) and the Create New Field form,
    // with the drawing tools on the map. The demo sketches the boundary when a shape tool is pressed and stops at SAVE.
    function openCreateField() {
      X.create = { name: '', grower: '', farm: '', address: '', city: '', country: 'United States', state: '', zip: '', drawn: null };
      goto('newfield'); emit('create_field_opened');
    }
    function createReady() { const c = X.create; return !!(c && c.name.trim() && c.drawn); }
    function renderCreateField() {
      const c = X.create || {};
      return head('Create Field', { back: 'fields' }) + `<div class="panel-scroll">
        <section class="card"><div class="card-title">Partner Fields</div>
          <div class="muted-center">Choose a Partner to Import Fields</div>
          <div class="tip">When a John Deere Operations Center or Climate FieldView connection exists on the account, its fields are listed here and import with one click.</div></section>
        <section class="card"><div class="card-title">Create New Field</div>
          ${textfield('Name *', 'cf-name', c.name)}
          ${textfield('Grower', 'cf-grower', c.grower)}
          ${textfield('Farm', 'cf-farm', c.farm)}
          ${textfield('Address', 'cf-address', c.address)}
          ${textfield('City', 'cf-city', c.city)}
          ${textfield('Country', 'cf-country', c.country)}
          ${select('Select State', 'cf-state', 'cf-state', US_STATES, c.state, { placeholder: 'Select State' })}
          ${textfield('Postal Code', 'cf-zip', c.zip)}
          <div class="tip">${c.drawn ? `Boundary: ${esc(c.drawn)} drawn on the map.` : 'Draw the boundary with the tools on the right edge of the map — a rectangle, a polygon or a circle — then SAVE.'}</div>
          <button class="btn-wide blue" type="button" data-act="cf-save" ${createReady() ? '' : 'disabled'}>Save</button>
          ${tip('createfield', 'SAVE stays disabled until the field has a name and a boundary. In FieldAgent the new field opens right away and its acreage comes from the boundary you drew; in this demo the form stops at SAVE.')}</section>
      </div>`;
    }
    function drawBoundaryDemo(tool) {
      if (!X.create) return false;
      X.create.drawn = tool === 'Draw Rectangle' ? 'a rectangle' : tool === 'Draw Polygon' ? 'a polygon' : tool === 'Draw Circle' ? 'a circle' : null;
      if (!X.create.drawn) return false;
      render(true); toast(`${X.create.drawn[0].toUpperCase()}${X.create.drawn.slice(1)} sketched for you — in FieldAgent you click the corners on the map.`); emit('boundary_drawn', { tool });
      return true;
    }

    // =========================== Add a Field Activity ===========================
    function openActivity() {
      const f = curField();
      X.act = { season: seasonsOf(f.id).length ? '' : '', newSeason: { start: '', end: '', type: '', name: '' }, type: '', applied: '', rate: '', unit: 'seeds/acre', area: fmtAc(f.acres), variety: '', spacing: '', maturity: '', ears: [{ rows: '', per: '' }] };
      goto('activity'); emit('activity_opened', { field: f.id });
    }
    function seasonLabel(s) { return `${s.name} · ${s.type}${s.start ? ` · ${fmtDate(s.start)}` : ''}`; }
    function renderActivity() {
      const f = curField(); const a = X.act || {}; const seasons = seasonsOf(f.id);
      const seasonOpts = [...seasons.map((s, i) => ({ val: String(i), label: seasonLabel(s) })), { val: 'new', label: 'Add Crop Season' }];
      const seasonCur = a.season === '' ? '' : a.season;
      const labelOf = v => v === 'new' ? 'Add Crop Season' : (seasons[+v] ? seasonLabel(seasons[+v]) : '');
      const ns = a.newSeason;
      const newSeason = a.season === 'new' ? `<section class="card"><div class="card-title">New Crop Season</div>
          ${textfield('Start Date', 'x-sstart', ns.start, { type: 'date' })}
          ${textfield('End Date', 'x-send', ns.end, { type: 'date' })}
          ${select('Crop Type *', 'x-croptype', 'x-croptype', CROP_TYPES, ns.type, { placeholder: 'Select a crop type' })}
          ${textfield('Name *', 'x-sname', ns.name, { placeholder: 'e.g. Spring Corn' })}</section>` : '';
      const haveSeason = a.season === 'new' ? !!(ns.type && ns.name.trim()) : a.season !== '';
      let details = '';
      if (a.type === 'Plant') details = `${textfield('Applied At *', 'x-applied', a.applied, { type: 'date' })}
          <div class="two-col">${textfield('Average Rate', 'x-rate', a.rate, { type: 'number', min: 0 })}${select('Unit', 'x-unit', 'x-unit', RATE_UNITS, a.unit)}</div>
          ${textfield('Area (ACRE)', 'x-area', a.area, { type: 'number', min: 0, step: '0.01' })}
          ${textfield('Seed Variety', 'x-variety', a.variety)}
          ${textfield('Row Spacing (inches)', 'x-spacing', a.spacing, { type: 'number', min: 0 })}
          ${textfield('Maturity Group', 'x-maturity', a.maturity)}`;
      else if (a.type === 'Irrigate') details = `${textfield('Applied At *', 'x-applied', a.applied, { type: 'date' })}
          ${textfield('Average Rate (gallons/acre)', 'x-rate', a.rate, { type: 'number', min: 0 })}
          ${textfield('Area (ACRE)', 'x-area', a.area, { type: 'number', min: 0, step: '0.01' })}`;
      else if (a.type === 'Kernel Count') details = `${textfield('Applied At *', 'x-applied', a.applied, { type: 'date' })}
          ${a.ears.map((e, i) => `<div class="ear-row"><span class="ear-label">Ear ${i + 1}</span><div class="two-col">${textfield('Kernel Rows', `x-ear-rows-${i}`, e.rows, { type: 'number', min: 0 })}${textfield('Kernels/Row', `x-ear-per-${i}`, e.per, { type: 'number', min: 0 })}</div></div>`).join('')}
          <button class="btn-wide ghost" type="button" data-act="x-addear">Add another ear</button>
          <div class="tip">For a reliable yield estimate count at least three representative ears.</div>`;
      const ready = haveSeason && a.type && a.applied;
      return head('Add a Field Activity', { back: 'field' }) + `<div class="panel-scroll">
        <section class="card"><div class="card-title">Crop Season</div>
          ${select('Select Crop Season *', 'x-season', 'x-season', seasonOpts, seasonCur, { placeholder: 'Select a crop season', labelOf })}
          ${seasons.length ? '' : tip('season', 'A crop season groups the activities of one crop on this field. It also powers the <b>Crop Season</b> filter and the <b>Active Crop Season</b> sort in the Fields list.')}</section>
        ${newSeason}
        ${haveSeason ? `<section class="card"><div class="card-title">New Field Activity</div>
          ${select('Activity Type *', 'x-atype', 'x-atype', ACTIVITY_TYPES, a.type, { placeholder: 'Select an activity type' })}
          ${details}</section>` : ''}
        <button class="submit-bar${ready ? ' on' : ''}" type="button" data-act="x-asubmit" ${ready ? '' : 'disabled'}>Submit</button>
        <div class="sample-note">Once a Plant activity is recorded, FieldAgent sends growth-stage notifications for the field through the season.</div>
      </div>`;
    }
    function submitActivity() {
      const f = curField(); const a = X.act; if (!a) return;
      let seasonIdx = a.season === 'new' ? -1 : +a.season;
      if (a.season === 'new') { const ns = a.newSeason; if (!ns.type || !ns.name.trim()) return; seasonsOf(f.id).push({ name: ns.name.trim(), type: ns.type, start: ns.start, end: ns.end }); seasonIdx = seasonsOf(f.id).length - 1; emit('season_added', { field: f.id, name: ns.name.trim(), type: ns.type }); }
      if (seasonIdx < 0 || !a.type || !a.applied) return;
      const act = { season: seasonIdx, type: a.type, applied: a.applied, rate: a.rate, unit: a.type === 'Irrigate' ? 'gallons/acre' : a.unit, area: a.area, variety: a.variety, spacing: a.spacing, maturity: a.maturity, ears: a.type === 'Kernel Count' ? a.ears.filter(e => e.rows && e.per) : [] };
      activitiesOf(f.id).push(act); X.act = null; goto('field'); toast('Field activity saved — in this demo only.');
      emit('activity_added', { field: f.id, type: act.type, applied: act.applied });
    }
    function renderActivitiesCard(f) {
      const seasons = seasonsOf(f.id); const acts = activitiesOf(f.id);
      const body = seasons.length ? seasons.map((s, i) => `<div class="season-row"><div class="season-head"><b>${esc(s.name)}</b><span>${esc(s.type)}${s.start ? ` · ${esc(fmtDate(s.start))}${s.end ? ` – ${esc(fmtDate(s.end))}` : ''}` : ''}</span></div>
          ${acts.filter(a => a.season === i).map(a => `<div class="act-row"><span class="act-type">${esc(a.type)}</span><span class="act-detail">${esc(fmtDate(a.applied))}${a.type === 'Plant' && a.rate ? ` · ${Number(a.rate).toLocaleString()} ${esc(a.unit)}` : ''}${a.type === 'Irrigate' && a.rate ? ` · ${Number(a.rate).toLocaleString()} gallons/acre` : ''}${a.type === 'Kernel Count' ? ` · ${a.ears.length} ${a.ears.length === 1 ? 'ear' : 'ears'}` : ''}${a.variety ? ` · ${esc(a.variety)}` : ''}</span></div>`).join('') || '<div class="act-row muted">No activities in this season yet.</div>'}</div>`).join('') : '<div class="muted-center">No field activities to show.</div>';
      return `<section class="card"><div class="card-title"><span class="grow">Field Activities</span><button class="iconbtn white" type="button" data-act="x-activity" aria-label="Add activity">${icon('i-addcircle', 'ico sm')}</button></div>${body}</section>`;
    }

    // ================================ Share =================================
    let dialog = null;
    function openShare(all) {
      const f = curField(); const n = app.FIELD ? Object.keys(app.FIELD).length : 1;
      X.share = { all: !!all, email: '', error: '' };
      closeDialog();
      dialog = document.createElement('div'); dialog.className = 'x-overlay'; dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true'); dialog.setAttribute('aria-label', all ? 'Share Fields' : 'Share Field');
      root.appendChild(dialog); renderShare(); emit('share_opened', { all: !!all, field: all ? null : f.id, count: all ? n : 1 });
    }
    function renderShare() {
      if (!dialog) return; const s = X.share; const n = app.FIELD ? Object.keys(app.FIELD).length : 1;
      dialog.innerHTML = `<div class="x-dialog">
        <div class="x-dialog-title">${s.all ? 'Share Fields' : 'Share Field'}</div>
        ${s.all ? `<div class="x-warn">${icon('i-info', 'ico sm')}<span>You're about to share ${n} field${n === 1 ? '' : 's'}.</span></div>` : ''}
        <div class="x-dialog-text">Enter the email address of the person to share with. They will receive a link by email; a FieldAgent user also sees the field${s.all ? 's' : ''} under <b>Fields Shared With Me</b>.</div>
        <label class="textfield"><span class="label">Email address</span><input type="email" data-act="x-email" value="${esc(s.email)}" placeholder="name@example.com" autocomplete="off"></label>
        ${s.error ? `<div class="x-error">${esc(s.error)}</div>` : ''}
        <div class="x-dialog-actions"><button class="fa-tour-btn ghost" type="button" data-act="x-share-cancel">Cancel</button><button class="fa-tour-btn primary" type="button" data-act="x-share" ${isEmail(s.email) ? '' : 'disabled'}>Share</button></div>
      </div>`;
      const inp = dialog.querySelector('[data-act="x-email"]'); if (inp) setTimeout(() => inp.focus(), 30);
    }
    function closeDialog() { if (dialog) { dialog.remove(); dialog = null; } }
    root.addEventListener('click', e => {
      if (!dialog || !dialog.contains(e.target)) return;
      const t = e.target.closest('[data-act]'); if (!t) { if (e.target === dialog) closeDialog(); return; }
      if (t.dataset.act === 'x-share-cancel') { closeDialog(); emit('share_cancelled'); }
      else if (t.dataset.act === 'x-share') { const s = X.share; if (!isEmail(s.email)) { s.error = 'Enter a valid email address.'; renderShare(); return; } closeDialog(); toast(`Sharing happens from your FieldAgent account. In FieldAgent, ${s.email} would receive an email within a minute.`); emit('share_attempt', { all: s.all, email: s.email }); }
    });
    root.addEventListener('input', e => { if (dialog && e.target.matches('[data-act="x-email"]')) { X.share.email = e.target.value; X.share.error = ''; const btn = dialog.querySelector('[data-act="x-share"]'); if (btn) btn.disabled = !isEmail(X.share.email); const err = dialog.querySelector('.x-error'); if (err) err.remove(); emit('share_email_changed', { valid: isEmail(X.share.email) }); } });
    root.addEventListener('keydown', e => { if (dialog && e.key === 'Escape') closeDialog(); });

    // ============================ Order Analytics ============================
    function openAnalytics() { const f = curField(); X.order = { type: '', survey: '', crop: '', rate: '', spacing: '', units: 'Imperial', notes: '' }; goto('analytics'); emit('analytics_opened', { field: f.id }); }
    function renderAnalytics() {
      const f = curField(); const o = X.order || {}; const prod = ANALYTICS.find(p => p.key === o.type); const s = f.surveys.find(x => x.key === o.survey);
      const surveyOpts = f.surveys.map(x => ({ val: x.key, label: `${x.name} • ${x.date}` }));
      const sensor = s ? (ui.SENSOR_LABEL[s.bands] || s.bands) : '';
      const details = prod ? `${prod.crop ? select('Crop Type *', 'x-crop', 'x-crop', CROPS, o.crop, { placeholder: 'Select a crop' }) : ''}
          ${prod.planter ? `<div class="two-col">${textfield('Seeding Rate *', 'x-orate', o.rate, { type: 'number', min: 0, placeholder: 'seeds/acre' })}${textfield('Row Spacing *', 'x-ospacing', o.spacing, { type: 'number', min: 0, placeholder: 'inches' })}</div>` : ''}
          ${select('Output Unit System', 'x-units', 'x-units', UNIT_SYSTEMS, o.units)}
          ${textfield('Instructions', 'x-onotes', o.notes, { textarea: true, placeholder: 'Anything the processing team should know about the field or the flight' })}` : '';
      const ready = prod && s && (!prod.crop || o.crop) && (!prod.planter || (o.rate && o.spacing));
      return head('Order Analytics', { back: 'field' }) + `<div class="panel-scroll">
        <section class="card"><div class="card-title">${icon('i-flask', 'ico sm')}<span class="grow">Order Analytics</span></div>
          ${select('Select Analytics Type *', 'x-antype', 'x-antype', ANALYTICS.map(p => ({ val: p.key, label: p.label })), o.type, { placeholder: 'Choose a product', labelOf: v => (ANALYTICS.find(p => p.key === v) || {}).label || '' })}
          ${select('Select Survey *', 'x-asurvey', 'x-asurvey', surveyOpts, o.survey, { placeholder: 'Choose a survey', labelOf: v => { const x = f.surveys.find(y => y.key === v); return x ? `${x.name} • ${x.date}` : ''; } })}
          ${s ? `<div class="tip">${(s.photos.count || 0).toLocaleString()} ${s.bands === 'rgb' ? 'RGB' : 'multispectral'} images · ${esc(sensor)}. Analytics need the low-altitude spot-scout pattern from the catalog; a mosaic flight may not qualify.</div>` : ''}
          ${details}</section>
        <section class="card"><div class="card-title">${icon('i-cart', 'ico sm')}<span class="grow">Order Summary</span></div>
          ${prod ? `<div class="sum-row"><b>${esc(prod.label)}</b><span>${prod.code ? esc(prod.code) : 'Beta'}${s ? ` · ${esc(s.date)}` : ''}${o.crop ? ` · ${esc(o.crop)}` : ''}</span></div>` : '<div class="muted-center">No Product Selected</div>'}</section>
        <button class="submit-bar${ready ? ' on' : ''}" type="button" data-act="x-osubmit" ${ready ? '' : 'disabled'}>Submit</button>
        <div class="sample-note">FieldAgent emails you when the results are ready; the order shows on the Orders page while it processes.</div>
      </div>`;
    }

    // ================================ hooks =================================
    opts.renderView = view => view === 'editfield' ? renderEditField() : view === 'newfield' ? renderCreateField() : view === 'activity' ? renderActivity() : view === 'analytics' ? renderAnalytics() : null;
    opts.drawToolsFor = view => view === 'editfield' || view === 'newfield';
    opts.renderActivities = f => renderActivitiesCard(f);
    opts.onBlocked = (label, el) => {
      if (label === 'Editing field details') { openEditField(); return true; }
      if (label === 'Adding a field') { openCreateField(); return true; }
      if (state.view === 'newfield' && /^Draw (Rectangle|Polygon|Circle)$/.test(label)) return drawBoundaryDemo(label);
      if (label === 'Adding an activity') { openActivity(); return true; }
      if (label === 'Sharing') { openShare(state.view === 'fields'); return true; }
      if (label === 'Order Analytics') { openAnalytics(); return true; }
      return false;
    };
    const pick = (menuAct, apply) => { apply(); state.menu = null; render(true); };
    opts.onAct = (act, t) => {
      const v = t.dataset.val;
      if (act === 'x-activity') { openActivity(); return true; }
      // edit field
      if (act === 'ef-save') { saveEditField(); return true; }
      if (act === 'ef-delete') { const d = X.edit; if (!d.confirmDelete) { d.confirmDelete = true; render(true); emit('field_delete_prompt'); } else { d.confirmDelete = false; render(true); toast('Deleting a field is not part of this demo. In FieldAgent it removes the field and its data for everyone in the organization.'); emit('field_delete_attempt'); } return true; }
      if (act === 'x-state') { pick(act, () => { X.edit.state = v; }); emit('field_edit_changed', { key: 'state', value: v }); return true; }
      // create field
      if (act === 'cf-state') { pick(act, () => { X.create.state = v; }); emit('create_field_changed', { key: 'state', value: v }); return true; }
      if (act === 'cf-save') { if (!createReady()) return true; const c = X.create; toast(`"${c.name.trim()}" would be created now — in this demo the form stops here.`); emit('create_field_attempt', { name: c.name.trim(), boundary: c.drawn }); return true; }
      // activity
      if (act === 'x-season') { pick(act, () => { X.act.season = v; }); emit('season_selected', { season: v }); return true; }
      if (act === 'x-croptype') { pick(act, () => { X.act.newSeason.type = v; }); emit('season_type_changed', { type: v }); return true; }
      if (act === 'x-atype') { pick(act, () => { X.act.type = v; if (!X.act.applied) X.act.applied = ''; }); emit('activity_type_changed', { type: v }); return true; }
      if (act === 'x-unit') { pick(act, () => { X.act.unit = v; }); return true; }
      if (act === 'x-addear') { X.act.ears.push({ rows: '', per: '' }); render(true); emit('ear_added', { count: X.act.ears.length }); return true; }
      if (act === 'x-asubmit') { submitActivity(); return true; }
      // analytics
      if (act === 'x-antype') { pick(act, () => { X.order.type = v; X.order.crop = ''; }); emit('analytics_type_selected', { type: v }); return true; }
      if (act === 'x-asurvey') { pick(act, () => { X.order.survey = v; }); emit('analytics_survey_selected', { survey: v }); return true; }
      if (act === 'x-crop') { pick(act, () => { X.order.crop = v; }); emit('analytics_details_changed', { key: 'crop', value: v }); return true; }
      if (act === 'x-units') { pick(act, () => { X.order.units = v; }); emit('analytics_details_changed', { key: 'units', value: v }); return true; }
      if (act === 'x-osubmit') { const o = X.order; const prod = ANALYTICS.find(p => p.key === o.type); toast('Orders are submitted from your FieldAgent account. This demo stops here.'); emit('analytics_submit_attempt', { type: o.type, product: prod && prod.label, survey: o.survey, crop: o.crop }); return true; }
      return false;
    };
    // text inputs update the drafts without re-rendering (so the caret stays put)
    opts.onInput = (act, t) => {
      const v = t.value;
      const ef = { 'ef-name': 'name', 'ef-grower': 'grower', 'ef-farm': 'farm', 'ef-address': 'address', 'ef-city': 'city', 'ef-country': 'country', 'ef-zip': 'zip' };
      if (ef[act] && X.edit) { X.edit[ef[act]] = v; if (act === 'ef-name') { const b = panel.querySelector('[data-act="ef-save"]'); if (b) b.disabled = !v.trim(); } emit('field_edit_changed', { key: ef[act], value: v }); return true; }
      const cf = { 'cf-name': 'name', 'cf-grower': 'grower', 'cf-farm': 'farm', 'cf-address': 'address', 'cf-city': 'city', 'cf-country': 'country', 'cf-zip': 'zip' };
      if (cf[act] && X.create) { X.create[cf[act]] = v; const b = panel.querySelector('[data-act="cf-save"]'); if (b) b.disabled = !createReady(); emit('create_field_changed', { key: cf[act], value: v }); return true; }
      const ac = { 'x-sstart': ['newSeason', 'start'], 'x-send': ['newSeason', 'end'], 'x-sname': ['newSeason', 'name'], 'x-applied': ['applied'], 'x-rate': ['rate'], 'x-area': ['area'], 'x-variety': ['variety'], 'x-spacing': ['spacing'], 'x-maturity': ['maturity'] };
      if (ac[act] && X.act) { const path = ac[act]; if (path.length === 2) X.act[path[0]][path[1]] = v; else X.act[path[0]] = v; if (act === 'x-sname') { emit('season_name_changed', { name: v }); } else if (act === 'x-applied') { emit('activity_date_changed', { applied: v }); } refreshSubmit('x-asubmit', X.act && ((X.act.season === 'new' ? !!(X.act.newSeason.type && X.act.newSeason.name.trim()) : X.act.season !== '') && X.act.type && X.act.applied)); if (act === 'x-sname') refreshSeasonBtn(); return true; }
      const ear = act.match(/^x-ear-(rows|per)-(\d+)$/); if (ear && X.act) { X.act.ears[+ear[2]][ear[1]] = v; return true; }
      const or = { 'x-orate': 'rate', 'x-ospacing': 'spacing', 'x-onotes': 'notes' };
      if (or[act] && X.order) { X.order[or[act]] = v; const o = X.order; const prod = ANALYTICS.find(p => p.key === o.type); const s = curField().surveys.find(x => x.key === o.survey); refreshSubmit('x-osubmit', prod && s && (!prod.crop || o.crop) && (!prod.planter || (o.rate && o.spacing))); if (act !== 'x-onotes') emit('analytics_details_changed', { key: or[act], value: v }); return true; }
      return false;
    };
    function refreshSubmit(act, ready) { const b = panel.querySelector(`[data-act="${act}"]`); if (b) { b.disabled = !ready; b.classList.toggle('on', !!ready); } }
    function refreshSeasonBtn() { /* the New Field Activity card appears once the season is complete; re-render only when it needs to appear */ const a = X.act; if (a && a.season === 'new' && a.newSeason.type && a.newSeason.name.trim() && !panel.querySelector('[data-menu="x-atype"]')) { const inp = panel.querySelector('[data-act="x-sname"]'); const pos = inp ? inp.selectionStart : null; render(true); const inp2 = panel.querySelector('[data-act="x-sname"]'); if (inp2) { inp2.focus(); if (pos != null) inp2.setSelectionRange(pos, pos); } } }

    app.ext = {
      reset(fid) { const sd = seed(fid); X.seasons[fid] = sd.seasons; X.activities[fid] = sd.activities; X.edit = null; X.act = null; X.order = null; X.create = null; closeDialog(); },
      openCreateField,
      openEditField, openActivity, openShare, openAnalytics, ANALYTICS, CROP_TYPES,
    };
    return app.ext;
  }

  return { install };
})();
