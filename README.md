# Monitor Climático Operativo

**Evaluación Sumativa 3 · Visualización de Datos · INACAP Sede Maipú** · Autor: Luis Becerra

Dashboard gerencial en tiempo real para **Distribuidora Frío Sur SpA** (caso ficticio), un centro de distribución de alimentos refrigerados en Maipú. Consume en vivo la API pública **[Open-Meteo](https://open-meteo.com)** (pronóstico del tiempo y calidad del aire) y responde:

> **¿En qué horario despachamos, qué contingencias preparamos y cuánto nos cuesta el calor?**

Hecho con HTML5, CSS3 y JavaScript ES6, sin librerías externas: gráficos SVG propios, KPIs, alertas automáticas y una decisión sugerida para la gerencia.

## Documentación

| Documento | Contenido |
|---|---|
| [Manual de usuario](evidencia/manual-de-usuario.md) | Cómo leer y usar cada parte del dashboard, con ejemplos y preguntas frecuentes |
| [Documentación técnica](evidencia/documentacion-tecnica.md) | Arquitectura, APIs, consumo asíncrono y resiliencia, fórmulas de los KPIs, reglas de alerta y diseño de los gráficos |
| [Evidencias y verificación](evidencia/evidencias-y-verificacion.md) | Pruebas de la conexión real a la API, pruebas en navegador, checklist y rúbrica |
| [README del dashboard](dashboard/README.md) | Cumplimiento de la rúbrica criterio por criterio y guion de presentación |

## Estructura

```
.
├── app.py                 Punto de entrada de Streamlit (une los archivos y descarga datos desde el servidor)
├── requirements.txt       Dependencias (streamlit)
├── evidencia/             Documentación y evidencias del proyecto
└── dashboard/             Dashboard (también funciona solo, abriendo index.html)
    ├── index.html
    ├── css/styles.css
    └── js/                config, api, analytics, alerts, charts, ui, main…
```

## Ejecutar

**Sin instalar nada:** abre `dashboard/index.html` con doble clic en Chrome, Edge o Firefox.

**Con Streamlit:**

```bash
pip install -r requirements.txt
streamlit run app.py
```

Se abre en `http://localhost:8501`.

## Publicación en Streamlit Community Cloud

La app se publica desde este repositorio (rama `main`, archivo principal `app.py`). Cada *push* a `main` la actualiza sola en 1–2 minutos.

Para publicarla de nuevo: entra a <https://share.streamlit.io>, elige **Create app → Deploy a public app from GitHub** y completa el repositorio, la rama `main` y el archivo `app.py`.

## Notas

- **Dos vías de datos:** el navegador consulta la API directamente. Además, `app.py` descarga los mismos datos desde el servidor (caché de 10 min) y los entrega a la página. Si el navegador no puede conectarse, el dashboard igual muestra datos reales. Los datos de respaldo (de demostración) solo aparecen si fallan las dos vías.
- Si la app queda inactiva varios días, Streamlit Cloud la "duerme". Al abrirla se presiona *Wake up* y vuelve en segundos. Conviene abrirla un rato antes de presentar.
- Para ajustar el alto del área del dashboard, cambia `IFRAME_HEIGHT` en `app.py`.
- Datos meteorológicos: Open-Meteo, licencia CC BY 4.0.
