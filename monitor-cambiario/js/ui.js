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
    cache: 'En vivo (caché)',
    stale: 'Caché sin conexión',
    fallback: 'Modo respaldo',
  };

  function setStatus(state) {
    const pill = $('#status-pill');
    pill.dataset.state = state;
    pill.querySelector('.label').textContent = STATUS_TEXT[state] || state;
  }

  function setLastUpdate(dataDate, fetchedAt) {
    const parts = [`Datos al ${f.dateNumeric(dataDate)}`];
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
    if (result.status === 'live' || result.status === 'cache') {
      banner.hidden = true;
      return;
    }
    const isFallback = result.status === 'fallback';
    const when = isFallback ? `del ${f.dateNumeric(new Date(App.fallbackData.snapshotDate + 'T12:00:00'))}` : 'guardados en caché';
    banner.className = `banner ${isFallback ? 'banner-critical' : 'banner-warning'}`;
    banner.innerHTML = `
      <span class="banner-icon" aria-hidden="true">${isFallback ? '⛔' : '!'}</span>
      <div><strong>No se pudo conectar con mindicador.cl.</strong>
      Mostrando datos de respaldo ${when}. <span class="banner-detail">(${esc(result.errors[0] || 'error de red')})</span></div>
      <button type="button" class="btn btn-sm" data-action="retry">Reintentar</button>`;
    banner.hidden = false;
  }

  function renderDecision(decision, dataDate) {
    const el = $('#decision');
    el.dataset.severity = decision.severity;
    el.classList.remove('is-loading');
    el.innerHTML = `
      <div class="decision-badge sev-${decision.severity}"><span aria-hidden="true">${decision.meta.icon}</span> ${decision.meta.label}</div>
      <div class="decision-body">
        <p class="eyebrow">Decisión sugerida para hoy · ${f.dateNumeric(dataDate)}</p>
        <h2 id="decision-title">${esc(decision.headline)}</h2>
        <p class="decision-action"><strong>Acción:</strong> ${esc(decision.action)}</p>
        <p class="decision-reason">${esc(decision.reason)}</p>
      </div>`;
  }

  /** Flecha + porcentaje, coloreado según si el movimiento es favorable para la empresa. */
  function delta(value, adverseWhenUp, decimals = 2) {
    if (!Number.isFinite(value)) return '<span class="delta">—</span>';
    const dir = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
    const adverse = (dir === 'up' && adverseWhenUp) || (dir === 'down' && !adverseWhenUp);
    const cls = dir === 'flat' ? 'neutral' : adverse ? 'adverse' : 'favorable';
    const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '■';
    const word = dir === 'flat' ? 'sin cambio' : adverse ? 'desfavorable' : 'favorable';
    return `<span class="delta ${cls}" title="${word}"><span aria-hidden="true">${arrow}</span> ${f.pct(value, decimals)}<span class="sr-only"> (${word})</span></span>`;
  }

  function tile({ label, value, unit, deltaHtml, sub, spark, status }) {
    return `
      <article class="kpi ${status ? `kpi-${status}` : ''}">
        <h3 class="kpi-label">${label}</h3>
        <p class="kpi-value">${value}${unit ? ` <span class="kpi-unit">${unit}</span>` : ''}</p>
        <div class="kpi-meta">${deltaHtml || ''}${spark || ''}</div>
        <p class="kpi-sub">${sub}</p>
      </article>`;
  }

  function renderKpis(ctx) {
    const { dolar, cobre, uf, impact, budgetRate, purchaseUsd, rangeDays, correlation, tpm } = ctx;
    const { THRESHOLDS } = App.config;
    const volLabel = dolar.volatility > THRESHOLDS.volHighPct ? 'Alta' : dolar.volatility < THRESHOLDS.volLowPct ? 'Baja' : 'Moderada';
    const overrunWord = impact.overrun >= 0 ? 'Sobrecosto' : 'Ahorro';

    $('#kpis').innerHTML = [
      tile({
        label: 'Dólar observado',
        value: f.clp(dolar.last.value, 2),
        unit: 'CLP/USD',
        deltaHtml: `${delta(dolar.change1d, true)} <span class="kpi-hint">vs. día anterior</span>`,
        spark: App.charts.sparkline(dolar.points),
        sub: `${rangeDays} días: ${f.pct(dolar.changeRange)}${dolar.isRangeMax ? ' · <strong>máximo del período</strong>' : dolar.isRangeMin ? ' · <strong>mínimo del período</strong>' : ''}`,
      }),
      tile({
        label: 'Brecha vs. presupuesto',
        value: f.pct(impact.gapPct),
        unit: `(${impact.gapClpPerUsd >= 0 ? '+' : '−'}${f.clp(Math.abs(impact.gapClpPerUsd), 2)}/USD)`,
        status: impact.gapPct > THRESHOLDS.budgetCriticalPct ? 'critical' : impact.gapPct > 0 ? 'serious' : 'good',
        deltaHtml: `<span class="kpi-big-sub">${overrunWord}: <strong>${f.clpMillions(Math.abs(impact.overrun))}</strong></span>`,
        sub: `Compra mensual US$${f.number(purchaseUsd, 0)} a presupuesto ${f.clp(budgetRate)}`,
      }),
      tile({
        label: 'Volatilidad anualizada',
        value: f.pct(dolar.volatility, 1, false),
        unit: volLabel,
        deltaHtml: `<span class="kpi-hint">Tendencia: ${f.pct(dolar.trend.slopePctPerDay, 2)} diario</span>`,
        sub: `Rango ${rangeDays} días: ${f.clp(dolar.min, 2)} – ${f.clp(dolar.max, 2)}`,
      }),
      tile({
        label: 'Cobre (libra)',
        value: f.usd(cobre.last.value),
        unit: 'USD/lb',
        deltaHtml: `${delta(cobre.changeRange, false, 1)} <span class="kpi-hint">en ${rangeDays} días</span>`,
        spark: App.charts.sparkline(cobre.points),
        sub: `Correlación con el dólar: ${Number.isFinite(correlation) ? f.number(correlation, 2) : '—'}`,
      }),
      tile({
        label: 'UF · TPM',
        value: f.clp(uf.last.value, 2),
        unit: 'CLP',
        deltaHtml: `${delta(uf.changeRange, true, 2)} <span class="kpi-hint">UF en ${rangeDays} días</span>`,
        sub: `Tasa de Política Monetaria: <strong>${f.number(tpm, 2)} %</strong>`,
      }),
    ].join('');
  }

  function renderAlerts(alerts) {
    $('#alerts-count').textContent = `${alerts.filter((a) => a.severity !== 'info').length} activas`;
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

  function renderTable(key, points, smaPoints) {
    const meta = App.config.INDICATORS[key];
    const rows = points.map((p, i) => {
      const prev = i > 0 ? points[i - 1].value : null;
      const change = prev ? App.analytics.pctChange(prev, p.value) : NaN;
      const s = smaPoints[i] && smaPoints[i].value;
      return `<tr><td>${f.dateNumeric(p.date)}</td><td>${f.indicator(p.value, key)}</td><td>${f.pct(change, 2)}</td><td>${s ? f.indicator(s, key) : '—'}</td></tr>`;
    }).reverse().join('');
    $('#data-table-wrap').innerHTML = `
      <table class="data-table">
        <caption>${meta.label} (${meta.unitLong}) — datos del período seleccionado</caption>
        <thead><tr><th scope="col">Fecha</th><th scope="col">Valor</th><th scope="col">Var. diaria</th><th scope="col">Media móvil 7</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
  }

  function renderLegend(container, items) {
    container.innerHTML = items.map((it) => `<span class="legend-item"><i class="sw ${it.swatch}"></i>${it.label}</span>`).join('');
  }

  return { setStatus, setLastUpdate, setRefreshing, showBanner, renderDecision, renderKpis, renderAlerts, renderTable, renderLegend, esc };
})();
