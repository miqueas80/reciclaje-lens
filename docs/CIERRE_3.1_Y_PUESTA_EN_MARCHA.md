# Cierre técnico 3.1 — NEXUS Recycle Lens Industrial

Fecha: 10/10/2026. **Cierre de software para demostración/piloto supervisado**, no homologación de línea industrial.

## Corregido en 3.1

1. Muestreo por lote: las inspecciones anuladas ya no computan como muestras activas, y los IDs se comparan sin distinguir mayúsculas/minúsculas. Ambos casos bloquean una lectura falsamente completa del plan.
2. Exportación **Informe QA de lotes**: genera JSON con lotes, estados, muestras, resultados firmados declarados y eventos de auditoría, con SHA-256 de integridad. **No es firma, certificado ni prueba de homogeneidad.**
3. Autodiagnóstico operativo con estados WebCrypto, IndexedDB, PWA controlada, almacenamiento persistente, disponibilidad de API serie, cantidad de registros, evidencia de auditoría y lotes retenidos. No prueba instalación o calibración real de instrumentos.
4. CSP de navegador que bloquea scripts y recursos remotos por defecto, estilos no inline y actualización de caché PWA a 3.1.
5. Tests de regresión para cobertura de lote, integridad del reporte JSON, detección de cambios y capacidad negativa de automatización.

## Lista previa a cada turno (estación piloto)

- Confirmar identificación de estación y procedimiento aprobado externamente.
- Comprobar PWA offline, IndexedDB y posibilidad de respaldar datos a un medio externo.
- Verificar que el operador haya definido lote, muestra y objetivo correctos.
- Confirmar física y documentalmente que el marcado corresponda a la pieza inspeccionada.
- Para escamas/films/pellets: **no** deducir composición de foto; vincular espectrómetro validado o retener.
- Comparar los reportes con condiciones ambientales/calibración, biblioteca y control positivo/negativo aprobados por el responsable de metrología.
- No reutilizar el ID de medición ni el ID de muestra dentro del lote.
- Tratar como **cuarentena** cualquier discordancia, material fuera de dominio, duda, pigmento negro no resuelto, contaminación o baja señal.
- Un resultado QA cerrado no autoriza recibir, mezclar, vender o separar físicamente el lote.

## Puertas de salida para una versión realmente industrial en producción

| Puerta | Evidencia requerida | Estado al cierre |
|---|---|---|
| Software — unidad y regresión | Batería automática sin fallos | 45/45 PASS |
| Interfaz | Simulación de inspección y QA | PASS con DB simulada |
| Persistencia real y PWA offline | Ensayo E2E en dispositivo escogido | PENDIENTE |
| Espectrómetro real | Driver/protocolo + firmas de dispositivo + muestras | PENDIENTE |
| Calidad metrológica | Calibración, laboratorio de referencia, matriz de confusión, falsos aceptados, OOD | PENDIENTE |
| Seguridad de datos | Autenticación, roles, sincronización y backup remoto con política de retención | PENDIENTE |
| Línea física | Análisis de peligros, PLC con enclavamientos, pruebas de falla segura | NO IMPLEMENTADO |

**Decisión de entrega:** software cerrado como **3.1 PILOTO SUPERVISADO**. **NO APTO aún para puesta en línea automática**, decisiones de aceptación económica o certificación de polímeros.
