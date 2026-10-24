# reservations

v0.3.0: consulta de reservas, confirmación y cancelación. Los controladores delegan en `ExchangesService` y comparten su transacción con disponibilidad y créditos.

| Método | Ruta                        | Efecto                                      |
| ------ | --------------------------- | ------------------------------------------- |
| GET    | `/reservations/me`          | Reservas en las que participa el actor      |
| GET    | `/reservations/:id`         | Detalle exclusivo de los participantes      |
| POST   | `/reservations/:id/confirm` | Confirma un participante después del fin    |
| POST   | `/reservations/:id/cancel`  | Cancela con `{ motivo }` según autorización |

Requieren JWT ESTUDIANTE o ADMIN; el rol ADMIN no permite consultar/confirmar reservas ajenas. Los POST exigen `Idempotency-Key`. ADMIN sí puede cancelar una reserva ajena antes de que esté completada.

Una aceptación crea una única reserva `CONFIRMADA`, con saldo retenido. Se impiden solapamientos `[inicio, fin)` para ambos participantes, también cruzando los roles de ofertante y solicitante. Extremos contiguos son válidos. Dos confirmaciones distintas después del fin transfieren los créditos una sola vez y cambian el estado a `COMPLETADA`.

Un participante puede cancelar estrictamente antes del inicio; ADMIN puede cancelar hasta antes de completarla. Motivo obligatorio de hasta 500 caracteres. Cancelar cambia a `CANCELADA`, conserva el historial y libera la retención una sola vez. No se cancelan completadas ni se confirman canceladas. Confirmación/cancelación concurrentes producen una única transición permitida.

La disponibilidad puede editarse si sigue cubriendo las reservas activas; recortarla o desactivarla dejando una sin cobertura recibe 409. Despublicar una habilidad no cancela una reserva ya aceptada. No hay vencimiento ni liquidación automática.

Reglas, estados y campos son provisionales del adaptador local, autorizados para esta versión; sin SQL ni garantía entre procesos. Ver [contrato API](../../../docs/api-contract.md) y [reglas de negocio](../../../docs/business-rules.md).
