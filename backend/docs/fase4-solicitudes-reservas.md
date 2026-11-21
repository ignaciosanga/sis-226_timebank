# Fase 4: solicitudes de ofertas, reserva y retención exacta

Entrega local del 20 de noviembre de 2026, rama `feat/backend-nucleo-transaccional-parcial3`, base `18f3ccc6960e177769e13a0bdfccb66f8d7042c8`. Sin commit, push ni despliegue. Se conservan los reportes y el trabajo de [fase 1](fase1-nucleo-transaccional-parcial3.md), [fase 2](fase2-cuentas-institucionales.md) y [fase 3](fase3-ofertas-tutoria.md), incluidas sus migraciones, correo local, ofertas y banners.

## Alcance habilitado y dependencia de BD

El dominio y el contrato HTTP permiten solicitar una oferta al precio publicado y aceptarla con una sola reserva y una retención exacta. La habilitación efectiva depende del esquema de la base: **la base habitual conserva INTEGER y su protección 409; el recorrido decimal se demuestra en una copia aislada con SQL provisional**.

| Entorno                   | Base PostgreSQL                              | API                           | Alcance observado                                                                                                                                                                                        |
| ------------------------- | -------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Demostración habitual     | `nexo_u_phase1`, `127.0.0.1:55434`           | `http://127.0.0.1:4103`       | Nueve créditos INTEGER. La contratación de ofertas sigue devolviendo `409 OFFER_PRICE_FLOW_PENDING`, sin efectos financieros. Conserva los intercambios históricos y la publicación/consulta de ofertas. |
| Ensayo aislado            | `nexo_u_phase4_ensayo`, mismo servidor local | `http://127.0.0.1:4105`       | Nueve créditos NUMERIC sin typmod. Solicitud, aceptación y cancelación con precio exacto de oferta. El SQL aplicado es provisional y está fuera del historial oficial.                                   |
| Prueba oficial PostgreSQL | `timebank_test_<16 hex>` desechable          | Puertos temporales del script | Instalación oficial original y ensayo decimal posterior en esa base de pruebas; no reconstruye la base habitual. Su resultado final se registra en la sección de pruebas.                                |

Las referencias remotas se actualizaron sin cambiar de rama. Las entregas disponibles de BD siguen usando créditos enteros:

| Referencia revisada           | Commit                                     | Archivos relevantes                                                                                                                       |
| ----------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `origin/equipo/BD`            | `6216e8bc386357f8a0a5fa8044826284818fc4b7` | `database/db/init/01_schema_v0.31+.sql`, `database/db/init/04_vistas_bd_v2.sql`, `base de datos v0.31.sql`.                               |
| `origin/equipo/base-de-datos` | `5b7e0f62e3849b4dca6a0fbf552bb407aabd9388` | `database/db/init/01_schema_v0.31+.sql`, `database/db/init/04_vistas_bd_v2.sql`, `database/base de datos v0.31.sql`, `database/LEEME.md`. |

No se encontró una migración decimal publicada y acordada para integrar. El ensayo usa [scripts/fixtures/phase4-decimal-provisional.sql](../scripts/fixtures/phase4-decimal-provisional.sql), identificado expresamente como provisional. No se añadió a `prisma/migrations`, no se reescribieron migraciones anteriores y no se convirtió la base habitual. Se preservaron las seis filas oficiales de `_prisma_migrations` en la copia.

El SQL solo admite `nexo_u_phase4_ensayo` o nombres desechables `timebank_test_<16 hex>`. Comprueba la presencia de las migraciones locales de verificación institucional y ofertas, espera los nueve INTEGER originales y rechaza repetir la conversión. Todo el ensayo SQL comparte una transacción y el bloqueo asesor del backend; una dependencia desconocida impide continuar. Esta compatibilidad local no equivale a aprobación de BD.

Para habilitar la base habitual falta que BD entregue o acuerde la conversión decimal, sus dependencias y el vínculo a oferta; alinear con esa entrega el esquema y cliente de Prisma, que hoy conservan Int deliberadamente; y validar la actualización sobre una copia antes de aplicarla al destino habitual. El backend detecta la capacidad real de las columnas; una variable de entorno o una bandera de Frontend no habilita por sí sola el recorrido.

## Representación exacta y consumidores

Se revisan los nueve campos financieros:

| Tabla                     | Campos                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| `USUARIOS`                | `saldo`, `creditos_retenidos`                                                                |
| `SOLICITUDES_INTERCAMBIO` | `creditos_requeridos`                                                                        |
| `RESERVAS`                | `creditos`                                                                                   |
| `MOVIMIENTOS_CREDITO`     | `cantidad`, `saldo_anterior`, `saldo_posterior`, `retenidos_anterior`, `retenidos_posterior` |

El dominio y HTTP usan texto canónico: `"10"`, `"3.7"`, `"6.3"`. También son strings los campos originales de reserva y movimiento, incluidos `cantidad` y los snapshots, además de sus alias `monto`, `monto_creditos` y `costo_creditos`. Los contadores siguen siendo números. La cuenta devuelve `unidad: "CREDITO"` en el esquema decimal y `"CREDITO_15_MINUTOS"` en el esquema entero histórico.

`credits.ts` suma, resta y compara décimas mediante enteros escalados `bigint`; nunca convierte el texto decimal directamente con `BigInt` ni usa flotantes para el ledger. La entrada HTTP admite enteros o una décima; rechaza `"3.70"`, centésimas y notación exponencial. El adaptador puede normalizar ceros que provengan de NUMERIC, por ejemplo `"3.700"` a `"3.7"`, sin redondear. Conserva la cota técnica histórica **2147483647 por importe**, pendiente de un acuerdo posterior: no la amplía por el máximo técnico de publicación de ofertas. Una oferta publicada por encima de esa cota no se puede contratar con el ledger actual.

El adaptador PostgreSQL selecciona esos valores como `::text` y escribe parámetros NUMERIC separados del SQL. En el camino INTEGER solo convierte a número un entero previamente validado dentro de la cota anterior; rechaza cualquier fracción. `Prisma` mantiene el esquema oficial entero: las operaciones provisionales NUMERIC utilizan el adaptador SQL explícito, sin declarar como oficial una migración que BD todavía no entregó.

`detectCreditSchema` exige nueve INTEGER, o nueve NUMERIC más `SOLICITUDES_INTERCAMBIO.id_oferta` UUID. En el segundo caso acepta NUMERIC sin typmod o una definición con escala al menos 1 y capacidad para diez dígitos enteros. Rechaza mezclas, columnas ausentes, `NUMERIC(p,0)`, escalas negativas y capacidad insuficiente. Así se evita que PostgreSQL redondee `3.7` a `4` después de validar el borrador transaccional. La política del dominio continúa limitada a décimas aunque una columna admita mayor escala.

Se adaptaron el escritor del bono, usuarios, movimientos, reservas, auditoría de integridad y fixtures a esa representación. El bono cero sigue guardando su decisión definitiva sin movimiento; un desborde conserva la respuesta de conflicto y revierte la operación. Analytics obtiene las sumas de créditos como texto SQL y conserva fracciones y signo, sin aplicar `BigInt` a una cadena decimal. Los totales agregados pueden superar la cota de una cuenta; sus contadores y minutos se tratan por separado.

La comprobación real `GET http://127.0.0.1:4105/analytics/credits`, con sesión ADMIN, respondió 200 y coincidió exactamente con SUM de PostgreSQL: `saldoTotalActual: "52"`, `retenidosActuales: "3.7"` y retenciones históricas `"9.7"`, todos strings. Las vistas de solicitud/reserva y las tres funciones de créditos devolvieron `3.7`. Como `fn_solicitudes_recibidas` solo lista pendientes, su control utilizó un fixture de estado dentro de `BEGIN ... ROLLBACK`; no dejó cambios persistentes. Las otras dos funciones se comprobaron con la solicitud/reserva vigente del ensayo.

## Conservación de datos y objetos SQL

Antes de preparar el ensayo se comprobó el destino habitual: host `127.0.0.1`, puerto `55434`, base `nexo_u_phase1`, usuario `nexo_phase1`, PostgreSQL 16.15 y readiness de la API. Se exportó un snapshot consistente y un `pg_dump` privado. Se restauró en `nexo_u_phase4_ensayo` y se verificó igualdad antes de convertir. Se copiaron los bytes del banner a un directorio privado independiente de fase 4.

La comparación de las **15 tablas de negocio** preservó filas, UUID y valores anteriores. Los enteros se comparan como importes exactos: 10 continúa valiendo 10, sin reinterpretarlo como décimas. Las solicitudes históricas conservan `id_oferta` vacío; la conversión no inventó vínculos a las dos solicitudes anteriores. El SHA-256 del snapshot histórico normalizado fue `aae63cfa9591ef8acb036cbc03135221195377b7fef8ede7d8e37d36b423f267`.

| Verificación de actualización en la copia                | Resultado observado                                                                             |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Restauración y conversión de las 15 tablas               | Igualdad exacta de datos históricos y UUID.                                                     |
| Nueve campos de crédito                                  | INTEGER antes; NUMERIC sin typmod después.                                                      |
| Solicitudes históricas con oferta inventada              | 0.                                                                                              |
| Vistas de reporte                                        | 32 conservadas. El SQL reconstruye las nueve vistas dependientes de créditos dentro del ensayo. |
| Funciones de reporte                                     | 4 conservadas; las tres que devuelven créditos ajustan esos retornos a NUMERIC.                 |
| Propietarios, configuración de seguridad y ACL efectivas | Conservados en la comparación de metadatos.                                                     |
| Migraciones oficiales                                    | 6 registros preservados, sin añadir la conversión provisional.                                  |
| Banner anterior                                          | 1 copiado; tamaño y SHA-256 comprobados.                                                        |

El SQL guarda definiciones, propietarios, opciones, comentarios y permisos de las dependencias afectadas y usa `DROP ... RESTRICT`. Una dependencia adicional desconocida aborta el ensayo en lugar de eliminarla mediante cascada. La revisión de BD debe considerar esas vistas, funciones, permisos y los consumidores de Analytics, además de las nueve columnas.

Después de reiniciar la API habitual con el código de fase 4 se compararon de nuevo `USUARIOS`, `SOLICITUDES_INTERCAMBIO`, `RESERVAS` y `MOVIMIENTOS_CREDITO` contra el snapshot previo. Persisten **6 usuarios, 2 solicitudes, 2 reservas y 9 movimientos**, sin cambios financieros ni de historia. Solo se permite la modificación normal de `ultimo_acceso` por login; esos accesos también pueden generar auditoría normal. El hash de esta proyección financiera fue `2a2ea88bda4f0bd1cb6c4053a435dca8b3865d6d2bd358bcf0284762a19c0c69`.

En esa base habitual, intentar solicitar la oferta original de `"3.7"` devolvió **409 `OFFER_PRICE_FLOW_PENDING`**. Después se verificaron cero solicitudes, reservas y movimientos nuevos, y la misma retención. La cuenta de control habitual conservó saldo `"8"`, retenido `"0"` y disponible `"8"`. La comprobación se repitió con la API reiniciada y el código final; `habitual-results-final.json` conserva el mismo resultado y hash financiero.

## Solicitud, aceptación y cancelación

Se reutiliza `POST /exchanges`. Recibe `providerId`, `skillId`, `availabilityId`, `fechaInicio`, `fechaFin`, `descripcion` opcional y `offerId` opcional. La identidad del solicitante sale de la sesión. El servidor resuelve la oferta por su horario específico, comprueba tutor, materia, nivel y clase completa, y verifica la correspondencia de `offerId` si el cliente lo envía. No acepta un importe elegido por el cliente.

Al crear copia `OFERTAS.costo_creditos` a `creditos_requeridos` y guarda `id_oferta`. Exige cuentas activas, participantes distintos, habilidad publicada, oferta contratable y horario futuro. No retiene saldo, no crea reserva ni ocupa definitivamente el horario. Una oferta que dejó de estar vigente produce conflicto; no cae en la tarifa por duración.

Los horarios anteriores sin oferta conservan el contrato histórico: 45 minutos equivalen a `"3"` créditos. Una oferta de 45 minutos por `"3.7"` guarda ese precio independiente de la duración. La auditoría distingue ambos caminos y comprueba igualdad entre precio de solicitud y reserva; no compara el snapshot contra el precio actual del catálogo.

`POST /exchanges/:id/accept`, cuerpo `{}`, exige Bearer del tutor destinatario y `Idempotency-Key`. Dentro de la transacción vuelve a comprobar estado, participantes, horario, saldo disponible y cruces de ambos participantes, incluso con roles invertidos en otras reservas. Copia el importe pactado de la solicitud a `RESERVAS.creditos`; actualiza solicitud y horario, crea una reserva y registra la retención con sus snapshots. El catálogo deja de ofrecer ese horario ocupado. El tutor todavía no recibe pago.

Memoria utiliza un borrador y commit único. PostgreSQL obtiene `pg_advisory_xact_lock(22603112)` antes de cargar el estado y persiste usuario, solicitud, horario, reserva, movimiento, metadatos e idempotencia en la misma transacción. Una excepción descarta todas las escrituras. Las garantías entre instancias requieren que otros escritores respeten el protocolo; las restricciones persistentes agregan defensas y no sustituyen esa coordinación.

Cada acción requiere su propia clave de idempotencia de 16–128 caracteres. Repetir la misma acción con la misma clave y cuerpo recupera el resultado persistido, incluso tras reiniciar. Reutilizar la clave con contenido incompatible devuelve 409. Las respuestas idempotentes históricas que guardaban importes enteros como números se normalizan al contrato monetario string al recuperarlas.

Rechazar una solicitud pendiente mediante `POST /exchanges/:id/reject`, cuerpo `{}`, no crea reserva ni modifica créditos. Cancelar una reserva confirmada mediante `POST /reservations/:id/cancel`, `{ "motivo": "No podré asistir" }`, libera el importe reservado exacto sin pagar al tutor. Antes del inicio lo puede hacer un participante; después requiere ADMIN. Una reserva completada no se cancela. Se mantiene `OFFER_AVAILABILITY_MANAGED` para impedir modificar por separado el horario propio de una oferta.

| Código de conflicto          | Comportamiento                                                                            |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| `OFFER_PRICE_FLOW_PENDING`   | La base conserva créditos enteros: no habilita contratación de ofertas.                   |
| `OFFER_MISMATCH`             | El identificador o las fechas no corresponden al contexto completo de la oferta.          |
| `OFFER_NOT_AVAILABLE`        | La oferta o su horario ya no permiten contratar.                                          |
| `OFFER_SNAPSHOT_REQUIRED`    | Una solicitud anterior no tiene vínculo/precio pactado de oferta para esa aceptación.     |
| `OFFER_AVAILABILITY_MANAGED` | El horario de oferta no se modifica por separado.                                         |
| `DECIMAL_SETTLEMENT_PENDING` | Confirmación y liquidación de reservas de oferta o fraccionarias protegidas hasta fase 5. |

La [guía de Frontend](frontend-integration.md#fase-4-solicitud-a-precio-publicado-y-retención-exacta) y Swagger describen los cuerpos, strings, errores y reintentos. Frontend debe conservar `data.code`, usar el horario de la oferta, mantener los importes como texto y conservar **`VITE_TUTORING_API_ENABLED=false`** mientras la bandera conjunta dependa de funciones pendientes de otros frentes.

## Resultados observados por HTTP en el ensayo

Se usó un estudiante de desarrollo nuevo en `nexo_u_phase4_ensayo`. Su correo institucional se confirmó mediante SMTP real contra Mailpit local; recibió un bono de 8 una sola vez. Una carga ADMIN de 2 dejó el saldo de entrada en 10. Los movimientos de esta tabla son el total de esa cuenta, incluidos bono y ajuste:

| Paso observado                | Saldo  | Retenido | Disponible | Movimientos de la cuenta            |
| ----------------------------- | ------ | -------- | ---------- | ----------------------------------- |
| Registro pendiente            | `"0"`  | `"0"`    | `"0"`      | 0                                   |
| Correo confirmado, bono único | `"8"`  | `"0"`    | `"8"`      | 1 `BonoInicial`                     |
| Carga ADMIN +2                | `"10"` | `"0"`    | `"10"`     | 2: bono y ajuste                    |
| Solicitud creada y repetida   | `"10"` | `"0"`    | `"10"`     | 2                                   |
| Aceptación y reintento        | `"10"` | `"3.7"`  | `"6.3"`    | 3: se añade una `Retencion`         |
| Reinicio real y reintentos    | `"10"` | `"3.7"`  | `"6.3"`    | Siguen siendo 3; una sola retención |

La oferta costaba `"3.7"` al solicitar. Un fixture controlado modificó únicamente el precio publicado a `"4.2"` antes de aceptar, bajo el bloqueo transaccional; no se añadió un endpoint de edición. Solicitud y reserva conservaron `"3.7"`.

- Solicitud: `8f43b003-e565-41af-b867-e4bc98920637`.
- Reserva: `165cacbc-1f83-408e-a487-fde68ce30f1d`.
- Retención: `0e165437-2608-4cda-84b4-860e840cfa8b`, cantidad `"3.7"`, saldo `"10" → "10"`, retenidos `"0" → "3.7"`.

Se detuvo y arrancó el proceso propio de la API con la misma base de ensayo. Repetir solicitud y aceptación conservó los identificadores, saldo y movimiento. La verificación también se repitió después del arranque con el código final. El tutor mantuvo su cuenta e historial anteriores, sin transferencia. La oferta ocupada desapareció del catálogo. La reserva se dejó **Confirmada**, con cero confirmaciones y retención de 3.7, para revisión local.

Una llamada a `/reservations/165cacbc-1f83-408e-a487-fde68ce30f1d/confirm` devolvió **409 `DECIMAL_SETTLEMENT_PENDING`** sin guardar confirmación ni consumir saldo. El bloqueo también alcanza reservas de oferta con precio entero, antes de cualquier efecto; la liquidación de ofertas se reserva a fase 5.

La tabla siguiente separa el escenario general de saldo 10 del registro/bono usados para prepararlo. Los movimientos cuentan solo los del recorrido de reserva, sin bono ni ajuste:

| Escenario                             | Saldo  | Retenido | Disponible | Movimientos del recorrido                  |
| ------------------------------------- | ------ | -------- | ---------- | ------------------------------------------ |
| Inicio y solicitud pendiente          | `"10"` | `"0"`    | `"10"`     | 0                                          |
| Aceptación                            | `"10"` | `"3.7"`  | `"6.3"`    | 1 `Retencion`                              |
| Reintento / reinicio                  | `"10"` | `"3.7"`  | `"6.3"`    | Sigue habiendo 1                           |
| Rechazo pendiente, caso separado      | `"10"` | `"0"`    | `"10"`     | 0                                          |
| Cancelación confirmada, caso separado | `"10"` | `"0"`    | `"10"`     | 2: retención y liberación; pago al tutor 0 |

El renglón de rechazo supone un alumno sin retenciones previas y está cubierto por E2E. En el caso F de PostgreSQL, el alumno ya tenía aceptada la reserva A: rechazar otra solicitud conservó exactamente `"10" / "3.7" / "6.3"`, sin reserva ni movimiento nuevo por ese rechazo. La cancelación se comprobó en un escenario separado y terminó en `"10" / "0" / "10"`. No corresponde a cancelar la reserva que se dejó confirmada para la demo persistente.

## Pruebas oficiales y casos A–G

| Comprobación              | Fase 3 registrada | Fase 4, estado de esta revisión                                                                                                                 |
| ------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run prisma:validate` | Aprobado          | **Aprobado**.                                                                                                                                   |
| `npm run build`           | Aprobado          | **Aprobado**.                                                                                                                                   |
| `npm run lint`            | Aprobado          | **Aprobado**.                                                                                                                                   |
| `npm test`                | 208 pruebas       | **253/253**, 25 suites aprobadas.                                                                                                               |
| `npm run test:e2e`        | 154 pruebas       | **167/167**, 8 suites aprobadas.                                                                                                                |
| `npm run test:postgres`   | Aprobado          | **Aprobado**: controles históricos, activación, ofertas y todos los escenarios de fase 4 sobre PostgreSQL real con esquema decimal provisional. |

Las suites unitarias/E2E utilizan memoria y mocks cuando corresponde; no sustituyen PostgreSQL real. Cubren los strings monetarios, snapshot de oferta, aceptación/cancelación exacta, protección de base entera, precio no editable por el cliente, permisos y bloqueo de liquidación. Las pruebas de esquema incluyen mezclas de tipos, typmods redondeadores y capacidad insuficiente. La extracción del código PostgreSQL también cubre los metadatos del adaptador de Prisma para que la violación inducida de FK se traduzca a 409 y conserve el rollback.

El script oficial sigue ejecutando sus escenarios históricos, activación y publicación de ofertas. Después incorpora `scripts/test-offer-requests.cjs` sobre la base desechable convertida mediante el SQL provisional. El diseño de los casos es:

| Caso solicitado | Objetivo de la comprobación PostgreSQL                                                                    | Evidencia actual de esta revisión                                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A               | Clase de 45 minutos por 3.7 con saldo 10; solicitar sin retener y aceptar con reserva/retención 3.7.      | Aprobado: 10/0/10 al solicitar y 10/3.7/6.3 al aceptar; una reserva, una retención, pago 0.                                                            |
| B               | Cambiar el precio del catálogo antes de aceptar; mantener 3.7 en solicitud y reserva.                     | Observado: catálogo 4.2, pacto 3.7.                                                                                                                    |
| C               | Disponible 3.6 insuficiente; ninguna reserva, movimiento ni retención parcial.                            | Aprobado: saldo 3.6, retenido 0, cero reservas y movimientos nuevos.                                                                                   |
| D               | Dos aceptaciones entre instancias, una reserva/retención y replay tras reapertura.                        | Aprobado: ambas respuestas 200 con una reserva/retención; reapertura conserva los mismos identificadores. Reinicio real de proceso también comprobado. |
| E               | Competencia por un horario y, por separado, por saldo que alcanza para una aceptación.                    | Aprobado: [200,409] para ambas carreras. Saldo de 5 queda retenido 3.7 y disponible 1.3. Cruce de participantes con roles invertidos: 409 sin efectos. |
| F               | Rechazo sin efectos y cancelación confirmada con liberación exacta de 3.7, sin pago.                      | Aprobado: rechazo conserva la retención previa sin efectos nuevos; cancelación/replay deja 10/0/10, dos movimientos, una liberación y pago 0.          |
| G               | Horario histórico de 45 minutos por 3, sin oferta; registro, bono único y publicación siguen funcionando. | Aprobado: precio 3, retenido 3, disponible 7 e id_oferta NULL; se mantienen los controles originales de registro y bono.                               |

El fallo real de FK al escribir la retención devolvió 409 y revirtió usuario, solicitud, horario, reserva, ledger e idempotencia. El reintento posterior creó una reserva y una retención. El control de fase 5 devolvió `409 DECIMAL_SETTLEMENT_PENDING` con cero consumos y cero pagos. La ejecución oficial completa quedó aprobada después de corregir la extracción de errores del adaptador SQL de Prisma.

Al finalizar se comprobó que no quedaban bases desechables `timebank_test_*` de la ejecución. La copia de ensayo persistente se conserva para la demostración; la base habitual mantiene sus datos y tipos anteriores.

SMTP se probó realmente con Mailpit, sin correo externo. Google continúa limitado a las pruebas simuladas existentes; esta fase no acredita login Google real ni Calendar remoto. Las comprobaciones locales descritas son HTTP/SQL; no se declara una prueba visual de navegador ejecutada.

## Ejemplos actuales para Swagger

En el ensayo se dejó otra oferta de `"3.7"` con horario libre, distinta de la reserva confirmada anterior. Su tutor se activó mediante SMTP local real. Al momento de preparar este reporte seguía disponible:

`72ec0e2c-41a2-473c-8051-000f6659c1b7`.

1. Abrir [Swagger del ensayo](http://127.0.0.1:4105/docs). Iniciar sesión como un estudiante activo distinto del tutor y autorizar con su Bearer. Para repetir el caso saldo 10 desde cero, registrar y confirmar un estudiante propio; el bono actual es 8 y ADMIN puede cargar `"2"` con `/credits/grants`. Conservar las credenciales de desarrollo en los archivos privados locales; no copiarlas al reporte.
2. En `POST /exchanges`, usar una `Idempotency-Key` nueva y este cuerpo real, sin importe del cliente:

```json
{
  "providerId": "09732931-87e8-4fe3-91b2-27e99a7c4a87",
  "skillId": "20000000-0000-4000-8000-000000000002",
  "availabilityId": "e47ff58f-e67d-441c-8083-4afcf4202ad8",
  "offerId": "72ec0e2c-41a2-473c-8051-000f6659c1b7",
  "fechaInicio": "2026-11-28T18:00:00.000Z",
  "fechaFin": "2026-11-28T18:45:00.000Z",
  "descripcion": "Practica desde Swagger: precio pactado 3.7 sin elegir importe en el cliente"
}
```

3. Conservar `id_solicitud` de la respuesta 201. Comprobar `id_oferta`, `creditos_requeridos: "3.7"`, `costo_creditos: "3.7"` y estado `Solicitada`. Consultar `/credits/me`: crear la solicitud no cambia saldo ni retenido.
4. Autorizar Swagger con la sesión del tutor `09732931-87e8-4fe3-91b2-27e99a7c4a87`. En `POST /exchanges/{id}/accept`, usar el `id_solicitud` recién devuelto, otra `Idempotency-Key` y cuerpo `{}`. La respuesta 200 debe contener una reserva `Confirmada` por `"3.7"`. Usar esa identidad de tutor requiere sus credenciales locales; una sesión del estudiante solicitante devuelve 403.
5. Volver a la sesión del estudiante y consultar `/credits/me`, `/credits/me/movements` y `/reservations/me`. Con saldo de entrada 10 y retenido inicial 0, esperar `"10" / "3.7" / "6.3"` y una retención. Repetir la aceptación con su clave original mantiene la misma reserva.
6. Para probar cancelación en esta nueva reserva, usar `/reservations/{id_reserva}/cancel`, una clave de cancelación nueva y `{ "motivo": "Prueba local de liberación exacta" }`. Debe recuperar disponible `"10"`, retenido `"0"` y añadir una sola `Liberacion`, sin transferencia. No cancelar la reserva anterior si se quiere conservar la evidencia confirmada de reinicio.

Las fechas del ejemplo son futuras respecto a esta entrega; si el horario ya pasó o fue contratado, publicar otra oferta y copiar sus UUID y fechas. Las credenciales del tutor de esta oferta nueva están en `swaggerTutor` dentro de `.local/phase4/demo.private.json`; las del estudiante de la demo previa están en `student`, cuya cuenta ya tiene otra retención. Para la tabla de saldo 10 y retenido inicial 0, usar el estudiante nuevo preparado en el paso 1. Agregar o quitar `offerId` durante un reintento cambia el cuerpo: conservar la petición original con su clave.

Para inspeccionar la reserva ya demostrada, `GET /reservations/165cacbc-1f83-408e-a487-fde68ce30f1d` requiere sesión de uno de sus participantes. El tutor original puede repetir `POST /exchanges/8f43b003-e565-41af-b867-e4bc98920637/accept`, `{}`, para recuperar la reserva existente; no crea otro cobro. El catálogo original fue modificado a 4.2 únicamente como fixture de la prueba B y su horario permanece ocupado.

### Enlaces comprobados

Todos los siguientes recursos respondieron 200 durante la verificación local. Readiness indicó `postgresql` en ambas APIs; OpenAPI y las respuestas de cuenta/movimientos conservaron los importes como strings.

| Recurso           | Habitual                                                                                       | Ensayo aislado                                                                                   |
| ----------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Swagger           | [4103/docs](http://127.0.0.1:4103/docs)                                                        | [4105/docs](http://127.0.0.1:4105/docs)                                                          |
| OpenAPI           | [4103/docs-json](http://127.0.0.1:4103/docs-json)                                              | [4105/docs-json](http://127.0.0.1:4105/docs-json)                                                |
| Readiness         | [4103/health/ready](http://127.0.0.1:4103/health/ready)                                        | [4105/health/ready](http://127.0.0.1:4105/health/ready)                                          |
| Catálogo          | [4103/tutoring/offers](http://127.0.0.1:4103/tutoring/offers?page=1&limit=100)                 | [4105/tutoring/offers](http://127.0.0.1:4105/tutoring/offers?page=1&limit=100)                   |
| Banner conservado | [Banner habitual](http://127.0.0.1:4103/tutoring/banners/c1de35a6-6aea-4261-b694-3f3a4aad3dd4) | [Banner del ensayo](http://127.0.0.1:4105/tutoring/banners/c1de35a6-6aea-4261-b694-3f3a4aad3dd4) |

Mailpit local: [http://127.0.0.1:4104](http://127.0.0.1:4104/), también comprobado con respuesta 200. Sus mensajes corresponden a desarrollo local y no se entregan a UCB. Las URLs con credenciales de correo, Bearer, contraseñas y dumps no se incluyen en documentación pública.

## Operación local del ensayo

Las APIs habitual y de ensayo quedan ejecutándose en sus puertos respectivos, sin mover HEAD ni crear commit. Los scripts privados de fase 4 administran únicamente el proceso de la API de ensayo:

```powershell
Set-Location 'C:\Users\GONZALO APAZA\Desktop\Backend_\BancoTiempo\backend'
& .\.local\phase4\stop.ps1
& .\.local\phase4\start.ps1
```

No detienen Mailpit, PostgreSQL ni la API habitual. El gestor comprueba su archivo de entorno, el destino de la copia y la propiedad del PID antes de detener el proceso. Reutiliza el Node 26.8.2 conservado de fase 1. Los volúmenes, la base de ensayo y su almacenamiento de banners permanecen disponibles entre reinicios. Para recompilar cambios se debe ejecutar build con el runtime local conservado y después reiniciar solo la API propia correspondiente.

## Inventario de cambios de fase 4

Rutas relativas a `backend/`. Esta lista distingue las ampliaciones de fase 4 de los archivos ya incorporados por fases anteriores; no atribuye a esta fase la creación del módulo de ofertas, banners, SMTP ni las migraciones de verificación/ofertas.

| Grupo                                    | Archivos añadidos o ampliados en esta fase                                                                                                                                                                                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adaptación PostgreSQL y guard de esquema | `src/infrastructure/prisma/prisma-credit-sql.ts` y su spec (nuevos); `prisma-exchange.repository.ts` ampliado.                                                                                                                                                          |
| Ensayo decimal                           | `scripts/fixtures/phase4-decimal-provisional.sql` (nuevo, fuera de migraciones).                                                                                                                                                                                        |
| Dominio financiero                       | `src/modules/exchanges/credits.ts`, su spec, `exchange.types.ts`, `memory-exchange.repository.ts`, `integrity.ts` y su spec.                                                                                                                                            |
| Flujo y contrato HTTP                    | `src/modules/exchanges/exchanges.service.ts`, `exchanges.controller.ts`, `dto/create-exchange.dto.ts`, `dto/exchange-responses.dto.ts`; `src/modules/reservations/reservations.controller.ts`; `src/modules/credits/dto/grant-credits.dto.ts`.                          |
| Bono y usuario                           | `src/modules/auth/account-activation.ts` ampliado y `account-activation.spec.ts` nuevo; `src/modules/users/user.types.ts`, `memory-users.repository.ts` y su spec.                                                                                                      |
| Analytics                                | `src/modules/analytics/analytics.repository.ts`, `analytics.controller.ts`; `analytics.repository.spec.ts` nuevo.                                                                                                                                                       |
| Errores y Swagger                        | `src/common/filters/http-exception.filter.ts`, `src/config/configure-app.ts`, más los DTO y controladores anteriores.                                                                                                                                                   |
| Fixtures y unitarias anteriores          | `src/modules/exchanges/test-fixtures.ts`, `memory-exchange.repository.spec.ts`; `src/modules/skills/issue-9.spec.ts`.                                                                                                                                                   |
| Integración PostgreSQL                   | `scripts/test-offer-requests.cjs` nuevo; `scripts/test-postgres.cjs` ampliado para ejecutar el ensayo.                                                                                                                                                                  |
| E2E                                      | `test/offer-requests.e2e-spec.ts` nuevo; expectativas monetarias ajustadas en `test/exchanges-integrity.e2e-spec.ts`, `test/account-activation.e2e-spec.ts` y `test/tutoring-offers.e2e-spec.ts`, conservando sus controles de permisos, saldo, estados e idempotencia. |
| Documentación                            | `README.md`, `src/modules/credits/README.md`, apéndice de fase 4 en `docs/frontend-integration.md` y este reporte nuevo.                                                                                                                                                |

La preparación, gestores de procesos, comprobadores y evidencias nuevos quedan ignorados en `.local/phase4/`. `demo-results.json`, `upgrade-results.json`, `habitual-results.json`, `habitual-results-final.json`, `analytics-results.json` y los logs `final-*` de comprobación registran resultados. `*.private.json`, `.env.phase4` y los dumps contienen credenciales, hashes o datos internos y no deben compartirse ni versionarse. Se conserva `.local/phase1/`, `.local/phase2/` y `.local/phase3/`.

## Dependencias exactas de fase 5

La fase 5 debe habilitar la doble confirmación y el pago al tutor **sobre el importe reservado**, sin volver a leer el precio del catálogo ni recalcularlo por duración. Debe validar quién confirma y cuándo, guardar cada confirmación una sola vez y, al existir ambas, consumir exactamente el saldo y la retención del estudiante y transferir ese importe al tutor en un commit único.

Ese recorrido debe mantener snapshots exactos, ledger inmutable, control de capacidad del destinatario, roles/estado actuales, concurrencia entre instancias, replay tras reinicio y rollback ante cualquier fallo intermedio. También debe resolver las carreras entre cancelación y confirmación, impedir pago doble y preservar el historial entero anterior. Los controles de opiniones, notificaciones o exposición conjunta del Frontend que dependan de otros frentes deben acordarse antes de activar la bandera compartida.

Hasta disponer de esa implementación y sus pruebas, toda reserva de oferta o fraccionaria conserva `DECIMAL_SETTLEMENT_PENDING` al confirmar y no paga al tutor. La integración decimal habitual depende además de la entrega acordada de BD; el ensayo provisional no habilita ese cambio en `nexo_u_phase1`.
