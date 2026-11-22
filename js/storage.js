/* =====================================================================
 * GymLog Pro — js/storage.js
 * ---------------------------------------------------------------------
 * Persistența datelor:
 *   • salvare automată în localStorage (debounce 250 ms + flush la ieșire)
 *   • normalizarea / validarea stării (date vechi sau importate)
 *   • Export JSON (descărcare fișier) și Import JSON (FileReader)
 *
 * Expune global: window.GymStorage
 * ===================================================================== */
(function (global) {
  'use strict';

  const KEY = 'gymlog-pro/v1';
  const SCHEMA = 1;

  let available = null;     // localStorage funcționează? (poate fi blocat în modul privat)
  let timer = null;
  let pending = null;
  let lastSavedAt = null;
  const listeners = [];

  function isAvailable() {
    if (available !== null) return available;
    try {
      const k = '__gymlog_test__';
      global.localStorage.setItem(k, '1');
      global.localStorage.removeItem(k);
      available = true;
    } catch (e) {
      available = false;
    }
    return available;
  }

  /* ---------- Normalizare ---------- */
  const num = (v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };
  const isISODate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

  function normSet(s) {
    s = s || {};
    return {
      kg: num(s.kg),
      reps: num(s.reps),
      done: !!s.done,
      drops: Array.isArray(s.drops) ? s.drops.map((d) => ({ kg: num(d && d.kg), reps: num(d && d.reps) })) : [],
    };
  }

  function normExercise(e, i) {
    if (!e || typeof e.exId !== 'string') return null;
    return {
      uid: e.uid || 'x' + Date.now().toString(36) + i,
      exId: e.exId,
      gym: typeof e.gym === 'string' && e.gym.trim() ? e.gym : 'General',
      tags: Array.isArray(e.tags) ? e.tags.filter((t) => typeof t === 'string') : [],
      note: typeof e.note === 'string' ? e.note : '',
      warmup: e.warmup ? { kg: num(e.warmup.kg), reps: num(e.warmup.reps), bw: !!e.warmup.bw, done: !!e.warmup.done } : null,
      sets: Array.isArray(e.sets) ? e.sets.map(normSet) : [],
    };
  }

  function normWorkout(w) {
    if (!w || !isISODate(w.date) || !Array.isArray(w.exercises)) return null;
    return {
      id: w.id || 'w-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date: w.date,
      templateId: w.templateId || null,
      title: typeof w.title === 'string' ? w.title : 'Antrenament',
      tags: Array.isArray(w.tags) ? w.tags : [],
      note: typeof w.note === 'string' ? w.note : '',
      exercises: w.exercises.map(normExercise).filter(Boolean),
      createdAt: num(w.createdAt) || Date.now(),
      updatedAt: num(w.updatedAt) || Date.now(),
      editingId: w.editingId || null, // folosit doar de draft
    };
  }

  function normalize(raw) {
    const base = global.GymData.createEmptyState();
    const s = raw && typeof raw === 'object' ? raw : {};
    const out = base;

    out.workouts = (Array.isArray(s.workouts) ? s.workouts : [])
      .map(normWorkout).filter(Boolean)
      .map((w) => { delete w.editingId; return w; })
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);

    if (Array.isArray(s.templates) && s.templates.length) {
      out.templates = s.templates
        .filter((t) => t && t.id && t.name && Array.isArray(t.items))
        .map((t) => ({
          id: String(t.id), name: String(t.name), subtitle: String(t.subtitle || ''),
          color: t.color || '#7b8cff',
          items: t.items.filter((it) => it && it.exId).map((it) => ({ exId: it.exId, gym: it.gym || null })),
        }));
      if (!out.templates.length) out.templates = global.GymData.defaultTemplates();
    }

    out.customExercises = (Array.isArray(s.customExercises) ? s.customExercises : [])
      .filter((e) => e && e.id && e.name)
      .map((e) => ({ id: e.id, name: e.name, muscle: e.muscle || '', group: e.group || 'arms', bodyweight: !!e.bodyweight, custom: true }));

    const gyms = Array.isArray(s.gyms) ? s.gyms : [];
    out.gyms = Array.from(new Set([...global.GymData.GYMS, ...gyms.filter((g) => typeof g === 'string' && g.trim())]));

    Object.assign(out.profile, s.profile || {});
    out.profile.age = num(out.profile.age);
    out.profile.height = num(out.profile.height);
    out.profile.activity = num(out.profile.activity) || 1.55;

    out.weightLog = (Array.isArray(s.weightLog) ? s.weightLog : [])
      .filter((e) => e && isISODate(e.date) && num(e.kg))
      .map((e) => ({ date: e.date, kg: num(e.kg) }))
      .sort((a, b) => a.date.localeCompare(b.date));

    Object.assign(out.settings, s.settings || {});
    Object.assign(out.ui, s.ui || {});
    out.draft = s.draft ? normWorkout(s.draft) : null;
    if (out.draft) out.draft.exercises.forEach((e) => { if (!e.warmup) e.warmup = { kg: null, reps: null, bw: false, done: false }; });
    return out;
  }

  /* ---------- Citire / scriere ---------- */
  function load() {
    if (!isAvailable()) return { state: global.GymData.createDemoState(), source: 'memory' };
    try {
      const raw = global.localStorage.getItem(KEY);
      if (!raw) {
        const s = global.GymData.createDemoState();
        saveNow(s);
        return { state: s, source: 'demo' };
      }
      return { state: normalize(JSON.parse(raw)), source: 'storage' };
    } catch (e) {
      console.warn('[GymLog] Date corupte în localStorage — se încarcă istoricul demo.', e);
      return { state: global.GymData.createDemoState(), source: 'corrupt' };
    }
  }

  function saveNow(state) {
    clearTimeout(timer);
    timer = null;
    pending = null;
    if (!isAvailable()) return false;
    try {
      global.localStorage.setItem(KEY, JSON.stringify(state));
      lastSavedAt = new Date();
      listeners.forEach((fn) => fn(lastSavedAt));
      return true;
    } catch (e) {
      console.error('[GymLog] Salvarea a eșuat', e);
      return false;
    }
  }

  /* Salvare "leneșă": așteaptă 250 ms după ultima modificare. */
  function scheduleSave(state) {
    pending = state;
    clearTimeout(timer);
    timer = setTimeout(() => saveNow(state), 250);
  }

  function flush() { if (pending) saveNow(pending); }
  global.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

  function onSaved(fn) { listeners.push(fn); }

  function sizeKB() {
    try { return ((global.localStorage.getItem(KEY) || '').length / 1024); } catch (e) { return 0; }
  }

  /* ---------- Export / Import ---------- */
  function exportJSON(state) {
    const data = Object.assign({}, state, { draft: null });
    const payload = { app: 'GymLog Pro', schema: SCHEMA, exportedAt: new Date().toISOString(), data };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const d = new Date();
    const stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gymlog-backup-' + stamp + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    return a.download;
  }

  function readImportFile(file) {
    return new Promise((resolve, reject) => {
      if (!file) return reject(new Error('Niciun fișier selectat.'));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Fișierul nu a putut fi citit.'));
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          const data = parsed && parsed.data ? parsed.data : parsed;
          if (!data || !Array.isArray(data.workouts)) throw new Error('Fișierul nu pare un backup GymLog (lipsește lista "workouts").');
          resolve(normalize(data));
        } catch (e) {
          reject(e instanceof SyntaxError ? new Error('Fișierul nu este un JSON valid.') : e);
        }
      };
      reader.readAsText(file);
    });
  }

  global.GymStorage = {
    KEY,
    isAvailable,
    load,
    saveNow,
    scheduleSave,
    flush,
    onSaved,
    sizeKB,
    normalize,
    exportJSON,
    readImportFile,
    get lastSavedAt() { return lastSavedAt; },
  };
})(window);
