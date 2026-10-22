# Contrato API v0.3.0

Implementación local con memoria. Swagger UI: `/docs`; OpenAPI: `/docs-json`. No hay prefijo global. Los contratos nuevos de reservas y créditos usan reglas provisionales autorizadas para el adaptador; no describen un esquema SQL confirmado.

## Autenticación y perfil

- `POST /auth/register` → 201: `{ nombre, apellido, correo, password, idCarrera, semestre }`. Crea perfil y rol ESTUDIANTE, sin cuenta de créditos. Correo único normalizado; password 12–128 caracteres; semestre entero >=1. Nombre/apellido: 1–100 caracteres tras recortar espacios; idCarrera conserva el identificador opaco anterior de hasta 128 caracteres hasta recibir el catálogo oficial.
- `POST /auth/login` → 200: `{ correo, password }`. Devuelve `{ access_token, token_type: "Bearer", user }`.
- `GET /users/me` → 200: perfil propio con JWT activo.
- `PATCH /users/me` → 200: admite exclusivamente nombre, apellido, idCarrera, semestre; conserva las validaciones del registro y rechaza null.

Perfil: `{ id, nombre, apellido, correo, idCarrera, semestre, roles }`. Ninguna respuesta contiene contraseña o hash. JWT HS256 con `sub`, `iat`, `exp`, `iss`, `aud`; el estado y los roles se vuelven a consultar en cada petición protegida. No hay refresh tokens, logout remoto ni administración de roles por HTTP.

El registro mantiene la creación de perfil sin cuenta. Las cuentas locales comienzan en `0.00` y se crean al consultarlas, recibir una carga o aceptar un intercambio. Si falla la firma del JWT, no se escribe `ultimo_acceso`; la comprobación de usuario activo se conserva después de firmar.

## Catálogos

| Método | Ruta              | Contrato                                        |
| ------ | ----------------- | ----------------------------------------------- |
| GET    | `/categories`     | Público, categorías activas                     |
| GET    | `/categories/:id` | Público, categoría activa por UUID              |
| POST   | `/categories`     | ADMIN; `{ nombre }`, 201                        |
| GET    | `/skills`         | Público, habilidades activas                    |
| GET    | `/skills/:id`     | Público, habilidad y categoría activas por UUID |
| POST   | `/skills`         | ADMIN; `{ nombre, categoryId }`, 201            |

`nombre`: string no vacío, hasta 100 caracteres, Unicode NFKC, espacios recortados/colapsados. Unicidad sin distinguir mayúsculas, conservando acentos. Las habilidades son únicas globalmente; no se repiten en otra categoría. Una categoría inexistente/inactiva impide crear o seleccionar una habilidad (404).

Listados: `page` predeterminado 1, `limit` predeterminado 20 (1–100), `search` opcional (hasta 100 caracteres). Habilidades permite además `categoryId` UUID. Se combinan filtros. Un filtro válido sin coincidencias devuelve página vacía, incluso si el UUID de categoría no existe. Campos desconocidos o valores inválidos reciben 400.

Respuesta: `{ data: [...], meta: { page, limit, total, totalPages } }`. Página fuera del rango: `data: []`; si total=0, totalPages=0. Este sobre permite extender filtros sin reemplazar el contrato público. El orden de memoria es el orden de inserción; la implementación PostgreSQL deberá definir un orden estable equivalente.

Categoría: `{ id_categoria, nombre, estado }`. Habilidad: `{ id_habilidad, nombre, id_categoria, estado }`.

## Habilidades de estudiantes

Todas las rutas requieren JWT de usuario activo. Las rutas propias exigen ESTUDIANTE.

- `GET /users/me/skills` → 200: array propio.
- `POST /users/me/skills` → 201: `{ skillId: UUID, nivel: "BASICO" | "INTERMEDIO" | "AVANZADO" }`.
- `DELETE /users/me/skills/:skillId` → 204 sin cuerpo: quita exclusivamente la relación propia; si no existe en el perfil propio, 404.
- `GET /users/:id/skills` → 200: array publicado de otro estudiante activo; usuario inexistente, suspendido o sin rol ESTUDIANTE recibe 404.

Creación: `{ id_usuario, id_habilidad, nivel }`. Lecturas: array de esos registros más `habilidad: { id_habilidad, nombre, id_categoria, estado }`. No se duplican los datos del catálogo en el almacenamiento de relaciones. Las habilidades desactivadas o de categoría inactiva se omiten de la publicación. Eliminar la relación no borra la habilidad global y permite volver a registrarla.

Las publicaciones comparten el almacén transaccional con las reservas. Quitar una oferta no cancela reservas aceptadas; una aceptación nueva vuelve a comprobar atómicamente que el ofertante publica esa habilidad.

La combinación `id_usuario + id_habilidad` es única; duplicado → 409. Habilidad inexistente/inactiva → 404. `id_usuario`, `userId`, `estado`, roles y otros campos no forman parte del DTO y reciben 400. No existe ruta para publicar, editar ni quitar habilidades en nombre de otro usuario.

## Disponibilidad

Las rutas propias requieren JWT ESTUDIANTE. Consultar otro estudiante requiere JWT activo.

| Método | Ruta                      | Cuerpo / resultado                                         |
| ------ | ------------------------- | ---------------------------------------------------------- |
| POST   | `/availability`           | `{ fechaInicio, fechaFin }`, 201                           |
| GET    | `/availability/me`        | Array de intervalos propios activos, ordenados por inicio  |
| GET    | `/users/:id/availability` | Array de intervalos activos de estudiante activo           |
| PATCH  | `/availability/:id`       | `{ fechaInicio?, fechaFin? }`, al menos un campo; 200      |
| DELETE | `/availability/:id`       | Desactiva; 204 sin cuerpo, idempotente para el propietario |

Registro: `{ id_disponibilidad, id_usuario, fecha_inicio, fecha_fin, estado }`. Las fechas devueltas son timestamps UTC terminados en `Z`.

Entrada ISO 8601 con fecha completa, `T`, hora y minutos, segundos opcionales y hasta tres decimales si hay segundos; zona explícita `Z` o `±HH:mm` hasta ±14:00. Se rechazan fechas imposibles, fechas sin hora, horas 24:00, segundos 60 y zonas implícitas. Ejemplo: `2026-11-02T09:00:00-04:00`.

Fin estrictamente posterior al inicio. Intervalos activos `[inicio, fin)` del mismo usuario no pueden duplicarse ni superponerse, incluso si usan zonas distintas para representar el mismo instante. Se permite continuidad de extremos y coincidencia entre usuarios diferentes. PATCH combina los campos con la versión vigente y valida dentro de la misma transacción; dos cambios parciales compatibles conservan ambos campos. No se permite editar un registro inactivo (409). DELETE cambia estado a INACTIVO, no elimina el registro.

Recurso inexistente → 404; intento de editar/desactivar recurso ajeno → 403. El propietario procede del JWT, nunca del body. Estudiante consultado inexistente/inactivo → 404.

La disponibilidad publicada admite fechas pasadas y no impone los límites de duración de las reservas. Una edición se permite si mantiene cubiertas sus reservas `CONFIRMADA`; recortar el intervalo dejando una reserva fuera o desactivarlo mientras respalde una reserva activa recibe 409. Las operaciones comparten la transacción de memoria con las aceptaciones, por lo que una aceptación concurrente no puede perder su cobertura.

## Idempotencia de solicitudes, reservas y cargas

Todos los POST descritos en las tres secciones siguientes requieren JWT y el header `Idempotency-Key`, de 16 a 128 caracteres: letras ASCII, números, `.`, `_`, `:` o `-`. Una clave UUID es válida. La clave no sustituye la autorización del JWT.

- La clave se identifica por actor y operación. El mismo contenido devuelve el resultado confirmado original, sin repetir efectos, incluso con solicitudes simultáneas.
- La misma clave con contenido diferente recibe 409. Las fechas de creación de solicitudes se normalizan a UTC para comparar su contenido.
- Una excepción antes del commit descarta también el resultado de idempotencia; puede reintentarse con la misma clave cuando corresponda. No hay un registro de «procesando» confirmado que quede retenido tras ese fallo.
- Si se confirmó la operación y se perdió la respuesta, repetir la misma petición recupera el resultado original. Para conocer cambios posteriores, consultar la reserva o la cuenta actual.
- Repetir una aceptación, confirmación o cancelación con claves distintas tampoco duplica reserva, retención, transferencia o liberación.

Los registros y las claves se pierden al reiniciar. No existe coordinación entre procesos, recuperación duradera ni garantía de idempotencia en PostgreSQL.

## Solicitudes de intercambio

Requieren ESTUDIANTE activo; los listados incluyen solamente solicitudes en las que participa el actor.

| Método | Ruta                    | Cuerpo / resultado                                                                  |
| ------ | ----------------------- | ----------------------------------------------------------------------------------- |
| POST   | `/exchanges`            | `{ providerId, skillId, availabilityId, fechaInicio, fechaFin, descripcion? }`; 201 |
| GET    | `/exchanges/me`         | Array de solicitudes propias; 200                                                   |
| POST   | `/exchanges/:id/accept` | Sin cuerpo; solo ofertante; devuelve reserva; 200                                   |
| POST   | `/exchanges/:id/reject` | Sin cuerpo; solo ofertante; devuelve solicitud; 200                                 |
| POST   | `/exchanges/:id/cancel` | Sin cuerpo; solo solicitante; devuelve solicitud; 200                               |

Los tres identificadores del cuerpo son UUID. `descripcion` es opcional, hasta 500 caracteres, con espacios exteriores recortados. El solicitante procede del JWT; debe ser distinto del ofertante. Ambos deben ser estudiantes activos y la habilidad/categoría debe estar activa y publicada por el ofertante.

Se exige un inicio futuro y un intervalo cubierto por la disponibilidad activa indicada, con duración múltiplo de 15 minutos entre 15 minutos y 8 horas. Se utiliza la misma validación ISO 8601 con zona explícita que en disponibilidad. Precio provisional: una hora = `1.00` crédito; 15 minutos = `0.25`.

Solicitud pública: `{ id_solicitud, id_solicitante, id_ofertante, id_habilidad, id_disponibilidad, fecha_inicio, fecha_fin, descripcion, estado, fecha_creacion, costo_creditos }`. Los importes son strings decimales; fechas UTC.

Estados de solicitud: `PENDIENTE` → `ACEPTADA`, `RECHAZADA` o `CANCELADA`. Crear una solicitud no retiene saldo ni bloquea horarios. Rechazar/cancelar exige que siga pendiente; cancelar una solicitud ya aceptada requiere el endpoint de su reserva.

La aceptación comprueba nuevamente participantes, habilidad publicada, fechas futuras y disponibilidad vigente dentro de la operación. Crea como máximo una reserva por solicitud, crea las cuentas faltantes con saldo cero, retiene los créditos del solicitante y marca la solicitud `ACEPTADA`. Saldo insuficiente o reserva superpuesta de cualquiera de los participantes → 409 sin escrituras parciales. Repetir la aceptación devuelve la reserva ya asociada, incluso si después fue cancelada; no la reactiva.

## Reservas, confirmaciones y cancelaciones

Las rutas requieren ESTUDIANTE o ADMIN. Consultar o confirmar sigue restringido a los participantes; ADMIN ajeno puede cancelar conforme a la política indicada, sin adquirir acceso general a todas las reservas.

| Método | Ruta                        | Cuerpo / resultado                             |
| ------ | --------------------------- | ---------------------------------------------- |
| GET    | `/reservations/me`          | Array de reservas del actor; 200               |
| GET    | `/reservations/:id`         | Detalle de reserva propia; 200                 |
| POST   | `/reservations/:id/confirm` | Sin cuerpo; confirmación del participante; 200 |
| POST   | `/reservations/:id/cancel`  | `{ motivo }`; cancelación autorizada; 200      |

Reserva pública: `{ id_reserva, id_solicitud, id_solicitante, id_ofertante, id_habilidad, id_disponibilidad, fecha_inicio, fecha_fin, estado, fecha_creacion, monto_creditos, confirmaciones, cancelacion }`.

Estados: `CONFIRMADA` → `COMPLETADA` o `CANCELADA`. `CONFIRMADA` significa solicitud aceptada y saldo retenido; las confirmaciones posteriores de los participantes registran que el intercambio terminó.

- Al aceptar se impide cualquier solapamiento `[inicio, fin)` entre reservas activas de ambos participantes, incluyendo el cruce de rol solicitante/ofertante. Los extremos contiguos son válidos.
- Solo se puede confirmar a partir de la fecha de fin. Ambos participantes deben continuar activos para una confirmación nueva. Cada participante tiene como máximo una confirmación.
- La segunda confirmación válida descuenta el saldo y la retención del solicitante, acredita al ofertante, registra débito/abono y una única transferencia, y marca `COMPLETADA`, todo junto. La primera confirmación mantiene el saldo retenido.
- Un participante puede cancelar estrictamente antes del inicio. ADMIN puede cancelar mientras la reserva no esté completada, incluso después del inicio. `motivo` es obligatorio, string no vacío tras recortar espacios, hasta 500 caracteres.
- Cancelar libera la retención una sola vez y registra motivo, actor y fecha. Una cancelación de ADMIN ajeno queda marcada `administrativa: true`. Se conserva la solicitud `ACEPTADA` como historial de aceptación; cambia el estado de la reserva.
- Cancelar una reserva completada o confirmar una cancelada recibe 409. Los estados finales permanecen cerrados, se conserva el historial y no hay liquidación automática por el paso del tiempo.

Confirmación: `{ id_confirmacion, id_reserva, id_usuario, fecha }`. Cancelación: `{ id_cancelacion, id_reserva, id_usuario, motivo, fecha, administrativa }`; `cancelacion` es `null` cuando no existe.

## Créditos de tiempo y auditoría

| Método | Ruta                    | Acceso / resultado                            |
| ------ | ----------------------- | --------------------------------------------- |
| GET    | `/credits/me`           | ESTUDIANTE; cuenta propia; 200                |
| GET    | `/credits/me/movements` | ESTUDIANTE; array de movimientos propios; 200 |
| POST   | `/credits/grants`       | ADMIN; `{ userId, amount, reason }`; 201      |
| GET    | `/exchanges/integrity`  | ADMIN; auditoría de solo lectura; 200         |

Cuenta: `{ id_cuenta, id_usuario, saldo, creditos_retenidos, disponibles, unidad: "CREDITO_HORA" }`. La consulta crea una cuenta cero si no existía. `disponibles = saldo - creditos_retenidos`; los tres valores son no negativos y la retención nunca supera el saldo. No hay pagos monetarios, compra de créditos, saldo de bienvenida ni débito directo desde el cliente.

Cargas: solo desarrollo/pruebas y ADMIN activo; en producción se rechazan. `userId` es UUID de estudiante activo, `amount` es un string decimal positivo de hasta dos cifras decimales y hasta 16 caracteres, `reason` es obligatorio y de hasta 500 caracteres tras recortar espacios. Se conserva el motivo en el movimiento. El importe y el saldo final no pueden exceder `10000000000.00` créditos. Devuelve `{ cuenta, movimiento }`; repetir la misma clave no incrementa otra vez el saldo. Una carga administrativa nueva usa otra clave.

Movimiento: `{ id_movimiento, id_cuenta, id_reserva, tipo, monto, fecha, descripcion? }`; `id_reserva` es `null` en una carga. Tipos: `CARGA_DESARROLLO`, `RETENCION`, `LIBERACION`, `DEBITO`, `ABONO`. Las respuestas usan strings decimales exactos; internamente se almacenan centavos con `bigint`, sin redondeo en coma flotante.

Auditoría: `{ status: "ok" | "inconsistente", scope: "memory-process", issues: [{ code, ids }], counts: { solicitudes, reservas, transferencias, cuentas } }`. Detecta solapamientos por participante en cualquier rol, reservas/transferencias/movimientos duplicados, incoherencia de saldos y retenciones, y relaciones de negocio incompletas. No modifica datos, cancela reservas ni consulta una BD externa.

Una transacción fallida antes del commit descarta reserva, cuentas, movimientos, confirmaciones, cancelaciones e idempotencia juntos. Un timeout o una respuesta perdida después del commit no cancela una reserva válida; se recupera el resultado con la misma clave. El filtro HTTP informa el error y no sustituye la transacción.

## Adaptadores y compatibilidad

| Campo DTO / aplicación | Campo oficial almacenado |
| ---------------------- | ------------------------ |
| `categoryId`           | `id_categoria`           |
| `skillId`              | `id_habilidad`           |
| Principal JWT `id`     | `id_usuario`             |
| `fechaInicio`          | `fecha_inicio`           |
| `fechaFin`             | `fecha_fin`              |
| Usuario `idCarrera`    | `id_carrera`             |
| Usuario `passwordHash` | `password_hash`          |
| Usuario `active`       | `estado === ACTIVO`      |

USUARIOS almacena también `fecha_registro` y `ultimo_acceso`; no se exponen en el perfil previo. Roles se guardan fuera de USUARIOS. Estados ACTIVO/INACTIVO y niveles BASICO/INTERMEDIO/AVANZADO son enums internos provisionales a validar con PO/BD. No se infieren modelos Prisma del inventario resumido.

El inventario y los campos oficiales conocidos de v0.2 se conservan. Los nuevos tipos, estados, centavos, claves de idempotencia y precio son decisiones del adaptador provisional autorizado por el usuario; no certifican nombres, columnas, restricciones ni políticas SQL. `prisma/schema.prisma` permanece intacto. Queda pendiente integrar el esquema oficial y verificar estas garantías con persistencia compartida.

## Errores y seguridad comunes

```json
{
  "statusCode": 400,
  "message": ["validación de entrada"],
  "timestamp": "2026-10-22T16:00:00.000Z"
}
```

`message` puede ser string o array. 400 validación/clave de idempotencia inválida, 401 credenciales/JWT/sujeto inactivo, 403 rol/propiedad/participación, 404 ausencia de recurso publicable, 409 unicidad/solapamiento/estado/saldo insuficiente/reutilización incompatible de clave, 429 rate limiting. Los errores 5xx no exponen detalles internos. DTO rechaza campos adicionales y null donde no esté admitido. Los números del body no se convierten implícitamente; page/limit aceptan enteros decimales en query.

CORS admite GET, POST, PATCH, DELETE y OPTIONS. Solo los orígenes configurados reciben autorización CORS. Helmet y límites anteriores continúan activos; throttling y datos son por proceso.
