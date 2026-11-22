/* =====================================================================
 * GymLog Pro — js/stats.js
 * ---------------------------------------------------------------------
 * Toate calculele, fără nicio legătură cu DOM-ul:
 *   • utilitare (date în română, formatare numere, escape HTML)
 *   • seria "de top", repetări totale, kg ridicate
 *   • detecția recordurilor personale (PR) — per exercițiu ȘI per sală
 *   • referința "Ultima dată" și comparația "Azi vs. Tura trecută"
 *   • rezumatul progresului în cuvinte simple
 *   • KPI-uri, distribuția pe grupe musculare, frecvența săptămânală
 *   • IMC și necesar caloric (Mifflin-St Jeor)
 *
 * Expune global: window.GymStats
 * ===================================================================== */
(function (global) {
  'use strict';

  const MONTHS = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  const MONTHS_LONG = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
  const DAYS = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
  const DAY_MS = 864e5;
  const pad = (n) => String(n).padStart(2, '0');

  /* =================== Utilitare =================== */
  const util = {
    isNum: (v) => typeof v === 'number' && Number.isFinite(v),
    parseNum(str) {
      if (str === null || str === undefined) return null;
      const s = String(str).trim().replace(',', '.');
      if (s === '') return null;
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : null;
    },
    parseDate(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); },
    toISO(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); },
    today() { return util.toISO(new Date()); },
    addDays(iso, n) { const d = util.parseDate(iso); d.setDate(d.getDate() + n); return util.toISO(d); },
    daysBetween(a, b) { return Math.round((util.parseDate(b) - util.parseDate(a)) / DAY_MS); },
    fmtDate(iso) { const d = util.parseDate(iso); return d.getDate() + ' ' + MONTHS[d.getMonth()]; },
    fmtDateYear(iso) { const d = util.parseDate(iso); return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); },
    fmtDateLong(iso) { const d = util.parseDate(iso); return DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); },
    monthName(iso) { return MONTHS_LONG[util.parseDate(iso).getMonth()]; },
    monthLabel(iso) { const d = util.parseDate(iso); return MONTHS_LONG[d.getMonth()] + ' ' + d.getFullYear(); },
    num(n, frac = 1) {
      if (!util.isNum(n)) return '–';
      return n.toLocaleString('ro-RO', { maximumFractionDigits: frac });
    },
    signed(n, frac = 1) { return (n > 0 ? '+' : n < 0 ? '−' : '') + util.num(Math.abs(n), frac); },
    pair(kg, reps) { return util.num(kg) + '×' + reps; },
    round(n, d = 2) { const f = Math.pow(10, d); return Math.round(n * f) / f; },
    clamp(n, a, b) { return Math.min(b, Math.max(a, n)); },
    uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); },
    esc(s) {
      return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    /* Plural românesc: 1 repetare · 5 repetări · 20 de repetări */
    plural(n, one, many) {
      const a = Math.abs(n);
      if (a === 1) return n + ' ' + one;
      const r = a % 100;
      return n + (a !== 0 && (r === 0 || r >= 20) ? ' de ' : ' ') + many;
    },
  };
  const { isNum, num, round, fmtDate, daysBetween } = util;

  /* =================== Seturi & exerciții =================== */
  /* Serie validă = are kg (0 = greutatea corpului) și cel puțin o repetare. */
  const validPair = (p) => p && isNum(p.kg) && isNum(p.reps) && p.reps > 0;
  const workSets = (wex) => (wex.sets || []).filter(validPair);
  const hasWork = (wex) => workSets(wex).length > 0;
  const hasAnyData = (wex) => hasWork(wex) || validPair(wex.warmup);

  /* "Scor de forță" intern (formula Epley) — folosit DOAR pentru a ordona/compara,
   * nu e afișat utilizatorului. La exercițiile la liber (0 kg) comparăm repetările. */
  const score = (kg, reps) => (kg > 0 ? kg * (1 + reps / 30) : reps);

  /* Seria "de top" = cea mai grea; la egalitate, cea cu mai multe repetări. */
  function topSet(wex) {
    let best = null;
    for (const s of workSets(wex)) {
      if (!best || s.kg > best.kg || (s.kg === best.kg && s.reps > best.reps)) best = s;
    }
    return best ? { kg: best.kg, reps: best.reps } : null;
  }

  function totalReps(wex) {
    let t = 0;
    for (const s of workSets(wex)) {
      t += s.reps;
      for (const d of s.drops || []) if (validPair(d)) t += d.reps;
    }
    return t;
  }

  /* Total kg ridicați (kg × repetări), fără încălzire. */
  function volume(wex) {
    let v = 0;
    for (const s of workSets(wex)) {
      v += s.kg * s.reps;
      for (const d of s.drops || []) if (validPair(d)) v += d.kg * d.reps;
    }
    return v;
  }

  function bestScore(wex) {
    let b = 0;
    for (const s of workSets(wex)) b = Math.max(b, score(s.kg, s.reps));
    return b;
  }

  const workoutVolume = (w) => w.exercises.reduce((a, e) => a + volume(e), 0);
  const workoutSetCount = (w) => w.exercises.reduce((a, e) => a + workSets(e).length, 0);

  function sortedWorkouts(ws) {
    return ws.slice().sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0));
  }

  /* Index cronologic: exId → [{ date, workoutId, gym, top, totalReps, volume, score, ... }] */
  function buildIndex(workouts) {
    const idx = new Map();
    for (const w of sortedWorkouts(workouts)) {
      for (const wex of w.exercises) {
        const entry = {
          date: w.date, workoutId: w.id, gym: wex.gym || 'General', wex,
          top: topSet(wex), totalReps: totalReps(wex), volume: volume(wex),
          score: bestScore(wex), hasWork: hasWork(wex),
        };
        if (!idx.has(wex.exId)) idx.set(wex.exId, []);
        idx.get(wex.exId).push(entry);
      }
    }
    return idx;
  }

  /* =================== Recorduri personale (PR) ===================
   * Pentru fiecare exercițiu + sală, în ordine cronologică:
   *   – prima sesiune = reperul (nu e PR)
   *   – PR de greutate: seria de top e mai grea decât orice dinainte
   *   – PR de repetări: aceeași greutate maximă, dar mai multe repetări */
  function detectPRs(workouts) {
    const list = [];
    for (const [exId, entries] of buildIndex(workouts)) {
      const best = new Map(); // gym → { kg, reps }
      for (const e of entries) {
        if (!e.hasWork) continue;
        const prev = best.get(e.gym);
        const t = e.top;
        if (!prev) { best.set(e.gym, { kg: t.kg, reps: t.reps }); continue; }
        let pr = null;
        if (t.kg > prev.kg) pr = { type: 'kg', delta: round(t.kg - prev.kg) };
        else if (t.kg === prev.kg && t.reps > prev.reps) pr = { type: 'reps', delta: t.reps - prev.reps };
        if (pr) {
          list.push(Object.assign({ exId, date: e.date, workoutId: e.workoutId, gym: e.gym, kg: t.kg, reps: t.reps, prev: { kg: prev.kg, reps: prev.reps } }, pr));
          best.set(e.gym, { kg: t.kg, reps: t.reps });
        }
      }
    }
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }

  /* Cel mai bun rezultat de până acum (pentru badge-ul "Record!" în timpul antrenamentului). */
  function recordFor(workouts, exId, gym, excludeId) {
    let rec = null;
    for (const w of workouts) {
      if (w.id === excludeId) continue;
      for (const wex of w.exercises) {
        if (wex.exId !== exId || (wex.gym || 'General') !== gym) continue;
        const t = topSet(wex);
        if (t && (!rec || t.kg > rec.kg || (t.kg === rec.kg && t.reps > rec.reps))) rec = { kg: t.kg, reps: t.reps, date: w.date };
      }
    }
    return rec;
  }

  /* =================== "Ultima dată" ===================
   * Caută cea mai recentă sesiune a exercițiului care trece filtrul `pred`.
   * Preferă aceeași sală; dacă nu există, întoarce ultima sesiune din orice sală
   * (marcată cu sameGym:false, ca UI-ul să avertizeze). */
  function lastReference(workouts, exId, gym, pred, requireWork) {
    const desc = sortedWorkouts(workouts).reverse();
    let anyGym = null;
    for (const w of desc) {
      if (pred && !pred(w)) continue;
      for (const wex of w.exercises) {
        if (wex.exId !== exId) continue;
        if (requireWork ? !hasWork(wex) : !hasAnyData(wex)) continue;
        if ((wex.gym || 'General') === (gym || 'General')) return { workout: w, wex, sameGym: true };
        if (!anyGym) anyGym = { workout: w, wex, sameGym: false };
      }
    }
    return anyGym;
  }

  /* Ultima sală folosită pentru un exercițiu (șabloanele o preiau automat). */
  function lastGymFor(workouts, exId) {
    const desc = sortedWorkouts(workouts).reverse();
    for (const w of desc) for (const wex of w.exercises) if (wex.exId === exId) return wex.gym || 'General';
    return 'General';
  }

  /* Compară două serii { kg, reps } → diferențe + verdict up / same / down. */
  function compareSets(cur, prev) {
    if (!cur || !prev) return null;
    const dKg = round(cur.kg - prev.kg);
    const dReps = cur.reps - prev.reps;
    let status = 'same';
    if (dKg !== 0 || dReps !== 0) {
      const a = score(cur.kg, cur.reps);
      const b = score(prev.kg, prev.reps);
      const rel = b ? (a - b) / b : a - b;
      status = rel > 0.004 ? 'up' : rel < -0.004 ? 'down' : 'same';
      // dacă greutatea a crescut și repetările nu au scăzut, e clar progres
      if (dKg > 0 && dReps >= 0) status = 'up';
      if (dKg < 0 && dReps <= 0) status = 'down';
    }
    return { dKg, dReps, status };
  }

  /* "Azi vs. Tura trecută": fiecare exercițiu al antrenamentului vs. sesiunea lui anterioară. */
  function compareWorkout(workouts, workout) {
    const sorted = sortedWorkouts(workouts);
    const pos = sorted.findIndex((w) => w.id === workout.id);
    const before = new Set(sorted.slice(0, pos < 0 ? sorted.length : pos).map((w) => w.id));
    return workout.exercises.filter(hasWork).map((wex) => {
      const cur = topSet(wex);
      const ref = lastReference(workouts, wex.exId, wex.gym, (w) => before.has(w.id), true);
      if (!ref) return { wex, cur, prev: null, status: 'new' };
      const prev = topSet(ref.wex);
      return Object.assign(
        { wex, cur, prev, prevDate: ref.workout.date, sameGym: ref.sameGym, prevGym: ref.wex.gym, dTotal: totalReps(wex) - totalReps(ref.wex) },
        compareSets(cur, prev),
      );
    });
  }

  /* =================== Serii pentru graficul de progres =================== */
  function gymsFor(workouts, exId) {
    const set = new Set();
    for (const e of buildIndex(workouts).get(exId) || []) if (e.hasWork) set.add(e.gym);
    return Array.from(set);
  }

  function progressSeries(workouts, exId, gymFilter) {
    const prIds = new Set(detectPRs(workouts).filter((p) => p.exId === exId).map((p) => p.workoutId + '|' + p.gym));
    return (buildIndex(workouts).get(exId) || [])
      .filter((e) => e.hasWork && (!gymFilter || gymFilter === 'all' || e.gym === gymFilter))
      .map((e) => ({
        date: e.date, workoutId: e.workoutId, gym: e.gym,
        maxKg: e.top.kg, topReps: e.top.reps, totalReps: e.totalReps, volume: e.volume, score: e.score,
        isPR: prIds.has(e.workoutId + '|' + e.gym),
      }));
  }

  /* Rezumat în cuvinte simple (HTML cu <b> și clase de culoare). */
  function progressSummary(series) {
    if (!series.length) return null;
    const up = (t) => '<b class="t-up">' + t + '</b>';
    const down = (t) => '<b class="t-down">' + t + '</b>';
    const last = series[series.length - 1];
    const best = series.reduce((b, s) => (!b || s.maxKg > b.maxKg || (s.maxKg === b.maxKg && s.topReps > b.topReps) ? s : b), null);
    const out = { sessions: series.length, best, last, lines: [] };

    if (series.length < 2) {
      out.verdict = 'new';
      out.lines.push('Ai o singură sesiune înregistrată (' + fmtDate(last.date) + ': <b>' + util.pair(last.maxKg, last.topReps) + '</b>). Mai adaugă una și îți arăt cum progresezi.');
      return out;
    }

    // Reperul "acum o lună": sesiunea anterioară cea mai apropiată de 30 de zile în urmă.
    const prev = series.slice(0, -1);
    const base = prev.reduce((b, s) => {
      const d = Math.abs(daysBetween(s.date, last.date) - 30);
      return !b || d < b.d ? { s, d } : b;
    }, null).s;
    const span = daysBetween(base.date, last.date);
    const ago = span >= 25 && span <= 38 ? 'acum o lună' : span < 25 ? 'acum ' + util.plural(span, 'zi', 'zile') : 'acum ' + util.plural(Math.round(span / 7), 'săptămână', 'săptămâni');

    const dKg = round(last.maxKg - base.maxKg);
    const dTot = last.totalReps - base.totalReps;
    const dTop = last.topReps - base.topReps;

    let s1;
    if (dKg > 0) s1 = 'Ai crescut cu ' + up('+' + num(dKg) + ' kg') + ' la greutatea maximă (' + num(base.maxKg) + ' → ' + num(last.maxKg) + ' kg)';
    else if (dKg < 0) s1 = 'Greutatea maximă a scăzut cu ' + down(num(-dKg) + ' kg') + ' (' + num(base.maxKg) + ' → ' + num(last.maxKg) + ' kg)';
    else s1 = 'Ai păstrat greutatea maximă de <b>' + num(last.maxKg) + ' kg</b>';
    const s2 = dTot > 0 ? 'și ai făcut ' + up('+' + util.plural(dTot, 'repetare', 'repetări')) + ' în total'
      : dTot < 0 ? 'cu ' + down(util.plural(-dTot, 'repetare', 'repetări')) + ' mai puțin în total'
        : 'cu același număr total de repetări';
    out.lines.push(s1 + ' ' + s2 + ', față de <b>' + fmtDate(base.date) + '</b> (' + ago + ').');

    if (dKg === 0 && dTop > 0) out.lines.push('La ' + num(last.maxKg) + ' kg ai reușit <b>' + last.topReps + ' repetări</b> (înainte: ' + base.topReps + ') — ești mai puternic, chiar dacă greutatea e aceeași.');
    if (dKg === 0 && dTop < 0) out.lines.push('La ' + num(last.maxKg) + ' kg ai făcut ' + last.topReps + ' repetări (înainte: ' + base.topReps + '). Se poate datora oboselii — încearcă din nou cu pauze puțin mai lungi.');
    if (dKg > 0 && dTop < 0) out.lines.push('E normal să faci mai puține repetări când crești greutatea — următorul pas e să urci repetările la ' + num(last.maxKg) + ' kg.');

    const first = series[0];
    if (first !== base) {
      const fk = round(last.maxKg - first.maxKg);
      out.lines.push('De la prima înregistrare (' + fmtDate(first.date) + '): ' + (fk > 0 ? up('+' + num(fk) + ' kg') : fk < 0 ? down('−' + num(-fk) + ' kg') : '<b>aceeași greutate</b>') + ' la greutatea maximă.');
    }

    const rel = base.score ? (last.score - base.score) / base.score : 0;
    out.verdict = rel > 0.01 ? 'up' : rel < -0.01 ? 'down' : 'same';
    out.base = base;
    return out;
  }

  /* =================== KPI-uri =================== */
  function biggestProgress(workouts) {
    let best = null;
    for (const [exId, entries] of buildIndex(workouts)) {
      const byGym = new Map();
      for (const e of entries) if (e.hasWork) { if (!byGym.has(e.gym)) byGym.set(e.gym, []); byGym.get(e.gym).push(e); }
      for (const [gym, list] of byGym) {
        if (list.length < 2) continue;
        const a = list[0];
        const b = list[list.length - 1];
        if (!(a.score > 0)) continue;
        const pct = (b.score - a.score) / a.score;
        if (!best || pct > best.pct) {
          best = { exId, gym, first: a, last: b, pct, dKg: round(b.top.kg - a.top.kg), dReps: b.top.reps - a.top.reps };
        }
      }
    }
    return best;
  }

  function kpis(workouts) {
    const ws = sortedWorkouts(workouts);
    if (!ws.length) return null;
    const first = ws[0].date;
    const last = ws[ws.length - 1].date;
    const weeks = Math.max(1, (daysBetween(first, last) + 1) / 7);
    const prs = detectPRs(ws);
    const monthKey = last.slice(0, 7);
    return {
      total: ws.length,
      first, last,
      perWeek: ws.length / weeks,
      last4w: ws.filter((w) => daysBetween(w.date, last) < 28).length,
      prs,
      prMonth: prs.filter((p) => p.date.startsWith(monthKey)),
      monthName: util.monthName(last),
      best: biggestProgress(ws),
      totalVolume: ws.reduce((a, w) => a + workoutVolume(w), 0),
    };
  }

  /* Distribuția seriilor pe grupe musculare, într-o fereastră care se termină la ultimul antrenament. */
  function groupDistribution(workouts, days, resolve, groups, order) {
    const ws = sortedWorkouts(workouts);
    const items = order.map((k) => ({ key: k, label: groups[k].label, color: groups[k].color, sets: 0, sessions: 0 }));
    if (!ws.length) return { items, total: 0, end: null, start: null };
    const end = ws[ws.length - 1].date;
    const inRange = ws.filter((w) => !days || daysBetween(w.date, end) < days);
    for (const w of inRange) {
      const seen = new Set();
      for (const wex of w.exercises) {
        const g = (resolve(wex.exId) || {}).group || 'arms';
        const it = items.find((i) => i.key === g);
        if (!it) continue;
        it.sets += workSets(wex).length;
        seen.add(g);
      }
      seen.forEach((g) => { items.find((i) => i.key === g).sessions += 1; });
    }
    const total = items.reduce((a, i) => a + i.sets, 0);
    items.forEach((i) => { i.pct = total ? i.sets / total : 0; });
    return { items, total, end, start: inRange.length ? inRange[0].date : end, workouts: inRange.length };
  }

  /* Antrenamente pe săptămână (luni–duminică), ultimele N săptămâni până la ultimul antrenament. */
  function weeklyCounts(workouts, n) {
    const ws = sortedWorkouts(workouts);
    const endIso = ws.length ? ws[ws.length - 1].date : util.today();
    const monday = (iso) => { const d = util.parseDate(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return util.toISO(d); };
    const endWeek = monday(endIso);
    const weeks = [];
    for (let i = n - 1; i >= 0; i--) weeks.push({ start: util.addDays(endWeek, -7 * i), count: 0 });
    for (const w of ws) {
      const wk = weeks.find((x) => x.start === monday(w.date));
      if (wk) wk.count += 1;
    }
    return weeks.map((w) => Object.assign(w, { label: fmtDate(w.start) }));
  }

  /* =================== Corp: IMC & calorii =================== */
  const GOALS = {
    hipertrofie: { label: 'Hipertrofie', delta: 300, protein: 1.8, short: 'masă musculară' },
    forta:       { label: 'Forță',       delta: 200, protein: 1.8, short: 'forță' },
    definire:    { label: 'Definire',    delta: -400, protein: 2.2, short: 'definire' },
  };
  const ACTIVITY = [
    { v: 1.2,   label: 'Sedentar — birou, fără sport' },
    { v: 1.375, label: 'Ușor activ — 1–2 antrenamente / săpt.' },
    { v: 1.55,  label: 'Moderat — 3–4 antrenamente / săpt.' },
    { v: 1.725, label: 'Foarte activ — 5–6 antrenamente / săpt.' },
  ];

  function bmi(heightCm, kg) {
    if (!(heightCm > 0) || !(kg > 0)) return null;
    const v = kg / Math.pow(heightCm / 100, 2);
    let cat;
    if (v < 18.5) cat = { key: 'under', label: 'Subponderal', color: '#60a5fa' };
    else if (v < 25) cat = { key: 'normal', label: 'Normal', color: '#34d399' };
    else if (v < 30) cat = { key: 'over', label: 'Supraponderal / masă musculară', color: '#fbbf24' };
    else cat = { key: 'obese', label: 'Obezitate', color: '#f87171' };
    return { value: round(v, 1), cat, pct: util.clamp((v - 15) / 20, 0, 1) };
  }

  function calories(profile, kg) {
    const { sex, age, height, goal, activity } = profile;
    if (!(kg > 0) || !(height > 0) || !(age > 0)) return null;
    const bmr = 10 * kg + 6.25 * height - 5 * age + (sex === 'F' ? -161 : 5);
    const maintenance = Math.round((bmr * (activity || 1.55)) / 10) * 10;
    const g = GOALS[goal] || GOALS.hipertrofie;
    return {
      bmr: Math.round(bmr), maintenance, target: maintenance + g.delta, delta: g.delta,
      protein: Math.round(kg * g.protein), proteinPerKg: g.protein, goal: g,
    };
  }

  function weightTrend(log, goal) {
    if (!log || log.length < 2) return null;
    const a = log[0];
    const b = log[log.length - 1];
    const diff = round(b.kg - a.kg, 1);
    const weeks = Math.max(1, daysBetween(a.date, b.date) / 7);
    const perWeek = round(diff / weeks, 2);
    let status = 'ok';
    let advice;
    if (goal === 'definire') {
      if (perWeek <= -0.2 && perWeek >= -0.8) advice = 'Slăbești într-un ritm sănătos pentru definire.';
      else if (perWeek < -0.8) { status = 'warn'; advice = 'Scazi destul de repede — atenție să nu pierzi și masă musculară.'; }
      else { status = 'warn'; advice = 'Greutatea nu scade — redu puțin caloriile sau crește activitatea.'; }
    } else if (goal === 'forta') {
      advice = Math.abs(perWeek) <= 0.4 ? 'Greutate stabilă — perfect pentru antrenamentul de forță.' : 'Greutatea se schimbă vizibil; la forță contează mai ales progresul la sală.';
    } else {
      if (perWeek >= 0.1 && perWeek <= 0.5) advice = 'Crești într-un ritm bun pentru masă musculară (ideal: 0,1–0,5 kg pe săptămână).';
      else if (perWeek > 0.5) { status = 'warn'; advice = 'Crești destul de repede — o parte poate fi grăsime. Redu puțin surplusul.'; }
      else { status = 'warn'; advice = 'Greutatea nu crește — pentru masă musculară mănâncă puțin mai mult.'; }
    }
    return { first: a, last: b, diff, perWeek, status, advice };
  }

  global.GymStats = {
    util,
    GOALS, ACTIVITY,
    workSets, hasWork, hasAnyData, topSet, totalReps, volume, score,
    workoutVolume, workoutSetCount, sortedWorkouts, buildIndex,
    detectPRs, recordFor, lastReference, lastGymFor, compareSets, compareWorkout,
    gymsFor, progressSeries, progressSummary, biggestProgress, kpis,
    groupDistribution, weeklyCounts,
    bmi, calories, weightTrend,
  };
})(window);
