# Créditos

Las operaciones de cuenta, reserva y ledger comparten la transacción de `ExchangesService`. PostgreSQL conserva la idempotencia y coordina instancias mediante el bloqueo asesor común. Memoria es efímera.

| Método | Ruta                    | Acceso                                                                        |
| ------ | ----------------------- | ----------------------------------------------------------------------------- |
| GET    | `/credits/me`           | ESTUDIANTE activo, cuenta propia                                              |
| GET    | `/credits/me/movements` | ESTUDIANTE activo, historial propio                                           |
| POST   | `/credits/grants`       | ADMIN en desarrollo/pruebas; `{ userId, amount, reason }` e `Idempotency-Key` |

Los importes de HTTP y del dominio se normalizan a strings enteros o con una décima. La aritmética usa décimas enteras `bigint`, sin flotantes. Se conserva el límite técnico de `2147483647` por importe. La cuenta cumple `saldo >= creditos_retenidos >= 0`; disponible es la resta exacta. El bono se decide una sola vez al activar la cuenta institucional, con la política configurada; no se concede al crear una solicitud.

En el ensayo decimal, una oferta de 45 minutos por `"3.7"` guarda ese precio al solicitar. Aceptarla crea una reserva y una retención por `"3.7"`; cancelar libera el mismo importe sin pagar al tutor. La fase 5 habilita la confirmación después del fin de la clase: la primera persona registra solo su marca; la segunda consume `"-3.7"` del estudiante y transfiere `"3.7"` al tutor en un commit único, usando exclusivamente `RESERVAS.creditos`. El disponible del estudiante no se descuenta dos veces. Otras retenciones se conservan y el ledger anterior es inmutable. Los horarios históricos sin oferta conservan un crédito por 15 minutos y el flujo anterior de doble confirmación.

La base habitual sigue usando nueve INTEGER. Allí, contratar ofertas devuelve `409 OFFER_PRICE_FLOW_PENDING`, las cargas fraccionarias se rechazan y liquidar reservas de oferta o fraccionarias mantiene `409 DECIMAL_SETTLEMENT_PENDING`. El esquema decimal provisional solo se aplicó a una copia aislada y a bases desechables de pruebas, fuera de las migraciones oficiales. Una bandera de Frontend no habilita esa capacidad.

Una excepción revierte cuenta, solicitud, reserva, horario, ledger e idempotencia del intento actual; conserva una primera confirmación ya comprometida. Un reintento con la misma clave y cuerpo recupera el resultado confirmado. Cancelación y liquidación compiten bajo el mismo bloqueo: solo una puede comprometer sus efectos. `GET /exchanges/integrity` permite auditoría ADMIN sin reparar datos. Ver [fase 5](../../../docs/fase5-confirmacion-liquidacion.md) y [contrato de Frontend](../../../docs/frontend-integration.md).
