# Monitor Climático Operativo — Dashboard gerencial en tiempo real

**Asignatura:** Visualización de Datos · Evaluación Sumativa 3 · INACAP Sede Maipú
**Autor:** Luis Becerra

Dashboard web (HTML5 + CSS3 + JavaScript ES6, sin librerías externas) que consume en vivo la API pública **Open-Meteo** (pronóstico meteorológico y calidad del aire). Con esos datos calcula KPIs operativos y genera **alertas y recomendaciones ejecutivas** automáticas para la gerencia de un centro de distribución de alimentos refrigerados en Maipú.

### ¿Por qué Open-Meteo?
- **Gratuita y sin API key.** No hay registro, token ni límite que se agote en la presentación.
- **CORS abierto** (`Access-Control-Allow-Origin: *`): funciona desde el navegador, dentro del iframe de Streamlit, en GitHub Pages y abriendo `index.html` con doble clic.
- Se actualiza cada hora y responde en milisegundos.

---

## 1. Problema de negocio

**Distribuidora Frío Sur SpA** (caso ficticio) opera un centro de distribución en Maipú que despacha alimentos refrigerados. Cuando la temperatura exterior supera los **27 °C**, el andén y los camiones pierden cadena de frío, y los equipos de refrigeración consumen más energía. Además, la lluvia, el viento, la radiación UV y la calidad del aire afectan las rutas y la seguridad del personal de patio.

La Gerencia de Operaciones y Logística necesita responder cada día:

> **¿En qué horario despachamos, qué contingencias preparamos y cuánto nos costará el calor?**

## 2. Cómo ejecutarlo

| Opción | Pasos |
|---|---|
| **Doble clic** | Abrir `index.html` en Chrome, Edge o Firefox (scripts clásicos, no módulos ES). |
| **Live Server (VS Code)** | Clic derecho en `index.html` → *Open with Live Server*. |
| **Streamlit** | Desde la raíz del repositorio: `streamlit run app.py` (ver README principal). |

Sin conexión, el dashboard sigue funcionando con datos de respaldo y lo indica en pantalla.

## 3. Arquitectura

```
dashboard/
├── index.html            HTML5 semántico (header, main, section, article, aside, footer)
├── css/styles.css        Variables CSS (tokens), grid/flex, modo oscuro, responsive
└── js/
    ├── config.js         Ubicación, endpoints, tiempos, caché, parámetros y umbrales
    ├── fallback-data.js  Respaldo con el formato exacto de la API (si cae la red)
    ├── format.js         Formato es-CL: °C, %, km/h, CLP, fechas (America/Santiago)
    ├── api.js            fetch + async/await, timeout, reintentos, caché, degradación
    ├── analytics.js      Limpieza del JSON y cálculo de KPIs (funciones puras)
    ├── alerts.js         Motor de reglas → alertas + decisión sugerida
    ├── charts.js         Gráficos SVG propios (línea, barras divergentes, columnas, sparklines)
    ├── ui.js             Renderizado de KPIs, alertas, banner y tabla
    └── main.js           Estado, eventos, polling y orquestación
```

**Flujo de datos:** `API → api.js → analytics.js (KPIs) → alerts.js (decisiones) → ui.js + charts.js (vista)`

### Endpoints consumidos (2 en paralelo)

| Endpoint | Datos |
|---|---|
| `https://api.open-meteo.com/v1/forecast` | Actual + horario (temperatura, sensación térmica, humedad, probabilidad y mm de lluvia, viento, UV) + diario (máx./mín., lluvia, viento, UV). Últimos 7 días y próximos 7. |
| `https://air-quality-api.open-meteo.com/v1/air-quality` | PM2,5, PM10 e índice AQI por hora (últimos 7 días y próximos 5). |

Se usa `timeformat=unixtime`, así que las fechas no dependen de la zona horaria del computador que abre la página.

## 4. Cumplimiento de la rúbrica

### Criterio 1 — Consumo y gestión asíncrona de APIs (20 %)
- `fetch()` con `async/await` y **2 peticiones en paralelo** (`Promise.all`).
- **Timeout** de 8 s con `AbortController` y **2 reintentos con backoff exponencial**.
- **Caché** en memoria + `localStorage` con TTL de 15 minutos.
- **Estrategia de degradación:** caché fresca → red del navegador → datos descargados por el servidor (Streamlit) → caché vencida → datos de respaldo. La UI nunca queda rota.
- **Estados visibles:** skeletons de carga, indicador *En vivo / Caché / Modo respaldo*, banner de error con *Reintentar* y spinner en *Actualizar*.
- **Polling controlado** cada 10 minutos (desactivable y pausado con la pestaña oculta) y **actualización manual** que ignora la caché.
- **Validación del payload** antes de aceptarlo.

### Criterio 2 — Transformación analítica y KPIs (20 %)

| KPI | Cálculo |
|---|---|
| Horas sobre el umbral | Cantidad de horas con `T > umbral` en la ventana |
| Grados-hora | `Σ max(0, T − umbral)`: carga térmica extra sobre el frío |
| Costo extra de frío | `grados-hora × costo CLP por °C·h` |
| Bloque crítico | Tramo continuo más largo sobre el umbral (ej. 13:00–22:00) |
| Franja de despacho más fresca | Bloque de 4 h con menor temperatura promedio entre 06:00 y 21:00 (próximas 24 h) |
| Máx./mín./promedio | Extremos de la ventana con fecha y hora |
| Variación vs. ayer | Temperatura actual − misma hora del día anterior |
| Tendencia de calor | Promedio de máximas de los próximos 7 días − promedio de los últimos 7 días |
| PM2,5 diario | Peor promedio diario vs. norma chilena (50 µg/m³) |

**Limpieza del JSON:** conversión unixtime → fecha, descarte de valores `null` (la API los usa donde no hay dato), eliminación de duplicados, orden cronológico, agrupación por día local y filtrado por ventana temporal.

### Criterio 3 — Codificación visual SVG (25 %)
- Gráficos **SVG hechos a mano**, sin Chart.js ni D3: escalas lineales, ticks "redondos" y ejes con unidades (°C, %, km/h, µg/m³, h).
- **Línea horaria** de la variable elegida, con sensación térmica y línea de umbral.
- **Barras divergentes**: máxima diaria vs. umbral (rojo = sobre, azul = bajo), con los días pasados atenuados para separar historia de pronóstico.
- **Columnas**: horas sobre el umbral por día y costo total.
- Paleta validada para daltonismo, colores de estado reservados (siempre con ícono y texto), etiquetas directas, grilla recesiva y sin chartjunk.
- **100 % responsivo** (`ResizeObserver`), modo oscuro, `forced-colors` e impresión.

### Criterio 4 — Interactividad y UX (15 %)
- **Tooltips** con crosshair (hora, valor, sensación, diferencia vs. umbral), con mouse, **touch** y **teclado** (← → / Esc).
- **Filtros:** variable (Temperatura / Lluvia / Viento / UV / Humedad / PM2,5) y ventana (24 h / 3 días / 7 días).
- **Simulador "¿qué pasa si?":** al cambiar el umbral de frío o el costo por °C·h se recalculan KPIs, alertas, decisión y gráficos.
- **Transiciones animadas** (interpolación de líneas, umbral que se desplaza, barras que crecen); respeta `prefers-reduced-motion`.
- **Vista de tabla** horaria accesible y preferencias guardadas en el navegador.

### Criterio 5 — Enfoque gerencial (20 %)
- Banner **"Decisión sugerida"** al inicio: la conclusión va antes que los gráficos (*data storytelling*).
- **Motor de reglas** (`alerts.js`) con severidad, evidencia numérica y acción concreta:

| Regla | Condición | Recomendación |
|---|---|---|
| Calor extremo | Máxima > umbral + 4 °C | Suspender despachos en el bloque crítico, preenfriar camiones, salir en la franja fresca |
| Calor | Horas sobre el umbral > 0 | Adelantar cargas refrigeradas a la franja más fresca |
| Operación estable | Sin horas sobre el umbral | Mantener la programación |
| Lluvia | Prob. ≥ 60 % o ≥ 5 mm | Cubrir pallets, holgura en rutas, avisar a clientes |
| Viento | ≥ 40 km/h | Asegurar carga alta y patio |
| UV | ≥ 8 (OMS) | Rotar personal de patio 12–16 h, protección (Ley 20.096) |
| Calidad del aire | PM2,5 diario > 50 µg/m³ | Reducir trabajo físico al aire libre |
| Tendencia | Semana ≥ 2 °C más calurosa | Mantención de equipos de frío |

Los umbrales se configuran en `config.js`.

## 5. Guion sugerido para la presentación (3–4 min)

1. **Problema (30 s):** "Despachamos alimentos refrigerados; sobre 27 °C perdemos cadena de frío y gastamos más energía".
2. **Decisión (30 s):** leer el banner superior: qué hacer, en qué horario y por qué.
3. **KPIs (45 s):** máxima vs. umbral, horas sobre el umbral y costo extra en pesos, lluvia/viento y UV/aire.
4. **Exploración (60 s):** recorrer el gráfico con el tooltip, cambiar a 24 h y a 7 días, cambiar la variable a UV o Viento.
5. **Simulación (30 s):** subir el umbral a 31 °C y mostrar cómo bajan las horas y el costo, y cómo cambia la decisión.
6. **Resiliencia (30 s):** en F12 → Network → *Offline*, presionar *Actualizar* y mostrar que todo sigue funcionando con caché o respaldo.

## 6. Notas
- Más documentación en la carpeta [`docs/`](../docs): [manual de usuario](../docs/manual-de-usuario.md), [documentación técnica](../docs/documentacion-tecnica.md) y [evidencias y verificación](../docs/evidencias-y-verificacion.md).
- `fallback-data.js` contiene un snapshot de **demostración** (23-11-2026) con el formato exacto de la API. Solo se usa si no hay conexión ni caché.
- Datos meteorológicos: [Open-Meteo](https://open-meteo.com), licencia CC BY 4.0.
- Caso de negocio ficticio con fines académicos.
