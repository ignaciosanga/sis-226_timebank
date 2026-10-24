# Banco de Tiempo Universitario — Backend v0.4.0

Backend NestJS para intercambiar tutorías y habilidades entre estudiantes mediante créditos de tiempo. Implementa el **modelo optimizado de 12 tablas** definido en [la documentación local de BD](documentaci_n_de_la_base_de_datos.md). Su compatibilidad con `BancoTiempo_DB_v0.4` de 13 tablas está pendiente de comparación con el equipo BD; no se presupone que sean 12 tablas más una técnica.

## Estado y organización de esta entrega

Revisión inicial estática del 22 de octubre de 2026 sobre la rama `Backend`, commit base `a628817`, inicialmente sin cambios locales. Solo existe la referencia remota local `origin/Backend`; no están disponibles `equipo/BD` ni `equipo/frontend`. Esa primera revisión no ejecutó instalaciones ni verificaciones. La estabilización posterior con Node 26.8.2 se registra al final de este README. La integración entre equipos no está verificada en ejecución.

- `src/modules`: controladores HTTP, DTO, servicios y contratos de repositorio por dominio.
- `src/infrastructure/prisma`: adaptadores PostgreSQL; los repositorios de memoria permiten desarrollo efímero.
- `src/common` y `src/config`: permisos, validación, errores, protección de campos, CORS y entorno.
- `prisma/schema.prisma` y `prisma/migrations`: contrato persistente y migraciones versionadas.
- `docs/frontend-integration.md`: contrato de consumo HTTP. Los reportes de avances describen entregas anteriores.

Tecnologías: NestJS 11, TypeScript, Prisma 7, PostgreSQL 16, JWT, Swagger y Docker Compose. Se conserva la implementación existente de autenticación, catálogos, disponibilidad, intercambios y créditos; la lectura estática no sustituye una comprobación de funcionamiento.

## Levantar con Docker Desktop

Requisitos: Docker Desktop con motor Linux activo, **Node.js 26.8.2 y npm 11.19.1** (rango admitido npm 11). `package.json` y el lockfile fijan Node 26.8.2; Docker usa `node:26.8.2-bookworm-slim`, etiqueta exacta confirmada en Docker Hub. La etiqueta fija la versión Node, no un digest inmutable ni la versión exacta de npm incluida en la imagen.

Prisma se conserva en 7.10.1, junto con NestJS 11 y TypeScript 5.9. Su rango `engines` registrado admite `>=24.0`, pero la [documentación oficial de Prisma 7](https://www.prisma.io/docs/orm/v7/reference/system-requirements) consultada enumera Node 20/22/24 y prioriza versiones LTS. No se afirma soporte oficial de Node 26 ni compatibilidad de producción únicamente por ese rango. Se mantiene CommonJS y `@types/node` 24, sin introducir APIs exclusivas de Node 26.

Los siguientes comandos son instrucciones para una ejecución posterior, no pasos realizados en esta revisión. El arranque completo ejecuta migraciones y una semilla: usar únicamente una instancia local destinada al modelo de 12 tablas, después de resolver cualquier esquema previo incompatible. No aplicar sobre una BD compartida o el modelo de 13/18 tablas sin un plan acordado con BD.

```powershell
npm.cmd ci
npm.cmd run setup:docker
docker compose up --build -d
```

`setup:docker` genera claves locales y conserva secretos existentes. Compose levanta PostgreSQL 16.15, aplica las migraciones de las **12 tablas de negocio**, carga una carrera, cuatro categorías y cinco habilidades de desarrollo e inicia el backend en modo **prisma**. `db-init` termina con código 0; PostgreSQL y backend quedan activos en Docker Desktop. Prisma añade su tabla técnica `_prisma_migrations`.

La BD usa `127.0.0.1:55432`, base `timebank_local`, con usuario y clave de `.env`. Dentro de Docker se usa `postgres:5432`. Los datos persisten en `timebank_postgres_data`; `docker compose down` los conserva. Eliminar el volumen borra los datos. No se ejecutan los scripts legados de 18 tablas.

Si la instancia anterior en memoria ocupa 4000, detenerla antes de levantar Compose o definir `BACKEND_PORT=4001` en `.env` y usar esa URL para la API. `POSTGRES_PORT` permite cambiar el puerto publicado de la BD.

- Health: http://localhost:4000/health
- Conexión y tablas: http://localhost:4000/health/ready
- Swagger: http://localhost:4000/docs
- OpenAPI: http://localhost:4000/docs-json

Crear un ADMIN persistente local con contraseña aleatoria:

```powershell
docker compose exec backend node scripts/create-dev-admin.cjs admin@example.test
```

El comando muestra la clave y no modifica usuarios existentes. Autenticar con `POST /auth/login`. No hay cuentas predefinidas. Esta utilidad y las cargas de créditos son exclusivas de desarrollo.

Para trabajar en Node contra la BD de Compose: levantar solo `postgres`, ejecutar `npm.cmd run db:migrate`, activar `LOCAL_DEVELOPMENT_SEED=true` para ejecutar `npm.cmd run db:seed:local`, compilar y ejecutar `npm.cmd start`. `setup:docker` configura la URL local cuando no había otra. Revisar `.env` si ya existía una conexión distinta. Detener el backend de Docker antes de usar su mismo puerto en Node. Memoria sigue disponible con `PERSISTENCE_MODE=memory` y `DATABASE_ENABLED=false`, con datos efímeros.

Ver [la guía del frontend](docs/frontend-integration.md) para URL, CORS, sesión y flujo de intercambio.

### Configuración de entorno

`.env.example` es la plantilla pública; `.env` contiene los valores locales privados. `setup:docker` toma la plantilla si falta `.env`, genera secretos y conserva los existentes. Revisar el destino de `DATABASE_URL` antes de cualquier comando de BD: una URL previa se conserva. Para Node con PostgreSQL se requieren `PERSISTENCE_MODE=prisma` y `DATABASE_ENABLED=true`; la plantilla por sí sola usa memoria.

Configurar `CORS_ORIGINS=http://localhost:3000,http://localhost:5173`, `PORT=4000` y `SWAGGER_ENABLED=true` para la integración local. El frontend solo recibe la URL HTTP (`VITE_API_URL=http://localhost:4000` si usa Vite); nunca `DATABASE_URL`, `POSTGRES_PASSWORD` ni `JWT_SECRET`. El acceso es mediante `Authorization: Bearer <token>`. Swagger/OpenAPI no se publican cuando `SWAGGER_ENABLED=false`.

## Modelo y funcionalidades

USUARIOS integra un solo `rol`, `saldo` y `creditos_retenidos`. RESERVAS integra las dos confirmaciones, cancelación, motivo y fechas. MOVIMIENTOS_CREDITO se relaciona con `id_usuario` y guarda cantidad y snapshots anteriores/posteriores. No se mantienen tablas separadas de roles, cuentas, confirmaciones, cancelaciones ni transferencias.

- Registro, login JWT, perfil y permisos actuales desde almacenamiento.
- Carreras activas: `GET /careers` y `GET /careers/:id`. Registro y perfil usan UUID de carrera activa; semestre 1–12.
- Categorías/habilidades con filtros, paginación y administración por ADMIN.
- Ofertas propias y disponibilidad con control de propiedad y concurrencia.
- Solicitudes, aceptación con retención, rechazo y cancelación.
- Reservas sin superposición por ambos participantes, incluyendo roles cruzados.
- Dos confirmaciones después del fin liquidan una vez mediante movimientos de consumo y transferencia.
- Cancelación libera una vez; auditoría ADMIN de integridad.
- Gestión administrativa de usuarios (solo ADMIN, JWT + RolesGuard): `GET /admin/users` (búsqueda y filtros por estado, rol y carrera, paginado), `POST /admin/users` (alta de estudiantes reutilizando el registro: Argon2id, créditos iniciales por política, sin asignación de roles desde el cliente) y `PATCH /admin/users/:id/status` (baja lógica a `Inactivo` o reactivación a `Activo`). La baja no elimina filas ni toca saldos; se rechaza con 409 la propia cuenta, el último ADMIN activo, reservas confirmadas o créditos retenidos pendientes. Los `Suspendido` no se reactivan por esta vía. Cada acción se registra en `AUDITORIA` (`ADMIN_USER_CREATE`, `ADMIN_USER_DEACTIVATE`, `ADMIN_USER_REACTIVATE`) con el ADMIN ejecutor, el usuario afectado y el estado anterior/posterior, en la misma transacción y sin secretos. Detalle y ejemplos en `docs/frontend-integration.md`.

Roles almacenados: Estudiante, Profesor, Administrador. `roles` en JWT/perfil es una proyección de capacidades compatible con la API anterior; no representa relaciones M:N. El registro público solo crea Estudiante. Niveles: Basico, Intermedio, Avanzado, Experto. Disponibilidad: disponible, reservado, cancelado.

## Créditos y reintentos

Los importes persistidos son **INTEGER PostgreSQL**, sin decimales ni centavos. Regla local explícita: **1 crédito = 15 minutos**, 4 créditos por hora. Duración de reserva: múltiplos de 15 minutos hasta 8 horas. El saldo inicial es cero; una carga ADMIN de prueba usa `amount: "8"`, no `"8.00"`.

POST de `/exchanges`, sus acciones, confirmación/cancelación de `/reservations` y `/credits/grants` requieren `Idempotency-Key` de 16–128 caracteres alfanuméricos o `. _ : -`. Repetir la misma clave/contenido recupera el resultado; contenido distinto recibe 409. El estado de negocio también evita repetir efectos con claves diferentes.

Memoria usa borradores y commit único; una excepción descarta los cambios previos al commit. Una respuesta perdida después del commit se recupera repitiendo la misma clave. No se cancela una operación válida por un fallo de transporte.

## Flujo local

1. Levantar Compose, crear el ADMIN persistente y autenticarlo en Swagger.
2. Registrar ofertante/solicitante usando un UUID de `GET /careers`; autenticar cada uno.
3. El ofertante publica una habilidad y un horario futuro.
4. ADMIN carga al solicitante: POST `/credits/grants`, `{ "userId": "UUID", "amount": "8", "reason": "Prueba local" }`.
5. El solicitante crea POST `/exchanges` con providerId, skillId, availabilityId, fechaInicio, fechaFin y descripcion opcional. Usar una hora.
6. El ofertante acepta en POST `/exchanges/:id/accept`; se retienen 4 créditos. Consultar `/credits/me` y `/reservations/me`.
7. Antes del inicio, un participante puede cancelar con motivo. Después requiere ADMIN hasta antes de completarse.
8. Después del fin, cada participante confirma en `/reservations/:id/confirm`; se debitan 4 y se acreditan 4 una vez.
9. ADMIN consulta `/exchanges/integrity` para el snapshot actual.

## Persistencia PostgreSQL

`prisma/schema.prisma` define las 12 tablas con UUID, timestamptz, INTEGER, JSONB, claves y relaciones. Los adaptadores se seleccionan con `PERSISTENCE_MODE=prisma`, `DATABASE_ENABLED=true` y `DATABASE_URL`. Compose fija estos valores para su propia BD local. `prisma/migrations` contiene la creación del modelo y restricciones de saldos, retenciones, intervalos, participantes, semestre y puntuaciones. Se aplican con `prisma migrate deploy`, conservando las tablas al reiniciar. No aplicar contra el modelo legado de 18 tablas sin un plan de migración de sus datos.

El adaptador coordina escrituras con transacción y bloqueo asesor común entre instancias del backend; idempotencia y metadata de API se guardan en AUDITORIA dentro del mismo commit. Escritores externos deben respetar el protocolo. Los reportes previos registran pruebas sobre una BD temporal; esta revisión no las repitió ni certifica concurrencia o integridad en una instancia real. `/health/ready` comprueba conexión y presencia de tablas, no equivalencia de columnas, restricciones ni migraciones.

Variables restantes: `RATE_LIMIT_TTL_MS=60000`, `RATE_LIMIT_MAX=100`, `JWT_EXPIRES_IN_SECONDS=900`, `JWT_ISSUER` y `JWT_AUDIENCE`. `JWT_SECRET` es obligatoria y debe tener al menos 32 caracteres. Ver `.env.example`. Producción con memoria se rechaza. Nunca publicar `.env`.

## Compatibilidad BD y pendientes de otros equipos

| Versión                        | Evidencia disponible y decisión pendiente                                                                                                                                                                                                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12 tablas                      | Documento local v0.3.1 optimizado, 12 modelos Prisma y 12 `CREATE TABLE` en la migración inicial. Incluye CARRERAS, CATEGORIAS, USUARIOS, HABILIDADES, USUARIO_HABILIDADES, DISPONIBILIDADES, SOLICITUDES_INTERCAMBIO, RESERVAS, MOVIMIENTOS_CREDITO, CALIFICACIONES, NOTIFICACIONES y AUDITORIA.                          |
| 18 tablas históricas           | El documento local describe la eliminación de ROLES, USUARIO_ROLES, CUENTAS_CREDITO, CONFIRMACIONES, CANCELACIONES y TRANSFERENCIAS_CREDITO; roles/saldos pasan a USUARIOS y confirmaciones/cancelación a RESERVAS. El SQL histórico citado en reportes no está disponible en este checkout para verificarlo directamente. |
| 13 tablas, BancoTiempo_DB_v0.4 | No hay DDL ni referencia local de `equipo/BD` para identificar su inventario y diferencias de columnas. BD debe proporcionar la versión acordada y decidir con Backend cualquier adaptación. `_prisma_migrations` es técnica, pero no demuestra el origen de esas 13 tablas.                                               |

Frontend debe contrastar sus DTO con HTTP/OpenAPI, conservar UUID y fechas con zona, distinguir catálogos `{data, meta}` de arrays propios y solicitar login al vencer JWT (no hay refresh token). APIs debe reutilizar los endpoints y acordar cualquier consumo adicional; Dashboard debe definir sus necesidades de agregación y permisos, sin escribir saldos ni reservas directamente en BD. No se crearon interfaces, endpoints de reportes ni nuevas tablas.

Notificaciones y calificaciones tienen tablas, pero no endpoints implementados. Tampoco hay recuperación de contraseña ni búsqueda global de ofertantes: el consumidor necesita conocer el ID del ofertante. Su desarrollo requiere priorización del equipo. Antes de producción, comprobar concurrencia, cobro único, cancelaciones e idempotencia sobre el entorno acordado; no se certifican aquí.

## Instalación y diagnóstico de errores locales

El lockfile corregido restaura `multer → type-is@1.6.18 → media-typer@0.3.0`. La entrada anterior apuntaba a un tarball 0.4.0 inexistente, conservando la integridad de 0.3.0. Se corrigieron versión, URL y dependencia del padre, sin regenerar el lockfile ni actualizar dependencias principales. Fuente: [manifiesto original de type-is](https://raw.githubusercontent.com/jshttp/type-is/1.6.18/package.json).

La primera instalación también encontró tarballs inexistentes de `dynamic-dedupe@0.4.0`, `@tokenizer/token@0.4.0` y `@sinonjs/fake-timers@10.4.0`. Se restauraron respectivamente 0.3.0, 0.3.0 y 10.3.0, contrastando metadatos e integridades con npm oficial, junto con los rangos afectados de `ts-node-dev`, `strtok3` y `token-types`. No fue necesario borrar la caché ni usar overrides o `--force`.

Si npm informa `UNABLE_TO_VERIFY_LEAF_SIGNATURE` y el certificado de confianza está instalado en Windows, usar en esa sesión PowerShell `$env:NODE_OPTIONS = "$env:NODE_OPTIONS --use-system-ca".Trim()` antes de `npm.cmd ci`. No desactivar `strict-ssl` ni TLS. Si persiste, revisar la CA del entorno con su administrador.

Los comandos ausentes (`tsc`, Prisma, ESLint, Jest, Prettier) y `Cannot find module 'dotenv'` son consecuencias de la instalación incompleta: primero terminar `npm.cmd ci`, después `npm.cmd run setup:docker`. Este último genera `.env` local y resuelve la falta de `POSTGRES_PASSWORD`; `.env` está excluido de Git. No se generan credenciales durante esta revisión.

El error `dockerDesktopLinuxEngine` corresponde al motor Docker: abrir Docker Desktop, activar el motor WSL 2/Linux y esperar a que esté iniciado. Si está en contenedores Windows, seleccionar contenedores Linux. No se corrige modificando NestJS. Compose conserva `postgres`, `db-init` y `backend`; no ejecutar el arranque completo hasta resolver el esquema de la instancia destino con BD.

## Verificación controlada

Con dependencias y cliente Prisma preparados, ejecutar desde PowerShell. Las pruebas unitarias/e2e utilizan memoria; el setup fija ese modo y deshabilita BD, incluso si el entorno del usuario seleccionaba Prisma. E2e usa HTTP local de prueba, sin servicios de otros equipos. No ejecutar `test:postgres` sin autorización independiente.

```powershell
npm.cmd run build
npm.cmd run prisma:validate
npm.cmd run lint
npm.cmd run format:check
npm.cmd test
npm.cmd run test:e2e
```

Resultado de esta estabilización en Windows, Node 26.8.2 / npm 11.19.1:

- `npm ci`: primera ejecución falló por las otras tres entradas del lockfile; el único reintento pasó y generó Prisma Client 7.10.1.
- `build`, `prisma:validate` y `lint`: pasaron, una ejecución de cada uno.
- `format:check`: falló con avisos en 156 archivos, incluidos archivos ajenos a esta entrega. Se normalizó únicamente el formato de los archivos modificados; no se hizo una reformateación global ni se repitió una comprobación que seguiría fallando por los restantes.
- Unitarias y e2e: no ejecutadas, porque la autorización exige que pasen las verificaciones previas. No se iniciaron servidores persistentes, contenedores, migraciones ni conexiones de prueba a PostgreSQL.
- npm reportó 33 vulnerabilidades (2 moderadas y 31 altas). Queda pendiente evaluar su alcance y las actualizaciones puntuales necesarias; no se aplicó `npm audit fix` ni actualizaciones principales automáticas.

Después de iniciar voluntariamente el entorno local compatible con BD, revisar en `/docs-json` que `GET /careers` documente `data` y `meta`, y `GET /careers/{id}` los campos de carrera. OpenAPI en ejecución, Docker y el flujo HTTP completo siguen pendientes. Los resultados de pruebas de los reportes históricos no son resultados de esta estabilización.

## Documentación

- [Integración del frontend](docs/frontend-integration.md)
- [Reporte de PostgreSQL y Docker](docs/progress-postgresql-docker.md)
- [Entrega actual v0.4](docs/progress-v0.4.md)
- [Fuente optimizada de BD](documentaci_n_de_la_base_de_datos.md)
- [Diferencias de las fuentes y scripts heredados](docs/schema-source-discrepancies.md)
- [Contrato de la entrega previa v0.3](docs/api-contract.md): histórico; para tipos/unidad actuales usar Swagger y este README.
- [Reporte histórico v0.3](docs/progress-v0.3.md)
- [Reporte histórico v0.2](docs/progress-v0.2.md)
