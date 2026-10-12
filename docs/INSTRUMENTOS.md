# Integración de sensores — contrato v1

Este adaptador **no procesa espectros sin interpretar**. Lee una **conclusión generada por software del equipo externo**. Archivo JSON UTF-8:

```json
{
  "schema": "nexus.spectrometer.result/1",
  "method": "FTIR",
  "materialId": "PP",
  "confidence": 0.98,
  "deviceId": "FTIR-PLANTA-01",
  "calibrationId": "CAL-2026-10",
  "sampleId": "LOTE42-MUESTRA03",
  "libraryVersion": "BIBLIOTECA-VALIDADA-5",
  "measuredAt": "2026-10-09T15:00:00.000Z",
  "calibratedAt": "2026-10-09T12:00:00.000Z"
}
```

`method` acepta NIR, FTIR, MIR y RAMAN. `materialId` debe existir en el catálogo local; `confidence` es número de 0 a 1 informado por el fabricante, **no probabilidad calibrada por NEXUS**. Los seis metadatos identifican el equipo, calibración, muestra, versión de biblioteca y momento de análisis/calibración. Se exige formato de fecha válido, calibración no posterior al análisis y antigüedad máxima declarada de 180 días; este límite es **una regla operativa provisional**, no una certificación de calibración.

Nunca confíes en el JSON como evidencia auténtica solo porque supera estas validaciones. La importación se marca `instrument_import_unverified` y **todo informe importado queda en cuarentena**, aun con marca coincidente, mientras no exista firma/autenticación y proceso de validación del equipo.

## Para un equipo real

1. Solicitar al fabricante formato de salida, exactitud específica por resina/color/contaminación, proceso de calibración, control de interferencias y protocolo de comunicación.
2. Escribir un **adaptador aislado por marca/modelo** para convertir salidas instrumentales a este JSON sin alterar la medición original; conservar espectro crudo y firma en sistema controlado.
3. Agregar autenticación y firma/verificación de datos, asociación inequívoca `sampleId`–lote–pieza, reloj sincronizado, validación de rango/calidad espectral y reglas por polímero, no solo `confidence`.
4. Probar PET/PETG/PVC/PS/PP/PE y sus mezclas con negros, laminados, aceites, suciedad y aditivos; medir falsos positivos y rechazos.
5. La lógica de seguridad que actúe sobre una cinta debe estar **fuera de esta PWA**, en PLC/SCADA o sistema industrial auditado, con paro de emergencia e interlocks.


## Regla 2.1 para muestra y lote

`sampleId` en el informe debe coincidir exactamente (sin distinguir minúsculas) con el ID introducido en la inspección. Una discrepancia produce `MUESTRA_INSTRUMENTAL_DIFERENTE`. La coincidencia NO autentica el informe; se conserva `INSTRUMENTO_NO_AUTENTICADO` y no se puede cerrar la inspección como liberada por QA. En producción, reemplazar este adaptador por el fabricante y un servicio de confianza con control de identidad, fecha/hora, calibración, versión del modelo y hash/firma sobre el resultado original.
