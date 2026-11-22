# Banco de Tiempo Universitario — Backend

## Entrega de Kevin: académico y economía SkillSwap v4 (22/11/2026)

Continuación de `feat/backend-nucleo-transaccional-parcial3` desde `8fe275b`. Incluye las tareas A01–A10 de los puntos 6 y 7 del plan: 49 materias, prerrequisitos, Mi ruta, opiniones, reputación e indicadores. Añade detalle/edición de ofertas y la integración HU-06/HU-08 con la entrega real BD v4: precios dinámicos, créditos en décimas, cancelación tardía, deudas y cobro automático.

**Arranque con la BD Docker recibida:** seguir [Integración SkillSwap v4](docs/skillswap-v4-integration.md). Preparar con `npm.cmd run db:prepare:skillswap` y después ejecutar la API con `npm.cmd start`. La guía explica conexión, claves, permisos y banderas necesarias. **El Compose y db:init heredados corresponden al esquema anterior y no deben ejecutarse sobre la BD v4.** No se usan los secretos del ZIP ni se borran volúmenes.

Node **>=26.8.2 <27** (verificado 26.13.1), npm 11.20.0, NestJS 11.2.7, TypeScript 5.9, Prisma 7.10.1 y PostgreSQL 16.15. Dependencias conservadas. La configuración y deudas de BD se incluyen en el mismo schema.prisma; los triggers/vistas se instalan mediante el puente SQL, sin reescribir las seis migraciones previas.

- [Informe del aporte de Kevin](docs/informe-kevin-parcial3.md).
- [Verificación del 22/11](docs/verification-2026-11-22.md).
- [Contrato académico y KPI](docs/academic-integration.md).
- [Arquitectura actual](docs/architecture.md).

La API y PostgreSQL aislado están verificados según el registro. No equivale a despliegue de Neon ni a validación de pantallas/flags del frontend. La incorporación al historial Prisma compartido sigue a cargo de BD/APIs. Se conserva abajo la documentación histórica del núcleo para el esquema legado; sus pendientes económicos del 21/11 quedan sustituidos por la guía v4.

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

`db:migrate` ejecuta `prisma migrate deploy`: aplica las **seis migraciones oficiales**, sin reset. La semilla idempotente añade una carrera, categorías y habilidades; no añade usuarios ni saldos. Quedan **15 tablas de negocio** (las 12 originales, verificación, ofertas y banners), además de `_prisma_migrations`. Conserva el volumen al reiniciar.

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

Funcionan cuentas institucionales/verificación/bono, sesión y permisos actuales, catálogos/perfil, disponibilidad, publicación/consulta de ofertas y banners, intercambios históricos, retención, cancelación y doble confirmación/pago entero. Las ofertas ya guardan precio total decimal y aceptan `costoCreditos: "3.7"` como **cadena**; publicar no prueba que el ledger oficial pueda contratarla.

Las **nueve columnas de crédito siguen INTEGER** en las migraciones y Prisma oficiales. Al solicitar una disponibilidad ligada a oferta, el backend devuelve **409 `OFFER_PRICE_FLOW_PENDING`** sobre ese esquema, sin crear solicitud ni retención. No evadas el control calculando un precio desde Frontend ni enviando una disponibilidad parcial. El flujo histórico sin oferta mantiene **1 crédito = 15 minutos**, con duración múltiplo de 15 minutos hasta ocho horas; una clase histórica de 45 minutos cuesta `"3"`.

El recorrido decimal se comprobó en PostgreSQL aislado: precio total `"3.7"`, snapshot en solicitud/reserva, retención al aceptar, primera marca sin pago, segunda confirmación después del fin con Consumo/Transferencia únicos, replay/reinicio y cancelación con liberación. **No se deriva ese precio de los minutos.** El [SQL provisional](scripts/fixtures/phase4-decimal-provisional.sql) permanece fuera de `prisma/migrations`; solo admite `nexo_u_phase4_ensayo` y bases `timebank_test_<16 hex>`. No está autorizado para la base del inicio rápido ni reemplaza una migración oficial.

Para reproducir automáticamente ese ensayo desde el repositorio, usa `npm.cmd run test:postgres` con el servidor local de pruebas descrito abajo. El script aplica primero las seis migraciones y verifica INTEGER; después aplica el SQL provisional exclusivamente a su base temporal y ejecuta [solicitudes de ofertas](scripts/test-offer-requests.cjs) y [liquidación](scripts/test-reservation-settlement.cjs), con concurrencia, rollback y replay. Al terminar borra esa base, incluidos los datos decimales. El montaje persistente 4105 y sus preparadores privados pertenecen a la PC de Gonzalo; no forman parte del inicio rápido portable.

Pendientes para integración general:

- **BD + Backend:** migración incremental decimal de los nueve campos y `SOLICITUDES_INTERCAMBIO.id_oferta`, adaptación de vistas/funciones y conservación de UUID/historial/permisos; coordinar los nueve `Int` a `Decimal` y la relación de oferta en Prisma. Probar instalación limpia y actualización de una copia poblada. PO debe acordar precisión definitiva, máximo de negocio y bono.
- **Frontend:** preservar cadenas exactas y `code` de error, enviar disponibilidad/intervalo completos de la oferta, mantener claves de idempotencia al reintentar y manejar cuenta pendiente/verificación. El contrato auditado y sus archivos están en fase 6.
- **APIs/académico:** implementar opiniones/calificaciones y reputación acordadas con Frontend; la existencia de su tabla no demuestra endpoints funcionales.
- **Integración visual:** probar conjuntamente la UI correcta contra el backend acordado; Google real y Calendar remoto requieren configuración propia. Mantener **`VITE_TUTORING_API_ENABLED=false`** mientras la bandera compartida dependa de contratos todavía pendientes. Esa variable es del entorno de Frontend, no habilita capacidades en Nest.

## Estructura y persistencia

Backend NestJS para tutorías y habilidades mediante créditos. Parte del [modelo optimizado de 12 tablas](documentaci_n_de_la_base_de_datos.md), ampliado con autenticación, ofertas y banners. Este inventario no declara equivalencia con modelos históricos de 13 o 18 tablas de BD.

- `src/modules`: controladores, DTO, servicios y contratos por dominio.
- `src/infrastructure/prisma`: persistencia PostgreSQL; repositorios de memoria para datos efímeros.
- `src/common` y `src/config`: permisos, validación, errores, protección de campos, CORS y entorno.
- `prisma/schema.prisma`, `prisma/migrations`: esquema y seis migraciones oficiales.
- `scripts`: instalación local, semilla, auxiliar académico y pruebas PostgreSQL.

USUARIOS integra rol, saldo y retenidos. RESERVAS integra confirmaciones y cancelación. MOVIMIENTOS_CREDITO guarda cantidades y snapshots; no hay tablas separadas de cuentas o transferencias. Roles persistidos: Estudiante, Profesor y Administrador; `roles` en JWT/perfil proyecta capacidades y no representa una relación M:N. Niveles de habilidad: Basico, Intermedio, Avanzado y Experto.

El adaptador usa transacciones y bloqueo asesor compartido entre instancias; idempotencia y metadatos se guardan en AUDITORIA en el mismo commit. Escritores externos deben respetar el protocolo. La memoria usa un borrador y commit único. Producción rechaza memoria. Los controles de concurrencia, rollback, cobro único y reapertura están en las pruebas oficiales y los reportes de fases 1–6.

## API, créditos y reintentos

El frontend recibe una URL HTTP, por ejemplo `VITE_API_URL=http://127.0.0.1:4200`; nunca `DATABASE_URL`, contraseña PostgreSQL ni JWT_SECRET. Configura `CORS_ORIGINS` con el origen real de la UI. El acceso protegido usa `Authorization: Bearer <access_token>`. No hay refresh token: iniciar sesión al vencer. `SWAGGER_ENABLED=false` deshabilita `/docs` y `/docs-json`.

Los importes HTTP son texto exacto, incluyendo enteros `"8"`. El dominio de créditos usa aritmética entera escalada; el ledger decimal de ensayo admite una décima, sin flotantes binarios. Las nueve columnas oficiales permanecen INTEGER; `OFERTAS.costo_creditos` tiene su representación propia. No convertir cantidades a `Number` para sumar, restar o pagar.

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
