# NEXUS Recycle Lens — Industrial Edge 3.1.1

**Entrega cerrada del módulo de software para un PILOTO SUPERVISADO de reciclaje industrial de plásticos.**

> **No equivale a una clasificadora industrial certificada ni a un detector químico autónomo.** El software no puede reconocer con certeza todos los polímeros usando únicamente una cámara RGB. Para validar la composición de muestras sin marcado hacen falta equipos y ensayos de laboratorio específicos; ninguna firma digital prueba precisión metrológica. No controla máquinas ni autoriza procesamiento físico.

## Qué incluye

- **57 materiales y familias**, incluyendo las clases RIC 01–07 y polímeros técnicos. Este catálogo no es la totalidad de las formulaciones, cargas y mezclas que existen.
- **Marcados**: lectura de etiquetas/siglas/RIC, fotografía y OCR únicamente si el navegador ofrece las APIs nativas. Para escamas, polvo, film y pellets no se infiere identidad química de un marcado vecino ni de la apariencia.
- **Lotes y muestras**: plan de muestreo declarado, muestra única por lote, formato físico, origen, cantidad, estado y trazabilidad en IndexedDB. Muestras anuladas **no** completan el muestreo.
- **Revisión por segundo operador**: los resultados dudosos e informes externos permanecen en cuarentena. El cierre QA es documental; no significa aprobación física del lote.
- **Instrumentos**: importación de JSON sin firma (retenido) y de sobres firmados Ed25519 con medición, equipo, clave, fecha, lote, muestra e identificador único. Web Serial de **solo lectura**, compatible únicamente con equipos adaptados al protocolo documentado.
- **Espectros**: control de ejes, unidades y anomalías y cotejo experimental SAM/SNV contra referencias locales. No produce confianza calibrada, pureza, certificados ni salidas de actuador.
- **Exportaciones**: registro CSV (con mitigación de fórmulas), auditoría, respaldo JSON con integridad SHA-256, informe QA de lotes y diagnóstico de estación exportables. Hash **no** significa autoría o protección frente a manipulaciones intencionales.
- **PWA sin backend**: recursos cacheados por Service Worker tras primera instalación online; datos en IndexedDB del navegador. CSP restrictiva, sin CDN ni comunicación remota obligatoria.

## Inicio rápido (sin modificar NEXUS-X)

Requisitos: navegador moderno, Python 3 para servidor local (o alojamiento HTTPS estático). Para pruebas de firma, Node.js 22+.

```bash
cd nexus-recycle-industrial
python3 -m http.server 8000
```

Abrir http://localhost:8000 en esa computadora. **No** abrir `index.html` directamente por `file://`; se requieren origen seguro/HTTP para los módulos, IndexedDB y Service Worker. En un celular, publicar los archivos de la carpeta en un origen HTTPS (por ejemplo un repositorio separado de GitHub Pages). Cargar una vez completamente con Internet antes de probar el modo avión. Los datos de diferentes dispositivos **no se sincronizan**.

Para crear una carpeta de publicación sin tests, documentación o herramientas:

```bash
npm run build  # crea dist/ con 18 archivos estáticos incluyendo sw.js y .nojekyll
```

También se incluye `.github/workflows/deploy-pages.yml` para **un repositorio GitHub separado**. Una vez activado *Settings → Pages → Source: GitHub Actions*, cada push a `main` ejecutará tests y publicará solo `dist/`. No modifica ni publica NEXUS-X original.

Para probar el software sin modificar equipos ni enviar datos:

1. En **Inspección**, crear lote `LOTE-2026-01`, muestra `S1`, plan `SOP-001`, objetivo `2`, operador `Inspector A`, formato `Pieza`, e ingresar `05 PP`.
2. Registrar la inspección; quedará pendiente de control por un segundo responsable.
3. Crear una segunda muestra `S2` con `>PC+ABS<` y observar su cuarentena y el estado retenido del lote.
4. En **QA**, documentar revisión con un usuario distinto. En **Lotes** exportar el informe; en **Operación** ejecutar el autodiagnóstico y exportar respaldo.
5. Probar en un navegador real con conexión cortada, cerrar/reabrir y comprobar que datos y recursos permanecen disponibles. Guardar respaldos fuera del dispositivo.

## Pruebas del repositorio

```bash
npm test         # 45 tests unitarios
npm run verify   # tests + compilación + auditoría de dist y PWA
```

La simulación visual (con almacenamiento **simulado**) usa Playwright/Chromium y no es necesaria para ejecutar la app:

```bash
python tests/ui_simulation.py
```

**Resultados de la entrega**: 45 pruebas unitarias aprobadas, simulación de interfaz aprobada sin errores JS y análisis estático de paquete aprobado. No se pudo ejecutar E2E con IndexedDB, Service Worker y navegación local reales porque Chromium del entorno de pruebas bloquea localhost por políticas de administración. Tampoco hubo acceso a espectrómetros, muestras reales, PLC o ensayos de precisión.

## Documentación técnica

- [`docs/PROTOCOLO_INDUSTRIAL_V3.md`](docs/PROTOCOLO_INDUSTRIAL_V3.md): esquema de mediciones firmadas, Web Serial e implicaciones.
- [`docs/INSTRUMENTOS.md`](docs/INSTRUMENTOS.md): contrato de importación legacy.
- [`docs/ARQUITECTURA_INDUSTRIAL.md`](docs/ARQUITECTURA_INDUSTRIAL.md): arquitectura, dominios y límites.
- [`docs/VALIDACION_PLANTA.md`](docs/VALIDACION_PLANTA.md): pruebas de campo para habilitación industrial.
- [`docs/CIERRE_3.1_Y_PUESTA_EN_MARCHA.md`](docs/CIERRE_3.1_Y_PUESTA_EN_MARCHA.md): procedimientos, riesgos abiertos y criterios de no puesta en línea.

## Seguridad / limitaciones ineludibles

- Las claves públicas autorizadas se configuran **localmente por un operador sin autenticación**. Un atacante con acceso al navegador o sus datos puede cambiar esa lista; no es gestión empresarial de identidades.
- IndexedDB **no** proporciona auditoría inmutable, backup empresarial, control concurrente multiestación, control de accesos ni garantía contra pérdida/borrado de datos.
- La firma Ed25519 autentica origen en relación con una **clave previamente confiada**, pero no la composición, calibración real, manipulación de muestra, versión real de biblioteca ni pureza.
- El software **no genera señales de control** hacia PLC, cinta, expulsores, relés, sopladores o robots. Una integración futura deberá separar control de seguridad industrial del diagnóstico de laboratorio.
- Para producción son obligatorios: selección del modelo real de espectrómetro, contratos de comunicación, corpus de muestras con referencia química, validación por polímero/mezcla/tinte, seguridad de maquinaria, gestión de usuarios, base de datos central, backups y ensayos de disponibilidad.

## Aislamiento

Esta carpeta es un módulo independiente. No toca `miqueas80/Laboratorio2.0`, su IndexedDB, Service Worker, inventario ni documentos.
