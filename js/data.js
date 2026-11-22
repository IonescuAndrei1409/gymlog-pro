/* =====================================================================
 * GymLog Pro — js/data.js
 * ---------------------------------------------------------------------
 * Datele "statice" ale aplicației:
 *   • grupele musculare (cu culorile folosite în grafice)
 *   • baza de exerciții
 *   • sălile / aparatele (tag-uri)
 *   • cele 4 șabloane de zi (Chest / Leg / Brațe+Umeri+Abd / Back)
 *   • istoricul REAL preîncărcat (9 sesiuni, 22 Sept – 20 Nov 2026)
 *   • un profil biometric demonstrativ (de înlocuit cu datele tale)
 *
 * Expune global: window.GymData
 * (scripturi clasice, nu ES modules → aplicația merge direct din file://)
 * ===================================================================== */
(function (global) {
  'use strict';

  /* ---------- Grupe musculare (pentru grafice și filtre) ---------- */
  const GROUPS = {
    legs:  { label: 'Picioare',      color: '#fb923c' },
    chest: { label: 'Piept',         color: '#f472b6' },
    back:  { label: 'Spate',         color: '#38bdf8' },
    arms:  { label: 'Brațe / Umeri', color: '#c084fc' },
    core:  { label: 'Abdomen',       color: '#2dd4bf' },
  };
  const GROUP_ORDER = ['legs', 'chest', 'back', 'arms', 'core'];

  /* ---------- Baza de exerciții ----------
   * id        – cheie stabilă (folosită în istoric)
   * name      – numele afișat
   * muscle    – mușchiul principal (text scurt)
   * group     – cheie din GROUPS
   * bodyweight – true pentru exerciții cu greutatea corpului (kg = greutate adăugată)
   */
  const EXERCISES = [
    // Picioare
    { id: 'presa',          name: 'Presă picioare',              muscle: 'Cvadricepși',     group: 'legs' },
    { id: 'gambe',          name: 'Gambe',                       muscle: 'Gambe',           group: 'legs' },
    { id: 'hams',           name: 'Hams (leg curl)',             muscle: 'Femurali',        group: 'legs' },
    { id: 'leg_ext',        name: 'Leg extension',               muscle: 'Cvadricepși',     group: 'legs' },
    { id: 'adductor',       name: 'Adductor',                    muscle: 'Adductori',       group: 'legs' },
    { id: 'abductor',       name: 'Abductor',                    muscle: 'Fesieri',         group: 'legs' },
    { id: 'genuflexiuni',   name: 'Genuflexiuni cu bara',        muscle: 'Cvadricepși',     group: 'legs' },
    { id: 'rdl',            name: 'Îndreptări românești',        muscle: 'Femurali',        group: 'legs' },
    // Piept
    { id: 'dips',           name: 'Dips',                        muscle: 'Piept / Triceps', group: 'chest', bodyweight: true },
    { id: 'chest_incline_db', name: 'Chest press înclinat gantere', muscle: 'Piept superior', group: 'chest' },
    { id: 'chest_press',    name: 'Chest press aparat',          muscle: 'Piept',           group: 'chest' },
    { id: 'pec_fly',        name: 'Pec fly aparat',              muscle: 'Piept',           group: 'chest' },
    { id: 'bench',          name: 'Împins orizontal cu bara',    muscle: 'Piept',           group: 'chest' },
    // Spate
    { id: 'tractiuni',      name: 'Tracțiuni',                   muscle: 'Dorsali',         group: 'back', bodyweight: true },
    { id: 'pulley',         name: 'Pulley scripete',             muscle: 'Spate (mijloc)',  group: 'back' },
    { id: 'pulldown',       name: 'Scripete pulldown',           muscle: 'Dorsali',         group: 'back' },
    { id: 'traps',          name: 'Traps gantere',               muscle: 'Trapez',          group: 'back' },
    { id: 'ramat_gantera',  name: 'Ramat cu gantera',            muscle: 'Dorsali',         group: 'back' },
    // Brațe & umeri
    { id: 'umeri_gantere',  name: 'Umeri gantere',               muscle: 'Umeri',           group: 'arms' },
    { id: 'umeri_aparat',   name: 'Umeri aparat',                muscle: 'Umeri',           group: 'arms' },
    { id: 'side_delts',     name: 'Side delts',                  muscle: 'Umeri laterali',  group: 'arms' },
    { id: 'biceps_gantere', name: 'Biceps gantere',              muscle: 'Biceps',          group: 'arms' },
    { id: 'biceps_cablu',   name: 'Biceps cablu',                muscle: 'Biceps',          group: 'arms' },
    { id: 'triceps_vbar',   name: 'Triceps V-bar',               muscle: 'Triceps',         group: 'arms' },
    { id: 'triceps_overhead', name: 'Overhead triceps gantera',  muscle: 'Triceps',         group: 'arms' },
    { id: 'antebrat',       name: 'Antebraț',                    muscle: 'Antebraț',        group: 'arms' },
    // Abdomen
    { id: 'abd_sup',        name: 'Abdomen superior (aparat)',   muscle: 'Abdomen',         group: 'core' },
    { id: 'abd_inf',        name: 'Abdomen inferior',            muscle: 'Abdomen',         group: 'core' },
  ];

  /* ---------- Săli / aparate ----------
   * Tag-ul contează la scripeți și aparate: 50 kg la "Salsa" ≠ 50 kg la "Columbia".
   * Comparațiile și recordurile se fac doar între sesiuni din aceeași sală. */
  const GYMS = ['General', 'Columbia', 'Salsa'];

  /* ---------- Tag-uri rapide pentru notițe ---------- */
  const NOTE_TAGS = ['Controlat / Lent', 'Cu ajutor', 'Greu', 'Obosit'];

  /* ---------- Șabloane de zi ----------
   * items[].gym = null → "automat": se folosește sala de data trecută. */
  const item = (exId, gym = null) => ({ exId, gym });
  const DEFAULT_TEMPLATES = [
    {
      id: 'chest', name: 'Chest Day', subtitle: 'Piept + Triceps + Gambe', color: '#f472b6',
      items: ['dips', 'chest_incline_db', 'chest_press', 'pec_fly', 'triceps_vbar', 'triceps_overhead', 'gambe'].map((id) => item(id)),
    },
    {
      id: 'legs', name: 'Leg Day', subtitle: 'Picioare', color: '#fb923c',
      items: ['presa', 'gambe', 'hams', 'leg_ext', 'adductor', 'abductor'].map((id) => item(id)),
    },
    {
      id: 'arms', name: 'Brațe + Umeri + Abd', subtitle: 'Brațe + Umeri + Abdomen', color: '#c084fc',
      items: ['abd_sup', 'umeri_gantere', 'biceps_gantere', 'abd_inf', 'umeri_aparat', 'biceps_cablu'].map((id) => item(id)),
    },
    {
      id: 'back', name: 'Back Day', subtitle: 'Spate + Traps + Delts + Antebraț', color: '#38bdf8',
      items: ['tractiuni', 'pulley', 'pulldown', 'traps', 'side_delts', 'antebrat'].map((id) => item(id)),
    },
  ];

  /* =====================================================================
   * ISTORIC REAL PREÎNCĂRCAT
   * Notație compactă:
   *   ex(id, [kgÎnc, repsÎnc] | null, [[kg, reps, [[dropKg, dropReps]]], ...], opțiuni)
   * ===================================================================== */
  function ex(exId, warm, sets, opts = {}) {
    return {
      exId,
      gym: opts.gym || 'General',
      tags: opts.tags || [],
      note: opts.note || '',
      warmup: warm ? { kg: warm[0], reps: warm[1], bw: warm[0] === 0, done: true } : null,
      sets: sets.map(([kg, reps, drops]) => ({
        kg, reps, done: true,
        drops: (drops || []).map(([dk, dr]) => ({ kg: dk, reps: dr })),
      })),
    };
  }

  function session(date, templateId, title, exercises, opts = {}) {
    const id = 'w-' + date;
    const ts = new Date(date + 'T18:00:00').getTime();
    return {
      id, date, templateId, title,
      tags: opts.tags || [], note: opts.note || '',
      exercises: exercises.map((e, i) => Object.assign({ uid: id + '-' + i }, e)),
      createdAt: ts, updatedAt: ts,
    };
  }

  const REAL_HISTORY = [
    session('2026-09-22', 'arms', 'Brațe + Umeri + Abd', [
      ex('abd_sup',        [15, 20], [[35, 14], [45, 12], [58, 2, [[50, 4]]]]),
      ex('umeri_gantere',  [5, 20],  [[18, 14], [20, 12]]),
      ex('biceps_gantere', [10, 12], [[17.5, 9], [17.5, 7], [15, 10]]),
      ex('abd_inf',        [20, 20], [[41, 14], [57, 12], [65, 6]]),
      ex('umeri_aparat',   null,     [[80, 10], [96, 3]]),
      ex('biceps_cablu',   null,     [[30, 12], [40, 9]]),
    ]),
    session('2026-09-24', 'legs', 'Leg Day', [
      ex('presa',   [50, 14], [[100, 14], [140, 12], [165, 6]]),
      ex('gambe',   null,     [[75, 12], [100, 10], [120, 8], [120, 8]]),
      ex('hams',    [24, 12], [[48, 12], [64, 6]]),
      ex('leg_ext', [25, 14], [[50, 11], [70, 5, [[50, 5]]]]),
    ]),
    session('2026-09-28', 'chest', 'Chest Day', [
      ex('dips',             [0, 12], [[10, 8], [10, 7], [10, 4]]),
      ex('chest_incline_db', null,    [[26, 8], [26, 7], [24, 11]]),
      ex('chest_press',      null,    [[45, 12], [55, 10], [65, 4, [[60, 3]]]]),
      ex('triceps_vbar',     null,    [[35, 8], [35, 4], [25, 11]]),
    ]),
    session('2026-10-02', 'legs', 'Leg Day', [
      ex('presa',   [50, 12], [[100, 12], [130, 10], [170, 8]]),
      ex('gambe',   [20, 12], [[80, 12], [100, 9], [120, 6]]),
      ex('hams',    [24, 12], [[48, 12], [64, 6]]),
      ex('leg_ext', [25, 14], [[50, 12], [70, 7, [[50, 3]]]]),
    ]),
    session('2026-10-11', 'back', 'Back Day', [
      ex('tractiuni',  null,     [[10, 6], [10, 3], [0, 7]]),
      ex('pulley',     [20, 12], [[35, 12], [50, 11], [50, 11]]),
      ex('traps',      null,     [[22.5, 12], [25, 10], [27.5, 8]]),
      ex('side_delts', null,     [[7.5, 12], [10, 13], [10, 11]]),
    ]),
    session('2026-11-03', 'chest', 'Chest Day', [
      ex('chest_incline_db', null,     [[26, 12], [26, 10], [26, 8]]),
      ex('gambe',            [30, 12], [[100, 11], [120, 7], [120, 8]]),
      ex('triceps_overhead', null,     [[10, 7], [7, 12], [12, 12]]),
      ex('triceps_vbar',     null,     [[35, 8], [30, 10], [25, 12]]),
      ex('pec_fly',          [30, 12], [[50, 12], [50, 7], [40, 7]]),
    ]),
    session('2026-11-16', 'arms', 'Brațe + Umeri + Abd', [
      ex('abd_sup',        [30, 12], [[45, 12], [58, 8]]),
      ex('umeri_gantere',  [12, 14], [[20, 12], [24, 4], [22.5, 7]]),
      ex('biceps_gantere', null,     [[17.5, 8], [17.5, 7], [17.5, 8]]),
      ex('umeri_aparat',   null,     [[99, 12], [110, 12]], { gym: 'Columbia' }),
      ex('biceps_cablu',   null,     [[35, 10], [50, 5], [50, 5]]),
    ]),
    session('2026-11-18', 'back', 'Back Day', [
      ex('tractiuni',  [0, 5],   [], { tags: ['Controlat / Lent'] }),
      ex('pulley',     [25, 12], [[50, 12], [65, 12]], { gym: 'Salsa' }),
      ex('pulldown',   null,     [[57, 12], [73, 6]]),
      ex('traps',      [12, 12], [[25, 12], [27.5, 11]]),
      ex('side_delts', [5, 12],  [[7.5, 12], [12.5, 7, [[10, 7]]]]),
      ex('antebrat',   null,     [[7.5, 18], [12.5, 12], [15, 9]]),
    ]),
    session('2026-11-20', 'legs', 'Leg Day', [
      ex('presa',    [50, 12], [[120, 12], [135, 11], [170, 9]]),
      ex('gambe',    [30, 12], [[100, 12], [110, 9], [120, 6]]),
      ex('hams',     [32, 12], [[56, 11], [64, 10]]),
      ex('adductor', [25, 12], [[40, 12], [60, 12]]),
      ex('abductor', [20, 12], [[40, 12], [50, 10]]),
    ]),
  ];

  /* ---------- Profil biometric DEMONSTRATIV ----------
   * Valori de exemplu, ca tab-ul "Corp" să nu fie gol la prima rulare.
   * Se modifică direct din aplicație (tab-ul Corp). */
  const DEMO_PROFILE = { sex: 'M', age: 22, height: 180, goal: 'hipertrofie', activity: 1.55 };
  const DEMO_WEIGHT_LOG = [
    ['2026-09-20', 76.0], ['2026-09-27', 76.4], ['2026-10-04', 76.8], ['2026-10-11', 76.6],
    ['2026-10-18', 77.1], ['2026-10-25', 77.5], ['2026-11-01', 77.4], ['2026-11-08', 77.9],
    ['2026-11-15', 78.2], ['2026-11-21', 78.4],
  ].map(([date, kg]) => ({ date, kg }));

  const clone = (o) => JSON.parse(JSON.stringify(o));

  /* Starea completă a aplicației (aceeași formă e salvată în localStorage). */
  function createEmptyState() {
    return {
      schema: 1,
      workouts: [],
      templates: clone(DEFAULT_TEMPLATES),
      customExercises: [],
      gyms: GYMS.slice(),
      profile: { sex: 'M', age: null, height: null, goal: 'hipertrofie', activity: 1.55 },
      weightLog: [],
      settings: { restSeconds: 90, sound: true },
      ui: { tab: 'log', progressEx: null, progressGym: 'all', donutRange: 30, compareId: null, historyFilter: 'all' },
      draft: null,
    };
  }

  function createDemoState() {
    const s = createEmptyState();
    s.workouts = clone(REAL_HISTORY);
    s.profile = clone(DEMO_PROFILE);
    s.weightLog = clone(DEMO_WEIGHT_LOG);
    return s;
  }

  global.GymData = Object.freeze({
    GROUPS, GROUP_ORDER, EXERCISES, GYMS, NOTE_TAGS,
    REST_PRESETS: [60, 90, 120],
    TEMPLATE_COLORS: ['#f472b6', '#fb923c', '#c084fc', '#38bdf8', '#34d399', '#facc15', '#f87171', '#7b8cff'],
    REAL_HISTORY_COUNT: REAL_HISTORY.length,
    defaultTemplates: () => clone(DEFAULT_TEMPLATES),
    createEmptyState,
    createDemoState,
  });
})(window);
