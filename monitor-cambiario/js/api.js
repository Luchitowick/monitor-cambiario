/**
 * api.js — Capa de datos
 * ---------------------------------------------------------------
 * Responsabilidades:
 *  1. Consumir la API pública con fetch() + async/await.
 *  2. Cortar peticiones lentas (AbortController + timeout).
 *  3. Reintentar con backoff exponencial ante fallos transitorios.
 *  4. Cachear respuestas (memoria + localStorage) con TTL.
 *  5. Degradar con elegancia: caché vencida → datos de respaldo.
 * Nunca lanza excepciones hacia la UI: siempre devuelve datos + su origen.
 */
window.App = window.App || {};

App.api = (() => {
  const { API_BASE, FETCH_TIMEOUT_MS, RETRIES, CACHE_TTL_MS } = App.config;
  const CACHE_PREFIX = 'monitor-cambiario:v1:';
  const memoryCache = new Map();

  /** localStorage puede no existir o estar bloqueado (modo privado, iframes): siempre try/catch. */
  const storage = {
    get(key) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* sin almacenamiento disponible: seguimos solo con caché en memoria */
      }
    },
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /** fetch con límite de tiempo. */
  async function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') throw new Error(`tiempo de espera agotado (${timeoutMs / 1000} s)`);
      if (error instanceof TypeError) throw new Error('sin conexión o bloqueo de red/CORS');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Reintentos con backoff exponencial: 600 ms, 1200 ms… */
  async function fetchWithRetry(url) {
    let lastError;
    for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
      try {
        return await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
      } catch (error) {
        lastError = error;
        if (attempt < RETRIES) await sleep(600 * 2 ** attempt);
      }
    }
    throw lastError;
  }

  /** Valida la forma mínima del payload antes de aceptarlo. */
  function isValidPayload(endpoint, data) {
    if (!data || typeof data !== 'object') return false;
    if (endpoint === 'root') return Boolean(data.dolar && data.tpm);
    return Array.isArray(data.serie) && data.serie.length > 1;
  }

  const readCache = (key) => memoryCache.get(key) || storage.get(key);
  function writeCache(key, data) {
    const entry = { ts: Date.now(), data };
    memoryCache.set(key, entry);
    storage.set(key, entry);
  }

  /**
   * Obtiene un endpoint aplicando la estrategia: caché fresca → red → caché vencida → respaldo.
   * @param {string} endpoint  'dolar' | 'euro' | 'libra_cobre' | 'uf' | 'root'
   * @param {{force?: boolean}} options  force=true ignora la caché (botón "Actualizar")
   * @returns {Promise<{endpoint, data, source: 'live'|'cache'|'stale'|'fallback', fetchedAt: number|null, error?: Error}>}
   */
  async function getEndpoint(endpoint, { force = false } = {}) {
    const key = CACHE_PREFIX + endpoint;
    const cached = readCache(key);

    if (!force && cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return { endpoint, data: cached.data, source: 'cache', fetchedAt: cached.ts };
    }

    try {
      const url = endpoint === 'root' ? API_BASE : `${API_BASE}/${endpoint}`;
      const data = await fetchWithRetry(url);
      if (!isValidPayload(endpoint, data)) throw new Error('respuesta con formato inesperado');
      writeCache(key, data);
      return { endpoint, data, source: 'live', fetchedAt: Date.now() };
    } catch (error) {
      if (cached && isValidPayload(endpoint, cached.data)) {
        return { endpoint, data: cached.data, source: 'stale', fetchedAt: cached.ts, error };
      }
      return { endpoint, data: App.fallbackData[endpoint], source: 'fallback', fetchedAt: null, error };
    }
  }

  /** Prioridad del estado global: el peor origen manda. */
  const SOURCE_RANK = { live: 0, cache: 1, stale: 2, fallback: 3 };

  /**
   * Carga en paralelo todos los endpoints del dashboard.
   * Promise.all es seguro porque getEndpoint() nunca rechaza.
   */
  async function loadDashboardData(options = {}) {
    const endpoints = ['dolar', 'euro', 'libra_cobre', 'uf', 'root'];
    const results = await Promise.all(endpoints.map((ep) => getEndpoint(ep, options)));

    const byEndpoint = Object.fromEntries(results.map((r) => [r.endpoint, r]));
    const worst = results.reduce((acc, r) => (SOURCE_RANK[r.source] > SOURCE_RANK[acc] ? r.source : acc), 'live');
    const errors = results.filter((r) => r.error).map((r) => `${r.endpoint}: ${r.error.message}`);
    const timestamps = results.map((r) => r.fetchedAt).filter(Boolean);

    return {
      series: {
        dolar: byEndpoint.dolar.data.serie,
        euro: byEndpoint.euro.data.serie,
        libra_cobre: byEndpoint.libra_cobre.data.serie,
        uf: byEndpoint.uf.data.serie,
      },
      root: byEndpoint.root.data,
      status: worst,
      errors,
      fetchedAt: timestamps.length ? Math.min(...timestamps) : null,
    };
  }

  return { loadDashboardData };
})();
