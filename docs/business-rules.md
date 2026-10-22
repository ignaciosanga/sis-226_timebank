# Reglas de negocio v0.3.0

Las reglas de intercambios, reservas y créditos descritas aquí son decisiones provisionales autorizadas por el usuario para el adaptador en memoria. El inventario y los campos oficiales conocidos de v0.2 se conservan; no se certifica que estos tipos, estados o precios coincidan con SQL. `prisma/schema.prisma` permanece intacto.

## Identidad, catálogos y publicación

- El registro público fuerza ESTUDIANTE y crea perfil; no crea una cuenta con saldo de bienvenida. El perfil admite únicamente sus campos editables anteriores.
- Correo normalizado y único; contraseñas Argon2id; JWT con estado y roles consultados en cada petición protegida. Si falla la firma del token, no se escribe `ultimo_acceso`; se mantiene el control de suspensión concurrente.
- Catálogos con estados ACTIVO/INACTIVO. Solo ADMIN crea categorías y habilidades; nombres únicos normalizados, incluyendo registros inactivos.
- Una habilidad se crea o selecciona solo si existe y su categoría está activa.
- Relación estudiante-habilidad única por `id_usuario + id_habilidad`; niveles BASICO/INTERMEDIO/AVANZADO provisionales.
- Solo el estudiante autenticado publica o quita sus ofertas. Otro usuario activo puede consultar publicaciones de estudiantes activos.
- Despublicar una oferta no cancela reservas aceptadas. Crear y aceptar una solicitud comprueba que la habilidad continúe publicada y activa.
- DTO y respuestas no admiten campos arbitrarios de identidad, rol o saldo ni exponen hashes o secretos.

## Disponibilidad y reservas simultáneas

Los horarios publicados usan fechas ISO 8601 con zona explícita, fin posterior al inicio y comparación por instante UTC. Se consideran intervalos `[inicio, fin)`: los extremos contiguos son válidos. No se permite superponer horarios activos del mismo usuario; usuarios distintos pueden publicar horarios coincidentes.

La disponibilidad publicada puede tener fechas pasadas y no impone los límites de duración de una reserva. Su edición/desactivación es exclusiva del propietario; DELETE es lógico e idempotente. Dos PATCH compatibles combinan sus campos con la versión vigente dentro de una operación atómica. Dos cambios incompatibles se rechazan sin guardar un intervalo inválido.

Disponibilidades, ofertas y reservas comparten el mismo almacén transaccional. Se permite editar/ampliar una disponibilidad si continúa cubriendo sus reservas `CONFIRMADA`. Recortarla dejando una reserva fuera o desactivarla mientras respalde una reserva activa recibe 409, incluso en una carrera contra la aceptación.

Una reserva nueva requiere participantes distintos, ambos estudiantes activos, habilidad activa publicada por el ofertante e intervalo cubierto por la disponibilidad activa indicada. El inicio debe seguir en el futuro al crear la solicitud y al aceptarla. La duración debe ser múltiplo de 15 minutos, entre 15 minutos y 8 horas.

La aceptación impide solapamientos de reservas activas para ambos participantes. Una persona ocupada como ofertante tampoco puede reservarse como solicitante en ese mismo intervalo, ni viceversa. El rechazo de un conflicto no retiene saldo ni crea una reserva parcial.

## Solicitudes y estados

| Entidad   | Transición              | Actor y efecto                                                          |
| --------- | ----------------------- | ----------------------------------------------------------------------- |
| Solicitud | Nueva → PENDIENTE       | Solicitante distinto del ofertante; sin retención ni bloqueo de horario |
| Solicitud | PENDIENTE → ACEPTADA    | Ofertante; crea una única reserva y retiene saldo atómicamente          |
| Solicitud | PENDIENTE → RECHAZADA   | Ofertante; sin efecto de crédito                                        |
| Solicitud | PENDIENTE → CANCELADA   | Solicitante; sin efecto de crédito                                      |
| Reserva   | Nueva → CONFIRMADA      | Consecuencia de aceptar; saldo retenido                                 |
| Reserva   | CONFIRMADA → COMPLETADA | Segunda confirmación válida después del fin; transferencia única        |
| Reserva   | CONFIRMADA → CANCELADA  | Cancelación autorizada; liberación única                                |

Solo se consulta el detalle de reservas en las que participa el actor. ADMIN dispone de auditoría y puede cancelar una reserva ajena según la política; ese rol no habilita una consulta general de sus detalles ni confirmaciones por terceros.

Una solicitud aceptada conserva `ACEPTADA` como historial aunque su reserva luego sea cancelada. Repetir su aceptación devuelve la reserva asociada, sin reabrirla ni retener nuevamente. No se reabren estados finales.

## Créditos, retenciones y liquidación

- Cada cuenta nueva comienza con `0.00`. Se crea al consultar `/credits/me`, recibir una carga o participar en una aceptación. La aceptación crea las cuentas faltantes de ambos participantes.
- Regla provisional: una hora equivale a `1.00` crédito; cada bloque de 15 minutos cuesta `0.25`. Se almacenan centavos enteros exactos con `bigint`; HTTP usa strings decimales de hasta dos cifras. No hay cálculos de saldo con coma flotante.
- `disponibles = saldo - creditos_retenidos`. Se exige `saldo >= creditos_retenidos >= 0`; operaciones simultáneas sobre la misma cuenta no pueden consumir dos veces el saldo disponible.
- Crear una solicitud no cambia la cuenta. Aceptarla retiene el importe una vez y registra `RETENCION`; si falta saldo, toda la aceptación se rechaza.
- Cada participante confirma como máximo una vez, a partir de la fecha de fin. Ambos deben estar activos para una confirmación nueva. Una sola confirmación mantiene la retención.
- La segunda confirmación descuenta saldo y retención del solicitante, acredita al ofertante, registra `DEBITO`, `ABONO` y una única transferencia y marca `COMPLETADA`, todo en la misma transacción.
- Las únicas cargas locales están en `/credits/grants`: ADMIN activo, entorno de desarrollo/pruebas, estudiante destino activo, monto positivo, motivo obligatorio e idempotencia. No son dinero ni saldo de bienvenida. El importe y el saldo final no pueden superar `10000000000.00` créditos.

No existen una pasarela de pagos, compras de créditos, penalizaciones, liberación automática por vencimiento ni liquidación automática al pasar la hora de fin.

## Cancelaciones

Un participante puede cancelar una reserva estrictamente antes del inicio. ADMIN puede hacerlo mientras no esté completada, incluso después de empezar o terminar el horario. Debe aportar un motivo no vacío de hasta 500 caracteres; se conservan actor y fecha. Una cancelación realizada por ADMIN ajeno queda marcada como administrativa.

Cancelar libera la retención y registra `LIBERACION` exactamente una vez. Repetir la cancelación recupera la reserva cancelada sin otro movimiento. Confirmar una cancelada o cancelar una completada recibe 409; no se borran movimientos ni se revierte un cobro válido arbitrariamente.

Confirmar y cancelar compiten dentro del mismo límite transaccional. Solo se conserva una transición permitida y coherente con los movimientos; no puede haber liquidación y liberación para la misma reserva.

## Idempotencia, fallos y auditoría

Los POST de solicitudes, reservas y cargas requieren `Idempotency-Key` de 16–128 caracteres alfanuméricos ASCII o `.`, `_`, `:`, `-`. Se identifica por actor y operación. Misma clave y contenido: resultado original sin repetir efectos; mismo ámbito y clave con contenido distinto: 409. Se conserva la misma clave tras una respuesta perdida. Aceptación, confirmación y cancelación también evitan duplicar el efecto de negocio aunque se usen claves diferentes.

Las transacciones serializadas toman un borrador después de adquirir su turno y confirman todos sus cambios juntos. Un fallo antes del commit descarta reserva, cuentas, movimientos, transferencias, confirmaciones, cancelaciones e idempotencia de esa operación; conserva el estado previo válido. Si el commit terminó y se perdió la respuesta, no se cancela la reserva: el reintento recupera el resultado confirmado. No hay reintentos automáticos de errores de negocio.

`GET /exchanges/integrity`, exclusivo de ADMIN, audita un snapshot sin mutaciones. Identifica reservas superpuestas por participante en cualquier rol, duplicados de reserva/transferencia/movimiento, retenciones inconsistentes, saldos que no cuadran con el historial y relaciones de negocio incompletas. No repara datos ni consulta otra base.

Las garantías y la auditoría cubren únicamente esta instancia de memoria. Reiniciar pierde datos y resultados de idempotencia; distintos procesos no comparten el almacenamiento. No certifica concurrencia, rollback ni durabilidad en PostgreSQL.

## Pendientes de integración

Recibir y contrastar el esquema oficial completo, relaciones, restricciones y políticas PO/BD antes de implementar SQL. Confirmar nombres de estados, niveles, unidad/precisión, precio, límites, catálogo de carreras, reglas de cancelación, suspensión, disputas y reconciliación. Mantener el inventario oficial separado de las decisiones provisionales del adaptador.

La persistencia futura debe verificar estas garantías con conexiones e instancias independientes y después de reinicios. Esta versión no instala una BD, cambia tablas ni ejecuta migraciones.
