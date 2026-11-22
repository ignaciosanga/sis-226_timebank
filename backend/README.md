# Banco de Tiempo Universitario — Backend v0.4.0

**Estado vigente del cierre técnico (22/11/2026):** esta rama parte de la integración
`e6642bc`. La migración oficial `20261121000000_creditos_decimales` convierte los nueve
importes a NUMERIC y añade la oferta opcional de la solicitud; Prisma usa `Decimal`
sin precisión/escala adicional y conserva las restricciones SQL. El flujo de oferta
`"3.7"`, retención, cancelación y doble confirmación se ejecuta sobre las migraciones
oficiales. Ver [capacidades actuales](#8-qué-funciona-con-las-migraciones-oficiales-y-qué-falta)
y [contrato de integración](docs/frontend-integration.md#fase-4-solicitud-a-precio-publicado-y-retención-exacta).
Las secciones fechadas y los informes de fases anteriores conservan su contexto histórico.

Referencia conservada de la orden 2A: Prisma validate/generate, build y lint aprobados;
**273 unitarias**, **194 E2E**, `npm run test:postgres` completo con salida **0** y
flujo de integración con PostgreSQL/Mailpit aprobado en una base desechable. El clon
de revisión conserva `nexou_cierre_s3` en 55436, API 4106 y Mailpit 58026;
la base persistente mantuvo los mismos registros al terminar las pruebas.

## Orden 2B — HU-08 parcialmente validada

La cancelación conserva permisos, motivo, actor, fecha, liberación íntegra y
reapertura del horario. Un participante puede cancelar antes del inicio: con
**5 horas exactas o más**, `sin_multa`; con **menos de 5 horas**, `injustificada`.
Desde el inicio sigue requiriendo ADMIN. ADMIN siempre registra
`administrativa`, incluso si es participante, y no multa a nadie.
No hay excepciones manuales ni cambios del precio publicado o pactado.

La multa corresponde exclusivamente al actor de la cancelación injustificada:
un movimiento `Penalizacion` de `"-0.5"` si alcanza el disponible, o un único
`penalizacion_sin_saldo` de `"0"` si no alcanza. No hay cobro parcial, deuda ni
cobro posterior. Si cancela el tutor, se libera la reserva del estudiante y
la multa se registra en la cuenta del tutor. Los importes siguen siendo NUMERIC
en unidades de crédito; no se multiplica ningún saldo por diez.

La clasificación se persiste en `AUDITORIA`, acción `BACKEND_METADATA`, entidad
`RESERVAS`, campo JSON `clasificacionCancelacion`; se devuelve como
`cancelacion.clasificacion`. El historial anterior conserva `null` y no se
reclasifica. Cancelación, liberación, clasificación, multa e idempotencia
comparten la transacción PostgreSQL y el bloqueo existente. Analytics economía,
ranking y reputación cuentan la clasificación persistida y excluyen las
administrativas. Economía expone además el historial `sin_clasificar`.

**Responsable del cobro comprobado: Backend.** Las nueve migraciones versionadas
y el PostgreSQL local `nexou_cierre_s3` no contienen triggers de cobro; la inspección
de `pg_trigger` sin triggers internos devolvió cero filas. El verificador oficial
repite esa inspección antes de los casos HU-08 sobre su base desechable.
No se agregó un trigger ni se modificaron migraciones históricas.
Antes de desplegar otro mecanismo, BD debe coordinar un único responsable de
cobro, clasificación y liberación; activar su trigger junto al cobro de Backend
puede descontar dos veces. Este cierre no autoriza ese despliegue.

**Pendiente de Alan y BD: qué disponible evaluar cuando la liberación cambia si
alcanza para pagar.** La referencia de BD en
[`database/db/init/sql/07_economia_dinamica.sql`, función `fn_aplicar_penalizacion_cancelacion`](https://github.com/ignaciosanga/sis-226_timebank/blob/9d56fa3bdd12f003146dba1daf6217267845c0f8/database/db/init/sql/07_economia_dinamica.sql#L170)
lee `USUARIOS.saldo, creditos_retenidos FOR UPDATE`, calcula
`v_disponibles := v_saldo_anterior - v_retenidos` (línea 231) y se ejecuta
`AFTER INSERT OR UPDATE OF estado, cancelado_por` sobre `RESERVAS` (línea 270).
No contiene una liberación ni fija su orden respecto de esa lectura. Además usa
la representación INTEGER en décimas; ese SQL no se ejecutó en la integración
NUMERIC. `10_penalizaciones_pendientes.sql` propone deuda, excluida de este sprint.

Para solicitante con saldo `"3.7"`, retenido `"3.7"` y disponible `"0"`:

| Criterio aún sin aprobar | Resultado posible después de liberar |
| --- | --- |
| Evaluar antes de liberar | Saldo `"3.7"`, retenido `"0"`; `penalizacion_sin_saldo` de `"0"` |
| Evaluar después de liberar | Saldo `"3.2"`, retenido `"0"`; `Penalizacion` de `"-0.5"` |

Hasta recibir respuesta, si ambos criterios producirían resultados diferentes,
la API devuelve **409 `CANCELLATION_BALANCE_POLICY_PENDING`**, sin modificar
reserva, horario, retención, ledger, clasificación ni idempotencia. Es un bloqueo
temporal de integración, no una política económica definitiva. Los casos donde
ambos criterios coinciden continúan. HU-08 permanece **parcialmente validada**.
El 409 deja la reserva **Confirmada**, con su retención todavía activa; no
representa una cancelación completada.
HU-06 dinámica requiere el acuerdo Frontend/BD y banners #47 se trata por separado.

Validación final de 2B: `prisma:validate`, `prisma:generate`, `build`, `lint`,
**284/284 unitarias (29 suites)**, **194/194 E2E (11 suites)** y
**`npm run test:postgres` completo: salida 0, 121.676 s**. PostgreSQL ejecutó el
núcleo inicial y 46 casos de cinco verificadores: 32 anteriores y 14 HU-08.
Se conservaron las comprobaciones Prisma/SQL/HTTP de nueve importes decimales,
retención/liquidación exacta de 3.7 y contrato histórico sin oferta.

Resultados reales con PostgreSQL y `Date.now` controlado. `E` es solicitante,
`T` es tutor y `S/R` significa saldo/retención final. Los movimientos indicados
son los ligados a esa reserva, incluida su retención inicial; el precio es 3.7
salvo el caso señalado de 0.1. En cada cancelación aprobada se comprobaron actor,
motivo, fecha, clasificación persistida y horario reabierto.

| Escenario | Resultado / clasificación | E S/R | T S/R | Movimientos finales |
| --- | --- | --- | --- | --- |
| 5 h exactas, cancela E o T (dos casos) | 200, `sin_multa` | 10/0 | 2/0 | 2: Retencion 3.7 + Liberacion 3.7 |
| 4 h 59, E dispone exactamente de 0.5, saldo inicial 4.2 | 200, `injustificada` | 3.7/0 | 2/0 | 3: retención + liberación + Penalizacion -0.5 a E |
| 4 h 59, T dispone exactamente de 0.5 | 200, `injustificada` | 10/0 | 0/0 | 3: retención + liberación a E + Penalizacion -0.5 a T |
| 4 h 59, T dispone de 0.4 | 200, `injustificada` | 10/0 | 0.4/0 | 3: retención + liberación + penalizacion_sin_saldo 0 a T |
| 4 h 59, E tiene 0.4; reserva de 0.1 | 200, `injustificada` | 0.4/0 | 2/0 | 3: retención 0.1 + liberación 0.1 + penalizacion_sin_saldo 0 a E |
| ADMIN ajeno, solicitante o tutor; después del inicio (tres casos) | 200, `administrativa` | 3.7/0 | 2/0 | 2; ninguna multa |
| Misma clave concurrente en dos instancias; replay tras reinicio | 200/200 y respuesta idéntica; nueva clave 409 | 10/0 | 0/0 | Una liberación y una multa -0.5 al tutor, mismos registros |
| Dos actores concurrentes, claves distintas | 200/409; ganó E, `injustificada` | 9.5/0 | 2/0 | Una liberación y una multa -0.5 a E |
| FK real falla al insertar multa; reintento tras reinicio | Primer 409 sin cambios en ninguna tabla; después 200 | 10/0 | 1.5/0 | Tras reintentar: 3, una sola multa -0.5 a T |
| Carrera con liquidación: gana ADMIN | 200/409, `administrativa` | 10/0 | 0/0 | 2: retención + liberación; ningún pago ni multa |
| Carrera con liquidación: gana segunda confirmación | 200/409, `Completada` | 6.3/0 | 3.7/0 | 3: Retencion 3.7 + Consumo -3.7 + Transferencia 3.7 |
| Participante cancela desde el inicio (ambos actores) | 409/409, sin efectos | 3.7/3.7 | 2/0 | Solo la retención original |
| E con 3.7 totalmente retenidos, cancelación tardía | 409 con código pendiente; resultado económico sin aprobar | 3.7/3.7 | 2/0 | Solo Retencion 3.7; sin clasificación ni multa nuevas |
| Analytics economía y ranking | 6 injustificadas persistidas; administrativas excluidas | — | — | Auditoría de integridad global sin incidencias |

La base persistente conserva las huellas de sus **22 tablas**; no quedaron bases
temporales del runner. Los puertos/procesos 4103–4105 se conservaron. La API local
4106 quedó actualizada, lista y con la clasificación en Swagger. La evidencia
privada está en `.local/order2b/`: `resultados.json`, `resultado-cierre.txt`, logs
de comandos, `isolation-before.json`, `isolation-after.json` y `preservation.json`.

Archivos creados o ampliados en la orden 2B (rutas relativas a `backend/`):

| Área | Archivos |
| --- | --- |
| Cancelación y contrato | [cancellation-policy.ts](src/modules/exchanges/cancellation-policy.ts), [exchanges.service.ts](src/modules/exchanges/exchanges.service.ts), [exchange.types.ts](src/modules/exchanges/exchange.types.ts), [exchange-responses.dto.ts](src/modules/exchanges/dto/exchange-responses.dto.ts), [integrity.ts](src/modules/exchanges/integrity.ts) |
| Persistencia y errores | [prisma-exchange.repository.ts](src/infrastructure/prisma/prisma-exchange.repository.ts), [http-exception.filter.ts](src/common/filters/http-exception.filter.ts) |
| Indicadores | [academic.repository.ts](src/modules/academic/academic.repository.ts), [reviews.service.ts](src/modules/academic/reviews.service.ts) |
| Pruebas PostgreSQL | [test-cancellations.cjs](scripts/test-cancellations.cjs), [test-postgres.cjs](scripts/test-postgres.cjs), [test-reservation-settlement.cjs](scripts/test-reservation-settlement.cjs) |
| Pruebas unitarias y E2E | [cancellation-policy.spec.ts](src/modules/exchanges/cancellation-policy.spec.ts), [exchanges-integrity.e2e-spec.ts](test/exchanges-integrity.e2e-spec.ts) |
| Documentación | Este README y [frontend-integration.md](docs/frontend-integration.md) |

Se conservaron los diez archivos modificados de 2A: cinco idénticos al inicio de
2B y cinco ampliados. Prisma, sus verificaciones de nueve importes decimales,
scripts de activación/ofertas/solicitudes y documentos mantienen la integración
2A. La validación de estas órdenes se realizó localmente, sin despliegue ni acceso
a Neon. Su publicación posterior reúne ambos cambios en
`feat/backend-cierre-parcial3`, para revisión mediante un PR en borrador hacia
`apis/integracion-parcial3`.

## Reproducir 2A y 2B desde un clon limpio

En `backend/`, usar Node `>=26.8.2 <27` y npm 11. Configurar en el entorno privado
`DATABASE_URL` y `TEST_DATABASE_URL` hacia un PostgreSQL local de pruebas cuyo
usuario tenga permiso CREATE DATABASE. El inicio rápido de este README explica
cómo preparar ese servidor y sus variables. No copiar `.local/`, dependencias,
archivos generados ni credenciales del clon de cierre.

```powershell
npm.cmd ci
npm.cmd run prisma:validate
npm.cmd run prisma:generate
npm.cmd run build
npm.cmd run lint
npm.cmd test
npm.cmd run test:e2e
npm.cmd run test:postgres
```

El script versionado `scripts/test-postgres.cjs` crea su propia base
`timebank_test_<16 hex>`, aplica dos veces las migraciones oficiales y ejecuta
los cinco verificadores versionados; finalmente elimina esa base. No requiere
ningún auxiliar ni evidencia de `.local/`. Los correos de esta prueba se capturan
dentro del proceso, sin SMTP externo. Unitarias y E2E usan su configuración de
pruebas en memoria. Los resultados de la copia limpia del commit publicado se
registran en la descripción del PR; no confundirlos con las evidencias locales
históricas indicadas arriba.

## Continuación académica — puntos 6 y 7 del plan (20/11/2026)

**Resultado de la revisión completa del 21/11:** todavía no se cumplen todos los
criterios. Pasan 261 unitarias y las 10 suites HTTP verificadas (188 casos, con
repeticiones de las suites corregidas), Prisma/build/lint. PostgreSQL, integración
académica y reglas económicas siguen pendientes. Ver la
[matriz de cumplimiento y evidencias](docs/verification-2026-11-21.md).

Rama **`feat/backend-academico-reputacion-parcial3`**, creada exactamente desde
`8fe275bc465b061e9df651dfc870ef293b3870f7` de `feat/backend-nucleo-transaccional-parcial3`.
Se admite Node **>=26.8.2 <27** (entorno actual **26.13.1**), npm **11** (actual **11.20.0**), NestJS **11.2.7**, TypeScript **5.9**,
Prisma **7.10.1**, PostgreSQL **16** y las dependencias del lockfile.

Esta continuación implementa el catálogo de 49 materias, prerrequisitos, Mi ruta,
opiniones, reputación descriptiva, resumen personal y consultas ADMIN para Command
Center y economía. El [contrato académico y diccionario KPI](docs/academic-integration.md)
detalla endpoints, filtros, privacidad, decisiones pendientes y validación real.

**Antes de usar el pensum persistido:** la ampliación de Prisma tiene su SQL en
[`prisma/proposals/academic-reputation.sql`](prisma/proposals/academic-reputation.sql).
Está preparada para revisión de BD, **fuera de las seis migraciones oficiales**.
`db:migrate` por sí solo todavía no la aplica. No ejecutar `db push`, no alterar
las migraciones anteriores ni aplicarla en una base compartida sin coordinación.
El catálogo anterior, las reservas y las opiniones funcionan sobre el esquema base;
Mi ruta e indicadores académicos responden **503** hasta integrar el esquema y su carga.
`schema.prisma` incluye el modelo propuesto; no interpretar esa presencia como una migración ejecutada.

Después de que BD apruebe e incorpore la propuesta como nueva migración, en una
base local aislada ya configurada según este README:

```powershell
npm.cmd run prisma:generate
npm.cmd run prisma:validate
npm.cmd run db:migrate
$env:LOCAL_DEVELOPMENT_SEED = 'true'
npm.cmd run db:seed:academic
Remove-Item Env:LOCAL_DEVELOPMENT_SEED
npm.cmd run build
```

La semilla requiere una única carrera activa «Ingeniería de Sistemas». Conserva
UUID, nombres, estados y categorías de habilidades existentes; genera códigos
mediante su relación con materias. Imprime el listado real de equivalencias.
Ante duplicados ambiguos revierte toda la carga para revisión, sin fusionar
historiales. MAT-030 no crea habilidad; LIBRE-I y LIBRE-II no se cargan.

Las opiniones exigen `Idempotency-Key`, solicitante autenticado y clase completada
después de su fin. Reutilizan `CALIFICACIONES` y la transacción existente, sin
mover créditos. Knowledge Score, bonos y cancelación injustificada siguen pendientes
del PO. No activar flags del frontend sin verificación conjunta.

**Validación de esta continuación:** ver el registro al final de
[academic-integration.md](docs/academic-integration.md). No se arrancó la API,
Docker ni PostgreSQL, ni se aplicaron migraciones durante la implementación.
Los resultados históricos de fases 1–6 que siguen abajo pertenecen al commit base
y no certifican estas funcionalidades nuevas. La tabla «Dónde continuar» describe
el estado heredado; para el estado de esta rama usar esta sección y su contrato.

## Inicio rápido para el equipo

### Actualización de historias de usuario — 21/11/2026

HU-05 añade `GET /tutoring/offers/:id`, filtros `skillId`, `codigo`, `tutorId`,
`excludeTutorId` y `PUT /tutoring/offers/:id` (mismo DTO completo que POST y
`Idempotency-Key`). Solo edita el tutor propietario; no cambia materia ni los
montos pactados anteriormente. No permite mover horarios con solicitudes activas
o reservas vinculadas. Se publica por UUID resuelto en GET /skills; un código
académico nunca reemplaza un UUID. El banner debe provenir de la carga propia.

HU-08 conserva motivo, actor, fecha, horas de anticipación y Liberacion atómica.
Misma clave reproduce la cancelación; una clave nueva sobre una reserva Cancelada
devuelve 409. Analytics distingue cancelaciones registradas de injustificadas.

**HU-06 y la clasificación/penalización de HU-08 dependen de la migración de BD**:
el documento no incluye fórmulas, factores, umbral ni importes. No se inventaron.
El flujo decimal y los snapshots heredados se conservan; la tarifa histórica no
se presenta como economía dinámica terminada. Ver el
[estado por historia y contrato pendiente](docs/sprint3-user-stories.md).
El nuevo reparto asigna opiniones a APIs y semilla oficial a BD; el trabajo
académico anterior se conserva como propuesta para coordinar su integración.

La entrega de las seis fases está en **`feat/backend-nucleo-transaccional-parcial3`**, repositorio `ignaciosanga/sis-226_timebank`. Crea tu trabajo académico desde esa rama. El [contrato de integración](docs/frontend-integration.md) describe cuerpos, permisos y códigos; el [cierre de fase 6](docs/fase6-cierre-integracion-demo.md) distingue lo comprobado de los pendientes de integración.

### 1. Descargar y crear tu rama

Desde la carpeta donde guardarás el proyecto, para un clon nuevo:

```powershell
git clone --branch feat/backend-nucleo-transaccional-parcial3 --single-branch https://github.com/ignaciosanga/sis-226_timebank.git
Set-Location sis-226_timebank
git switch -c feat/backend-academico-reputacion-parcial3 --no-track
Set-Location backend
```

Si ya tienes el repositorio, desde su raíz y con tu trabajo anterior guardado en su propia rama:

```powershell
git fetch origin
git switch -c feat/backend-academico-reputacion-parcial3 --no-track origin/feat/backend-nucleo-transaccional-parcial3
Set-Location backend
```

Si esa rama académica ya existe, usa `git switch feat/backend-academico-reputacion-parcial3` y revisa su historia antes de integrar novedades. No necesitas cambiar `main` ni `Backend`. Todos los comandos siguientes se ejecutan **dentro de `backend/`**, en PowerShell, salvo la segunda terminal indicada.

### 2. Requisitos reales

- Git y Docker Desktop con motor Linux y Docker Compose v2.
- **Node.js >=26.8.2 <27** y **npm >=11 <12**. La base se comprobó con Node 26.8.2/npm 11.19.1; esta continuación usa Node 26.13.1/npm 11.20.0. `package.json` y lockfile mantienen el mismo rango; Docker conserva su imagen fijada en 26.8.2.
- `npm ci` instala las versiones del lockfile: NestJS **11.2.7**, TypeScript **5.9.3**, Prisma/cliente/adaptador **7.10.1** y Nodemailer **10.6.1**. No instales Prisma globalmente.
- Compose usa PostgreSQL **16.15-alpine**; el correo local opcional usa Mailpit **v1.27.8**. El Dockerfile usa `node:26.8.2-bookworm-slim`.

Comprueba `node --version`, `npm.cmd --version` y `docker compose version`. El inicio rápido usa API **4200**, PostgreSQL **55440**, Mailpit **4204** y SMTP **11260**, separados de la defensa de Gonzalo (**4103/4104/4105**, PostgreSQL 55434 y SMTP 11026). Los valores predeterminados de [Compose](compose.yaml) son API 4000 y PostgreSQL 55432; los siguientes pasos los cambian para este montaje.

### 3. Preparar un entorno local propio

```powershell
npm.cmd ci
npm.cmd run setup:env
```

`npm ci` también genera Prisma Client mediante `postinstall`. `setup:env` crea `backend/.env` desde [su plantilla](.env.example), con JWT aleatorio, y conserva un archivo existente. El archivo `.env` es privado y no se publica.

Para el **`.env` nuevo** del inicio rápido, asigna estos valores públicos; las claves siguen generándose localmente:

```powershell
$teamSettings = @{
  PORT = '4200'
  BACKEND_PORT = '4200'
  POSTGRES_PORT = '55440'
  PUBLIC_API_URL = 'http://127.0.0.1:4200'
  SMTP_PORT = '11260'
  MAILPIT_HTTP_PORT = '4204'
  MAILPIT_SMTP_PORT = '11260'
}
$teamEnv = Get-Content -LiteralPath .env -Raw
foreach ($teamKey in $teamSettings.Keys) {
  if ($teamEnv -match "(?m)^$teamKey=") {
    $teamEnv = $teamEnv -replace "(?m)^$teamKey=.*$", "$teamKey=$($teamSettings[$teamKey])"
  } else {
    $teamEnv = $teamEnv.TrimEnd() + "`n$teamKey=$($teamSettings[$teamKey])`n"
  }
}
[IO.File]::WriteAllText((Join-Path (Get-Location).Path '.env'), $teamEnv, [Text.UTF8Encoding]::new($false))
npm.cmd run setup:docker
```

`setup:docker` genera `POSTGRES_PASSWORD` y configura la conexión local si `DATABASE_URL` estaba vacía. En una configuración existente conserva la URL y los secretos: revisa su destino antes de migrar; no apuntes estos pasos a una base compartida o de defensa. Si eliges otros puertos, ajusta las mismas variables antes de generar la conexión. Para Node contra PostgreSQL deben quedar `PERSISTENCE_MODE=prisma`, `DATABASE_ENABLED=true`, `NODE_ENV=development` y una URL hacia tu instancia.

Los comandos Compose incluyen `--env-file .env -f compose.yaml` para usar los archivos de **`backend/`**, aunque el repositorio también tenga Compose y plantilla en su raíz. El proyecto `nexo-u-equipo` crea su propio volumen; no utiliza el de defensa.

### 4. Iniciar PostgreSQL, migrar e iniciar la API

```powershell
docker compose --env-file .env -f compose.yaml -p nexo-u-equipo up -d --wait postgres
npm.cmd run prisma:generate
npm.cmd run prisma:validate
npm.cmd run db:migrate
$env:LOCAL_DEVELOPMENT_SEED = 'true'
npm.cmd run db:seed:local
Remove-Item Env:LOCAL_DEVELOPMENT_SEED
npm.cmd run build
npm.cmd start
```

`db:migrate` ejecuta `prisma migrate deploy`: aplica las **nueve migraciones oficiales**, sin reset, incluida la conversión decimal, la ampliación académica y el perfil del asistente. La semilla local idempotente añade una carrera, categorías y habilidades; no añade usuarios ni saldos. Para cargar el pensum, ejecutar además `npm.cmd run db:seed:academic` con `LOCAL_DEVELOPMENT_SEED=true`. Conserva el volumen al reiniciar.

Con la API activa, abre otra terminal en `backend/`:

```powershell
Invoke-RestMethod http://127.0.0.1:4200/health/ready
Start-Process http://127.0.0.1:4200/docs
```

Readiness debe indicar `persistence: "postgresql"`; también están `/health`, `/docs-json` y [Swagger en 4200](http://127.0.0.1:4200/docs). Readiness comprueba conexión y tablas; el conjunto de migraciones y los controles del adaptador determinan la capacidad decimal.

### 5. Registro real por correo (opcional para el auxiliar académico)

Para probar registro desde Swagger, inicia [Mailpit](compose.mailpit.yaml):

```powershell
docker compose --env-file .env -f compose.mailpit.yaml -p nexo-u-equipo-mail up -d
```

Configura estas líneas en **tu `.env`**, conserva los secretos generados y reinicia `npm.cmd start`:

```dotenv
MAIL_TRANSPORT=smtp
SMTP_HOST=127.0.0.1
SMTP_PORT=11260
SMTP_SECURE=false
SMTP_REQUIRE_TLS=false
PUBLIC_API_URL=http://127.0.0.1:4200
```

Abre [el buzón local 4204](http://127.0.0.1:4204). Usa un UUID activo de `GET /careers` para `POST /auth/register`, correo `@ucb.edu.bo`, contraseña propia de 12–128 caracteres y semestre 1–12. El alta devuelve `Pendiente`, saldo cero y `verification_required: true`, sin sesión. Abre el correo y pulsa **Confirmar mi correo**; después inicia sesión. Con transporte deshabilitado el registro responde 503 antes de persistir la cuenta. `POST /auth/resend-verification` permite recuperar un envío fallido.

El bono se decide una sola vez al activar; `REGISTRATION_INITIAL_CREDITS=8` es la propuesta configurable pendiente del PO, y `0` también está soportado. Repetir enlace o login no abona otra vez. Google requiere configuración y cuenta institucional verificadas del proveedor; no es necesario para este inicio rápido.

### 6. Preparar dos usuarios y una clase Completada

El camino corto para empezar la parte académica es el auxiliar versionado [scripts/prepare-academic-demo.cjs](scripts/prepare-academic-demo.cjs). Utiliza tu misma base local **persistente**, ya migrada y sembrada; requiere las dependencias completas de `npm ci`, `build` y el permiso explícito de desarrollo:

```powershell
$env:LOCAL_DEVELOPMENT_SEED = 'true'
npm.cmd run demo:academic
Remove-Item Env:LOCAL_DEVELOPMENT_SEED
```

No requiere una API escuchando ni SMTP: abre una instancia Nest temporal sin puerto y captura el correo solo dentro de ese proceso. Ejecuta registro y verificación HTTP reales para dos cuentas propias; el tutor se activa con bono 0 y el solicitante con 3. Usa una habilidad/materia de la semilla y el flujo histórico **sin oferta**, duración 45 minutos y coste entero **`"3"`**. Ejecuta solicitud, aceptación/retención y ambas confirmaciones, con pago único. Para no esperar una clase real, desplaza exclusivamente el intervalo de sus filas nuevas a una hora pasada bajo el bloqueo transaccional; no cambia el reloj de la API ni modifica reservas ajenas.

El resultado queda **Completada** en tu PostgreSQL, con estudiante saldo 0/retenido 0, tutor saldo 3 y Retencion/Consumo/Transferencia. El auxiliar muestra la ruta de un archivo privado generado en `.local/academic-demo/<UUID>.private.json`, con los UUID y credenciales de ese caso. Usa sus cuentas en `/auth/login` y consulta `GET /reservations/{id}` o `/reservations/me`. Repetir el comando crea otro caso y conserva los anteriores. Sus credenciales son locales; no las incluyas en commits.

Este auxiliar no altera el bono de la API principal ni crea un ADMIN. Permite desarrollar calificaciones/reputación mientras BD entrega decimales. Los UUID y archivos privados de la defensa de Gonzalo **no son requisitos**. La prueba `test:postgres` es distinta: crea una base temporal y la elimina al terminar; no sirve para conservar tus datos de trabajo.

### 7. Empezar el frente académico y reputación

El **solicitante aprende**, el **ofertante enseña** y `RESERVAS` enlaza ambos con `HABILIDADES`, usada hoy como materia/habilidad. Una reserva `Completada` aporta participantes, materia y evidencia de clase realizada. `Profesor` no es un requisito para enseñar: una cuenta `Estudiante` puede ofrecer y aprender.

| Frente                   | Carpetas y entidades para empezar                                                                                                               | HTTP disponible y trabajo pendiente                                                                                                                                                                                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Catálogo y pensum        | `src/modules/careers`, `categories`, `skills`, `user-skills`; `Carrera`, `Categoria`, `Habilidad`, `UsuarioHabilidad` en `prisma/schema.prisma` | Existen `GET /careers`, `/categories`, `/skills`, `/skills/{id}/providers` y `/users/{id}/skills`, con administración y perfil según permisos. No existe un módulo/endpoint de pensum; acordar con BD la relación carrera–materia, plan, prerrequisitos y sus contratos.          |
| Calificaciones/opiniones | `Calificacion` y sus relaciones en `prisma/schema.prisma`; `src/modules/reservations` para validar participantes y estado                       | Existe la tabla `CALIFICACIONES`, puntuación y unicidad por reserva/evaluador; faltan controlador/servicio y endpoints. Frontend espera `/tutoring/reviews`, `/tutoring/reviews/me` y `POST /tutoring/reservations/{id}/review`: acordarlos e implementarlos, no existen todavía. |
| Mis clases               | `src/modules/reservations`, `exchanges`; `Reserva`, `SolicitudIntercambio`, `Usuario`, `Habilidad`                                              | Existen `GET /reservations/me`, `/reservations/{id}`, `/exchanges/me`, confirmación y cancelación. Consumirlas por el actor autenticado; distinguir enseñanza/aprendizaje y marcas individuales.                                                                                  |
| Reputación               | `Calificacion`, `src/modules/tutoring/offer-metrics.ts`, `offer-metrics.spec.ts`, adaptadores de `src/infrastructure/prisma`                    | La consulta de ofertas incluye métricas derivadas de calificaciones existentes. Falta el flujo de escritura/consulta de opiniones y su integración, permisos por clase completada y prueba conjunta. No crear pagos ni cambiar saldos al calificar.                               |
| Analytics                | `src/modules/analytics`, `docs/dashboard-integration.md`; reservas, movimientos y usuarios                                                      | Existen `GET /analytics/overview`, `/users`, `/exchanges`, `/credits`, `/skills` bajo `/analytics`, solo ADMIN y PostgreSQL. Integrar agregados con períodos y cantidades exactas; en memoria responden 503.                                                                      |

**Primera tarea sugerida:** con la reserva Completada del auxiliar, implementar la elegibilidad para calificar: actor participante, contraparte correcta, estado completado y una calificación por evaluador/reserva. Acordar el DTO y rutas con Frontend/APIs antes de añadir el controlador; reutilizar las restricciones existentes.

### 8. Qué funciona con las migraciones oficiales y qué falta

Funcionan cuentas institucionales/verificación/bono, sesión y permisos actuales, catálogos/perfil, disponibilidad, ofertas, intercambios históricos y contratación con precio total decimal. `costoCreditos: "3.7"` es una **cadena**: se copia a solicitud y reserva, se retiene al aceptar y se liquida después del fin con ambas confirmaciones. Cambiar el precio del catálogo no cambia el pacto anterior.

Las nueve columnas de crédito son **NUMERIC sin typmod**, representadas por `Decimal @db.Decimal` en Prisma. Los CHECK SQL admiten una décima y conservan la cota técnica de `2147483647`; no redondean centésimas. `SOLICITUDES_INTERCAMBIO.id_oferta` es UUID nullable, con FK `ON DELETE RESTRICT / ON UPDATE NO ACTION`. Las solicitudes históricas conservan `id_oferta: null` y su cálculo de un crédito cada 15 minutos; 45 minutos cuestan `"3"`. Los esquemas antiguos todavía INTEGER mantienen los códigos de capacidad pendientes hasta aplicar la migración oficial.

El recorrido decimal se comprobó localmente con PostgreSQL 16: alumno `"10"`, retención `"3.7"`, disponible `"6.3"`, primera confirmación sin pago y segunda confirmación con saldo alumno `"6.3"` y tutor `"3.7"`. Una reserva independiente cancelada libera exactamente `"3.7"`. **El precio de una oferta no se deriva de sus minutos.** La actualización poblada conserva saldo `"10"`, UUID e historial. El [SQL provisional](scripts/fixtures/phase4-decimal-provisional.sql) se conserva como referencia histórica y no se aplica sobre las migraciones oficiales. Tampoco debe ejecutarse la conversión INTEGER por diez de la otra representación de BD.

Para reproducir la integración, usa `npm.cmd run test:postgres` con el servidor local de pruebas descrito abajo. El script crea una base temporal, aplica dos veces las migraciones oficiales y ejecuta activación/bono único, ofertas, [solicitudes](scripts/test-offer-requests.cjs) y [liquidación](scripts/test-reservation-settlement.cjs), con dos instancias, concurrencia, rollback y replay tras reiniciar. Contrasta los nueve importes como Decimal en Prisma y texto exacto en SQL/HTTP, incluida la relación de oferta. Al terminar elimina únicamente esa base temporal.

Pendientes para integración general:

- **HU-08 / Alan y BD:** resolver el disponible antes/después de liberar cuando cambia la posibilidad de cobrar; coordinar un solo mecanismo de cobro antes de desplegar. Ver la orden 2B al inicio. No se generan deudas.
- **HU-06 / Frontend y BD:** acordar precio sugerido u obligatorio, factores y vigencia. Se conserva el precio publicado y pactado. El almacenamiento durable de banners (#47) se tratará por separado.
- **Frontend:** preservar cadenas exactas y `code` de error, enviar disponibilidad/intervalo completos de la oferta, mantener claves de idempotencia al reintentar y manejar cuenta pendiente/verificación. El contrato auditado y sus archivos están en fase 6.
- **APIs/académico:** implementar opiniones/calificaciones y reputación acordadas con Frontend; la existencia de su tabla no demuestra endpoints funcionales.
- **Integración visual:** probar conjuntamente la UI correcta contra el backend acordado; Google real y Calendar remoto requieren configuración propia. Mantener **`VITE_TUTORING_API_ENABLED=false`** mientras la bandera compartida dependa de contratos todavía pendientes. Esa variable es del entorno de Frontend, no habilita capacidades en Nest.

## Estructura y persistencia

Backend NestJS para tutorías y habilidades mediante créditos. Parte del [modelo optimizado de 12 tablas](documentaci_n_de_la_base_de_datos.md), ampliado con autenticación, ofertas y banners. Este inventario no declara equivalencia con modelos históricos de 13 o 18 tablas de BD.

- `src/modules`: controladores, DTO, servicios y contratos por dominio.
- `src/infrastructure/prisma`: persistencia PostgreSQL; repositorios de memoria para datos efímeros.
- `src/common` y `src/config`: permisos, validación, errores, protección de campos, CORS y entorno.
- `prisma/schema.prisma`, `prisma/migrations`: esquema y nueve migraciones oficiales.
- `scripts`: instalación local, semilla, auxiliar académico y pruebas PostgreSQL.

USUARIOS integra rol, saldo y retenidos. RESERVAS integra confirmaciones y cancelación. MOVIMIENTOS_CREDITO guarda cantidades y snapshots; no hay tablas separadas de cuentas o transferencias. Roles persistidos: Estudiante, Profesor y Administrador; `roles` en JWT/perfil proyecta capacidades y no representa una relación M:N. Niveles de habilidad: Basico, Intermedio, Avanzado y Experto.

El adaptador usa transacciones y bloqueo asesor compartido entre instancias; idempotencia y metadatos se guardan en AUDITORIA en el mismo commit. Escritores externos deben respetar el protocolo. La memoria usa un borrador y commit único. Producción rechaza memoria. Los controles de concurrencia, rollback, cobro único y reapertura están en las pruebas oficiales y los reportes de fases 1–6.

## API, créditos y reintentos

El frontend recibe una URL HTTP, por ejemplo `VITE_API_URL=http://127.0.0.1:4200`; nunca `DATABASE_URL`, contraseña PostgreSQL ni JWT_SECRET. Configura `CORS_ORIGINS` con el origen real de la UI. El acceso protegido usa `Authorization: Bearer <access_token>`. No hay refresh token: iniciar sesión al vencer. `SWAGGER_ENABLED=false` deshabilita `/docs` y `/docs-json`.

Los importes HTTP son texto exacto, incluyendo enteros `"8"`. El dominio de créditos usa aritmética entera escalada y el ledger oficial NUMERIC admite una décima, sin flotantes binarios. El adaptador normaliza los créditos antes de clonar el estado; los objetos `Prisma.Decimal` no forman parte del contrato HTTP. No convertir cantidades a `Number` para sumar, restar o pagar.

POST de `/exchanges`, sus acciones, confirmación/cancelación de `/reservations`, `/credits/grants` y publicación de ofertas requieren `Idempotency-Key` de 16–128 caracteres alfanuméricos o `. _ : -`. Conservar la clave para la misma acción/contenido; una clave reutilizada con contenido diferente devuelve 409. El ámbito incluye actor y operación. El estado de negocio evita efectos nuevos aunque se use otra clave. Una respuesta perdida se recupera repitiendo la clave; GET consulta el estado actual.

Registro público crea Estudiante. ADMIN dispone de `GET /admin/users`, `POST /admin/users` y `PATCH /admin/users/{id}/status`, con permisos y auditoría. Las bajas lógicas conservan historia y saldos y rechazan los casos con reservas/retenciones pendientes, el propio ADMIN o el último ADMIN activo. El alta ADMIN también exige confirmar correo. Las rutas y ejemplos están en [integración](docs/frontend-integration.md).

Para crear un ADMIN propio con SMTP ya configurado, desde `backend/`:

```powershell
npm.cmd run admin:local -- admin@ucb.edu.bo
```

Muestra una contraseña aleatoria local, conserva cuentas existentes y crea la nueva pendiente; confirma el correo antes del login. Las cargas de créditos para desarrollo usan `POST /credits/grants`, permiso ADMIN, clave idempotente y cuerpo `{ "userId": "UUID", "amount": "8", "reason": "Prueba local" }`.

## Alternativa: ejecutar también la API en Docker

Con el `.env` local preparado, el Compose oficial puede levantar PostgreSQL, `db-init` y backend:

```powershell
docker compose --env-file .env -f compose.yaml -p nexo-u-equipo up --build -d --wait --wait-timeout 180
```

Detén primero la API Node si ocupa 4200. `db-init` aplica migraciones y semilla; el backend usa el puerto interno 4000 y Compose lo publica según `BACKEND_PORT`. Dentro de Docker la BD es `postgres:5432`. Para correo de esa API, configura `SMTP_HOST=host.docker.internal` y el puerto SMTP publicado de Mailpit, conserva `PUBLIC_API_URL=http://127.0.0.1:4200` y reinicia el contenedor backend. `localhost` desde un contenedor apunta a ese mismo contenedor.

Para detener este proyecto conservando su volumen:

```powershell
docker compose --env-file .env -f compose.yaml -p nexo-u-equipo down
```

No añadas `--volumes` si necesitas conservar datos. Los proyectos/volúmenes independientes evitan tocar la defensa u otros clones. La alternativa en memoria (`PERSISTENCE_MODE=memory`, `DATABASE_ENABLED=false`) pierde los datos al cerrar y no ofrece Analytics PostgreSQL.

## Pruebas y diagnóstico

Desde `backend/`, con dependencias y Prisma Client instalados:

```powershell
npm.cmd run prisma:validate
npm.cmd run build
npm.cmd run lint
npm.cmd test
npm.cmd run test:e2e
npm.cmd run test:postgres
```

Unitarias y E2E fijan memoria y deshabilitan BD; simulan el proveedor Google y capturan el correo donde corresponde. `test:postgres` necesita un servidor local con permiso **CREATE DATABASE**. Con la URL generada hacia `127.0.0.1:55440/timebank_local` usa tu servidor del inicio rápido; para otro servidor de pruebas, configura `TEST_DATABASE_URL` explícitamente en tu entorno privado. Crea `timebank_test_<16 hex>`, aplica migraciones/semilla, ejecuta dos instancias y elimina esa base al terminar. No reconstruye `timebank_local` ni genera un fixture persistente para trabajar. Ejecuta E2E y PostgreSQL secuencialmente para no competir por CPU durante los hashes de contraseña.

La fase 6 registró **253/253 unitarias (25 suites)**, **182/182 E2E (9 suites)**, PostgreSQL oficial, validación Prisma, build y lint aprobados. SMTP real se probó con Mailpit y el proveedor Google se simuló; no se declara login Google remoto ni una prueba visual de navegador. El [reporte de fase 6](docs/fase6-cierre-integracion-demo.md) conserva la evidencia del montaje de defensa y sus límites. Las instrucciones del inicio rápido y el auxiliar académico se verifican además desde una copia limpia para esta publicación.

`npm.cmd run format:check` existe como revisión adicional de formato. La estabilización histórica detectó archivos con formato previo pendiente; no se realizó una reformateación global. No confundir ese resultado histórico con los checks funcionales de las seis fases.

Si npm devuelve `UNABLE_TO_VERIFY_LEAF_SIGNATURE` y tu CA de confianza está instalada en Windows, configura en esa terminal `$env:NODE_OPTIONS = "$env:NODE_OPTIONS --use-system-ca".Trim()` y repite `npm.cmd ci`. Conserva la verificación TLS. Si faltan `tsc`, Prisma, ESLint, Jest o `dotenv`, termina primero `npm ci`. El lockfile incluye las correcciones previas de tarballs de `media-typer`, `dynamic-dedupe`, `@tokenizer/token` y `@sinonjs/fake-timers`; no requiere `--force`, overrides ni vaciar la caché.

Si Docker informa `dockerDesktopLinuxEngine`, abre Docker Desktop y espera al motor Linux/WSL2. Si un puerto está ocupado, cambia los valores públicos de tu entorno y la URL local antes del arranque; no detengas un proyecto ajeno. Verifica el destino de la base antes de cualquier migración. En una base incompatible de otro modelo, acuerda el plan con BD en lugar de aplicar estos scripts encima.

## Documentación de la entrega

- [Integración Frontend: cuerpos, códigos, sesión, ofertas y reservas](docs/frontend-integration.md).
- [Integración Dashboard y Analytics](docs/dashboard-integration.md).
- [Fase 1: núcleo transaccional](docs/fase1-nucleo-transaccional-parcial3.md).
- [Fase 2: cuentas institucionales](docs/fase2-cuentas-institucionales.md).
- [Fase 3: ofertas](docs/fase3-ofertas-tutoria.md).
- [Fase 4: solicitudes y reservas](docs/fase4-solicitudes-reservas.md).
- [Fase 5: confirmación y liquidación](docs/fase5-confirmacion-liquidacion.md).
- [Fase 6: cierre, contratos entre equipos y defensa local](docs/fase6-cierre-integracion-demo.md).
- [Fuente optimizada de BD](documentaci_n_de_la_base_de_datos.md) y [diferencias de fuentes](docs/schema-source-discrepancies.md).
- Reportes históricos: [PostgreSQL/Docker](docs/progress-postgresql-docker.md), [v0.4](docs/progress-v0.4.md), [v0.3](docs/progress-v0.3.md), [v0.2](docs/progress-v0.2.md) y [contrato anterior](docs/api-contract.md). Para el estado actual, usar Swagger, la guía de integración y las fases 1–6.
