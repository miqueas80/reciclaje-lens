# Matriz de aceptación de piloto industrial

## 1. Pruebas del software realizadas

- 20 pruebas unitarias (parser, mezclas, marcado reforzado, contradicciones, política de cuarentena, validación de informe, doble revisión, CSV): **PASS** el 09/10/2026.
- Simulación de la interfaz en Chromium headless con almacenamiento en memoria simulado, creación de dos registros y revisión QA: **PASS** (sin errores JS capturados).
- Revisión visual de interfaz de escritorio/móvil: realizada con capturas headless.
- E2E con IndexedDB, Service Worker, cámara física, funcionamiento offline Android y descargas en navegador real: **PENDIENTE** (navegación a localhost bloqueada por política del Chromium de este entorno).

## 2. Pruebas obligatorias antes de salir a línea

- [ ] Operación offline Android/PC real, primera instalación, cierre y reapertura, persistencia IndexedDB, exportación de 10.000 registros y restauración.
- [ ] Medir retención de miniaturas y cuotas de datos en un uso de jornada completa.
- [ ] Confirmar compatibilidad de cámara, enfoque, fotografía, OCR disponible y QR/Data Matrix en los dispositivos elegidos.
- [ ] Verificar inventario de equipos NIR/FTIR/MIR/Raman disponibles, biblioteca espectral, calibraciones y exactitud por clase; definir trazabilidad de muestras y límites de aceptación.
- [ ] Construir **corpus etiquetado en laboratorio**: principales resinas, polímeros técnicos, blends, multicapa, negro de humo, aditivos, contaminación, envejecimiento y materiales fuera del catálogo.
- [ ] Medir matriz de confusión, error de falsas aceptaciones, tasa de rechazos a cuarentena, resultados por familia, calibración de confidencias, variación por lote/equipo/operador.
- [ ] Establecer criterios por resina y por corriente receptora; si la planta recicla PS espumado, crear ruta exclusiva y validar separados PS, EPS, XPS y HIPS.
- [ ] Aprobar SOP para incidente, anomalías, revisión independiente y pérdida de almacenamiento.
- [ ] Auditoría de seguridad: usuarios con rol, autenticación, backups resistentes a alteraciones, firmas de sensor y sincronización/multidispositivo.
- [ ] Integración hardware solo mediante controlador industrial seguro que no dependa de la conectividad de la PWA; ensayar fail-safe e interlocks.

## 3. Criterio para declarar "industrial en producción"

Las pruebas anteriores, acuerdos de calidad del receptor y evaluación de seguridad deben pasar en campo. **Las 20 pruebas unitarias no equivalen a validación industrial.**

## 4. Endurecimiento v2.1 RC

- [x] Unicidad de ID de muestra por lote; restauración rechaza conflicto de IDs.
- [x] Informe instrumental no autenticado siempre retenido, con chequeo de ID de muestra.
- [x] Indicador de mezclas, muestras faltantes y estados en vista por lote, sin aprobación de lote.
- [ ] Confirmar pruebas de extremo a extremo reales en dispositivos objetivo.
- [ ] Aprobar perfil de calibración y recepción por equipo, matriz de confusión, método de referencia de laboratorio y tasa de falsos aceptados.
- [ ] Política de muestreo por lote y criterios contractuales; actualmente NO implementados.
