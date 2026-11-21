# Monitor Cambiario de Compras — Dashboard gerencial en tiempo real

**Asignatura:** Visualización de Datos · Evaluación Sumativa 3 · INACAP Sede Maipú
**Autor:** Luis Becerra

Dashboard web (HTML5 + CSS3 + JavaScript ES6, sin librerías externas) que consume en vivo la API pública **mindicador.cl** (datos del Banco Central de Chile). Con esos datos calcula KPIs de riesgo cambiario y genera **alertas y recomendaciones ejecutivas** automáticas para la gerencia de una empresa importadora.

---

## 1. Problema de negocio

**Importadora TecnoAndes SpA** (caso ficticio) compra tecnología a proveedores extranjeros en **dólares (USD)** y la vende en Chile en **pesos (CLP)**. El presupuesto anual se hizo con un dólar de **$980**, y la empresa compra unos **US$250.000 al mes**.

Cada peso que sube el dólar sobre el presupuesto se come el margen. La gerencia de Finanzas y Abastecimiento necesita responder todos los días:

> **¿Compramos dólares hoy, nos cubrimos con un forward o esperamos?**

El dashboard responde esa pregunta con datos actualizados y deja explícita la evidencia que respalda cada recomendación.

## 2. Cómo ejecutarlo

| Opción | Pasos |
|---|---|
| **Doble clic** | Abrir `index.html` en Chrome, Edge o Firefox. Funciona directo, porque se usan scripts clásicos y no módulos ES. |
| **Live Server (VS Code)** | Clic derecho en `index.html` → *Open with Live Server*. |
| **GitHub Pages** | Subir la carpeta a un repositorio → Settings → Pages → rama `main`. |

Necesita conexión a internet para traer los datos en vivo. **Sin conexión, el dashboard sigue funcionando con datos de respaldo** y lo indica claramente en pantalla.

## 3. Arquitectura

```
monitor-cambiario/
├── index.html            HTML5 semántico (header, main, section, article, aside, footer)
├── css/styles.css        Variables CSS (tokens), grid/flex, modo oscuro, responsive
└── js/
    ├── config.js         Endpoints, tiempos, caché, parámetros y umbrales de negocio
    ├── fallback-data.js  Snapshot real de la API (respaldo si cae la red)
    ├── format.js         Formato es-CL: CLP, USD, %, fechas (America/Santiago)
    ├── api.js            fetch + async/await, timeout, reintentos, caché, degradación
    ├── analytics.js      Limpieza del JSON y cálculo de KPIs (funciones puras)
    ├── alerts.js         Motor de reglas → alertas + decisión sugerida
    ├── charts.js         Gráficos SVG propios (línea, barras divergentes, sparklines)
    ├── ui.js             Renderizado de KPIs, alertas, banner, tabla
    └── main.js           Estado, eventos, polling y orquestación
```

**Flujo de datos:** `API → api.js → analytics.js (KPIs) → alerts.js (decisiones) → ui.js + charts.js (vista)`

Cada módulo tiene una sola responsabilidad y expone su API pública mediante el namespace `window.App`.

### Endpoints consumidos

| Endpoint | Uso |
|---|---|
| `https://mindicador.cl/api/dolar` | Serie del dólar observado (últimos ~30 días hábiles) |
| `https://mindicador.cl/api/euro` | Serie del euro |
| `https://mindicador.cl/api/libra_cobre` | Precio del cobre (USD/lb) |
| `https://mindicador.cl/api/uf` | Serie de la UF |
| `https://mindicador.cl/api` | Valores del día (TPM) |

## 4. Cumplimiento de la rúbrica

### Criterio 1 — Consumo y gestión asíncrona de APIs (20 %)
- `fetch()` con `async/await` y **5 peticiones en paralelo** (`Promise.all`).
- **Timeout** de 8 s con `AbortController` y **2 reintentos con backoff exponencial**.
- **Caché** en memoria + `localStorage` con TTL de 10 minutos, para no saturar una API que se actualiza una vez al día.
- **Estrategia de degradación:** caché fresca → red → caché vencida → datos de respaldo. La UI nunca queda rota.
- **Estados visibles:** skeletons de carga, indicador *En vivo / Caché / Modo respaldo*, banner de error con botón *Reintentar* y spinner en el botón *Actualizar*.
- **Polling controlado** cada 5 minutos (se puede desactivar y se pausa con la pestaña oculta) y un **botón de actualización manual** que ignora la caché.
- **Validación del payload** antes de aceptarlo.

### Criterio 2 — Transformación analítica y KPIs (20 %)

| KPI | Fórmula |
|---|---|
| Variación % | `(valor_final − valor_inicial) / valor_inicial × 100` (diaria, 7 días y rango) |
| Brecha vs. presupuesto | `(dólar_spot − dólar_presupuesto) / dólar_presupuesto × 100` |
| Sobrecosto / ahorro | `(dólar_spot − dólar_presupuesto) × compra_mensual_USD` |
| Media móvil | `SMA_n = promedio de las últimas n observaciones` (5, 7 y 20) |
| Volatilidad anualizada | `σ(retornos diarios) × √252` |
| Tendencia | Pendiente de una regresión lineal por mínimos cuadrados, en % diario |
| Correlación dólar–cobre | Correlación de Pearson entre retornos diarios alineados por fecha |
| Índice base 100 | `valor_t / valor_0 × 100` (compara dos escalas distintas en un solo eje) |
| Extremos | Máximo y mínimo del período y si el dato actual es un máximo o mínimo |

**Limpieza del JSON:** parseo de fechas, descarte de valores inválidos o futuros, eliminación de duplicados por día y orden cronológico (la API entrega los datos en orden descendente).

### Criterio 3 — Codificación visual SVG (25 %)
- Gráficos **SVG hechos a mano**, sin Chart.js ni D3: escalas lineales, ticks "redondos" (1-2-5) y ejes con unidades (CLP/USD, USD/lb, %).
- **Línea temporal** con media móvil 7 y línea de umbral del presupuesto.
- **Barras divergentes** para la variación diaria (rojo = alza, azul = baja, desde una línea base 0).
- **Índice base 100** para comparar dólar y cobre **sin doble eje**, porque dos escalas en un mismo gráfico confunden.
- **Paleta validada para daltonismo**, con colores de estado reservados (siempre acompañados de ícono y texto).
- **Etiquetas directas** en el último dato, grilla recesiva y sin chartjunk.
- **100 % responsivo** (`ResizeObserver` redibuja según el ancho) y adaptado a móvil, tablet, escritorio y **proyector** (≥1800 px aumenta la tipografía).
- **Modo oscuro** con pasos de color propios, más soporte de `forced-colors` e impresión.

### Criterio 4 — Interactividad y UX (15 %)
- **Tooltips** con crosshair: fecha, valor, variación diaria, media móvil y desviación vs. presupuesto. Funcionan con mouse, **touch** y **teclado** (← → para recorrer, Esc para cerrar).
- **Filtros:** indicador (Dólar / Euro / Cobre / UF) y período (7 / 15 / 30 días).
- **Simulador "¿qué pasa si?":** al cambiar el dólar presupuestado o la compra mensual se recalculan los KPIs, las alertas y la línea de umbral.
- **Transiciones animadas** que mantienen la constancia visual: las líneas se interpolan del estado anterior al nuevo (`requestAnimationFrame` + easing), el umbral se desplaza suavemente y las barras crecen desde la base.
- **Vista de tabla** accesible y preferencias guardadas en el navegador.
- Respeta `prefers-reduced-motion`.

### Criterio 5 — Enfoque gerencial (20 %)
- Banner **"Decisión sugerida para hoy"** al inicio de la página: la conclusión va antes que los gráficos (*data storytelling*).
- **Motor de reglas** (`alerts.js`) que genera alertas automáticas con **severidad, evidencia numérica y acción concreta**:

| Regla | Condición | Recomendación |
|---|---|---|
| Presupuesto | Dólar > presupuesto (+3 % = crítica) | Cubrir con forward y ajustar precios |
| Ventana favorable | Dólar < presupuesto | Adelantar compras de USD |
| Extremos | Dólar en máximo o mínimo del período | Escalonar compras o concentrarlas |
| Tendencia | SMA5 vs. SMA20 + pendiente | Adelantar o postergar órdenes |
| Volatilidad | > 12 % anual | Fraccionar compras en tramos |
| Cobre | Caída > 5 % (la severidad depende de la correlación observada) | Reforzar coberturas o monitorear |
| Macro | UF y TPM | Contexto para contratos y financiamiento |

Los umbrales se configuran en `config.js`.

## 5. Guion sugerido para la presentación (3–4 min)

1. **Problema (30 s):** "Somos una importadora que compra en dólares; cada peso de alza nos cuesta US$250.000 × $1".
2. **Decisión (30 s):** leer el banner superior. El dashboard dice qué hacer hoy y por qué.
3. **KPIs (45 s):** brecha vs. presupuesto y sobrecosto en millones de pesos, volatilidad y cobre.
4. **Exploración (60 s):** recorrer el gráfico con el tooltip, cambiar a 7 días y a Cobre, y mostrar la animación.
5. **Simulación (30 s):** cambiar el presupuesto a $1.020 y ver cómo la alerta de presupuesto pasa de "Alta" a "Oportunidad", el sobrecosto se vuelve ahorro y cambia la decisión sugerida.
6. **Resiliencia (30 s):** en F12 → Network → *Offline*, presionar *Actualizar* y mostrar el banner de **modo respaldo** y que todo sigue funcionando.

## 6. Notas
- Datos de respaldo: snapshot real de mindicador.cl del 21-11-2026.
- Las recomendaciones son reglas de apoyo a la decisión y no constituyen asesoría financiera.
