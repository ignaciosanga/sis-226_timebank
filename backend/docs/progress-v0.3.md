# Reporte — Backend v0.3.0 local

Fecha: 22 de octubre de 2026, America/La_Paz. Actualización sobre el proyecto existente, por solicitud del usuario de corregir los defectos y completar un flujo lógico de reservas y créditos. Todo permanece local.

## Implementado

- Corregida la pérdida de campos entre PATCH simultáneos: se combina con el registro vigente dentro de la transacción. Primero se reprodujo el defecto con dos pruebas fallidas; después pasan.
- Solicitudes funcionales: crear, consultar, aceptar, rechazar y cancelar pendientes.
- Exclusión de reservas para ambos participantes, incluyendo conflictos al intercambiar roles.
- Reserva y retención de saldo se confirman juntas; fondos insuficientes no dejan efectos parciales.
- Dos confirmaciones únicas, después del fin, producen una sola transferencia con débito y abono.
- Cancelaciones con liberación única y conservación del historial, sin cancelar una liquidación completada.
- Idempotencia para reintentos y recuperación de resultados; unicidad de negocio adicional por solicitud/reserva aunque cambie la clave.
- Reversión del borrador completo ante fallos antes del commit. Si se pierde la respuesta después, repetir la misma clave recupera el resultado sin cobrar otra vez.
- Auditoría ADMIN de solo lectura sobre horarios superpuestos, cuentas, retenciones, movimientos, transferencias y referencias.
- Disponibilidad, ofertas y operaciones financieras comparten un proveedor transaccional. Una reserva activa no pierde su horario por ediciones/desactivaciones concurrentes.
- Corrección adicional: la firma JWT ocurre antes de escribir ultimo_acceso; un fallo de firma no deja un acceso registrado. Se conserva la comprobación de suspensión concurrente.
- Swagger con DTO/respuestas/seguridad, CORS con Idempotency-Key y rechazo de campos adicionales en acciones sin cuerpo.

## Políticas provisionales autorizadas

El usuario indicó que no disponía del modelo completo ni de políticas del PO y pidió completar la solución de forma lógica. Se implementaron reglas locales explícitas:

| Regla                    | Comportamiento                                                                                                 |
| ------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Saldo inicial            | 0.00; sin créditos de bienvenida                                                                               |
| Carga de prueba          | Solo ADMIN en development/test, con motivo e idempotencia                                                      |
| Unidad                   | 1 hora = 1.00 crédito; 15 minutos = 0.25                                                                       |
| Duración                 | Múltiplos de 15 minutos, de 15 minutos a 8 horas                                                               |
| Solicitud                | No retiene; el ofertante decide aceptar/rechazar                                                               |
| Aceptación               | Futuro, disponibilidad activa, oferta vigente, saldo suficiente y sin conflicto de ningún participante         |
| Ocupación                | [inicio, fin); extremos contiguos permitidos                                                                   |
| Liquidación              | Dos confirmaciones distintas después del fin                                                                   |
| Cancelación              | Participantes antes del inicio; después requiere ADMIN; no se cancela una completada                           |
| Oferta despublicada      | Impide nuevas aceptaciones; no borra reservas anteriores                                                       |
| Disponibilidad reservada | Ampliación/cobertura válida permitida; recortar o desactivar dejando reservas activas sin cobertura recibe 409 |

Estas decisiones requieren contraste con PO/BD antes de producción. No se afirma que coincidan con columnas/estados SQL no entregados.

## Endpoints nuevos

Todos requieren JWT activo. Cada POST de esta tabla exige Idempotency-Key de 16–128 caracteres alfanuméricos o `. _ : -`.

| Método | Ruta                        | Acceso / resultado                                        |
| ------ | --------------------------- | --------------------------------------------------------- |
| POST   | `/exchanges`                | ESTUDIANTE; crea solicitud, 201                           |
| GET    | `/exchanges/me`             | Solicitudes propias                                       |
| POST   | `/exchanges/:id/accept`     | Ofertante; reserva y retención, 200                       |
| POST   | `/exchanges/:id/reject`     | Ofertante; pendiente, 200                                 |
| POST   | `/exchanges/:id/cancel`     | Solicitante; pendiente, 200                               |
| GET    | `/reservations/me`          | Reservas propias                                          |
| GET    | `/reservations/:id`         | Participantes                                             |
| POST   | `/reservations/:id/confirm` | Participante después del fin, 200                         |
| POST   | `/reservations/:id/cancel`  | Participante/ADMIN según momento, motivo obligatorio, 200 |
| GET    | `/credits/me`               | Cuenta propia: saldo, retenidos, disponibles              |
| GET    | `/credits/me/movements`     | Movimientos propios                                       |
| POST   | `/credits/grants`           | ADMIN desarrollo/test; carga con motivo, 201              |
| GET    | `/exchanges/integrity`      | ADMIN; auditoría sin modificaciones                       |

Se conservan todos los endpoints de v0.2. Ver los cuerpos, respuestas y errores en [api-contract.md](api-contract.md) y Swagger `/docs`.

## Atomicidad y límites

MemoryExchangeRepository serializa transacciones por instancia. Toma el snapshot después de adquirir el turno, ejecuta el caso de uso sobre un borrador y clona resultado/estado antes de sustituir una sola referencia confirmada. Una excepción descarta todos los cambios; finally libera la cola. Las lecturas solo ven snapshots confirmados, sin referencias que permitan modificar el almacén.

El mismo proveedor sirve a disponibilidad, ofertas, solicitudes, reservas, cuentas y ledger. No se confirman repositorios financieros independientes ni se restaura un snapshot obsoleto sobre cambios de otra operación exitosa.

Se utilizan bigint en centésimas exactas de crédito y strings decimales en HTTP. El inspector valida saldo >= retenidos >= 0, correspondencia con movimientos/reservas, referencias, confirmaciones y un efecto por evento. La auditoría solo informa; no cancela ni modifica saldos automáticamente.

La misma clave con el mismo contenido devuelve el resultado original; GET muestra el estado actual si cambió posteriormente. Otro contenido recibe 409. Los errores antes del commit no consumen la clave.

**La garantía es por proceso y no es duradera.** Reiniciar elimina datos y claves; no se certifica exclusión entre instancias ni recuperación de una caída del proceso. NODE_ENV=production sigue bloqueado.

## Compatibilidad con la base de datos

Se mantienen los campos oficiales conocidos de categorías, habilidades, relaciones, disponibilidades y usuarios. Para solicitudes/reservas/créditos solo se recibió un inventario de tablas, sin SQL/DBML completo. exchange.types.ts es el modelo provisional del adaptador local; importes y estados se adaptarán a la fuente oficial.

No se cambió prisma/schema.prisma ni se inventó una BD alternativa o repositorio Prisma. No se ejecutaron migraciones, db push, introspección ni operaciones PostgreSQL. La compatibilidad exacta requiere recibir el esquema; las pruebas de memoria no la certifican. Ver [database-compatibility.md](database-compatibility.md).

## Verificación

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test
npm.cmd run test:e2e
npm.cmd run format:check
```

| Comprobación                     | Resultado                                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Unitarias                        | 15 suites, 173 pruebas aprobadas                                                                      |
| HTTP nuevas de disponibilidad    | 8 aprobadas                                                                                           |
| HTTP nuevas de reservas/créditos | 20 aprobadas                                                                                          |
| HTTP completas                   | 5 suites, 108 pruebas aprobadas                                                                       |
| Build, lint y formato            | Correctos                                                                                             |
| Servidor compilado y Swagger     | Correctos; flujo ADMIN/estudiantes, retención, reintento, conflicto, auditoría y cancelación probados |
| PostgreSQL / Docker              | No ejecutados en esta actualización                                                                   |

Las pruebas nuevas cubren PATCH simultáneo, POST duplicado, conflictos por ambos roles, aceptación doble, fondos insuficientes, cancelación y liberación únicas, confirmación concurrente y transferencia única, cancelación ADMIN contra última confirmación, rollback de aceptación/liquidación y fallo HTTP después del commit recuperado con la misma clave. También validan aislamiento de referencias, errores de clonación, continuidad de la cola, cálculos exactos, auditoría de ledger/estados/duplicados, permisos, campos arbitrarios y CORS.

Se conservaron las pruebas anteriores. El inventario Swagger y su versión se actualizan al nuevo contrato; no se elimina cobertura para hacer pasar la suite.

## Flujo local de prueba

1. Compilar y arrancar con `npm.cmd run start:memory-admin -- admin@example.test`. Iniciar sesión con la contraseña aleatoria mostrada.
2. Registrar dos estudiantes. El ofertante publica una habilidad y disponibilidad futura; conservar JWT distintos.
3. ADMIN carga créditos al solicitante: POST /credits/grants con `{ "userId": "UUID", "amount": "2.00", "reason": "Prueba local" }` y una clave nueva.
4. El solicitante crea POST /exchanges con providerId, skillId, availabilityId, fechaInicio, fechaFin y descripcion opcional. Usar 15 minutos o una hora.
5. El ofertante acepta mediante POST /exchanges/{id_solicitud}/accept y otra clave. GET /credits/me del solicitante muestra la retención.
6. Otra aceptación incompatible recibe 409 sin nuevos efectos. Repetir la misma petición/clave recupera su resultado anterior.
7. Cancelar antes del inicio comprueba la liberación. Para liquidar manualmente, esperar al fin y confirmar con ambas personas; las pruebas adelantan el reloj de forma controlada, sin quitar esa regla del servidor.
8. ADMIN consulta /exchanges/integrity: estado coherente devuelve status=ok e issues vacío.

No reutilizar claves para operaciones nuevas con otro contenido. Al apagar desaparece todo, incluida la cuenta ADMIN temporal.

## Archivos y organización

El núcleo nuevo está en modules/exchanges: tipos del adaptador, puerto, almacén transaccional, importes exactos, inspector de integridad, servicio, DTO/respuestas y controlador. modules/reservations y modules/credits publican sus controladores sobre ese caso de uso compartido. Availability y UserSkills conservan sus puertos, implementados sobre el mismo almacén.

Las pruebas nuevas permanentes están en credits.spec.ts, memory-exchange.repository.spec.ts, integrity.spec.ts, memory-user-skills.repository.spec.ts, availability-integrity.e2e-spec.ts y exchanges-integrity.e2e-spec.ts; se añaden regresiones a disponibilidad y auth.

### Archivos nuevos en esta actualización (27)

- `docs/database-compatibility.md`
- `docs/progress-v0.3.md`
- `src/common/pipes/empty-body.pipe.ts`
- `src/modules/availability/availability-interval.ts`
- `src/modules/credits/credits.controller.ts`
- `src/modules/credits/credits.module.ts`
- `src/modules/credits/dto/grant-credits.dto.ts`
- `src/modules/exchanges/credits.spec.ts`
- `src/modules/exchanges/credits.ts`
- `src/modules/exchanges/dto/create-exchange.dto.ts`
- `src/modules/exchanges/dto/exchange-responses.dto.ts`
- `src/modules/exchanges/exchange.repository.ts`
- `src/modules/exchanges/exchange.types.ts`
- `src/modules/exchanges/exchange-persistence.module.ts`
- `src/modules/exchanges/exchanges.controller.ts`
- `src/modules/exchanges/exchanges.module.ts`
- `src/modules/exchanges/exchanges.service.ts`
- `src/modules/exchanges/integrity.spec.ts`
- `src/modules/exchanges/integrity.ts`
- `src/modules/exchanges/memory-exchange.repository.spec.ts`
- `src/modules/exchanges/memory-exchange.repository.ts`
- `src/modules/reservations/dto/cancel-reservation.dto.ts`
- `src/modules/reservations/reservations.controller.ts`
- `src/modules/reservations/reservations.module.ts`
- `src/modules/user-skills/memory-user-skills.repository.spec.ts`
- `test/availability-integrity.e2e-spec.ts`
- `test/exchanges-integrity.e2e-spec.ts`

### Archivos anteriores actualizados (29)

- `docs/api-contract.md`
- `docs/architecture.md`
- `docs/avances/backend.md`
- `docs/business-rules.md`
- `docs/codex-order-reservations-integrity.md`
- `docs/pending-decisions.md`
- `docs/progress-v0.2.md`
- `docs/reservations-integrity-review.md`
- `docs/setup-local.md`
- `package.json`
- `package-lock.json`
- `README.md`
- `src/app.module.ts`
- `src/config/configure-app.ts`
- `src/modules/auth/auth.service.spec.ts`
- `src/modules/auth/auth.service.ts`
- `src/modules/availability/availability.module.ts`
- `src/modules/availability/availability.repository.ts`
- `src/modules/availability/availability.service.spec.ts`
- `src/modules/availability/availability.service.ts`
- `src/modules/availability/memory-availability.repository.ts`
- `src/modules/availability/README.md`
- `src/modules/confirmations/README.md`
- `src/modules/credits/README.md`
- `src/modules/exchanges/README.md`
- `src/modules/reservations/README.md`
- `src/modules/user-skills/memory-user-skills.repository.ts`
- `src/modules/user-skills/user-skills.module.ts`
- `test/app.e2e-spec.ts`

## Pendientes

Recibir esquema oficial, mapear contratos/estados, implementar adaptadores PostgreSQL y verificar restricciones/transacciones/idempotencia con conexiones y procesos independientes. Confirmar las reglas provisionales antes de producción.

Siguen pendientes notificaciones, calificaciones, recuperación/verificación de correo, refresh tokens, gestión persistente de roles y auditoría histórica duradera. Esta auditoría no inspecciona una BD externa.

No se hicieron commit, push, Pull Requests ni despliegues. No se modificó la base de datos del otro equipo.
