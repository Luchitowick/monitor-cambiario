"""
app.py — Publica el dashboard "Monitor Cambiario de Compras" en Streamlit.

El dashboard está hecho en HTML5 + CSS3 + JavaScript (gráficos SVG propios).
Streamlit actúa como servidor/hosting: lee los archivos del proyecto, los
une en un solo documento HTML (CSS y JS en línea) y lo muestra con
components.html(). Toda la lógica (fetch a la API, KPIs, alertas,
gráficos) se sigue ejecutando en el navegador del usuario.

Ejecutar localmente:   streamlit run app.py
"""
import json
import re
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import streamlit as st
import streamlit.components.v1 as components

PROJECT_DIR = Path(__file__).parent / "monitor-cambiario"
IFRAME_HEIGHT = 1750  # alto del área del dashboard en px (con scroll interno)

st.set_page_config(
    page_title="Monitor Cambiario de Compras",
    page_icon="💱",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# Quita márgenes y menú de Streamlit para que el dashboard ocupe toda la pantalla
st.markdown(
    """
    <style>
      .block-container { padding: 0.5rem 0.5rem 0 0.5rem; max-width: 100%; }
      header[data-testid="stHeader"] { display: none; }
      footer { visibility: hidden; }
    </style>
    """,
    unsafe_allow_html=True,
)


API_BASE = "https://mindicador.cl/api"
ENDPOINTS = ["dolar", "euro", "libra_cobre", "uf", "root"]


def _fetch_endpoint(endpoint: str):
    """Descarga un endpoint desde el servidor (sin CORS ni sandbox del iframe)."""
    url = API_BASE if endpoint == "root" else f"{API_BASE}/{endpoint}"
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "monitor-cambiario/1.0"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception:  # noqa: BLE001 — cualquier fallo: reintenta y luego se omite
            if attempt < 2:
                time.sleep(0.6 * 2**attempt)
    return None


@st.cache_data(ttl=600, show_spinner=False)
def fetch_server_data() -> dict:
    """Consulta mindicador.cl desde el servidor de Streamlit (caché 10 min).

    El navegador del usuario puede no lograr llamar a la API desde el iframe
    sandbox de components.html() (origen "null", bloqueos de red móvil, etc.).
    Estos datos se inyectan en la página como segunda fuente antes del respaldo.
    """
    with ThreadPoolExecutor(max_workers=len(ENDPOINTS)) as pool:
        results = dict(zip(ENDPOINTS, pool.map(_fetch_endpoint, ENDPOINTS)))
    return {"fetchedAt": int(time.time() * 1000), "data": {k: v for k, v in results.items() if v}}


def build_html() -> str:
    """Une index.html + styles.css + todos los .js en un solo HTML autocontenido.

    Es necesario porque components.html() renderiza el contenido en un iframe
    (srcdoc) donde las rutas relativas como "css/styles.css" no existen.
    """
    html = (PROJECT_DIR / "index.html").read_text(encoding="utf-8")

    # 1) CSS en línea
    css = (PROJECT_DIR / "css" / "styles.css").read_text(encoding="utf-8")
    html = html.replace(
        '<link rel="stylesheet" href="css/styles.css">',
        f"<style>\n{css}\n</style>",
    )

    # 2) Cada <script src="js/..."> se reemplaza por su contenido, en el mismo orden
    def inline_script(match: re.Match) -> str:
        js = (PROJECT_DIR / match.group(1)).read_text(encoding="utf-8")
        return f"<script>\n{js}\n</script>"

    html = re.sub(r'<script src="([^"]+)"></script>', inline_script, html)

    # 3) Datos obtenidos por el servidor, disponibles antes de que corra api.js
    payload = json.dumps(fetch_server_data(), ensure_ascii=False).replace("</", "<\\/")
    html = html.replace(
        "<script>\n/**\n * config.js",
        f"<script>window.APP_SERVER_DATA = {payload};</script>\n<script>\n/**\n * config.js",
        1,
    )
    return html


components.html(build_html(), height=IFRAME_HEIGHT, scrolling=True)
