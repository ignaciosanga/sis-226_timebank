# Banco de Tiempo Universitario — Backend v0.4.0

Backend NestJS adaptado al **modelo optimizado de 12 tablas**, elegido por el usuario y definido en [la documentación de BD](documentaci_n_de_la_base_de_datos.md). El SQL/JSON anterior de 18 tablas es legado y no se aplica automáticamente.

## Levantar con Docker Desktop

Requisitos: Docker Desktop con motor Linux activo, Node.js 24 y npm 11.

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

Roles almacenados: Estudiante, Profesor, Administrador. `roles` en JWT/perfil es una proyección de capacidades compatible con la API anterior; no representa relaciones M:N. El registro público solo crea Estudiante. Niveles: Basico, Intermedio, Avanzado, Experto. Disponibilidad: disponible, reservado, cancelado.

## Créditos y reintentos

Los importes persistidos son **INTEGER PostgreSQL**, sin decimales ni centavos. Regla local explícita: **1 crédito = 15 minutos**, 4 créditos por hora. Duración de reserva: múltiplos de 15 minutos hasta 8 horas. El saldo inicial es cero; una carga ADMIN de prueba usa `amount: "8"`, no `"8.00"`.

POST de `/exchanges`, sus acciones, confirmación/cancelación de `/reservations` y `/credits/grants` requieren `Idempotency-Key` de 16–128 caracteres alfanuméricos o `. _ : -`. Repetir la misma clave/contenido recupera el resultado; contenido distinto recibe409. El estado de negocio también evita repetir efectos con claves diferentes.

Memoria usa borradores y commit único; una excepción descarta los cambios previos al commit. Una respuesta perdida después del commit se recupera repitiendo la misma clave. No se cancela una operación válida por un fallo de transporte.

## Flujo local

1. Levantar Compose, crear el ADMIN persistente y autenticarlo en Swagger.
2. Registrar ofertante/solicitante usando un UUID de `GET /careers`; autenticar cada uno.
3. El ofertante publica una habilidad y un horario futuro.
4. ADMIN carga al solicitante: POST `/credits/grants`, `{ "userId": "UUID", "amount": "8", "reason": "Prueba local" }`.
5. El solicitante crea POST `/exchanges` con providerId, skillId, availabilityId, fechaInicio, fechaFin y descripcion opcional. Usar una hora.
6. El ofertante acepta en POST `/exchanges/:id/accept`; se retienen4 créditos. Consultar `/credits/me` y `/reservations/me`.
7. Antes del inicio, un participante puede cancelar con motivo. Después requiere ADMIN hasta antes de completarse.
8. Después del fin, cada participante confirma en `/reservations/:id/confirm`; se debitan4 y se acreditan4 una vez.
9. ADMIN consulta `/exchanges/integrity` para el snapshot actual.

## Persistencia PostgreSQL

`prisma/schema.prisma` define las 12 tablas con UUID, timestamptz, INTEGER, JSONB, claves y relaciones. Los adaptadores se seleccionan con `PERSISTENCE_MODE=prisma`, `DATABASE_ENABLED=true` y `DATABASE_URL`. Compose fija estos valores para su propia BD local. `prisma/migrations` contiene la creación del modelo y restricciones de saldos, retenciones, intervalos, participantes, semestre y puntuaciones. Se aplican con `prisma migrate deploy`, conservando las tablas al reiniciar. No aplicar contra el modelo legado de 18 tablas sin un plan de migración de sus datos.

El adaptador coordina escrituras con transacción y bloqueo asesor común entre instancias del backend; idempotencia y metadata de API se guardan en AUDITORIA dentro del mismo commit. Escritores externos deben respetar el protocolo. Antes de detener las pruebas se verificaron PostgreSQL real, dos instancias concurrentes, cobro único, rollback e idempotencia después de reiniciar en una BD temporal independiente. No se modificó una BD compartida.

Variables restantes: PORT4000; CORS_ORIGINS; RATE_LIMIT_TTL_MS60000; RATE_LIMIT_MAX100; JWT_SECRET obligatoria >=32 caracteres; JWT_EXPIRES_IN_SECONDS900; JWT_ISSUER; JWT_AUDIENCE; SWAGGER_ENABLED=true. Ver `.env.example`. Producción con memoria se rechaza. Nunca publicar `.env`.

## Verificar

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test
npm.cmd run test:e2e
npm.cmd run format:check
npm.cmd run prisma:validate
```

Antes de la última instrucción aprobaron 157 pruebas unitarias, 132 HTTP y el escenario real de PostgreSQL. No se ejecutaron nuevas pruebas después. La construcción completa de Docker quedó detenida durante la descarga de su imagen base; el despliegue completo y los ajustes finales quedan sin nueva verificación. Notificaciones, calificaciones y recuperación de contraseña no tienen endpoints implementados.

## Documentación

- [Integración del frontend](docs/frontend-integration.md)
- [Reporte de PostgreSQL y Docker](docs/progress-postgresql-docker.md)
- [Entrega actual v0.4](docs/progress-v0.4.md)
- [Fuente optimizada de BD](documentaci_n_de_la_base_de_datos.md)
- [Diferencias de las fuentes y scripts heredados](docs/schema-source-discrepancies.md)
- [Contrato de la entrega previa v0.3](docs/api-contract.md): histórico; para tipos/unidad actuales usar Swagger y este README.
- [Reporte histórico v0.3](docs/progress-v0.3.md)
- [Reporte histórico v0.2](docs/progress-v0.2.md)
