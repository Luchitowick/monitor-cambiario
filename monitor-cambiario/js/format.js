/**
 * format.js — Formateo localizado (es-CL)
 * ---------------------------------------------------------------
 * Todos los números y fechas pasan por aquí para mantener unidades
 * consistentes (CLP, USD, %) y la zona horaria de Chile.
 */
window.App = window.App || {};

App.format = (() => {
  const TZ = 'America/Santiago';
  const numberFormatters = new Map();

  function number(value, decimals = 2) {
    if (!Number.isFinite(value)) return '—';
    const key = decimals;
    if (!numberFormatters.has(key)) {
      numberFormatters.set(key, new Intl.NumberFormat('es-CL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
    }
    // Redondea antes de formatear para evitar "-0,00"
    const rounded = Number(value.toFixed(decimals)) || 0;
    return numberFormatters.get(key).format(rounded);
  }

  const clp = (v, d = 0) => `$${number(v, d)}`;
  const usd = (v, d = 2) => `US$${number(v, d)}`;
  const pct = (v, d = 1, signed = true) => {
    if (!Number.isFinite(v)) return '—';
    const r = Number(v.toFixed(d)) || 0;
    return `${signed && r > 0 ? '+' : ''}${number(r, d)}%`;
  };

  /** Montos grandes en millones de pesos: $7,2 M */
  const clpMillions = (v) => `${v < 0 ? '−' : ''}$${number(Math.abs(v) / 1e6, 1)} M`;

  /** Valor de un indicador con su moneda correcta. */
  function indicator(value, key) {
    const meta = App.config.INDICATORS[key];
    return meta.currency === 'USD' ? usd(value, meta.decimals) : clp(value, meta.decimals);
  }

  const dateShort = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', timeZone: TZ });
  const dateLong = new Intl.DateTimeFormat('es-CL', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ });
  const dateNumeric = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ });
  const timeFmt = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', timeZone: TZ });

  return {
    number,
    clp,
    usd,
    pct,
    clpMillions,
    indicator,
    dateShort: (d) => dateShort.format(d).replace('.', ''),
    dateLong: (d) => dateLong.format(d),
    dateNumeric: (d) => dateNumeric.format(d),
    time: (d) => timeFmt.format(d),
  };
})();
