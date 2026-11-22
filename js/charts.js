/* =====================================================================
 * GymLog Pro — js/charts.js
 * ---------------------------------------------------------------------
 * Vizualizările Chart.js, adaptate pentru Dark Mode:
 *   • progres pe exercițiu (linie = greutate maximă, bare = repetări totale)
 *   • distribuția pe grupe musculare (donut cu total în centru)
 *   • antrenamente pe săptămână (bare)
 *   • evoluția greutății corporale (linie cu gradient)
 * Plus două plugin-uri mici: etichete cu valori pe puncte și text în centrul donut-ului.
 *
 * Expune global: window.GymCharts
 * ===================================================================== */
(function (global) {
  'use strict';

  const instances = {};
  const COLORS = {
    brand: '#7b8cff',
    gold: '#fbbf24',
    text: '#94a3b8',
    grid: 'rgba(148, 163, 184, 0.10)',
    bar: 'rgba(148, 163, 184, 0.22)',
    barHover: 'rgba(148, 163, 184, 0.35)',
    tooltipBg: 'rgba(10, 14, 23, 0.96)',
  };
  const FONT = "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

  const ready = () => typeof global.Chart !== 'undefined';
  const U = () => global.GymStats.util;

  function init() {
    if (!ready()) return false;
    const C = global.Chart;
    C.defaults.color = COLORS.text;
    C.defaults.borderColor = COLORS.grid;
    C.defaults.font.family = FONT;
    C.defaults.font.size = 12;
    C.defaults.animation.duration = 550;
    C.defaults.maintainAspectRatio = false;
    C.defaults.responsive = true;
    const tt = C.defaults.plugins.tooltip;
    tt.backgroundColor = COLORS.tooltipBg;
    tt.borderColor = 'rgba(123, 140, 255, 0.35)';
    tt.borderWidth = 1;
    tt.padding = 10;
    tt.cornerRadius = 10;
    tt.titleFont = { family: FONT, weight: '700', size: 13 };
    tt.bodyFont = { family: FONT, size: 12 };
    tt.boxPadding = 4;
    C.defaults.plugins.legend.labels.usePointStyle = true;
    C.defaults.plugins.legend.labels.boxWidth = 8;
    C.defaults.plugins.legend.labels.padding = 14;
    return true;
  }

  function mount(key, canvas, config) {
    if (instances[key]) { instances[key].destroy(); delete instances[key]; }
    if (!canvas) return null;
    if (!ready()) {
      canvas.parentElement.innerHTML = '<div class="chart-fallback">Graficul are nevoie de Chart.js — verifică conexiunea la internet sau fișierul <code>js/vendor/chart.umd.min.js</code>.</div>';
      return null;
    }
    instances[key] = new global.Chart(canvas, config);
    return instances[key];
  }

  function destroyAll() { Object.keys(instances).forEach((k) => { instances[k].destroy(); delete instances[k]; }); }

  /* Gradient vertical sub linie. */
  function gradient(rgb, top = 0.35) {
    return (ctx) => {
      const { chart } = ctx;
      const area = chart.chartArea;
      if (!area) return 'rgba(' + rgb + ', 0.1)';
      const g = chart.ctx.createLinearGradient(0, area.top, 0, area.bottom);
      g.addColorStop(0, 'rgba(' + rgb + ', ' + top + ')');
      g.addColorStop(1, 'rgba(' + rgb + ', 0)');
      return g;
    };
  }

  /* Plugin: scrie valoarea deasupra fiecărui punct (dataset.valueLabels = true). */
  const valueLabels = {
    id: 'gymValueLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      chart.data.datasets.forEach((ds, i) => {
        if (!ds.valueLabels) return;
        const meta = chart.getDatasetMeta(i);
        if (meta.hidden) return;
        meta.data.forEach((pt, j) => {
          const v = ds.data[j];
          if (v === null || v === undefined) return;
          const txt = ds.valueFormat ? ds.valueFormat(v, j) : String(v);
          ctx.save();
          ctx.font = '700 11px ' + FONT;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = (ds.valueColors && ds.valueColors[j]) || '#e2e8f0';
          ctx.fillText(txt, pt.x, pt.y - 10);
          ctx.restore();
        });
      });
    },
  };

  /* Plugin: text în centrul donut-ului. */
  const centerText = {
    id: 'gymCenterText',
    afterDraw(chart, _args, opts) {
      if (!opts || !opts.title) return;
      const meta = chart.getDatasetMeta(0);
      if (!meta || !meta.data.length) return;
      const { x, y } = meta.data[0];
      const { ctx } = chart;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#e7ecf5';
      ctx.font = '800 26px ' + FONT;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(opts.title, x, y + 4);
      ctx.fillStyle = COLORS.text;
      ctx.font = '600 11px ' + FONT;
      ctx.textBaseline = 'top';
      ctx.fillText(opts.subtitle || '', x, y + 10);
      ctx.restore();
    },
  };

  /* ---------- 1. Progres pe exercițiu ---------- */
  function renderProgress(canvas, series, opts = {}) {
    const u = U();
    const labels = series.map((s) => u.fmtDate(s.date));
    const maxKg = series.map((s) => s.maxKg);
    const reps = series.map((s) => s.totalReps);
    const repsMax = Math.max(...reps, 1);
    // Scala kg încadrează datele (cu marjă), ca diferențele de câteva kg să se vadă.
    const lo = Math.min(...maxKg);
    const hi = Math.max(...maxKg);
    const span = Math.max(hi - lo, hi * 0.1, 5);
    const yMin = Math.max(0, Math.floor((lo - span * 0.8) / 5) * 5);
    const yMax = Math.ceil((hi + span * 0.45) / 5) * 5;
    // Pe ecrane înguste (telefon) ascundem titlurile axelor, ca să rămână loc pentru grafic.
    const compact = canvas && canvas.parentElement && canvas.parentElement.clientWidth < 520;

    return mount('progress', canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            type: 'line',
            label: 'Greutate maximă (kg)',
            data: maxKg,
            yAxisID: 'y',
            order: 0,
            borderColor: COLORS.brand,
            backgroundColor: gradient('123, 140, 255', 0.32),
            fill: 'start',
            tension: 0.35,
            borderWidth: 3,
            pointRadius: series.map((s) => (s.isPR ? 8 : 5)),
            pointHoverRadius: series.map((s) => (s.isPR ? 10 : 7)),
            pointStyle: series.map((s) => (s.isPR ? 'rectRot' : 'circle')),
            pointBackgroundColor: series.map((s) => (s.isPR ? COLORS.gold : COLORS.brand)),
            pointBorderColor: '#0a0e17',
            pointBorderWidth: 2,
            valueLabels: true,
            valueFormat: (v, j) => u.num(v) + ' kg × ' + series[j].topReps,
            valueColors: series.map((s) => (s.isPR ? COLORS.gold : '#e2e8f0')),
          },
          {
            type: 'bar',
            label: 'Repetări totale',
            data: reps,
            yAxisID: 'y1',
            order: 1,
            backgroundColor: COLORS.bar,
            hoverBackgroundColor: COLORS.barHover,
            borderRadius: 8,
            maxBarThickness: 44,
          },
        ],
      },
      options: {
        layout: { padding: { top: 26, right: 6, left: 2 } },
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: { grid: { display: false }, ticks: { font: { weight: '600' } } },
          y: {
            position: 'left',
            beginAtZero: false,
            min: yMin,
            max: yMax,
            title: { display: !compact, text: 'kg (greutate maximă)', font: { size: 11, weight: '600' } },
            ticks: { callback: (v) => u.num(v) },
          },
          y1: {
            position: 'right',
            beginAtZero: true,
            suggestedMax: repsMax * 2.2,
            grid: { drawOnChartArea: false },
            title: { display: !compact, text: 'repetări totale', font: { size: 11, weight: '600' } },
          },
        },
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              title: (items) => u.fmtDateLong(series[items[0].dataIndex].date),
              label: (item) => {
                const s = series[item.dataIndex];
                return item.dataset.type === 'line'
                  ? ' Greutate maximă: ' + u.num(s.maxKg) + ' kg × ' + s.topReps + ' rep.'
                  : ' Repetări totale: ' + s.totalReps;
              },
              afterBody: (items) => {
                const s = series[items[0].dataIndex];
                const lines = ['Total ridicat: ' + u.num(Math.round(s.volume)) + ' kg'];
                if (s.gym && s.gym !== 'General') lines.push('Sală: ' + s.gym);
                if (s.isPR) lines.push('★ Record personal');
                return lines;
              },
            },
          },
        },
        onClick: opts.onClick,
      },
      plugins: [valueLabels],
    });
  }

  /* ---------- 2. Distribuția pe grupe musculare ---------- */
  function renderDonut(canvas, dist) {
    const items = dist.items.filter((i) => i.sets > 0);
    return mount('donut', canvas, {
      type: 'doughnut',
      data: {
        labels: items.map((i) => i.label),
        datasets: [{
          data: items.map((i) => i.sets),
          backgroundColor: items.map((i) => i.color),
          borderColor: '#131a28',
          borderWidth: 3,
          hoverOffset: 8,
          borderRadius: 6,
        }],
      },
      options: {
        cutout: '70%',
        layout: { padding: 8 },
        plugins: {
          legend: { display: false },
          gymCenterText: { title: String(dist.total), subtitle: 'serii efective' },
          tooltip: {
            callbacks: {
              label: (item) => {
                const it = items[item.dataIndex];
                return ' ' + it.label + ': ' + it.sets + ' serii (' + Math.round(it.pct * 100) + '%)';
              },
            },
          },
        },
      },
      plugins: [centerText],
    });
  }

  /* ---------- 3. Antrenamente pe săptămână ---------- */
  function renderWeekly(canvas, weeks) {
    const max = Math.max(...weeks.map((w) => w.count), 3);
    return mount('weekly', canvas, {
      type: 'bar',
      data: {
        labels: weeks.map((w) => w.label),
        datasets: [{
          label: 'Antrenamente',
          data: weeks.map((w) => w.count),
          backgroundColor: weeks.map((w) => (w.count >= 2 ? '#34d399' : w.count === 1 ? COLORS.brand : 'rgba(148,163,184,.18)')),
          borderRadius: 8,
          maxBarThickness: 28,
          minBarLength: 3,
        }],
      },
      options: {
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 0, autoSkip: true, autoSkipPadding: 6 } },
          y: { beginAtZero: true, suggestedMax: max, ticks: { stepSize: 1, precision: 0 } },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => 'Săptămâna din ' + weeks[items[0].dataIndex].label,
              label: (item) => ' ' + U().plural(item.raw, 'antrenament', 'antrenamente'),
            },
          },
        },
      },
    });
  }

  /* ---------- 4. Greutatea corporală ---------- */
  function renderWeight(canvas, log) {
    const u = U();
    return mount('weight', canvas, {
      type: 'line',
      data: {
        labels: log.map((e) => u.fmtDate(e.date)),
        datasets: [{
          label: 'Greutate corporală (kg)',
          data: log.map((e) => e.kg),
          borderColor: '#34d399',
          backgroundColor: gradient('52, 211, 153', 0.28),
          fill: true,
          tension: 0.35,
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointBackgroundColor: '#34d399',
          pointBorderColor: '#0a0e17',
          pointBorderWidth: 2,
          valueLabels: log.length <= 14,
          valueFormat: (v) => u.num(v),
          valueColors: log.map(() => '#a7f3d0'),
        }],
      },
      options: {
        layout: { padding: { top: 22, right: 8 } },
        scales: {
          x: { grid: { display: false } },
          y: { grace: '25%', ticks: { callback: (v) => u.num(v) + ' kg' } },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => u.fmtDateLong(log[items[0].dataIndex].date),
              label: (item) => ' ' + u.num(item.raw) + ' kg',
            },
          },
        },
      },
      plugins: [valueLabels],
    });
  }

  global.GymCharts = { init, ready, renderProgress, renderDonut, renderWeekly, renderWeight, destroyAll };
})(window);
