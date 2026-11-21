# Monitor Cambiario de Compras — versión Streamlit

Esta versión publica el dashboard (HTML + CSS + JS con gráficos SVG) en **Streamlit Community Cloud**. Streamlit funciona como hosting: `app.py` une los archivos del proyecto en un solo HTML y lo muestra con `components.html()`.

La lógica del dashboard sigue corriendo en el navegador del usuario: el `fetch()` a mindicador.cl, los KPIs, las alertas y los gráficos. La documentación técnica completa está en `monitor-cambiario/README.md`.

## Estructura

```
.
├── app.py                 Punto de entrada de Streamlit
├── requirements.txt       Dependencias (streamlit)
└── monitor-cambiario/     Dashboard original (también funciona solo, abriendo index.html)
```

## Probar en tu computador

```bash
pip install -r requirements.txt
streamlit run app.py
```

Se abre en `http://localhost:8501`.

## Publicar en Streamlit Community Cloud (gratis)

1. Crea un repositorio **público** en GitHub, por ejemplo `monitor-cambiario-streamlit`.
2. Sube **el contenido de esta carpeta** (`app.py`, `requirements.txt` y la carpeta `monitor-cambiario/`) a la raíz del repositorio.
3. Entra a <https://share.streamlit.io> e inicia sesión con tu cuenta de GitHub.
4. Haz clic en **Create app → Deploy a public app from GitHub** y completa:
   - **Repository:** `tu-usuario/monitor-cambiario-streamlit`
   - **Branch:** `main`
   - **Main file path:** `app.py`
5. Haz clic en **Deploy**. En 1–2 minutos tendrás una URL del tipo `https://tu-app.streamlit.app` para entregar.

Cada vez que hagas *push* al repositorio, la app se actualiza sola.

## Notas
- Si la app queda inactiva varios días, Streamlit Cloud la "duerme". Al abrirla se presiona *Wake up* y vuelve en segundos. Conviene abrirla un rato antes de presentar.
- Para ajustar el alto del área del dashboard, cambia `IFRAME_HEIGHT` en `app.py`.
