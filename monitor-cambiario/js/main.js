/**
 * main.js — Orquestador de la aplicación
 * ---------------------------------------------------------------
 * Mantiene el estado, conecta los controles de la interfaz,
 * coordina carga de datos (manual y polling) y re-renderiza.
 * Flujo: API → analytics (KPIs) → alerts (decisiones) → ui + charts.
 */
(() => {
  const { config, api, analytics: A, alerts, ui, charts, format: f } = window.App;
  const PREFS_KEY = 'monitor-cambiario:prefs';

  /* ---------- estado ---------- */
  const state = {
    ...config.DEFAULTS,
    data: null,          // series normalizadas
    raw: null,           // resultado de la API (estado, errores)
    isLoading: false,
    pollTimer: null,
  };

  /* ---------- preferencias persistidas ---------- */
  function loadPrefs() {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      ['indicator', 'rangeDays', 'budgetRate', 'purchaseUsd'].forEach((k) => { if (saved[k] != null) state[k] = saved[k]; });
      if (!config.INDICATORS[state.indicator]) state.indicator = config.DEFAULTS.indicator;
    } catch { /* sin preferencias */ }
  }
  function savePrefs() {
    try {
      const { indicator, rangeDays, budgetRate, purchaseUsd } = state;
      localStorage.setItem(PREFS_KEY, JSON.stringify({ indicator, rangeDays, budgetRate, purchaseUsd }));
    } catch { /* sin almacenamiento */ }
  }

  /* ---------- gráficos ---------- */
  const mainChart = new charts.LineChart(document.getElementById('main-chart'), { height: 340, mobileHeight: 250, ariaLabel: 'Evolución del indicador seleccionado' });
  const barChart = new charts.DivergingBarChart(document.getElementById('bar-chart'), { ariaLabel: 'Variación diaria porcentual' });
  const indexChart = new charts.LineChart(document.getElementById('index-chart'), { height: 240, mobileHeight: 220, ariaLabel: 'Dólar versus cobre en índice base 100' });

  /* ---------- carga de datos ---------- */
  async function load({ force = false } = {}) {
    if (state.isLoading) return; // evita peticiones simultáneas
    state.isLoading = true;
    ui.setStatus(state.data ? 'refreshing' : 'loading');
    ui.setRefreshing(true);

    const result = await api.loadDashboardData({ force });

    state.raw = result;
    state.data = Object.fromEntries(Object.entries(result.series).map(([k, serie]) => [k, A.normalizeSerie(serie)]));
    state.tpm = Number(result.root?.tpm?.valor);

    ui.setStatus(result.status);
    ui.showBanner(result);
    ui.setRefreshing(false);
    state.isLoading = false;
    render();
  }

  /* ---------- render principal ---------- */
  function render() {
    if (!state.data) return;
    const { rangeDays, budgetRate, purchaseUsd, indicator } = state;
    const d = state.data;

    // 1) KPIs
    const dolar = A.summarize(d.dolar, rangeDays);
    const cobre = A.summarize(d.libra_cobre, rangeDays);
    const uf = A.summarize(d.uf, rangeDays);
    const impact = A.budgetImpact(dolar.last.value, budgetRate, purchaseUsd);
    const correlation = A.returnsCorrelation(dolar.points, cobre.points);
    const ctx = { dolar, cobre, uf, impact, budgetRate, purchaseUsd, rangeDays, correlation, tpm: state.tpm };

    // 2) Alertas y decisión
    const { alerts: list, decision } = alerts.evaluate(ctx);

    ui.setLastUpdate(dolar.last.date, state.raw.fetchedAt);
    ui.renderDecision(decision, dolar.last.date);
    ui.renderKpis(ctx);
    ui.renderAlerts(list);

    // 3) Gráfico principal
    const meta = config.INDICATORS[indicator];
    const full = d[indicator];
    const points = A.filterByRange(full, rangeDays);
    const smaFull = A.sma(full, 7);
    const smaRange = smaFull.slice(full.length - points.length);
    const smaPoints = smaRange.filter((p) => p.value != null);
    const fmtY = (v) => (meta.currency === 'USD' ? f.number(v, 2) : f.number(v, 0));
    const showBudget = indicator === 'dolar';

    document.getElementById('main-chart-title').textContent = meta.label;
    document.getElementById('main-chart-sub').textContent = `${meta.unitLong} · últimos ${rangeDays} días`;
    ui.renderLegend(document.getElementById('main-legend'), [
      { swatch: 'sw-main', label: meta.short },
      { swatch: 'sw-sma', label: 'Media móvil 7' },
      ...(showBudget ? [{ swatch: 'sw-threshold', label: 'Presupuesto' }] : []),
    ]);

    mainChart.update({
      series: [
        { id: 'main', name: meta.short, points, className: 'series-main', endLabel: (p) => f.indicator(p.value, indicator) },
        { id: 'sma', name: 'Media móvil 7', points: smaPoints, className: 'series-sma', dashed: true },
      ],
      threshold: showBudget ? { value: budgetRate, label: `Presupuesto ${f.clp(budgetRate)}` } : null,
      yFormat: fmtY,
      tooltipRows: (i) => {
        const p = points[i];
        const prev = i > 0 ? points[i - 1] : full[full.indexOf(p) - 1];
        const rows = [
          { label: meta.short, value: f.indicator(p.value, indicator), swatch: 'sw-main' },
          { label: 'Var. diaria', value: prev ? f.pct(A.pctChange(prev.value, p.value), 2) : '—' },
        ];
        if (smaRange[i] && smaRange[i].value != null) rows.push({ label: 'Media móvil 7', value: f.indicator(smaRange[i].value, indicator), swatch: 'sw-sma' });
        if (showBudget) rows.push({ label: 'Vs. presupuesto', value: f.pct(A.pctChange(budgetRate, p.value), 2) });
        return rows;
      },
    });
    ui.renderTable(indicator, points, smaRange);

    // 4) Variaciones diarias
    const returns = A.filterByRange(A.dailyReturns(full), rangeDays);
    const ups = returns.filter((r) => r.value > 0).length;
    document.getElementById('bar-chart-sub').textContent = `${meta.short} · ${ups} alzas y ${returns.length - ups} bajas en ${rangeDays} días`;
    barChart.update({
      points: returns,
      yFormat: (v) => `${f.number(v, Math.abs(v) < 1 && v !== 0 ? 1 : 0)}%`,
      tooltipRows: (i) => [
        { label: 'Variación', value: f.pct(returns[i].value, 2) },
        { label: 'Cierre', value: f.indicator(returns[i].level, indicator) },
      ],
    });

    // 5) Dólar vs cobre (índice base 100: un solo eje, escalas comparables)
    const idxDolar = A.indexBase100(dolar.points);
    const idxCobre = A.indexBase100(cobre.points);
    document.getElementById('index-chart-sub').textContent = `Base 100 = ${f.dateShort(dolar.points[0].date)} · correlación de retornos ${Number.isFinite(correlation) ? f.number(correlation, 2) : '—'}`;
    indexChart.update({
      series: [
        { id: 'dolar', name: 'Dólar', points: idxDolar, className: 'series-1', endLabel: (p) => `Dólar ${f.number(p.value, 1)}` },
        { id: 'cobre', name: 'Cobre', points: idxCobre, className: 'series-2', endLabel: (p) => `Cobre ${f.number(p.value, 1)}` },
      ],
      reference: 100,
      yFormat: (v) => f.number(v, 0),
      tooltipRows: (i) => {
        const key = A.dayKey(idxDolar[i].date);
        const ci = idxCobre.findIndex((p) => A.dayKey(p.date) === key);
        const rows = [{ label: `Dólar ${f.clp(dolar.points[i].value, 2)}`, value: f.number(idxDolar[i].value, 1), swatch: 'sw-1' }];
        if (ci >= 0) rows.push({ label: `Cobre ${f.usd(cobre.points[ci].value)}`, value: f.number(idxCobre[ci].value, 1), swatch: 'sw-2' });
        return rows;
      },
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

  function bindControls() {
    // Selección de indicador y rango (radios segmentados)
    document.querySelectorAll('input[name="indicator"]').forEach((input) => {
      input.checked = input.value === state.indicator;
      input.addEventListener('change', () => { state.indicator = input.value; savePrefs(); render(); });
    });
    document.querySelectorAll('input[name="range"]').forEach((input) => {
      input.checked = Number(input.value) === state.rangeDays;
      input.addEventListener('change', () => { state.rangeDays = Number(input.value); savePrefs(); render(); });
    });

    // Parámetros de negocio (simulación "qué pasa si")
    const budgetInput = document.getElementById('budget-rate');
    const purchaseInput = document.getElementById('purchase-usd');
    budgetInput.value = state.budgetRate;
    purchaseInput.value = state.purchaseUsd;
    const onParams = debounce(() => {
      const b = Number(budgetInput.value);
      const p = Number(purchaseInput.value);
      budgetInput.toggleAttribute('aria-invalid', !(b > 0));
      purchaseInput.toggleAttribute('aria-invalid', !(p >= 0));
      if (b > 0) state.budgetRate = b;
      if (p >= 0) state.purchaseUsd = p;
      savePrefs();
      render();
    });
    budgetInput.addEventListener('input', onParams);
    purchaseInput.addEventListener('input', onParams);

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
      try { localStorage.setItem('monitor-cambiario:theme', root.dataset.theme); } catch { /* */ }
    });
  }

  /* ---------- inicio ---------- */
  try {
    const theme = localStorage.getItem('monitor-cambiario:theme');
    if (theme) document.documentElement.dataset.theme = theme;
  } catch { /* */ }
  loadPrefs();
  bindControls();
  startPolling();
  load();
})();
