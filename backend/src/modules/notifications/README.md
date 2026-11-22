# Notificaciones

El módulo expone las notificaciones del usuario autenticado y permite marcarlas
como leídas. Las notificaciones se guardan en el mismo estado transaccional que
las solicitudes y reservas, usando la tabla existente `NOTIFICACIONES` en
PostgreSQL y el repositorio en memoria durante pruebas.

## Endpoints

- `GET /notifications/me`: lista propia, más reciente primero.
- `PATCH /notifications/:id/read`: marca como leída una notificación propia.
- `POST /notifications/read-all`: marca como leídas todas las propias y devuelve
  `{ actualizadas }`.

## Eventos

- Solicitud nueva: avisa al ofertante.
- Solicitud aceptada o rechazada: avisa a quien la envió.
- Solicitud pendiente cancelada: avisa al ofertante.
- Reserva cancelada: avisa a la otra persona; una cancelación administrativa
  avisa a ambas.
- Reserva completada: avisa a la otra persona cuando llega la segunda
  confirmación.
- Opinión recibida: `NotificationsService.notifyOpinionReceived` es el punto de
  integración para el módulo de calificaciones. Ese módulo aún no implementa el
  flujo que guarda opiniones.

Cada evento usa un identificador estable por evento y destinatario, para evitar
duplicados si la operación se reintenta. La creación de avisos de solicitudes y
reservas comparte su transacción de negocio.
