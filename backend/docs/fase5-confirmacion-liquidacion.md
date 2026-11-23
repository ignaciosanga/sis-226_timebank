# Fase 5: doble confirmación y liquidación exacta

Entrega local del 20 de noviembre de 2026, rama `feat/backend-nucleo-transaccional-parcial3`, base `18f3ccc6960e177769e13a0bdfccb66f8d7042c8`. Sin commit, push ni despliegue. Se conservan el trabajo sin commit, migraciones, reportes y herramientas de [fase 1](fase1-nucleo-transaccional-parcial3.md), [fase 2](fase2-cuentas-institucionales.md), [fase 3](fase3-ofertas-tutoria.md) y [fase 4](fase4-solicitudes-reservas.md).

## Alcance y destinos comprobados

`POST /reservations/:id/confirm` permite completar una reserva de oferta y pagar al tutor **exclusivamente el importe de `RESERVAS.creditos`**. La primera confirmación conserva la retención; la segunda liquida una vez. La capacidad real del esquema sigue determinando la habilitación:

| Entorno            | Destino SQL comprobado                                                                           | API y comportamiento                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Habitual           | `nexo_u_phase1`, OID `16384`, `127.0.0.1:55434`; nueve INTEGER                                   | [Swagger 4103](http://127.0.0.1:4103/docs): mantiene el flujo histórico entero y la publicación/consulta. Contratar ofertas continúa con `409 OFFER_PRICE_FLOW_PENDING`. |
| Ensayo persistente | `nexo_u_phase4_ensayo`, OID `19813`, mismo servidor; nueve NUMERIC sin typmod e `id_oferta` UUID | [Swagger 4105](http://127.0.0.1:4105/docs): solicitud, retención, cancelación y doble confirmación con pago decimal.                                                     |
| Prueba oficial     | `timebank_test_<16 hex>` desechable                                                              | Ejecuta instalación oficial y conversión provisional aislada. Nunca reconstruye las bases anteriores.                                                                    |

Readiness respondió 200 y `persistence: "postgresql"` en ambas APIs. La revisión SQL confirmó esos destinos y sus seis migraciones oficiales. Se actualizaron referencias remotas sin integrar otra rama:

| Referencia BD                 | Commit revisado                            |
| ----------------------------- | ------------------------------------------ |
| `origin/equipo/BD`            | `6216e8bc386357f8a0a5fa8044826284818fc4b7` |
| `origin/equipo/base-de-datos` | `5b7e0f62e3849b4dca6a0fbf552bb407aabd9388` |

Ambas entregas siguen usando INT en `database/db/init/01_schema_v0.31+.sql`; sus funciones de reporte también devuelven créditos enteros. No publicaron una conversión decimal compatible. Se conserva [el SQL provisional de fase 4](../scripts/fixtures/phase4-decimal-provisional.sql), fuera de `prisma/migrations`, sin volver a aplicarlo ni convertir la base habitual. Una reserva vinculada a oferta o fraccionaria sobre esquema entero conserva `409 DECIMAL_SETTLEMENT_PENDING`.

## Confirmación, transacción e idempotencia

La identidad procede de la sesión. Solo el solicitante y el tutor confirman su propia participación; ADMIN ajeno tampoco sustituye sus marcas. Se comprueba el estado vigente de ambas cuentas, además del JWT. Antes del fin de la clase se devuelve conflicto sin marcas, movimientos ni cambios financieros. Ambos órdenes están admitidos.

Dentro del borrador transaccional se relee la reserva y se exige una retención única vinculada a ella, del estudiante correcto y por el importe exacto pactado, sin liberación ni pago previos. También se comprueban saldo y retenido suficientes. La primera confirmación escribe únicamente su marca; repetir esa persona con otra clave mantiene la marca original y no representa a la contraparte.

Al llegar la segunda, se comprueba la capacidad del tutor frente a la cota vigente `2147483647`. Se consumen exactamente saldo y retención del estudiante; se suma el importe al saldo del tutor conservando sus propias retenciones. Segunda marca, estado `Completada`, `completed_at`, cuentas, dos movimientos e idempotencia se guardan conjuntamente. No se consulta el precio actual del catálogo ni se recalcula por duración.

Memoria conserva el borrador y commit único. PostgreSQL reutiliza `pg_advisory_xact_lock(22603112)` y la transacción existente entre instancias. Una escritura fallida o desborde revierte el intento completo, incluida la segunda marca; conserva una primera confirmación comprometida anteriormente. El ledger previo permanece inmutable. La cancelación usa el mismo protocolo: después del inicio requiere ADMIN; una reserva completada no se cancela y una cancelada no se paga. El único desenlace válido es liberación sin pago, o consumo/transferencia sin liberación.

Cada acción requiere `Idempotency-Key` de 16–128 caracteres permitidos. Su ámbito vigente es **actor + operación + clave**. Reutilizarla dentro de ese ámbito para otra reserva/contenido devuelve 409; otro actor u otra operación tienen ámbito propio. La última confirmación con la misma clave recupera su resultado, incluso tras reiniciar. Una clave nueva sobre una reserva completada devuelve su estado sin movimientos nuevos. La clave de la primera confirmación conserva su respuesta original `Confirmada`, aunque la reserva ya esté completada: consultar GET para conocer el estado actual.

## Pago observado y evidencia exacta

La prueba HTTP persistente usó una reserva independiente de 45 minutos por `"3.7"`, con estudiante en 10 y tutor en 0:

| Etapa                      | Saldo estudiante | Retenido | Disponible | Saldo tutor | Movimientos de esta reserva               |
| -------------------------- | ---------------: | -------: | ---------: | ----------: | ----------------------------------------- |
| Solicitud                  |               10 |        0 |         10 |           0 | 0                                         |
| Aceptación                 |               10 |      3.7 |        6.3 |           0 | 1 Retencion                               |
| Primera confirmación       |               10 |      3.7 |        6.3 |           0 | Sigue 1                                   |
| Misma persona, otra clave  |               10 |      3.7 |        6.3 |           0 | Sigue 1                                   |
| Segunda confirmación       |              6.3 |        0 |        6.3 |         3.7 | 1 Retencion + 1 Consumo + 1 Transferencia |
| Reintentos y reinicio real |              6.3 |        0 |        6.3 |         3.7 | Mismos tres UUID                          |

El disponible permanece en **6.3** al pagar: esos créditos ya estaban retenidos. Todos los importes HTTP son strings exactos, incluidos cantidad y snapshots:

| Movimiento               | Cantidad | Saldo anterior → posterior | Retenido anterior → posterior |
| ------------------------ | -------: | -------------------------- | ----------------------------- |
| Retencion del estudiante |  `"3.7"` | `"10" → "10"`              | `"0" → "3.7"`                 |
| Consumo del estudiante   | `"-3.7"` | `"10" → "6.3"`             | `"3.7" → "0"`                 |
| Transferencia al tutor   |  `"3.7"` | `"0" → "3.7"`              | `"0" → "0"`                   |

Reserva **Completada**, disponible para probar calificaciones y Mis clases: `34a80d0d-9652-41d6-a16c-f562c137a75c`. Sus movimientos son `46b45ff5-4a3a-4f30-a61c-cad0a850792b`, `394315ce-f7d5-4fa6-b6de-54f6399a6b39` y `f76a0ef5-a5a9-49eb-8f9b-29eb746d3583`. HTTP y SQL coincidieron en estados, marcas, cuentas y conteos. Después de detener y arrancar el proceso 4105 se repitió la última llamada con su clave y con otra: conservaron esos identificadores y un solo abono.

`GET /exchanges/integrity` devolvió `issues=[]`. Analytics, período `[2026-11-20T22:09:52.395Z, 2026-11-20T22:09:57.009Z)`, devolvió `transferidos: "3.7"` y una Transferencia; coincidió con COUNT/SUM SQL y se conservó tras reiniciar.

## Swagger: reserva sin confirmar para revisión personal

Reserva manual independiente: **`e558c093-ff70-488d-adf0-d89039759bae`**. Queda `Confirmada`, ambas marcas NULL, estudiante `"10" / "3.7" / "6.3"`, tutor `"0"`. Terminó el `2026-11-20T18:52:41.455Z`. No se ejecutó ninguna de sus confirmaciones.

Las credenciales están exclusivamente en `backend/.local/phase5/demo.private.json`: `manual.student.correo/password` y `manual.tutor.correo/password`. Los participantes de la reserva completada están bajo `automated.student` y `automated.tutor`. No copiar valores privados al reporte ni compartir sus Bearer.

1. Abrir [Swagger del ensayo](http://127.0.0.1:4105/docs). Ejecutar `POST /auth/login` con correo/password de `manual.student`; copiar `access_token` en **Authorize**. Consultar `/credits/me` y `/reservations/e558c093-ff70-488d-adf0-d89039759bae`.
2. Ejecutar `POST /reservations/e558c093-ff70-488d-adf0-d89039759bae/confirm`, cuerpo `{}`, `Content-Type: application/json` e `Idempotency-Key: fase5-swagger-estudiante-001`. El Bearer es del estudiante. Esperar 200, `Confirmada`, solo su marca y ningún pago.
3. Iniciar sesión como `manual.tutor` y sustituir la autorización. Ejecutar el mismo endpoint y cuerpo con `Idempotency-Key: fase5-swagger-tutor-001`. Esperar 200, `Completada`, ambas marcas y `completed_at`.
4. Con el tutor, consultar `/credits/me`: saldo `"3.7"`; `/credits/me/movements`: una Transferencia de esa reserva. Volver al Bearer del estudiante: saldo `"6.3"`, retenido `"0"`, disponible `"6.3"`; movimientos Retencion y Consumo. `/reservations/me` y GET de la reserva muestran la finalización.
5. Repetir la última confirmación con su clave original: conserva los identificadores y no paga de nuevo. Cada participante también puede confirmar con una clave nueva sin crear movimientos adicionales. ADMIN puede consultar integridad y `/analytics/credits?from=2026-11-20T22:09:52.395Z&to=2026-11-20T22:09:57.009Z` para inspeccionar el pago automatizado anterior.

También funciona tutor primero. La tabla describe estudiante primero para facilitar la revisión. Estos pasos consumen deliberadamente la reserva manual; para conservarla pendiente, limitarse a consultas GET.

## Fixtures, conservación y operación

Se crearon cuatro cuentas nuevas mediante registro y confirmación reales, con SMTP entregado a [Mailpit local](http://127.0.0.1:4104/). Una aplicación Nest de preparación, sin puerto permanente, seleccionó bono cero solo para activar los tutores; guardó su decisión sin inventar movimientos. Los estudiantes recibieron bono 8 y carga ADMIN 2. La política del servicio 4105 permaneció en 8.

Cada pareja publicó una oferta nueva, solicitó y aceptó por HTTP. Después, un fixture bajo el bloqueo asesor desplazó conjuntamente las fechas de **su propio horario, solicitud y reserva** a intervalos pasados coherentes de 45 minutos. No modificó Windows, el reloj de la API ni la validación temporal. Una pareja sirvió para automatizar el pago; la otra quedó sin marcas para Swagger. `.local/phase5/prepare-demo.cjs` conserva manifest y rechaza repetir sobre archivos existentes; `demo.cjs begin/finish` separa liquidación y comprobación tras reinicio.

El snapshot privado inicial cubre las quince tablas de negocio de ambas bases. La comparación preservó las 127 filas anteriores de la habitual y las 167 del ensayo, incluidos todos los UUID y el ledger; solo admite el cambio normal de `USUARIOS.ultimo_acceso` por login. La habitual mantiene 6 usuarios, 2 solicitudes, 2 reservas y 9 movimientos. No se aplicó SQL de conversión allí.

Se conservaron exactamente la reserva de fase 4 `165cacbc-1f83-408e-a487-fde68ce30f1d` y la oferta libre `72ec0e2c-41a2-473c-8051-000f6659c1b7`, que sigue apareciendo en catálogo. Swagger, OpenAPI, readiness, catálogo y banner respondieron 200 en ambas APIs; el banner conserva SHA-256. Mailpit también respondió 200. Son verificaciones HTTP/SQL; no se atribuye una prueba visual de navegador.

Se reutilizan entornos y gestores privados: `.local/phase3/api.cjs` administra la habitual y `.local/phase4/api.cjs` el ensayo. No se creó otro `.env` ni se trasladó la conexión. Estos gestores comprueban propiedad del PID y detienen solo su API, conservando PostgreSQL, Mailpit y volúmenes. Runtime: Node 26.8.2/npm 11.19.1 guardados en `.local/phase1/`.

## Pruebas y archivos de fase 5

| Comprobación oficial      | Línea base fase 4  | Resultado fase 5                                                                         |
| ------------------------- | ------------------ | ---------------------------------------------------------------------------------------- |
| `npm run prisma:validate` | Aprobado           | **Aprobado**                                                                             |
| `npm run build`           | Aprobado           | **Aprobado**                                                                             |
| `npm run lint`            | Aprobado           | **Aprobado**                                                                             |
| `npm test`                | 253/253; 25 suites | **253/253; 25 suites aprobadas**                                                         |
| `npm run test:e2e`        | 167/167; 8 suites  | **182/182; 9 suites aprobadas**                                                          |
| `npm run test:postgres`   | Aprobado           | **Aprobado**, todos los controles anteriores y casos A–G de fase 5 sobre PostgreSQL real |

El script PostgreSQL oficial terminó con código 0. Conservó los controles históricos, activación, bono único, publicación, retención y cancelación de las fases anteriores. El helper nuevo produjo estos resultados:

| Caso                 | Resultado observado en PostgreSQL real                                                                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A y B                | Estudiante primero y tutor primero en reservas independientes: tres movimientos por reserva y pago exacto de 3.7. Primera marca sin pago; reintentos y reapertura sin duplicados.                                                                 |
| C                    | Anticipación rechazada sin efectos; cuenta ajena rechazada; repetir una persona no sustituye a la contraparte.                                                                                                                                    |
| D: confirmaciones    | Dos instancias confirmaron simultáneamente con respuestas `[200,200]`, una sola Transferencia y un Consumo.                                                                                                                                       |
| D: cancelación       | Dos peticiones HTTP quedaron en espera del bloqueo PostgreSQL. Se comprobó cada ganador con orden de cola controlado: `[200,409]`; Cancelada con una Liberacion y cero pagos, o Completada con un Consumo, una Transferencia y cero liberaciones. |
| D: fallo y capacidad | Una FK real falló al insertar Transferencia: rollback de todas las tablas, primera marca conservada y reintento tras reapertura con un solo pago. Desborde del tutor: mismo rollback; corregida la causa, la misma clave terminó una vez.         |
| E                    | El estudiante terminó con saldo 6.3, retenido 2.1 y disponible 4.2; el tutor con saldo 13.7, retenido propio 1.2 y disponible 12.5. Sus otras reservas y movimientos quedaron idénticos.                                                          |
| F                    | Precio publicado cambiado a 9.9: el pago conservó el pacto reservado de 3.7.                                                                                                                                                                      |
| G                    | Clase histórica de 45 minutos por 3 liquidada una vez; integridad `issues=[]` y ningún movimiento duplicado.                                                                                                                                      |

Analytics del período exclusivo del caso A coincidió con SQL: una Transferencia de `"3.7"`, también después de reintentar y reabrir las instancias. La suite E2E completa terminó con 182/182 pruebas y nueve suites aprobadas. El pago persistente y el reinicio de la API local descritos arriba también se comprobaron por HTTP y SQL.

Inventario de esta fase, rutas relativas a `backend/`:

| Grupo              | Archivos                                                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Servicio y Swagger | `src/modules/exchanges/exchanges.service.ts`, `src/modules/reservations/reservations.controller.ts`, `src/config/configure-app.ts` |
| Documentación      | `README.md`, `src/modules/credits/README.md`, `docs/frontend-integration.md`, este reporte nuevo                                   |
| PostgreSQL oficial | `scripts/test-postgres.cjs`, `scripts/test-offer-requests.cjs`, `scripts/test-reservation-settlement.cjs` nuevo                    |
| E2E                | `test/offer-requests.e2e-spec.ts`, `test/reservation-settlement.e2e-spec.ts` nuevo                                                 |

No se cambió `integrity.ts`, la representación exacta ni el adaptador NUMERIC de fase 4. Evidencia ignorada en `.local/phase5/`: `baseline-results.json`, `demo-results.json`, `settlement-results.json`, `preservation-results.json`, `links-results.json`, `swagger-demo.json`, `habitual-guard-results.json` y logs oficiales. Snapshots `*.private.json` y credenciales permanecen privados. El control habitual con el código de fase 5 volvió a devolver `409 OFFER_PRICE_FLOW_PENDING`, sin solicitudes, reservas, movimientos ni retenciones nuevas.

## Dependencias de BD y Frontend

La habilitación decimal habitual requiere entrega acordada de BD, actualización coordinada del esquema/cliente Prisma y validación sobre una copia antes de tocar el destino habitual. El SQL provisional no es una migración oficial. La bandera conjunta **`VITE_TUTORING_API_ENABLED=false`** se conserva hasta el acuerdo entre frentes. Esta entrega aporta una reserva completada para integración; no declara implementados endpoints nuevos de calificaciones ni verificados Google real o Calendar remoto.
