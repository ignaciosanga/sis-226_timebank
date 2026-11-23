# Notificaciones

El módulo expone las notificaciones del usuario autenticado y permite marcarlas
como leídas. Las notificaciones se guardan en el mismo estado transaccional que
las solicitudes y reservas, usando la tabla existente `NOTIFICACIONES` en
PostgreSQL y el repositorio en memoria durante pruebas.

## Endpoints

- `GET /notifications/me?page=1&limit=20`: devuelve la lista propia paginada,
  más reciente primero y con el total de no leídas.
- `PATCH /notifications/:id/read`: marca como leída una notificación propia.
- `POST /notifications/read-all`: marca como leídas todas las propias y devuelve
  `{ actualizadas }`.

## Eventos

- Solicitud nueva: avisa al ofertante.
- Solicitud aceptada o rechazada: avisa a quien la envió.
- Solicitud pendiente cancelada: avisa al ofertante.
- Reserva cancelada: avisa a la otra persona; una cancelación administrativa
  avisa a ambas.
- Confirmación de reserva: cuando una persona confirma, avisa a la otra que
  falta su confirmación.
- Opinión recibida: se avisa al tutor cuando se guarda una calificación válida.

Cada evento usa un identificador estable por evento y destinatario, para evitar
duplicados si la operación se reintenta. La creación de avisos de solicitudes y
reservas y opiniones comparte la transacción de negocio correspondiente.
