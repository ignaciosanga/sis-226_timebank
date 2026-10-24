# Dashboards Power BI — Vista del Administrador

Aquí se desarrollan los dashboards de Power BI para la vista del administrador, conectados directamente a la base de datos PostgreSQL.

## Dashboards planificados

| Dashboard | HU | Descripción |
|-----------|-----|-------------|
| Dashboard general | HU04 | KPIs principales + actividad por periodo + intercambios por estado |
| Intercambios y reservas | HU05 | Tendencias + tasas de aceptación/rechazo + motivos de cancelación |
| Usuarios y comunidad | HU06 | Usuarios por carrera, semestre, estado + crecimiento temporal |
| Habilidades y demanda | HU07 | Oferta vs demanda + distribución por categoría |

## Conexión a la base de datos

- **Host:** `127.0.0.1`
- **Puerto:** `55432`
- **Base de datos:** `timebank_local`
- **Credenciales:** ver archivo `.env` del Backend
