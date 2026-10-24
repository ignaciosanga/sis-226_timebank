# credits

v0.3.0: cuentas, retenciones, liberaciones, transferencias y movimientos de créditos de tiempo. Los efectos se coordinan en la misma transacción de memoria de `ExchangesService`.

| Método | Ruta                    | Acceso / resultado                                                            |
| ------ | ----------------------- | ----------------------------------------------------------------------------- |
| GET    | `/credits/me`           | ESTUDIANTE; cuenta propia, creada en cero si falta                            |
| GET    | `/credits/me/movements` | ESTUDIANTE; historial propio                                                  |
| POST   | `/credits/grants`       | ADMIN en desarrollo/pruebas; `{ userId, amount, reason }` y `Idempotency-Key` |

Reglas provisionales autorizadas: saldo inicial `0.00`, sin bienvenida; una hora = `1.00` crédito y 15 minutos = `0.25`. La reserva dura múltiplos de 15 minutos, de 15 minutos a 8 horas. Los importes HTTP son strings decimales de hasta dos cifras; el almacenamiento usa centavos exactos `bigint`.

`disponibles = saldo - creditos_retenidos` y `saldo >= creditos_retenidos >= 0`. Una solicitud pendiente no cambia la cuenta. Su aceptación crea las cuentas faltantes de ambos participantes y retiene el importe una sola vez. Cancelar libera una vez; las dos confirmaciones después del fin generan una única transferencia con débito/abono atómicos.

Las cargas exigen ADMIN activo, destino estudiante activo, monto positivo, motivo y clave de idempotencia; están bloqueadas en producción. Monto y saldo final no pueden superar `10000000000.00`. La misma clave y contenido no cargan otra vez. Los movimientos conservan fecha, cuenta, reserva cuando corresponda, tipo e importe; la carga conserva además su motivo.

Un fallo antes del commit descarta todas las escrituras y el resultado de idempotencia. Una respuesta perdida después del commit se recupera repitiendo la misma clave; no se vuelve a cobrar. La auditoría ADMIN está en `GET /exchanges/integrity` y no repara datos.

Son créditos de tiempo, sin pasarela monetaria. Las reglas/campos pertenecen al adaptador provisional, no a un esquema SQL validado. Datos e idempotencia se pierden al reiniciar y no coordinan instancias. Ver [contrato API](../../../docs/api-contract.md) y [reglas de negocio](../../../docs/business-rules.md).
