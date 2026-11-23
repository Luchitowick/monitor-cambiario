/**
 * main.js — Orquestador de la aplicación
 * ---------------------------------------------------------------
 * Mantiene el estado, conecta los controles de la interfaz,
 * coordina carga de datos (manual y polling) y re-renderiza.
 * Flujo: API → analytics (KPIs) → alerts (decisiones) → ui + charts.
 */
(() => {
  const { config, api, analytics: A, alerts, ui, charts, format: f } = window.App;
  const PREFS_KEY = 'monitor-clima:prefs';
  const PREF_FIELDS = ['variable', 'window', 'heatThreshold', 'costPerDegreeHour'];

  /* ---------- estado ---------- */
  const state = {
    ...config.DEFAULTS,
    data: null,          // datos normalizados (series horarias + diarias)
    raw: null,           // resultado de la API (estado, errores)
    isLoading: false,
    pollTimer: null,
  };

  /* ---------- preferencias persistidas ---------- */
  function loadPrefs() {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      PREF_FIELDS.forEach((k) => { if (saved[k] != null) state[k] = saved[k]; });
    } catch { /* sin preferencias */ }
    if (!config.VARIABLES[state.variable]) state.variable = config.DEFAULTS.variable;
    if (!config.WINDOWS[state.window]) state.window = config.DEFAULTS.window;
  }
  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(Object.fromEntries(PREF_FIELDS.map((k) => [k, state[k]]))));
    } catch { /* sin almacenamiento */ }
  }

  /* ---------- gráficos ---------- */
  const mainChart = new charts.LineChart(document.getElementById('main-chart'), { height: 340, mobileHeight: 250, ariaLabel: 'Pronóstico horario de la variable seleccionada' });
  const barChart = new charts.DivergingBarChart(document.getElementById('bar-chart'), { ariaLabel: 'Temperatura máxima diaria respecto al umbral' });
  const hoursChart = new charts.DivergingBarChart(document.getElementById('hours-chart'), { ariaLabel: 'Horas sobre el umbral por día' });

  /* ---------- carga de datos ---------- */
  async function load({ force = false } = {}) {
    if (state.isLoading) return; // evita peticiones simultáneas
    state.isLoading = true;
    ui.setStatus(state.data ? 'refreshing' : 'loading');
    ui.setRefreshing(true);

    const result = await api.loadDashboardData({ force });

    state.raw = result;
    state.data = A.normalize(result);

    ui.setStatus(result.status);
    ui.showBanner(result);
    ui.setRefreshing(false);
    state.isLoading = false;
    render();
  }

  /** Índices de las etiquetas del eje X: medianoche (varios días) o cada 3 h (24 h). */
  function hourlyTicks(points, multiDay) {
    return points.map((p, i) => [p, i]).filter(([p]) => {
      const hh = Number(f.time(p.date).slice(0, 2));
      return multiDay ? hh === 0 : hh % 3 === 0;
    }).map(([, i]) => i).reverse();
  }

  /* ---------- render principal ---------- */
  function render() {
    if (!state.data) return;
    const { variable, heatThreshold, costPerDegreeHour } = state;
    const win = config.WINDOWS[state.window];
    const params = { heatThreshold, costPerDegreeHour, windowLabel: win.label };

    // 1) KPIs
    const s = A.summarize(state.data, win, params);

    // 2) Alertas y decisión
    const { alerts: list, decision } = alerts.evaluate(s, params);

    ui.setLastUpdate(s.now, state.raw.fetchedAt);
    ui.renderDecision(decision, s.now);
    ui.renderKpis(s, params);
    ui.renderAlerts(list);

    // 3) Gráfico principal (horario)
    const meta = config.VARIABLES[variable];
    const points = s.window[variable];
    const thresholdValue = meta.threshold === 'heatC' ? heatThreshold : (meta.threshold ? config.THRESHOLDS[meta.threshold] : null);
    const multiDay = win.to - win.from > 24;
    const unitTxt = meta.unit ? ` ${meta.unit}` : '';

    document.getElementById('main-chart-title').textContent = meta.label;
    document.getElementById('main-chart-sub').textContent = `${meta.unit || 'índice'} por hora · ${win.label.toLowerCase()}`;

    if (!points.length) {
      ui.renderLegend(document.getElementById('main-legend'), []);
      document.getElementById('main-chart-sub').textContent = `Sin datos de ${meta.label.toLowerCase()} para ${win.label.toLowerCase()}`;
    } else {
      const series = [{ id: 'main', name: meta.short, points, className: 'series-main', endLabel: (p) => f.variable(p.value, variable) }];
      if (variable === 'temp') series.push({ id: 'feels', name: 'Sensación térmica', points: s.window.feels, className: 'series-sma', dashed: true });
      ui.renderLegend(document.getElementById('main-legend'), [
        { swatch: 'sw-main', label: meta.short },
        ...(variable === 'temp' ? [{ swatch: 'sw-sma', label: 'Sensación térmica' }] : []),
        ...(thresholdValue != null ? [{ swatch: 'sw-threshold', label: 'Umbral' }] : []),
      ]);

      const feelsByTime = new Map(s.window.feels.map((p) => [p.date.getTime(), p.value]));
      mainChart.update({
        series,
        threshold: thresholdValue != null ? { value: thresholdValue, label: `Umbral ${f.number(thresholdValue, meta.decimals)}${unitTxt}` } : null,
        yFormat: (v) => f.number(v, 0),
        xFormat: multiDay ? f.weekday : f.time,
        xTicks: hourlyTicks(points, multiDay),
        titleFormat: f.dayHour,
        tooltipRows: (i) => {
          const p = points[i];
          const rows = [{ label: meta.short, value: f.variable(p.value, variable), swatch: 'sw-main' }];
          if (variable === 'temp' && feelsByTime.has(p.date.getTime())) rows.push({ label: 'Sensación', value: f.celsius(feelsByTime.get(p.date.getTime())), swatch: 'sw-sma' });
          if (thresholdValue != null) {
            const diff = p.value - thresholdValue;
            rows.push({ label: 'Vs. umbral', value: `${diff > 0 ? '+' : diff < 0 ? '−' : ''}${f.number(Math.abs(diff), meta.decimals)}${unitTxt}` });
          }
          return rows;
        },
      });
      ui.renderTable(s.window, win.label, heatThreshold);
    }

    // 4) Máxima diaria vs. umbral (últimos 7 días + próximos 7)
    const days = s.daily.all;
    const todayKey = A.dayKey(s.now);
    const above = s.daily.next.filter((d) => d.tmax > heatThreshold).length;
    document.getElementById('bar-chart-sub').textContent = `°C sobre o bajo ${f.celsius(heatThreshold, 1)} · ${above} de ${s.daily.next.length} días próximos sobre el umbral`;
    barChart.update({
      points: days.map((d) => ({ date: d.date, value: d.tmax - heatThreshold })),
      yFormat: (v) => `${v > 0 ? '+' : ''}${f.number(v, 0)}`,
      xFormat: f.weekday,
      titleFormat: (d) => `${f.dateLong(d)}${A.dayKey(d) === todayKey ? ' (hoy)' : ''}`,
      barClass: (p) => (A.dayKey(p.date) < todayKey ? 'bar-past' : ''),
      tooltipRows: (i) => [
        { label: 'Máxima', value: f.celsius(days[i].tmax) },
        { label: 'Mínima', value: f.celsius(days[i].tmin) },
        { label: 'Vs. umbral', value: f.deltaC(days[i].tmax - heatThreshold) },
        { label: 'Lluvia', value: `${f.pct(days[i].rainProb)} · ${f.number(days[i].rainSum, 1)} mm` },
      ],
    });

    // 5) Horas sobre el umbral por día (próximos 7) + costo
    const perDay = s.perDay;
    const totalCost = perDay.reduce((acc, d) => acc + d.cost, 0);
    document.getElementById('hours-chart-sub').textContent = `Próximos 7 días · costo extra estimado ${f.clp(totalCost)}`;
    hoursChart.update({
      points: perDay.map((d) => ({ date: d.date, value: d.hours })),
      positiveOnly: true,
      yFormat: (v) => `${f.number(v, 0)} h`,
      xFormat: f.weekday,
      titleFormat: f.dateLong,
      barClass: (p) => (p.value === 0 ? 'bar-zero' : ''),
      tooltipRows: (i) => [
        { label: 'Horas sobre el umbral', value: `${perDay[i].hours} h` },
        { label: 'Bloque', value: perDay[i].block ? `${f.time(perDay[i].block.start)}–${f.time(perDay[i].block.end)}` : '—' },
        { label: 'Máxima', value: perDay[i].max ? f.celsius(perDay[i].max.value) : '—' },
        { label: 'Costo extra', value: f.clp(perDay[i].cost) },
      ],
    });
  }

  /* ---------- polling controlado ---------- */
  function startPolling() {
    stopPolling();
    state.pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') load(); // usa caché si aún está fresca
    }, config.POLL_INTERVAL_MS);
  }
  function stopPolling() {
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = null;
  }

  /* ---------- eventos ---------- */
  const debounce = (fn, ms = 300) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  function bindRadios(name, key) {
    document.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
      input.checked = input.value === state[key];
      input.addEventListener('change', () => { state[key] = input.value; savePrefs(); render(); });
    });
  }

  function bindControls() {
    // Filtros: variable y ventana temporal
    bindRadios('variable', 'variable');
    bindRadios('window', 'window');

    // Parámetros de negocio (simulación "¿qué pasa si?")
    const thrInput = document.getElementById('heat-threshold');
    const costInput = document.getElementById('cost-dh');
    thrInput.value = state.heatThreshold;
    costInput.value = state.costPerDegreeHour;
    const onParams = debounce(() => {
      const thr = Number(thrInput.value);
      const cost = Number(costInput.value);
      const thrOk = thrInput.value !== '' && thr >= 10 && thr <= 45;
      const costOk = costInput.value !== '' && cost >= 0;
      thrInput.toggleAttribute('aria-invalid', !thrOk);
      costInput.toggleAttribute('aria-invalid', !costOk);
      if (thrOk) state.heatThreshold = thr;
      if (costOk) state.costPerDegreeHour = cost;
      savePrefs();
      render();
    });
    thrInput.addEventListener('input', onParams);
    costInput.addEventListener('input', onParams);

    // Actualización manual (ignora caché)
    document.getElementById('refresh-btn').addEventListener('click', () => load({ force: true }));
    document.getElementById('error-banner').addEventListener('click', (e) => {
      if (e.target.closest('[data-action="retry"]')) load({ force: true });
    });

    // Polling
    const pollToggle = document.getElementById('polling-toggle');
    pollToggle.addEventListener('change', () => (pollToggle.checked ? startPolling() : stopPolling()));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && pollToggle.checked) load();
    });

    // Vista de tabla
    const tableBtn = document.getElementById('table-toggle');
    tableBtn.addEventListener('click', () => {
      const wrap = document.getElementById('data-table-wrap');
      wrap.hidden = !wrap.hidden;
      tableBtn.setAttribute('aria-expanded', String(!wrap.hidden));
      tableBtn.textContent = wrap.hidden ? 'Ver tabla' : 'Ocultar tabla';
    });

    // Tema claro / oscuro
    const themeBtn = document.getElementById('theme-btn');
    themeBtn.addEventListener('click', () => {
      const root = document.documentElement;
      const isDark = root.dataset.theme ? root.dataset.theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.dataset.theme = isDark ? 'light' : 'dark';
      try { localStorage.setItem('monitor-clima:theme', root.dataset.theme); } catch { /* */ }
    });
  }

  /* ---------- inicio ---------- */
  try {
    const theme = localStorage.getItem('monitor-clima:theme');
    if (theme) document.documentElement.dataset.theme = theme;
  } catch { /* */ }
  loadPrefs();
  bindControls();
  startPolling();
  load();
})();
