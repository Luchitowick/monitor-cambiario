# Manual de usuario

Monitor Climático Operativo · Distribuidora Frío Sur SpA (caso ficticio) · Gerencia de Operaciones y Logística

Esta guía explica cómo leer y usar el dashboard para planificar despachos refrigerados y turnos del centro de distribución de Maipú.

---

## 1. ¿Para qué sirve?

Responde cada día tres preguntas de la gerencia:

1. **¿En qué horario conviene despachar** para no romper la cadena de frío?
2. **¿Qué contingencias hay que preparar** (lluvia, viento, radiación UV, calidad del aire)?
3. **¿Cuánto costará el calor** en energía extra de refrigeración?

## 2. Cómo abrirlo

| Opción | Cómo |
|---|---|
| **En línea** | Abrir la URL de la app publicada en Streamlit Community Cloud. |
| **En tu computador** | Doble clic en `dashboard/index.html` (Chrome, Edge o Firefox). |
| **Con Streamlit local** | `pip install -r requirements.txt` y luego `streamlit run app.py`. |

Se necesita internet para los datos en vivo. Sin conexión, el dashboard sigue funcionando y avisa de dónde vienen los datos.

## 3. Recorrido por la pantalla

### 3.1 Barra superior
- **Indicador de estado**:

  | Texto | Significado |
  |---|---|
  | 🟢 En vivo | Datos recién descargados de la API |
  | 🟢 En vivo (servidor) | Datos reales descargados por el servidor de Streamlit |
  | 🟢 En vivo (caché) | Datos reales guardados hace menos de 15 minutos |
  | 🟡 Caché sin conexión | Sin internet: se muestran los últimos datos guardados |
  | 🔴 Modo respaldo | Sin internet ni caché: datos de demostración |

- **Fecha del pronóstico** y hora de la última consulta.
- **Auto-actualizar (10 min)**: activa o pausa la actualización automática.
- **Actualizar**: fuerza una consulta nueva a la API, ignorando la caché.
- **◐**: cambia entre tema claro y oscuro.

### 3.2 Decisión sugerida
El recuadro grande de arriba es **lo más importante**: muestra la recomendación principal del día, su nivel de severidad (Crítica, Alta, Atención, Favorable), la **acción** a tomar y la **evidencia** numérica que la respalda.

### 3.3 Filtros y parámetros
- **Variable**: elige qué ver en el gráfico principal: Temperatura, Lluvia, Viento, UV, Humedad o PM2,5.
- **Ventana**: próximas **24 h**, **3 días** o **7 días**. Cambia los KPIs, las alertas y el gráfico principal.
- **Umbral cadena de frío (°C)**: temperatura desde la cual el andén y los camiones pierden frío (por defecto 27 °C).
- **Costo extra de frío (CLP por °C·h)**: costo estimado de energía por cada grado-hora sobre el umbral (por defecto $3.500).

Al cambiar el umbral o el costo, **todo se recalcula al instante**. Sirve para simular escenarios ("¿qué pasa si el umbral fuera 30 °C?").

### 3.4 Tarjetas KPI
| Tarjeta | Qué muestra |
|---|---|
| Temperatura actual | Temperatura y sensación térmica, variación contra ayer a la misma hora y curva de las próximas 24 h |
| Máxima de la ventana | La temperatura más alta, cuándo ocurre y cuánto supera (o no) el umbral |
| Costo extra de frío | Pesos estimados, horas sobre el umbral, grados-hora y franja más fresca para despachar |
| Lluvia y viento | Probabilidad máxima de lluvia, milímetros acumulados y viento máximo |
| Índice UV · Calidad del aire | UV máximo con su categoría y PM2,5 promedio frente a la norma |

El borde de color superior indica el estado: **rojo** crítico, **naranjo** alto, **verde** favorable.

### 3.5 Gráficos
- **Gráfico principal**: evolución hora a hora de la variable elegida. La línea punteada roja es el umbral. En temperatura, la línea gris punteada es la sensación térmica.
- **Máxima diaria vs. umbral**: cada barra es un día. **Roja** = sobre el umbral, **azul** = bajo el umbral. Los días ya pasados se ven más claros.
- **Horas sobre el umbral por día**: cuántas horas de calor tendrá cada uno de los próximos 7 días y el costo total estimado.

**Cómo explorarlos:**
- Pasa el mouse o **toca** un gráfico para ver el detalle (tooltip).
- Con el teclado: haz clic o Tab sobre el gráfico y usa **← →** para recorrer; **Esc** cierra el detalle.
- **Ver tabla** muestra los datos horarios en una tabla. Las horas sobre el umbral aparecen destacadas.

### 3.6 Alertas y recomendaciones
Panel lateral con todas las alertas activas, ordenadas de más a menos grave. Cada una indica:
- **qué pasa** (título),
- **la evidencia** (números concretos),
- **→ qué hacer** (acción recomendada).

## 4. Ejemplos de uso

**Programar los despachos de mañana**
1. Ventana **24 h**, variable **Temperatura**.
2. Lee la tarjeta *Costo extra de frío*: la **franja más fresca** es el horario recomendado para despachar.
3. En el gráfico, revisa en qué horas la línea azul supera el umbral rojo.

**Planificar la semana**
1. Ventana **7 días**.
2. Revisa *Horas sobre el umbral por día* para ver qué días serán más críticos y su costo.
3. Si aparece la alerta *Semana más calurosa*, programa la mantención de los equipos de frío.

**Simular un cambio de equipos**
1. Si se instalan cortinas de aire en el andén, el umbral podría subir. Cambia el umbral de 27 a 30 °C.
2. Observa cómo bajan las horas críticas y el costo, y cómo cambia la decisión sugerida.

## 5. Preguntas frecuentes

**¿Cada cuánto se actualizan los datos?**
Open-Meteo actualiza su modelo cada hora. El dashboard consulta cada 10 minutos (si la auto-actualización está activa) o cuando se presiona *Actualizar*.

**¿Qué hago si aparece "Modo respaldo"?**
Revisa la conexión a internet y presiona **Reintentar**. Los números que ves en ese modo son de demostración, no del día.

**¿Por qué la ventana de 7 días tiene menos datos de PM2,5?**
La API de calidad del aire solo pronostica 5 días hacia adelante.

**¿Se guardan mis ajustes?**
Sí. La variable, la ventana, el umbral, el costo y el tema se guardan en el navegador.
