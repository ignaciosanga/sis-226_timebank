# Integración del frontend

El frontend consume la API HTTP de NestJS. No necesita credenciales ni una conexión directa a PostgreSQL. Swagger y `/docs-json` son el contrato actual; los documentos v0.2/v0.3 son históricos.

Actualizado para fase 2 (20 de noviembre de 2026): registro pendiente, verificación y bono único. Evidencia, SMTP local y resultados oficiales en [el reporte de fase 2](fase2-cuentas-institucionales.md).

## Entorno local

Revisión estática del 22 de octubre de 2026: no están disponibles las referencias locales `equipo/frontend` ni `equipo/BD`. No se ejecutaron fetch ni peticiones HTTP; la compatibilidad entre equipos sigue pendiente. Ver en el README la diferencia entre las 12 tablas implementadas y las 13 anunciadas por BD.

Los pasos siguientes son para ejecución posterior: Compose aplica migraciones y semillas. Usarlos solo en una instancia local compatible con el modelo de 12 tablas, no sobre modelos de 13/18 tablas sin un plan acordado con BD.

Con Docker Desktop activo, desde la raíz del backend:

```powershell
npm.cmd ci
npm.cmd run setup:docker
docker compose up --build -d
```

Compose crea el esquema y los catálogos locales antes de iniciar la API. `db-init` es de ejecución única: terminar con código 0 es normal. `postgres` y `backend` son los servicios activos. Cada compañero genera sus credenciales en `.env`; ese archivo no se comparte ni se versiona.

| Recurso                               | Dirección predeterminada                                         |
| ------------------------------------- | ---------------------------------------------------------------- |
| API                                   | `http://localhost:4000`                                          |
| Swagger                               | `http://localhost:4000/docs`                                     |
| OpenAPI                               | `http://localhost:4000/docs-json`                                |
| Proceso                               | `GET /health`                                                    |
| Conexión y presencia de las 12 tablas | `GET /health/ready`                                              |
| BD para herramientas locales          | `127.0.0.1:55432`, base `timebank_local`, credenciales de `.env` |

Si otra instancia ocupa 4000, detenerla o definir `BACKEND_PORT=4001` en `.env` y cambiar la URL del frontend. La respuesta de readiness con BD disponible es `{"status":"ok","persistence":"postgresql"}`; si falla devuelve 503. En memoria indica `persistence: "memory"`.

En Vite, definir `VITE_API_URL=http://localhost:4000`. El backend permite por defecto los orígenes `http://localhost:3000`, `http://localhost:5173` y `http://127.0.0.1:5173`. Para otro origen, editar `CORS_ORIGINS` en `.env`, separado por comas y sin barra final, y recrear con `docker compose up -d backend`. Enviar JWT por cabecera; no se usan cookies. Compose publica puertos solo en la máquina local: cada compañero puede levantar su copia.

## Registro y sesión

1. Consultar `GET /careers` y usar un UUID de carrera activa.
2. Registrar con `POST /auth/register` (201):

```json
{
  "nombre": "Ana",
  "apellido": "Perez",
  "correo": "ana@ucb.edu.bo",
  "password": "una-clave-local-larga",
  "idCarrera": "30000000-0000-4000-8000-000000000001",
  "semestre": 3
}
```

La contraseña debe tener 12–128 caracteres; semestre es un número entero entre 1 y 12. El correo se normaliza y debe terminar exactamente en `@ucb.edu.bo`. El registro devuelve el perfil con `estado: "Pendiente"` y `verification_required: true`, saldo interno cero, sin sesión ni token de verificación. Requiere SMTP: el enlace llega por correo.

3. Abrir el enlace del correo y pulsar «Confirmar mi correo». La página hace `POST /auth/verify-email` con `{ "token": "credencial-del-correo" }`. Devuelve `{ "status": "verified", "login_required": true }`; no emite sesión. GET no activa. Token inválido/vencido: 400. Reutilizar uno confirmado responde 200 sin repetir efectos.
4. Autenticar con `POST /auth/login` (200), cuerpo `{"correo":"ana@ucb.edu.bo","password":"una-clave-local-larga"}`. Antes de verificar, contraseña correcta: 403 con `code: "EMAIL_VERIFICATION_REQUIRED"`; contraseña incorrecta: 401.
5. La respuesta contiene `access_token`, `token_type: "Bearer"` y `user`. Enviar `Authorization: Bearer <access_token>` en rutas privadas. El token vence por defecto a los 900 segundos; ante 401 solicitar login. No hay refresh ni logout de servidor. Un state OAuth o un enlace de correo no sirven como Bearer. Las sesiones anteriores sin `purpose` requieren iniciar sesión otra vez.
6. Consultar `GET /users/me`, `GET /credits/me` y `GET /credits/me/movements`. El bono se decide al activar (8 por defecto; 0 sin movimiento) y no se repite en futuros accesos.

Para reenviar: `POST /auth/resend-verification`, `{ "correo": "ana@ucb.edu.bo" }` → 202 con mensaje genérico. Rota el enlace anterior cuando se emite otro; espera mínima de 60 segundos por cuenta con enlace pendiente y límite de tres solicitudes por minuto/IP. Un fallo SMTP devuelve 503; la cuenta pendiente se recupera con reenvío, sin repetir el registro.

`POST /auth/google` recibe `credential` (ID token de Google). Exige identidad institucional verificada y `sub`; no basta enviar un correo. Si es nueva y falta perfil, devuelve `registration_required: true`; reenviar la credencial con `idCarrera` y `semestre` para completar. Cuenta nueva o pendiente: activa y decide bono una vez; cuenta activa anterior: conserva rol, saldo y movimientos. Inactivos/suspendidos no se activan por esta vía. Si Google activa una cuenta pendiente, invalida la contraseña del prerregistro; debe continuar entrando por Google. Las cuentas activas con contraseña conservan ambos métodos.

`user.id` se utiliza como `providerId` o `userId`; otras respuestas mantienen nombres de BD como `id_habilidad`, `id_disponibilidad` e `id_reserva`. `rol` es Estudiante, Profesor o Administrador; `roles` expone capacidades (`ESTUDIANTE`, `PROFESOR`, `ADMIN`). El backend vuelve a consultar el estado y los permisos del usuario.

## Rutas principales

| Acción                                  | Ruta y cuerpo                                                                 |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| Catálogos públicos                      | `GET /careers`, `/categories`, `/skills`                                      |
| Publicar habilidad propia               | `POST /users/me/skills`, `{ "skillId": "UUID", "nivel": "Avanzado" }`         |
| Habilidades del ofertante               | `GET /users/:id/skills`                                                       |
| Publicar disponibilidad                 | `POST /availability`, `{ "fechaInicio": "ISO-8601", "fechaFin": "ISO-8601" }` |
| Consultar disponibilidad                | `GET /availability/me` o `/users/:id/availability`                            |
| Enviar solicitud                        | `POST /exchanges`, cuerpo del ejemplo siguiente                               |
| Mis solicitudes                         | `GET /exchanges/me`                                                           |
| Aceptar / rechazar / cancelar solicitud | `POST /exchanges/:id/accept`, `/reject` o `/cancel`, cuerpo `{}`              |
| Mis reservas                            | `GET /reservations/me`                                                        |
| Confirmar servicio terminado            | `POST /reservations/:id/confirm`, cuerpo `{}`                                 |
| Cancelar reserva                        | `POST /reservations/:id/cancel`, `{ "motivo": "Motivo de cancelacion" }`      |
| Cuenta y movimientos                    | `GET /credits/me`, `/credits/me/movements`                                    |

Salvo los catálogos, las rutas de esta tabla requieren sesión. Catálogos responden `{ data, meta: { page, limit, total, totalPages } }`, aceptan `page`, `limit`, `search`; habilidades también `categoryId`. Los listados propios son arrays. Niveles permitidos: Basico, Intermedio, Avanzado, Experto.

```json
{
  "providerId": "UUID-del-ofertante",
  "skillId": "UUID-de-habilidad-publicada",
  "availabilityId": "UUID-de-disponibilidad",
  "fechaInicio": "fecha-futura-ISO-8601",
  "fechaFin": "fecha-futura-ISO-8601",
  "descripcion": "Ayuda para practicar"
}
```

Enviar fechas con zona horaria, preferentemente UTC mediante `toISOString()`. Usar un intervalo futuro contenido en la disponibilidad, en múltiplos de 15 minutos y hasta 8 horas. El frontend debe conservar el ID del ofertante: esta entrega no incluye buscador global de usuarios/ofertantes.

Solicitudes: `Solicitada`, `Aceptada`, `Rechazada`, `Cancelada`. Reservas: `Confirmada`, `Completada`, `Cancelada`. Aceptar retiene créditos y evita superposición de ambos participantes. Cada participante confirma después del fin; la segunda confirmación liquida una vez. Antes del inicio, cancelar libera la retención. Después del inicio requiere ADMIN mientras no esté completada.

## Créditos y reintentos

La paginación de catálogos comienza en `page=1`, con `limit=20` por defecto y máximo 100. Las carreras exponen `id_carrera`, `nombre`, `facultad` y `estado`. Crear solicitudes devuelve 201; aceptar/rechazar/cancelar y confirmar devuelven 200. Aceptar devuelve una reserva: conservar `id_reserva` para sus acciones. Una solicitud aceptada se cancela mediante la reserva, no mediante `/exchanges/:id/cancel`.

**Un crédito equivale a 15 minutos; una hora cuesta 4 créditos.** Cuenta: `saldo`, `creditos_retenidos` y `disponibles` son strings de enteros. Reserva: `creditos` es número entero. `saldo` incluye los retenidos; `disponibles = saldo - creditos_retenidos`. No enviar decimales ni dinero.

Los POST de `/exchanges`, sus acciones, confirmación/cancelación de `/reservations` y `/credits/grants` requieren `Idempotency-Key`. Generar una clave por acción con `crypto.randomUUID()` y **reutilizar la misma clave y cuerpo al reintentar por un fallo de red**. Una nueva acción lleva otra clave. Se admiten 16–128 caracteres alfanuméricos o `. _ : -`. El resultado persiste en PostgreSQL. Reutilizar una clave con otro contenido devuelve 409.

Deshabilitar el botón durante el envío mejora la interfaz. Ante 409, mostrar el motivo y actualizar el recurso; si se perdió la respuesta, reintentar con la clave original.

## ADMIN local y saldo de desarrollo

```powershell
docker compose exec backend node scripts/create-dev-admin.cjs admin@ucb.edu.bo
```

Guardar la contraseña aleatoria impresa por el comando, confirmar el correo enviado y autenticar con `/auth/login`. Requiere SMTP y correo `@ucb.edu.bo`. No modifica usuarios existentes; no usar el comando de administrador en memoria para PostgreSQL. El registro público no acepta asignación de roles.

ADMIN puede cargar saldo mediante `POST /credits/grants`, con JWT e `Idempotency-Key`, cuerpo `{ "userId": "UUID-del-solicitante", "amount": "8", "reason": "Desarrollo frontend" }`. Esta carga es exclusiva de desarrollo/pruebas. `GET /exchanges/integrity` permite a ADMIN consultar coherencia del estado.

## Gestión administrativa de usuarios (ADMIN)

Rutas bajo `/admin/users`, con `Authorization: Bearer <token>` de un usuario `Administrador`; otro rol recibe 403 y un usuario inactivo 401.

- `GET /admin/users?search=ana&estado=Activo&rol=Estudiante&idCarrera=<uuid>&page=1&limit=20`: respuesta `{ data: AdminUser[], meta }`. `AdminUser` = perfil público más `estado` (`Activo`, `Inactivo`, `Suspendido`), `fechaRegistro` y `ultimoAcceso`; nunca saldos ni hashes. Todos los filtros son opcionales.
- `POST /admin/users`: mismo cuerpo que `/auth/register` (`nombre`, `apellido`, `correo`, `password` ≥ 12, `idCarrera`, `semestre` 1–12). Crea un Estudiante pendiente con saldo cero y envía confirmación; no admite `rol`. 201 con perfil y `verification_required: true`; 409 si el correo existe. El ADMIN no puede activar una cuenta pendiente mediante el endpoint de cambio de estado.
- `PATCH /admin/users/:id/status` con `{ "estado": "Inactivo", "motivo": "opcional" }` (baja lógica) o `{ "estado": "Activo" }` (reactivación). 200 con `AdminUser`; 404 si no existe; 409 si el estado ya es el solicitado, si el ADMIN intenta desactivarse, si es el último ADMIN activo, si el usuario tiene reservas confirmadas o créditos retenidos, o si se intenta reactivar un `Suspendido`.

La baja no borra datos ni modifica saldos, reservas ni movimientos; el usuario inactivo pierde acceso a todas las rutas protegidas en su siguiente petición. Cada alta, baja y reactivación queda en `AUDITORIA` con el ADMIN ejecutor, el usuario afectado y el estado anterior/posterior.

## Errores y alcance

Ante 429 (límite de solicitudes), evitar reintentos inmediatos. Si se reintenta una acción sensible tras un fallo temporal, conservar clave y cuerpo. Swagger/OpenAPI requieren `SWAGGER_ENABLED=true`; readiness comprueba presencia de tablas, no equivalencia de columnas o restricciones del modelo de otro equipo.

Formato de error: `{ "statusCode": 400, "message": "texto o array de validaciones", "timestamp": "ISO-8601" }`. Tratar 400 como validación, 401 como sesión inválida/vencida, 403 como falta de permiso, 404 como recurso ausente, 409 como conflicto y 503 como servicio no disponible. DELETE puede devolver 204 sin cuerpo. El backend rechaza campos ajenos al DTO.

Swagger publica los cuerpos y respuestas actuales. NOTIFICACIONES y CALIFICACIONES tienen tablas, pero sus endpoints, recuperación de contraseña y búsqueda global de ofertantes quedan fuera de esta entrega.

## Fase 3: ofertas con precio publicado y banner

Esta sección amplía el contrato anterior con publicación y consulta de ofertas. La tarifa de un crédito por cada 15 minutos se conserva para intercambios anteriores; una oferta tiene un precio total por clase independiente de la duración. Mientras no esté implementada la fase 4, su contratación se bloquea en el servidor para evitar cobrar otra tarifa. Publicar y consultar no exigen saldo suficiente ni crean movimientos de crédito.

Contrato contrastado con `origin/front_end_parcial_3`, commit `0e577a9771ae1e2d40878267506a20ce56b8247c`: `frontend/docs/ofertas-y-opiniones.md`, `frontend/src/services/tutoring.js` y los componentes de ofertas. El cliente actual solo envía `page` y `limit` al catálogo; filtra nombre de materia y categoría en `HomeView.vue`. No necesita filtros nuevos por carrera, ni un catálogo de pensum duplicado.

### Publicar y consultar

`POST /tutoring/offers` requiere una cuenta activa, Bearer e `Idempotency-Key`. La identidad del tutor procede de la sesión. Se comprueban habilidad activa, pertenencia a `USUARIO_HABILIDADES` y nivel coincidente. No enviar `id_usuario`, saldo ni un identificador de disponibilidad elegido por el solicitante.

```json
{
  "skillId": "UUID_HABILIDAD_PROPIA",
  "nivel": "Avanzado",
  "titulo": "Recursividad y ejercicios guiados",
  "descripcion": "Practicaremos recursividad y resolveremos dudas con ejercicios.",
  "costoCreditos": "3.7",
  "fechaInicio": "2026-11-25T14:00:00-04:00",
  "fechaFin": "2026-11-25T14:45:00-04:00"
}
```

Las fechas del ejemplo deben sustituirse por un intervalo futuro al ejecutar la demostración. Se conservan las reglas de disponibilidad: zona explícita, duración múltiplo de 15 minutos, fin posterior y máximo de 8 horas. Título de 1–100 caracteres y descripción de 1–1500, después de trim. Oferta y horario se crean atómicamente; la respuesta incluye `id_disponibilidad`, `fecha_inicio` y `fecha_fin` en la raíz. Una sola oferta `Activa` por tutor y materia, protegida en PostgreSQL. Reintentar la misma clave y cuerpo recupera el mismo resultado; cambiar el cuerpo con esa clave produce 409, también después de reiniciar.

`GET /tutoring/offers?page=1&limit=100` es público y devuelve `{ "data": [...], "meta": { "page": 1, "limit": 100, "total": 1, "totalPages": 1 } }`. Solo se muestran ofertas vigentes de cuentas activas. Cada fila incluye `id_oferta`, `id_usuario`, `id_habilidad`, `nivel`, título, descripción, `costo_creditos` como string decimal exacto, información pública de la materia y `tutor: { id, nombre, apellido }`. El banner opcional se entrega como `bannerUrl`; no se exponen correo, hashes ni saldo. El vínculo con disponibilidad debe usarse para resolver los slots de esa oferta, en lugar de mezclar todos los horarios del tutor.

Las métricas usan únicamente reservas de ese tutor **como ofertante** y de esa materia, `Completada` y con `fecha_fin` alcanzada. Las opiniones se obtienen de sus calificaciones donde el evaluador es el solicitante y el evaluado es ese tutor. Se excluyen otras materias, evaluaciones inversas y reservas incompletas o futuras. Sin opiniones se devuelve:

```json
{
  "metricas": {
    "promedio": null,
    "opiniones": 0,
    "tutorias_completadas": 0
  }
}
```

Los conteos son verificables y pueden ser cero; el promedio no se sustituye por cero. Esta fase solo lee los datos existentes, sin añadir endpoints de escritura de opiniones ni ranking.

### Política decimal provisional

Enviar `costoCreditos` como **string**: `"3.7"`, `"3.5"` o `"4"`; la respuesta conserva `costo_creditos: "3.7"`. Se admiten importes positivos enteros o con una décima. `"3.0"` se normaliza a `"3"`. Se rechazan cero, negativos, centésimas, notación exponencial y valores JSON numéricos. Mantener el precio como texto durante validación, transmisión y presentación; no usar `Number`, float ni conversión a entero para conservarlo.

La columna de oferta usa `NUMERIC` sin typmod y restricciones de positividad, escala máxima 1 y valor máximo `9999999999.9`. Esto evita que PostgreSQL redondee antes de validar la escala: `3.75` y `3.70` no se aceptan en SQL. El límite es técnico y provisional; no representa un máximo comercial aprobado por el PO. No se convierten los nueve campos históricos INTEGER de saldos, solicitudes, reservas y movimientos. La decisión de centésimas, máximo comercial y representación decimal del ledger sigue coordinándose con BD y PO para la fase 4.

### Banner e idempotencia

`POST /tutoring/banners` requiere cuenta activa, Bearer, multipart/form-data con campo `banner` e `Idempotency-Key`. Se admiten JPG, PNG y WebP de hasta `3 * 1024 * 1024` bytes; el servidor comprueba contenido real y tamaño. Dejar que el navegador escriba el boundary, sin forzar `Content-Type: application/json`. La respuesta tiene la forma que consume `frontend/src/services/tutoring.js`:

```json
{ "url": "http://127.0.0.1:4103/tutoring/banners/REFERENCIA_GENERADA" }
```

La URL ilustra el contrato; usar exactamente la referencia devuelta por la carga. El servidor verifica que pertenece al tutor autenticado antes de vincularla. Enviar esa URL como `bannerUrl` opcional en el POST de oferta. El archivo se conserva en almacenamiento local privado y sigue disponible tras reiniciar; la referencia no permite elegir rutas del sistema. Las cargas sin publicar quedan sujetas a la limpieza de huérfanos del backend. Una oferta sin `bannerUrl` es válida y utiliza la portada predeterminada del componente `OfferBanner.vue`.

El cliente conserva la clave del borrador para publicar y utiliza su sufijo `.banner` para la carga, como ya hace `tutoring.js`; reservar esos siete caracteres dentro del máximo de 128. Un reintento de la carga debe recuperar la misma referencia; reutilizar la clave con otro archivo es conflicto. Una publicación fallida no transforma el banner en una imagen pública de otra cuenta ni modifica el saldo. Pendientes vencidos se limpian al iniciar o cargar, tras 24 horas; reintentar esa referencia vencida devuelve 410 y requiere otra clave/carga. El GET del banner es público después de vincularlo y admite su uso desde el origen del frontend.

### Ajustes concretos pendientes en Frontend

- `frontend/src/features/offers/tutoring-model.js`, `tutorCreditCost` y `validateOfferContent`: sustituir la expresión de enteros, `Number(value)` y `Number.isSafeInteger` por validación y normalización textual de enteros/décimas; el retorno debe conservar el string. Ajustar el mensaje que exige créditos enteros y `offerCreditCost` para que `"3.7"` sea un precio conocido.
- `frontend/src/features/offers/OfferCreditSummary.vue`: adaptar `inputmode="numeric"`, `min="1"` y `step="1"` a la política decimal (`inputmode="decimal"`, mínimo `0.1`, paso `0.1`, o campo de texto con el mismo validador). Mantener el valor textual y revisar el singular/plural al recibir `"1"`.
- `frontend/src/features/offers/OfferDialog.vue`: `creditTotal` y `draft.costoCreditos` deben ser strings. Enviar el ejemplo de `"3.7"` sin convertirlo. Actualizar sus pruebas y los datos de demostración que esperan números enteros.
- `HomeView.vue` y `TutorOfferDialog.vue`: resolver únicamente el slot asociado a la oferta. La implementación actual filtra disponibilidades solo por tutor y recarga todos sus horarios al solicitar.
- `frontend/src/services/api.js` y `TutorOfferDialog.vue`: conservar `data.code` en `ApiError` y manejar el 409 con `code: "OFFER_PRICE_FLOW_PENDING"` como contratación pendiente de integración. Hoy todo 409 se muestra como horario ocupado. El backend rechaza estas solicitudes antes de crear solicitud, reserva, retención o movimiento; también protege la aceptación de solicitudes antiguas que intenten entrar por esa tarifa.
- Mantener `VITE_TUTORING_API_ENABLED=false` o sin definir. La bandera compartida habilita también reseñas y contratación, que no forman parte de esta fase. La prueba local de publicación y lectura se realiza desde Swagger sin activar esa integración conjunta.

La fase 4 deberá recibir/resolver `id_oferta`, validar su horario y copiar el precio publicado a la solicitud; reserva y movimientos deberán operar sobre esa copia pactada mediante la representación decimal acordada con BD. El solicitante no enviará un importe editable y los intercambios anteriores conservarán su precio acordado.

## Fase 4: solicitud a precio publicado y retención exacta

Este apéndice define el contrato actual de solicitud, aceptación y cancelación. Las secciones anteriores conservan el alcance de cada entrega. Los importes de solicitudes, reservas y movimientos ahora se entregan como **strings**, incluso cuando su valor es entero. La contratación de ofertas depende de que los nueve campos del ledger admitan decimales en el entorno elegido.

### Entorno habitual y ensayo decimal

| Entorno local                         | API y Swagger                    | Alcance de contratación                                                                                                                                                              |
| ------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Base habitual de demostración         | `http://127.0.0.1:4103`, `/docs` | Conserva los nueve campos INTEGER y sus datos anteriores. Solicitar o aceptar una oferta devuelve 409 `OFFER_PRICE_FLOW_PENDING`; los intercambios históricos siguen disponibles.    |
| Ensayo aislado `nexo_u_phase4_ensayo` | `http://127.0.0.1:4105`, `/docs` | Permite solicitar, aceptar y cancelar ofertas con precio decimal mediante un SQL provisional separado del historial oficial de migraciones. No constituye la entrega acordada de BD. |

Configurar `VITE_API_URL` según el entorno que se esté revisando y obtener una sesión de ese entorno. La habilitación de la base habitual requiere la migración decimal acordada con BD y su validación de actualización; cambiar una bandera de Frontend no sustituye esa condición. Mantener **`VITE_TUTORING_API_ENABLED=false`** mientras la bandera conjunta dependa también de doble confirmación, pago u otros frentes pendientes.

### Solicitar una oferta

Consultar `GET /tutoring/offers` y conservar `id_oferta`, `id_usuario` del tutor, `id_habilidad`, `id_disponibilidad`, `fecha_inicio` y `fecha_fin` de la misma fila. El estudiante solicitante debe tener cuenta activa y ser distinto del tutor. Enviar Bearer del estudiante y una `Idempotency-Key` nueva a `POST /exchanges`:

```json
{
  "providerId": "UUID_DEL_TUTOR_DE_LA_OFERTA",
  "skillId": "UUID_DE_LA_MATERIA_DE_LA_OFERTA",
  "availabilityId": "UUID_DEL_HORARIO_DE_LA_OFERTA",
  "offerId": "UUID_DE_LA_OFERTA",
  "fechaInicio": "2030-01-15T14:00:00-04:00",
  "fechaFin": "2030-01-15T14:45:00-04:00",
  "descripcion": "Quiero practicar con esta clase de 45 minutos."
}
```

Sustituir los UUID y las fechas del ejemplo por los de una oferta futura real. Para una oferta las fechas deben coincidir con **la clase completa de su horario específico**, sin combinar disponibilidades de otras ofertas del tutor. `offerId` es opcional: el servidor resuelve la oferta desde `availabilityId`; si se envía, comprueba su correspondencia. `descripcion` también es opcional, hasta 500 caracteres después de trim. Los demás campos del ejemplo son obligatorios. No enviar `amount`, `costoCreditos` ni `creditos_requeridos`: el DTO rechaza esos campos.

El servidor comprueba oferta vigente, tutor, materia, habilidad publicada, nivel, horario futuro y cuentas habilitadas. Copia el precio de `OFERTAS` a la solicitud. Para un precio publicado de `"3.7"`, la respuesta 201 incluye estos campos:

```json
{
  "id_solicitud": "UUID_GENERADO",
  "id_oferta": "UUID_DE_LA_OFERTA",
  "id_disponibilidad": "UUID_DEL_HORARIO_DE_LA_OFERTA",
  "estado": "Solicitada",
  "creditos_requeridos": "3.7",
  "costo_creditos": "3.7"
}
```

Este fragmento muestra los campos relevantes; la respuesta también incluye participantes, fechas y descripción. Solicitar no retiene créditos, no crea una reserva y no ocupa definitivamente el horario. Si posteriormente cambia el precio publicado, la solicitud conserva su copia pactada. Si el horario pertenece a una oferta que dejó de estar disponible, la operación devuelve conflicto; no pasa al cálculo por duración.

Los horarios anteriores **sin oferta** siguen admitiendo un intervalo contenido en su disponibilidad y la regla histórica de un crédito por cada 15 minutos. Una clase histórica de 45 minutos cuesta `"3"`; una oferta de esa duración puede costar `"3.7"`. Las solicitudes históricas exponen `id_oferta: null`.

### Aceptar, rechazar y cancelar

El tutor destinatario inicia sesión y envía `POST /exchanges/UUID_SOLICITUD/accept`, cuerpo `{}`, Bearer propio y otra `Idempotency-Key`. Solo él puede aceptar; el estudiante solicitante no dispone de ese permiso. La respuesta 200 es la reserva con `estado: "Confirmada"`, `id_solicitud`, `id_oferta`, `id_reserva`, `creditos: "3.7"` y `monto_creditos: "3.7"`.

La aceptación vuelve a comprobar estado, horario, participantes y saldo disponible. Confirma conjuntamente solicitud, horario ocupado, una reserva, retención y su movimiento. También comprueba conflictos de ambos participantes aunque actúen con otro rol en otra reserva. Ante saldo insuficiente, conflicto o fallo de escritura no queda una retención parcial. El catálogo deja de mostrar ese horario ocupado. El tutor todavía no recibe ningún pago.

Con saldo inicial `"10"`, estos son los valores esperados en `GET /credits/me`. Los movimientos de la tabla cuentan únicamente los añadidos desde el inicio del escenario:

| Paso                      | Saldo total | Retenido | Disponible | Movimientos nuevos            |
| ------------------------- | ----------- | -------- | ---------- | ----------------------------- |
| Antes de solicitar        | `"10"`      | `"0"`    | `"10"`     | 0                             |
| Solicitud `Solicitada`    | `"10"`      | `"0"`    | `"10"`     | 0                             |
| Aceptación `Confirmada`   | `"10"`      | `"3.7"`  | `"6.3"`    | 1 `Retencion`                 |
| Reintento de aceptación   | `"10"`      | `"3.7"`  | `"6.3"`    | Sigue habiendo 1              |
| Cancelación de la reserva | `"10"`      | `"0"`    | `"10"`     | 2: `Retencion` y `Liberacion` |

`GET /credits/me/movements` muestra la retención con `cantidad: "3.7"`, `saldo_anterior: "10"`, `saldo_posterior: "10"`, `retenidos_anterior: "0"` y `retenidos_posterior: "3.7"`. La liberación conserva el saldo total y cambia los retenidos de `"3.7"` a `"0"`; no crea una transferencia al tutor.

Para rechazar una solicitud pendiente, el tutor usa `POST /exchanges/UUID_SOLICITUD/reject`, cuerpo `{}` y su propia clave de acción. Devuelve la solicitud `Rechazada` y deja intactos saldo, retenido y movimientos. Para cancelar una reserva confirmada, un participante usa `POST /reservations/UUID_RESERVA/cancel` con una clave de cancelación nueva y:

```json
{ "motivo": "No podré asistir a la tutoría." }
```

Antes del inicio la cancelación libera exactamente el precio reservado. Después del inicio requiere ADMIN; una reserva completada no puede cancelarse. La respuesta 200 conserva `creditos: "3.7"` y pasa a `Cancelada`. El horario propio de la oferta se libera cuando corresponde. No editarlo directamente: se mantiene 409 `OFFER_AVAILABILITY_MANAGED` para modificaciones independientes.

### Decimales, errores y reintentos en Frontend

Conservar como texto todos los importes: `saldo`, `creditos_retenidos`, `disponibles`, `creditos_requeridos`, `costo_creditos`, `creditos`, `monto_creditos`, `cantidad`, `monto` y los cuatro snapshots del movimiento. `cantidad` y `monto` pueden tener signo; los contadores de elementos siguen siendo números. No usar `Number`, `parseInt` ni aritmética binaria para calcular el importe que se envía o conciliar saldos; presentar los importes y el disponible devueltos por el servidor. Se mantiene la política provisional de enteros/décimas. El ledger conserva su cota técnica anterior de `2147483647` por importe; no se amplía por el máximo de publicación de ofertas.

La cuenta indica `unidad: "CREDITO"` en el esquema decimal y `unidad: "CREDITO_15_MINUTOS"` en el esquema entero histórico. En el esquema decimal, la duración no determina el precio de una oferta.

Conservar `data.code` al construir `ApiError`; un 409 puede necesitar una explicación distinta de «horario ocupado»:

| Código 409                   | Significado y tratamiento                                                                                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OFFER_PRICE_FLOW_PENDING`   | El esquema del entorno conserva créditos enteros. Informar que la contratación de ofertas requiere la migración decimal; no reintentar con una tarifa calculada por duración. |
| `OFFER_MISMATCH`             | El identificador de oferta o las fechas no coinciden con el tutor, materia y horario seleccionados. Recargar la oferta y reconstruir la selección.                            |
| `OFFER_NOT_AVAILABLE`        | La oferta o su horario ya no cumplen las condiciones de contratación. Actualizar el catálogo y permitir otra selección.                                                       |
| `OFFER_SNAPSHOT_REQUIRED`    | Una solicitud anterior no tiene el vínculo y precio pactado necesarios para aceptar mediante una oferta. No completarlo con un importe elegido por el cliente.                |
| `OFFER_AVAILABILITY_MANAGED` | El horario pertenece a una oferta y no se modifica por separado.                                                                                                              |
| `DECIMAL_SETTLEMENT_PENDING` | La confirmación y liquidación de reservas vinculadas a ofertas o con importe fraccionario están protegidas hasta la fase 5. No emitir un pago alternativo.                    |

Otros conflictos, como saldo insuficiente, solicitud resuelta, superposición o reutilización incompatible de una clave, conservan el mensaje del servidor. Mantener el manejo general de 400, 401, 403 y 404 descrito antes. Una misma acción reintentada conserva **la misma clave y el mismo cuerpo**, también después de reiniciar; crear, aceptar, rechazar y cancelar son acciones distintas con claves distintas. Agregar o quitar `offerId` durante un reintento cambia el cuerpo: conservar exactamente la petición original.

La fase 4 no habilita `POST /reservations/:id/confirm` para reservas de oferta, incluso si el precio publicado es entero, ni para reservas fraccionarias. Devuelve `DECIMAL_SETTLEMENT_PENDING` antes de guardar confirmaciones, consumir saldo o pagar al tutor. La fase 5 debe habilitar doble confirmación y pago exacto sobre el precio reservado, con sus garantías transaccionales e idempotencia. El recorrido histórico entero conserva su comportamiento anterior.

## Fase 5: doble confirmación y pago exacto

Este apartado actualiza la confirmación del ensayo decimal. La demo habitual en `http://127.0.0.1:4103` conserva nueve INTEGER, su flujo histórico y el bloqueo para contratar ofertas. En `http://127.0.0.1:4105` el esquema decimal provisional permite liquidar reservas de oferta. La entrega acordada de BD sigue pendiente; el ensayo permanece fuera de las migraciones oficiales. Mantener `VITE_TUTORING_API_ENABLED=false`: completar este recorrido no habilita automáticamente los otros frentes de esa bandera conjunta.

Cada participante envía `POST /reservations/{id_reserva}/confirm` con su propio `Authorization: Bearer <access_token>`, `Content-Type: application/json`, una `Idempotency-Key` de 16–128 caracteres y cuerpo `{}`. El servidor toma la identidad de la sesión: el cuerpo no recibe usuario ni importe. Un ADMIN ajeno tampoco puede confirmar. La clase debe haber terminado; un intento anticipado devuelve 409 sin cambiar marcas, estado, cuentas ni movimientos.

La primera confirmación devuelve 200 con `estado: "Confirmada"`, una sola marca no nula y una entrada en `confirmaciones`; mantiene la retención y no paga. Repetir esa persona, incluso con otra clave, conserva su marca y no sustituye a la contraparte. Cualquiera de los dos puede confirmar primero. La segunda confirmación válida devuelve 200 con `estado: "Completada"`, ambas marcas, `completed_at` y dos entradas en `confirmaciones`.

El importe de liquidación procede exclusivamente de `RESERVAS.creditos`. Cambiar el catálogo después de reservar no altera el pacto. Para una reserva de `"3.7"`, saldo de entrada del estudiante `"10"` y tutor `"0"`:

| Etapa                        | Saldo estudiante | Retenido | Disponible | Saldo tutor | Movimientos ligados a la reserva                                    |
| ---------------------------- | ---------------- | -------- | ---------- | ----------- | ------------------------------------------------------------------- |
| Aceptada, antes de confirmar | `"10"`           | `"3.7"`  | `"6.3"`    | `"0"`       | Una `Retencion` de `"3.7"`                                          |
| Primera confirmación         | `"10"`           | `"3.7"`  | `"6.3"`    | `"0"`       | Sigue uno                                                           |
| Segunda confirmación         | `"6.3"`          | `"0"`    | `"6.3"`    | `"3.7"`     | Tres: retención, `Consumo` de `"-3.7"` y `Transferencia` de `"3.7"` |
| Reintento final              | `"6.3"`          | `"0"`    | `"6.3"`    | `"3.7"`     | Los mismos tres UUID                                                |

Se preservan otras retenciones del estudiante y las operaciones propias del tutor. Si el tutor ya tenía saldo, se suma únicamente el importe reservado. La segunda marca, finalización, saldos, ledger e idempotencia se confirman conjuntamente. Si falla una escritura o se excede la capacidad del tutor, el intento se revierte y se conserva la primera marca ya comprometida. Corregida la causa, la segunda persona puede reintentar.

Una misma acción reintentada conserva su clave y cuerpo. La misma clave de confirmación con otro `id_reserva` devuelve 409; las claves están acotadas por actor y operación según el contrato existente. Una clave distinta sobre una reserva ya completada recupera el estado completado sin nuevo pago. La misma clave devuelve el resultado guardado de aquella llamada: si correspondía a la primera confirmación, puede seguir mostrando aquel resultado `Confirmada`; consultar `GET /reservations/{id_reserva}` para el estado actual.

Los conflictos por clase no terminada, reserva cancelada, retención inconsistente o capacidad del destinatario devuelven 409 con su mensaje. La capacidad INTEGER mantiene `DECIMAL_SETTLEMENT_PENDING` para reservas de oferta o fraccionarias. La liquidación decimal ya soportada no devuelve ese código. Se conservan 400 para DTO/cabeceras, 401 para sesión no válida y 403 para una cuenta ajena a la reserva.

La cancelación después del inicio requiere ADMIN. Si su transacción gana frente a la segunda confirmación, queda `Cancelada`, una `Liberacion` y cero pagos. Si gana la liquidación, queda `Completada`, un consumo y una transferencia, sin liberación. Frontend debe recargar la reserva tras un conflicto y mostrar su estado definitivo.

Consultar `GET /reservations/{id_reserva}` y `/reservations/me` para estado y marcas. Cada participante ve su cuenta y sus movimientos en `/credits/me` y `/credits/me/movements`; los movimientos incluyen `id_reserva`, importe y snapshots exactos como strings. ADMIN puede contrastar `/exchanges/integrity` y `/analytics/credits?from=<ISO>&to=<ISO>`; el período de Analytics es `[from,to)` y contabiliza una sola transferencia. Los IDs y los pasos de la demostración local están en el [reporte de fase 5](fase5-confirmacion-liquidacion.md).
