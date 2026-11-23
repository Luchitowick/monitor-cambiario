/**
 * analytics.js — Transformación analítica del payload
 * ---------------------------------------------------------------
 * Convierte el JSON crudo de Open-Meteo en series limpias y en KPIs
 * operativos: horas y grados-hora sobre el umbral de frío, costo extra
 * de refrigeración, ventana de despacho más fresca, extremos, promedios
 * y tendencia de calor (próximos 7 días vs. últimos 7 días).
 * Funciones puras: no tocan el DOM (fáciles de probar).
 */
window.App = window.App || {};

App.analytics = (() => {
  const HOUR_MS = 3600000;
  const dayKey = (d) => App.format.dayKey(d);

  /** Campos horarios del JSON → nombre interno de la variable. */
  const HOURLY_FIELDS = {
    temp: ['forecast', 'temperature_2m'],
    feels: ['forecast', 'apparent_temperature'],
    humidity: ['forecast', 'relative_humidity_2m'],
    rainProb: ['forecast', 'precipitation_probability'],
    rain: ['forecast', 'precipitation'],
    wind: ['forecast', 'wind_speed_10m'],
    uv: ['forecast', 'uv_index'],
    pm25: ['air', 'pm2_5'],
    aqi: ['air', 'us_aqi'],
  };

  /**
   * Limpieza de una serie horaria: convierte unixtime → Date, descarta
   * nulos/no numéricos (la API usa null donde no hay dato), elimina
   * duplicados y ordena cronológicamente.
   */
  function cleanSerie(times = [], values = []) {
    const seen = new Set();
    return times
      .map((t, i) => ({ date: new Date(Number(t) * 1000), value: values[i] == null ? NaN : Number(values[i]) }))
      .filter((p) => !Number.isNaN(p.date.getTime()) && Number.isFinite(p.value))
      .sort((a, b) => a.date - b.date)
      .filter((p) => {
        const k = p.date.getTime();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
  }

  /** Normaliza los dos payloads a { now, series: {temp:[...], ...}, daily:[...] }. */
  function normalize({ forecast, air }) {
    const payloads = { forecast, air };
    const series = {};
    Object.entries(HOURLY_FIELDS).forEach(([key, [source, field]]) => {
      const h = payloads[source]?.hourly || {};
      series[key] = cleanSerie(h.time, h[field]);
    });

    const d = forecast.daily || {};
    const daily = (d.time || []).map((t, i) => ({
      date: new Date(t * 1000),
      tmax: Number(d.temperature_2m_max?.[i]),
      tmin: Number(d.temperature_2m_min?.[i]),
      rainSum: Number(d.precipitation_sum?.[i]),
      rainProb: Number(d.precipitation_probability_max?.[i]),
      windMax: Number(d.wind_speed_10m_max?.[i]),
      uvMax: Number(d.uv_index_max?.[i]),
    })).filter((p) => Number.isFinite(p.tmax) && Number.isFinite(p.tmin));

    // "Ahora" = hora de la medición actual de la API (no el reloj del PC: así el respaldo es coherente)
    const nowSec = Number(forecast.current?.time);
    const now = Number.isFinite(nowSec) ? new Date(nowSec * 1000) : new Date();
    const current = forecast.current || {};

    return { now, current, series, daily };
  }

  /** Filtro temporal relativo a "ahora": [now + from h, now + to h). Parte en la hora en curso. */
  function filterWindow(points, now, { from, to }) {
    const base = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS;
    const a = base + from * HOUR_MS;
    const b = base + to * HOUR_MS;
    return points.filter((p) => p.date.getTime() >= a && p.date.getTime() < b);
  }

  const mean = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : NaN);
  const maxOf = (arr) => (arr.length ? Math.max(...arr) : NaN);
  const maxPoint = (pts) => pts.reduce((best, p) => (!best || p.value > best.value ? p : best), null);
  const minPoint = (pts) => pts.reduce((best, p) => (!best || p.value < best.value ? p : best), null);

  /** Horas sobre el umbral (cada punto horario = 1 h). */
  const hoursAbove = (pts, threshold) => pts.filter((p) => p.value > threshold).length;

  /** Grados-hora sobre el umbral: Σ max(0, T − umbral). Mide la carga térmica extra del frío. */
  const degreeHours = (pts, threshold) => pts.reduce((s, p) => s + Math.max(0, p.value - threshold), 0);

  /** Agrupa puntos horarios por día local. */
  function byDay(pts) {
    const map = new Map();
    pts.forEach((p) => {
      const k = dayKey(p.date);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(p);
    });
    return map;
  }

  /**
   * Bloque continuo más largo sobre el umbral (ej. 13:00–18:00).
   * @returns {{start: Date, end: Date, hours: number}|null}
   */
  function longestBlockAbove(pts, threshold) {
    let best = null; let start = -1;
    pts.forEach((p, i) => {
      const above = p.value > threshold;
      if (above && start < 0) start = i;
      const closes = start >= 0 && (!above || i === pts.length - 1);
      if (closes) {
        const endIdx = above ? i : i - 1;
        const hours = endIdx - start + 1;
        if (!best || hours > best.hours) best = { start: pts[start].date, end: new Date(pts[endIdx].date.getTime() + HOUR_MS), hours };
        start = -1;
      }
    });
    return best;
  }

  /**
   * Ventana de despacho más fresca: bloque de `len` horas consecutivas con menor
   * temperatura promedio dentro del horario operativo (06:00–21:00) de las próximas 24 h.
   */
  function coolestWindow(pts, len = 4, fromHour = 6, toHour = 21) {
    const hourOf = (d) => Number(App.format.time(d).slice(0, 2));
    let best = null;
    for (let i = 0; i + len <= pts.length; i += 1) {
      const block = pts.slice(i, i + len);
      const contiguous = block.every((p, k) => k === 0 || p.date - block[k - 1].date === HOUR_MS);
      const inShift = hourOf(block[0].date) >= fromHour && hourOf(block[len - 1].date) < toHour;
      if (!contiguous || !inShift) continue;
      const avg = mean(block.map((p) => p.value));
      if (!best || avg < best.avg) best = { start: block[0].date, end: new Date(block[len - 1].date.getTime() + HOUR_MS), avg };
    }
    return best;
  }

  /** Valor de una serie en un instante (o NaN). */
  function valueAt(pts, date) {
    const t = date.getTime();
    const p = pts.find((q) => q.date.getTime() === t);
    return p ? p.value : NaN;
  }

  /**
   * Resumen operativo para la ventana seleccionada.
   * @param {object} data  resultado de normalize()
   * @param {{from:number,to:number}} win  ventana en horas
   * @param {{heatThreshold:number, costPerDegreeHour:number}} params
   */
  function summarize(data, win, { heatThreshold, costPerDegreeHour }) {
    const { now, series, daily, current } = data;
    const w = Object.fromEntries(Object.entries(series).map(([k, pts]) => [k, filterWindow(pts, now, win)]));
    const next24 = filterWindow(series.temp, now, { from: 0, to: 24 });

    const nowHour = new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS);
    const yesterday = new Date(nowHour.getTime() - 24 * HOUR_MS);
    const currentTemp = Number.isFinite(Number(current.temperature_2m)) ? Number(current.temperature_2m) : valueAt(series.temp, nowHour);

    const dh = degreeHours(w.temp, heatThreshold);
    const todayKey = dayKey(now);
    const pastDays = daily.filter((d) => dayKey(d.date) < todayKey).slice(-7);
    const nextDays = daily.filter((d) => dayKey(d.date) >= todayKey).slice(0, 7);

    // Horas sobre el umbral y costo por día (próximos 7 días) → gráfico de columnas
    const futureTemp = filterWindow(series.temp, now, { from: 0, to: 168 });
    const perDay = [...byDay(futureTemp).entries()].map(([k, pts]) => ({
      date: pts[0].date,
      key: k,
      hours: hoursAbove(pts, heatThreshold),
      degreeHours: degreeHours(pts, heatThreshold),
      cost: degreeHours(pts, heatThreshold) * costPerDegreeHour,
      block: longestBlockAbove(pts, heatThreshold),
      max: maxPoint(pts),
    }));

    const pm = w.pm25;
    return {
      now,
      window: w,
      current: {
        temp: currentTemp,
        feels: Number(current.apparent_temperature),
        humidity: Number(current.relative_humidity_2m),
        wind: Number(current.wind_speed_10m),
        vsYesterday: currentTemp - valueAt(series.temp, yesterday),
      },
      next24,
      temp: {
        max: maxPoint(w.temp),
        min: minPoint(w.temp),
        avg: mean(w.temp.map((p) => p.value)),
        hoursAbove: hoursAbove(w.temp, heatThreshold),
        degreeHours: dh,
        extraCost: dh * costPerDegreeHour,
        block: longestBlockAbove(w.temp, heatThreshold),
        coolest: coolestWindow(next24),
      },
      rain: {
        maxProb: maxPoint(w.rainProb),
        total: w.rain.reduce((s, p) => s + p.value, 0),
      },
      wind: { max: maxPoint(w.wind) },
      uv: { max: maxPoint(w.uv) },
      air: {
        avgPm25: mean(pm.map((p) => p.value)),
        maxPm25: maxPoint(pm),
        // Promedio diario más alto (la norma chilena de PM2,5 es diaria)
        worstDailyPm25: maxOf([...byDay(pm).values()].filter((d) => d.length >= 12).map((d) => mean(d.map((p) => p.value)))),
        coverageEnd: pm.length ? pm[pm.length - 1].date : null,
      },
      daily: { past: pastDays, next: nextDays, all: [...pastDays, ...nextDays] },
      perDay,
      warming: mean(nextDays.map((d) => d.tmax)) - mean(pastDays.map((d) => d.tmax)),
    };
  }

  return { normalize, filterWindow, summarize, hoursAbove, degreeHours, longestBlockAbove, coolestWindow, mean, dayKey };
})();
