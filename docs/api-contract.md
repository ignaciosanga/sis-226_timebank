# Contrato API

## Disponible realmente

GET /health devuelve HTTP 200:

```json
{ "status": "ok", "service": "banco-tiempo-backend" }
```

Es liveness del proceso. No certifica conectividad ni estado del esquema de BD.

GET /docs sirve Swagger UI y GET /docs-json el documento OpenAPI si SWAGGER_ENABLED=true. OpenAPI solo publica /health. Los middlewares de Swagger no constituyen endpoints de negocio.

Los errores HTTP tienen statusCode, message (texto o lista de validaciones) y timestamp ISO. Los errores 5xx usan un mensaje genérico. Solicitudes limitadas reciben 429. La validación prohíbe propiedades adicionales y no convierte implícitamente tipos del body.

## Previsto, todavía no expuesto

| Ruta                | Finalidad y seguridad                         | Estado                                               |
| ------------------- | --------------------------------------------- | ---------------------------------------------------- |
| POST /auth/register | Registro público; únicamente ESTUDIANTE       | 404; pendiente esquema, adaptador y política inicial |
| POST /auth/login    | Credenciales; respuesta Bearer con expiración | 404; pendiente adaptador                             |
| GET /users/me       | Perfil del sujeto del JWT activo              | 404; pendiente adaptador                             |
| PATCH /users/me     | Actualiza exclusivamente perfil permitido     | 404; pendiente adaptador                             |

Los DTO y servicios preparan el siguiente contrato para acordar con APIs y Frontend. Los límites actuales son límites de entrada del backend; revisar su compatibilidad con longitudes, tipos y catálogos del SQL oficial antes de publicar.

Registro: nombre y apellido no vacíos de hasta 100 caracteres; correo válido de hasta 254, normalizado a minúsculas; password de 12 a 128 caracteres; idCarrera como identificador opaco de hasta 128 caracteres; semestre entero >=1. No se aceptan roles, IDs de usuario, estado, hash ni créditos.

Login: correo y password (1–128 caracteres). Al integrarse correctamente, el servicio devuelve access_token, token_type="Bearer" y user sin datos sensibles. El JWT contiene sub, iat, exp, iss y aud. No se han implementado refresh tokens ni cierre de sesión remoto.

Perfil: id, nombre, apellido, correo, idCarrera, semestre y roles. PATCH admite nombre, apellido, idCarrera y semestre; no admite null, correo, contraseña, roles, saldo ni otro ID. El identificador para persistir provendrá exclusivamente de CurrentUser.

Estados previstos: 400 DTO inválido, 401 credenciales/token/usuario inactivos, 403 rol insuficiente, 409 correo duplicado, 429 límite y 503 dependencia/política no disponible. No forman promesas de endpoints de BD ya integrados.

No se implementa un controlador provisional con respuestas falsas o 503. El repositorio simulado y las rutas /**test** se usan únicamente dentro de Jest y están excluidos del backend compilado.
