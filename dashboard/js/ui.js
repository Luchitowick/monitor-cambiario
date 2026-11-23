/**
 * ui.js — Renderizado de componentes HTML
 * ---------------------------------------------------------------
 * Estado de conexión, banner de errores, decisión ejecutiva,
 * tarjetas KPI, panel de alertas y vista de tabla accesible.
 * Recibe datos ya procesados; no calcula indicadores.
 */
window.App = window.App || {};

App.ui = (() => {
  const f = App.format;
  const $ = (sel) => document.querySelector(sel);

  /** Escapa texto antes de insertarlo como HTML. */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const STATUS_TEXT = {
    loading: 'Cargando datos…',
    refreshing: 'Actualizando…',
    live: 'En vivo',
    server: 'En vivo (servidor)',
    cache: 'En vivo (caché)',
    stale: 'Caché sin conexión',
    fallback: 'Modo respaldo',
  };

  function setStatus(state) {
    const pill = $('#status-pill');
    pill.dataset.state = state;
    pill.querySelector('.label').textContent = STATUS_TEXT[state] || state;
  }

  function setLastUpdate(now, fetchedAt) {
    const parts = [`Pronóstico al ${f.dateNumeric(now)} ${f.time(now)}`];
    if (fetchedAt) parts.push(`consultado ${f.time(new Date(fetchedAt))}`);
    $('#last-update').textContent = parts.join(' · ');
  }

  function setRefreshing(isRefreshing) {
    const btn = $('#refresh-btn');
    btn.disabled = isRefreshing;
    btn.classList.toggle('is-spinning', isRefreshing);
    btn.setAttribute('aria-busy', String(isRefreshing));
  }

  function showBanner(result) {
    const banner = $('#error-banner');
    if (['live', 'server', 'cache'].includes(result.status)) {
      banner.hidden = true;
      return;
    }
    const isFallback = result.status === 'fallback';
    const when = isFallback ? `de demostración (${f.dateNumeric(new Date(App.fallbackData.snapshotDate + 'T12:00:00'))})` : 'guardados en caché';
    banner.className = `banner ${isFallback ? 'banner-critical' : 'banner-warning'}`;
    banner.innerHTML = `
      <span class="banner-icon" aria-hidden="true">${isFallback ? '⛔' : '!'}</span>
      <div><strong>No se pudo conectar con Open-Meteo.</strong>
      Mostrando datos ${when}. <span class="banner-detail">(${esc(result.errors[0] || 'error de red')})</span></div>
      <button type="button" class="btn btn-sm" data-action="retry">Reintentar</button>`;
    banner.hidden = false;
  }

  function renderDecision(decision, now) {
    const el = $('#decision');
    el.dataset.severity = decision.severity;
    el.classList.remove('is-loading');
    el.innerHTML = `
      <div class="decision-badge sev-${decision.severity}"><span aria-hidden="true">${decision.meta.icon}</span> ${decision.meta.label}</div>
      <div class="decision-body">
        <p class="eyebrow">Decisión sugerida · ${f.dateNumeric(now)}</p>
        <h2 id="decision-title">${esc(decision.headline)}</h2>
        <p class="decision-action"><strong>Acción:</strong> ${esc(decision.action)}</p>
        <p class="decision-reason">${esc(decision.reason)}</p>
      </div>`;
  }

  /** Diferencia en °C con flecha; "adverso" cuando sube (más calor = más costo de frío). */
  function deltaTemp(value, hint) {
    if (!Number.isFinite(value)) return '<span class="delta">—</span>';
    const dir = value > 0.05 ? 'up' : value < -0.05 ? 'down' : 'flat';
    const cls = dir === 'up' ? 'adverse' : dir === 'down' ? 'favorable' : 'neutral';
    const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '■';
    return `<span class="delta ${cls}"><span aria-hidden="true">${arrow}</span> ${f.deltaC(value)}</span> <span class="kpi-hint">${hint}</span>`;
  }

  function tile({ label, value, unit, metaHtml, sub, spark, status }) {
    return `
      <article class="kpi ${status ? `kpi-${status}` : ''}">
        <h3 class="kpi-label">${label}</h3>
        <p class="kpi-value">${value}${unit ? ` <span class="kpi-unit">${unit}</span>` : ''}</p>
        <div class="kpi-meta">${metaHtml || ''}${spark || ''}</div>
        <p class="kpi-sub">${sub}</p>
      </article>`;
  }

  const uvCategory = (v) => (v >= 11 ? 'Extremo' : v >= 8 ? 'Muy alto' : v >= 6 ? 'Alto' : v >= 3 ? 'Moderado' : 'Bajo');

  function renderKpis(s, { heatThreshold, costPerDegreeHour, windowLabel }) {
    const { THRESHOLDS } = App.config;
    const t = s.temp;
    const heatStatus = t.max && t.max.value > heatThreshold + THRESHOLDS.heatCriticalMarginC ? 'critical' : t.hoursAbove > 0 ? 'serious' : 'good';
    const rainP = s.rain.maxProb ? s.rain.maxProb.value : NaN;
    const uv = s.uv.max ? s.uv.max.value : NaN;

    $('#kpis').innerHTML = [
      tile({
        label: 'Temperatura actual',
        value: f.celsius(s.current.temp),
        unit: Number.isFinite(s.current.feels) ? `sensación ${f.celsius(s.current.feels)}` : '',
        metaHtml: deltaTemp(s.current.vsYesterday, 'vs. ayer a esta hora'),
        spark: App.charts.sparkline(s.next24),
        sub: `Humedad ${f.pct(s.current.humidity)} · viento ${f.number(s.current.wind, 0)} km/h · curva: próximas 24 h`,
      }),
      tile({
        label: `Máxima · ${windowLabel}`,
        value: t.max ? f.celsius(t.max.value) : '—',
        unit: t.max ? f.dayHour(t.max.date) : '',
        status: heatStatus,
        metaHtml: deltaTemp(t.max ? t.max.value - heatThreshold : NaN, `vs. umbral ${f.celsius(heatThreshold, 1)}`),
        sub: `Mínima ${t.min ? f.celsius(t.min.value) : '—'} · promedio ${f.celsius(t.avg)}`,
      }),
      tile({
        label: 'Costo extra de frío',
        value: f.clp(t.extraCost),
        unit: 'CLP',
        status: heatStatus,
        metaHtml: `<span class="kpi-big-sub"><strong>${t.hoursAbove} h</strong> sobre el umbral · ${f.number(t.degreeHours, 1)} °C·h</span>`,
        sub: [`${f.clp(costPerDegreeHour)} por °C·h`, t.coolest ? `franja más fresca: ${f.time(t.coolest.start)}–${f.time(t.coolest.end)}` : ''].filter(Boolean).join(' · '),
      }),
      tile({
        label: 'Lluvia y viento',
        value: f.pct(rainP),
        unit: 'prob. máx.',
        status: rainP >= THRESHOLDS.rainProbPct ? 'serious' : '',
        metaHtml: `<span class="kpi-big-sub">${f.number(s.rain.total, 1)} mm acumulados</span>`,
        sub: `Viento máximo ${s.wind.max ? `${f.number(s.wind.max.value, 0)} km/h (${f.dayHour(s.wind.max.date)})` : '—'}`,
      }),
      tile({
        label: 'Índice UV · Calidad del aire',
        value: f.number(uv, 1),
        unit: uvCategory(uv),
        status: uv >= THRESHOLDS.uvHigh ? 'serious' : '',
        metaHtml: `<span class="kpi-big-sub">PM2,5 prom. <strong>${f.number(s.air.avgPm25, 0)} µg/m³</strong></span>`,
        sub: `Norma diaria ${THRESHOLDS.pm25} µg/m³${s.air.coverageEnd ? ` · datos de aire hasta ${f.weekday(s.air.coverageEnd)}` : ''}`,
      }),
    ].join('');
  }

  function renderAlerts(alerts) {
    $('#alerts-count').textContent = `${alerts.filter((a) => a.severity !== 'info' && a.severity !== 'good').length} activas`;
    $('#alerts-list').innerHTML = alerts.map((a) => `
      <li class="alert sev-border-${a.severity}">
        <div class="alert-head">
          <span class="sev-chip sev-${a.severity}"><span aria-hidden="true">${a.meta.icon}</span> ${a.meta.label}</span>
          <h3>${esc(a.title)}</h3>
        </div>
        <p class="alert-evidence">${esc(a.evidence)}</p>
        <p class="alert-action"><span aria-hidden="true">→</span> ${esc(a.action)}</p>
      </li>`).join('');
  }

  /** Tabla horaria de la ventana (todas las variables), accesible y alternativa al gráfico. */
  function renderTable(window, windowLabel, heatThreshold) {
    const byTime = (pts) => new Map(pts.map((p) => [p.date.getTime(), p.value]));
    const cols = ['feels', 'humidity', 'rainProb', 'wind', 'uv', 'pm25'].map((k) => [k, byTime(window[k])]);
    const fmt = (k, v) => (v == null ? '—' : k === 'feels' ? f.celsius(v) : f.variable(v, k));
    const rows = window.temp.map((p) => {
      const hot = p.value > heatThreshold;
      return `<tr${hot ? ' class="row-hot"' : ''}><td>${f.dayHour(p.date)}</td><td>${f.celsius(p.value)}${hot ? ' <span class="sr-only">(sobre el umbral)</span>' : ''}</td>${cols.map(([k, m]) => `<td>${fmt(k, m.get(p.date.getTime()))}</td>`).join('')}</tr>`;
    }).join('');
    $('#data-table-wrap').innerHTML = `
      <table class="data-table">
        <caption>Pronóstico horario · ${esc(windowLabel)} (filas destacadas: sobre ${f.celsius(heatThreshold, 1)})</caption>
        <thead><tr><th scope="col">Hora</th><th scope="col">Temp.</th><th scope="col">Sensación</th><th scope="col">Humedad</th><th scope="col">Lluvia</th><th scope="col">Viento</th><th scope="col">UV</th><th scope="col">PM2,5</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function renderLegend(container, items) {
    container.innerHTML = items.map((it) => `<span class="legend-item"><i class="sw ${it.swatch}"></i>${it.label}</span>`).join('');
  }

  return { setStatus, setLastUpdate, setRefreshing, showBanner, renderDecision, renderKpis, renderAlerts, renderTable, renderLegend, esc };
})();
