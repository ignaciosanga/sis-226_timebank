# exchanges

v0.3.0: solicitudes, unidad de trabajo compartida de memoria e integridad. `ExchangesService` coordina también los efectos de reservas y créditos para confirmarlos juntos.

| Método | Ruta                    | Acceso / efecto                                                 |
| ------ | ----------------------- | --------------------------------------------------------------- |
| POST   | `/exchanges`            | ESTUDIANTE; solicitud pendiente sin retención                   |
| GET    | `/exchanges/me`         | ESTUDIANTE; solicitudes propias como participante               |
| POST   | `/exchanges/:id/accept` | Ofertante; reserva única, cuentas faltantes en cero y retención |
| POST   | `/exchanges/:id/reject` | Ofertante; rechazo de solicitud pendiente                       |
| POST   | `/exchanges/:id/cancel` | Solicitante; cancelación de solicitud pendiente                 |
| GET    | `/exchanges/integrity`  | ADMIN; auditoría de solo lectura                                |

Los POST requieren `Idempotency-Key` de 16–128 caracteres alfanuméricos ASCII o `.`, `_`, `:`, `-`, scoped por actor y operación. Misma clave y contenido recuperan el resultado confirmado; otro contenido recibe 409. La aceptación crea como máximo una reserva por solicitud, aun con claves distintas.

Creación/aceptación verifican participantes distintos y activos, habilidad/categoría activa y publicada, disponibilidad vigente, inicio futuro y duración múltiplo de 15 minutos, entre 15 minutos y 8 horas. La aceptación vuelve a comprobar horarios y saldo dentro del borrador compartido; conflictos o fallos descartan todos sus efectos.

`ExchangePersistenceModule` comparte disponibilidad, ofertas, solicitudes, reservas, cuentas, movimientos, transferencias, confirmaciones, cancelaciones e idempotencia. Las transacciones serializadas toman un snapshot después de esperar su turno y hacen un único commit. El servicio valida integridad antes de confirmarlo. Lecturas, resultados y estado confirmado no exponen referencias mutables.

La auditoría detecta solapamientos por participante en cualquier rol, duplicados y discrepancias de saldos/retenciones/historial; no modifica datos ni inspecciona SQL. Todo es por proceso y se pierde al reiniciar. Estados y campos nuevos son provisionales del adaptador autorizado, sin certificar su equivalencia SQL ni modificar Prisma.

Ver [contrato API](../../../docs/api-contract.md) y [reglas provisionales](../../../docs/business-rules.md).
