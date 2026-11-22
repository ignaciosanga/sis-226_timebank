# Fase 3: publicación y consulta de ofertas de tutoría

Entrega local del 20 de noviembre de 2026 sobre `feat/backend-nucleo-transaccional-parcial3`, base `18f3ccc`. Las fases 1 y 2 siguen sin commit en el mismo árbol; no se hizo commit, push ni despliegue. Se conservaron sus reportes, herramientas, autenticación, Mailpit, bonos, adaptadores y pruebas oficiales.

## Funcionalidad disponible

Una cuenta activa puede publicar una clase sobre una habilidad propia y con el nivel de su perfil. La identidad del tutor procede de la sesión, no del cuerpo. Oferta y horario se crean en una sola transacción. El precio es **total por clase**, elegido por el tutor e independiente de la duración; publicar y consultar no requieren tener ese importe ni modifican créditos.

El catálogo público muestra solo ofertas `Activa`, de cuentas activas, habilidad/categoría activas y relación de perfil coincidente, cuyo horario siga disponible y todavía no haya comenzado. Devuelve paginación real, información pública del tutor/materia, precio textual, banner opcional, fechas e identificador del horario. Las métricas se calculan con reservas y calificaciones existentes de ese tutor y materia; no se genera ranking, reseñas ni datos sintéticos.

El flujo anterior de intercambios continúa funcionando con sus créditos enteros. Si recibe un horario asociado a una oferta publicada, se detiene con 409 y `code: "OFFER_PRICE_FLOW_PENDING"`, antes de crear solicitud o retención. Esa oferta todavía no se puede contratar; su recorrido decimal corresponde a la fase 4.

## Endpoints y ejemplos

| Endpoint                                    | Acceso y resultado                                                                                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /tutoring/offers`                     | Cuenta activa, Bearer e `Idempotency-Key` de 16–128 caracteres. 201 con oferta y horario asociado.                                                                    |
| `GET /tutoring/offers?page=1&limit=100`     | Público. `{ data, meta: { page, limit, total, totalPages } }`. También admite `search` opcional; el cliente revisado solo envía page/limit.                           |
| `POST /tutoring/banners`                    | Cuenta activa, Bearer, `Idempotency-Key`, multipart con campo `banner`. 201 `{ "url": "referencia-absoluta" }`.                                                       |
| `GET /tutoring/banners/:id`                 | Imagen pública de una oferta vinculada activa y tutor activo; MIME real, bytes y cabecera que permite mostrarla desde el frontend. Una carga pendiente no es pública. |
| `/exchanges` y aceptación existente         | Horario ligado a oferta: 409 `OFFER_PRICE_FLOW_PENDING`, sin nuevos efectos. Los horarios anteriores conservan su funcionamiento.                                     |
| `PATCH/DELETE /availability/:id` existentes | Horario ligado a oferta: 409 `OFFER_AVAILABILITY_MANAGED`, evitando cambiar o cancelar por separado su intervalo.                                                     |

El POST de publicación no acepta un tutor ni disponibilidad arbitrarios:

```http
POST /tutoring/offers
Authorization: Bearer <sesion>
Idempotency-Key: demo-oferta-python-0001
Content-Type: application/json
```

```json
{
  "skillId": "20000000-0000-4000-8000-000000000002",
  "nivel": "Intermedio",
  "titulo": "Python: recursividad y ejercicios",
  "descripcion": "Una clase de 45 minutos con ejercicios guiados.",
  "costoCreditos": "3.7",
  "fechaInicio": "2026-11-27T14:00:00-04:00",
  "fechaFin": "2026-11-27T14:45:00-04:00"
}
```

Usar una fecha futura al probar. El UUID del ejemplo es una habilidad de la semilla local; antes debe publicarse en el perfil con `POST /users/me/skills`, `{ "skillId": "20000000-0000-4000-8000-000000000002", "nivel": "Intermedio" }`, o usar otra habilidad real de `GET /skills`. Las fechas exigen zona explícita, fin posterior e intervalo de 15 minutos a 8 horas en múltiplos de 15 minutos. Título de 1–100 y descripción de 1–1500 caracteres después de trim. Se rechazan superposiciones con disponibilidades o reservas del tutor.

La respuesta incluye estos campos (UUID ilustrativos, no enlaces):

```json
{
  "id_oferta": "UUID_OFERTA",
  "id_usuario": "UUID_TUTOR",
  "id_tutor": "UUID_TUTOR",
  "id_habilidad": "20000000-0000-4000-8000-000000000002",
  "id_disponibilidad": "UUID_HORARIO_CREADO",
  "nivel": "Intermedio",
  "titulo": "Python: recursividad y ejercicios",
  "descripcion": "Una clase de 45 minutos con ejercicios guiados.",
  "costo_creditos": "3.7",
  "bannerUrl": null,
  "fecha_inicio": "2026-11-27T18:00:00.000Z",
  "fecha_fin": "2026-11-27T18:45:00.000Z",
  "tutor": {
    "id": "UUID_TUTOR",
    "id_usuario": "UUID_TUTOR",
    "nombre": "Ana",
    "apellido": "Perez"
  },
  "materia": {
    "id_habilidad": "20000000-0000-4000-8000-000000000002",
    "nombre": "Python"
  },
  "metricas": { "promedio": null, "opiniones": 0, "tutorias_completadas": 0 }
}
```

Se conserva el UUID de `HABILIDADES` y su relación `USUARIO_HABILIDADES`; no se duplica el pensum. Las métricas cuentan reservas `Completada`, con fin alcanzado, tutor como ofertante y materia exacta; opiniones del solicitante hacia ese tutor. Las evaluaciones inversas y de otras materias se excluyen. Sin opiniones, promedio `null`.

## Precio exacto y política provisional

Se admiten `"3.7"`, `"3.5"`, `"4"` y otros importes positivos enteros o con **una décima**. `"3.0"` se canoniza a `"3"`. Cero, negativos, JSON numérico, comas, espacios, exponentes y precisión adicional (`"3.75"`, incluso `"3.70"`) se rechazan antes de persistir. No se usa `Number`, float, redondeo ni conversión a entero para el precio.

El estado de ambos adaptadores conserva `costo_creditos` como string. Prisma devuelve Decimal y el mapper lo convierte mediante `.toString()` **antes** de `structuredClone`; al escribir envía la cadena a Prisma. Se comprobó con PostgreSQL real que leer, modificar, persistir y reabrir no cambia `"3.7"` ni provoca `DataCloneError`. Las fechas y contadores continúan con sus tipos anteriores.

La columna `OFERTAS.costo_creditos` es `NUMERIC` sin typmod, con CHECK `> 0`, `scale(...) <= 1` y `<= 9999999999.9`. Se verificó que Prisma `Decimal @db.Decimal` sin argumentos genera ese tipo sin coerción de escala. Así PostgreSQL comprueba `3.75` antes de cualquier redondeo; un `NUMERIC(p,s)` con escala ya aplicada no garantizaría ese rechazo. Referencias: [NUMERIC de PostgreSQL](https://www.postgresql.org/docs/16/datatype-numeric.html), [funciones de escala](https://www.postgresql.org/docs/16/functions-math.html) y [Decimal de Prisma](https://www.prisma.io/docs/orm/v7/prisma-client/special-fields-and-types).

`9999999999.9` es la **capacidad técnica provisional acotada por validación y CHECK**, equivalente a diez dígitos enteros y uno decimal; no es un máximo comercial aprobado. BD y PO deben resolver centésimas y máximo de negocio. Los nueve campos históricos de créditos siguen INTEGER y no hay una segunda migración que los convierta.

## Banner, propiedad y abandono

Se admiten JPG, PNG y WebP reales, hasta **3 MiB (3145728 bytes)** y 16 megapíxeles. Sharp 0.35.5 decodifica y recodifica la imagen, verifica el MIME y descarta archivos corruptos, falsos o animados. Los nombres se generan en servidor; no se usan rutas o nombres proporcionados por el cliente. Los bytes están en un directorio privado configurable por `BANNER_STORAGE_DIR`; no se publica el directorio como estático.

Para cargar desde Swagger, elegir multipart/form-data, campo `banner`, archivo y clave de idempotencia. Copiar exactamente el `url` devuelto como `bannerUrl` opcional al publicar. El servidor verifica tutor propietario, vigencia, archivo y hash y vincula la metadata dentro del mismo commit que oferta/horario. Un banner de otra cuenta o URL externa es rechazado.

El frontend ya usa `${key}.banner` para la carga y `key` para la oferta; reservar siete caracteres dentro del límite total de 128. La misma clave/archivo recupera una referencia; otro contenido con la misma clave recibe 409. Si falla la publicación, el banner sigue pendiente y reutilizable hasta 24 horas. Si se abandona, la limpieza al iniciar o cargar marca su metadata vencida y retira sus bytes; también retira archivos huérfanos antiguos de ese directorio. No hay una tarea programada de limpieza mientras no haya actividad. Un reintento de carga vencida recibe 410 y debe usar otra clave/carga. Las imágenes vinculadas se conservan.

La demostración usa `.local/phase3/banners`; conservar esa carpeta al reiniciar. Las pruebas usan directorios exclusivos diferentes, para no limpiar imágenes de la demo ni de otra base. El almacenamiento es local de desarrollo; varias instancias que sirvan estos archivos deben compartir el mismo directorio persistente.

## Migración local y conservación de fase 2

Se hizo fetch y se inspeccionaron las referencias sin cambiar de rama. `origin/front_end_parcial_3` sigue en `0e577a9771ae1e2d40878267506a20ce56b8247c`; BD en `origin/equipo/BD` (`6216e8bc386357f8a0a5fa8044826284818fc4b7`) y `origin/equipo/base-de-datos` (`5b7e0f62e3849b4dca6a0fbf552bb407aabd9388`). En sus SQL/documentos publicados no se encontró OFERTAS, migración decimal ni decisión de precisión o máximo que pudiera reutilizarse. No se atribuye esa ausencia a trabajo aún sin publicar.

Se añade únicamente `prisma/migrations/20261120010000_ofertas_tutoria/migration.sql`, identificada para revisión de BD:

- `OFERTAS`: tutor/habilidad, nivel, contenido, precio exacto, estado y FK única a disponibilidad creada. FK opcional única a banner.
- Índice parcial único de oferta `Activa` por tutor/materia. Al publicar nuevamente después del fin de la anterior, esta se marca `Finalizada` en la misma transacción. Se conserva su historia y su horario sigue bloqueado para la tarifa antigua.
- `BANNERS_TUTORIA`: metadata del archivo, propietario, hash, vencimiento y asociación; necesaria para propiedad, idempotencia y limpieza persistentes. La FK de OFERTAS es el vínculo principal; `attached_offer_id` es un marcador redundante validado por el servicio en el mismo commit.
- Las cinco migraciones anteriores, incluida autenticación, permanecen intactas. No se crean tablas de pensum ni se cambian créditos anteriores. La instancia suma 15 tablas de aplicación y `_prisma_migrations`: 16 físicas.

Se detuvo solo la API propia y se comprobó el destino local `127.0.0.1:55434/nexo_u_phase1`, usuario `nexo_phase1`. Antes de aplicar se guardaron dump y snapshot privados. Tras migrar coincidieron exactamente las **13 tablas previas**, con sus cuatro cuentas y dos reservas, SHA-256 `a0294b0610cf5bce0cd5fda98bcacefa8c0c0d11fd5066e2f940f2cd06bccea2`. Se conservaron datos originales y herramientas de fases anteriores.

La demostración añadió dos tutores de desarrollo mediante el registro institucional y correo real Mailpit; sus bonos se originan en ese registro/activación, no en publicar. Se compararon saldos, bonos y movimientos antes/después de publicar, consultar, bloquear contratación y reiniciar: sin cambios. Las reservas y solicitudes anteriores permanecieron intactas.

## Evidencias y pruebas oficiales

| Verificación                           | Cierre fase 2        | Cierre fase 3                                          |
| -------------------------------------- | -------------------- | ------------------------------------------------------ |
| `npm run prisma:validate`              | Aprobado             | **Aprobado**                                           |
| `npm run build`                        | Aprobado             | **Aprobado**                                           |
| `npm run lint`                         | Aprobado             | **Aprobado**                                           |
| `npm test`                             | 183 / 183; 19 suites | **208 / 208; 22 suites**                               |
| `npm run test:e2e`                     | 144 / 144; 6 suites  | **154 / 154; 7 suites**                                |
| Script oficial `npm run test:postgres` | Aprobado             | **Aprobado**, flujos anteriores + activación + ofertas |

Las nuevas unitarias cubren métricas por tutor/materia y validación/propiedad/idempotencia/limpieza de banners; incluyen HTTP multipart y lectura binaria contra controlador real con persistencia en memoria. Las E2E ejecutan el AppModule completo sobre memoria y transporte de correo simulado. Google sigue simulado en las suites heredadas de fase 2. La API de demostración utiliza PostgreSQL y SMTP real Mailpit, sin proveedores externos.

El script oficial crea y elimina únicamente `timebank_test_<aleatorio>` en el servidor local comprobado y un directorio temporal propio de imágenes. Aplica migraciones/semilla dos veces. Conserva el control entero anterior de reservas/cobro único y las pruebas de activación; añade `scripts/test-tutoring-offers.cjs`.

| Caso                                                       | Evidencia observada                                                                                                                              |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 45 minutos por `"3.7"`, tutor saldo 0                      | PostgreSQL real: precio textual SQL `3.7`, una oferta, un horario, sin crédito exigido ni movimientos nuevos.                                    |
| Precio `"3.5"`, sin banner                                 | Publicación válida; portada del frontend puede usar su fallback.                                                                                 |
| Cero/negativo/número JSON/exponente/precisión adicional    | 400 y sin oferta/horario parcial. SQL directo `3.75`/`3.70`: CHECK 23514, precio anterior conservado.                                            |
| Pendiente, materia ajena, nivel distinto, horario inválido | Rechazados; permiso y validaciones comprobados por HTTP/memoria y PostgreSQL.                                                                    |
| Misma clave en dos instancias                              | Una oferta y un horario, respuesta original recuperable después de reabrir.                                                                      |
| Dos claves concurrentes tutor/materia                      | Una publicación; además el índice PostgreSQL rechaza SQL duplicado con 23505.                                                                    |
| Fallo SQL después de insertar horario                      | FK forzada en upsert de oferta: rollback completo, ningún horario suelto; el reintento crea uno de cada uno.                                     |
| Banner válido/falso/excesivo/ajeno                         | JPG/PNG/WebP reales aceptados; falso 400, excesivo 413, referencia ajena 400; imagen publicada recuperada por HTTP.                              |
| Flujo antiguo contra horario de oferta                     | 409 `OFFER_PRICE_FLOW_PENDING`, cero solicitudes/reservas/retenciones/movimientos nuevos. Aceptación antigua también protegida y probada en E2E. |
| Flujo entero previo                                        | Script oficial conserva reserva y cobro únicos de 4 créditos para una hora; E2E conserva cancelaciones, permisos e integridad.                   |
| Publicación y consulta                                     | Snapshot financiero idéntico antes/después: saldo, retenidos, decisión de bono y movimientos.                                                    |
| Reinicio real del proceso API                              | HTTP y SQL conservan `"3.7"`; reintento 201 recupera oferta, banner GET 200 y mismo SHA-256 de la imagen. Dos reservas previas intactas.         |

Evidencia local ignorada: `.local/phase3/final-*.log`, `offers-e2e-targeted-final.log`, `upgrade-results.json`, `upgrade-migrate.log`, `demo-results.json`. Los archivos `*.private.json`, `.env.phase3` y `phase2-before.dump` contienen material privado; no compartir. No se ejecutó navegador visual; los enlaces y recorrido se verificaron mediante HTTP.

## Demostración desde Swagger en esta PC

Los servicios quedan activos. Enlaces comprobados: [Swagger](http://127.0.0.1:4103/docs), [catálogo](http://127.0.0.1:4103/tutoring/offers?page=1&limit=100), [readiness](http://127.0.0.1:4103/health/ready) y [Mailpit](http://127.0.0.1:4104/). El catálogo contiene las ofertas de demostración por `"3.7"` con banner y `"3.5"` sin banner. El `bannerUrl` de la primera se puede abrir directamente.

1. Registrar una cuenta nueva `@ucb.edu.bo` en Swagger. Abrir su correo en Mailpit, confirmar e iniciar sesión. Pegar el `access_token` en **Authorize**. También puede usarse una cuenta propia activa; no se publican contraseñas en este documento.
2. Consultar `GET /skills` y añadir la habilidad al perfil mediante `POST /users/me/skills`. Conservar UUID y nivel exactos.
3. Opcionalmente ejecutar `POST /tutoring/banners` con un archivo y una clave nueva, por ejemplo `demo-oferta-python-0001.banner`. Hay un PNG válido privado en `.local/phase3/banner-demo.png` para probar. Copiar el `url` a `bannerUrl`; sin banner, omitirlo.
4. Ejecutar `POST /tutoring/offers` con el JSON anterior, horario futuro y clave nueva. Esperar 201; repetir la misma clave/cuerpo debe recuperar el mismo `id_oferta` y `id_disponibilidad`.
5. Consultar `GET /tutoring/offers?page=1&limit=100`. Comprobar `costo_creditos: "3.7"`, fechas, tutor, materia y métricas. Abrir el `bannerUrl` si lo hay.
6. Desde otra cuenta, intentar `/exchanges` con ese tutor, habilidad, `id_disponibilidad` y fechas. Observar 409 y el código; comprobar que `/credits/me` y movimientos no cambian. La contratación decimal se implementará en fase 4.

Para arrancar si está detenido, desde `backend/`: `& .\.local\phase3\start.ps1`. Para detener la API propia y Mailpit conservando PostgreSQL y volúmenes: `& .\.local\phase3\stop.ps1`. No ejecutar start mientras esa API ya esté activa. Los scripts verifican el destino y propiedad del PID; reutilizan el runtime de fase 1. La configuración privada deriva de fase 2 y añade el directorio propio de banners; no modifica los scripts/env de fases anteriores. Para compilar nuevos cambios se conserva Node 26.8.2/npm 11.19.1.

## Archivos de fase 3 frente al trabajo anterior

| Alcance                                   | Archivos                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nuevos de fase 3                          | `prisma/migrations/20261120010000_ofertas_tutoria/migration.sql`; `src/modules/tutoring/tutoring.module.ts`, `tutoring.controller.ts`, `tutoring.service.ts`, `offer.types.ts`, `offer-price.ts`, `offer-metrics.ts`, `offer-metrics.spec.ts`; `dto/create-offer.dto.ts`, `dto/offer-response.dto.ts`; `banners/banner.types.ts`, `banner-image.ts`, `banner-image.spec.ts`, `banner.service.ts`, `banner.service.spec.ts`, `banner.controller.ts`; `test/tutoring-offers.e2e-spec.ts`; `scripts/test-tutoring-offers.cjs`; este reporte.                                                                                                                                                                                                                              |
| Ya modificados en fase 2, ampliados ahora | `prisma/schema.prisma` conserva auth y añade ofertas/banners; `prisma-exchange.repository.ts` carga/persiste nuevos mapas y convierte Decimal a string; `exchange.types.ts`/`memory-exchange.repository.ts` añaden ofertas/banners/ratings; `schema-contract.spec.ts` verifica nuevas tablas manteniendo los nueve créditos enteros; `environment.ts`, `.env.example` añaden storage; `http-exception.filter.ts` permite dos códigos nuevos; health controller/spec exigen nuevas tablas; `scripts/test-postgres.cjs` conserva ambos flujos anteriores e invoca helper de ofertas; `test/setup-env.cjs` aísla imágenes; README y guía Frontend; `src/config/configure-app.ts` actualiza la descripción Swagger; package/lock añaden Sharp fijo y conservan Nodemailer. |
| Archivos antes limpios, modificados ahora | `src/app.module.ts` registra el módulo; `src/modules/exchanges/exchanges.service.ts` bloquea horario de oferta; `src/modules/exchanges/credits.ts` extrae la validación de duración sin cambiar tarifa antigua; `src/modules/availability/memory-availability.repository.ts` protege horario asociado.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Conservados de fase 2                     | Migración de autenticación, Mailpit, servicios/DTO de registro-verificación-Google-JWT, bono único, pruebas de activación, fixtures reparados y reportes anteriores. Permanecen en el árbol sin commit; no deben descartarse al revisar el diff combinado.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Solo herramientas/evidencias privadas     | `.local/phase3/` para entorno, control del proceso, copias, logs, imagen de prueba y demostración HTTP. `.local/phase1/` y `.local/phase2/` conservados.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

## Revisión de BD, ajuste Frontend y dependencia de fase 4

BD debe revisar la migración mínima, nombres de las dos tablas, FK/índices, política de escala sin redondeo y capacidad técnica; no se integra otro pensum. Debe acordar con PO centésimas y máximo comercial. El índice parcial, la transacción y el bloqueo existente se validaron con dos instancias, instalación limpia y actualización local conservando datos.

Frontend debe adaptar `frontend/src/features/offers/tutoring-model.js` (`tutorCreditCost`, `validateOfferContent`, `offerCreditCost`), `OfferCreditSummary.vue` y `OfferDialog.vue` para conservar y transmitir **string decimal**, sin `Number`/validación de entero; ejemplo `costoCreditos: "3.7"`. El campo puede usar texto con `inputmode="decimal"` y validación provisional de una décima. Debe resolver el `id_disponibilidad` específico de la oferta y sus fechas, no todos los horarios del tutor; conservar `code` en `ApiError` para explicar `OFFER_PRICE_FLOW_PENDING`. Detalles y rutas concretas están en [la guía de integración](frontend-integration.md#fase-3-ofertas-con-precio-publicado-y-banner).

Mantener `VITE_TUTORING_API_ENABLED=false`: esa bandera conjunta también habilita reseñas y contratación pendientes. No se cambió el frontend de la otra rama ni se declara integrada su interfaz.

Para iniciar fase 4 se necesita acordar/aplicar con BD la conversión coordinada de los **nueve campos de créditos**, la representación exacta de saldo/retenciones/ledger y los DTO correspondientes. El punto de entrada está en `ExchangesService.requireAvailability`; en `createRequest` se resolverá `id_oferta` y se copiará `costo_creditos` al snapshot de solicitud. En `acceptRequest` se usará ese importe pactado y se copiará a reserva, eliminando el recálculo por duración para esas solicitudes. Cancelación y liquidación operarán sobre esa copia con aritmética exacta; el control anterior debe conservarse. Hasta completar y probar ese recorrido, el bloqueo 409 permanece activo.
