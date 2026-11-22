# Frente académico, reputación y analítica

> Actualización 22/11: integración económica y académica sobre BD v4 disponible. Consultar [guía v4](skillswap-v4-integration.md) y [verificación actual](verification-2026-11-22.md). Los pendientes de BD descritos abajo corresponden al estado histórico del 21/11.


Ver la [revisión completa posterior](verification-2026-11-21.md): sustituye el
alcance de la comprobación focalizada al final de este documento. Incluye E2E
ejecutados, correcciones y criterios de aceptación todavía pendientes.

## Procedencia y alcance

Implementación local de A01–A10 según las secciones 6 y 7 del plan del 20/11/2026,
en orden: base académica → reputación → indicadores → revisión y documentación.
Base: `8fe275bc465b061e9df651dfc870ef293b3870f7`.
Fuente consultada del frontend: `front_end_parcial_3`, commit
`0e577a9771ae1e2d40878267506a20ce56b8247c`, archivo
`frontend/src/features/curriculum/systems-curriculum.js` y contratos de roadmap/opiniones.
No se modificó Frontend, Dashboards ni las seis migraciones del otro desarrollador.
La validez institucional del pensum sigue pendiente de confirmación del equipo.

Tecnologías conservadas: Node 26.8.2, npm 11, NestJS 11.2.7, TypeScript 5.9,
Prisma/adapter-pg 7.10.1, PostgreSQL 16. DTO con class-validator, guards JWT/roles,
Swagger y SQL parametrizado; sin dependencias nuevas.

Actualización 21/11: Node admitido >=26.8.2 <27, verificado con 26.13.1 y npm
11.20.0. El nuevo reparto Sprint 3 y HU-05/HU-06/HU-08 se describen en
[sprint3-user-stories.md](sprint3-user-stories.md). Opiniones y seed se conservan
como trabajo preparado para coordinación con APIs/BD, según sus nuevas responsabilidades.

## Etapa 1: catálogo, modelo y Mi ruta (A01–A03)

`src/modules/academic/curriculum.json` contiene la transcripción de 49 materias
publicables y MAT-030 como requisito externo. Áreas identificadas por código;
semestres 1–9; semestre 0 reservado al requisito externo. LIBRE-I/LIBRE-II no
representan materias y se excluyen. `scripts/seed-academic.cjs` realiza carga
transaccional e idempotente bajo el bloqueo asesor usado por el núcleo.

Equivalencias: código ya asociado → UUID existente; en primera carga, nombre
exacto normalizado (sin tildes, espacios repetidos ni diferencia de mayúsculas)
→ UUID existente. No se equipara Java con Programación ni se renombra una habilidad.
Dos candidatos para una materia provocan rollback con códigos/UUID en el error;
no se borra ni fusiona ninguno. La ejecución imprime una tabla código/nombre/UUID/acción;
no hay un listado de UUID de BD inventado en esta entrega. Las habilidades inactivas
se preservan inactivas y deben revisarse con el responsable del catálogo.

Modelo: CURRICULOS enlaza carrera, AREAS_ACADEMICAS identifica áreas,
MATERIAS_ACADEMICAS enlaza códigos con UUID, PRERREQUISITOS_ACADEMICOS tiene
referencias compuestas, PROGRESO_ACADEMICO usa PK usuario/currículo/código.
No altera reservas, usuarios, habilidades ni saldos al guardar avance.

| Ruta | Acceso | Contrato |
| --- | --- | --- |
| GET /skills | Público | Contrato existente, `codigo` nullable por relación académica; UUID sigue en `id_habilidad` |
| GET /curricula/systems | Público | Filtros `codigo`, `semestre` 1–9 y `area`; incluye requisitos y bandera `externo` |
| GET /roadmap/me | JWT | `{ "curriculum":"systems", "courses":{} }` sin registros |
| PUT /roadmap/me/courses/:codigo | JWT | `{ "estado":"approved" }`, `current` o `pending`; devuelve ruta completa |

Ejemplo de respuesta (solo ilustración de contrato, no datos de una cuenta real):

```json
{"curriculum":"systems","courses":{"SIS-111":"approved","SIS-113":"current"}}
```

`pending` elimina la fila. MAT-030 solo acepta approved/pending. Electivas y códigos
desconocidos: 400; no acepta `userId` ni otro currículo en el cuerpo. La sesión
determina el usuario. Actualización atómica por fila y bloqueo por cuenta impiden
que cambios simultáneos de materias diferentes se pierdan; para la misma materia
prevalece la última operación serializada. Respuesta construida dentro de la transacción.

El frontend permite este plan a cualquier carrera; no restringimos por la carrera
del perfil. Se valida que el código pertenezca al currículo systems persistido.
El progreso es una declaración manual, no una certificación ni un prerrequisito
para reservar tutorías. No se marcan automáticamente las materias previas ni se
prohíbe declarar una materia cuyo requisito aún no fue marcado. La UI calcula
recomendaciones con los requisitos del catálogo. CORS ahora admite PUT.

## Etapa 2: opiniones y reputación (A04–A05)

| Ruta | Acceso | Contrato |
| --- | --- | --- |
| GET /tutoring/reviews | Público | `tutorId` y `skillId` UUID obligatorios; page/limit |
| GET /tutoring/reviews/me | JWT | Opiniones escritas por el usuario; page/limit |
| POST /tutoring/reservations/:id/review | JWT | `calificacion` entero 1–5; `comentario` opcional, string <=500; Idempotency-Key obligatorio |
| GET /tutoring/reputation | Público | `tutorId` y `skillId`; media nullable, opiniones y clases completadas |

Opinión: `{ id_calificacion, id_reserva, calificacion, comentario, created_at }`.
Listas: `{ data, meta: { page, limit, total, totalPages } }`, page >=1, limit 1–100,
orden fecha descendente y UUID para desempate. Las opiniones públicas no exponen
correo, nombre, UUID del evaluador ni saldos. El comentario es contenido público
aportado por el autor; el cliente debe renderizarlo como texto, nunca como HTML.

Solo el solicitante puede opinar sobre una reserva Completada cuyo fin ya pasó;
403 para tutor/tercero, 409 para estado inválido o duplicado. Misma clave y contenido
devuelven la misma opinión (201); misma clave con otro contenido devuelve 409.
Una clave nueva sobre una reserva ya calificada también devuelve 409. Se usa el
bloqueo global y AUDITORIA de idempotencia del núcleo; persistencia de opinión y
replay en la misma transacción. Se agrega índice único por reserva en la propuesta
BD; no sustituye la comprobación de participación. Opiniones publicadas inmutables.

Medias y conteos solo usan notas 1–5 del solicitante al ofertante de esa materia,
con reserva completada y finalizada. Sin opiniones: promedio null. Las ofertas
existentes consumen estas mismas calificaciones. No se aplican incentivos.

Propuesta para discutir con PO, **no implementada como puntuación oficial**:
`KS = 100 × (0.60 × promedio/5 + 0.40 × min(clases_completadas/20, 1))`, mínimo
3 opiniones por tutor/materia y ventana de 90 días. Pesos, ventana, mínimo, sesgos
por volumen y eventual penalización requieren acuerdo. Cancelación registrada no
equivale a injustificada; falta evidencia y procedimiento de revisión.
Hasta esa aprobación `knowledge_score` y `cancelaciones_injustificadas` son null.
El ranking ADMIN es descriptivo: >=3 opiniones primero, luego promedio, cantidad
de opiniones, código de materia y UUID. `pocos_datos` identifica muestra menor a 3;
no presenta una nota ficticia ni mueve dinero.

## Etapa 3: resumen e indicadores (A06–A09)

| Ruta | Acceso | Uso |
| --- | --- | --- |
| GET /intercambios/mis-clases | JWT | Clases propias completadas, paginadas; resumen Aprendí/Enseñé |
| GET /analytics/academic | ADMIN | Command Center por materia, área y semestre |
| GET /analytics/reputation | ADMIN | Ranking descriptivo por tutor/materia |
| GET /analytics/economy | ADMIN | Distribución de precios, horas de inicio e inactividad observada |

El primer endpoint es una API nueva; la ruta homónima del frontend sigue siendo
una pantalla y puede seguir usando GET /reservations/me. No se cambió su adaptador.
Estudiante recibe solo su participación. ADMIN no puede consultar datos personales
ajenos mediante este endpoint: también queda limitado a su propia identidad.

Filtros de indicadores: `from`, `to` ISO-8601 **con zona**, `codigo`, `area`, `semestre`.
Mis clases admite from/to/page/limit, sin segmentación académica, y funciona sobre
el esquema base. Intervalo **[from,to)**, máximo 366 días, por defecto últimos
30 días hasta el instante de consulta. Respuestas incluyen el período efectivo.
Fechas almacenadas UTC; horarios agrupados mediante `AT TIME ZONE 'America/La_Paz'`
(UTC−04:00). Los filtros no aceptan SQL ni identificadores libres interpolados.

| KPI | Población, cálculo y fecha |
| --- | --- |
| Aprendí / Enseñé | Reservas Completada, fin pasado; solicitante/ofertante respectivamente, por completed_at |
| Clases, horas, materias | Count reservas, suma duración real en horas, count materias distintas; resumen completo del período, no solo la página |
| Créditos personales | Suma RESERVAS.creditos pactados; texto exacto NUMERIC/INTEGER; no flotantes JS ni precio actual de oferta |
| Opiniones personales | Notas escritas en Aprendí y recibidas en Enseñé; promedio null sin opiniones |
| Tutores/ofertas activos | Snapshot actual; oferta Activa, tutor Activo, disponibilidad disponible y fin futuro; no es una serie histórica |
| Demanda observada | Solicitudes creadas en período, incluidas rechazadas/canceladas |
| Cobertura | Solicitudes del período que tienen reserva no cancelada / todas las solicitudes del período; null si denominador cero |
| Reservas | Reservas creadas en período, incluidas luego canceladas; puede diferir de la cohorte de solicitudes |
| Alerta descriptiva | >=5 solicitudes y <=1 tutor activo; umbral explícito de consulta, no criterio oficial de PO |
| Demanda proyectada estimada | Cuentas activas con al menos una declaración en systems, materia sin marcar y todos los requisitos aprobados; snapshot, no solicitud confirmada |
| Ranking | Reservas completadas dentro del período (completed_at), opiniones válidas asociadas disponibles al consultar; no filtra por fecha de creación de opinión |
| Precio publicado / pactado | Distribución exacta por precio de ofertas/reservas creadas en el período; incluye todos sus estados y no representa precio histórico si hubo edición externa |
| Horarios pico | Conteo por hora local de inicio de reservas cuyo fecha_inicio cae en período; cancelaciones de esa cohorte separadas |
| Cuentas sin movimientos | Cuentas activas registradas antes de from, sin movimiento alguno en [from,to); saldos y retenidos actuales, toda la población, no segmentada por materia |

Sin movimientos no equivale a «créditos sin uso» oficial: PO debe definir período,
qué movimientos cuentan y tratamiento de retenciones. Se devuelve la definición
aplicada y `criterio_sin_uso_PO: null`. Sin regla para cancelación injustificada se
devuelve null, nunca se clasifica automáticamente ni se cambia un saldo.

Ejemplo vacío de resumen personal (ilustración del contrato):

```json
{
  "data": [],
  "meta": {"page":1,"limit":20,"total":0,"totalPages":0},
  "resumen": {
    "aprendi":{"clases":0,"horas":0,"creditos":"0","materias":0,"opiniones":0,"promedio":null},
    "ensene":{"clases":0,"horas":0,"creditos":"0","materias":0,"opiniones":0,"promedio":null}
  }
}
```

La respuesta real añade `period`. Las consultas ADMIN no exponen cuentas ni
correos; ranking usa identificador del tutor necesario para la comparación. No
publicar ese dataset individual sin revisión de BI. Consumo autorizado de ejemplo:
`GET /analytics/academic?from=2026-11-01T00:00:00-04:00&to=2026-12-01T00:00:00-04:00&area=software`
con Bearer ADMIN. No colocar JWT, credenciales ni DATABASE_URL en dashboards
públicos. BI debe consultar mediante integración de servidor y permisos mínimos.
Refresco a demanda; no se añadieron tareas automáticas ni credenciales de Looker.
Las respuestas multinconsulta de clases/economía usan snapshot RepeatableRead.

## Migración y reversión coordinadas

1. BD revisa `prisma/schema.prisma` y `prisma/proposals/academic-reputation.sql`.
   Confirmar plan/carrera, backup, nombres de tablas y compatibilidad con cualquier
   migración decimal futura. La propuesta no modifica las nueve columnas de créditos.
2. Preflight: revisar `SELECT id_reserva,count(*) FROM "CALIFICACIONES" GROUP BY
   id_reserva HAVING count(*)>1;`. No eliminar automáticamente opiniones históricas.
   Resolver casos con BD antes del índice nuevo. Revisar duplicados de nombres normalizados.
3. Tras aprobación, incorporar SQL en una **nueva** carpeta de prisma/migrations
   posterior a las seis heredadas. Desplegar en base aislada, luego generar cliente
   y ejecutar semilla. Probar carga dos veces, comparar código/UUID y número de filas.
4. Validar ruta, permisos, concurrencia, persistencia después de reconectar y las
   consultas con fixtures conocidos; recién entonces integrar la migración compartida.
5. Reversión preferida: volver al código previo dejando tablas aditivas. Si se
   requiere retirar el esquema, exportar declaraciones y catálogo, detener escritores,
   retirar primero PROGRESO y PRERREQUISITOS, luego MATERIAS, AREAS y CURRICULOS,
   y finalmente el índice CALIFICACIONES_reserva_unica. No borrar HABILIDADES ni
   CALIFICACIONES y no usar CASCADE. BD debe registrar la reversión en su flujo
   de migraciones; nunca editar una migración que ya se aplicó.

## Calidad y estado real (A10)

Pruebas añadidas: catálogo (49+externo/referencias), opiniones (concurrencia,
replay, acceso ajeno, tutor, estados, futuro, ausencia de datos, separación de
materias, saldos intactos), DTO/fechas/paginación; E2E HTTP con JWT, guards, CORS PUT
y respuestas 503 cuando no existe PostgreSQL. Estas últimas usan memoria y no
certifican persistencia PostgreSQL. Swagger incorpora rutas, parámetros y DTO.

Comandos focalizados, para ejecutar en primer plano con Node 26.8.2:

```powershell
npm.cmd ci
npm.cmd run prisma:generate
npm.cmd run prisma:validate
npm.cmd run build
npm.cmd test -- --runTestsByPath src/modules/academic/academic.spec.ts
npm.cmd run test:e2e -- --runTestsByPath test/academic.e2e-spec.ts
npm.cmd run lint
```

Registro de esta sesión: implementación sin iniciar API, Docker ni PostgreSQL;
sin migrar, sembrar, publicar rama ni abrir PR. Node encontrado inicialmente:
24.21.0; npm 11.19.0. El usuario indicó que instalará Node 26.8.2. El intento de
instalación offline no encontró caché completa; el siguiente detectó certificado
TLS y se reintentó con las CA de Windows sin deshabilitar TLS.

Pendientes de aceptación: integración BD, recarga idempotente contra PostgreSQL,
pruebas de concurrencia reales de Mi ruta, exactitud SQL de los KPIs con datos
controlados, pruebas integrales con frontend, CI y revisión del PR independiente
hacia la rama de integración acordada (`Backend`). No se declara CI aprobada ni
persistencia certificada. Mantener flags de frontend desactivadas hasta esa revisión.

### Verificación realizada el 21/11/2026

| Comando / revisión | Resultado real |
| --- | --- |
| npm ci --ignore-scripts --no-audit --no-fund --prefer-offline con CA de Windows | Correcto, 716 paquetes; no cambiaron versiones del lockfile |
| npm run prisma:generate | Correcto, cliente 7.10.1; sin conexión a BD |
| npm run prisma:validate | Correcto, modelo académico incluido |
| npm run build | Correcto con Node 26.13.1 |
| tsc --noEmit -p tsconfig.json | Correcto, incluye código de pruebas |
| npm run lint | Correcto, sin warnings |
| academic.spec.ts + tutoring-update.spec.ts + offer-metrics.spec.ts | 17/17 pruebas, 3 suites, ejecución secuencial en memoria |
| cancellation-policy.spec.ts | 1/1 prueba: liberación única, replay, nuevo intento 409 y auditoría |
| git diff --check | Sin errores de espacios |

Total focalizado: **18 pruebas aprobadas**. Los E2E añadidos quedaron preparados
pero no se ejecutaron en esta sesión; tampoco tests PostgreSQL, API, Docker,
migraciones ni semillas. Build y unitarias no demuestran persistencia real en
Neon/PostgreSQL. La instalación omitió scripts de paquetes; antes de arrancar el
sistema seguir npm ci normal del README (especialmente para módulos nativos).
La primera compilación sin cliente Prisma falló; tras generarlo se repitió y pasó.
La nueva clasificación económica continúa bloqueada por el contrato BD faltante.
