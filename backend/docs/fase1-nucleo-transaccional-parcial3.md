# Fase 1 del núcleo transaccional de Nexo U

Revisión local del 20 de noviembre de 2026, zona America/La_Paz. Destinatarios: Backend, Base de Datos, Frontend, Dashboards y Product Owner. El requisito confirmado es conservar exactamente precios de 3.5 y 3.7 créditos durante todo el intercambio. Centésimas, máximo de negocio y precio propuesto en demandas siguen abiertos.

El modelo y la aplicación actuales trabajan con créditos enteros y cobran por duración. Admitir un precio publicado exige coordinar tanto su origen y copia pactada como la representación decimal. Este informe distingue **C** (código inspeccionado), **E** (ejecución local) y **P** (contrato propuesto). Una propuesta no describe un endpoint implementado.

## Copia de trabajo

- **E:** raíz `C:\Users\GONZALO APAZA\Desktop\Backend_\BancoTiempo`; inicialmente `main`, árbol limpio, commit `18f3ccc6960e177769e13a0bdfccb66f8d7042c8`.
- **E:** remoto `https://github.com/ignaciosanga/sis-226_timebank.git`. `git fetch origin` y `git ls-remote --heads origin` permitieron consultar el remoto. `git rev-list --left-right --count HEAD...origin/main` devolvió `0 0`: copia al día, sin divergencia.
- **E:** rama creada desde esa base: `feat/backend-nucleo-transaccional-parcial3`. Sin reset, stash, limpieza, merge, commit, push ni despliegue.
- **E:** sparse checkout habilitado, patrón `backend`; también están los archivos de raíz. `docs`, `frontend` y `database` se consultaron con `git show`/`git grep`, sin ampliar el sparse checkout.
- **C:** `docs/int-04-esquema.md` establece las tablas del backend como fuente de verdad e integra 32 vistas y 4 funciones de BD. Hay cuatro migraciones: `20261022000000_optimized_12`, `20261022000100_integrity_checks`, `20261025000000_vistas_reporte`, `20261026000000_carreras_ucb`.
- **E/C:** no apareció una migración decimal en los SQL/Prisma de los extremos de las referencias remotas disponibles ni un archivo de migración decimal en su historial. En particular, `origin/equipo/BD` está en `6216e8bc386357f8a0a5fa8044826284818fc4b7` y `origin/equipo/base-de-datos` en `5b7e0f62e3849b4dca6a0fbf552bb407aabd9388`. No se afirma nada sobre trabajo de BD sin publicar.
- Durante la descarga diferida de objetos Git apareció un fallo de mantenimiento automático: `failed to clear multi-pack-index` / `failed to run repack`. Las lecturas posteriores se hicieron con `git -c gc.auto=0 -c maintenance.auto=false`; no se borraron índices ni objetos.

## Entorno y límites de las verificaciones

**C:** `backend/package.json:8` exige Node 26.8.2 y npm >=11 <12; Prisma y adapter-pg están en 7.10.1, NestJS 11.2.7 y TypeScript ~5.9.0. Se conserva `package-lock.json`, lockfile v3. La instalación usa `npm ci`, con `postinstall` para generar Prisma. `prisma.config.ts:1` lee `DATABASE_URL` y selecciona el esquema y las migraciones locales.

**E:** el PC tenía Node 26.12.1/npm 11.20.0. Se descargó el ZIP oficial de Node 26.8.2 en `backend/.local/phase1`, comprobando SHA256 contra `SHASUMS256.txt`; incluye npm 11.19.1. El PATH del sistema no se modificó. Se usó `NODE_OPTIONS=--use-system-ca`, conservando TLS. La extracción con PowerShell fue lenta y se completó con `tar`; se detuvo únicamente el proceso de extracción de esta fase.

**C/E:** Docker 29.9.3 y Compose v5.7.0 estaban instalados con el motor Linux detenido. `docker desktop start` lo inició y reactivó contenedores previos por sus políticas de reinicio. Ninguno de esos servicios o volúmenes fue migrado, sembrado, eliminado ni detenido. Había PostgreSQL nativo en 5432 y otros proyectos Docker, incluido BancoTiempo en 4000.

| Recurso exclusivo | Configuración de esta fase |
| --- | --- |
| Proyecto Compose | `nexo-u-phase1-20261120` |
| Contenedor PostgreSQL | `nexo-u-phase1-20261120-postgres-1` |
| Imagen | `postgres:16.15-alpine` |
| Destino | `127.0.0.1:55434`, base `nexo_u_phase1`, usuario `nexo_phase1` |
| Volumen | `nexo-u-phase1-20261120_pgdata` |
| API | puerto 4103 |
| Configuración privada | `backend/.local/phase1/.env.phase1`, ignorada por Git |
| Bono en este entorno | `REGISTRATION_INITIAL_CREDITS=0`, para controlar el saldo inicial mediante una carga de desarrollo |

**E:** antes de migrar se comprobó `current_database()`, `current_user`, `version()` y esquema público vacío (0 tablas). **C:** la semilla `scripts/seed-local.cjs:4` utiliza transacción, bloqueo asesor y `ON CONFLICT DO NOTHING`; carga una carrera, cuatro categorías y cinco habilidades, sin usuarios ni saldos. La migración de carreras añade el resto del catálogo UCB. Los usuarios del control se crean mediante la API y la utilidad de promoción ADMIN ya existente; las cargas usan `/credits/grants`.

**C:** `src/config/environment.ts:127` exige `DATABASE_ENABLED=true` y URL para modo Prisma. `src/modules/exchanges/exchange-persistence.module.ts:19` elige explícitamente Prisma o memoria; no hay fallback automático por caída de PostgreSQL. `prisma.service.ts:25` devuelve error si BD está deshabilitada y `:62` si no conecta. `/health` solo demuestra proceso vivo; `/health/ready` declara `postgresql` y comprueba presencia de las 12 tablas. La lectura de `/careers` usa además el repositorio Prisma real.

**C:** `jest.config.cjs`, `test/jest-e2e.config.cjs` y `test/setup-env.cjs` fuerzan memoria, `DATABASE_ENABLED=false` y URL vacía. Sus resultados no certifican PostgreSQL. `test:postgres` crea una base temporal `timebank_test_*` dentro del servidor explícito `TEST_DATABASE_URL`, migra, prueba y elimina únicamente esa base. Su autorización queda cubierta por esta orden y por usar exclusivamente el servidor de esta fase.

## Recorrido de los créditos

Las rutas se expresan desde `backend/`, salvo las referencias de otra rama indicadas. Las líneas corresponden al commit base, sin cambios funcionales.

| Etapa y evidencia | Representación y comportamiento actual ante 3.7 | Cambio y responsable |
| --- | --- | --- |
| **C/P** `origin/front_end_parcial_3` commit `0e577a9771ae1e2d40878267506a20ce56b8247c`, `frontend/docs/ofertas-y-opiniones.md:47`, `:118` | Propone `POST /tutoring/offers` con `skillId`, nivel propio, título, descripción, fechas, `costoCreditos`; respuesta `costo_creditos`. Precio total elegido por tutor, independiente de duración; una oferta activa tutor/materia. Integración desactivada por defecto con `VITE_TUTORING_API_ENABLED=false`; demo local separada. | Backend y BD: entidad/enlace de oferta, precio y horario atómicos. Frontend/APIs: contrato decimal antes de activar. |
| **C** misma rama, `frontend/src/features/offers/tutoring-model.js:4`, `OfferDialog.vue:30`, `:70`, `OfferCreditSummary.vue:16` | Regex de dígitos, `Number`, `Number.isSafeInteger`; input min=1, step=1. Rechaza 3.7 antes de publicar. | Frontend: texto decimal exacto, `inputmode=decimal`, regla de escala acordada, mensajes y presentación. No usar `parseInt` ni sumar `Number`. |
| **C** `prisma/schema.prisma:70`, `:84`, `:96`; `src/modules/user-skills/dto/create-user-skill.dto.ts` | Hay materias/habilidades y relación usuario-habilidad con nivel; disponibilidad por usuario, sin materia ni precio. No hay modelos ni controladores de ofertas personalizadas o demandas publicadas. Solicitud de intercambio no equivale a una publicación de demanda. | BD/Backend: definir asociación tutor/materia/oferta y su versión; PO: decidir precio de demandas. El término demanda en un reporte estadístico no demuestra ese flujo. |
| **C** `src/modules/exchanges/dto/create-exchange.dto.ts:6`, `src/config/configure-app.ts:24` | DTO solo permite providerId, skillId, availabilityId, fechas y descripción. Un `costoCreditos: "3.7"` extra es rechazado por `forbidNonWhitelisted`, antes del servicio. | Backend: resolver precio autorizado en servidor; añadir identificación de oferta o resolución inequívoca tutor/materia. No confiar en importe arbitrario del solicitante. |
| **C** `src/modules/exchanges/credits.ts:4`, `:9`, `:23`, `:30` | Unidades enteras, máximo INTEGER 2147483647. Parser solo dígitos y formatter solo enteros. Duración múltiplo de 15 min hasta 8 h; costo=duración/15 min. 3.7 no puede derivarse de ese cálculo. | Backend/PO: separar validación del horario y precio; mantener minutos enteros y cambiar cálculo a precio pactado. |
| **C** `exchanges.service.ts:269`, `:306`; `schema.prisma:115` | `SOLICITUDES_INTERCAMBIO.creditos_requeridos` es `Int`; guarda costo por duración; solicitar no retiene. Hay snapshot de importe, pero sin id de oferta. | BD: decimal y enlace/versionado. Backend: guardar precio publicado exacto al solicitar. |
| **C** `exchanges.service.ts:384`, `:388`, `:405`, `:424`; `schema.prisma:138` | Aceptar recalcula el costo por duración, exige igualdad y guarda `RESERVAS.creditos Int`; añade movimiento de retención. No basta cambiar columnas. | Backend: copiar `creditos_requeridos` pactados, validar importe y disponibilidad sin recalcular tarifa. BD: `RESERVAS.creditos` decimal. |
| **C** `exchanges.service.ts:554`, `:580` | Cancelación válida lee `record.creditos`, libera ese importe una vez; antes del inicio por participante, después exige ADMIN. | Backend: operaciones exactas y mismos permisos/idempotencia. |
| **C** `exchanges.service.ts:510`, `:519`, `:533`, `:545` | Primera confirmación no paga; segunda usa el importe guardado, Consumo negativo y Transferencia positiva. Completada devuelve resultado sin repetir cobro. | Backend: sumar/restar/comparar con Decimal; preservar doble confirmación y atomicidad. |
| **C** `src/modules/users/user.types.ts:61`; `schema.prisma:45` | `saldo` y `creditos_retenidos` son number/Int, disponibles=saldo-retenidos. | BD: convertir ambos. Backend: dominio exacto y retención entre 0 y saldo. |
| **C** `exchanges.service.ts:121`; `schema.prisma:170` | Cinco importes en movimientos: cantidad y cuatro snapshots, todos number/Int. Retencion y Liberacion positivas; Consumo negativo; Transferencia positiva. Ajuste admite signo en el libro, aunque la carga pública actual solo añade. | BD/Backend: convertir los cinco en conjunto, conservar signos y cadena de snapshots. |
| **C** `src/config/environment.ts:27`, `src/modules/auth/auth.module.ts`, `src/modules/users/memory-users.repository.ts:83`, `:128` | Bono configurable entero; repositorio convierte con Number y regex entera. Usuario y BonoInicial se crean juntos, si bono>0. Esta clase también sirve sobre el repositorio transaccional Prisma. | Backend: política como texto decimal, parser exacto; 0 permitido para desactivarlo. PO: cuantía del bono. |
| **C** `src/modules/credits/dto/grant-credits.dto.ts:25`; `exchanges.service.ts:616`, `:632` | Carga ADMIN usa amount string entero y parseCredits; cantidad>0 y suma acotada. 3.7 es rechazado en DTO. Solo desarrollo/pruebas. | Backend: misma representación decimal y control de límite, conservar permisos. |
| **C** `src/modules/exchanges/integrity.ts:17`, `:139`, `:248`, `:324` | Validadores enteros, deltas e igualdad estricta; compara costo de solicitud y reserva contra duración; detecta duplicados y cadena de libro. | Backend: aritmética y comparación exactas, validar snapshot sin tarifa por tiempo; mantener todas las invariantes. |
| **C** `src/infrastructure/prisma/prisma-exchange.repository.ts:56`, `:196`, `:383`, `:397`; `src/modules/exchanges/memory-exchange.repository.ts` | Carga filas con cast/spread, persiste filas directamente. `structuredClone` en borradores/resultados y JSON en auditoría/idempotencia; no hay conversión de escala activa. | Backend: mapeadores Decimal↔texto; no introducir instancias Decimal en estado clonado. Canonizar JSON e idempotencia. |
| **C** `exchanges.service.ts:112`, `:155`, `:158`, `:167`, `:608`; `dto/exchange-responses.dto.ts:4`, `:31`, `:61`, `:125` | Cuenta y alias costo/monto son strings enteros, pero campos raw de solicitudes/reservas/movimientos y snapshots son números. Swagger refleja esa mezcla. Cada estudiante consulta su historial por `/credits/me/movements`. | Backend/Frontend: todos los importes públicos como string decimal, incluidos raw y snapshots; actualizar Swagger y clientes. Cambia tipo JSON en varios campos. |
| **C** `src/modules/analytics/analytics.repository.ts:27`, `:69`, `:148`, `:203`, `:226` | `String(BigInt(String(value)))` en agregados; con fracción lanza error. SQL presume SUM de enteros como bigint. | Backend/Dashboards: Decimal/string para sumas y series de créditos; conteos siguen number. |
| **C** `src/modules/exchanges/credits.spec.ts:7`, `test-fixtures.ts:14`, `:107`; `src/infrastructure/prisma/schema-contract.spec.ts`; `scripts/test-postgres.cjs` | Fixtures, aserciones, SQL y reglas prueban enteros. README de créditos aún describe centavos bigint y 1 crédito/hora: es documentación histórica incompatible con este código. | Backend: actualizar pruebas y documentos en fase funcional. No multiplicar datos actuales siguiendo ese README obsoleto. |

No se encontró una escala monetaria interna activa en el código transaccional de este clon: un `10` persistido representa diez créditos. `Math.floor` de cancelación calcula horas de anticipación; `Math.round` de Analytics calcula minutos/tasas, no importes. Paginación, conteos, estrellas 1–5, semestre 1–12 y minutos continúan siendo enteros.

## Contrato decimal propuesto para BD

**P:** usar `NUMERIC(12,2)` y Prisma `Decimal @db.Decimal(12,2)` para las nueve columnas. La capacidad de diez dígitos enteros conserva todos los INTEGER anteriores; es una propuesta técnica, no un máximo de negocio aprobado. Si PO solo admite décimas, puede acordarse `NUMERIC(11,1)`; escoger la escala definitiva antes de generar la migración. Mientras centésimas estén abiertas, el requisito mínimo garantiza una cifra decimal y no da por aceptado 3.75.

`NUMERIC` conserva aritmética decimal exacta; `real`/`double precision` son inexactos. Una columna con escala declarada redondea exceso de decimales al convertir. Por eso un CHECK sobre la columna ya convertida no puede detectar por sí solo el texto original con exceso. [PostgreSQL 16 Numeric Types](https://www.postgresql.org/docs/16/datatype-numeric.html).

**P:** dominio y estado transaccional con cadenas decimales canónicas; utilidades crean `Prisma.Decimal` temporal para `plus`, `minus`, `comparedTo` y devuelven cadena. Prisma carga NUMERIC como Decimal; convertir explícitamente al entrar/salir del adaptador. No usar Number, parseFloat, parseInt, BigInt del importe decimal ni operadores `+=` sobre strings. No clonar instancias Decimal con `structuredClone`. [Prisma 7 Fields and types](https://www.prisma.io/docs/orm/v7/prisma-client/special-fields-and-types).

**P:** texto JSON con punto, sin exponentes ni separadores; canonizar `"3.70"` a `"3.7"` solo si su escala original está autorizada, cero a `"0"`. Rechazar primero el exceso léxico de decimales, incluso ceros adicionales, sin redondear. Para escala 1: `^(0|[1-9][0-9]*)(\.[0-9])?$`; para escala 2 se cambia a `{1,2}` tras decisión del PO. Validar largo, valor finito, capacidad técnica y máximo de negocio usando Decimal. Precio, reserva y carga deben ser >0; saldo y snapshots >=0; retenidos entre 0 y saldo. La cantidad de movimiento es distinta de cero y conserva su signo por tipo. NaN, Infinity, notación exponencial, coma y espacios se rechazan. Una interfaz localizada puede transformar coma a punto antes de enviar, mediante una regla explícita.

Si hay escritores SQL externos, BD debe proteger el valor sin coerción previa mediante una función de escritura que valide texto/numeric sin escala, restringiendo DML directo; un trigger sobre NUMERIC(p,s) también recibe el valor ya convertido. Decidir ese contrato antes de prometer que PostgreSQL rechazará cualquier exceso de escala.

Petición propuesta de publicación, con tutor tomado del JWT y habilidad propia comprobada:

```http
POST /tutoring/offers
Idempotency-Key: publicar-oferta-0001
Content-Type: application/json

{"skillId":"UUID_MATERIA","nivel":"Avanzado","titulo":"Recursividad","descripcion":"Ejercicios guiados","costoCreditos":"3.7","fechaInicio":"2026-12-01T18:00:00Z","fechaFin":"2026-12-01T18:45:00Z"}
```

Respuesta propuesta y proyecciones del recorrido, correspondientes a etapas distintas:

```json
{
  "oferta": {"id_oferta":"UUID_OFERTA","id_habilidad":"UUID_MATERIA","costo_creditos":"3.7"},
  "solicitud": {"id_oferta":"UUID_OFERTA","creditos_requeridos":"3.7","costo_creditos":"3.7"},
  "reserva": {"creditos":"3.7","monto_creditos":"3.7"},
  "cuentaAlAceptar": {"saldo":"10","creditos_retenidos":"3.7","disponibles":"6.3"},
  "movimientoAlLiquidar": {"tipo":"Consumo","cantidad":"-3.7","monto":"-3.7","saldo_anterior":"10","saldo_posterior":"6.3","retenidos_anterior":"3.7","retenidos_posterior":"0"}
}
```

Este JSON ilustra formatos; no propone que un único endpoint devuelva todos esos objetos. La solicitud toma el precio de la oferta en servidor, guarda importe e identidad/versión pactada y no lo actualiza si cambia la oferta. La reserva copia ese importe. Sustituir `CREDITO_15_MINUTOS` por una unidad de crédito acordada porque el precio manual ya no depende del intervalo. Mantener aliases vigentes y cambiar sus tipos de forma coordinada/versionada, especialmente campos raw que antes eran números.

## Matriz de cambios y dependencias

| Responsable | Tabla, columna u objeto | Tipo actual → propuesto | Dependencia y aceptación |
| --- | --- | --- | --- |
| BD | `USUARIOS.saldo` | INTEGER → NUMERIC(12,2) | Cuentas, libro, ranking, agregado; 10 histórico sigue 10 y liquidación deja 6.3. |
| BD | `USUARIOS.creditos_retenidos` | INTEGER → NUMERIC(12,2) | 0→3.7→0, <=saldo; disponible exacto 6.3. |
| BD | `SOLICITUDES_INTERCAMBIO.creditos_requeridos` | INTEGER → NUMERIC(12,2) | Vistas y dos funciones; snapshot 3.7 al solicitar, sin retención. |
| BD | `RESERVAS.creditos` | INTEGER → NUMERIC(12,2) | Vistas, función, liquidación; copiar snapshot 3.7 aunque oferta cambie. |
| BD | `MOVIMIENTOS_CREDITO.cantidad` | INTEGER → NUMERIC(12,2) | Retencion/Liberacion/Transferencia +3.7, Consumo -3.7, sin duplicados. |
| BD | `MOVIMIENTOS_CREDITO.saldo_anterior` | INTEGER → NUMERIC(12,2) | Cadena de snapshots: 10 anterior al consumo. |
| BD | `MOVIMIENTOS_CREDITO.saldo_posterior` | INTEGER → NUMERIC(12,2) | Cadena de snapshots: 6.3 posterior al consumo. |
| BD | `MOVIMIENTOS_CREDITO.retenidos_anterior` | INTEGER → NUMERIC(12,2) | 3.7 anterior a liberación/consumo. |
| BD | `MOVIMIENTOS_CREDITO.retenidos_posterior` | INTEGER → NUMERIC(12,2) | 0 posterior; comparar saldo de usuario. |
| BD con Backend | Oferta, precio, enlace desde solicitud | Ausentes → diseño acordado; precio NUMERIC | FK materia/HABILIDADES y tutor, snapshot y versión; atomicidad oferta/horario; no inventar migración paralela. |
| BD con Dashboards | `v_solicitudes_detalle`, `v_solicitudes_pendientes` | crédito INTEGER → NUMERIC | Migración de vistas `:75`, `:89`; mismas columnas/nombres, exactitud 3.7. |
| BD con Dashboards | `v_reservas_detalle`, `v_reservas_completadas`, `v_transferencias_detalle` | crédito/cantidad INTEGER → NUMERIC | `:146`, `:196`, `:220`; transferencia 3.7 y conteos iguales. |
| BD con Dashboards | `v_cuentas_credito_usuario`, `v_ranking_creditos` | saldo/retenido/disponible INTEGER → NUMERIC | `:206`, `:231`; posición sigue bigint, importes exactos. |
| BD con Dashboards | `v_movimientos_credito_detalle` | cinco INTEGER → NUMERIC | `:212`; snapshots y signos conservados. |
| BD con Dashboards | `v_estadisticas_generales.total_creditos_en_sistema` | SUM(INTEGER)=BIGINT → NUMERIC | `:329`; total conservado en conversión y en transferencias internas. |
| BD con Dashboards | `fn_solicitudes_recibidas(uuid)`, `fn_solicitudes_enviadas(uuid)` | retorno creditos_requeridos INT → NUMERIC | `:102`, `:124`; conservar firmas de entrada, columnas, orden y permisos. |
| BD con Dashboards | `fn_reservas_usuario(uuid)` | retorno creditos INT → NUMERIC | `:169`; ambos roles reciben 3.7, sin cast a int. |
| Backend | Prisma, dominio, memoria, validadores, auditoría/idempotencia, bono/cargas | Int/number → Decimal en adaptador y texto exacto en estado | Regenerar cliente; escenarios enteros y decimales, rollback, dos instancias y reinicio. |
| Backend | DTO, Swagger y serialización de todos los importes | Mezcla number/string entero → string decimal | OpenAPI y JSON coinciden; validar exceso antes de persistir. |
| Backend con Dashboards | Analytics agregados y series | bigint/BigInt → Decimal/string | Mantener estructura HTTP y crédito string; totales fraccionarios sin error; counts number. |
| Frontend y APIs | Formularios, servicios, tarjetas, revisión, saldos e historial, demo y tests | Precio number entero → texto decimal | Publicar 3.5/3.7, recibir strings en raw/snapshots, no tratar como costo desconocido. |
| Dashboards | Modelos BI y consumidores SQL/HTTP | Crédito integer/bigint → decimal; string en HTTP | Mismos nombres/columnas; recargar metadatos y comparar totales sin truncar. |

Nueve vistas usan directamente columnas afectadas. Las otras 23 no necesitan conversión por esta causa; comprobar dependencias adicionales en el destino real. `fn_calificaciones_recibidas` conserva puntuacion int. No se encontró AVG de créditos en las migraciones actuales: el promedio existente es de estrellas. Si se añade promedio de créditos, definir escala de presentación sin alterar la precisión del libro.

PostgreSQL impide convertir una columna usada por una vista/regla sin resolver esas dependencias. Las vistas con cambio de tipo de salida requieren retirar/recrear; `CREATE OR REPLACE VIEW` exige los mismos tipos existentes. Las tres funciones con nuevo tipo de retorno también se deben retirar/recrear, restaurando `STABLE`, `SECURITY DEFINER`, `search_path`, propietarios y GRANT. [CREATE VIEW](https://www.postgresql.org/docs/16/sql-createview.html), [CREATE FUNCTION](https://www.postgresql.org/docs/16/sql-createfunction.html). No utilizar CASCADE sin inventario.

## Secuencia coordinada y conciliación

1. PO y BD acuerdan escala, máximo técnico/de negocio y semántica de precio. Inventariar en copia de datos previos las nueve columnas, restricciones, vistas, funciones, dependientes, propietarios, GRANT, tamaños y bloqueos. Confirmar la migración de BD publicada; revisar su diff antes de integrarla.
2. Guardar `pg_dump` completo y comprobar su restauración en otra base aislada, junto con commit y versión de Prisma/aplicación. Registrar conteos y exportaciones ordenadas por UUID de los nueve campos, solicitudes, reservas, movimientos y resultados de vistas/funciones. Conservar AUDITORIA e idempotencia.
3. Preparar en paralelo la adaptación Backend, Frontend y Dashboards contra el contrato acordado, sin habilitar publicación antes de completar todo el recorrido. Generar Prisma desde el esquema coordinado (`npm run prisma:generate`), compilar y probar mapeos Decimal/texto, clonación y JSON.
4. Para aplicar en una ventana coordinada: detener escritores y procesos antiguos; BD retira objetos dependientes en orden inverso, convierte tipos **sin multiplicar valores** y recrea objetos en orden de dependencia. Conservar constraints y defaults. Una conversión ilustrativa es `USING saldo::numeric(12,2)`; esto no constituye una migración entregada ni ejecutada. Usar transacción explícita donde proceda y prever los bloqueos de ALTER TABLE. [ALTER TABLE](https://www.postgresql.org/docs/16/sql-altertable.html).
5. Comparar cada UUID/campo contra la copia anterior: `nuevo::numeric = anterior::numeric`. Diez créditos siguen siendo diez, no 0.10 ni 1000. Si se eligiera otra solución con unidades mínimas internas, documentar separadamente entrada 3.7→37/370 y salida inversa; jamás multiplicar NUMERIC de créditos por esa escala. Este clon actual no requiere desescalado histórico.
6. Conciliar saldos y libro: retenidos=SUM(creditos de reservas Confirmada por solicitante); retenidos entre 0 y saldo; cada snapshot respeta delta según tipo, encadena con el anterior y termina en saldo/retenidos actuales. Revisar movimientos con la misma fecha mediante la cadena de snapshots, no imponer un orden arbitrario por UUID. Cantidad distinta de cero y signo válido; una reserva cancelada tiene Retencion/Liberacion y cero pago; completada tiene Retencion/Consumo/Transferencia únicos. Consumo+Transferencia de cada reserva suma cero; la retención/liberación no cambia saldo total.
7. Comparar conteos, sumas por tipo, sumas globales de saldo/retenidos y resultados de todas las vistas y funciones; los agregados deben coincidir antes/después de solo convertir tipos. Respetar saldos de apertura previos: SUM(cantidad) solo iguala saldo si existe toda su historia y saldo inicial contable; no inventar ajustes para hacerla coincidir. Usar `inspectIntegrity` adaptado como comprobación adicional.
8. Ejecutar el caso decimal completo y su control entero, datos antiguos, cero, exceso de escala, máximo y overflow, signos, saldo insuficiente, cambio de precio, dos procesos concurrentes, reintentos con claves iguales/distintas y reinicio. Reabrir escrituras solo tras comparar resultados.

Si la migración falla antes de commit y es transaccional, revertir toda la operación. Si hay pasos ya confirmados, detener escritores y restaurar la copia validada en otra instancia; verificar y cambiar la conexión coordinadamente. Una copia anterior pierde operaciones posteriores si se sustituye sin conciliarlas: preservar/exportar esos cambios y acordar su recuperación antes de cambiar el destino. Volver de NUMERIC a INTEGER solo es seguro si **los nueve campos** son enteros y caben en INTEGER, y se han resuelto dependencias y restaurado cliente/código antiguos. Si ya existen fracciones, no truncar ni redondear para volver atrás: conservar datos nuevos, conciliar y preferir corrección hacia delante o recuperación acordada con PO/BD. No editar migraciones históricas ni borrar registros de `_prisma_migrations` para ocultar un fallo.

Consultas de conciliación de solo lectura, para ejecutar sobre ambas copias en la fase coordinada:

```sql
SELECT count(*) AS usuarios, sum(saldo) AS saldo, sum(creditos_retenidos) AS retenidos FROM "USUARIOS";
SELECT tipo, count(*) AS movimientos, sum(cantidad) AS cantidad FROM "MOVIMIENTOS_CREDITO" GROUP BY tipo ORDER BY tipo;
SELECT u.id_usuario, u.creditos_retenidos, coalesce(r.retenidos,0) AS esperados
FROM "USUARIOS" u LEFT JOIN (
  SELECT id_solicitante, sum(creditos) AS retenidos FROM "RESERVAS"
  WHERE estado='Confirmada' GROUP BY id_solicitante
) r ON r.id_solicitante=u.id_usuario
WHERE u.creditos_retenidos<>coalesce(r.retenidos,0);
SELECT id_reserva,tipo,id_usuario,count(*) FROM "MOVIMIENTOS_CREDITO"
WHERE id_reserva IS NOT NULL GROUP BY id_reserva,tipo,id_usuario HAVING count(*)>1;
SELECT * FROM v_estadisticas_generales;
```

## Decisiones que deben quedar acordadas

- **PO:** aceptar solo décimas o también centésimas; máximo por precio, saldo y carga; si el autor de una demanda propone precio; cuantía del bono (el valor por defecto actual es 8, no una aprobación del PO).
- **BD y Backend:** precisión/escala física, máximo técnico, escritura SQL que rechace exceso antes de coerción, nueva entidad de ofertas/enlace a materia, snapshot y versión de precio; constraints, orden de recreación de vistas/funciones y ventana de compatibilidad.
- **Frontend, APIs y Dashboards:** migración de campos number a strings decimales, formato canónico y presentación localizada; conservar estructura de Analytics, nombres/orden de columnas y tipos de conteos/estrellas. Activar ofertas solo cuando el flujo persistente esté probado.

## Resultados de ejecución y cierre

**E:** backend y PostgreSQL quedan activos. `/health/ready` devuelve `{"status":"ok","persistence":"postgresql"}`. `/careers` devuelve 31 carreras a través del repositorio Prisma. Hay 12 tablas de negocio más `_prisma_migrations`, 32 vistas y cuatro funciones; las cuatro migraciones constan terminadas. Se verificaron HTTP 200 en:

- API de lectura: <http://127.0.0.1:4103/careers> (base de API: `http://127.0.0.1:4103`).
- Salud: <http://127.0.0.1:4103/health> y conexión: <http://127.0.0.1:4103/health/ready>.
- Swagger: <http://127.0.0.1:4103/docs> y OpenAPI: <http://127.0.0.1:4103/docs-json>.

Los comandos siguientes se ejecutan desde `backend/`, usando Node local 26.8.2 y npm 11.19.1. `ENV` representa `.local/phase1/.env.phase1`; no es una URL ni contiene secretos publicados aquí. Los logs y resultados JSON quedan en `.local/phase1/`.

| Comando ejecutado | Resultado real | Alcance o causa |
| --- | --- | --- |
| `git fetch origin`; `git rev-list --left-right --count HEAD...origin/main` | OK; `0 0` | Base verificada y árbol inicialmente limpio. Fallo de mantenimiento Git durante lecturas diferidas registrado arriba; no impidió completar la inspección. |
| `docker info` / `docker desktop start` | Falló primero por pipe Linux inexistente; luego OK, Linux 29.9.3 | Motor detenido resuelto; servicios de otros proyectos se reactivaron automáticamente. |
| `npm.cmd ci` con Node exacto y `NODE_OPTIONS=--use-system-ca` | OK, exit 0; Prisma generado | Lockfile intacto. npm informó 15 vulnerabilidades: 9 moderadas y 6 altas; no se ejecutó audit fix ni actualizaciones. |
| `docker compose --env-file ENV -f .local/phase1/compose.yaml up -d --wait --wait-timeout 120` | OK; contenedor healthy | Volumen y servidor exclusivos, puerto 55434. |
| `node --env-file=ENV .local/phase1/check-target.cjs` | OK antes y después | Identidad local comprobada; 0 tablas antes, 13 después de migrar. |
| `node --env-file=ENV node_modules/prisma/build/index.js migrate deploy` | OK | Aplicó únicamente las cuatro migraciones versionadas. |
| `node --env-file=ENV scripts/seed-local.cjs` | OK | Semilla prevista revisada; sin usuarios ni saldos. |
| `npm run prisma:validate` | OK | Validación del esquema actual entero; no certifica decimales. |
| `npm run build` | OK | TypeScript y cliente Prisma actuales. |
| `npm run lint -- --ignore-pattern .local/**` | OK | Se excluyen herramientas y datos locales generados en esta fase; código versionado completo verificado, sin reformatear. |
| `npm test` | OK: 19 suites, 177 pruebas | Memoria/mocks, BD deshabilitada por setup; bono local fijado explícitamente en 0. |
| `npm run test:e2e` | Falló: 1 suite aprobada, 4 fallidas; 41 pruebas aprobadas y 91 fallidas | Memoria. Las tres suites de flujo fallan en registro de fixtures `@example.test`, rechazados con 400 por `RegisterDto:45`. La de seguridad espera 503 por política bloqueada, pero su correo inválido produce primero 400. No se certifican las aserciones posteriores; actualizar fixtures y fijar política de bono explícita antes de repetir. |
| `npm run test:postgres` | Falló, exit 1 | BD temporal propia dentro del servidor de fase 1. Primera aserción espera 1 carrera; migración vigente produce 31. No alcanzó el flujo transaccional. |
| `node --env-file=ENV .local/phase1/test-postgres-current.cjs` | OK | Copia local del script anterior: solo expectativa 31 carreras, correos `@ucb.edu.bo` y rutas de imports/cwd por nueva ubicación. Pasó migración/semilla repetidas, HTTP/JWT, dos instancias, aceptación concurrente, cobro único, replay, rollback y reapertura de aplicación. No convierte el resultado del script original en aprobado. |
| `node --env-file=ENV .local/phase1/acceptance.cjs` | OK | Control entero de 3 créditos sobre PostgreSQL de esta fase, cancelación, doble confirmación, reintentos, historiales y auditoría. Reloj simulado solo en el proceso de prueba para completar después del fin; no se cambió reloj de Windows ni PostgreSQL. |
| `node --env-file=ENV .local/phase1/inventory.cjs` | OK | Verificó los nueve tipos INTEGER, vistas/funciones, cuatro migraciones y conciliación final. Ejecutó el validador puro del frontend desde su referencia Git: `"3"→3`, `"3.7"→null`, `"3.75"→null`; no se ejecutó navegador ni suite frontend. |
| `node .local/phase1/replay.cjs` después de reiniciar API y después de parar/arrancar API+PostgreSQL | OK | HTTP real en 4103; saldo 7/3, retenido 0, un Consumo y una Transferencia. Persistencia e idempotencia tras reinicio real de procesos. |

La validación adicional de tipos confirmó por SELECT que `'3.75'::numeric(12,1)` da `3.8`, y `10::integer::numeric(12,2)` da `10.00`. Con Prisma instalado, `Decimal('3.7')` se serializó como `"3.7"`, `Decimal('10').minus('3.7')` dio `6.3`, y `structuredClone(Decimal('3.7'))` lanzó `DataCloneError`. Son pruebas de mecanismos; no constituyen implementación funcional decimal.

### Caso entero ejecutado y caso decimal pendiente

El control entero cuesta 3 créditos porque dura 45 minutos; no utiliza un precio manual publicado. Solicitante A empieza con 10 mediante carga ADMIN y tutor con 0; bono desactivado solo en este entorno. Cancelación y liquidación usan reservas distintas, ambas iniciadas desde saldo 10 y retenido 0.

| Etapa | Entero ejecutado: saldo A / retenido / disponible; saldo tutor | Decimal requerido |
| --- | --- | --- |
| Solicitar | 10 / 0 / 10; 0 | Pendiente del precio pactado 3.7; debe mantener 10 / 0 / 10. |
| Aceptar | 10 / 3 / 7; 0 | Pendiente: 10 / 3.7 / 6.3. |
| Cancelar válidamente y repetir | 10 / 0 / 10; 0; una Liberacion | Pendiente: liberar exactamente 3.7 sin pago. |
| Primera confirmación en escenario independiente | 10 / 3 / 7; 0; sin transferencia | Pendiente: 10 / 3.7 / 6.3, sin pago. |
| Segunda confirmación y repetición con clave igual/distinta | 7 / 0 / 7; 3 | Pendiente: 6.3 / 0 / 6.3; tutor +3.7. |
| Reintento tras reiniciar API y PostgreSQL | 7 / 0 / 7; 3; exactamente un Consumo y una Transferencia | Pendiente repetir prueba decimal. |
| Cambio de precio de oferta después de solicitar | No ejecutable: no existe oferta persistida con precio | Pendiente: reserva conserva 3.7; no recalcular. |

**Primera barrera según entrada:** al ejecutar la función del formulario de la rama frontend, 3.7 ya se rechaza como no entero. Contra el backend, publicar en `/tutoring/offers` devolvió 404 porque la ruta no existe; enviar `costoCreditos:"3.7"` a `/exchanges` devolvió 400 `property costoCreditos should not exist`. Ese 400 se debe a la ausencia del campo, independientemente de si su valor es entero o decimal. En la ruta que sí recibe importe, `/credits/grants`, `amount:"3.7"` devolvió 400 por regex entera antes del servicio; `parseCredits('3.7')` también rechazó la fracción al probarlo directamente. No se forzaron fracciones por SQL ni se ejecutó el resto del recorrido como si estuviera implementado.

La conciliación final de esta base contiene 3 usuarios, 2 solicitudes, 2 reservas (una cancelada y otra completada), 6 movimientos, saldo global 10 y retenido global 0. Movimientos: Ajuste +10, dos Retencion +3, Liberacion +3, Consumo -3 y Transferencia +3. El alumno ve cinco movimientos y el tutor uno; duplicados por reserva/tipo/usuario: ninguno. `GET /exchanges/integrity` devolvió `status=ok`, `scope=postgresql-transaction`, `issues=[]`.

Analytics se comprobó primero con su ventana predeterminada, que termina en la hora real. Por el reloj adelantado del caso, la transferencia tiene fecha futura y no aparece en ese filtro, aunque el saldo global y las vistas sin filtro ya la incluyen. Después se verificó por HTTP un período que incluye el fin simulado: transferidos `"3"`, consumo `"-3"`, retenidos actuales `"0"`, saldo global `"10"` y una transferencia en la serie temporal.

### Arranque y parada en PowerShell

Desde la raíz del clon, los siguientes comandos fueron probados, incluyendo parada y arranque del PostgreSQL exclusivo. Conservan el volumen y sus datos:

```powershell
Set-Location 'C:\Users\GONZALO APAZA\Desktop\Backend_\BancoTiempo\backend'
# Si Docker Desktop está cerrado:
docker desktop start
# Iniciar solo PostgreSQL y API de esta fase:
& .\.local\phase1\start.ps1
# Detener solo API y PostgreSQL de esta fase:
& .\.local\phase1\stop.ps1
```

No ejecutar el arranque si ya está activo: el gestor conserva el PID y evita duplicar el proceso. Para reiniciar usar `stop.ps1` seguido de `start.ps1`. El gestor comprueba ejecutable y configuración del PID antes de detenerlo. La parada usa `docker compose stop` sobre el archivo exclusivo, sin `down -v`, sin detener Docker Desktop ni otros proyectos.

### Archivos locales y Git final

- Nuevo archivo para revisión: `backend/docs/fase1-nucleo-transaccional-parcial3.md`.
- Herramientas/configuración/evidencias locales ignoradas: `backend/.local/phase1/` con runtime Node exacto, ZIP/hash, `.env.phase1`, Compose, gestores `start.ps1`/`stop.ps1`/`api.cjs`, scripts de comprobación, copia adaptada de la prueba PostgreSQL, logs y JSON de resultados. `accounts.private.json` permite recuperar las cuentas de desarrollo; `replay.private.json` contiene tokens. Ambos permanecen locales y no deben compartirse junto al informe.
- Dependencias/caché, cliente generado y compilación: `backend/node_modules`, `backend/.npm-cache`, `backend/src/generated/prisma` y `backend/dist`, todos ignorados.
- Recursos externos al árbol: contenedor, red y volumen exclusivos ya identificados; Docker Desktop quedó iniciado. API queda activa en 4103. No se cambió configuración global de Node, credenciales existentes ni `.env.example`.
- Git final: rama `feat/backend-nucleo-transaccional-parcial3`, mismo commit `18f3ccc6960e177769e13a0bdfccb66f8d7042c8`; único archivo no rastreado `backend/docs/fase1-nucleo-transaccional-parcial3.md`. Sin diferencias en código, pruebas originales, schema, migraciones, package.json ni lockfile. Sparse checkout permanece `backend`.

La fase 1 queda cerrada con entorno persistente operativo y limitaciones reproducidas. La fase 2 de cuentas y bono puede empezar por diseño, adaptación del dominio y pruebas: las cuentas ya están integradas en USUARIOS y el bono ya se registra atómicamente. Su validación decimal y el flujo de precios publicados dependen de la migración coordinada, los mapeos y las decisiones de PO/BD. Corregir los fixtures de las suites originales es trabajo pendiente visible; el control entero aprobado no certifica soporte de 3.7.
