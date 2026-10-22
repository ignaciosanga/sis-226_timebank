# Banco de Tiempo Universitario — Backend v0.4.0

Backend NestJS adaptado al **modelo optimizado de 12 tablas**, elegido por el usuario y definido en [la documentación de BD](documentaci_n_de_la_base_de_datos.md). El SQL/JSON anterior de 18 tablas es legado y no se aplica automáticamente.

## Ejecutar

Node.js 24 y npm 11:

```powershell
npm.cmd ci
npm.cmd run setup:env
npm.cmd run build
npm.cmd start
```

La instalación genera el cliente Prisma localmente; no crea ni migra la BD. `setup:env` conserva cualquier `.env` existente. El modo predeterminado es memoria; los datos desaparecen al reiniciar.

- Health: http://localhost:4000/health
- Swagger: http://localhost:4000/docs
- OpenAPI: http://localhost:4000/docs-json

Para ADMIN temporal con contraseña aleatoria: `npm.cmd run start:memory-admin -- admin@example.test`, después de compilar y detener otra instancia en el mismo puerto.

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

1. Arrancar el comando ADMIN temporal y autenticarlo en Swagger.
2. Registrar ofertante/solicitante usando un UUID de `GET /careers`; autenticar cada uno.
3. El ofertante publica una habilidad y un horario futuro.
4. ADMIN carga al solicitante: POST `/credits/grants`, `{ "userId": "UUID", "amount": "8", "reason": "Prueba local" }`.
5. El solicitante crea POST `/exchanges` con providerId, skillId, availabilityId, fechaInicio, fechaFin y descripcion opcional. Usar una hora.
6. El ofertante acepta en POST `/exchanges/:id/accept`; se retienen4 créditos. Consultar `/credits/me` y `/reservations/me`.
7. Antes del inicio, un participante puede cancelar con motivo. Después requiere ADMIN hasta antes de completarse.
8. Después del fin, cada participante confirma en `/reservations/:id/confirm`; se debitan4 y se acreditan4 una vez.
9. ADMIN consulta `/exchanges/integrity` para el snapshot actual.

## Persistencia PostgreSQL

`prisma/schema.prisma` define las12 tablas con UUID, timestamptz, INTEGER, JSONB, claves y relaciones. Los adaptadores reales se seleccionan con `PERSISTENCE_MODE=prisma`, `DATABASE_ENABLED=true` y `DATABASE_URL` del entorno autorizado. No hay semillas de prueba insertadas automáticamente en PostgreSQL. No activar el modo contra la base legada de18 tablas.

El adaptador coordina escrituras con transacción y bloqueo asesor común entre instancias de este backend; idempotencia y metadata de API se guardan en AUDITORIA dentro del mismo commit, sin añadir tablas o columnas. Las escrituras externas deben respetar el protocolo o las restricciones acordadas con BD. Se requieren pruebas reales contra un destino autorizado antes de certificar concurrencia/durabilidad de PostgreSQL; no se ejecutaron conexiones ni migraciones durante esta entrega.

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

Pruebas de memoria/HTTP y contrato de esquema están automatizadas. Pruebas reales PostgreSQL, notificaciones, calificaciones y recuperación de contraseña siguen pendientes. No se modificó una BD compartida.

## Documentación

- [Entrega actual v0.4](docs/progress-v0.4.md)
- [Fuente optimizada de BD](documentaci_n_de_la_base_de_datos.md)
- [Diferencias de las fuentes y scripts heredados](docs/schema-source-discrepancies.md)
- [Contrato de la entrega previa v0.3](docs/api-contract.md): histórico; para tipos/unidad actuales usar Swagger y este README.
- [Reporte histórico v0.3](docs/progress-v0.3.md)
- [Reporte histórico v0.2](docs/progress-v0.2.md)
