# NEXUS Industrial Edge 3.0 · Contrato y protocolo de piloto

> **No certificado.** Esta versión es un banco de inspección de planta, sin habilitación para control autónomo, emisiones de conformidad ni determinación universal de composición. La única salida a equipos es **ninguna**.

## 1. Arquitectura

- **Captura local RGB**: fotografía y lectura de marcas por TextDetector/BarcodeDetector si el navegador las admite. El marcado es evidencia documental, NO prueba de composición.
- **Catálogo de polímeros**: 57 familias/referencias, expresiones RIC 01–07 y ISO 11469. Categoría `07` no identifica un polímero específico.
- **Entrada de informes instrumentales**: JSON manual o **sobre Ed25519** validado contra una clave pública previamente registrada. `schema=nexus.instrument.signed/2`.
- **Puente Edge Serial**: puerto USB/serie solicitado por el usuario mediante Web Serial; solo lectura, NDJSON (línea JSON LF), y solo sobres **firmados** desde ese puerto. El software no envía comandos.
- **Laboratorio SAM/SNV**: cotejo descriptivo con biblioteca proporcionada; nunca devuelve pureza, probabilidad ni certificación. Ejes deben coincidir exactamente.
- **Decisión de planta**: cuarentena obligatoria de informes hasta verificación metrológica fuera del software y SOP local. La firma solo demuestra integridad y posesión de clave de la estación configurada.
- **Registro**: IndexedDB v5, identificadores únicos de muestra/lote y de medición (índice único), exportaciones con resumen SHA-256. No hay autenticación de personas, log remoto inmutable ni sincronización multiestación.

## 2. Sobre firmado

```json
{
  "schema": "nexus.instrument.signed/2",
  "payload": {
    "schema": "nexus.spectrometer.result/1",
    "method": "FTIR",
    "materialId": "PP",
    "confidence": 0.9,
    "deviceId": "FTIR-L1",
    "lot": "LOT-2026-003",
    "sampleId": "MUESTRA-003",
    "measurementId": "MED-0001",
    "measuredAt": "2026-10-10T10:00:00Z",
    "calibratedAt": "2026-10-09T10:00:00Z",
    "calibrationValidUntil": "2026-10-11T10:00:00Z",
    "calibrationId": "CAL-71",
    "libraryVersion": "FABRICANTE-3"
  },
  "signature": { "algorithm":"Ed25519", "keyId":"FABRICANTE-KEY-1", "value":"FIRMA_BASE64_DE_64_BYTES" }
}
```

`payload` es el único contenido firmado. Se codifica `stableJSON(payload)` con objetos ordenados recursivamente por clave (arrays conservan orden), UTF-8 y Ed25519 sobre bytes. La clave pública Base64 RAW (32 bytes) se almacena localmente vinculada a `keyId` y `deviceId`.

**No se acepta una firma como certificado de calibración o librería.** El registro almacena además el sobre firmado original y su resumen SHA-256 de carga útil para auditoría/reverificación futura; no convierte esa prueba local en auditoría inmutable. La estación valida una ventana temporal de 7 días, que la fecha declarada de calibración no esté vencida y el enlace exacto lote/muestra. Exige coincidencia de `deviceId` con la clave previamente aprobada. `confidence` procede del software instrumental; NO se debe interpretar como probabilidad calibrada.

**Seguridad de aprovisionamiento:** nunca se debe confiar en una clave pegada de un email sin un segundo canal verificado. El registro local puede ser modificado por alguien con control del navegador. La provisión segura, las revocaciones en red y autenticación central exigen una arquitectura adicional (OT gateway, IdP y control de claves fuera del navegador).

## 3. Espectro opcional y laboratorio

Campo `payload.spectrum` (máximo 4096 puntos):

```json
{"axisUnit":"nm", "signalUnit":"reflectance", "axis":[1000,1010], "signal":[0.4,0.5]}
```

Para un espectro real se requieren **16 a 4096 canales**. Unidades de eje `nm` o `cm-1`, de señal `reflectance`, `absorbance` o `counts`. Debe haber monotonicidad estricta, números finitos y valores físicos básicos cuando son reflectancias. Se informa varianza y ruido descriptivo (diferencias medianas entre muestras contiguas), no una calidad instrumental certificada.

Formato de bibliotecas `nexus.spectral.library/1`:

```json
{"schema":"nexus.spectral.library/1", "libraryId":"LIB-EJEMPLO-NO-VALIDADO", "version":"1", "axisUnit":"nm", "signalUnit":"reflectance", "axis":[1000,1010], "references":[{"referenceId":"R1", "materialId":"PP", "signal":[0.2,0.4]}]}
```

Nota: el ejemplo simplificado de 2 puntos muestra la estructura; el validador exige 16 o más puntos. SAM calcula ángulo entre vectores tras normalización SNV y devuelve mejores coincidencias **hipotéticas**, nunca confianza ni porcentaje de pureza. No se interpolan ejes distintos ni se acepta señal plana. Un laboratorio debe caracterizar, adquirir y validar una biblioteca de todas las categorías objetivo bajo condiciones reales, incluida humedad, pigmentos y contaminación.

## 4. Pruebas de aceptación antes de planta

1. Registro de equipo y verificación independiente de clave, revocación, claves incorrectas, firmas alteradas, anti-replay y deriva del reloj.
2. Control de muestra y lote, repetición y conflictos; restauración de respaldo siempre retenido.
3. Calibración física trazable (estándares, rango, expiración y mantenimiento), referencia de laboratorio ciega y procedimiento de muestreo por morfología.
4. Estimar matriz de confusión por polímero / origen / color / granulometría / aditivos; reportar precisión, exhaustividad y falsos aceptados **por corriente** y umbrales de desconocido. No hay cifra asumida.
5. Ensayos en negro de humo, multicapa, humedad, contaminación, PVC en PET, RAEE con retardantes bromados y material fuera de distribución.
6. Ensayos de la PWA con desconexión de red, respaldo/restauración, almacenamiento, retención de registros y UX de turno en hardware real.
7. Si la planta conecta máquinas: **PLC y controlador de seguridad independientes**, evaluación de riesgos de maquinaria, segmentación de red OT y comunicaciones autenticadas, sin salida de comandos desde el navegador.

## 5. Integración con máquinas de producción (no implementada)

Un gateway industrial gobernado por la ingeniería de planta podría exponer datos vía OPC UA (con certificados y políticas OT) e integrar PLC y MES. La PWA seguiría como terminal de **inspección y decisión documental**, nunca como controlador de seguridad. Un sistema realmente productivo requerirá servidores redundantes, identidades y roles, auditoría inmutable remota, seguridad física, calibración, mantenimiento, observabilidad y recuperación ante desastres.

## 6. Fuentes de referencia

- ASTM D7611/D7611M-26, códigos de resina: https://webstore.ansi.org/standards/astm/astmd7611d7611m26
- ISO 11469:2016, marcado uniforme: https://www.iso.org/standard/63434.html
- OPC UA, estándar de interoperabilidad: https://opcfoundation.org/about/what-is-opc/
- Investigación de plásticos negros en MWIR: https://pubmed.ncbi.nlm.nih.gov/41067168/
