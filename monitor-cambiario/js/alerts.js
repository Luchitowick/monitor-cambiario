/**
 * alerts.js — Motor de reglas para la toma de decisiones
 * ---------------------------------------------------------------
 * Evalúa los KPIs contra umbrales de negocio y genera alertas
 * automáticas con evidencia + recomendación ejecutiva accionable.
 * La alerta de mayor severidad se convierte en "Decisión sugerida".
 */
window.App = window.App || {};

App.alerts = (() => {
  const { THRESHOLDS } = App.config;
  const f = App.format;

  /** Orden de severidad (status colors reservados; siempre con ícono + etiqueta). */
  const SEVERITY = {
    critical: { rank: 0, label: 'Crítica', icon: '⛔' },
    serious: { rank: 1, label: 'Alta', icon: '▲' },
    warning: { rank: 2, label: 'Atención', icon: '!' },
    good: { rank: 3, label: 'Oportunidad', icon: '✓' },
    info: { rank: 4, label: 'Contexto', icon: 'i' },
  };

  /**
   * @param {object} ctx { dolar, cobre, uf (resúmenes), impact, budgetRate, purchaseUsd, tpm, correlation, rangeDays }
   * @returns {{alerts: Array, decision: object}}
   */
  function evaluate(ctx) {
    const { dolar, cobre, uf, impact, budgetRate, purchaseUsd, tpm, correlation, rangeDays } = ctx;
    const alerts = [];
    const spot = dolar.last.value;

    // 1) Brecha contra el tipo de cambio presupuestado
    if (impact.gapPct > THRESHOLDS.budgetCriticalPct) {
      alerts.push({
        id: 'budget', severity: 'critical',
        title: `Dólar ${f.pct(impact.gapPct)} sobre el presupuesto`,
        evidence: `Spot ${f.clp(spot, 2)} vs. presupuesto ${f.clp(budgetRate)}. Comprar hoy US$${f.number(purchaseUsd, 0)} cuesta ${f.clpMillions(impact.overrun)} más de lo planificado.`,
        action: 'Cubrir al menos el 50 % de las compras de los próximos 60 días con forward y traspasar el alza a la lista de precios.',
        headline: 'Cubrir exposición con forward y ajustar precios de venta',
      });
    } else if (impact.gapPct > 0) {
      alerts.push({
        id: 'budget', severity: 'serious',
        title: `Dólar ${f.pct(impact.gapPct)} sobre el presupuesto`,
        evidence: `Spot ${f.clp(spot, 2)} vs. presupuesto ${f.clp(budgetRate)} → sobrecosto de ${f.clpMillions(impact.overrun)} en la compra mensual.`,
        action: 'Cubrir con forward las órdenes ya comprometidas y comprar solo lo urgente al spot.',
        headline: 'Cubrir órdenes comprometidas y limitar compras spot',
      });
    } else {
      alerts.push({
        id: 'budget', severity: 'good',
        title: `Dólar ${f.pct(Math.abs(impact.gapPct))} bajo el presupuesto`,
        evidence: `Spot ${f.clp(spot, 2)} vs. presupuesto ${f.clp(budgetRate)} → ahorro de ${f.clpMillions(Math.abs(impact.overrun))} en la compra mensual.`,
        action: 'Ventana favorable: adelantar pagos a proveedores y comprar USD para el próximo mes.',
        headline: 'Adelantar compras de USD aprovechando el tipo de cambio',
      });
    }

    // 2) Dólar en extremos del período
    if (dolar.isRangeMax) {
      alerts.push({
        id: 'extreme', severity: 'serious',
        title: `Dólar en su máximo de los últimos ${rangeDays} días`,
        evidence: `${f.clp(spot, 2)} supera el máximo previo del rango (mín. ${f.clp(dolar.min, 2)}).`,
        action: 'Evitar compras spot grandes en el peak; escalonar compras en tramos semanales.',
        headline: 'Escalonar compras: el dólar está en máximos',
      });
    } else if (dolar.isRangeMin) {
      alerts.push({
        id: 'extreme', severity: 'good',
        title: `Dólar en su mínimo de los últimos ${rangeDays} días`,
        evidence: `${f.clp(spot, 2)} es el valor más bajo del rango (máx. ${f.clp(dolar.max, 2)}).`,
        action: 'Buen punto de entrada: concentrar compras de divisas esta semana.',
        headline: 'Concentrar compras: el dólar está en mínimos',
      });
    }

    // 3) Tendencia (medias móviles + regresión)
    const slope = dolar.trend.slopePctPerDay;
    if (dolar.smaSignal === 'up' && slope > THRESHOLDS.trendPctPerDay) {
      alerts.push({
        id: 'trend', severity: 'warning',
        title: 'Tendencia alcista del dólar',
        evidence: `Media 5 días (${f.clp(dolar.sma5, 2)}) sobre media 20 días (${f.clp(dolar.sma20, 2)}); pendiente ${f.pct(slope, 2)} diario.`,
        action: 'Adelantar órdenes de compra programadas antes de que el alza se consolide.',
        headline: 'Adelantar órdenes programadas ante tendencia alcista',
      });
    } else if (dolar.smaSignal === 'down' && slope < -THRESHOLDS.trendPctPerDay) {
      alerts.push({
        id: 'trend', severity: 'good',
        title: 'Tendencia bajista del dólar',
        evidence: `Media 5 días (${f.clp(dolar.sma5, 2)}) bajo media 20 días (${f.clp(dolar.sma20, 2)}); pendiente ${f.pct(slope, 2)} diario.`,
        action: 'Postergar compras no urgentes unos días para capturar un mejor tipo de cambio.',
        headline: 'Postergar compras no urgentes',
      });
    }

    // 4) Volatilidad
    if (dolar.volatility > THRESHOLDS.volHighPct) {
      alerts.push({
        id: 'vol', severity: 'serious',
        title: `Volatilidad alta (${f.pct(dolar.volatility, 1, false)} anual)`,
        evidence: `La dispersión de las variaciones diarias supera el umbral de ${THRESHOLDS.volHighPct} %.`,
        action: 'Fraccionar compras en 4 tramos semanales y fijar precios a clientes por menos días.',
        headline: 'Fraccionar compras por alta volatilidad',
      });
    } else if (dolar.volatility < THRESHOLDS.volLowPct) {
      alerts.push({
        id: 'vol', severity: 'info',
        title: `Volatilidad baja (${f.pct(dolar.volatility, 1, false)} anual)`,
        evidence: 'Mercado estable: el costo de cobertura debería ser menor.',
        action: 'Buen momento para cotizar forwards a 90 días.',
        headline: 'Cotizar forwards con mercado estable',
      });
    }

    // 5) Cobre: principal exportación de Chile; su caída suele debilitar el peso
    if (cobre.changeRange < THRESHOLDS.copperDropPct) {
      // La recomendación depende de si los datos del período confirman la relación inversa
      const confirmed = Number.isFinite(correlation) && correlation <= -0.3;
      const corrTxt = Number.isFinite(correlation)
        ? (confirmed
          ? ` La correlación de retornos dólar–cobre (${f.number(correlation, 2)}) confirma la relación inversa en el período.`
          : ` En este período la correlación diaria es débil (${f.number(correlation, 2)}), así que el efecto aún no se confirma.`)
        : '';
      alerts.push({
        id: 'copper', severity: confirmed ? 'serious' : 'warning',
        title: `Cobre cae ${f.pct(cobre.changeRange)} en ${rangeDays} días`,
        evidence: `Libra a ${f.usd(cobre.last.value)}. Al entrar menos dólares al país, el tipo de cambio suele subir.${corrTxt}`,
        action: confirmed
          ? 'Reforzar coberturas: es probable que el dólar se mantenga presionado.'
          : 'Monitorear a diario; si la caída del cobre continúa, ampliar la cobertura de las compras.',
        headline: confirmed ? 'Reforzar coberturas por caída del cobre' : 'Monitorear el cobre antes de ampliar coberturas',
      });
    }

    // 6) Contexto macro: UF (reajuste de contratos) y TPM
    alerts.push({
      id: 'macro', severity: 'info',
      title: `UF ${f.clp(uf.last.value, 2)} · TPM ${f.number(tpm, 2)} %`,
      evidence: `La UF subió ${f.pct(uf.changeRange, 2)} en ${rangeDays} días.`,
      action: 'Mantener contratos de arriendo y servicios indexados en UF; revisar costo de financiamiento con la TPM vigente.',
      headline: 'Sin acción urgente',
    });

    alerts.sort((a, b) => SEVERITY[a.severity].rank - SEVERITY[b.severity].rank);
    const top = alerts[0];
    return {
      alerts: alerts.map((a) => ({ ...a, meta: SEVERITY[a.severity] })),
      decision: { severity: top.severity, meta: SEVERITY[top.severity], headline: top.headline, reason: top.evidence, action: top.action },
    };
  }

  return { evaluate, SEVERITY };
})();
