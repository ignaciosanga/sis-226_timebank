Nota para el equipo: Chicos, para evitar los cruces que teníamos con los documentos del back, este archivo es la única fuente de verdad. Salió directo del /docs-json de la rama main. Si hay algo distinto en otro PDF o documento viejo, ignórenlo. Lo que manda es esto.

Reglas Generales
URL base local: http://localhost:4000

IDs y Fechas: Usamos UUIDs para los IDs y formato ISO-8601 para las fechas (con zona horaria).

Errores típicos: 400 si mandan mal los datos, 401 si no hay sesión, 403 si no tienen permiso, 404 si no existe, y 409 si hay un choque de reglas de negocio.

Nombres exactos que vamos a manejar
Para que el front y el back hablen el mismo idioma, usen exactamente estos valores:

Roles: ESTUDIANTE, PROFESOR, ADMIN

Niveles de habilidad: Basico, Intermedio, Avanzado, Experto

Estado de la Solicitud (cuando recién la pides): Solicitada, Aceptada, Rechazada, Cancelada

Estado de la Reserva (cuando ya se aceptó): Confirmada, Completada, Cancelada

Tema Créditos y Horarios
Los importes de créditos se envían como strings decimales, por ejemplo `"10"` o `"3.7"`, nunca como números JSON. El precio de una oferta es el precio total publicado para esa clase y no depende de su duración. En el flujo histórico sin oferta, el costo se calcula por duración: 1 crédito equivale a 15 minutos.

Se acepta como máximo una cifra decimal; no se deben usar operaciones de coma flotante para sumar o comparar créditos.

Las reservas son de mínimo 15 minutos y máximo 8 horas (siempre en múltiplos de 15).

Endpoints Principales
1. Autenticación y Usuarios
POST /auth/register (Libre): Mandas nombre, apellido, correo con dominio `ucb.edu.bo`, password, idCarrera, semestre. Crea el usuario.

POST /auth/login (Libre): Mandas correo y password. Te devuelve el { access_token }.

GET /users/me (Con token): Te devuelve tu perfil.

2. Habilidades (Lo que enseñas/buscas)
GET /skills (Libre): Lista todas las habilidades. También existe GET /skills/:id/providers para listar los ofertantes de una habilidad y filtrar por nivel.

POST /users/me/skills (Con token): Para publicar lo que sabes. Mandas { skillId, nivel } (usen los niveles de arriba).

GET /careers (Libre): Lista carreras activas. Usa el UUID de la carrera al registrar un estudiante. GET /careers/:id devuelve una carrera específica.

3. El Flujo de la Tutoría (Intercambio)
Paso 1: POST /exchanges (Con token): Pides la tutoría. Mandas { providerId, skillId, availabilityId, fechaInicio, fechaFin, offerId?, descripcion? }. Queda como Solicitada. Cuando corresponde a una oferta, el backend copia su precio publicado y el cliente no manda el importe.

Paso 2: POST /exchanges/:id/accept (Con token): El otro acepta. Pasa a Confirmada y ahí recién se retienen los créditos.

Paso 3: POST /reservations/:id/confirm (Con token): Cuando terminan la clase, ambos confirman. A la segunda confirmación pasa a Completada y se pasan los créditos.

Regla de cancelaciones: Si alguien cancela antes de que empiece la clase (POST /reservations/:id/cancel), la reserva pasa a Cancelada y se devuelven los créditos retenidos. No se pueden cruzar horarios para una misma persona.

4. Google Calendar (RF-28)
POST /calendar/reservations/:id/authorization-url (Con token): Solo funciona para una reserva `Confirmada` de la que eres participante. Devuelve una `authorizationUrl`; el frontend abre esa URL para que Google pida el permiso `calendar.events` en ese preciso momento.

GET /calendar/callback: Es la URL a la que Google vuelve después de autorizar. El backend crea el evento en el calendario principal y redirige a `/intercambios?calendar=created`. Si el evento ya existía para esa reserva, redirige con `calendar=exists` y no crea un duplicado.

5. Notificaciones (RF-36 y RF-37)
Todas las rutas requieren un token válido y solo acceden a las notificaciones de la persona autenticada.

GET /notifications/me?page=1&limit=20: Devuelve `{ data, meta }`, donde `data` contiene `{ id_notificacion, tipo, titulo, mensaje, leida, created_at }` ordenados de más reciente a más antiguo y `meta` incluye `page`, `limit`, `total`, `totalPages` y `noLeidas`.

PATCH /notifications/:id/read: Marca como leída una notificación propia y devuelve la notificación actualizada. Si no existe o pertenece a otra persona, responde 404.

POST /notifications/read-all: Marca como leídas todas las notificaciones propias y devuelve `{ actualizadas }`.

El backend genera notificaciones al recibir, aceptar, rechazar o cancelar una solicitud; al cancelar una reserva; cuando una persona confirma la clase y falta la confirmación de la otra; y cuando se guarda una opinión válida. Las notificaciones se guardan dentro de la transacción que produce cada evento.
