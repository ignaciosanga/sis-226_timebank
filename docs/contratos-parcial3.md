# Contratos entre componentes — Parcial 3

**Tarea:** TBAPI-98 HU-14 · INT-09 · **Fecha:** 21/11/2026 · **Responsable:** Luz Camila Pérez Cano

Este documento fija el contrato único entre **frontend, backend, base de datos y BI (Looker Studio)** para el tercer parcial: rutas, campos, tipos, estados y códigos de error. Los créditos viajan como **string decimal**.

## 1. Fuente de verdad y versiones revisadas

| Componente | Rama | Commit revisado |
|---|---|---|
| Backend (NestJS) | `feat/backend-nucleo-transaccional-parcial3` | `8fe275b` |
| Frontend (Vue 3) | `front_end_parcial_3` | `0e577a9` |
| Base de datos y dashboards | `main` (`database/`, `dashboards/`) | `18f3ccc` |

- La referencia **máquina-legible** es [`docs/openapi.json`](openapi.json), generado desde `/docs-json` del backend en el commit `8fe275b` (47 rutas). Si este documento y el OpenAPI difieren, manda el OpenAPI.
- Este documento reemplaza a [`api-contract.md`](api-contract.md) en lo que cambió en el parcial 3 (ver sección 9). Los PDF y documentos anteriores quedan como historia.
- El CI comprueba que el frontend solo use rutas del OpenAPI (sección 8).

## 2. Reglas generales

| Tema | Regla |
|---|---|
| URL base | Local `http://localhost:4000`. Publicada: `https://timebank-backend-51q9.onrender.com` (Swagger en `/docs`, OpenAPI en `/docs-json`). Sin prefijo global. |
| Formato | JSON (`Content-Type: application/json`), salvo `POST /tutoring/banners` (`multipart/form-data`, campo `banner`). |
| Autenticación | `Authorization: Bearer <access_token>`. JWT con `purpose: "session"`, vigencia por defecto 900 s, sin refresh token. El estado y los roles se vuelven a consultar en cada petición. |
| Identificadores | UUID. El actor siempre sale del JWT, nunca del cuerpo. |
| Fechas | ISO 8601 con zona explícita (`Z` o `±HH:mm`) al enviar. El servidor devuelve UTC terminado en `Z`. El frontend muestra hora de Bolivia (UTC-4). |
| Paginación | Query `page` (por defecto 1) y `limit` (por defecto 20, máximo 100). Respuesta `{ data: [...], meta: { page, limit, total, totalPages } }`. |
| Idempotencia | Header `Idempotency-Key` (16–128 caracteres: letras ASCII, números, `.` `_` `:` `-`; un UUID sirve). Obligatorio en los `POST` marcados con ⟲. Misma clave y mismo contenido devuelve el resultado original sin repetir efectos; misma clave con otro contenido → 409. |
| Campos extra | Los DTO rechazan campos desconocidos y `null` donde no se admite (400). |
| Créditos | **Siempre string decimal**: `"10"`, `"3.7"`. Nunca número JSON. Ver sección 5. |

## 3. Rutas

Acceso: **Público** · **JWT** (cualquier cuenta activa) · **EST** (rol ESTUDIANTE) · **ADMIN**. ⟲ = requiere `Idempotency-Key`.

### 3.1 Sesión y perfil

| Método y ruta | Acceso | Cuerpo → respuesta | Errores |
|---|---|---|---|
| `POST /auth/register` | Público | `{ nombre, apellido, correo, password, idCarrera, semestre }` → **201** `RegistrationResponse` con `estado: "Pendiente"` y `verification_required: true` (sin token) | 400, 409 |
| `GET /auth/verify-email` | Público | Página HTML con botón. No activa nada. | 400 |
| `POST /auth/verify-email` | Público | `{ token }` (43 caracteres) → **200** `{ status: "verified", login_required: true }` | 400 |
| `POST /auth/resend-verification` | Público | `{ correo }` → **202** con mensaje genérico | 400 |
| `POST /auth/login` | Público | `{ correo, password }` → **200** `{ access_token, token_type: "Bearer", user }` | 400, 401, **403** `EMAIL_VERIFICATION_REQUIRED` |
| `POST /auth/google` | Público | `{ credential, idCarrera?, semestre?, nombre?, apellido? }` → **200** sesión, o `registration_required: true` si falta completar el perfil | 400, 401 |
| `GET /users/me` | JWT | → **200** `PublicUser` | 401 |
| `PATCH /users/me` | JWT | `{ nombre?, apellido?, idCarrera?, semestre? }` → **200** `PublicUser` | 401 |

- `password`: 12–128 caracteres. `correo`: dominio exacto `@ucb.edu.bo`. `semestre`: entero ≥ 1.
- Las cuentas nuevas quedan `Pendiente` con saldo `"0"` hasta verificar el correo; al activarse reciben **una sola vez** el bono (8 créditos por defecto). Google verificado entra sin segundo bono.
- `PublicUser`: `{ id, nombre, apellido, correo, idCarrera, semestre, rol, roles, estado }`. `rol`: `Estudiante | Profesor | Administrador`. `roles[]`: `ESTUDIANTE | PROFESOR | ADMIN`. `estado`: `Pendiente | Activo | Inactivo | Suspendido`.

### 3.2 Catálogos, habilidades y horarios

| Método y ruta | Acceso | Cuerpo / query → respuesta |
|---|---|---|
| `GET /careers`, `GET /careers/{id}` | Público | `page, limit, search` → `CareersPage` / `Career` |
| `GET /categories`, `GET /categories/{id}` | Público | `CategoriesPage` / `Category` |
| `POST /categories` | ADMIN | `{ nombre }` → 201 |
| `GET /skills`, `GET /skills/{id}` | Público | `page, limit, search, categoryId` → `SkillsPage` / `Skill` |
| `POST /skills` | ADMIN | `{ nombre, categoryId }` → 201 |
| `GET /skills/{id}/providers` | Público | `page, limit, search, nivel` → `SkillProvidersPage` |
| `GET /users/me/skills` | EST | → `[PublishedUserSkill]` |
| `POST /users/me/skills` | EST | `{ skillId, nivel }` → 201 `UserSkill` (duplicado → 409) |
| `DELETE /users/me/skills/{skillId}` | EST | → **204** sin cuerpo |
| `GET /users/{id}/skills` | JWT | → `[PublishedUserSkill]` |
| `POST /availability` | EST | `{ fechaInicio, fechaFin }` → 201 `Availability` |
| `GET /availability/me` | EST | → `[Availability]` |
| `PATCH /availability/{id}` | EST | `{ fechaInicio?, fechaFin? }` → 200 (horario ligado a una oferta → 409 `OFFER_AVAILABILITY_MANAGED`) |
| `DELETE /availability/{id}` | EST | → **204** (mismo 409 para horarios de oferta) |
| `GET /users/{id}/availability` | JWT | → `[Availability]` |

- `nivel`: `Basico | Intermedio | Avanzado | Experto` (sin tildes, con mayúscula inicial).
- `Availability`: `{ id_disponibilidad, id_usuario, fecha_inicio, fecha_fin, estado }`, con `estado`: `disponible | reservado | cancelado` (minúsculas).

### 3.3 Ofertas de tutoría (nuevo en el parcial 3)

| Método y ruta | Acceso | Cuerpo / query → respuesta |
|---|---|---|
| `GET /tutoring/offers` | Público | `page, limit, search` → `OfferPage` (solo ofertas activas, vigentes y con horario libre) |
| `POST /tutoring/offers` ⟲ | JWT | `{ skillId, nivel, titulo, descripcion, costoCreditos, fechaInicio, fechaFin, bannerUrl? }` → **201** `OfferResponse` |
| `POST /tutoring/banners` ⟲ | JWT | multipart, campo `banner` → **201** `{ url }` |
| `GET /tutoring/banners/{id}` | Público | → bytes de la imagen (solo si está vinculada a una oferta activa) |

- `titulo`: 1–100. `descripcion`: 1–1500. **`costoCreditos`: string** positivo, entero o con **una sola décima** (`"4"`, `"3.7"`). `"3.75"`, `"3.70"`, números JSON, comas y exponentes → 400. Es el precio **total por clase**, no depende de la duración.
- La duración va de 15 min a 8 h, en múltiplos de 15 min. La habilidad debe estar publicada en el perfil del tutor, con el mismo nivel.
- Banner: JPG, PNG o WebP reales, máximo 3 MiB y 16 megapíxeles. El `url` devuelto se copia tal cual en `bannerUrl`. Imagen falsa → 400; muy grande → 413; carga vencida (24 h) → 410.
- `OfferResponse`: `{ id_oferta, id_usuario, id_tutor, id_habilidad, id_disponibilidad, nivel, titulo, descripcion, costo_creditos (string), bannerUrl (string|null), fecha_inicio, fecha_fin, tutor{ id, nombre, apellido }, materia{ id_habilidad, nombre }, metricas{ promedio (número|null), opiniones, tutorias_completadas } }`.

### 3.4 Intercambios y reservas

| Método y ruta | Acceso | Cuerpo → respuesta |
|---|---|---|
| `POST /exchanges` ⟲ | EST | `{ providerId, skillId, availabilityId, fechaInicio, fechaFin, offerId?, descripcion? }` → **201** `ExchangeRequestResponse` (estado `Solicitada`, sin retener créditos) |
| `GET /exchanges/me` | EST | → `[ExchangeRequestResponse]` |
| `POST /exchanges/{id}/accept` ⟲ | EST (tutor) | `{}` → **200** `ReservationResponse`; retiene el importe exacto |
| `POST /exchanges/{id}/reject` ⟲ | EST (tutor) | `{}` → 200 `ExchangeRequestResponse` |
| `POST /exchanges/{id}/cancel` ⟲ | EST (solicitante) | `{}` → 200 `ExchangeRequestResponse` |
| `GET /exchanges/integrity` | ADMIN | → `IntegrityResponse` (solo lectura) |
| `GET /reservations/me` | EST, ADMIN | → `[ReservationResponse]` |
| `GET /reservations/{id}` | participante | → `ReservationResponse` |
| `POST /reservations/{id}/confirm` ⟲ | participante | `{}` → 200 `ReservationResponse` |
| `POST /reservations/{id}/cancel` ⟲ | participante o ADMIN | `{ motivo }` (1–500) → 200 `ReservationResponse` |
| `POST /calendar/reservations/{id}/authorization-url` | EST | → `{ authorizationUrl }` (solo reservas `Confirmada`) |
| `GET /calendar/callback` | Público (Google) | redirige a `/intercambios?calendar=created` o `calendar=exists` |

- Con `offerId` (o con un horario ligado a oferta) el servidor toma el **precio publicado**; el cliente nunca envía un importe. La solicitud copia el precio a `creditos_requeridos` y la reserva a `creditos`; ese valor es el que se retiene, se libera o se transfiere, aunque la oferta cambie después.
- Sin oferta rige el flujo histórico: precio por duración (45 min = `"3"`).
- **Confirmar** solo es válido a partir de la hora de fin (si no → **409** "La reserva aun no termino"). La primera confirmación mantiene la retención; la segunda transfiere una sola vez al tutor.
- **Cancelar**: un participante, estrictamente antes del inicio; ADMIN, hasta que la reserva se complete. Libera la retención una sola vez y no paga al tutor.
- `ExchangeRequestResponse`: `{ id_solicitud, id_solicitante, id_ofertante, id_habilidad, id_disponibilidad, id_oferta|null, fecha_inicio_propuesta, fecha_fin_propuesta, creditos_requeridos (string), costo_creditos (string), descripcion, estado, created_at, respondida_at|null }`.
- `ReservationResponse`: `{ id_reserva, id_solicitud, id_solicitante, id_ofertante, id_habilidad, id_disponibilidad, id_oferta|null, fecha_inicio, fecha_fin, creditos (string), monto_creditos (string), modalidad, lugar, estado, confirmacion_solicitante_at|null, confirmacion_ofertante_at|null, confirmaciones[], cancelacion|null, completed_at|null, cancelled_at|null, … }`.

### 3.5 Créditos y administración

| Método y ruta | Acceso | Cuerpo / query → respuesta |
|---|---|---|
| `GET /credits/me` | EST | → `AccountResponse` |
| `GET /credits/me/movements` | EST | → `[MovementResponse]` |
| `POST /credits/grants` ⟲ | ADMIN | `{ userId, amount, reason }` → **201** `{ cuenta, movimiento }` |
| `GET /admin/users` | ADMIN | `page, limit, search, estado, rol, idCarrera` → `AdminUsersPage` |
| `POST /admin/users` | ADMIN | `RegisterDto` → 201 `PublicUser` (queda `Pendiente`) |
| `PATCH /admin/users/{id}/status` | ADMIN | `{ estado: "Activo"\|"Inactivo", motivo? }` → 200 `AdminUser` (no activa cuentas `Pendiente`) |
| `GET /analytics/{overview,users,exchanges,credits,skills}` | ADMIN | `from, to, groupBy, limit` → 200 (503 si la fuente no responde) |
| `GET /health`, `GET /health/ready` | Público | `ReadinessResponse { status, persistence }`; `/health/ready` da 503 si la base no responde |

- `AccountResponse`: `{ id_usuario, saldo, creditos_retenidos, disponibles, unidad }`, los tres importes **string**. `disponibles = saldo − creditos_retenidos`. `unidad`: `CREDITO` (esquema decimal) o `CREDITO_15_MINUTOS` (esquema entero histórico).
- `MovementResponse`: `{ id_movimiento, id_usuario, id_reserva|null, tipo, cantidad, monto, saldo_anterior, saldo_posterior, retenidos_anterior, retenidos_posterior, created_at, descripcion|null }`, todos los importes **string**.
- `tipo` de movimiento: `BonoInicial | Recompensa | Penalizacion | Transferencia | Ajuste | Retencion | Liberacion | Consumo`.
- `POST /credits/grants` solo funciona en desarrollo y pruebas: con `NODE_ENV=production` responde 403. Con la base en esquema entero solo admite importes enteros (400 si trae décimas). La colección Postman de RF-25 depende de esto para cargar créditos al estudiante B.

### 3.6 Notificaciones

| Método y ruta | Acceso | Cuerpo / query → respuesta |
|---|---|---|
| `GET /notifications/me?page=1&limit=20` | JWT | `page, limit` → 200 `NotificationsPage` |
| `PATCH /notifications/{id}/read` | JWT (solo el dueño) | → 200 `NotificationResponse` con `leida: true` |
| `POST /notifications/read-all` | JWT | → 200 `{ actualizadas }` (cantidad de notificaciones marcadas como leídas) |

- `NotificationResponse`: `{ id_notificacion, tipo, titulo, mensaje, leida, created_at }`.
- `NotificationsPage`: `{ data: [NotificationResponse], meta: { page, limit, total, totalPages, noLeidas } }`. Es la paginación de la sección 2 más `noLeidas`.
- `tipo`: `SolicitudRecibida | SolicitudAceptada | SolicitudRechazada | ReservaCancelada | ClasePorConfirmar | OpinionRecibida`.
- Ejemplo de `POST /notifications/read-all`: `{ "actualizadas": 3 }`.

## 4. Estados

| Entidad | Valores y transiciones |
|---|---|
| Cuenta | `Pendiente` → `Activo` (verificación de correo o Google) · `Inactivo` · `Suspendido` |
| Solicitud | `Solicitada` → `Aceptada` \| `Rechazada` \| `Cancelada` |
| Reserva | `Confirmada` → `Completada` \| `Cancelada` (estados finales cerrados) |
| Horario | `disponible`, `reservado`, `cancelado` |
| Oferta | `Activa` → `Finalizada` (al publicar otra del mismo tutor y materia tras terminar la anterior) |

## 5. Créditos como string decimal

1. En JSON, **todo importe de créditos es string** (`"3.7"`). Los contadores (`opiniones`, `total`, `page`…) siguen siendo números.
2. En la entrada se aceptan enteros o **una décima**. Se rechazan `"3.70"`, centésimas y exponentes.
3. Prohibido `Number()`, `parseFloat` o aritmética de coma flotante con créditos. El frontend los muestra tal cual y solo los convierte para formatear; para comparar o sumar debe usar décimas enteras (`"3.7"` → 37).
4. El backend suma, resta y compara con enteros escalados (`bigint`); la base usa `NUMERIC` sin `typmod` (ver sección 7).
5. Cota técnica vigente por importe en el ledger: `2147483647`. Una oferta por encima de esa cota se puede publicar, pero no contratar.
6. Valores de ejemplo (probados por el backend): saldo `"10"`, retenido `"3.7"`, disponible `"6.3"`; tras la segunda confirmación el estudiante queda en `"6.3"` y el tutor recibe `"3.7"`.

## 6. Errores

Formato único (el filtro del backend lo aplica a todo error):

```json
{ "statusCode": 409, "message": "La oferta ya no está disponible", "code": "OFFER_NOT_AVAILABLE", "timestamp": "2026-11-21T14:00:00.000Z" }
```

- `message`: texto o arreglo de textos (validación). `code`: opcional, solo en los casos de la tabla. Los 5xx no exponen detalles.
- El frontend debe **conservar `code`** además de `message`: hoy `ApiError` solo guarda `status` y `message` (ver sección 7).

| HTTP | Cuándo |
|---|---|
| 400 | Validación, campo extra, `Idempotency-Key` inválida, precio mal formado |
| 401 | Credenciales o JWT inválidos, cuenta inactiva |
| 403 | Rol, propiedad o participación; cuenta `Pendiente` con contraseña correcta |
| 404 | Recurso inexistente o no publicable |
| 409 | Unicidad, solapamiento, estado, saldo insuficiente, clave reutilizada con otro contenido, confirmar antes de la hora de fin |
| 410 | Carga de banner vencida |
| 413 | Banner mayor a 3 MiB |
| 429 | Límite de peticiones |
| 503 | Servicio no disponible (correo, base, fuente de analytics) |

| `code` | HTTP | Significado | Qué hace el frontend |
|---|---|---|---|
| `EMAIL_VERIFICATION_REQUIRED` | 403 | La cuenta existe pero no verificó el correo | Ofrecer reenviar (`/auth/resend-verification`) |
| `OFFER_PRICE_FLOW_PENDING` | 409 | La base conserva créditos enteros: no se pueden contratar ofertas | Informar que la contratación aún no está habilitada |
| `OFFER_MISMATCH` | 409 | `offerId` o fechas no corresponden a la oferta | Recargar la oferta |
| `OFFER_NOT_AVAILABLE` | 409 | La oferta o su horario ya no permiten contratar | Recargar catálogo |
| `OFFER_SNAPSHOT_REQUIRED` | 409 | Solicitud antigua sin precio pactado | Pedir una solicitud nueva |
| `OFFER_AVAILABILITY_MANAGED` | 409 | El horario de una oferta no se edita por separado | Editar desde la oferta |
| `DECIMAL_SETTLEMENT_PENDING` | 409 | Liquidar reservas de oferta o fraccionarias, protegido hasta contar con esquema decimal | Informar y no reintentar |

## 7. Contrato con la base de datos y con BI

| Punto | Contrato |
|---|---|
| Tablas | 15 de aplicación (`VERIFICACIONES_CORREO`, `OFERTAS` y `BANNERS_TUTORIA` son nuevas) más `_prisma_migrations`. `/health/ready` ahora espera 15, no 12. |
| Migraciones | `20261120000000_verificacion_institucional` y `20261120010000_ofertas_tutoria`. Fuente oficial: `backend/prisma/migrations`. |
| Créditos | Los 9 campos de créditos siguen **INTEGER** en el esquema oficial del equipo de BD. El backend los trata como decimales solo con el esquema `NUMERIC` provisional (`backend/scripts/fixtures/phase4-decimal-provisional.sql`, fuera de `prisma/migrations`). **Falta que BD entregue y acuerde esa migración.** |
| Precio de oferta | `OFERTAS.costo_creditos` es `NUMERIC` con `CHECK > 0`, escala ≤ 1 y valor ≤ `9999999999.9` (capacidad técnica, no máximo comercial). |
| Vistas | 32 vistas de reporte y 4 funciones leen créditos. Al pasar a `NUMERIC` hay que reconstruir las 9 vistas dependientes y 3 funciones; Dashboards debe validar sus consultas. |
| Usuario de BI | Looker Studio lee con un usuario de solo lectura. No escribe. |
| Analytics | `GET /analytics/credits` devuelve `saldoTotalActual`, `retenidosActuales`, `transferidos` y retenciones históricas como **string**. Dashboards no debe asumir números. |

## 8. Verificación automática (INT-11)

- La prueba [`frontend/tests/openapi-contract.test.js`](../frontend/tests/openapi-contract.test.js) lee todos los servicios de `frontend/src/services`, extrae método y ruta de cada llamada y los compara con `docs/openapi.json`. **Falla** si una ruta o un método no existe en el OpenAPI.
- Corre dentro de `npm test`, así que el job `Frontend` del CI la ejecuta en cada Pull Request a `main`.
- Las rutas que el frontend ya usa y el backend aún no publica se declaran en `frontend/tests/contract-pending.json`, con `reason` y `owner`. Una entrada que deje de hacer falta también hace fallar la prueba, para que la lista no envejezca.
- Para actualizar el OpenAPI: levantar el backend y guardar `GET /docs-json` en `docs/openapi.json`.
- Alcance: valida rutas y métodos, no campos del cuerpo ni tipos. Los campos se acuerdan en este documento y se verifican con la colección Postman (INT-10).

## 9. Diferencias detectadas entre componentes (21/11/2026)

| # | Diferencia | Dónde | Responsable | Acción |
|---|---|---|---|---|
| 1 | El frontend llama `GET /tutoring/reviews`, `GET /tutoring/reviews/me` y `POST /tutoring/reservations/{id}/review`; el backend **no las publica** y dice que "esta fase no incorpora escritura de opiniones". | Frontend ↔ Backend | Backend | Implementar o quitar. Mientras, quedan en `contract-pending.json`. |
| 2 | El frontend llama `GET /roadmap/me` y `PUT /roadmap/me/courses/{codigo}`; el backend **no las publica**. | Frontend ↔ Backend | Backend / PO | Decidir si el roadmap es del parcial 3 y, si lo es, implementarlo. |
| 3 | `docs/ofertas-y-opiniones.md` (frontend) define `costo_creditos` y `costoCreditos` como **entero** (`7`). El backend usa **string con una décima** (`"3.7"`). | Frontend ↔ Backend | Frontend | Adaptar `tutoring.js` y el formulario a string decimal (sección 5). |
| 4 | `ApiError` del frontend descarta `code`. | Frontend | Frontend | Guardar `code` y usarlo según la tabla de la sección 6. |
| 5 | Contratar ofertas devuelve `OFFER_PRICE_FLOW_PENDING` mientras la base conserve INTEGER. `VITE_TUTORING_API_ENABLED` debe seguir en `false` en el despliegue. | Backend ↔ BD | BD | Entregar la migración decimal (sección 7). |
| 6 | `docs/openapi.json` en `main` es anterior al parcial 3 (39 rutas, sin tutoring, verify-email, google ni calendar). | Documentación | Quien integre el backend | Reemplazar por el de este PR. |
| 7 | `docs/api-contract.md` dice "créditos enteros, nada de decimales" y "1 crédito = 15 minutos". Ya no vale para ofertas. | Documentación | Esta tarea | Este documento lo reemplaza para el parcial 3. |
| 8 | `docs/api-contract.md` lista `ESTUDIANTE, PROFESOR, ADMIN` y estados de solicitud; hoy el registro devuelve además `estado: Pendiente` y `verification_required`. | Documentación | Esta tarea | Actualizado en las secciones 3.1 y 4. |

## 10. Pendientes de decisión

- Máximo comercial del precio de una oferta (hoy solo hay cota técnica).
- Centésimas en los créditos (hoy solo una décima).
- Bono de bienvenida: 8 por defecto, pendiente de confirmar por el PO.
- Si `roadmap` entra al alcance del parcial 3.
- Colección Postman del parcial 3 (INT-10, Adriana Quiroz): debe cubrir verificación de correo, ofertas, banner, solicitud a precio publicado, aceptar, doble confirmación y créditos decimales.
