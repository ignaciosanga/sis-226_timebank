# Integración del frontend

El frontend consume la API HTTP de NestJS. No necesita credenciales ni una conexión directa a PostgreSQL. Swagger y `/docs-json` son el contrato actual; los documentos v0.2/v0.3 son históricos.

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

En Vite, definir `VITE_API_URL=http://localhost:4000`. El backend permite por defecto los orígenes `http://localhost:3000` y `http://localhost:5173`. Para otro origen, editar `CORS_ORIGINS` en `.env`, separado por comas y sin barra final, y recrear con `docker compose up -d backend`. Enviar JWT por cabecera; no se usan cookies. Compose publica puertos solo en la máquina local: cada compañero puede levantar su copia.

## Registro y sesión

1. Consultar `GET /careers` y usar un UUID de carrera activa.
2. Registrar con `POST /auth/register` (201):

```json
{
  "nombre": "Ana",
  "apellido": "Perez",
  "correo": "ana@example.test",
  "password": "una-clave-local-larga",
  "idCarrera": "30000000-0000-4000-8000-000000000001",
  "semestre": 3
}
```

La contraseña debe tener 12–128 caracteres; semestre es un número entero entre 1 y 12. El registro devuelve el perfil y crea un Estudiante con saldo cero. No inicia sesión automáticamente.

3. Autenticar con `POST /auth/login` (200), cuerpo `{"correo":"ana@example.test","password":"una-clave-local-larga"}`.
4. La respuesta contiene `access_token`, `token_type: "Bearer"` y `user`. Enviar `Authorization: Bearer <access_token>` en rutas privadas. El token vence por defecto a los 900 segundos; ante 401 solicitar login. No hay refresh ni logout de servidor.
5. Consultar `GET /users/me` y actualizar con `PATCH /users/me`, usando los campos publicados en Swagger.

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
docker compose exec backend node scripts/create-dev-admin.cjs admin@example.test
```

Guardar la contraseña aleatoria impresa por el comando y autenticar con `/auth/login`. No modifica usuarios existentes; no usar el comando de administrador en memoria para PostgreSQL. El registro público no acepta asignación de roles.

ADMIN puede cargar saldo mediante `POST /credits/grants`, con JWT e `Idempotency-Key`, cuerpo `{ "userId": "UUID-del-solicitante", "amount": "8", "reason": "Desarrollo frontend" }`. Esta carga es exclusiva de desarrollo/pruebas. `GET /exchanges/integrity` permite a ADMIN consultar coherencia del estado.

## Gestión administrativa de usuarios (ADMIN)

Rutas bajo `/admin/users`, con `Authorization: Bearer <token>` de un usuario `Administrador`; otro rol recibe 403 y un usuario inactivo 401.

- `GET /admin/users?search=ana&estado=Activo&rol=Estudiante&idCarrera=<uuid>&page=1&limit=20`: respuesta `{ data: AdminUser[], meta }`. `AdminUser` = perfil público más `estado` (`Activo`, `Inactivo`, `Suspendido`), `fechaRegistro` y `ultimoAcceso`; nunca saldos ni hashes. Todos los filtros son opcionales.
- `POST /admin/users`: mismo cuerpo que `/auth/register` (`nombre`, `apellido`, `correo`, `password` ≥ 12, `idCarrera`, `semestre` 1–12). Crea siempre un Estudiante activo con la política de créditos vigente; no admite `rol`. 201 con `PublicUser`; 409 si el correo existe.
- `PATCH /admin/users/:id/status` con `{ "estado": "Inactivo", "motivo": "opcional" }` (baja lógica) o `{ "estado": "Activo" }` (reactivación). 200 con `AdminUser`; 404 si no existe; 409 si el estado ya es el solicitado, si el ADMIN intenta desactivarse, si es el último ADMIN activo, si el usuario tiene reservas confirmadas o créditos retenidos, o si se intenta reactivar un `Suspendido`.

La baja no borra datos ni modifica saldos, reservas ni movimientos; el usuario inactivo pierde acceso a todas las rutas protegidas en su siguiente petición. Cada alta, baja y reactivación queda en `AUDITORIA` con el ADMIN ejecutor, el usuario afectado y el estado anterior/posterior.

## Errores y alcance

Ante 429 (límite de solicitudes), evitar reintentos inmediatos. Si se reintenta una acción sensible tras un fallo temporal, conservar clave y cuerpo. Swagger/OpenAPI requieren `SWAGGER_ENABLED=true`; readiness comprueba presencia de tablas, no equivalencia de columnas o restricciones del modelo de otro equipo.

Formato de error: `{ "statusCode": 400, "message": "texto o array de validaciones", "timestamp": "ISO-8601" }`. Tratar 400 como validación, 401 como sesión inválida/vencida, 403 como falta de permiso, 404 como recurso ausente, 409 como conflicto y 503 como servicio no disponible. DELETE puede devolver 204 sin cuerpo. El backend rechaza campos ajenos al DTO.

Swagger publica los cuerpos y respuestas actuales. NOTIFICACIONES y CALIFICACIONES tienen tablas, pero sus endpoints, recuperación de contraseña y búsqueda global de ofertantes quedan fuera de esta entrega.
