/**
 * format.js — Formateo localizado (es-CL)
 * ---------------------------------------------------------------
 * Todos los números y fechas pasan por aquí para mantener unidades
 * consistentes (°C, %, km/h, CLP) y la zona horaria de Chile.
 */
window.App = window.App || {};

App.format = (() => {
  const TZ = App.config.LOCATION.timezone;
  const numberFormatters = new Map();

  function number(value, decimals = 1) {
    if (!Number.isFinite(value)) return '—';
    if (!numberFormatters.has(decimals)) {
      numberFormatters.set(decimals, new Intl.NumberFormat('es-CL', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
    }
    // Redondea antes de formatear para evitar "-0,0"
    const rounded = Number(value.toFixed(decimals)) || 0;
    return numberFormatters.get(decimals).format(rounded);
  }

  const clp = (v, d = 0) => (Number.isFinite(v) ? `$${number(v, d)}` : '—');
  const pct = (v, d = 0) => `${number(v, d)}%`;
  const celsius = (v, d = 1) => `${number(v, d)} °C`;
  /** Diferencia con signo: +2,3 °C / −1,0 °C */
  const deltaC = (v, d = 1) => (Number.isFinite(v) ? `${v > 0 ? '+' : v < 0 ? '−' : ''}${number(Math.abs(v), d)} °C` : '—');

  /** Valor de una variable del dashboard con su unidad. */
  function variable(value, key) {
    const meta = App.config.VARIABLES[key];
    if (key === 'temp') return celsius(value, meta.decimals);
    return `${number(value, meta.decimals)}${meta.unit ? (meta.unit === '%' ? '%' : ` ${meta.unit}`) : ''}`;
  }

  const fmt = (opts) => new Intl.DateTimeFormat('es-CL', { timeZone: TZ, ...opts });
  const dateShort = fmt({ day: '2-digit', month: 'short' });
  const weekdayShort = fmt({ weekday: 'short', day: '2-digit' });
  const dateLong = fmt({ weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  const dateNumeric = fmt({ day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeFmt = fmt({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const isoDay = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const clean = (s) => s.replace(/\./g, '');

  return {
    number,
    clp,
    pct,
    celsius,
    deltaC,
    variable,
    dateShort: (d) => clean(dateShort.format(d)),
    weekday: (d) => clean(weekdayShort.format(d)),
    dateLong: (d) => clean(dateLong.format(d)),
    dateNumeric: (d) => dateNumeric.format(d),
    time: (d) => timeFmt.format(d),
    /** "lun 23 · 14:00" para tooltips horarios */
    dayHour: (d) => `${clean(weekdayShort.format(d))} · ${timeFmt.format(d)}`,
    /** Clave de día local (YYYY-MM-DD en hora de Chile) */
    dayKey: (d) => isoDay.format(d),
  };
})();
