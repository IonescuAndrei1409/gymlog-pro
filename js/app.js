/* =====================================================================
 * GymLog Pro — js/app.js
 * ---------------------------------------------------------------------
 * Interfața aplicației (Vanilla JS, fără framework):
 *   1. Antrenament — tabelul rapid pe exerciții, drop-set, notițe, salvare
 *   2. Cronometrul de pauză plutitor (+ alertă sonoră Web Audio)
 *   3. Istoric — lista antrenamentelor (editare / repetare / ștergere)
 *   4. Progres & Statistici — KPI, grafice, "Azi vs. Tura trecută"
 *   5. Corp — profil biometric, IMC, calorii, greutate corporală
 *   6. Setări — export/import, resetare, șabloane, săli
 *
 * Principii: o singură stare (`state`) salvată automat; evenimente delegate
 * pe document (data-action / data-field); randare prin template strings.
 * ===================================================================== */
(function () {
  'use strict';

  const D = window.GymData;
  const S = window.GymStorage;
  const St = window.GymStats;
  const C = window.GymCharts;
  const U = St.util;
  const { esc, num, fmtDate, isNum } = U;

  const BASE_TITLE = document.title;
  let state = null;
  let currentTab = null;
  let lastSaved = null;          // rezumatul ultimului antrenament salvat (banner)
  let autofillHintShown = false;
  const cache = { refs: new Map(), recs: new Map() };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const pad2 = (n) => String(n).padStart(2, '0');
  const fmtInput = (n) => (isNum(n) ? String(n).replace('.', ',') : '');
  const emptySet = () => ({ kg: null, reps: null, done: false, drops: [] });
  const emptyWarmup = () => ({ kg: null, reps: null, bw: false, done: false });
  const pairOk = (p) => p && isNum(p.reps) && p.reps > 0;

  /* ============================== ICONIȚE ============================== */
  const ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    trash: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    history: '<path d="M3 12a9 9 0 1 0 2.6-6.4L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
    trophy: '<path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    chart: '<path d="M3 20h18"/><path d="M6 16v-4M11 16V8M16 16v-6"/><path d="M4 9l6-5 5 4 5-4"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    flame: '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/>',
    upload: '<path d="M12 16V5M7 10l5-5 5 5"/><path d="M5 20h14"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2h5"/>',
    note: '<path d="M5 4h14v12l-4 4H5z"/><path d="M9 9h6M9 13h4"/>',
    scale: '<rect x="3" y="4" width="18" height="16" rx="4"/><path d="M8.5 10a3.5 3.5 0 0 1 7 0"/><path d="M12 10l1.5-2"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    pie: '<path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M15 3.5A9 9 0 0 1 20.5 9H15z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    dumbbell: '<path d="M7 7v10M17 7v10M3.5 9.5v5M20.5 9.5v5M7 12h10"/>',
    warn: '<path d="M12 3.5l9 16.5H3z"/><path d="M12 10v4.5M12 17.5h.01"/>',
    save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    gym: '<path d="M3 21V9l9-5 9 5v12"/><path d="M9 21v-7h6v7"/>',
    user: '<circle cx="12" cy="7" r="4"/><path d="M5 21c0-4 3.1-7 7-7s7 3 7 7"/>',
    phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    wifiOff: '<path d="M2 2l20 20"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M5 12.9a10 10 0 0 1 5.2-2.8"/><path d="M19 12.9a10 10 0 0 0-2.2-1.5"/><path d="M2 8.8a15 15 0 0 1 4.2-2.6"/><path d="M22 8.8a15 15 0 0 0-11.3-3.8"/><path d="M12 20h.01"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  };
  function icon(name, size = 18, cls = '') {
    return '<svg class="ico ' + cls + '" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  /* ============================== AJUTĂTOARE STARE ============================== */
  function exInfo(id) {
    return D.EXERCISES.find((e) => e.id === id) || state.customExercises.find((e) => e.id === id) || { id, name: id, muscle: '', group: 'arms' };
  }
  const allExercises = () => D.EXERCISES.concat(state.customExercises);
  const groupOf = (exId) => D.GROUPS[exInfo(exId).group] || D.GROUPS.arms;
  const tplById = (id) => state.templates.find((t) => t.id === id);
  const tplColor = (id) => (tplById(id) || {}).color || '#7b8cff';
  const tplName = (w) => (tplById(w.templateId) || {}).name || w.title || 'Antrenament';

  function commit() {
    S.scheduleSave(state);
    setSaveStatus('saving');
  }
  function clearCaches() { cache.refs.clear(); cache.recs.clear(); }

  function setSaveStatus(kind) {
    const el = $('#save-status');
    if (!el) return;
    const txt = $('.txt', el);
    el.classList.toggle('is-saving', kind === 'saving');
    el.classList.toggle('is-off', kind === 'off');
    if (kind === 'saving') txt.textContent = 'Se salvează…';
    else if (kind === 'off') txt.textContent = 'Fără salvare automată';
    else {
      const d = S.lastSavedAt || new Date();
      txt.textContent = 'Salvat automat · ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    }
    el.title = txt.textContent;
  }

  /* ============================== NAVIGAȚIE (hash) ============================== */
  const TABS = { log: 'antrenament', history: 'istoric', progress: 'progres', body: 'corp', settings: 'setari' };
  const HASH_TO_TAB = Object.fromEntries(Object.entries(TABS).map(([k, v]) => [v, k]));

  function go(tab) {
    const h = '#' + TABS[tab];
    if (location.hash === h) setTab(tab);
    else location.hash = h; // → hashchange → setTab
  }

  function setTab(tab) {
    if (!TABS[tab]) tab = 'log';
    const changed = tab !== currentTab;
    currentTab = tab;
    state.ui.tab = tab;
    $$('.tab').forEach((a) => {
      const on = a.dataset.tab === tab;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    $$('.view').forEach((v) => v.classList.toggle('is-active', v.dataset.view === tab));
    render(tab);
    if (changed) window.scrollTo(0, 0);
    commit();
  }

  function render(tab = currentTab) {
    if (tab === 'log') renderLog();
    else if (tab === 'history') renderHistory();
    else if (tab === 'progress') renderProgress();
    else if (tab === 'body') renderBody();
    else if (tab === 'settings') renderSettings();
  }

  /* =====================================================================
   * 1. ANTRENAMENT — tabelul rapid
   * ===================================================================== */
  function refPred() {
    const d = state.draft;
    return (w) => w.id !== d.editingId && w.date <= d.date;
  }
  /* Referința "Ultima dată" (memorată, ca să nu recalculăm la fiecare tastă). */
  function getRef(wex) {
    const key = wex.exId + '|' + wex.gym + '|' + state.draft.date;
    if (!cache.refs.has(key)) cache.refs.set(key, St.lastReference(state.workouts, wex.exId, wex.gym, refPred()));
    return cache.refs.get(key);
  }
  function getRecord(wex) {
    const key = wex.exId + '|' + wex.gym + '|' + state.draft.date;
    if (!cache.recs.has(key)) cache.recs.set(key, St.recordFor(state.workouts.filter(refPred()), wex.exId, wex.gym, state.draft.editingId));
    return cache.recs.get(key);
  }
  const refSet = (ref, key) => (ref ? (key === 'w' ? ref.wex.warmup : ref.wex.sets[key]) : null);

  function renderLog() {
    const el = $('#view-log');
    const d = state.draft;
    el.innerHTML = `
      <div class="page-head">
        <div>
          <h1 class="h1">${d ? esc(d.title) : 'Antrenament nou'}</h1>
          <p class="lead">${d
            ? 'Completează tabelul cu <b>kg × repetări</b>. Bifează ✓ seria ca să pornească pauza. Valorile gri = ce ai făcut data trecută.'
            : 'Alege ziua de azi — exercițiile se încarcă automat, împreună cu ce ai ridicat data trecută.'}</p>
        </div>
        <button type="button" class="btn btn-sm" data-action="go" data-tab="settings" data-focus="templates-card">${icon('edit', 15)} Creează / editează șabloane</button>
      </div>
      ${lastSaved && !d ? savedBannerHTML() : ''}
      <div class="tpl-grid">${state.templates.map(tplCardHTML).join('')}</div>
      ${d ? draftHTML(d) : emptyLogHTML()}`;
  }

  function tplCardHTML(t, i) {
    const last = St.sortedWorkouts(state.workouts).reverse().find((w) => w.templateId === t.id);
    const active = state.draft && state.draft.templateId === t.id;
    return `<button type="button" class="tpl-card ${active ? 'is-active' : ''}" style="--c:${esc(t.color)}" data-action="start-template" data-id="${esc(t.id)}">
      ${active ? '<span class="tpl-active-tag">În lucru</span>' : ''}
      <span class="tpl-num">${i + 1}</span>
      <span class="tpl-name">${esc(t.name)}</span>
      <span class="tpl-sub">${esc(t.subtitle)}</span>
      <span class="tpl-meta"><span>${U.plural(t.items.length, 'exercițiu', 'exerciții')}</span><span>·</span><span>${last ? 'ultima dată ' + fmtDate(last.date) : 'încă nefolosit'}</span></span>
    </button>`;
  }

  function emptyLogHTML() {
    const recent = St.sortedWorkouts(state.workouts).slice(-3).reverse();
    return `<div class="card empty mt-5">
      <div class="empty-ico">${icon('dumbbell', 28)}</div>
      <h3>Alege o zi de antrenament</h3>
      <p class="max-w-[520px] mx-auto">Apasă pe unul dintre șabloanele de mai sus. Tabelul se completează cu exercițiile zilei, iar în capul fiecărui exercițiu vezi exact ce ai de bătut.</p>
      ${recent.length ? `<div class="flex flex-wrap justify-center gap-2 mt-5">${recent.map((w) => `<button type="button" class="chip" data-action="history-dup" data-id="${esc(w.id)}">${icon('copy', 13)} Repetă ${esc(tplName(w))} (${fmtDate(w.date)})</button>`).join('')}</div>` : ''}
    </div>`;
  }

  function savedBannerHTML() {
    const s = lastSaved;
    return `<div class="saved-banner mb-5">
      <span class="ok-ico">${icon('check', 22)}</span>
      <div class="flex-1 min-w-[220px]">
        <div class="font-bold">Antrenament salvat — ${esc(s.title)}, ${fmtDate(s.date)}</div>
        <div class="text-sm muted">${U.plural(s.exercises, 'exercițiu', 'exerciții')} · ${U.plural(s.sets, 'serie', 'serii')} · ${num(Math.round(s.volume))} kg ridicate${s.prs ? ` · <b class="t-gold">${U.plural(s.prs, 'record nou', 'recorduri noi')}</b>` : ''}</div>
      </div>
      <button type="button" class="btn btn-sm" data-action="see-progress" data-id="${esc(s.id)}">${icon('chart', 15)} Vezi progresul</button>
      <button type="button" class="icon-btn" data-action="dismiss-banner" aria-label="Închide mesajul">${icon('x', 16)}</button>
    </div>`;
  }

  function draftHTML(d) {
    const color = tplColor(d.templateId);
    const orig = d.editingId ? state.workouts.find((w) => w.id === d.editingId) : null;
    return `
      <div class="card draft-head mt-5">
        <div class="flex flex-wrap items-center gap-3">
          <span class="tpl-badge" style="--c:${esc(color)}">${esc(d.title)}</span>
          ${orig ? `<span class="badge badge-new">${icon('edit', 13)} Editezi antrenamentul din ${fmtDate(orig.date)}</span>` : ''}
          <span class="text-sm muted">${U.plural(d.exercises.length, 'exercițiu', 'exerciții')}</span>
          <label class="flex items-center gap-2 ml-auto text-sm muted">${icon('calendar', 16)} Data
            <input type="date" class="input input-sm w-auto" data-draft="date" value="${esc(d.date)}" aria-label="Data antrenamentului">
          </label>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <span class="foot-label">${icon('note', 13)} Notă antrenament</span>
          <div class="chip-row">${D.NOTE_TAGS.map((t) => `<button type="button" class="chip ${d.tags.includes(t) ? 'is-on' : ''}" data-action="wtag" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div>
          <input class="input input-sm flex-1 min-w-[180px]" data-draft="note" placeholder="Ex: am dormit puțin, sală aglomerată…" value="${esc(d.note)}" aria-label="Notă antrenament">
        </div>
      </div>
      <div class="ex-list mt-4" id="ex-list">${d.exercises.map(exCardHTML).join('')}</div>
      <button type="button" class="add-ex-btn" data-action="add-exercise">${icon('plus', 18)} Adaugă exercițiu</button>
      <div class="save-bar" id="save-bar">${saveBarInner()}</div>`;
  }

  function exCardHTML(wex, i) {
    const info = exInfo(wex.exId);
    const g = groupOf(wex.exId);
    const n = state.draft.exercises.length;
    const ref = getRef(wex);
    const complete = wex.sets.length > 0 && wex.sets.every((s) => s.done);
    return `<article class="ex-card ${complete ? 'is-complete' : ''}" data-ex="${i}" style="--c:${g.color}">
      <header class="ex-head">
        <div class="ex-title-row">
          <span class="ex-idx">${i + 1}</span>
          <div class="ex-title min-w-0">
            <h3 class="ex-name">${esc(info.name)}</h3>
            <div class="ex-muscle">${esc(info.muscle || g.label)} · ${esc(g.label)}</div>
          </div>
          <div class="ex-tools">
            <select class="select gym-select ${wex.gym !== 'General' ? 'is-custom' : ''}" data-field="gym" aria-label="Sală / aparat" title="Sala sau aparatul (contează la scripeți)">
              ${state.gyms.map((gm) => `<option value="${esc(gm)}" ${gm === wex.gym ? 'selected' : ''}>${gm === 'General' ? 'Sală: General' : 'Sală: ' + esc(gm)}</option>`).join('')}
              <option value="__new">+ Sală nouă…</option>
            </select>
            <button type="button" class="icon-btn" data-action="ex-up" ${i === 0 ? 'disabled' : ''} title="Mută mai sus" aria-label="Mută mai sus">${icon('up', 16)}</button>
            <button type="button" class="icon-btn" data-action="ex-down" ${i === n - 1 ? 'disabled' : ''} title="Mută mai jos" aria-label="Mută mai jos">${icon('down', 16)}</button>
            <button type="button" class="icon-btn danger" data-action="ex-remove" title="Șterge exercițiul" aria-label="Șterge exercițiul">${icon('trash', 16)}</button>
          </div>
        </div>
        ${refLineHTML(wex, ref)}
      </header>
      <div class="sets-grid">
        ${cellHTML(wex, 'w', wex.warmup, ref)}
        ${wex.sets.map((s, j) => cellHTML(wex, j, s, ref)).join('')}
        <button type="button" class="add-set" data-action="add-set">${icon('plus', 18)}<span>Adaugă serie</span></button>
      </div>
      <footer class="ex-foot">
        <span class="foot-label">${icon('note', 13)} Notiță</span>
        <div class="chip-row">${D.NOTE_TAGS.map((t) => `<button type="button" class="chip ${wex.tags.includes(t) ? 'is-on' : ''}" data-action="tag" data-tag="${esc(t)}">${esc(t)}</button>`).join('')}</div>
        <input class="input note-input" data-field="note" placeholder="Text liber…" value="${esc(wex.note)}" aria-label="Notiță exercițiu">
      </footer>
    </article>`;
  }

  /* Rândul "Ultima dată (20 Nov): Înc: 50×12 | S1: 120×12 | ..." */
  function refLineHTML(wex, ref) {
    if (!ref) {
      return `<div class="last-ref is-empty">${icon('sparkle', 15)}<span>Prima dată la acest exercițiu${wex.gym !== 'General' ? ' în ' + esc(wex.gym) : ''} — azi stabilești reperul.</span></div>`;
    }
    const r = ref.wex;
    const parts = [];
    if (pairOk(r.warmup)) parts.push(`<span><em class="k">Înc:</em> ${r.warmup.bw ? '0' : num(r.warmup.kg || 0)}×${r.warmup.reps}</span>`);
    r.sets.forEach((s, i) => {
      if (!pairOk(s)) return;
      const drops = (s.drops || []).filter(pairOk).map((dp) => ' + ' + U.pair(dp.kg || 0, dp.reps)).join('');
      parts.push(`<span><em class="k">S${i + 1}:</em> ${U.pair(s.kg || 0, s.reps)}${drops}</span>`);
    });
    const where = ref.sameGym && r.gym !== 'General' ? ' · ' + esc(r.gym) : '';
    const warn = ref.sameGym ? '' : `<span class="warn">${icon('warn', 13)} altă sală (${esc(r.gym)}) — greutățile pot diferi</span>`;
    const tags = (r.tags || []).length ? `<span class="badge">${esc(r.tags.join(', '))}</span>` : '';
    return `<div class="last-ref">${icon('history', 15)}<span class="lr-title">Ultima dată (${fmtDate(ref.workout.date)}${where}):</span> ${parts.join('<i class="sep">|</i>') || '<span class="muted">doar notițe</span>'} ${tags} ${warn}</div>`;
  }

  function cellHTML(wex, key, set, ref) {
    const isW = key === 'w';
    const rset = refSet(ref, key);
    const label = isW ? 'Încălzire' : 'Seria ' + (key + 1);
    const bw = isW && set.bw;
    const phKg = rset && pairOk(rset) ? (rset.bw ? '0' : num(rset.kg || 0)) : '–';
    const phReps = rset && pairOk(rset) ? rset.reps : '–';
    return `<div class="set-cell ${isW ? 'is-warmup' : ''} ${set.done ? 'is-done' : ''}" data-set="${key}">
      <div class="cell-head">
        <span class="cell-label">${label}</span>
        ${isW ? '' : `<button type="button" class="icon-btn xs danger" data-action="remove-set" title="Șterge seria" aria-label="Șterge ${label}">${icon('x', 12)}</button>`}
        <button type="button" class="check-btn ${set.done ? 'is-on' : ''}" data-action="done" aria-pressed="${set.done}" title="${set.done ? 'Seria e bifată (apasă ca să o debifezi)' : 'Bifează seria și pornește pauza'}" aria-label="Bifează ${label}">${icon('check', 16)}</button>
      </div>
      <div class="pair">
        <label class="num-wrap"><input class="num" data-field="kg" inputmode="decimal" autocomplete="off" placeholder="${bw ? 'liber' : phKg}" value="${bw ? '' : fmtInput(set.kg)}" ${bw ? 'disabled' : ''} aria-label="${label}: kilograme"><span class="unit">kg</span></label>
        <span class="times">×</span>
        <label class="num-wrap"><input class="num" data-field="reps" inputmode="numeric" autocomplete="off" placeholder="${phReps}" value="${isNum(set.reps) ? set.reps : ''}" aria-label="${label}: repetări"><span class="unit">rep</span></label>
      </div>
      ${(set.drops || []).map((dp, j) => dropHTML(dp, j, rset)).join('')}
      <div class="cell-foot">
        ${isW
          ? `<label class="bw-toggle"><input type="checkbox" data-field="bw" ${set.bw ? 'checked' : ''}> La liber / 0 kg</label>`
          : '<button type="button" class="drop-btn" data-action="add-drop" title="Adaugă un drop-set în aceeași serie">+ Drop</button>'}
        <span class="delta-slot">${isW ? '' : deltaHTML(wex, key, set, rset)}</span>
      </div>
    </div>`;
  }

  function dropHTML(dp, j, rset) {
    const rd = rset && rset.drops && rset.drops[j];
    return `<div class="drop-row" data-drop="${j}">
      <span class="drop-arrow" title="Drop-set">↳</span>
      <label class="num-wrap"><input class="num" data-field="drop-kg" inputmode="decimal" autocomplete="off" placeholder="${rd ? num(rd.kg) : '–'}" value="${fmtInput(dp.kg)}" aria-label="Drop ${j + 1}: kilograme"><span class="unit">kg</span></label>
      <span class="times">×</span>
      <label class="num-wrap"><input class="num" data-field="drop-reps" inputmode="numeric" autocomplete="off" placeholder="${rd ? rd.reps : '–'}" value="${isNum(dp.reps) ? dp.reps : ''}" aria-label="Drop ${j + 1}: repetări"><span class="unit">rep</span></label>
      <button type="button" class="icon-btn xs danger" data-action="remove-drop" title="Șterge drop-ul" aria-label="Șterge drop-ul">${icon('x', 12)}</button>
    </div>`;
  }

  /* Insigna din colțul celulei: Record! / ▲ +5 kg / = egal / ▼ −1 rep */
  function deltaHTML(wex, key, set, rset) {
    if (!pairOk(set)) return '';
    const cur = { kg: isNum(set.kg) ? set.kg : 0, reps: set.reps };
    const rec = getRecord(wex);
    if (rec && (cur.kg > rec.kg || (cur.kg === rec.kg && cur.reps > rec.reps))) {
      return `<span class="delta pr" title="Record personal! Înainte: ${U.pair(rec.kg, rec.reps)} (${fmtDate(rec.date)})">${icon('trophy', 12)} Record!</span>`;
    }
    if (!pairOk(rset)) return '';
    const c = St.compareSets(cur, { kg: rset.kg || 0, reps: rset.reps });
    let txt;
    if (c.status === 'up') txt = '▲ ' + (c.dKg > 0 ? '+' + num(c.dKg) + ' kg' : '+' + c.dReps + ' rep');
    else if (c.status === 'down') txt = '▼ ' + (c.dKg < 0 ? '−' + num(-c.dKg) + ' kg' : '−' + -c.dReps + ' rep');
    else txt = c.dKg === 0 && c.dReps === 0 ? '= egal' : '≈ similar';
    return `<span class="delta ${c.status}" title="Față de data trecută: ${U.pair(rset.kg || 0, rset.reps)}">${txt}</span>`;
  }

  function draftStats() {
    let total = 0; let done = 0; let vol = 0;
    for (const wex of state.draft.exercises) {
      for (const s of wex.sets) {
        total += 1;
        if (s.done) done += 1;
        if (pairOk(s)) {
          vol += (s.kg || 0) * s.reps;
          for (const dp of s.drops || []) if (pairOk(dp)) vol += (dp.kg || 0) * dp.reps;
        }
      }
    }
    return { total, done, vol };
  }

  function saveBarInner() {
    const s = draftStats();
    const pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
    const editing = !!state.draft.editingId;
    return `<div class="save-stats">
        <div class="progress-mini" aria-hidden="true"><span style="width:${pct}%"></span></div>
        <span><b>${s.done}/${s.total}</b> serii bifate</span>
        <span class="hide-sm">· <b>${num(Math.round(s.vol))}</b> kg ridicate</span>
      </div>
      <div class="flex items-center gap-2">
        <button type="button" class="btn btn-ghost btn-sm" data-action="discard">${editing ? 'Anulează' : 'Renunță'}</button>
        <button type="button" class="btn btn-primary" data-action="save-workout">${icon('save', 16)}<span>${editing ? 'Salvează modificările' : 'Salvează<span class="hidden sm:inline"> antrenamentul</span>'}</span></button>
      </div>`;
  }
  const updateSaveBar = () => { const el = $('#save-bar'); if (el) el.innerHTML = saveBarInner(); };

  function rerenderEx(exIdx, focusSel) {
    const card = $('#ex-list [data-ex="' + exIdx + '"]');
    if (!card) return;
    card.outerHTML = exCardHTML(state.draft.exercises[exIdx], exIdx);
    updateSaveBar();
    if (focusSel) {
      const f = $('#ex-list [data-ex="' + exIdx + '"] ' + focusSel);
      if (f) f.focus();
    }
  }
  function rerenderExList() {
    const list = $('#ex-list');
    if (!list) return renderLog();
    list.innerHTML = state.draft.exercises.map(exCardHTML).join('');
    updateSaveBar();
  }

  /* Context pentru un element din tabel: exercițiu, serie, drop. */
  function ctxFrom(el) {
    const card = el.closest('[data-ex]');
    if (!card || !state.draft) return null;
    const exIdx = +card.dataset.ex;
    const wex = state.draft.exercises[exIdx];
    const cell = el.closest('[data-set]');
    const key = cell ? (cell.dataset.set === 'w' ? 'w' : +cell.dataset.set) : null;
    const set = key === null ? null : key === 'w' ? wex.warmup : wex.sets[key];
    const dropEl = el.closest('[data-drop]');
    return { exIdx, wex, cell, key, set, dropIdx: dropEl ? +dropEl.dataset.drop : null };
  }

  function newDraftExercise(exId, gym) {
    const g = gym || St.lastGymFor(state.workouts, exId);
    const wex = { uid: 'x' + U.uid(), exId, gym: g, tags: [], note: '', warmup: emptyWarmup(), sets: [] };
    const ref = getRef(wex);
    const n = Math.max(3, ref ? ref.wex.sets.filter(pairOk).length : 0);
    for (let i = 0; i < n; i++) wex.sets.push(emptySet());
    if (ref && ref.wex.warmup && ref.wex.warmup.bw) wex.warmup.bw = true;
    return wex;
  }

  function draftHasData(d) {
    if (!d) return false;
    if (d.note || d.tags.length) return true;
    return d.exercises.some((e) => isNum(e.warmup.reps) || isNum(e.warmup.kg) || e.note || e.sets.some((s) => isNum(s.kg) || isNum(s.reps)));
  }

  function createDraft({ templateId, title, items, date }) {
    clearCaches();
    lastSaved = null;
    state.draft = { id: null, editingId: null, date: date || U.today(), templateId, title, tags: [], note: '', exercises: [], createdAt: Date.now() };
    items.forEach((it) => state.draft.exercises.push(newDraftExercise(it.exId, it.gym)));
    commit();
    if (currentTab === 'log') renderLog(); else go('log');
    if (window.innerWidth < 768) requestAnimationFrame(() => { const l = $('#ex-list'); if (l) l.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  }

  async function startTemplate(id) {
    const t = tplById(id);
    if (!t) return;
    const d = state.draft;
    if (d && d.templateId === id && !d.editingId) { const l = $('#ex-list'); if (l) l.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (draftHasData(d)) {
      const ok = await confirmModal({
        title: 'Înlocuiești antrenamentul început?',
        message: `Ai date nesalvate în <b>${esc(d.title)}</b>. Dacă pornești <b>${esc(t.name)}</b>, ele se pierd.`,
        confirmText: 'Da, pornește ' + esc(t.name), danger: true,
      });
      if (!ok) return;
    }
    createDraft({ templateId: t.id, title: t.name, items: t.items });
  }

  function toggleDone(el) {
    const c = ctxFrom(el);
    if (!c || !c.set) return;
    const set = c.set;
    if (!set.done) {
      // Bifă rapidă: dacă celula e goală, preia valorile de data trecută.
      const rset = refSet(getRef(c.wex), c.key);
      if (!isNum(set.reps) && !isNum(set.kg) && pairOk(rset)) {
        if (c.key === 'w') { set.bw = !!rset.bw; set.kg = rset.bw ? 0 : rset.kg; } else set.kg = rset.kg;
        set.reps = rset.reps;
        if (!autofillHintShown) { toast('Am completat valorile de data trecută — modifică-le dacă ai făcut altfel.', 'info'); autofillHintShown = true; }
      }
      set.done = true;
      ensureAudio();
      const label = exInfo(c.wex.exId).name + ' · ' + (c.key === 'w' ? 'încălzire' : 'seria ' + (c.key + 1));
      Timer.start(c.key === 'w' ? 60 : state.settings.restSeconds, label);
    } else {
      set.done = false;
    }
    commit();
    rerenderEx(c.exIdx);
  }

  function cleanEx(wex) {
    const sets = wex.sets.filter(pairOk).map((s) => ({
      kg: isNum(s.kg) ? s.kg : 0, reps: s.reps, done: !!s.done,
      drops: (s.drops || []).filter(pairOk).map((dp) => ({ kg: isNum(dp.kg) ? dp.kg : 0, reps: dp.reps })),
    }));
    const w = wex.warmup;
    const warmup = pairOk(w) ? { kg: w.bw || !isNum(w.kg) ? 0 : w.kg, reps: w.reps, bw: !!w.bw || !isNum(w.kg) || w.kg === 0, done: !!w.done } : null;
    if (!sets.length && !warmup) return null;
    return { uid: wex.uid, exId: wex.exId, gym: wex.gym || 'General', tags: wex.tags.slice(), note: (wex.note || '').trim(), warmup, sets };
  }

  async function saveWorkout() {
    const d = state.draft;
    if (!d) return;
    const exercises = d.exercises.map(cleanEx).filter(Boolean);
    if (!exercises.length) { toast('Completează cel puțin o serie (kg × repetări) înainte de salvare.', 'warn'); return; }
    const halfDone = d.exercises.reduce((a, e) => a + [e.warmup, ...e.sets].filter((s) => isNum(s.kg) && !isNum(s.reps)).length, 0);
    if (halfDone) {
      const ok = await confirmModal({
        title: 'Serii incomplete',
        message: `${U.plural(halfDone, 'serie are', 'serii au')} doar kilogramele, fără repetări, și nu ${halfDone === 1 ? 'va fi salvată' : 'vor fi salvate'}. Salvezi oricum?`,
        confirmText: 'Salvează oricum',
      });
      if (!ok) return;
    }
    const now = Date.now();
    const orig = d.editingId ? state.workouts.find((w) => w.id === d.editingId) : null;
    const w = {
      id: d.editingId || 'w-' + U.uid(), date: d.date, templateId: d.templateId, title: d.title,
      tags: d.tags.slice(), note: (d.note || '').trim(), exercises,
      createdAt: orig ? orig.createdAt : now, updatedAt: now,
    };
    if (orig) state.workouts[state.workouts.indexOf(orig)] = w; else state.workouts.push(w);
    state.workouts = St.sortedWorkouts(state.workouts);
    state.draft = null;
    clearCaches();
    const prs = St.detectPRs(state.workouts).filter((p) => p.workoutId === w.id).length;
    lastSaved = { id: w.id, title: tplName(w), date: w.date, exercises: exercises.length, sets: St.workoutSetCount(w), volume: St.workoutVolume(w), prs };
    S.saveNow(state);
    setSaveStatus('saved');
    renderLog();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast(prs ? `Antrenament salvat — ${U.plural(prs, 'record nou', 'recorduri noi')}!` : 'Antrenament salvat.', 'success');
  }

  async function discardDraft() {
    const d = state.draft;
    if (!d) return;
    if (draftHasData(d) && !d.editingId) {
      const ok = await confirmModal({ title: 'Renunți la antrenament?', message: 'Valorile completate în tabel se vor pierde.', confirmText: 'Da, renunță', danger: true });
      if (!ok) return;
    }
    state.draft = null;
    clearCaches();
    commit();
    renderLog();
  }

  async function addGymPrompt(onDone) {
    openModal({
      title: 'Sală / aparat nou',
      size: 'sm',
      body: `<label class="field"><span class="field-label">Nume</span><input class="input" id="new-gym-name" placeholder="Ex: World Class, Stay Fit…" autocomplete="off"></label>
             <p class="field-hint mt-2">Folosește tag-ul la aparatele unde greutățile diferă de la o sală la alta (de exemplu scripeții).</p>`,
      footer: '<button type="button" class="btn btn-ghost" data-action="modal-close">Anulează</button><button type="button" class="btn btn-primary" data-action="gym-create">Adaugă</button>',
    });
    pendingGymCallback = onDone;
    setTimeout(() => { const i = $('#new-gym-name'); if (i) i.focus(); }, 30);
  }
  let pendingGymCallback = null;
  function createGym(name) {
    const n = (name || '').trim();
    if (!n) { toast('Scrie un nume pentru sală.', 'warn'); return null; }
    const existing = state.gyms.find((g) => g.toLowerCase() === n.toLowerCase());
    if (!existing) state.gyms.push(n);
    commit();
    return existing || n;
  }

  /* ---------- Fereastra "Adaugă exercițiu" ---------- */
  const normTxt = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  function pickerListHTML(q) {
    const inDraft = new Set(state.draft ? state.draft.exercises.map((e) => e.exId) : []);
    const nq = normTxt(q);
    const html = D.GROUP_ORDER.map((g) => {
      const items = allExercises().filter((e) => e.group === g && (!nq || normTxt(e.name + ' ' + e.muscle).includes(nq)));
      if (!items.length) return '';
      return `<div class="picker-group"><h4><i style="background:${D.GROUPS[g].color}"></i>${D.GROUPS[g].label}</h4>
        <div class="picker-grid">${items.map((e) => `<button type="button" class="picker-item ${inDraft.has(e.id) ? 'is-in' : ''}" data-action="pick-exercise" data-id="${esc(e.id)}"><span>${esc(e.name)}</span><small>${esc(e.muscle || '')}${inDraft.has(e.id) ? ' · deja în tabel' : ''}${e.custom ? ' · personalizat' : ''}</small></button>`).join('')}</div></div>`;
    }).join('');
    return html || '<p class="muted text-center py-6">Niciun exercițiu găsit — îl poți crea mai jos.</p>';
  }
  function openExercisePicker() {
    openModal({
      title: 'Adaugă exercițiu în tabel',
      size: 'lg',
      body: `<label class="relative block mb-4">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 muted">${icon('search', 16)}</span>
          <input class="input pl-9" id="picker-search" placeholder="Caută… (ex: presă, biceps, scripete)" autocomplete="off">
        </label>
        <div id="picker-list">${pickerListHTML('')}</div>
        <div class="stat-box mt-2">
          <div class="font-bold text-sm mb-2">Nu găsești exercițiul? Creează-l:</div>
          <div class="grid sm:grid-cols-[1fr_170px_auto] gap-2">
            <input class="input input-sm" id="new-ex-name" placeholder="Nume exercițiu (ex: Hip thrust)" autocomplete="off">
            <select class="select select-sm" id="new-ex-group" aria-label="Grupa musculară">${D.GROUP_ORDER.map((g) => `<option value="${g}">${D.GROUPS[g].label}</option>`).join('')}</select>
            <button type="button" class="btn btn-sm btn-primary" data-action="create-exercise">${icon('plus', 14)} Creează și adaugă</button>
          </div>
        </div>`,
      footer: '<button type="button" class="btn" data-action="modal-close">Închide</button>',
    });
    setTimeout(() => { const i = $('#picker-search'); if (i) i.focus(); }, 30);
  }
  function addExerciseToDraft(exId) {
    state.draft.exercises.push(newDraftExercise(exId));
    commit();
    closeModal();
    rerenderExList();
    const idx = state.draft.exercises.length - 1;
    const card = $('#ex-list [data-ex="' + idx + '"]');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast(esc(exInfo(exId).name) + ' a fost adăugat în tabel.', 'success');
  }

  /* =====================================================================
   * 2. CRONOMETRU DE PAUZĂ
   * ===================================================================== */
  let audioCtx = null;
  function ensureAudio() {
    try {
      if (!audioCtx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audioCtx = new AC();
      }
      if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { /* fără sunet */ }
  }
  /* Trei bipuri scurte și discrete, generate (fără fișiere audio). */
  function beep() {
    if (!state.settings.sound) return;
    ensureAudio();
    if (!audioCtx) return;
    const t0 = audioCtx.currentTime + 0.02;
    [0, 0.22, 0.44].forEach((off, i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.value = i === 2 ? 1175 : 880;
      g.gain.setValueAtTime(0.0001, t0 + off);
      g.gain.exponentialRampToValueAtTime(0.13, t0 + off + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.17);
      o.connect(g).connect(audioCtx.destination);
      o.start(t0 + off);
      o.stop(t0 + off + 0.2);
    });
  }

  const CIRC = 2 * Math.PI * 44;
  const Timer = {
    total: 90, remaining: 90, endAt: 0, running: false, finished: false, label: '', iv: null, el: null,
    mount() { this.el = $('#rest-timer'); this.total = this.remaining = state.settings.restSeconds; this.render(); },
    isOpen() { return this.el.classList.contains('is-open'); },
    open() {
      this.el.classList.add('is-open');
      this.el.setAttribute('aria-hidden', 'false');
      if (!this.iv) this.iv = setInterval(() => this.tick(), 200);
    },
    start(sec, label) {
      this.total = sec; this.remaining = sec; this.endAt = Date.now() + sec * 1000;
      this.running = true; this.finished = false;
      if (label) this.label = label;
      this.open(); this.render();
    },
    toggle() { if (this.finished) this.start(this.total); else if (this.running) this.pause(); else this.resume(); },
    pause() { if (!this.running) return; this.remaining = Math.max(0, (this.endAt - Date.now()) / 1000); this.running = false; this.render(); },
    resume() { if (this.remaining <= 0) { this.start(this.total); return; } this.endAt = Date.now() + this.remaining * 1000; this.running = true; this.render(); },
    reset() { this.running = false; this.finished = false; this.remaining = this.total; this.render(); },
    add(s) {
      if (this.finished) { this.start(s); return; }
      if (this.running) this.endAt += s * 1000; else this.remaining += s;
      const left = this.running ? (this.endAt - Date.now()) / 1000 : this.remaining;
      this.total = Math.max(this.total, left);
      this.render();
    },
    close() {
      this.running = false; this.finished = false;
      this.el.classList.remove('is-open', 'is-finished', 'is-paused');
      this.el.setAttribute('aria-hidden', 'true');
      clearInterval(this.iv); this.iv = null;
      document.title = BASE_TITLE;
    },
    tick() {
      if (this.running) {
        this.remaining = (this.endAt - Date.now()) / 1000;
        if (this.remaining <= 0) {
          this.remaining = 0; this.running = false; this.finished = true;
          beep();
          if (navigator.vibrate) navigator.vibrate([180, 90, 180]);
        }
      }
      this.render();
    },
    render() {
      const el = this.el;
      if (!el) return;
      const r = Math.max(0, this.remaining);
      const secs = Math.ceil(r - 0.001);
      const t = Math.floor(secs / 60) + ':' + pad2(secs % 60);
      $('#rt-time').textContent = t;
      $('#rt-progress').style.strokeDashoffset = String(CIRC * (1 - (this.total ? r / this.total : 0)));
      el.classList.toggle('is-finished', this.finished);
      el.classList.toggle('is-paused', !this.running && !this.finished);
      const head = this.finished ? 'Gata — următoarea serie!' : this.running ? 'Pauză' : 'Pauză oprită';
      $('#rt-label').innerHTML = '<b>' + head + '</b><span>' + esc(this.label || 'Cronometru') + '</span>';
      $('#rt-toggle').textContent = this.finished ? 'Din nou' : this.running ? 'Pauză' : 'Pornește';
      $$('.rt-presets button', el).forEach((b) => b.classList.toggle('is-on', +b.dataset.sec === Math.round(this.total)));
      if (this.isOpen()) document.title = (this.finished ? '✓ Gata' : '⏱ ' + t) + ' · GymLog Pro';
    },
  };

  /* =====================================================================
   * 3. ISTORIC
   * ===================================================================== */
  function renderHistory() {
    const el = $('#view-history');
    const f = state.ui.historyFilter || 'all';
    const prByW = new Map();
    St.detectPRs(state.workouts).forEach((p) => {
      if (!prByW.has(p.workoutId)) prByW.set(p.workoutId, new Set());
      prByW.get(p.workoutId).add(p.exId);
    });
    const list = St.sortedWorkouts(state.workouts).reverse().filter((w) => f === 'all' || w.templateId === f);
    const totalVol = state.workouts.reduce((a, w) => a + St.workoutVolume(w), 0);
    let lastMonth = '';
    const items = list.map((w) => {
      const m = w.date.slice(0, 7);
      const head = m !== lastMonth ? `<div class="month-head">${U.monthLabel(w.date)}</div>` : '';
      lastMonth = m;
      return head + histCardHTML(w, prByW.get(w.id));
    }).join('');

    el.innerHTML = `
      <div class="page-head">
        <div>
          <h1 class="h1">Istoric antrenamente</h1>
          <p class="lead">${U.plural(state.workouts.length, 'antrenament salvat', 'antrenamente salvate')} · ${num(totalVol / 1000, 1)} tone ridicate în total</p>
        </div>
        <div class="chip-row" role="group" aria-label="Filtrează după zi">
          <button type="button" class="chip ${f === 'all' ? 'is-on' : ''}" data-action="history-filter" data-v="all">Toate</button>
          ${state.templates.map((t) => `<button type="button" class="chip ${f === t.id ? 'is-on' : ''}" data-action="history-filter" data-v="${esc(t.id)}">${esc(t.name)}</button>`).join('')}
        </div>
      </div>
      ${list.length ? `<div class="flex flex-col gap-3">${items}</div>` : `<div class="card empty"><div class="empty-ico">${icon('history', 28)}</div><h3>Niciun antrenament aici încă</h3><p>Salvează primul antrenament din tab-ul Antrenament${f !== 'all' ? ' sau schimbă filtrul' : ''}.</p></div>`}`;
  }

  function histCardHTML(w, prSet) {
    const prCount = prSet ? prSet.size : 0;
    const exHTML = w.exercises.map((wex) => {
      const t = St.topSet(wex);
      const isPr = prSet && prSet.has(wex.exId);
      const val = t ? U.pair(t.kg, t.reps) : pairOk(wex.warmup) ? 'înc. ' + U.pair(wex.warmup.kg || 0, wex.warmup.reps) : '–';
      const gym = wex.gym !== 'General' ? ` <span class="badge badge-gym" style="height:18px;font-size:10.5px">${esc(wex.gym)}</span>` : '';
      return `<span class="hist-ex-item ${isPr ? 'is-pr' : ''}">${isPr ? icon('trophy', 13, 't-gold') : ''}${esc(exInfo(wex.exId).name)}${gym} <b>${val}</b></span>`;
    }).join('');
    const notes = [...(w.tags || []), w.note].filter(Boolean);
    return `<article class="card hist-card">
      <div class="hist-top">
        <span class="tpl-badge" style="--c:${esc(tplColor(w.templateId))}">${esc(tplName(w))}</span>
        <span class="hist-date">${U.fmtDateLong(w.date)}</span>
        ${prCount ? `<span class="badge badge-pr">${icon('trophy', 13)} ${U.plural(prCount, 'record', 'recorduri')}</span>` : ''}
        <div class="ml-auto flex items-center gap-1">
          <button type="button" class="btn btn-sm btn-ghost" data-action="history-dup" data-id="${esc(w.id)}" title="Pornește un antrenament nou cu aceleași exerciții">${icon('copy', 15)}<span class="hidden sm:inline">Repetă</span></button>
          <button type="button" class="btn btn-sm btn-ghost" data-action="history-edit" data-id="${esc(w.id)}" title="Editează valorile">${icon('edit', 15)}<span class="hidden sm:inline">Editează</span></button>
          <button type="button" class="icon-btn danger" data-action="history-delete" data-id="${esc(w.id)}" title="Șterge antrenamentul" aria-label="Șterge antrenamentul">${icon('trash', 16)}</button>
        </div>
      </div>
      <div class="hist-stats">
        <span><b>${w.exercises.length}</b> ${w.exercises.length === 1 ? 'exercițiu' : 'exerciții'}</span>
        <span><b>${St.workoutSetCount(w)}</b> serii</span>
        <span><b>${num(Math.round(St.workoutVolume(w)))}</b> kg ridicate</span>
      </div>
      <div class="hist-ex">${exHTML}</div>
      ${notes.length ? `<div class="hist-note">${icon('note', 13)} ${esc(notes.join(' · '))}</div>` : ''}
    </article>`;
  }

  async function editWorkout(id) {
    const w = state.workouts.find((x) => x.id === id);
    if (!w) return;
    if (draftHasData(state.draft)) {
      const ok = await confirmModal({ title: 'Înlocuiești antrenamentul început?', message: 'Ai un antrenament nesalvat în lucru. Dacă editezi altul, valorile nesalvate se pierd.', confirmText: 'Da, editează', danger: true });
      if (!ok) return;
    }
    const d = JSON.parse(JSON.stringify(w));
    d.editingId = w.id;
    d.exercises.forEach((e) => {
      if (!e.warmup) e.warmup = emptyWarmup();
      e.sets.forEach((s) => { s.drops = s.drops || []; });
      if (!e.sets.length) e.sets.push(emptySet());
    });
    state.draft = d;
    lastSaved = null;
    clearCaches();
    commit();
    go('log');
  }

  async function duplicateWorkout(id) {
    const w = state.workouts.find((x) => x.id === id);
    if (!w) return;
    if (draftHasData(state.draft)) {
      const ok = await confirmModal({ title: 'Înlocuiești antrenamentul început?', message: 'Valorile nesalvate din tabel se vor pierde.', confirmText: 'Da, continuă', danger: true });
      if (!ok) return;
    }
    createDraft({ templateId: w.templateId, title: tplName(w), items: w.exercises.map((e) => ({ exId: e.exId, gym: e.gym })) });
  }

  async function deleteWorkout(id) {
    const w = state.workouts.find((x) => x.id === id);
    if (!w) return;
    const ok = await confirmModal({
      title: 'Ștergi antrenamentul?',
      message: `<b>${esc(tplName(w))}</b> din ${U.fmtDateLong(w.date)} va fi șters definitiv (poți face înainte un Export JSON din Setări).`,
      confirmText: 'Șterge', danger: true,
    });
    if (!ok) return;
    state.workouts = state.workouts.filter((x) => x.id !== id);
    if (state.draft && state.draft.editingId === id) state.draft = null;
    clearCaches();
    commit();
    render();
    toast('Antrenamentul a fost șters.', 'success');
  }

  /* =====================================================================
   * 4. PROGRES & STATISTICI
   * ===================================================================== */
  function kpiHTML(label, value, sub, ic, color, textValue) {
    return `<div class="card kpi" style="--c:${color}">
      <div class="kpi-top"><span class="kpi-label">${label}</span><span class="kpi-ico">${icon(ic, 17)}</span></div>
      <div class="kpi-value ${textValue ? 'is-text' : ''}">${value}</div>
      <div class="kpi-sub">${sub}</div>
    </div>`;
  }

  function renderProgress() {
    const el = $('#view-progress');
    const ws = state.workouts;
    const head = `<div class="page-head"><div><h1 class="h1">Progres &amp; Statistici</h1><p class="lead">Cum evoluezi, explicat simplu — fără formule.</p></div></div>`;
    if (!ws.length) {
      el.innerHTML = head + `<div class="card empty"><div class="empty-ico">${icon('chart', 28)}</div><h3>Încă nu există date</h3><p>Salvează primul antrenament sau încarcă datele reale din Setări.</p><button type="button" class="btn btn-primary mt-4" data-action="reset-demo">${icon('reset', 15)} Încarcă datele reale</button></div>`;
      return;
    }
    const k = St.kpis(ws);
    const isCurMonth = k.last.slice(0, 7) === U.today().slice(0, 7);
    const best = k.best && k.best.pct > 0 ? k.best : null;
    let bestSub = 'Mai adaugă sesiuni ca să-ți arăt progresul.';
    if (best) {
      const what = best.dKg > 0 ? `+${num(best.dKg)} kg (${num(best.first.top.kg)} → ${num(best.last.top.kg)} kg)` : `+${U.plural(best.dReps, 'repetare', 'repetări')} la ${num(best.last.top.kg)} kg`;
      bestSub = `<b class="t-up">${what}</b> · ${fmtDate(best.first.date)} → ${fmtDate(best.last.date)}`;
    }

    el.innerHTML = head + `
      <div class="kpi-grid">
        ${kpiHTML('Antrenamente totale', String(k.total), `din ${fmtDate(k.first)} până pe ${fmtDate(k.last)}`, 'dumbbell', '#7b8cff')}
        ${kpiHTML('Frecvență pe săptămână', num(k.perWeek, 1) + '<small>/ săpt.</small>', `ultimele 4 săpt.: ${U.plural(k.last4w, 'antrenament', 'antrenamente')}`, 'calendar', '#38bdf8')}
        ${kpiHTML(isCurMonth ? 'PR-uri doborâte luna aceasta' : 'PR-uri doborâte în ' + k.monthName, String(k.prMonth.length) + '<small>recorduri</small>', `${U.plural(k.prs.length, 'record', 'recorduri')} de la început`, 'trophy', '#fbbf24')}
        ${kpiHTML('Cel mai mare progres', best ? esc(exInfo(best.exId).name) : '—', bestSub, 'flame', '#34d399', true)}
      </div>

      <div class="grid lg:grid-cols-3 gap-4 mt-4 items-start">
        <div class="card lg:col-span-2" id="pc-card"></div>
        <div class="card" id="cmp-card"></div>
      </div>

      <div class="grid lg:grid-cols-3 gap-4 mt-4 items-start">
        <div class="card" id="donut-card"></div>
        <div class="card" id="weekly-card"></div>
        <div class="card" id="pr-card">${prCardInner(k.prs)}</div>
      </div>`;

    renderProgressChartCard();
    renderCompareCard();
    renderDonutCard();
    renderWeeklyCard();
  }

  function renderProgressChartCard() {
    const card = $('#pc-card');
    if (!card) return;
    const ws = state.workouts;
    const idx = St.buildIndex(ws);
    const exIds = Array.from(idx.keys()).filter((id) => idx.get(id).some((e) => e.hasWork));
    let sel = state.ui.progressEx;
    if (!exIds.includes(sel)) {
      const lastW = St.sortedWorkouts(ws).pop();
      const first = lastW.exercises.find((e) => St.hasWork(e));
      sel = first ? first.exId : exIds[0];
      state.ui.progressEx = sel;
    }
    const gyms = St.gymsFor(ws, sel);
    let gymSel = state.ui.progressGym || 'all';
    if (gymSel !== 'all' && !gyms.includes(gymSel)) gymSel = 'all';
    state.ui.progressGym = gymSel;
    const series = St.progressSeries(ws, sel, gymSel);
    const sum = St.progressSummary(series);
    const name = exInfo(sel).name;
    const verdictTxt = { up: '▲ Progres', same: '= Stabil', down: '▼ În scădere', new: '★ Început' }[sum.verdict];

    const options = D.GROUP_ORDER.map((g) => {
      const list = exIds.filter((id) => exInfo(id).group === g).sort((a, b) => exInfo(a).name.localeCompare(exInfo(b).name, 'ro'));
      if (!list.length) return '';
      return `<optgroup label="${D.GROUPS[g].label}">${list.map((id) => {
        const n = idx.get(id).filter((e) => e.hasWork).length;
        return `<option value="${esc(id)}" ${id === sel ? 'selected' : ''}>${esc(exInfo(id).name)} · ${U.plural(n, 'sesiune', 'sesiuni')}</option>`;
      }).join('')}</optgroup>`;
    }).join('');

    card.innerHTML = `
      <div class="card-head">
        <div>
          <h2 class="card-title">${icon('chart', 18)} Evoluție pe exercițiu</h2>
          <p class="card-sub">Linia = cea mai grea serie (kg) · Barele = repetări totale · <span class="t-gold">◆</span> = record personal</p>
        </div>
        <select class="select w-full sm:w-auto sm:min-w-[270px]" data-role="progress-ex" aria-label="Alege exercițiul">${options}</select>
      </div>
      ${gyms.length > 1 ? `<div class="flex flex-wrap items-center gap-2 mb-3">
        <span class="badge badge-same">${icon('warn', 13)} Exercițiul a fost făcut în săli diferite</span>
        <div class="chip-row">${['all', ...gyms].map((g) => `<button type="button" class="chip ${g === gymSel ? 'is-on' : ''}" data-action="progress-gym" data-v="${esc(g)}">${g === 'all' ? 'Toate sălile' : esc(g)}</button>`).join('')}</div>
      </div>` : ''}
      <div class="chart-box h-[290px] lg:h-[310px]"><canvas id="chart-progress" role="img" aria-label="Grafic: evoluția la ${esc(name)}"></canvas></div>
      <div class="summary">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="font-bold">${esc(name)} — pe scurt</span>
          <span class="verdict ${sum.verdict}">${verdictTxt}</span>
        </div>
        <ul>${sum.lines.map((l) => '<li>' + l + '</li>').join('')}</ul>
        <div class="stat-chips">
          <span class="stat-chip">${icon('trophy', 14, 't-gold')} Cea mai bună serie: <b>${num(sum.best.maxKg)} kg × ${sum.best.topReps}</b> (${fmtDate(sum.best.date)})</span>
          <span class="stat-chip">${icon('calendar', 14)} <b>${U.plural(sum.sessions, 'sesiune', 'sesiuni')}</b></span>
          <span class="stat-chip">${icon('dumbbell', 14)} Ultima dată ai ridicat în total <b>${num(Math.round(sum.last.volume))} kg</b></span>
        </div>
      </div>`;
    C.renderProgress($('#chart-progress'), series);
  }

  function cmpBadges(r) {
    if (r.status === 'new') return '<span class="badge badge-new">★ Nou</span>';
    const out = [];
    if (r.dKg > 0) out.push(`<span class="badge badge-up">▲ +${num(r.dKg)} kg</span>`);
    if (r.dKg < 0) out.push(`<span class="badge badge-down">▼ −${num(-r.dKg)} kg</span>`);
    if (r.dReps > 0) out.push(`<span class="badge badge-up">▲ +${r.dReps} rep</span>`);
    if (r.dReps < 0) out.push(`<span class="badge badge-down">▼ −${-r.dReps} rep</span>`);
    if (!out.length) out.push('<span class="badge badge-same">= constant</span>');
    return out.join('');
  }

  function renderCompareCard() {
    const card = $('#cmp-card');
    if (!card) return;
    const sorted = St.sortedWorkouts(state.workouts);
    const w = sorted.find((x) => x.id === state.ui.compareId) || sorted[sorted.length - 1];
    const rows = St.compareWorkout(state.workouts, w);
    const cnt = { up: 0, same: 0, down: 0, new: 0 };
    rows.forEach((r) => { cnt[r.status] += 1; });

    const rowHTML = (r) => {
      const name = esc(exInfo(r.wex.exId).name);
      const gymTag = r.wex.gym !== 'General' ? ' · ' + esc(r.wex.gym) : '';
      const sub = r.status === 'new'
        ? 'prima dată' + gymTag
        : `înainte (${fmtDate(r.prevDate)}): ${U.pair(r.prev.kg, r.prev.reps)}${r.sameGym ? gymTag : ' · <span class="t-same">altă sală</span>'}`;
      return `<tr class="${r.status}">
        <td><div class="cmp-name">${name}</div><div class="cmp-sub">${sub}</div></td>
        <td class="cmp-val"><b>${U.pair(r.cur.kg, r.cur.reps)}</b></td>
        <td><span class="cmp-badges">${cmpBadges(r)}</span></td>
      </tr>`;
    };

    card.innerHTML = `
      <div class="card-head">
        <div>
          <h2 class="card-title">${icon('target', 18)} Azi vs. tura trecută</h2>
          <p class="card-sub">Cea mai grea serie a fiecărui exercițiu, comparată cu sesiunea lui anterioară</p>
        </div>
      </div>
      <select class="select select-sm mb-2" data-role="compare-workout" aria-label="Alege antrenamentul">
        ${sorted.slice().reverse().map((x) => `<option value="${esc(x.id)}" ${x.id === w.id ? 'selected' : ''}>${U.fmtDateLong(x.date)} · ${esc(tplName(x))}</option>`).join('')}
      </select>
      ${rows.length ? `<table class="cmp-table">
        <thead><tr><th>Exercițiu</th><th>Azi</th><th style="text-align:right">Diferență</th></tr></thead>
        <tbody>${rows.map(rowHTML).join('')}</tbody>
      </table>` : '<p class="muted text-sm py-4">Antrenamentul nu are serii de lucru de comparat.</p>'}
      <div class="cmp-legend">
        <span><i style="background:var(--up)"></i>${cnt.up} mai bine</span>
        <span><i style="background:var(--same)"></i>${cnt.same} constant</span>
        <span><i style="background:var(--down)"></i>${cnt.down} mai slab</span>
        ${cnt.new ? `<span><i style="background:var(--brand)"></i>${cnt.new} ${cnt.new === 1 ? 'nou' : 'noi'}</span>` : ''}
      </div>`;
  }

  function renderDonutCard() {
    const card = $('#donut-card');
    if (!card) return;
    const range = state.ui.donutRange === undefined ? 30 : +state.ui.donutRange;
    const dist = St.groupDistribution(state.workouts, range, exInfo, D.GROUPS, D.GROUP_ORDER);
    const nonZero = dist.items.filter((i) => i.sets > 0).sort((a, b) => b.sets - a.sets);
    const most = nonZero[0];
    const least = dist.items.slice().sort((a, b) => a.sets - b.sets)[0];
    const rangeTxt = range ? `Ultimele ${range} de zile (până la ${fmtDate(dist.end)})` : 'Tot istoricul';
    let insight = 'Niciun antrenament în această perioadă — alege o perioadă mai lungă.';
    if (most) {
      insight = `Cel mai des ai lucrat <b>${most.label}</b> (${Math.round(most.pct * 100)}% din serii).`;
      if (least && least.key !== most.key) insight += ` Cel mai puțin: <b>${least.label}</b> (${Math.round(least.pct * 100)}%)${least.pct < 0.1 ? ' — poate merită mai multă atenție.' : '.'}`;
    }
    card.innerHTML = `
      <div class="card-head">
        <div>
          <h2 class="card-title">${icon('pie', 18)} Grupe musculare lucrate</h2>
          <p class="card-sub">${rangeTxt} · ${U.plural(dist.workouts || 0, 'antrenament', 'antrenamente')}</p>
        </div>
        <div class="seg" role="group" aria-label="Perioadă">
          ${[[30, '30 zile'], [90, '90 zile'], [0, 'Tot']].map(([v, l]) => `<button type="button" class="${v === range ? 'is-on' : ''}" data-action="donut-range" data-v="${v}">${l}</button>`).join('')}
        </div>
      </div>
      <div class="grid grid-cols-[140px_1fr] sm:grid-cols-[160px_1fr] gap-4 items-center">
        <div class="chart-box h-[150px] sm:h-[160px]"><canvas id="chart-donut" role="img" aria-label="Distribuția seriilor pe grupe musculare"></canvas></div>
        <div class="legend-list">${dist.items.map((i) => `<div class="legend-item">
            <span class="legend-dot" style="background:${i.color}"></span><span>${i.label}</span><b class="num-font">${Math.round(i.pct * 100)}%</b>
            <div class="legend-bar"><span style="width:${(i.pct * 100).toFixed(1)}%;background:${i.color}"></span></div>
          </div>`).join('')}</div>
      </div>
      <div class="info-box">${insight}</div>`;
    if (dist.total) C.renderDonut($('#chart-donut'), dist);
  }

  function renderWeeklyCard() {
    const card = $('#weekly-card');
    if (!card) return;
    const weeks = St.weeklyCounts(state.workouts, 10);
    const active = weeks.filter((w) => w.count > 0).length;
    card.innerHTML = `
      <div class="card-head">
        <div>
          <h2 class="card-title">${icon('calendar', 18)} Constanță</h2>
          <p class="card-sub">Antrenamente pe săptămână (ultimele 10)</p>
        </div>
      </div>
      <div class="chart-box h-[176px]"><canvas id="chart-weekly" role="img" aria-label="Antrenamente pe săptămână"></canvas></div>
      <div class="info-box">Ai fost la sală în <b>${active} din 10</b> săptămâni. Pentru progres constant, ținta e <b>2–4 antrenamente</b> pe săptămână — barele verzi arată săptămânile în care ai atins-o.</div>`;
    C.renderWeekly($('#chart-weekly'), weeks);
  }

  function prCardInner(prs) {
    const recent = prs.slice(-6).reverse();
    return `
      <div class="card-head">
        <div>
          <h2 class="card-title">${icon('trophy', 18)} Recorduri recente</h2>
          <p class="card-sub">Comparate doar cu aceeași sală / același aparat</p>
        </div>
        <span class="badge badge-pr">${prs.length} total</span>
      </div>
      ${recent.length ? `<div class="pr-list">${recent.map((p) => `<div class="pr-item">
          <span class="pr-ico">${icon('trophy', 16)}</span>
          <div class="pr-main">
            <div class="pr-name">${esc(exInfo(p.exId).name)}</div>
            <div class="pr-sub">${fmtDate(p.date)} · ${p.type === 'kg' ? `greutate nouă: +${num(p.delta)} kg` : `+${U.plural(p.delta, 'repetare', 'repetări')} la aceeași greutate`}</div>
          </div>
          <b class="num-font">${U.pair(p.kg, p.reps)}</b>
        </div>`).join('')}</div>` : '<p class="muted text-sm">Primul record apare când bați prima sesiune la un exercițiu.</p>'}`;
  }

  /* =====================================================================
   * 5. CORP — profil biometric
   * ===================================================================== */
  const currentWeight = () => (state.weightLog.length ? state.weightLog[state.weightLog.length - 1].kg : null);

  function upsertWeight(date, kg) {
    const e = state.weightLog.find((x) => x.date === date);
    if (e) e.kg = kg; else state.weightLog.push({ date, kg });
    state.weightLog.sort((a, b) => a.date.localeCompare(b.date));
  }

  function renderBody() {
    const el = $('#view-body');
    el.innerHTML = `
      <div class="page-head">
        <div>
          <h1 class="h1">Profil biometric &amp; corp</h1>
          <p class="lead">Datele tale de bază, cu explicații pe înțelesul tuturor. Se salvează automat.</p>
        </div>
      </div>
      <div class="grid lg:grid-cols-3 gap-4 items-start">
        <div class="card" id="profile-card">${profileFormHTML()}</div>
        <div class="lg:col-span-2 flex flex-col gap-4">
          <div class="grid md:grid-cols-2 gap-4 items-start" id="body-metrics">${metricsHTML()}</div>
          <div class="card" id="weight-card"></div>
        </div>
      </div>`;
    renderWeightCard();
  }

  function profileFormHTML() {
    const p = state.profile;
    const w = currentWeight();
    const last = state.weightLog[state.weightLog.length - 1];
    return `
      <div class="card-head"><div><h2 class="card-title">${icon('user', 18)} Datele tale</h2><p class="card-sub">Folosite pentru IMC și necesarul caloric</p></div></div>
      <div class="flex flex-col gap-4">
        <div class="field"><span class="field-label">Sex</span>
          <div class="seg full" role="group" aria-label="Sex">${[['M', 'Masculin'], ['F', 'Feminin']].map(([v, l]) => `<button type="button" class="${p.sex === v ? 'is-on' : ''}" data-action="profile-set" data-k="sex" data-v="${v}">${l}</button>`).join('')}</div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <label class="field"><span class="field-label">Vârstă (ani)</span><input class="input" inputmode="numeric" data-profile="age" value="${p.age ?? ''}" placeholder="ex: 22"></label>
          <label class="field"><span class="field-label">Înălțime (cm)</span><input class="input" inputmode="numeric" data-profile="height" value="${p.height ?? ''}" placeholder="ex: 180"></label>
        </div>
        <label class="field"><span class="field-label">Greutate actuală (kg)</span>
          <input class="input" inputmode="decimal" data-profile="weight" value="${fmtInput(w)}" placeholder="ex: 78,5">
          <span class="field-hint">${last ? `Ultima cântărire: ${fmtDate(last.date)}. O valoare nouă se adaugă în istoric cu data de azi.` : 'Se adaugă în istoricul greutății cu data de azi.'}</span>
        </label>
        <div class="field"><span class="field-label">Obiectiv</span>
          <div class="seg full" role="group" aria-label="Obiectiv">${Object.entries(St.GOALS).map(([k, g]) => `<button type="button" class="${p.goal === k ? 'is-on' : ''}" data-action="profile-set" data-k="goal" data-v="${k}">${g.label}</button>`).join('')}</div>
        </div>
        <label class="field"><span class="field-label">Nivel de activitate</span>
          <select class="select" data-profile="activity">${St.ACTIVITY.map((a) => `<option value="${a.v}" ${a.v === p.activity ? 'selected' : ''}>${a.label}</option>`).join('')}</select>
        </label>
      </div>`;
  }

  function metricsHTML() {
    const p = state.profile;
    const w = currentWeight();
    const b = St.bmi(p.height, w);
    const cal = St.calories(p, w);

    let bmiCard;
    if (!b) {
      bmiCard = `<div class="card"><div class="card-head"><h2 class="card-title">${icon('scale', 18)} IMC</h2></div><p class="muted">Completează înălțimea și greutatea ca să calculez indicele de masă corporală.</p></div>`;
    } else {
      const explain = {
        under: 'Ești sub greutatea recomandată. Pentru masă musculară mănâncă în surplus caloric și pune accent pe proteine.',
        normal: p.goal === 'hipertrofie'
          ? 'Ești în zona sănătoasă și ai loc să adaugi masă musculară — un surplus mic de calorii e ideal.'
          : 'Ești în zona sănătoasă. Menține-te activ și urmărește progresul la sală.',
        over: 'Atenție: IMC-ul <b>nu face diferența între mușchi și grăsime</b>. Dacă ridici greu și ai talia subțire, valoarea vine probabil din masă musculară.',
        obese: 'Valoare ridicată. Antrenamentul cu greutăți plus un deficit caloric moderat ajută; un medic sau un nutriționist te poate ghida.',
      }[b.cat.key];
      bmiCard = `<div class="card">
        <div class="card-head"><div><h2 class="card-title">${icon('scale', 18)} Indicele de masă corporală</h2><p class="card-sub">IMC = greutate ÷ înălțime² (în metri)</p></div></div>
        <div class="flex flex-wrap items-end gap-3">
          <span class="bmi-value" style="color:${b.cat.color}">${num(b.value, 1)}</span>
          <span class="badge mb-1" style="color:${b.cat.color};background:color-mix(in srgb, ${b.cat.color} 15%, transparent)">${b.cat.label}</span>
        </div>
        <div class="bmi-bar" aria-hidden="true">
          <span class="bmi-seg" style="flex:17.5;background:#60a5fa"></span>
          <span class="bmi-seg" style="flex:32.5;background:#34d399"></span>
          <span class="bmi-seg" style="flex:25;background:#fbbf24"></span>
          <span class="bmi-seg" style="flex:25;background:#f87171"></span>
          <span class="bmi-marker" style="left:${(b.pct * 100).toFixed(1)}%" data-v="${num(b.value, 1)}"></span>
        </div>
        <div class="bmi-scale" style="grid-template-columns:17.5fr 32.5fr 25fr 25fr">
          <span>Sub<br>&lt;18,5</span><span>Normal<br>18,5–25</span><span>Supraponderal / mușchi<br>25–30</span><span>Obezitate<br>30+</span>
        </div>
        <div class="info-box">${explain}</div>
      </div>`;
    }

    let calCard;
    if (!cal) {
      calCard = `<div class="card"><div class="card-head"><h2 class="card-title">${icon('flame', 18)} Necesar caloric</h2></div><p class="muted">Completează vârsta, înălțimea și greutatea.</p></div>`;
    } else {
      const g = cal.goal;
      const explain = p.goal === 'definire'
        ? `<b>Pe înțeles:</b> corpul tău consumă cam <b>${num(cal.maintenance)} kcal</b> pe zi. Ca să arzi grăsime, mănânci puțin sub (≈ ${num(cal.target)} kcal), cu multe proteine, ca să nu pierzi mușchi.`
        : p.goal === 'forta'
          ? `<b>Pe înțeles:</b> corpul tău consumă cam <b>${num(cal.maintenance)} kcal</b> pe zi. Un mic plus (≈ ${num(cal.target)} kcal) susține recuperarea și creșterea forței.`
          : `<b>Pe înțeles:</b> corpul tău consumă cam <b>${num(cal.maintenance)} kcal</b> pe zi. Ca să construiești mușchi îi dai puțin în plus (≈ ${num(cal.target)} kcal) — „material de construcție”, fără să pui multă grăsime.`;
      calCard = `<div class="card">
        <div class="card-head"><div><h2 class="card-title">${icon('flame', 18)} Necesar caloric zilnic</h2><p class="card-sub">Estimare (Mifflin-St Jeor × nivel de activitate)</p></div></div>
        <div class="cal-grid">
          <div class="cal-item"><div class="eyebrow">Menținere</div><div class="cal-num">${num(cal.maintenance)}<small>kcal</small></div><div class="text-xs muted">greutatea rămâne la fel</div></div>
          <div class="cal-item is-goal"><div class="eyebrow">${esc(g.label)}</div><div class="cal-num">${num(cal.target)}<small>kcal</small></div><div class="text-xs muted">${cal.delta > 0 ? '+' : '−'}${Math.abs(cal.delta)} kcal față de menținere</div></div>
        </div>
        <div class="grid grid-cols-2 gap-2 mt-2">
          <div class="stat-box"><div class="v">${cal.protein} g</div><div class="l">proteine / zi (${num(cal.proteinPerKg)} g/kg)</div></div>
          <div class="stat-box"><div class="v">${num(cal.bmr)}</div><div class="l">kcal în repaus total</div></div>
        </div>
        <div class="info-box">${explain}</div>
      </div>`;
    }
    return bmiCard + calCard;
  }

  function renderWeightCard() {
    const card = $('#weight-card');
    if (!card) return;
    const log = state.weightLog;
    const tr = St.weightTrend(log, state.profile.goal);
    const sub = tr
      ? `De la ${fmtDate(tr.first.date)}: <b class="${tr.diff >= 0 ? 't-up' : 't-down'}">${U.signed(tr.diff)} kg</b> (${num(tr.first.kg)} → ${num(tr.last.kg)} kg)`
      : 'Adaugă cel puțin două cântăriri ca să vezi evoluția.';
    card.innerHTML = `
      <div class="card-head">
        <div><h2 class="card-title">${icon('chart', 18)} Evoluția greutății corporale</h2><p class="card-sub">${sub}</p></div>
        <div class="flex flex-wrap items-center gap-2">
          <input type="date" class="input input-sm w-auto" id="w-date" value="${U.today()}" aria-label="Data cântăririi">
          <input class="input input-sm w-[88px]" id="w-kg" inputmode="decimal" placeholder="kg" aria-label="Greutate în kg">
          <button type="button" class="btn btn-sm btn-primary" data-action="weight-add">${icon('plus', 14)} Adaugă</button>
        </div>
      </div>
      ${log.length ? `<div class="chart-box h-[230px]"><canvas id="chart-weight" role="img" aria-label="Grafic: evoluția greutății corporale"></canvas></div>` : `<div class="empty">${icon('scale', 26)}<p class="mt-2">Nicio cântărire încă.</p></div>`}
      ${tr ? `<div class="info-box"><span class="badge ${tr.status === 'ok' ? 'badge-up' : 'badge-same'}">${U.signed(tr.perWeek, 2)} kg / săpt.</span> ${tr.advice}</div>` : ''}
      ${log.length ? `<details class="mt-3"><summary class="text-sm muted cursor-pointer select-none">Toate cântăririle (${log.length})</summary>
        <div class="weight-list mt-2">${log.slice().reverse().map((e) => `<div class="weight-row"><span>${U.fmtDateLong(e.date)}</span><span class="flex items-center gap-2"><b>${num(e.kg)} kg</b><button type="button" class="icon-btn xs danger" data-action="weight-delete" data-date="${e.date}" aria-label="Șterge cântărirea">${icon('x', 12)}</button></span></div>`).join('')}</div>
      </details>` : ''}`;
    if (log.length) C.renderWeight($('#chart-weight'), log);
  }

  function refreshBody(withWeight) {
    const m = $('#body-metrics');
    if (m) m.innerHTML = metricsHTML();
    if (withWeight) renderWeightCard();
  }

  /* =====================================================================
   * 6. SETĂRI
   * ===================================================================== */
  function renderSettings() {
    const el = $('#view-settings');
    const avail = S.isAvailable();
    el.innerHTML = `
      <div class="page-head"><div><h1 class="h1">Setări &amp; date</h1><p class="lead">Backup, resetare, cronometru, șabloane și săli.</p></div></div>
      <div class="grid lg:grid-cols-2 gap-4 items-start">
        <div class="card">
          <div class="card-head"><div><h2 class="card-title">${icon('save', 18)} Datele tale</h2><p class="card-sub">${avail ? 'Salvate automat în acest browser (localStorage)' : 'localStorage indisponibil — folosește Export JSON'}</p></div></div>
          <div class="grid grid-cols-3 gap-2 mb-3">
            <div class="stat-box"><div class="v">${state.workouts.length}</div><div class="l">antrenamente</div></div>
            <div class="stat-box"><div class="v">${state.weightLog.length}</div><div class="l">cântăriri</div></div>
            <div class="stat-box"><div class="v">${num(S.sizeKB(), 1)} KB</div><div class="l">spațiu folosit</div></div>
          </div>
          <div class="set-row"><div><div class="set-row-title">Export JSON</div><div class="set-row-sub">Descarcă un fișier de backup cu tot istoricul.</div></div><button type="button" class="btn btn-sm" data-action="export">${icon('download', 15)} Export</button></div>
          <div class="set-row"><div><div class="set-row-title">Import JSON</div><div class="set-row-sub">Încarcă un backup (înlocuiește datele actuale).</div></div><button type="button" class="btn btn-sm" data-action="import">${icon('upload', 15)} Import</button></div>
          <div class="set-row"><div><div class="set-row-title">Resetează / Încarcă date reale</div><div class="set-row-sub">Readuce cele ${D.REAL_HISTORY_COUNT} sesiuni reale (22 Sept – 20 Nov) și profilul demo.</div></div><button type="button" class="btn btn-sm btn-success" data-action="reset-demo">${icon('reset', 15)} Încarcă</button></div>
          <div class="set-row"><div><div class="set-row-title">Șterge tot</div><div class="set-row-sub">Pornești de la zero. Șabloanele rămân.</div></div><button type="button" class="btn btn-sm btn-danger" data-action="clear-all">${icon('trash', 15)} Șterge tot</button></div>
        </div>

        ${pwaCardHTML()}

        <div class="card">
          <div class="card-head"><div><h2 class="card-title">${icon('timer', 18)} Cronometru de pauză</h2><p class="card-sub">Pornește automat când bifezi o serie</p></div></div>
          <div class="set-row"><div><div class="set-row-title">Pauză implicită</div><div class="set-row-sub">Încălzirea folosește 60s.</div></div>
            <div class="seg">${[60, 90, 120, 180].map((v) => `<button type="button" class="${state.settings.restSeconds === v ? 'is-on' : ''}" data-action="rest-default" data-v="${v}">${v}s</button>`).join('')}</div></div>
          <div class="set-row"><div><div class="set-row-title">Alertă sonoră la final</div><div class="set-row-sub">Trei bipuri scurte, discrete (+ vibrație pe telefon).</div></div>
            <div class="flex items-center gap-2"><button type="button" class="btn btn-sm btn-ghost" data-action="test-sound">Testează</button><label class="switch"><input type="checkbox" data-setting="sound" ${state.settings.sound ? 'checked' : ''} aria-label="Alertă sonoră"><span></span></label></div></div>
        </div>

        <div class="card" id="templates-card">
          <div class="card-head"><div><h2 class="card-title">${icon('dumbbell', 18)} Șabloane de antrenament</h2><p class="card-sub">Zilele afișate în pagina Antrenament</p></div>
            <button type="button" class="btn btn-sm btn-primary" data-action="tpl-new">${icon('plus', 14)} Șablon nou</button></div>
          <div class="flex flex-col gap-2">${state.templates.map((t) => `<div class="tpl-row">
              <span class="dot" style="background:${esc(t.color)}"></span>
              <div class="min-w-0 flex-1"><div class="font-semibold text-sm">${esc(t.name)}</div><div class="text-xs muted truncate">${esc(t.subtitle)} · ${U.plural(t.items.length, 'exercițiu', 'exerciții')}</div></div>
              <button type="button" class="btn btn-sm btn-ghost" data-action="tpl-edit" data-id="${esc(t.id)}">${icon('edit', 14)}<span class="hidden sm:inline">Editează</span></button>
              <button type="button" class="icon-btn danger" data-action="tpl-delete" data-id="${esc(t.id)}" aria-label="Șterge șablonul">${icon('trash', 15)}</button>
            </div>`).join('') || '<p class="muted text-sm">Niciun șablon.</p>'}</div>
          <button type="button" class="btn btn-sm btn-ghost mt-3" data-action="tpl-restore">${icon('reset', 14)} Restaurează șabloanele implicite</button>
        </div>

        <div class="card">
          <div class="card-head"><div><h2 class="card-title">${icon('gym', 18)} Săli / aparate</h2><p class="card-sub">Tag-uri pentru aparatele unde greutățile diferă</p></div></div>
          <div class="chip-row mb-3">${state.gyms.map((g) => `<span class="chip">${esc(g)}${g !== 'General' ? `<button type="button" class="icon-btn xs" data-action="gym-remove" data-gym="${esc(g)}" aria-label="Elimină ${esc(g)}">${icon('x', 11)}</button>` : ''}</span>`).join('')}</div>
          <div class="flex gap-2"><input class="input input-sm" id="gym-new" placeholder="Ex: World Class" autocomplete="off"><button type="button" class="btn btn-sm" data-action="gym-add">${icon('plus', 14)} Adaugă</button></div>
          <div class="info-box">Recordurile și comparațiile se fac <b>doar între sesiuni din aceeași sală</b>: 50 kg la scripetele din „Salsa” nu e același lucru cu 50 kg la „Columbia”.</div>
        </div>
      </div>
      <p class="text-center text-xs muted mt-8">GymLog Pro · HTML5 + Tailwind CSS + Chart.js + Vanilla JavaScript · Proiect TPI — „Claude AI and web development”</p>`;
  }

  /* =====================================================================
   * 7. APLICAȚIE PE TELEFON (PWA) — instalare + funcționare fără internet
   * Service worker-ul (sw.js) merge doar de pe https sau localhost, nu din file://.
   * ===================================================================== */
  const PWA = {
    prompt: null,
    offlineReady: false,
    fromFile: location.protocol === 'file:',
    isIOS: /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
    installed: (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true,
    init() {
      if (this.fromFile || !('serviceWorker' in navigator) || !window.isSecureContext) return;
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('[GymLog] Service worker neînregistrat:', e));
      navigator.serviceWorker.ready.then(() => { this.offlineReady = true; this.refresh(); });
      // Chrome / Edge: păstrăm evenimentul ca să afișăm butonul "Instalează aplicația".
      window.addEventListener('beforeinstallprompt', (e) => { this.prompt = e; this.refresh(); });
      window.addEventListener('appinstalled', () => {
        this.prompt = null;
        this.installed = true;
        this.refresh();
        toast('GymLog a fost instalat — îl găsești pe ecranul principal.', 'success');
      });
      // Cere browserului să nu șteargă datele (localStorage) când are nevoie de spațiu.
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    },
    refresh() { const c = $('#pwa-card'); if (c) c.outerHTML = pwaCardHTML(); },
    async install() {
      if (!this.prompt) return;
      this.prompt.prompt();
      try { await this.prompt.userChoice; } catch (e) { /* închis de utilizator */ }
      this.prompt = null;
      this.refresh();
    },
  };

  function pwaCardHTML() {
    const ok = (t) => `<div class="flex items-center gap-2 text-sm">${icon('check', 16, 't-up')}<span>${t}</span></div>`;
    let body;
    if (PWA.fromFile) {
      body = `<div class="info-box mt-0">Acum aplicația e deschisă <b>din fișier</b> (dublu-click). Ca s-o instalezi pe telefon, deschide-o o dată de pe <b>link-ul https</b> al site-ului (de exemplu GitHub Pages — pașii sunt în README.md), apoi revino aici.</div>`;
    } else {
      const rows = [];
      if (PWA.installed) rows.push(ok('Instalată — rulează ca aplicație, pe tot ecranul'));
      if (PWA.offlineReady) rows.push(ok('Funcționează <b>fără internet</b> (fișierele sunt salvate pe dispozitiv)'));
      else rows.push(`<div class="flex items-center gap-2 text-sm muted">${icon('wifiOff', 16)}<span>Se pregătește modul offline…</span></div>`);
      let how = '';
      if (!PWA.installed) {
        if (PWA.prompt) how = `<button type="button" class="btn btn-primary mt-3" data-action="pwa-install">${icon('download', 16)} Instalează aplicația</button>`;
        else if (PWA.isIOS) how = '<div class="info-box">Pe iPhone: în <b>Safari</b> apasă <b>Partajează</b> → <b>Adaugă pe ecranul principal</b>.</div>';
        else how = '<div class="info-box">În Chrome: meniul <b>⋮</b> → <b>Instalează aplicația</b> (sau <b>Adaugă pe ecranul de pornire</b>).</div>';
      }
      body = `<div class="flex flex-col gap-2">${rows.join('')}</div>${how}`;
    }
    return `<div class="card" id="pwa-card">
      <div class="card-head"><div><h2 class="card-title">${icon('phone', 18)} Aplicație pe telefon</h2><p class="card-sub">Se instalează cu iconiță proprie și merge fără internet</p></div></div>
      ${body}
      <p class="field-hint mt-3">Datele stau doar pe dispozitivul pe care le notezi. Pentru backup sau mutare pe alt dispozitiv: Export / Import JSON.</p>
    </div>`;
  }

  /* ---------- Editor de șabloane ---------- */
  let tplDraft = null;
  function exerciseOptionsHTML() {
    return D.GROUP_ORDER.map((g) => `<optgroup label="${D.GROUPS[g].label}">${allExercises().filter((e) => e.group === g).map((e) => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join('')}</optgroup>`).join('');
  }
  function openTemplateEditor(id) {
    const t = id ? tplById(id) : null;
    tplDraft = t ? JSON.parse(JSON.stringify(t)) : { id: null, name: '', subtitle: '', color: D.TEMPLATE_COLORS[state.templates.length % D.TEMPLATE_COLORS.length], items: [] };
    openModal({
      title: t ? 'Editează șablonul' : 'Șablon nou',
      size: 'lg',
      body: '<div id="tpl-editor"></div>',
      footer: `<button type="button" class="btn btn-ghost" data-action="modal-close">Anulează</button><button type="button" class="btn btn-primary" data-action="tpl-save">${icon('save', 15)} Salvează șablonul</button>`,
    });
    renderTplEditor();
  }
  function renderTplEditor() {
    const t = tplDraft;
    const box = $('#tpl-editor');
    if (!box) return;
    box.innerHTML = `
      <div class="grid sm:grid-cols-2 gap-3">
        <label class="field"><span class="field-label">Nume</span><input class="input" data-tpl="name" value="${esc(t.name)}" placeholder="Ex: Push Day" autocomplete="off"></label>
        <label class="field"><span class="field-label">Descriere (grupe)</span><input class="input" data-tpl="subtitle" value="${esc(t.subtitle)}" placeholder="Ex: Piept + Umeri + Triceps" autocomplete="off"></label>
      </div>
      <div class="field mt-3"><span class="field-label">Culoare</span>
        <div class="swatch-row">${D.TEMPLATE_COLORS.map((c) => `<button type="button" class="swatch ${c === t.color ? 'is-on' : ''}" style="background:${c}" data-action="tpl-color" data-color="${c}" aria-label="Culoarea ${c}"></button>`).join('')}</div>
      </div>
      <div class="field mt-4"><span class="field-label">Exerciții (${t.items.length})</span>
        <div class="flex flex-col gap-2">${t.items.map((it, i) => `<div class="tpl-ex-row" data-i="${i}">
            <span class="muted text-sm font-bold">${i + 1}</span>
            <span class="text-sm font-semibold truncate">${esc(exInfo(it.exId).name)}</span>
            <select class="select select-sm" data-tpl="gym" aria-label="Sala pentru ${esc(exInfo(it.exId).name)}">
              <option value="">Sala: automat (ultima folosită)</option>
              ${state.gyms.map((g) => `<option value="${esc(g)}" ${it.gym === g ? 'selected' : ''}>Sala: ${esc(g)}</option>`).join('')}
            </select>
            <span class="flex">
              <button type="button" class="icon-btn" data-action="tpl-ex-move" data-dir="-1" ${i === 0 ? 'disabled' : ''} aria-label="Mută sus">${icon('up', 15)}</button>
              <button type="button" class="icon-btn" data-action="tpl-ex-move" data-dir="1" ${i === t.items.length - 1 ? 'disabled' : ''} aria-label="Mută jos">${icon('down', 15)}</button>
              <button type="button" class="icon-btn danger" data-action="tpl-ex-remove" aria-label="Elimină">${icon('trash', 15)}</button>
            </span>
          </div>`).join('') || '<p class="muted text-sm">Niciun exercițiu încă — adaugă din lista de mai jos.</p>'}</div>
        <div class="flex gap-2 mt-2">
          <select class="select select-sm" id="tpl-add-select" aria-label="Exercițiu de adăugat">${exerciseOptionsHTML()}</select>
          <button type="button" class="btn btn-sm" data-action="tpl-ex-add">${icon('plus', 14)} Adaugă</button>
        </div>
      </div>`;
  }
  function saveTemplate() {
    const t = tplDraft;
    t.name = t.name.trim();
    if (!t.name) { toast('Dă-i un nume șablonului.', 'warn'); return; }
    if (!t.items.length) { toast('Adaugă cel puțin un exercițiu.', 'warn'); return; }
    if (t.id) {
      const i = state.templates.findIndex((x) => x.id === t.id);
      state.templates[i] = t;
    } else {
      t.id = 't-' + U.uid();
      state.templates.push(t);
    }
    commit();
    closeModal();
    render();
    toast('Șablonul „' + esc(t.name) + '” a fost salvat.', 'success');
  }

  /* =====================================================================
   * MODAL & TOAST
   * ===================================================================== */
  let modalResolve = null;
  function openModal({ title, body, footer = '', size = '' }) {
    if (modalResolve) { const r = modalResolve; modalResolve = null; r(false); }
    $('#modal-root').innerHTML = `<div class="modal-backdrop" id="modal-backdrop">
      <div class="modal ${size}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-head"><h2 id="modal-title">${title}</h2><button type="button" class="icon-btn" data-action="modal-close" aria-label="Închide">${icon('x', 18)}</button></div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
      </div></div>`;
    document.body.style.overflow = 'hidden';
  }
  function closeModal(result) {
    $('#modal-root').innerHTML = '';
    document.body.style.overflow = '';
    if (modalResolve) { const r = modalResolve; modalResolve = null; r(!!result); }
  }
  function confirmModal({ title, message, confirmText = 'Confirmă', danger = false }) {
    return new Promise((resolve) => {
      openModal({
        title, size: 'sm',
        body: `<p class="leading-relaxed" style="color:var(--text-2)">${message}</p>`,
        footer: `<button type="button" class="btn btn-ghost" data-action="modal-close">Anulează</button><button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-action="modal-confirm">${confirmText}</button>`,
      });
      modalResolve = resolve;
      setTimeout(() => { const b = $('[data-action="modal-confirm"]'); if (b) b.focus(); }, 20);
    });
  }

  function toast(msg, type = 'info', ms = 3400) {
    const root = $('#toast-root');
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = icon({ success: 'check', warn: 'warn', error: 'warn' }[type] || 'info', 18) + '<span>' + msg + '</span>';
    root.appendChild(el);
    while (root.children.length > 3) root.firstChild.remove();
    setTimeout(() => { el.classList.add('is-leaving'); setTimeout(() => el.remove(), 300); }, ms);
  }

  /* =====================================================================
   * EVENIMENTE (delegate pe document)
   * ===================================================================== */
  const ACTIONS = {
    'go': (el) => {
      go(el.dataset.tab);
      if (el.dataset.focus) setTimeout(() => { const t = document.getElementById(el.dataset.focus); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
    },

    /* --- antrenament --- */
    'start-template': (el) => startTemplate(el.dataset.id),
    'add-set': (el) => {
      const c = ctxFrom(el);
      c.wex.sets.push(emptySet());
      commit();
      rerenderEx(c.exIdx, '[data-set="' + (c.wex.sets.length - 1) + '"] [data-field="kg"]');
    },
    'remove-set': (el) => {
      const c = ctxFrom(el);
      c.wex.sets.splice(c.key, 1);
      commit();
      rerenderEx(c.exIdx);
    },
    'add-drop': (el) => {
      const c = ctxFrom(el);
      c.set.drops.push({ kg: null, reps: null });
      commit();
      rerenderEx(c.exIdx, '[data-set="' + c.key + '"] [data-drop="' + (c.set.drops.length - 1) + '"] [data-field="drop-kg"]');
    },
    'remove-drop': (el) => {
      const c = ctxFrom(el);
      c.set.drops.splice(c.dropIdx, 1);
      commit();
      rerenderEx(c.exIdx);
    },
    'done': toggleDone,
    'tag': (el) => {
      const c = ctxFrom(el);
      const t = el.dataset.tag;
      c.wex.tags = c.wex.tags.includes(t) ? c.wex.tags.filter((x) => x !== t) : c.wex.tags.concat(t);
      el.classList.toggle('is-on');
      commit();
    },
    'wtag': (el) => {
      const d = state.draft;
      const t = el.dataset.tag;
      d.tags = d.tags.includes(t) ? d.tags.filter((x) => x !== t) : d.tags.concat(t);
      el.classList.toggle('is-on');
      commit();
    },
    'ex-up': (el) => moveExercise(ctxFrom(el).exIdx, -1),
    'ex-down': (el) => moveExercise(ctxFrom(el).exIdx, 1),
    'ex-remove': async (el) => {
      const c = ctxFrom(el);
      const hasData = isNum(c.wex.warmup.reps) || c.wex.sets.some((s) => isNum(s.kg) || isNum(s.reps));
      if (hasData) {
        const ok = await confirmModal({ title: 'Ștergi exercițiul?', message: `<b>${esc(exInfo(c.wex.exId).name)}</b> are valori completate care se vor pierde.`, confirmText: 'Șterge', danger: true });
        if (!ok) return;
      }
      state.draft.exercises.splice(c.exIdx, 1);
      commit();
      rerenderExList();
    },
    'add-exercise': () => openExercisePicker(),
    'pick-exercise': (el) => addExerciseToDraft(el.dataset.id),
    'create-exercise': () => {
      const name = ($('#new-ex-name').value || '').trim();
      if (!name) { toast('Scrie numele exercițiului.', 'warn'); $('#new-ex-name').focus(); return; }
      const ex = { id: 'c-' + U.uid(), name, muscle: '', group: $('#new-ex-group').value, bodyweight: false, custom: true };
      state.customExercises.push(ex);
      addExerciseToDraft(ex.id);
    },
    'save-workout': () => saveWorkout(),
    'discard': () => discardDraft(),
    'dismiss-banner': () => { lastSaved = null; renderLog(); },
    'see-progress': (el) => {
      const w = state.workouts.find((x) => x.id === el.dataset.id);
      if (w) {
        state.ui.compareId = w.id;
        const first = w.exercises.find((e) => St.hasWork(e));
        if (first) { state.ui.progressEx = first.exId; state.ui.progressGym = 'all'; }
      }
      go('progress');
    },

    /* --- cronometru --- */
    'timer-preset': (el) => { ensureAudio(); Timer.start(+el.dataset.sec); },
    'timer-toggle': () => { ensureAudio(); Timer.toggle(); },
    'timer-reset': () => Timer.reset(),
    'timer-add': () => Timer.add(15),
    'timer-close': () => Timer.close(),

    /* --- istoric --- */
    'history-filter': (el) => { state.ui.historyFilter = el.dataset.v; commit(); renderHistory(); },
    'history-edit': (el) => editWorkout(el.dataset.id),
    'history-dup': (el) => duplicateWorkout(el.dataset.id),
    'history-delete': (el) => deleteWorkout(el.dataset.id),

    /* --- progres --- */
    'progress-gym': (el) => { state.ui.progressGym = el.dataset.v; commit(); renderProgressChartCard(); },
    'donut-range': (el) => { state.ui.donutRange = +el.dataset.v; commit(); renderDonutCard(); },

    /* --- corp --- */
    'profile-set': (el) => {
      state.profile[el.dataset.k] = el.dataset.v;
      $$('[data-action="profile-set"][data-k="' + el.dataset.k + '"]').forEach((b) => b.classList.toggle('is-on', b === el));
      commit();
      refreshBody(el.dataset.k === 'goal');
    },
    'weight-add': () => {
      const date = $('#w-date').value;
      const kg = U.parseNum($('#w-kg').value);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !(kg >= 30 && kg <= 300)) { toast('Introdu o dată și o greutate validă (30–300 kg).', 'warn'); return; }
      upsertWeight(date, kg);
      commit();
      renderBody();
      toast('Cântărirea din ' + fmtDate(date) + ' a fost adăugată.', 'success');
    },
    'weight-delete': (el) => {
      state.weightLog = state.weightLog.filter((e) => e.date !== el.dataset.date);
      commit();
      renderBody();
    },

    /* --- setări --- */
    'export': () => { const f = S.exportJSON(state); toast('Backup descărcat: ' + esc(f), 'success'); },
    'import': () => { const inp = $('#import-file'); inp.value = ''; inp.click(); },
    'reset-demo': async () => {
      const ok = await confirmModal({
        title: 'Încarci datele reale?',
        message: `Istoricul actual va fi înlocuit cu cele <b>${D.REAL_HISTORY_COUNT} sesiuni reale</b> (22 Sept – 20 Nov) și profilul demo. Fă un Export JSON înainte dacă vrei să păstrezi ce ai acum.`,
        confirmText: 'Da, încarcă datele reale',
      });
      if (!ok) return;
      const keep = { settings: state.settings };
      state = D.createDemoState();
      Object.assign(state, keep);
      afterDataReplace('Am încărcat cele ' + D.REAL_HISTORY_COUNT + ' antrenamente reale.');
    },
    'clear-all': async () => {
      const ok = await confirmModal({
        title: 'Ștergi tot?',
        message: 'Se șterg <b>toate antrenamentele, cântăririle și profilul</b>. Șabloanele implicite rămân. Acțiunea nu poate fi anulată (decât dintr-un backup JSON).',
        confirmText: 'Da, șterge tot', danger: true,
      });
      if (!ok) return;
      const keep = { settings: state.settings };
      state = D.createEmptyState();
      Object.assign(state, keep);
      afterDataReplace('Toate datele au fost șterse.');
    },
    'rest-default': (el) => {
      state.settings.restSeconds = +el.dataset.v;
      $$('[data-action="rest-default"]').forEach((b) => b.classList.toggle('is-on', b === el));
      commit();
      toast('Pauza implicită: ' + el.dataset.v + ' secunde.', 'success');
    },
    'test-sound': () => {
      ensureAudio();
      const prev = state.settings.sound;
      state.settings.sound = true;
      beep();
      state.settings.sound = prev;
    },
    'pwa-install': () => PWA.install(),
    'tpl-new': () => openTemplateEditor(null),
    'tpl-edit': (el) => openTemplateEditor(el.dataset.id),
    'tpl-delete': async (el) => {
      const t = tplById(el.dataset.id);
      const ok = await confirmModal({ title: 'Ștergi șablonul?', message: `Șablonul <b>${esc(t.name)}</b> va fi șters. Antrenamentele deja salvate rămân în istoric.`, confirmText: 'Șterge', danger: true });
      if (!ok) return;
      state.templates = state.templates.filter((x) => x.id !== t.id);
      commit();
      renderSettings();
    },
    'tpl-restore': async () => {
      const ok = await confirmModal({ title: 'Restaurezi șabloanele implicite?', message: 'Cele 4 zile implicite (Chest, Leg, Brațe + Umeri + Abd, Back) revin la forma inițială. Șabloanele create de tine rămân.', confirmText: 'Restaurează' });
      if (!ok) return;
      const defs = D.defaultTemplates();
      const custom = state.templates.filter((t) => !defs.some((d) => d.id === t.id));
      state.templates = defs.concat(custom);
      commit();
      renderSettings();
      toast('Șabloanele implicite au fost restaurate.', 'success');
    },
    'tpl-color': (el) => { tplDraft.color = el.dataset.color; renderTplEditor(); },
    'tpl-ex-add': () => { tplDraft.items.push({ exId: $('#tpl-add-select').value, gym: null }); renderTplEditor(); },
    'tpl-ex-remove': (el) => { tplDraft.items.splice(+el.closest('[data-i]').dataset.i, 1); renderTplEditor(); },
    'tpl-ex-move': (el) => {
      const i = +el.closest('[data-i]').dataset.i;
      const j = i + +el.dataset.dir;
      const it = tplDraft.items;
      [it[i], it[j]] = [it[j], it[i]];
      renderTplEditor();
    },
    'tpl-save': () => saveTemplate(),
    'gym-add': () => { const v = createGym($('#gym-new').value); if (v) { renderSettings(); toast('Sala „' + esc(v) + '” a fost adăugată.', 'success'); } },
    'gym-remove': (el) => { state.gyms = state.gyms.filter((g) => g !== el.dataset.gym); commit(); renderSettings(); },
    'gym-create': () => {
      const v = createGym($('#new-gym-name').value);
      if (!v) return;
      const cb = pendingGymCallback;
      pendingGymCallback = null;
      closeModal();
      if (cb) cb(v);
    },

    /* --- modal --- */
    'modal-close': () => closeModal(false),
    'modal-confirm': () => closeModal(true),
  };

  function moveExercise(i, dir) {
    const arr = state.draft.exercises;
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    commit();
    rerenderExList();
  }

  function afterDataReplace(msg) {
    lastSaved = null;
    clearCaches();
    S.saveNow(state);
    setSaveStatus('saved');
    Timer.close();
    render();
    toast(msg, 'success');
  }

  function onClick(e) {
    if (e.target.id === 'modal-backdrop') { closeModal(false); return; }
    const el = e.target.closest('[data-action]');
    if (!el || el.tagName === 'INPUT' || el.tagName === 'SELECT') return;
    if (el.disabled) return;
    const fn = ACTIONS[el.dataset.action];
    if (fn) { e.preventDefault(); fn(el, e); }
  }

  function onInput(e) {
    const t = e.target;

    // --- celulele din tabel ---
    const field = t.dataset.field;
    if (field && state.draft && t.closest('#ex-list')) {
      const c = ctxFrom(t);
      if (!c) return;
      if (field === 'note') { c.wex.note = t.value; commit(); return; }
      if (field === 'gym' || field === 'bw') return; // tratate la "change"
      const isReps = field === 'reps' || field === 'drop-reps';
      const clean = isReps ? t.value.replace(/[^0-9]/g, '') : t.value.replace(/[^0-9.,]/g, '');
      if (clean !== t.value) t.value = clean;
      const v = U.parseNum(clean);
      if (field === 'kg' || field === 'reps') c.set[field] = v;
      else if (field === 'drop-kg') c.set.drops[c.dropIdx].kg = v;
      else if (field === 'drop-reps') c.set.drops[c.dropIdx].reps = v;
      if (c.key !== 'w') {
        const slot = $('.delta-slot', c.cell);
        if (slot) slot.innerHTML = deltaHTML(c.wex, c.key, c.set, refSet(getRef(c.wex), c.key));
      }
      updateSaveBar();
      commit();
      return;
    }
    if (t.dataset.draft === 'note' && state.draft) { state.draft.note = t.value; commit(); return; }

    // --- căutare exerciții ---
    if (t.id === 'picker-search') { $('#picker-list').innerHTML = pickerListHTML(t.value); return; }

    // --- editor șabloane ---
    if (t.dataset.tpl === 'name' || t.dataset.tpl === 'subtitle') { tplDraft[t.dataset.tpl] = t.value; return; }

    // --- profil (vârstă / înălțime: actualizare live) ---
    if (t.dataset.profile === 'age' || t.dataset.profile === 'height') {
      const v = U.parseNum(t.value);
      const ok = t.dataset.profile === 'age' ? v >= 10 && v <= 100 : v >= 100 && v <= 250;
      t.style.borderColor = t.value && !ok ? 'var(--down)' : '';
      state.profile[t.dataset.profile] = ok ? v : null;
      commit();
      refreshBody(false);
    }
  }

  function onChange(e) {
    const t = e.target;
    if (t.id === 'import-file') { handleImport(t.files[0]); return; }

    if (t.dataset.field === 'gym' && state.draft) {
      const c = ctxFrom(t);
      if (t.value === '__new') {
        t.value = c.wex.gym;
        addGymPrompt((name) => { c.wex.gym = name; commit(); rerenderExList(); });
        return;
      }
      c.wex.gym = t.value;
      commit();
      rerenderEx(c.exIdx);
      return;
    }
    if (t.dataset.field === 'bw' && state.draft) {
      const c = ctxFrom(t);
      c.set.bw = t.checked;
      if (t.checked) c.set.kg = 0;
      commit();
      rerenderEx(c.exIdx, '[data-set="w"] [data-field="reps"]');
      return;
    }
    if (t.dataset.draft === 'date' && state.draft) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(t.value)) { state.draft.date = t.value; clearCaches(); commit(); rerenderExList(); }
      return;
    }
    if (t.dataset.role === 'progress-ex') { state.ui.progressEx = t.value; state.ui.progressGym = 'all'; commit(); renderProgressChartCard(); return; }
    if (t.dataset.role === 'compare-workout') { state.ui.compareId = t.value; commit(); renderCompareCard(); return; }
    if (t.dataset.profile === 'activity') { state.profile.activity = parseFloat(t.value); commit(); refreshBody(false); return; }
    if (t.dataset.profile === 'weight') {
      const v = U.parseNum(t.value);
      if (!(v >= 30 && v <= 300)) { toast('Greutatea trebuie să fie între 30 și 300 kg.', 'warn'); return; }
      upsertWeight(U.today(), v);
      commit();
      refreshBody(true);
      toast('Greutatea de azi (' + num(v) + ' kg) a fost salvată.', 'success');
      return;
    }
    if (t.dataset.setting === 'sound') { state.settings.sound = t.checked; commit(); return; }
    if (t.dataset.tpl === 'gym') { tplDraft.items[+t.closest('[data-i]').dataset.i].gym = t.value || null; }
  }

  function onKeydown(e) {
    if (e.key === 'Escape' && $('#modal-backdrop')) { closeModal(false); return; }
    const t = e.target;
    if (e.key !== 'Enter') return;
    // Enter în tabel → următoarea căsuță (kg → rep → seria următoare)
    if (t.classList && t.classList.contains('num') && t.closest('#ex-list')) {
      e.preventDefault();
      const all = $$('#ex-list .num:not(:disabled)');
      const next = all[all.indexOf(t) + 1];
      if (next) { next.focus(); next.select(); }
      return;
    }
    if (t.id === 'picker-search') { const first = $('#picker-list .picker-item'); if (first) first.click(); return; }
    if (t.id === 'new-gym-name') { ACTIONS['gym-create'](); return; }
    if (t.id === 'gym-new') { ACTIONS['gym-add'](); return; }
    if (t.id === 'w-kg') { ACTIONS['weight-add'](); return; }
    if (t.id === 'new-ex-name') { ACTIONS['create-exercise'](); }
  }

  async function handleImport(file) {
    if (!file) return;
    try {
      const imported = await S.readImportFile(file);
      const ok = await confirmModal({
        title: 'Importi backup-ul?',
        message: `Fișierul <b>${esc(file.name)}</b> conține <b>${U.plural(imported.workouts.length, 'antrenament', 'antrenamente')}</b> și ${U.plural(imported.weightLog.length, 'cântărire', 'cântăriri')}. Datele actuale (${U.plural(state.workouts.length, 'antrenament', 'antrenamente')}) vor fi înlocuite.`,
        confirmText: 'Importă',
      });
      if (!ok) return;
      state = imported;
      afterDataReplace('Backup importat cu succes.');
    } catch (err) {
      toast('Import eșuat: ' + esc(err.message), 'error', 5000);
    }
  }

  /* ============================== PORNIRE ============================== */
  function init() {
    const res = S.load();
    state = res.state;
    C.init();
    S.onSaved(() => setSaveStatus('saved'));
    setSaveStatus(S.isAvailable() ? 'saved' : 'off');
    Timer.mount();
    PWA.init();

    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);
    document.addEventListener('keydown', onKeydown);
    window.addEventListener('hashchange', () => setTab(HASH_TO_TAB[location.hash.slice(1)] || 'log'));

    const fromHash = HASH_TO_TAB[location.hash.slice(1)];
    setTab(fromHash || state.ui.tab || 'log');

    if (res.source === 'demo') toast(`Am încărcat istoricul real: ${D.REAL_HISTORY_COUNT} antrenamente (22 Sept – 20 Nov).`, 'success', 4500);
    if (res.source === 'corrupt') toast('Datele salvate erau corupte — am încărcat istoricul real.', 'warn', 5000);
    if (!S.isAvailable()) toast('Salvarea automată nu e disponibilă în acest browser — folosește Export JSON.', 'warn', 6000);

    // Expus pentru depanare și pentru scriptul de screenshot-uri.
    window.GymApp = { get state() { return state; }, go, Timer, toast, render, PWA };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
