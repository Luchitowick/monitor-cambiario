# Evidencias y verificación

Registro de cómo se comprobó que el dashboard cumple el checklist de pre-entrega y la rúbrica de la Evaluación Sumativa 3.

---

## 1. Conexión real a la API (verificada en la app publicada)

Prueba hecha en la app publicada en Streamlit Community Cloud, con Chrome → Herramientas para desarrolladores (Ctrl + Shift + I) → pestaña **Network**, filtro `open-meteo` y botón **Actualizar** del dashboard:

| Name | Status | Type | Initiator | Size | Time |
|---|---|---|---|---|---|
| `forecast?latitude=-33.5…` | **200** | fetch | `about:srcdoc` | 4,9 kB | 515 ms |
| `air-quality?latitude=-33…` | **200** | fetch | `about:srcdoc` | 2,8 kB | 956 ms |
| `forecast?latitude=-33.5…` | **200** | fetch | `about:srcdoc` | 4,9 kB | 156 ms |
| `air-quality?latitude=-33…` | **200** | fetch | `about:srcdoc` | 2,8 kB | 237 ms |
| `forecast?latitude=-33.5…` | **200** | fetch | `about:srcdoc` | 4,9 kB | 161 ms |
| `air-quality?latitude=-33…` | **200** | fetch | `about:srcdoc` | 2,8 kB | 240 ms |

Lectura:
- Las dos APIs públicas responden **200 OK** con JSON real.
- **Type `fetch`** e **Initiator `about:srcdoc`**: las peticiones las hace el código del dashboard (el iframe de Streamlit), mediante `fetch()` + `async/await`.
- Un par de peticiones por la carga inicial y uno por cada clic en **Actualizar**: la actualización manual funciona e ignora la caché.

> **Nota sobre la consola.** En la app publicada aparecen errores `404` de una petición llamada `details`, iniciada por `bufferedData-…`. Son consultas internas de la plataforma Streamlit Cloud (responden 404 cuando quien mira la app no es su dueño) y **no provienen del código del dashboard**. En el contexto del dashboard (`about:srcdoc`) no hay errores.

## 2. Pruebas automatizadas en navegador

Se probó el dashboard con Playwright + Chromium en tres escenarios de red:

| Escenario | Estado mostrado | Aviso | Errores de JavaScript |
|---|---|---|---|
| API respondiendo | En vivo | Oculto | 0 |
| API caída, servidor con datos | En vivo (servidor) | Oculto | 0 |
| Sin red ni servidor | Modo respaldo | Visible, con botón *Reintentar* | 0 |

Interacciones verificadas:
- Cambio de las 6 variables y de las 3 ventanas, sin errores.
- Simulador de umbral, con los datos de prueba: con 27 °C (ventana 3 días) hay 22 h sobre el umbral, un costo de $215.250 y la decisión es *Crítica*. Con 31 °C (ventana 7 días) bajan a 5 h y $13.300, y la decisión pasa a *Alta*.
- Tooltips con **mouse**, **toque** (simulación de Pixel 7, en los 3 gráficos) y **teclado** (← →).
- **Transición animada**: al cambiar la ventana, la línea pasa por fotogramas intermedios antes de llegar a su forma final.
- Tabla de datos horaria (156 filas en la ventana de 7 días).
- La etiqueta del umbral nunca queda tapada por las líneas (0 colisiones medidas en 4 combinaciones de filtros, a 1400 px y 390 px).

## 3. Diseño responsivo

| Ancho | Dispositivo | Desborde horizontal | Tamaño de texto de ejes |
|---|---|---|---|
| 390 px | Celular | No | 11 px |
| 768 px | Tablet | No | 11 px |
| 1400 px | Notebook | No | 11 px |
| 1920 px | Proyector | No | 13 px |

## 4. Checklist de pre-entrega

| # | Punto | Estado | Dónde se cumple |
|---|---|---|---|
| 1 | Conexión asíncrona real a API pública JSON | ✅ | `api.js` (`fetch`, `async/await`, `try/catch`, respaldo), skeletons en `index.html`, estado de carga en `main.js` |
| 2 | Limpieza y transformación analítica | ✅ | `analytics.js` (limpieza, filtros temporales, máximos, promedios, variaciones, grados-hora, costo) |
| 3 | Gráficos SVG responsivos y limpios | ✅ | `charts.js` + `styles.css` (unidades en ejes, sin chartjunk, móvil y proyector) |
| 4 | Interactividad real | ✅ | Tooltips, filtros, simulador, botón Actualizar y polling cada 10 min (`main.js`, `charts.js`) |
| 5 | Data storytelling | ✅ | Banner *Decisión sugerida* y panel de alertas (`alerts.js`, `ui.js`) |
| 6 | Código limpio, modular y documentado | ✅ | 9 módulos JS comentados, HTML semántico, CSS con variables, README y carpeta `docs/` |

## 5. Rúbrica (autoevaluación)

| Criterio | Ponderación | Nivel | Evidencia |
|---|---|---|---|
| 1. Consumo y gestión asíncrona de APIs | 20 % | Destacado | API real en vivo (sección 1), estados de carga y error, caché, polling y respaldo |
| 2. Transformación analítica y KPIs | 20 % | Destacado | KPIs con umbrales, variación contra ayer, tendencia semanal y costo en CLP |
| 3. Codificación visual SVG | 25 % | Destacado | 3 gráficos SVG con unidades, paleta semántica, 100 % responsivo (sección 3) |
| 4. Interactividad y UX | 15 % | Destacado | Tooltips en mouse, toque y teclado, filtros y transiciones animadas (sección 2) |
| 5. Enfoque gerencial | 20 % | Destacado | 8 reglas con evidencia y acción, decisión sugerida que responde a los parámetros |

Proyección de autoevaluación: **100 % de logro → nota 7,0** (escala 1,0–7,0, exigencia 60 %). La evaluación final corresponde al docente.

## 6. Cómo repetir la verificación

1. Abrir la app y presionar **Ctrl + Shift + I** (en notebooks ASUS, F12 requiere **Fn + F12**).
2. Pestaña **Network** → marcar **Keep log** → escribir `open-meteo` en *Filter*.
3. Presionar **Actualizar** en el dashboard: deben aparecer `forecast` y `air-quality` con **200**.
4. Para probar la resiliencia, cambiar **No throttling** a **Offline** y presionar **Actualizar**. En Streamlit el estado pasa a *En vivo (servidor)*. Abriendo `dashboard/index.html` localmente aparece el aviso de caché o de respaldo. Al terminar, volver a **No throttling**.
