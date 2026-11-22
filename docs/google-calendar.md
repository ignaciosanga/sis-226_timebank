# Google Calendar — RF-28

Una reserva se agrega al calendario **solo cuando su participante lo solicita**. La autorización OAuth no se pide al iniciar sesión, aceptar una solicitud ni crear una reserva.

## Configuración privada

Configurar únicamente en `backend/.env` local y en variables privadas de Render:

```text
GOOGLE_CALENDAR_ENABLED=true
GOOGLE_CALENDAR_CLIENT_ID=<id de cliente OAuth>
GOOGLE_CALENDAR_CLIENT_SECRET=<secreto OAuth>
GOOGLE_CALENDAR_REDIRECT_URI=https://timebank-backend-51q9.onrender.com/calendar/callback
FRONTEND_URL=https://timebank-frontend.onrender.com
```

Para desarrollo local, el redirect URI es `http://localhost:4000/calendar/callback` y `FRONTEND_URL` es `http://localhost:5173`. Esas URLs deben estar registradas en el cliente OAuth de Google Cloud. Nunca versionar ni exponer el secreto al frontend.

## Flujo

1. El frontend autenticado llama `POST /calendar/reservations/:id/authorization-url`.
2. El backend comprueba que el usuario participa en la reserva y que su estado es `Confirmada`.
3. El frontend abre la `authorizationUrl` recibida; Google solicita `calendar.events` en ese momento.
4. Google vuelve a `GET /calendar/callback`. El backend intercambia el código, evita duplicados con el ID de reserva y crea el evento en el calendario principal del usuario.
5. El navegador vuelve a `/intercambios?calendar=created` o `calendar=exists`.

El token de Google solo se usa durante el callback y no se almacena.
