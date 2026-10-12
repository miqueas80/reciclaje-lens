# NEXUS Recycle Lens — arquitectura para operación industrial

**Nivel actual:** inspección manual asistida y trazabilidad local; **sin verificación física universal** ni autorización de lotes. **Nivel objetivo:** módulo de identificación supervisado conectado a un sistema de medición trazable. No controlará dispositivos de seguridad.

## Flujo de muestra (antes de cualquier aceptación)

1. Identificar **lote, sublote y muestra** físicamente, registrar procedencia y masa real de la muestra.
2. Captura RGB: fotografía, código RIC/ISO 11469 y etiquetas de pieza. Nunca convertir un candidato visual en polímero químicamente confirmado.
3. Sensor de identificación elegido y validado por planta: FTIR o NIR/MIR/Raman (según tipo de pieza, granulometría, pigmentos y throughput). Conservar espectro original, metadatos, ID, calibración, versión de biblioteca, calidad de señal y sello verificable.
4. Fusión de evidencias: coincidencia de ID de muestra + marca/resultado instrumental; abstención ante discordancia, baja calidad de señal, sospecha de aditivos o material fuera de biblioteca.
5. Decisión **de inspección**: pendiente, retenida, rechazada o cerrada por QA. Un resultado de NIR/Raman/FTIR no reemplaza ensayos cuando el método no resuelve una mezcla o aditivo.
6. Decisión **de lote**: fuera del alcance de esta RC. Requiere especificación contractual de recepción, muestreo estadístico, resultados de laboratorio y autoridad designada.
7. Si se automatiza la separación: exportar un evento firmado/verificado a infraestructura industrial; PLC/SCADA independiente evalúa estado de planta, enclavamientos, paros y seguridad funcional. No conectar esta web a relés o expulsadores.

## Familias y complicaciones

- RIC 01–07 = identificadores de resina, **no sellos de reciclabilidad**.
- Los polímeros especiales, modificados o reforzados (por ejemplo PA66-GF30), mezclas (PC+ABS), multilámina, EPS/XPS/HIPS, PVC y material 07 pasan a evaluación de ruta especializada o retención.
- Materiales negros con negro de humo pueden absorber la señal NIR y requieren métodos compatibles alternativos. XRF da **información elemental** (útil para Cl/Br en condiciones apropiadas), no identifica por sí sola todas las familias poliméricas.
- Una cámara convencional sólo aporta pistas de superficie, forma, color y marcados; no certifica polímeros sin marca.

## Contrato de aceptación industrial: definir con la planta

Documentar POR material/corriente/cliente los requisitos de composición, pureza, PVC residual, humedad, contaminantes, color, aditivos regulados, metales, tamaño de partícula y trazabilidad. Para cada requisito documentar: método de referencia, rango, incertidumbre, volumen de muestra, frecuencia y procedimiento de rechazo.

Documentar por sensor y clase: matriz de confusión; falsos aceptados; falsos rechazados; tasa de abstención; sensibilidad a negro, humedad, suciedad, contaminación superficial, orientación, iluminación, temperatura y tamaño de partícula; velocidad de banda; tiempo de respuesta; latencia al PLC; fallos de señal y recuperación.

**No se asignan objetivos numéricos arbitrarios**. Deben venir de especificación de planta y mediciones físicas; ningún dataset público genérico sustituye un conjunto de prueba representativo de esa operación.

## Ciberseguridad / continuidad (no incluidas en esta RC)

- Autenticación y autorización real por rol de operador, calidad, ingeniería y supervisor.
- Comunicación autenticada con sensores y firma/verificación de informes de equipo (idealmente almacén central de sólo anexado) y cadena de custodia.
- Auditoría resistente a alteraciones, retención reglamentaria y respaldos automáticos fuera del dispositivo.
- Sincronización multiestación, reloj confiable, gestión de calibraciones y versiones del modelo, inventario de equipos y registros de mantenimiento.
- Ensayos con pérdida de energía/red, datos corruptos y sensor fuera de calibración. Rechazar por defecto si falta evidencia.

## Normativa informativa

- ASTM D7611/D7611M: clasificación de códigos de resina — no son símbolos universales de reciclabilidad.
- ISO 11469:2016: sistema genérico de identificación y marcado de artículos de plástico.
- ISO 15270:2008: guía para recuperación/reciclado de residuos plásticos (en revisión por ISO).

La adopción de una norma, el cumplimiento legal y la certificación de la instalación requieren revisión por el responsable de calidad y seguridad de la planta, no pueden inferirse de la implementación del código.

## Control de cobertura en RC 2.2
El campo `sampleTarget` es un dato del SOP validado por la planta, NO una estimación estadística producida por esta aplicación. El contador de muestras no demuestra aleatorización, representatividad, pureza ni tolerancia de contaminación. La identificación basada en marcado queda vinculada a una pieza física única, no a granel/film/pellets. En caso de ausencia de identificación química autenticada, retener.
