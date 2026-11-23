/**
 * alerts.js — Motor de reglas para la toma de decisiones
 * ---------------------------------------------------------------
 * Evalúa los KPIs operativos contra umbrales de negocio y genera
 * alertas automáticas con evidencia + recomendación ejecutiva.
 * La alerta de mayor severidad se convierte en "Decisión sugerida".
 */
window.App = window.App || {};

App.alerts = (() => {
  const { THRESHOLDS } = App.config;
  const f = App.format;

  /** Orden de severidad (colores de estado reservados; siempre con ícono + etiqueta). */
  const SEVERITY = {
    critical: { rank: 0, label: 'Crítica', icon: '⛔' },
    serious: { rank: 1, label: 'Alta', icon: '▲' },
    warning: { rank: 2, label: 'Atención', icon: '!' },
    good: { rank: 3, label: 'Favorable', icon: '✓' },
    info: { rank: 4, label: 'Contexto', icon: 'i' },
  };

  const span = (b) => `${f.weekday(b.start)} ${f.time(b.start)}–${f.time(b.end)}`;

  /**
   * @param {object} s    resumen de analytics.summarize()
   * @param {object} p    { heatThreshold, costPerDegreeHour, windowLabel }
   * @returns {{alerts: Array, decision: object}}
   */
  function evaluate(s, { heatThreshold, costPerDegreeHour, windowLabel }) {
    const alerts = [];
    const t = s.temp;
    const win = windowLabel.toLowerCase();
    const coolest = t.coolest ? `${f.time(t.coolest.start)}–${f.time(t.coolest.end)} (promedio ${f.celsius(t.coolest.avg)})` : 'la madrugada';

    // 1) Calor vs. umbral de cadena de frío
    if (t.max && t.max.value > heatThreshold + THRESHOLDS.heatCriticalMarginC) {
      alerts.push({
        id: 'heat', severity: 'critical',
        title: `Calor extremo: ${f.celsius(t.max.value)} el ${f.dayHour(t.max.date)}`,
        evidence: `${t.hoursAbove} h sobre ${f.celsius(heatThreshold, 0)} en ${win}${t.block ? `; bloque más largo ${span(t.block)}` : ''}. Costo extra de refrigeración estimado: ${f.clp(t.extraCost)}.`,
        action: `Suspender despachos refrigerados en el bloque de calor, preenfriar camiones y concentrar salidas en ${coolest}.`,
        headline: 'Reprogramar despachos refrigerados fuera de las horas de calor extremo',
      });
    } else if (t.hoursAbove > 0) {
      alerts.push({
        id: 'heat', severity: 'serious',
        title: `${t.hoursAbove} h sobre el umbral de ${f.celsius(heatThreshold, 0)}`,
        evidence: `Máxima ${f.celsius(t.max.value)} el ${f.dayHour(t.max.date)}${t.block ? `; bloque más largo ${span(t.block)}` : ''}. ${f.number(t.degreeHours, 0)} °C·h extra × ${f.clp(costPerDegreeHour)} = ${f.clp(t.extraCost)}.`,
        action: `Adelantar las cargas refrigeradas a ${coolest} y limitar el tiempo de puertas abiertas en el andén.`,
        headline: 'Adelantar despachos refrigerados a la franja más fresca',
      });
    } else {
      alerts.push({
        id: 'heat', severity: 'good',
        title: `Temperatura bajo el umbral en ${win}`,
        evidence: `Máxima esperada ${t.max ? f.celsius(t.max.value) : '—'}, ${f.deltaC(t.max ? t.max.value - heatThreshold : NaN)} respecto al umbral de ${f.celsius(heatThreshold, 0)}.`,
        action: 'Operación normal: mantener la programación de despachos y turnos.',
        headline: 'Operación estable: mantener la programación normal',
      });
    }

    // 2) Lluvia
    const rp = s.rain.maxProb;
    if ((rp && rp.value >= THRESHOLDS.rainProbPct) || s.rain.total >= THRESHOLDS.rainMm) {
      alerts.push({
        id: 'rain', severity: s.rain.total >= THRESHOLDS.rainMm ? 'serious' : 'warning',
        title: `Lluvia probable (${f.pct(rp ? rp.value : NaN)}) el ${rp ? f.weekday(rp.date) : '—'}`,
        evidence: `Acumulado esperado ${f.number(s.rain.total, 1)} mm en ${win}.`,
        action: 'Cubrir pallets en patio, sumar 20–30 min a las rutas y confirmar horarios de entrega con clientes.',
        headline: 'Preparar contingencia de lluvia para rutas y patio',
      });
    }

    // 3) Viento
    const wm = s.wind.max;
    if (wm && wm.value >= THRESHOLDS.windKmh) {
      alerts.push({
        id: 'wind', severity: 'warning',
        title: `Viento fuerte: ${f.number(wm.value, 0)} km/h`,
        evidence: `Ráfagas sobre ${THRESHOLDS.windKmh} km/h el ${f.dayHour(wm.date)}.`,
        action: 'Asegurar carga alta y lonas; evitar maniobras con grúa horquilla en patio abierto en ese horario.',
        headline: 'Asegurar carga y patio por viento fuerte',
      });
    }

    // 4) Radiación UV → seguridad del personal de patio (Ley 20.096)
    const uv = s.uv.max;
    if (uv && uv.value >= THRESHOLDS.uvHigh) {
      const extreme = uv.value >= THRESHOLDS.uvExtreme;
      alerts.push({
        id: 'uv', severity: 'warning',
        title: `Índice UV ${extreme ? 'extremo' : 'muy alto'} (${f.number(uv.value, 1)})`,
        evidence: `Peak el ${f.dayHour(uv.date)}. Desde ${THRESHOLDS.uvHigh} la OMS clasifica el riesgo como muy alto y exige protección adicional.`,
        action: 'Rotar al personal de patio entre 12:00 y 16:00, y entregar bloqueador, jockey y agua.',
        headline: 'Proteger al personal de patio por radiación UV',
      });
    }

    // 5) Calidad del aire (norma diaria PM2,5)
    const pm = s.air.worstDailyPm25;
    if (Number.isFinite(pm) && pm > THRESHOLDS.pm25) {
      alerts.push({
        id: 'air', severity: 'serious',
        title: `PM2,5 sobre la norma (${f.number(pm, 0)} µg/m³)`,
        evidence: `El promedio diario supera la norma de ${THRESHOLDS.pm25} µg/m³.`,
        action: 'Reducir trabajo físico al aire libre y revisar la restricción vehicular de la flota.',
        headline: 'Limitar trabajo al aire libre por mala calidad del aire',
      });
    } else if (Number.isFinite(s.air.avgPm25)) {
      alerts.push({
        id: 'air', severity: 'info',
        title: `Calidad del aire aceptable (PM2,5 ${f.number(s.air.avgPm25, 0)} µg/m³)`,
        evidence: `Promedio de la ventana bajo la norma diaria de ${THRESHOLDS.pm25} µg/m³.`,
        action: 'Sin restricciones para trabajo al aire libre.',
        headline: 'Sin acción urgente',
      });
    }

    // 6) Tendencia: próximos 7 días vs. últimos 7 días
    if (Number.isFinite(s.warming) && s.warming >= THRESHOLDS.warmingC) {
      alerts.push({
        id: 'trend', severity: 'warning',
        title: `Semana más calurosa: ${f.deltaC(s.warming)}`,
        evidence: 'El promedio de las máximas de los próximos 7 días supera al de los últimos 7 días.',
        action: 'Revisar la mantención de equipos de frío y reforzar el turno de madrugada.',
        headline: 'Preparar equipos de frío para una semana más calurosa',
      });
    } else if (Number.isFinite(s.warming)) {
      alerts.push({
        id: 'trend', severity: 'info',
        title: `Tendencia de calor: ${f.deltaC(s.warming)}`,
        evidence: 'Promedio de máximas de los próximos 7 días vs. los últimos 7 días.',
        action: 'Sin cambios relevantes en la carga térmica semanal.',
        headline: 'Sin acción urgente',
      });
    }

    alerts.sort((a, b) => SEVERITY[a.severity].rank - SEVERITY[b.severity].rank);
    const top = alerts[0];
    return {
      alerts: alerts.map((a) => ({ ...a, meta: SEVERITY[a.severity] })),
      decision: { severity: top.severity, meta: SEVERITY[top.severity], headline: top.headline, reason: top.evidence, action: top.action },
    };
  }

  return { evaluate, SEVERITY };
})();
