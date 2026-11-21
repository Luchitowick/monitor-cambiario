/**
 * analytics.js — Transformación analítica del payload
 * ---------------------------------------------------------------
 * Convierte el JSON crudo de la API en series limpias y en KPIs de
 * negocio: variaciones %, medias móviles, volatilidad, tendencia,
 * extremos del período, correlación y brecha contra presupuesto.
 * Funciones puras: no tocan el DOM (fáciles de probar).
 */
window.App = window.App || {};

App.analytics = (() => {
  const DAY_MS = 86400000;
  const dayKey = (d) => d.toISOString().slice(0, 10);

  /**
   * Limpieza: parsea fechas/valores, descarta inválidos y futuros,
   * elimina duplicados por día y ordena cronológicamente (la API viene descendente).
   */
  function normalizeSerie(serie = []) {
    const limit = Date.now() + DAY_MS;
    const seen = new Set();
    return serie
      .map((p) => ({ date: new Date(p.fecha), value: Number(p.valor) }))
      .filter((p) => !Number.isNaN(p.date.getTime()) && p.date.getTime() <= limit && Number.isFinite(p.value) && p.value > 0)
      .sort((a, b) => a.date - b.date)
      .filter((p) => {
        const k = dayKey(p.date);
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
  }

  /** Filtro temporal: últimos N días calendario desde el último dato. */
  function filterByRange(points, days) {
    if (!points.length) return [];
    const from = points[points.length - 1].date.getTime() - days * DAY_MS;
    return points.filter((p) => p.date.getTime() >= from);
  }

  const pctChange = (from, to) => (Number.isFinite(from) && from !== 0 ? ((to - from) / from) * 100 : NaN);
  const mean = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : NaN);

  /** Desviación estándar muestral. */
  function stdev(arr) {
    if (arr.length < 2) return NaN;
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
  }

  /** Variación % entre el último dato y el dato vigente hace N días. */
  function changeOverDays(points, days) {
    if (points.length < 2) return NaN;
    const last = points[points.length - 1];
    const target = last.date.getTime() - days * DAY_MS;
    let base = null;
    for (let i = points.length - 2; i >= 0; i -= 1) {
      if (points[i].date.getTime() <= target) { base = points[i]; break; }
    }
    return base ? pctChange(base.value, last.value) : pctChange(points[0].value, last.value);
  }

  /** Media móvil simple de `window` observaciones (null donde no alcanza). */
  function sma(points, window) {
    return points.map((p, i) => {
      if (i < window - 1) return { date: p.date, value: null };
      const slice = points.slice(i - window + 1, i + 1);
      return { date: p.date, value: mean(slice.map((s) => s.value)) };
    });
  }

  /** Variaciones porcentuales diarias (retornos simples). */
  function dailyReturns(points) {
    return points.slice(1).map((p, i) => ({ date: p.date, value: pctChange(points[i].value, p.value), level: p.value }));
  }

  /** Volatilidad anualizada: σ(retornos diarios) × √252 días hábiles. */
  function annualizedVolatility(points) {
    const r = dailyReturns(points).map((d) => d.value);
    return stdev(r) * Math.sqrt(252);
  }

  /** Regresión lineal por mínimos cuadrados → pendiente expresada en % diario y R². */
  function linearTrend(points) {
    const n = points.length;
    if (n < 3) return { slopePctPerDay: NaN, r2: NaN };
    const xs = points.map((p) => (p.date - points[0].date) / DAY_MS);
    const ys = points.map((p) => p.value);
    const mx = mean(xs);
    const my = mean(ys);
    let sxy = 0; let sxx = 0; let syy = 0;
    for (let i = 0; i < n; i += 1) {
      sxy += (xs[i] - mx) * (ys[i] - my);
      sxx += (xs[i] - mx) ** 2;
      syy += (ys[i] - my) ** 2;
    }
    const slope = sxx ? sxy / sxx : 0;
    const r2 = sxx && syy ? (sxy * sxy) / (sxx * syy) : 0;
    return { slopePctPerDay: (slope / my) * 100, r2 };
  }

  /** Correlación de Pearson entre retornos diarios de dos series (alineadas por fecha). */
  function returnsCorrelation(a, b) {
    const mapB = new Map(dailyReturns(b).map((d) => [dayKey(d.date), d.value]));
    const pairs = dailyReturns(a).map((d) => [d.value, mapB.get(dayKey(d.date))]).filter(([, y]) => Number.isFinite(y));
    if (pairs.length < 5) return NaN;
    const xs = pairs.map((p) => p[0]);
    const ys = pairs.map((p) => p[1]);
    const mx = mean(xs); const my = mean(ys);
    let num = 0; let dx = 0; let dy = 0;
    pairs.forEach(([x, y]) => { num += (x - mx) * (y - my); dx += (x - mx) ** 2; dy += (y - my) ** 2; });
    return dx && dy ? num / Math.sqrt(dx * dy) : NaN;
  }

  /** Re-expresa una serie como índice base 100 (permite comparar escalas distintas en UN solo eje). */
  const indexBase100 = (points) => (points.length ? points.map((p) => ({ date: p.date, value: (p.value / points[0].value) * 100 })) : []);

  /**
   * Resumen analítico de un indicador para el rango seleccionado.
   * Las medias móviles se calculan con la serie completa para no perder historia.
   */
  function summarize(fullPoints, rangeDays) {
    const points = filterByRange(fullPoints, rangeDays);
    const values = points.map((p) => p.value);
    const last = fullPoints[fullPoints.length - 1];
    const prev = fullPoints[fullPoints.length - 2];
    const max = Math.max(...values);
    const min = Math.min(...values);
    const sma5 = sma(fullPoints, 5).at(-1).value;
    const sma20 = sma(fullPoints, Math.min(20, fullPoints.length)).at(-1).value;

    return {
      points,
      last,
      prev,
      change1d: prev ? pctChange(prev.value, last.value) : NaN,
      change7d: changeOverDays(fullPoints, 7),
      changeRange: points.length > 1 ? pctChange(points[0].value, last.value) : NaN,
      max,
      min,
      avg: mean(values),
      maxPoint: points.find((p) => p.value === max),
      minPoint: points.find((p) => p.value === min),
      isRangeMax: last.value >= max,
      isRangeMin: last.value <= min,
      positionInRange: max > min ? (last.value - min) / (max - min) : 0.5,
      volatility: annualizedVolatility(points),
      trend: linearTrend(points),
      sma5,
      sma20,
      smaSignal: sma5 > sma20 ? 'up' : sma5 < sma20 ? 'down' : 'flat',
    };
  }

  /** Impacto financiero de comprar al dólar spot vs. el dólar presupuestado. */
  function budgetImpact(spotRate, budgetRate, purchaseUsd) {
    const gapClpPerUsd = spotRate - budgetRate;
    return {
      gapClpPerUsd,
      gapPct: pctChange(budgetRate, spotRate),
      costAtSpot: spotRate * purchaseUsd,
      costAtBudget: budgetRate * purchaseUsd,
      overrun: gapClpPerUsd * purchaseUsd, // >0 sobrecosto, <0 ahorro
    };
  }

  return {
    normalizeSerie, filterByRange, pctChange, sma, dailyReturns, annualizedVolatility,
    linearTrend, returnsCorrelation, indexBase100, summarize, budgetImpact, dayKey,
  };
})();
