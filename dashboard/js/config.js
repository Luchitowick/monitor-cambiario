/**
 * config.js
 * ---------------------------------------------------------------
 * Configuración central del dashboard: ubicación, endpoints, tiempos
 * de red, caché, parámetros de negocio y umbrales de alerta.
 * Cambiar valores aquí ajusta todo el comportamiento sin tocar lógica.
 */
window.App = window.App || {};

App.config = (() => {
  /** Centro de distribución en Maipú (Región Metropolitana). */
  const LOCATION = Object.freeze({ name: 'Maipú', latitude: -33.5167, longitude: -70.7667, timezone: 'America/Santiago' });

  const common = `latitude=${LOCATION.latitude}&longitude=${LOCATION.longitude}&timezone=${encodeURIComponent(LOCATION.timezone)}&timeformat=unixtime`;

  return Object.freeze({
    LOCATION,

    /**
     * API pública JSON Open-Meteo: gratuita, sin API key y con CORS abierto
     * (Access-Control-Allow-Origin: *), por lo que funciona desde cualquier
     * página, iframe o archivo local.
     * IMPORTANTE: app.py (Streamlit) usa estas mismas URLs; si cambian aquí, actualizarlas allá.
     */
    ENDPOINTS: Object.freeze({
      forecast: 'https://api.open-meteo.com/v1/forecast?' + common
        + '&past_days=7&forecast_days=7'
        + '&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,precipitation'
        + '&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation_probability,precipitation,wind_speed_10m,uv_index'
        + '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max',
      air: 'https://air-quality-api.open-meteo.com/v1/air-quality?' + common
        + '&past_days=7&forecast_days=5&hourly=pm2_5,pm10,us_aqi',
    }),

    /**
     * Variables horarias que se pueden explorar en el gráfico principal.
     * threshold: clave del umbral en THRESHOLDS (o null) que se dibuja como línea.
     */
    VARIABLES: Object.freeze({
      temp: { label: 'Temperatura', short: 'Temp.', unit: '°C', decimals: 1, threshold: 'heatC' },
      humidity: { label: 'Humedad relativa', short: 'Humedad', unit: '%', decimals: 0, threshold: null },
      rainProb: { label: 'Probabilidad de lluvia', short: 'Lluvia', unit: '%', decimals: 0, threshold: 'rainProbPct' },
      wind: { label: 'Viento a 10 m', short: 'Viento', unit: 'km/h', decimals: 0, threshold: 'windKmh' },
      uv: { label: 'Índice UV', short: 'UV', unit: '', decimals: 1, threshold: 'uvHigh' },
      pm25: { label: 'Material particulado PM2,5', short: 'PM2,5', unit: 'µg/m³', decimals: 0, threshold: 'pm25' },
    }),

    /** Red y resiliencia */
    FETCH_TIMEOUT_MS: 8000,          // corta la petición si la API tarda más de 8 s
    RETRIES: 2,                      // reintentos con backoff exponencial (0,6 s → 1,2 s)
    CACHE_TTL_MS: 15 * 60 * 1000,    // 15 min: el modelo se actualiza cada hora, evitamos saturar la API
    POLL_INTERVAL_MS: 10 * 60 * 1000, // polling controlado cada 10 min (pausado si la pestaña está oculta)

    /** Parámetros del caso de negocio (editables por el usuario en la interfaz) */
    COMPANY: 'Distribuidora Frío Sur SpA',
    DEFAULTS: Object.freeze({
      variable: 'temp',
      window: 'next72',      // next24 | next72 | next168
      heatThreshold: 27,     // °C sobre los que el andén y los camiones pierden cadena de frío
      costPerDegreeHour: 3500, // CLP de energía extra de refrigeración por cada °C·h sobre el umbral
    }),

    /** Ventanas temporales del filtro (horas relativas a "ahora"). */
    WINDOWS: Object.freeze({
      next24: { label: 'Próximas 24 h', from: 0, to: 24 },
      next72: { label: 'Próximos 3 días', from: 0, to: 72 },
      next168: { label: 'Próximos 7 días', from: 0, to: 168 },
    }),

    /** Umbrales que disparan alertas automáticas */
    THRESHOLDS: Object.freeze({
      heatC: 27,           // valor por defecto; el usuario lo ajusta en pantalla
      heatCriticalMarginC: 4, // calor extremo = umbral + 4 °C: suspender despachos en horas peak
      rainProbPct: 60,     // probabilidad de lluvia relevante
      rainMm: 5,           // lluvia acumulada diaria relevante (mm)
      windKmh: 40,         // viento fuerte: riesgo en andén y carga alta
      uvHigh: 8,           // UV muy alto (escala OMS) → protección de personal en patio
      uvExtreme: 11,
      pm25: 50,            // µg/m³ — norma diaria chilena de PM2,5
      warmingC: 2,         // alza del promedio de máximas próximos 7 días vs. últimos 7 días
    }),
  });
})();
