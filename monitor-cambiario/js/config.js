/**
 * config.js
 * ---------------------------------------------------------------
 * Configuración central del dashboard: endpoints, tiempos de red,
 * caché, parámetros de negocio y umbrales de alerta.
 * Cambiar valores aquí ajusta todo el comportamiento sin tocar lógica.
 */
window.App = window.App || {};

App.config = Object.freeze({
  /** API pública JSON (Banco Central de Chile vía mindicador.cl). Soporta CORS. */
  API_BASE: 'https://mindicador.cl/api',

  /** Indicadores que consume el dashboard. */
  INDICATORS: Object.freeze({
    dolar: { code: 'dolar', label: 'Dólar observado', short: 'Dólar', unit: 'CLP/USD', unitLong: 'CLP por USD', currency: 'CLP', decimals: 2, adverseWhenUp: true },
    euro: { code: 'euro', label: 'Euro', short: 'Euro', unit: 'CLP/EUR', unitLong: 'CLP por EUR', currency: 'CLP', decimals: 2, adverseWhenUp: true },
    libra_cobre: { code: 'libra_cobre', label: 'Cobre (libra)', short: 'Cobre', unit: 'USD/lb', unitLong: 'USD por libra', currency: 'USD', decimals: 2, adverseWhenUp: false },
    uf: { code: 'uf', label: 'Unidad de Fomento', short: 'UF', unit: 'CLP', unitLong: 'CLP por UF', currency: 'CLP', decimals: 2, adverseWhenUp: false },
  }),

  /** Red y resiliencia */
  FETCH_TIMEOUT_MS: 8000,          // corta la petición si la API tarda más de 8 s
  RETRIES: 2,                      // reintentos con backoff exponencial (0,6 s → 1,2 s)
  CACHE_TTL_MS: 10 * 60 * 1000,    // 10 min: la API se actualiza 1 vez al día, evitamos saturarla
  POLL_INTERVAL_MS: 5 * 60 * 1000, // polling controlado cada 5 min (pausado si la pestaña está oculta)

  /** Parámetros del caso de negocio (editables por el usuario en la interfaz) */
  COMPANY: 'Importadora TecnoAndes SpA',
  DEFAULTS: Object.freeze({
    indicator: 'dolar',
    rangeDays: 30,
    budgetRate: 980,       // tipo de cambio presupuestado para 2026 (CLP por USD)
    purchaseUsd: 250000,   // compras mensuales a proveedores en USD
  }),

  /** Umbrales que disparan alertas automáticas */
  THRESHOLDS: Object.freeze({
    budgetCriticalPct: 3,  // dólar > 3 % sobre presupuesto → alerta crítica
    volHighPct: 12,        // volatilidad anualizada > 12 % → riesgo alto
    volLowPct: 6,          // volatilidad < 6 % → mercado estable
    copperDropPct: -5,     // caída del cobre > 5 % en el rango → presión sobre el peso
    trendPctPerDay: 0.05,  // pendiente de tendencia relevante (% diario)
  }),
});
