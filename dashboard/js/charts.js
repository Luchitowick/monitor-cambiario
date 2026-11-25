/**
 * charts.js — Gráficos SVG nativos (sin librerías)
 * ---------------------------------------------------------------
 *  - LineChart: series temporales (diarias u horarias), línea de umbral,
 *    crosshair + tooltip, etiquetas directas, transición animada.
 *  - DivergingBarChart: barras divergentes (+/−) desde una línea base 0,
 *    o columnas simples con { positiveOnly: true }.
 * Ambos son responsivos (ResizeObserver), accesibles por teclado
 * (← → para recorrer, Esc para cerrar) y respetan prefers-reduced-motion.
 */
window.App = window.App || {};

App.charts = (() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const ANIM_MS = 650;

  /* ---------- utilidades ---------- */
  function svgEl(tag, attrs = {}, parent = null) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    if (parent) parent.appendChild(node);
    return node;
  }

  /** Escala lineal: dominio → rango en píxeles. */
  function scaleLinear([d0, d1], [r0, r1]) {
    return (v) => (d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0));
  }

  /** Ticks "redondos" (1, 2, 5 × 10^n) para ejes legibles. */
  function niceTicks(min, max, count = 5) {
    if (min === max) { min -= 1; max += 1; }
    const rawStep = (max - min) / count;
    const mag = 10 ** Math.floor(Math.log10(rawStep));
    const norm = rawStep / mag;
    const step = (norm >= 7.5 ? 10 : norm >= 3.5 ? 5 : norm >= 1.5 ? 2 : 1) * mag;
    const start = Math.floor(min / step) * step;
    const end = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = start; v <= end + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
    return { ticks, min: start, max: end, step };
  }

  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const toPath = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join('');

  /** Re-muestrea un polígono a n puntos para poder interpolar entre series de distinto largo. */
  function resample(pts, n) {
    if (!pts.length) return [];
    if (pts.length === n) return pts.map((p) => p.slice());
    return Array.from({ length: n }, (_, i) => {
      const t = n === 1 ? 0 : (i / (n - 1)) * (pts.length - 1);
      const lo = Math.floor(t);
      const hi = Math.min(pts.length - 1, lo + 1);
      const k = t - lo;
      return [pts[lo][0] + (pts[hi][0] - pts[lo][0]) * k, pts[lo][1] + (pts[hi][1] - pts[lo][1]) * k];
    });
  }

  /** Búsqueda del índice cuyo x en píxeles está más cerca del puntero. */
  function nearestIndex(xs, x) {
    let lo = 0; let hi = xs.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] < x) lo = mid; else hi = mid;
    }
    return Math.abs(xs[lo] - x) <= Math.abs(xs[hi] - x) ? lo : hi;
  }

  /** Elige qué índices del eje X etiquetar sin que se superpongan (~90 px por etiqueta). */
  function pickTicks(n, innerWidth, preferred) {
    const maxTicks = Math.max(2, Math.floor(innerWidth / 90));
    const pool = preferred && preferred.length ? preferred : Array.from({ length: n }, (_, i) => i).reverse();
    const stride = Math.max(1, Math.ceil(pool.length / maxTicks));
    return pool.filter((_, k) => k % stride === 0);
  }

  /* ---------- clase base: tamaño, tooltip, teclado ---------- */
  class ChartBase {
    constructor(container, opts) {
      this.container = container;
      this.opts = { height: 320, mobileHeight: 240, ...opts };
      this.container.classList.add('chart-root');
      this.container.innerHTML = '';

      this.svg = svgEl('svg', { role: 'img', tabindex: '0', 'aria-label': this.opts.ariaLabel || 'Gráfico' }, this.container);
      this.tooltip = document.createElement('div');
      this.tooltip.className = 'tooltip';
      this.tooltip.setAttribute('role', 'status');
      this.tooltip.hidden = true;
      this.container.appendChild(this.tooltip);

      this.data = null;
      this.hoverIndex = -1;
      this.lastWidth = 0;

      // Responsivo: redibuja al cambiar el ancho del contenedor (sin animación).
      this.resizeObserver = new ResizeObserver(() => {
        const w = this.container.clientWidth;
        if (this.data && Math.abs(w - this.lastWidth) > 2) this.draw(false);
      });
      this.resizeObserver.observe(this.container);

      // Puntero (mouse + touch + lápiz)
      this.svg.addEventListener('pointermove', (e) => this.onPointer(e));
      this.svg.addEventListener('pointerdown', (e) => this.onPointer(e));
      this.svg.addEventListener('pointerleave', () => this.hideTooltip());

      // Teclado
      this.svg.addEventListener('keydown', (e) => this.onKey(e));
      this.svg.addEventListener('focus', () => { if (this.count() > 0) this.showAt(this.hoverIndex >= 0 ? this.hoverIndex : this.count() - 1); });
      this.svg.addEventListener('blur', () => this.hideTooltip());
    }

    dims() {
      const w = Math.max(260, this.container.clientWidth);
      const h = w < 560 ? this.opts.mobileHeight : this.opts.height;
      this.lastWidth = this.container.clientWidth;
      return { w, h };
    }

    onPointer(event) {
      if (!this.layout) return;
      const rect = this.svg.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const { m, w } = this.layout;
      if (x < m.left - 8 || x > w - m.right + 8) { this.hideTooltip(); return; }
      this.showAt(this.indexAt(x));
    }

    onKey(event) {
      const n = this.count();
      if (!n) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const step = event.key === 'ArrowLeft' ? -1 : 1;
        const base = this.hoverIndex < 0 ? n - 1 : this.hoverIndex;
        this.showAt(Math.max(0, Math.min(n - 1, base + step)));
      } else if (event.key === 'Escape') {
        this.hideTooltip();
      }
    }

    /** Posiciona el tooltip HTML evitando que se salga del contenedor. */
    placeTooltip(html, x, y) {
      this.tooltip.innerHTML = html;
      this.tooltip.hidden = false;
      const tw = this.tooltip.offsetWidth;
      const th = this.tooltip.offsetHeight;
      const cw = this.container.clientWidth;
      let left = x + 14;
      if (left + tw > cw - 4) left = x - tw - 14;
      left = Math.max(4, left);
      const top = Math.max(4, Math.min(y - th / 2, this.layout.h - th - 4));
      this.tooltip.style.transform = `translate(${left}px, ${top}px)`;
    }

    hideTooltip() {
      this.tooltip.hidden = true;
      this.hoverIndex = -1;
      if (this.hoverGroup) this.hoverGroup.style.opacity = '0';
    }

    update(data) {
      this.data = data;
      this.draw(!reducedMotion());
    }
  }

  /* ================================================================
   * LineChart
   * data = {
   *   series: [{ id, name, points:[{date,value}], className, dashed?, endLabel?: fn }],
   *   threshold?: { value, label },
   *   reference?: number,              // línea de referencia horizontal
   *   yFormat: fn, tooltipRows?: fn(index) → [{label, value, swatch?}],
   *   xFormat?: fn(date), titleFormat?: fn(date),   // etiquetas del eje X y título del tooltip
   *   xTicks?: number[]                // índices preferidos para etiquetar el eje X
   * }
   * ================================================================ */
  class LineChart extends ChartBase {
    constructor(container, opts) {
      super(container, opts);
      this.gGrid = svgEl('g', { class: 'grid' }, this.svg);
      this.gAxis = svgEl('g', { class: 'axis' }, this.svg);
      this.gRef = svgEl('g', { class: 'reference' }, this.svg);
      this.gThreshold = svgEl('g', { class: 'threshold' }, this.svg);
      this.thresholdLine = svgEl('line', { class: 'threshold-line' }, this.gThreshold);
      this.gSeries = svgEl('g', { class: 'series' }, this.svg);
      this.gLabels = svgEl('g', { class: 'end-labels' }, this.svg);
      // La etiqueta del umbral va en una capa sobre las series para que ninguna línea la tape
      this.gThresholdLabel = svgEl('g', { class: 'threshold' }, this.svg);
      this.thresholdText = svgEl('text', { class: 'threshold-label', 'text-anchor': 'start' }, this.gThresholdLabel);
      this.hoverGroup = svgEl('g', { class: 'hover', style: 'opacity:0' }, this.svg);
      this.crosshair = svgEl('line', { class: 'crosshair' }, this.hoverGroup);
      this.hoverDots = svgEl('g', {}, this.hoverGroup);
      this.paths = new Map(); // id → { node, current: [[x,y]...] }
      this.anim = null;
    }

    count() { return this.data ? this.data.series[0].points.length : 0; }

    indexAt(x) { return nearestIndex(this.layout.primaryXs, x); }

    draw(animate) {
      const { series, threshold, reference, yFormat } = this.data;
      const { w, h } = this.dims();
      const primary = series[0].points;
      if (!primary.length) return;

      // --- dominio Y (incluye umbral y referencia para que siempre sean visibles)
      const allValues = series.flatMap((s) => s.points.map((p) => p.value));
      if (threshold) allValues.push(threshold.value);
      if (Number.isFinite(reference)) allValues.push(reference);
      let lo = Math.min(...allValues);
      let hi = Math.max(...allValues);
      const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.01 || 1;
      lo -= pad; hi += pad;
      const yTicks = niceTicks(lo, hi, h < 280 ? 4 : 5);

      // --- márgenes según ancho de etiquetas
      const longest = Math.max(...yTicks.ticks.map((t) => yFormat(t).length));
      const hasEndLabels = series.some((s) => s.endLabel);
      const m = { top: 14, right: hasEndLabels ? Math.min(96, 18 + 7 * 10) : 16, bottom: 30, left: Math.max(40, longest * 7 + 14) };

      const t0 = primary[0].date.getTime();
      const t1 = primary[primary.length - 1].date.getTime();
      const x = scaleLinear([t0, t1], [m.left, w - m.right]);
      const y = scaleLinear([yTicks.min, yTicks.max], [h - m.bottom, m.top]);

      this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      this.svg.setAttribute('width', w);
      this.svg.setAttribute('height', h);

      // --- grilla + eje Y (recesivos)
      this.gGrid.innerHTML = '';
      this.gAxis.innerHTML = '';
      yTicks.ticks.forEach((t) => {
        const yy = y(t);
        svgEl('line', { x1: m.left, x2: w - m.right, y1: yy, y2: yy, class: 'grid-line' }, this.gGrid);
        const label = svgEl('text', { x: m.left - 8, y: yy, dy: '0.32em', 'text-anchor': 'end', class: 'tick' }, this.gAxis);
        label.textContent = yFormat(t);
      });
      svgEl('line', { x1: m.left, x2: w - m.right, y1: h - m.bottom, y2: h - m.bottom, class: 'axis-line' }, this.gAxis);

      // --- eje X: ~1 etiqueta cada 90 px (en los índices sugeridos si se entregan)
      const xFormat = this.data.xFormat || App.format.dateShort;
      pickTicks(primary.length, w - m.left - m.right, this.data.xTicks).forEach((i) => {
        const label = svgEl('text', { x: x(primary[i].date.getTime()), y: h - m.bottom + 18, 'text-anchor': 'middle', class: 'tick' }, this.gAxis);
        label.textContent = xFormat(primary[i].date);
      });

      // --- línea de referencia (ej. base 100)
      this.gRef.innerHTML = '';
      if (Number.isFinite(reference)) {
        svgEl('line', { x1: m.left, x2: w - m.right, y1: y(reference), y2: y(reference), class: 'reference-line' }, this.gRef);
      }

      // --- umbral (se desplaza con transición CSS sobre transform)
      if (threshold) {
        this.gThreshold.style.display = '';
        this.thresholdLine.setAttribute('x1', m.left);
        this.thresholdLine.setAttribute('x2', w - m.right);
        this.thresholdLine.setAttribute('y1', 0);
        this.thresholdLine.setAttribute('y2', 0);
        // Elige extremo (izq./der.) y lado (arriba/abajo) donde la etiqueta no choque con ninguna serie:
        // revisa todos los puntos que caen bajo el ancho del texto, no solo los extremos.
        const labelW = threshold.label.length * 6.6 + 12;
        const ty = y(threshold.value);
        const options = [false, true].flatMap((right) => [true, false].map((above) => {
          const x0 = right ? w - m.right - labelW : m.left;
          const x1 = right ? w - m.right : m.left + labelW;
          const top = above ? ty - 18 : ty + 2;   // franja vertical que ocupa el texto
          const bottom = above ? ty - 2 : ty + 18;
          let hits = 0; let gap = Infinity;
          series.forEach((s) => s.points.forEach((p) => {
            const px = x(p.date.getTime());
            if (px < x0 || px > x1) return;
            const py = y(p.value);
            if (py >= top && py <= bottom) hits += 1;
            gap = Math.min(gap, above ? Math.abs(py - top) : Math.abs(py - bottom));
          }));
          return { right, above, score: hits ? -hits : gap };
        }));
        const best = options.sort((a, b) => b.score - a.score)[0];
        this.thresholdText.setAttribute('text-anchor', best.right ? 'end' : 'start');
        this.thresholdText.setAttribute('x', best.right ? w - m.right - 6 : m.left + 6);
        this.thresholdText.setAttribute('y', best.above ? -6 : 14);
        // Si en ninguna posición queda libre, no se dibuja (el valor sigue visible en la leyenda)
        this.thresholdText.textContent = best.score < 0 ? '' : threshold.label;
        [this.gThreshold, this.gThresholdLabel].forEach((g) => {
          g.style.display = '';
          g.classList.toggle('no-anim', !animate);
          g.style.transform = `translateY(${y(threshold.value)}px)`;
        });
      } else {
        this.gThreshold.style.display = 'none';
        this.gThresholdLabel.style.display = 'none';
      }

      // --- series
      const targets = series.map((s) => ({
        s,
        pts: s.points.map((p) => [x(p.date.getTime()), y(p.value)]),
      }));
      const activeIds = new Set(series.map((s) => s.id));
      [...this.paths.keys()].forEach((id) => {
        if (!activeIds.has(id)) { this.paths.get(id).node.remove(); this.paths.delete(id); }
      });

      const plan = targets.map(({ s, pts }) => {
        let entry = this.paths.get(s.id);
        if (!entry) {
          const node = svgEl('path', { class: `line ${s.className || ''}`, fill: 'none' }, this.gSeries);
          // primera aparición: la línea "crece" desde el promedio
          const midY = pts.reduce((acc, p) => acc + p[1], 0) / (pts.length || 1);
          entry = { node, current: pts.map((p) => [p[0], midY]) };
          this.paths.set(s.id, entry);
        }
        entry.node.setAttribute('class', `line ${s.className || ''}${s.dashed ? ' dashed' : ''}`);
        return { entry, from: resample(entry.current, pts.length), to: pts };
      });

      if (this.anim) cancelAnimationFrame(this.anim);
      const finish = () => plan.forEach(({ entry, to }) => { entry.current = to; entry.node.setAttribute('d', toPath(to)); });
      if (animate) {
        const start = performance.now();
        const tick = (now) => {
          const k = easeInOutCubic(Math.min(1, (now - start) / ANIM_MS));
          plan.forEach(({ entry, from, to }) => {
            const pts = to.map((p, i) => [from[i][0] + (p[0] - from[i][0]) * k, from[i][1] + (p[1] - from[i][1]) * k]);
            entry.current = pts;
            entry.node.setAttribute('d', toPath(pts));
          });
          if (k < 1) this.anim = requestAnimationFrame(tick); else { this.anim = null; finish(); }
        };
        this.anim = requestAnimationFrame(tick);
      } else {
        finish();
      }

      // --- etiquetas directas al final de la línea (con anti-colisión vertical)
      this.gLabels.innerHTML = '';
      const labels = targets.filter(({ s, pts }) => s.endLabel && pts.length).map(({ s, pts }) => ({
        s, x: pts[pts.length - 1][0], y: pts[pts.length - 1][1], text: s.endLabel(s.points[s.points.length - 1]),
      })).sort((a, b) => a.y - b.y);
      for (let i = 1; i < labels.length; i += 1) {
        if (labels[i].y - labels[i - 1].y < 16) labels[i].y = labels[i - 1].y + 16;
      }
      labels.forEach((l) => {
        const gl = svgEl('g', { class: `end-label ${l.s.className || ''}`, transform: `translate(${l.x},${l.y})` }, this.gLabels);
        svgEl('circle', { r: 4, class: 'end-dot' }, gl);
        const t = svgEl('text', { x: 8, dy: '0.32em' }, gl);
        t.textContent = l.text;
      });

      this.layout = { m, w, h, x, y, targets, primaryXs: targets[0].pts.map((p) => p[0]) };
      this.svg.setAttribute('aria-label', `${this.opts.ariaLabel}. Use las flechas izquierda y derecha para recorrer los datos.`);
      if (this.hoverIndex >= 0) this.showAt(Math.min(this.hoverIndex, this.count() - 1));
    }

    showAt(index) {
      if (!this.layout || index < 0) return;
      this.hoverIndex = index;
      const { m, h, targets } = this.layout;
      const primary = this.data.series[0].points[index];
      const key = primary.date.getTime();
      const px = targets[0].pts[index][0];

      this.crosshair.setAttribute('x1', px); this.crosshair.setAttribute('x2', px);
      this.crosshair.setAttribute('y1', m.top); this.crosshair.setAttribute('y2', h - m.bottom);
      this.hoverDots.innerHTML = '';
      let anchorY = targets[0].pts[index][1];
      targets.forEach(({ s, pts }) => {
        const i = s.points.findIndex((p) => p.date.getTime() === key);
        if (i >= 0) svgEl('circle', { cx: pts[i][0], cy: pts[i][1], r: 5, class: `hover-dot ${s.className || ''}` }, this.hoverDots);
      });
      this.hoverGroup.style.opacity = '1';

      const rows = this.data.tooltipRows ? this.data.tooltipRows(index) : [];
      const title = (this.data.titleFormat || App.format.dateLong)(primary.date);
      const html = `<div class="tt-date">${title}</div>${rows.map((r) => `
        <div class="tt-row"><span class="tt-label">${r.swatch ? `<i class="sw ${r.swatch}"></i>` : ''}${r.label}</span><strong>${r.value}</strong></div>`).join('')}`;
      anchorY = Math.max(m.top, anchorY);
      this.placeTooltip(html, px, anchorY);
    }
  }

  /* ================================================================
   * DivergingBarChart — barras desde una línea base 0
   * data = {
   *   points:[{date, value}], yFormat, tooltipRows: fn(index),
   *   xFormat?: fn(date), titleFormat?: fn(date),
   *   barClass?: fn(point, index) → clase CSS extra (ej. días pasados),
   *   positiveOnly?: boolean     // columnas simples: eje Y desde 0
   * }
   * ================================================================ */
  class DivergingBarChart extends ChartBase {
    constructor(container, opts) {
      super(container, { height: 240, mobileHeight: 200, ...opts });
      this.gGrid = svgEl('g', { class: 'grid' }, this.svg);
      this.gAxis = svgEl('g', { class: 'axis' }, this.svg);
      this.hoverGroup = svgEl('g', { class: 'hover', style: 'opacity:0' }, this.svg);
      this.hoverBand = svgEl('rect', { class: 'hover-band' }, this.hoverGroup);
      this.gBars = svgEl('g', { class: 'bars' }, this.svg);
    }

    count() { return this.data ? this.data.points.length : 0; }

    indexAt(x) {
      const { m, band } = this.layout;
      return Math.max(0, Math.min(this.count() - 1, Math.floor((x - m.left) / band)));
    }

    /** Barra con extremo de datos redondeado (4 px) y base recta sobre el 0. */
    static barPath(x0, w, yBase, yEnd) {
      const r = Math.min(4, w / 2, Math.abs(yEnd - yBase));
      const up = yEnd < yBase;
      const s = up ? 1 : -1; // dirección del redondeo
      return [
        `M${x0},${yBase}`,
        `L${x0},${yEnd + s * r}`,
        `Q${x0},${yEnd} ${x0 + r},${yEnd}`,
        `L${x0 + w - r},${yEnd}`,
        `Q${x0 + w},${yEnd} ${x0 + w},${yEnd + s * r}`,
        `L${x0 + w},${yBase}Z`,
      ].join('');
    }

    draw(animate) {
      const { points, yFormat, positiveOnly } = this.data;
      const { w, h } = this.dims();
      if (!points.length) return;

      const maxAbs = Math.max(...points.map((p) => Math.abs(p.value)), positiveOnly ? 1 : 0.05);
      const ticks = positiveOnly ? niceTicks(0, maxAbs, 4) : niceTicks(-maxAbs, maxAbs, 4);
      const lim = Math.max(Math.abs(ticks.min), Math.abs(ticks.max));
      const lo = positiveOnly ? 0 : -lim;
      const longest = Math.max(...ticks.ticks.map((t) => yFormat(t).length));
      const m = { top: 12, right: 12, bottom: 30, left: Math.max(40, longest * 7 + 14) };
      const y = scaleLinear([lo, lim], [h - m.bottom, m.top]);
      const band = (w - m.left - m.right) / points.length;
      const barW = Math.max(2, Math.min(28, band - 2)); // 2 px de separación entre barras

      this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      this.svg.setAttribute('width', w);
      this.svg.setAttribute('height', h);

      this.gGrid.innerHTML = '';
      this.gAxis.innerHTML = '';
      ticks.ticks.filter((t) => t >= lo - 1e-9 && t <= lim + 1e-9).forEach((t) => {
        svgEl('line', { x1: m.left, x2: w - m.right, y1: y(t), y2: y(t), class: t === 0 ? 'zero-line' : 'grid-line' }, this.gGrid);
        const label = svgEl('text', { x: m.left - 8, y: y(t), dy: '0.32em', 'text-anchor': 'end', class: 'tick' }, this.gAxis);
        label.textContent = yFormat(t);
      });

      const xFormat = this.data.xFormat || App.format.dateShort;
      pickTicks(points.length, w - m.left - m.right).forEach((i) => {
        const label = svgEl('text', { x: m.left + band * (i + 0.5), y: h - m.bottom + 18, 'text-anchor': 'middle', class: 'tick' }, this.gAxis);
        label.textContent = xFormat(points[i].date);
      });

      this.gBars.innerHTML = '';
      const y0 = y(0);
      points.forEach((p, i) => {
        const x0 = m.left + band * i + (band - barW) / 2;
        const yEnd = y(p.value);
        const extra = this.data.barClass ? this.data.barClass(p, i) : '';
        const cls = `bar ${p.value >= 0 ? 'bar-up' : 'bar-down'}${extra ? ` ${extra}` : ''}`;
        const path = svgEl('path', { d: DivergingBarChart.barPath(x0, barW, y0, Math.abs(yEnd - y0) < 1 ? y0 - Math.sign(p.value || 1) : yEnd), class: `${cls}${animate ? ' bar-enter' : ''}` }, this.gBars);
        if (animate) path.style.animationDelay = `${i * 18}ms`;
      });

      this.hoverBand.setAttribute('y', m.top);
      this.hoverBand.setAttribute('height', h - m.top - m.bottom);
      this.hoverBand.setAttribute('width', band);
      this.layout = { m, w, h, y, band };
      this.svg.setAttribute('aria-label', `${this.opts.ariaLabel}. Use las flechas izquierda y derecha para recorrer los datos.`);
      if (this.hoverIndex >= 0) this.showAt(Math.min(this.hoverIndex, this.count() - 1));
    }

    showAt(index) {
      if (!this.layout || index < 0) return;
      this.hoverIndex = index;
      const { m, band, y } = this.layout;
      const p = this.data.points[index];
      const bx = m.left + band * index;
      this.hoverBand.setAttribute('x', bx);
      this.hoverGroup.style.opacity = '1';
      [...this.gBars.children].forEach((node, i) => node.classList.toggle('dimmed', i !== index));
      const rows = this.data.tooltipRows ? this.data.tooltipRows(index) : [];
      const title = (this.data.titleFormat || App.format.dateLong)(p.date);
      const html = `<div class="tt-date">${title}</div>${rows.map((r) => `
        <div class="tt-row"><span class="tt-label">${r.label}</span><strong>${r.value}</strong></div>`).join('')}`;
      this.placeTooltip(html, bx + band / 2, Math.min(y(p.value), y(0)));
    }

    hideTooltip() {
      super.hideTooltip();
      if (this.gBars) [...this.gBars.children].forEach((node) => node.classList.remove('dimmed'));
    }
  }

  /** Sparkline mínima para las tarjetas KPI (sin ejes, solo tendencia). */
  function sparkline(points, { width = 120, height = 32 } = {}) {
    if (points.length < 2) return '';
    const vals = points.map((p) => p.value);
    const x = scaleLinear([0, points.length - 1], [2, width - 4]);
    const y = scaleLinear([Math.min(...vals), Math.max(...vals)], [height - 4, 4]);
    const pts = vals.map((v, i) => [x(i), y(v)]);
    const last = pts[pts.length - 1];
    return `<svg class="spark" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-hidden="true" focusable="false">
      <path d="${toPath(pts)}" fill="none"/><circle cx="${last[0]}" cy="${last[1]}" r="3"/></svg>`;
  }

  return { LineChart, DivergingBarChart, sparkline };
})();
