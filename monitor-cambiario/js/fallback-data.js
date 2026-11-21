/**
 * fallback-data.js
 * ---------------------------------------------------------------
 * Datos de RESPALDO (snapshot real de mindicador.cl del 21-11-2026).
 * Solo se usan si la API no responde y no hay caché local disponible.
 * Se definen como variable JS (y no como .json) para que funcionen
 * incluso abriendo index.html con doble clic (protocolo file://),
 * donde fetch() a archivos locales está bloqueado por el navegador.
 */
window.App = window.App || {};
App.fallbackData = Object.freeze({
 "snapshotDate": "2026-11-21",
 "dolar": {
  "version": "1.7.0",
  "autor": "mindicador.cl",
  "codigo": "dolar",
  "nombre": "Dólar observado",
  "unidad_medida": "Pesos",
  "serie": [
   {
    "fecha": "2026-11-20T03:00:00.000Z",
    "valor": 1008.79
   },
   {
    "fecha": "2026-11-19T03:00:00.000Z",
    "valor": 1002.07
   },
   {
    "fecha": "2026-11-18T03:00:00.000Z",
    "valor": 996.68
   },
   {
    "fecha": "2026-11-17T03:00:00.000Z",
    "valor": 1001.17
   },
   {
    "fecha": "2026-11-16T03:00:00.000Z",
    "valor": 999.1
   },
   {
    "fecha": "2026-11-13T03:00:00.000Z",
    "valor": 992.48
   },
   {
    "fecha": "2026-11-12T03:00:00.000Z",
    "valor": 984.49
   },
   {
    "fecha": "2026-11-11T03:00:00.000Z",
    "valor": 977.05
   },
   {
    "fecha": "2026-11-10T03:00:00.000Z",
    "valor": 969.8
   },
   {
    "fecha": "2026-11-09T03:00:00.000Z",
    "valor": 979.88
   },
   {
    "fecha": "2026-11-06T03:00:00.000Z",
    "valor": 970.94
   },
   {
    "fecha": "2026-11-05T03:00:00.000Z",
    "valor": 970.95
   },
   {
    "fecha": "2026-11-04T03:00:00.000Z",
    "valor": 980.59
   },
   {
    "fecha": "2026-11-03T03:00:00.000Z",
    "valor": 981.82
   },
   {
    "fecha": "2026-11-02T03:00:00.000Z",
    "valor": 992.66
   },
   {
    "fecha": "2026-10-30T03:00:00.000Z",
    "valor": 993.22
   },
   {
    "fecha": "2026-10-29T03:00:00.000Z",
    "valor": 981.08
   },
   {
    "fecha": "2026-10-28T03:00:00.000Z",
    "valor": 985.14
   },
   {
    "fecha": "2026-10-27T03:00:00.000Z",
    "valor": 994.29
   },
   {
    "fecha": "2026-10-26T03:00:00.000Z",
    "valor": 990.35
   },
   {
    "fecha": "2026-10-23T03:00:00.000Z",
    "valor": 986.58
   },
   {
    "fecha": "2026-10-22T03:00:00.000Z",
    "valor": 976.82
   },
   {
    "fecha": "2026-10-21T03:00:00.000Z",
    "valor": 978.56
   },
   {
    "fecha": "2026-10-20T03:00:00.000Z",
    "valor": 981.86
   },
   {
    "fecha": "2026-10-19T03:00:00.000Z",
    "valor": 981.65
   },
   {
    "fecha": "2026-10-16T03:00:00.000Z",
    "valor": 984.09
   },
   {
    "fecha": "2026-10-15T03:00:00.000Z",
    "valor": 987.03
   },
   {
    "fecha": "2026-10-14T03:00:00.000Z",
    "valor": 980.79
   },
   {
    "fecha": "2026-10-13T03:00:00.000Z",
    "valor": 978.61
   },
   {
    "fecha": "2026-10-09T03:00:00.000Z",
    "valor": 981.61
   },
   {
    "fecha": "2026-10-08T03:00:00.000Z",
    "valor": 979.85
   }
  ]
 },
 "euro": {
  "version": "1.7.0",
  "autor": "mindicador.cl",
  "codigo": "euro",
  "nombre": "Euro",
  "unidad_medida": "Pesos",
  "serie": [
   {
    "fecha": "2026-11-20T03:00:00.000Z",
    "valor": 1107.59
   },
   {
    "fecha": "2026-11-19T03:00:00.000Z",
    "valor": 1099.6
   },
   {
    "fecha": "2026-11-18T03:00:00.000Z",
    "valor": 1098.03
   },
   {
    "fecha": "2026-11-17T03:00:00.000Z",
    "valor": 1102
   },
   {
    "fecha": "2026-11-16T03:00:00.000Z",
    "valor": 1102.03
   },
   {
    "fecha": "2026-11-13T03:00:00.000Z",
    "valor": 1096.91
   },
   {
    "fecha": "2026-11-12T03:00:00.000Z",
    "valor": 1091.82
   },
   {
    "fecha": "2026-11-11T03:00:00.000Z",
    "valor": 1089.61
   },
   {
    "fecha": "2026-11-10T03:00:00.000Z",
    "valor": 1086.61
   },
   {
    "fecha": "2026-11-09T03:00:00.000Z",
    "valor": 1092.4
   },
   {
    "fecha": "2026-11-06T03:00:00.000Z",
    "valor": 1090.94
   },
   {
    "fecha": "2026-11-05T03:00:00.000Z",
    "valor": 1090.83
   },
   {
    "fecha": "2026-11-04T03:00:00.000Z",
    "valor": 1097.72
   },
   {
    "fecha": "2026-11-03T03:00:00.000Z",
    "valor": 1100.2
   },
   {
    "fecha": "2026-11-02T03:00:00.000Z",
    "valor": 1107.26
   },
   {
    "fecha": "2026-10-30T03:00:00.000Z",
    "valor": 1109.37
   },
   {
    "fecha": "2026-10-29T03:00:00.000Z",
    "valor": 1093.25
   },
   {
    "fecha": "2026-10-28T03:00:00.000Z",
    "valor": 1097.16
   },
   {
    "fecha": "2026-10-27T03:00:00.000Z",
    "valor": 1112.8
   },
   {
    "fecha": "2026-10-26T03:00:00.000Z",
    "valor": 1108.39
   },
   {
    "fecha": "2026-10-23T03:00:00.000Z",
    "valor": 1107.27
   },
   {
    "fecha": "2026-10-22T03:00:00.000Z",
    "valor": 1097.55
   },
   {
    "fecha": "2026-10-21T03:00:00.000Z",
    "valor": 1099.26
   },
   {
    "fecha": "2026-10-20T03:00:00.000Z",
    "valor": 1100.86
   },
   {
    "fecha": "2026-10-19T03:00:00.000Z",
    "valor": 1101.99
   },
   {
    "fecha": "2026-10-16T03:00:00.000Z",
    "valor": 1103.49
   },
   {
    "fecha": "2026-10-15T03:00:00.000Z",
    "valor": 1099.02
   },
   {
    "fecha": "2026-10-14T03:00:00.000Z",
    "valor": 1097.69
   },
   {
    "fecha": "2026-10-13T03:00:00.000Z",
    "valor": 1095.5
   },
   {
    "fecha": "2026-10-09T03:00:00.000Z",
    "valor": 1100.46
   },
   {
    "fecha": "2026-10-08T03:00:00.000Z",
    "valor": 1097.13
   }
  ]
 },
 "libra_cobre": {
  "version": "1.7.0",
  "autor": "mindicador.cl",
  "codigo": "libra_cobre",
  "nombre": "Libra de Cobre",
  "unidad_medida": "Dólar",
  "serie": [
   {
    "fecha": "2026-11-20T03:00:00.000Z",
    "valor": 5.65
   },
   {
    "fecha": "2026-11-19T03:00:00.000Z",
    "valor": 6
   },
   {
    "fecha": "2026-11-18T03:00:00.000Z",
    "valor": 6.02
   },
   {
    "fecha": "2026-11-17T03:00:00.000Z",
    "valor": 6.11
   },
   {
    "fecha": "2026-11-16T03:00:00.000Z",
    "valor": 6.19
   },
   {
    "fecha": "2026-11-13T03:00:00.000Z",
    "valor": 6.3
   },
   {
    "fecha": "2026-11-12T03:00:00.000Z",
    "valor": 6.26
   },
   {
    "fecha": "2026-11-11T03:00:00.000Z",
    "valor": 6.38
   },
   {
    "fecha": "2026-11-10T03:00:00.000Z",
    "valor": 6.33
   },
   {
    "fecha": "2026-11-09T03:00:00.000Z",
    "valor": 6.32
   },
   {
    "fecha": "2026-11-06T03:00:00.000Z",
    "valor": 6.4
   },
   {
    "fecha": "2026-11-05T03:00:00.000Z",
    "valor": 6.42
   },
   {
    "fecha": "2026-11-04T03:00:00.000Z",
    "valor": 6.58
   },
   {
    "fecha": "2026-11-03T03:00:00.000Z",
    "valor": 6.5
   },
   {
    "fecha": "2026-11-02T03:00:00.000Z",
    "valor": 6.61
   },
   {
    "fecha": "2026-10-30T03:00:00.000Z",
    "valor": 6.66
   },
   {
    "fecha": "2026-10-29T03:00:00.000Z",
    "valor": 6.65
   },
   {
    "fecha": "2026-10-28T03:00:00.000Z",
    "valor": 6.58
   },
   {
    "fecha": "2026-10-27T03:00:00.000Z",
    "valor": 6.56
   },
   {
    "fecha": "2026-10-26T03:00:00.000Z",
    "valor": 6.44
   },
   {
    "fecha": "2026-10-23T03:00:00.000Z",
    "valor": 6.56
   },
   {
    "fecha": "2026-10-22T03:00:00.000Z",
    "valor": 6.62
   },
   {
    "fecha": "2026-10-21T03:00:00.000Z",
    "valor": 6.55
   },
   {
    "fecha": "2026-10-20T03:00:00.000Z",
    "valor": 6.58
   },
   {
    "fecha": "2026-10-19T03:00:00.000Z",
    "valor": 6.54
   },
   {
    "fecha": "2026-10-16T03:00:00.000Z",
    "valor": 6.62
   },
   {
    "fecha": "2026-10-15T03:00:00.000Z",
    "valor": 6.67
   },
   {
    "fecha": "2026-10-14T03:00:00.000Z",
    "valor": 6.71
   },
   {
    "fecha": "2026-10-13T03:00:00.000Z",
    "valor": 6.53
   },
   {
    "fecha": "2026-10-09T03:00:00.000Z",
    "valor": 6.61
   },
   {
    "fecha": "2026-10-08T03:00:00.000Z",
    "valor": 6.57
   }
  ]
 },
 "uf": {
  "version": "1.7.0",
  "autor": "mindicador.cl",
  "codigo": "uf",
  "nombre": "Unidad de fomento (UF)",
  "unidad_medida": "Pesos",
  "serie": [
   {
    "fecha": "2026-11-21T03:00:00.000Z",
    "valor": 41377.93
   },
   {
    "fecha": "2026-11-20T03:00:00.000Z",
    "valor": 41371.05
   },
   {
    "fecha": "2026-11-19T03:00:00.000Z",
    "valor": 41364.17
   },
   {
    "fecha": "2026-11-18T03:00:00.000Z",
    "valor": 41357.3
   },
   {
    "fecha": "2026-11-17T03:00:00.000Z",
    "valor": 41350.42
   },
   {
    "fecha": "2026-11-16T03:00:00.000Z",
    "valor": 41343.55
   },
   {
    "fecha": "2026-11-15T03:00:00.000Z",
    "valor": 41336.67
   },
   {
    "fecha": "2026-11-14T03:00:00.000Z",
    "valor": 41329.8
   },
   {
    "fecha": "2026-11-13T03:00:00.000Z",
    "valor": 41322.93
   },
   {
    "fecha": "2026-11-12T03:00:00.000Z",
    "valor": 41316.06
   },
   {
    "fecha": "2026-11-11T03:00:00.000Z",
    "valor": 41309.19
   },
   {
    "fecha": "2026-11-10T03:00:00.000Z",
    "valor": 41302.33
   },
   {
    "fecha": "2026-11-09T03:00:00.000Z",
    "valor": 41295.46
   },
   {
    "fecha": "2026-11-08T03:00:00.000Z",
    "valor": 41290.15
   },
   {
    "fecha": "2026-11-07T03:00:00.000Z",
    "valor": 41284.83
   },
   {
    "fecha": "2026-11-06T03:00:00.000Z",
    "valor": 41279.51
   },
   {
    "fecha": "2026-11-05T03:00:00.000Z",
    "valor": 41274.2
   },
   {
    "fecha": "2026-11-04T03:00:00.000Z",
    "valor": 41268.88
   },
   {
    "fecha": "2026-11-03T03:00:00.000Z",
    "valor": 41263.57
   },
   {
    "fecha": "2026-11-02T03:00:00.000Z",
    "valor": 41258.26
   },
   {
    "fecha": "2026-11-01T03:00:00.000Z",
    "valor": 41252.94
   },
   {
    "fecha": "2026-10-31T03:00:00.000Z",
    "valor": 41247.63
   },
   {
    "fecha": "2026-10-30T03:00:00.000Z",
    "valor": 41242.32
   },
   {
    "fecha": "2026-10-29T03:00:00.000Z",
    "valor": 41237.01
   },
   {
    "fecha": "2026-10-28T03:00:00.000Z",
    "valor": 41231.7
   },
   {
    "fecha": "2026-10-27T03:00:00.000Z",
    "valor": 41226.39
   },
   {
    "fecha": "2026-10-26T03:00:00.000Z",
    "valor": 41221.08
   },
   {
    "fecha": "2026-10-25T03:00:00.000Z",
    "valor": 41215.77
   },
   {
    "fecha": "2026-10-24T03:00:00.000Z",
    "valor": 41210.47
   },
   {
    "fecha": "2026-10-23T03:00:00.000Z",
    "valor": 41205.16
   },
   {
    "fecha": "2026-10-22T03:00:00.000Z",
    "valor": 41199.85
   }
  ]
 },
 "root": {
  "version": "1.7.0",
  "autor": "mindicador.cl",
  "fecha": "2026-11-21T06:00:00.000Z",
  "dolar": {
   "codigo": "dolar",
   "nombre": "Dólar observado",
   "unidad_medida": "Pesos",
   "fecha": "2026-11-20T03:00:00.000Z",
   "valor": 1008.79
  },
  "uf": {
   "codigo": "uf",
   "nombre": "Unidad de fomento (UF)",
   "unidad_medida": "Pesos",
   "fecha": "2026-11-21T03:00:00.000Z",
   "valor": 41377.93
  },
  "tpm": {
   "codigo": "tpm",
   "nombre": "Tasa Política Monetaria (TPM)",
   "unidad_medida": "Porcentaje",
   "fecha": "2026-11-20T03:00:00.000Z",
   "valor": 4.5
  },
  "utm": {
   "codigo": "utm",
   "nombre": "Unidad Tributaria Mensual (UTM)",
   "unidad_medida": "Pesos",
   "fecha": "2026-11-01T03:00:00.000Z",
   "valor": 72440
  }
 }
});
