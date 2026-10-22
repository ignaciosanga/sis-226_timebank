# confirmations

v0.3.0: las confirmaciones se publican mediante `POST /reservations/:id/confirm`, en `ReservationsController`, y se procesan en `ExchangesService`; este directorio no registra otro controlador ni otro almacenamiento.

Requiere JWT de un participante y `Idempotency-Key`. Una confirmación nueva solo se admite a partir de la fecha de fin, con ambos participantes activos y la reserva `CONFIRMADA`. La clave compuesta reserva/usuario impide duplicar la confirmación de una persona, incluso usando distintas claves HTTP.

La primera confirmación mantiene la retención. La segunda confirmación de un participante distinto descuenta saldo y retención del solicitante, acredita al ofertante, registra débito, abono y una única transferencia y cambia a `COMPLETADA`, todo atómicamente. Reintentos y confirmaciones simultáneas no repiten el cobro. Una reserva cancelada no puede confirmarse.

La cancelación compite en la misma transacción: no puede conservarse una liquidación junto con una liberación para la misma reserva. Si falla antes del commit, se descartan sus confirmaciones y efectos parciales; si se pierde la respuesta después, se recupera con la misma clave. No hay confirmación por terceros ni liquidación automática por el paso del tiempo.

Reglas/campos provisionales autorizados del adaptador de memoria, sin equivalencia SQL certificada. Garantías limitadas a una instancia y sin durabilidad tras reinicio. Ver [contrato API](../../../docs/api-contract.md) y [reglas de negocio](../../../docs/business-rules.md).
